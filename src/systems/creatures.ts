import { ABILITIES } from '../data/abilities';
import { CREATURES } from '../data/creatures';
import type { AffinityId, CreatureDef, StatKey } from '../data/types';
import { type CreatureInstance, type GameState, codexOf, nextUid, RELIQUARY_MAX, TEAM_MAX } from '../core/state';

export const MAX_LEVEL = 50;
export const BOND_MAX = 5;

export function speciesOf(c: CreatureInstance): CreatureDef {
  const d = CREATURES[c.species];
  if (!d) throw new Error(`Espèce inconnue : ${c.species}`);
  return d;
}

/** Statistique effective (sans crans de combat). */
export function statOf(c: CreatureInstance, key: StatKey): number {
  const base = speciesOf(c).base[key];
  const lvl = c.level;
  if (key === 'hp') return Math.floor((base * 2 * lvl) / 50 + lvl + 18);
  return Math.floor((base * 2 * lvl) / 50 + 5);
}

export function maxHp(c: CreatureInstance): number {
  return statOf(c, 'hp');
}

export function maxEnergy(c: CreatureInstance): number {
  return 10 + Math.floor(c.level / 10);
}

/** Expérience cumulée nécessaire pour atteindre un niveau. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(0.8 * level ** 2.8);
}

export function xpReward(foeSpecies: string, foeLevel: number): number {
  const d = CREATURES[foeSpecies];
  return Math.max(1, Math.floor(((d?.baseXp ?? 40) * foeLevel) / 6));
}

/** Forme précédente (ex. Mitaine pour Main-Froide), si elle existe. */
export function previousForm(species: string): string | undefined {
  return Object.values(CREATURES).find((c) => c.transform?.into === species)?.id;
}

/** Capacités connues à un niveau donné, y compris celles des formes précédentes. */
export function abilitiesAt(species: string, level: number): string[] {
  const chain: string[] = [];
  let cur: string | undefined = species;
  while (cur && !chain.includes(cur)) {
    chain.unshift(cur);
    cur = previousForm(cur);
  }
  const out: Array<[number, string]> = [];
  for (const sp of chain) for (const [l, a] of CREATURES[sp].learnset) if (l <= level && !out.some(([, x]) => x === a)) out.push([l, a]);
  out.sort((a, b) => a[0] - b[0]);
  return out.map(([, a]) => a);
}

/** Crée une instance de créature à un niveau donné (capacités = 4 dernières apprises). */
export function makeCreature(state: GameState | null, species: string, level: number): CreatureInstance {
  const d = CREATURES[species];
  if (!d) throw new Error(`Espèce inconnue : ${species}`);
  const known = abilitiesAt(species, level);
  const c: CreatureInstance = {
    uid: state ? nextUid(state) : `tmp${Math.floor(Math.random() * 1e9)}`,
    species,
    level,
    xp: xpForLevel(level),
    hp: 1,
    energy: 0,
    abilities: known.slice(-4),
    known: [...known],
    bond: 0,
    bondXp: 0,
  };
  c.hp = maxHp(c);
  c.energy = maxEnergy(c);
  return c;
}

export function affinitiesOf(c: CreatureInstance): AffinityId[] {
  return [...speciesOf(c).affinities];
}

export interface LevelUpResult {
  levels: number[];
  learned: string[];
  learnedInactive: string[];
}

/** Ajoute de l'expérience ; gère les montées de niveau et l'apprentissage. */
export function gainXp(c: CreatureInstance, amount: number): LevelUpResult {
  const res: LevelUpResult = { levels: [], learned: [], learnedInactive: [] };
  if (c.level >= MAX_LEVEL) return res;
  c.xp += Math.max(0, Math.floor(amount));
  while (c.level < MAX_LEVEL && c.xp >= xpForLevel(c.level + 1)) {
    const oldMax = maxHp(c);
    c.level += 1;
    res.levels.push(c.level);
    // Les PV gagnés à la montée de niveau sont ajoutés aux PV actuels.
    if (c.hp > 0) c.hp = Math.min(maxHp(c), c.hp + (maxHp(c) - oldMax));
    for (const [lvl, ab] of speciesOf(c).learnset) {
      if (lvl === c.level && !c.known.includes(ab) && ABILITIES[ab]) {
        c.known.push(ab);
        if (c.abilities.length < 4) {
          c.abilities.push(ab);
          res.learned.push(ab);
        } else {
          res.learnedInactive.push(ab);
        }
      }
    }
  }
  if (c.level >= MAX_LEVEL) c.xp = xpForLevel(MAX_LEVEL);
  return res;
}

export function gainBond(c: CreatureInstance, amount = 1): boolean {
  if (c.bond >= BOND_MAX) return false;
  c.bondXp += amount;
  const need = 3 + c.bond * 2;
  if (c.bondXp >= need) {
    c.bondXp -= need;
    c.bond += 1;
    return true;
  }
  return false;
}

/** Retourne l'espèce cible si la créature peut se transformer maintenant. */
export function pendingTransform(c: CreatureInstance, state?: GameState): string | null {
  const t = speciesOf(c).transform;
  if (!t || !CREATURES[t.into]) return null;
  if (t.level !== undefined && c.level < t.level) return null;
  if (t.bondLevel !== undefined && c.bond < t.bondLevel) return null;
  if (t.condition && state) {
    // Conditions évaluées par le module conditions pour éviter un cycle d'import.
    return null;
  }
  return t.into;
}

/** Applique la transformation : nouvelle espèce, PV proportionnels, nouvelles capacités. */
export function applyTransform(c: CreatureInstance, into: string): string[] {
  const ratio = maxHp(c) > 0 ? c.hp / maxHp(c) : 1;
  c.species = into;
  c.mutated = true;
  c.hp = Math.max(c.hp > 0 ? 1 : 0, Math.round(maxHp(c) * ratio));
  const learned: string[] = [];
  for (const [lvl, ab] of speciesOf(c).learnset) {
    if (lvl <= c.level && !c.known.includes(ab) && ABILITIES[ab]) {
      c.known.push(ab);
      learned.push(ab);
      if (c.abilities.length < 4) c.abilities.push(ab);
    }
  }
  c.energy = Math.min(c.energy, maxEnergy(c));
  return learned;
}

export function healCreature(c: CreatureInstance): void {
  c.hp = maxHp(c);
  c.energy = maxEnergy(c);
}

export function healTeam(state: GameState): void {
  for (const c of state.team) healCreature(c);
}

export function aliveCount(team: CreatureInstance[]): number {
  return team.filter((c) => c.hp > 0).length;
}

/** Ajoute une créature liée à l'équipe ou au reliquaire. Retourne la destination. */
export function addBonded(state: GameState, c: CreatureInstance): 'equipe' | 'reliquaire' | 'plein' {
  const entry = codexOf(state, c.species);
  entry.seen = true;
  entry.bonded = true;
  if (state.team.length < TEAM_MAX) {
    state.team.push(c);
    return 'equipe';
  }
  if (state.reliquary.length < RELIQUARY_MAX) {
    healCreature(c);
    state.reliquary.push(c);
    return 'reliquaire';
  }
  return 'plein';
}

export function ownsSpecies(state: GameState, species: string): boolean {
  return [...state.team, ...state.reliquary].some((c) => c.species === species);
}

/** Échange une créature de l'équipe avec une du reliquaire (jamais d'équipe vide). */
export function swapWithReliquary(state: GameState, teamIndex: number, relIndex: number): boolean {
  const t = state.team[teamIndex];
  const r = state.reliquary[relIndex];
  if (!r) return false;
  if (!t) {
    if (state.team.length >= TEAM_MAX) return false;
    state.reliquary.splice(relIndex, 1);
    state.team.push(r);
    return true;
  }
  state.team[teamIndex] = r;
  healCreature(t);
  state.reliquary[relIndex] = t;
  return true;
}

export function depositToReliquary(state: GameState, teamIndex: number): boolean {
  if (state.team.length <= 1) return false;
  if (state.reliquary.length >= RELIQUARY_MAX) return false;
  const [c] = state.team.splice(teamIndex, 1);
  healCreature(c);
  state.reliquary.push(c);
  return true;
}

export function setActiveAbilities(c: CreatureInstance, ids: string[]): boolean {
  const unique = [...new Set(ids)].filter((a) => c.known.includes(a));
  if (unique.length < 1 || unique.length > 4) return false;
  c.abilities = unique;
  return true;
}

export function fieldSkills(state: GameState): Set<string> {
  const s = new Set<string>();
  for (const c of state.team) {
    const f = CREATURES[c.species]?.fieldSkill;
    if (f) s.add(f);
  }
  return s;
}
