import { ABILITIES } from '../data/abilities';
import { CREATURES } from '../data/creatures';
import { ITEMS } from '../data/items';
import { CLUES, QUESTS } from '../data/story';
import { ZONES, START } from '../data/zones';
import { tileAt } from '../data/tiles';
import { type CreatureInstance, type GameState, DEFAULT_OPTIONS, type Options, RELIQUARY_MAX, SAVE_VERSION, TEAM_MAX, newGame } from './state';

// Sauvegarde versionnée, avec somme de contrôle, écriture en deux temps
// (fichier temporaire → principal, ancienne version gardée en secours) et
// réparation prudente des données invalides.

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class MemoryKV implements KV {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'] as const;
export type SlotId = (typeof SLOTS)[number];

const PREFIX = 'veilbound.v1.';
const MAGIC = 'VEILBOUND';

interface Envelope {
  magic: string;
  version: number;
  savedAt: number;
  checksum: string;
  summary: SaveSummary;
  data: GameState;
}

export interface SaveSummary {
  zoneName: string;
  playSeconds: number;
  teamLevels: number[];
  day: number;
  chapter: number;
}

export function checksum(s: string): string {
  // FNV-1a 32 bits
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function summaryOf(state: GameState): SaveSummary {
  return {
    zoneName: ZONES[state.player.zone]?.name ?? '?',
    playSeconds: Math.floor(state.playSeconds),
    teamLevels: state.team.map((c) => c.level),
    day: state.day,
    chapter: state.quests['q_main']?.stage ?? 0,
  };
}

export function serialize(state: GameState, now = Date.now()): string {
  const data = JSON.parse(JSON.stringify(state)) as GameState;
  const payload = JSON.stringify(data);
  const env: Envelope = { magic: MAGIC, version: SAVE_VERSION, savedAt: now, checksum: checksum(payload), summary: summaryOf(state), data };
  return JSON.stringify(env);
}

export type LoadResult =
  | { ok: true; state: GameState; repairs: string[]; recoveredFrom?: 'bak' | 'tmp'; savedAt: number }
  | { ok: false; error: string };

export function deserialize(raw: string | null): LoadResult {
  if (!raw) return { ok: false, error: 'vide' };
  let env: Envelope;
  try {
    env = JSON.parse(raw) as Envelope;
  } catch {
    return { ok: false, error: 'json' };
  }
  if (!env || env.magic !== MAGIC || typeof env.data !== 'object' || env.data === null) return { ok: false, error: 'format' };
  if (typeof env.version !== 'number' || env.version > SAVE_VERSION) return { ok: false, error: 'version' };
  if (checksum(JSON.stringify(env.data)) !== env.checksum) return { ok: false, error: 'checksum' };
  const migrated = migrate(env.data, env.version);
  const v = validateState(migrated);
  return { ok: true, state: v.state, repairs: v.repairs, savedAt: env.savedAt };
}

/** Migrations successives d'anciennes versions. */
export function migrate(data: any, from: number): any {
  const d = data;
  if (from < 2) {
    // v1 → v2 : ajout des documents lus et des options d'accessibilité.
    d.readDocs = d.readDocs ?? [];
    d.options = { ...DEFAULT_OPTIONS, ...(d.options ?? {}) };
  }
  d.version = SAVE_VERSION;
  return d;
}

function num(v: unknown, def: number, min = -Infinity, max = Infinity): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : def;
}

function validCreature(c: any, repairs: string[]): CreatureInstance | null {
  if (!c || typeof c !== 'object' || !CREATURES[c.species]) {
    repairs.push('créature inconnue retirée');
    return null;
  }
  const out: CreatureInstance = {
    uid: typeof c.uid === 'string' ? c.uid : `r${Math.floor(Math.random() * 1e9)}`,
    species: c.species,
    level: Math.floor(num(c.level, 1, 1, 50)),
    xp: num(c.xp, 0, 0),
    hp: Math.floor(num(c.hp, 1, 0)),
    energy: Math.floor(num(c.energy, 10, 0)),
    abilities: Array.isArray(c.abilities) ? c.abilities.filter((a: unknown) => typeof a === 'string' && ABILITIES[a as string]).slice(0, 4) : [],
    known: Array.isArray(c.known) ? c.known.filter((a: unknown) => typeof a === 'string' && ABILITIES[a as string]) : [],
    bond: Math.floor(num(c.bond, 0, 0, 5)),
    bondXp: num(c.bondXp, 0, 0),
    equip: typeof c.equip === 'string' && ITEMS[c.equip]?.equip ? c.equip : undefined,
    mutated: !!c.mutated,
  };
  if (!out.abilities.length) {
    const fallback = CREATURES[out.species].learnset.filter(([l]) => l <= out.level).map(([, a]) => a);
    out.abilities = fallback.slice(-4);
    out.known = [...new Set([...out.known, ...fallback])];
    repairs.push('capacités reconstruites');
  }
  for (const a of out.abilities) if (!out.known.includes(a)) out.known.push(a);
  // Bornes PV/énergie calculées sans dépendre de systems/ (évite un cycle).
  const base = CREATURES[out.species].base.hp;
  const max = Math.floor((base * 2 * out.level) / 50 + out.level + 18);
  if (out.hp > max) out.hp = max;
  const maxEn = 10 + Math.floor(out.level / 10);
  if (out.energy > maxEn) out.energy = maxEn;
  return out;
}

export function isWalkableStart(zoneId: string, x: number, y: number): boolean {
  const z = ZONES[zoneId];
  if (!z) return false;
  const row = z.map[y];
  if (!row || x < 0 || x >= row.length) return false;
  return !tileAt(row[x]).solid;
}

/** Valide et répare un état chargé. Ne lève jamais d'exception. */
export function validateState(raw: any): { state: GameState; repairs: string[] } {
  const repairs: string[] = [];
  const base = newGame(0);
  if (!raw || typeof raw !== 'object') return { state: base, repairs: ['état illisible, nouvelle partie'] };
  const s: GameState = { ...base };
  const p = raw.player ?? {};
  s.player = {
    name: typeof p.name === 'string' && p.name ? p.name.slice(0, 16) : 'Sacha',
    zone: typeof p.zone === 'string' && ZONES[p.zone] ? p.zone : START.zone,
    x: Math.floor(num(p.x, START.x)),
    y: Math.floor(num(p.y, START.y)),
    dir: ['up', 'down', 'left', 'right'].includes(p.dir) ? p.dir : 'down',
  };
  if (s.player.zone !== p.zone) repairs.push('zone inconnue');
  s.time = num(raw.time, base.time, 0, 1439.999);
  s.day = Math.floor(num(raw.day, 1, 1));
  s.team = (Array.isArray(raw.team) ? raw.team : []).map((c: any) => validCreature(c, repairs)).filter(Boolean).slice(0, TEAM_MAX) as CreatureInstance[];
  s.reliquary = (Array.isArray(raw.reliquary) ? raw.reliquary : []).map((c: any) => validCreature(c, repairs)).filter(Boolean).slice(0, RELIQUARY_MAX) as CreatureInstance[];
  // Jamais d'équipe vide si des créatures existent au reliquaire.
  if (!s.team.length && s.reliquary.length) {
    s.team.push(s.reliquary.shift() as CreatureInstance);
    repairs.push('équipe reconstituée');
  }
  // Pas de doublon d'identifiant (protection contre la duplication).
  const seen = new Set<string>();
  for (const list of [s.team, s.reliquary]) {
    for (let i = list.length - 1; i >= 0; i--) {
      if (seen.has(list[i].uid)) {
        list.splice(i, 1);
        repairs.push('doublon retiré');
      } else seen.add(list[i].uid);
    }
  }
  s.inventory = {};
  if (raw.inventory && typeof raw.inventory === 'object') {
    for (const [id, n] of Object.entries(raw.inventory)) {
      if (!ITEMS[id]) {
        repairs.push(`objet inconnu ${id}`);
        continue;
      }
      const q = Math.floor(num(n, 0, 0, 99));
      if (q > 0) s.inventory[id] = ITEMS[id].unique || ['cle', 'outil', 'quete', 'document'].includes(ITEMS[id].category) ? 1 : q;
    }
  }
  s.flags = {};
  if (raw.flags && typeof raw.flags === 'object') for (const [k, v] of Object.entries(raw.flags)) if (v === true) s.flags[k] = true;
  s.counters = {};
  if (raw.counters && typeof raw.counters === 'object') for (const [k, v] of Object.entries(raw.counters)) s.counters[k] = Math.floor(num(v, 0));
  s.quests = {};
  if (raw.quests && typeof raw.quests === 'object') {
    for (const [id, q] of Object.entries(raw.quests as Record<string, any>)) {
      const def = QUESTS[id];
      if (!def || !q) continue;
      s.quests[id] = { stage: Math.floor(num(q.stage, 0, 0, def.stages.length - 1)), done: !!q.done };
    }
  }
  s.clues = Array.isArray(raw.clues) ? [...new Set(raw.clues.filter((c: unknown) => typeof c === 'string' && CLUES[c as string]))] as string[] : [];
  s.readDocs = Array.isArray(raw.readDocs) ? raw.readDocs.filter((d: unknown) => typeof d === 'string') : [];
  s.codex = {};
  if (raw.codex && typeof raw.codex === 'object') {
    for (const [id, e] of Object.entries(raw.codex as Record<string, any>)) {
      if (!CREATURES[id] || !e) continue;
      s.codex[id] = { seen: !!e.seen, observed: Math.floor(num(e.observed, 0, 0, 3)), bonded: !!e.bonded, pacified: !!e.pacified, repelled: Math.floor(num(e.repelled, 0, 0)), defeated: Math.floor(num(e.defeated, 0, 0)) };
    }
  }
  s.morality = { light: Math.floor(num(raw.morality?.light, 0, 0)), shadow: Math.floor(num(raw.morality?.shadow, 0, 0)) };
  s.repelSteps = Math.floor(num(raw.repelSteps, 0, 0));
  s.steps = Math.floor(num(raw.steps, 0, 0));
  s.playSeconds = num(raw.playSeconds, 0, 0);
  const lr = raw.lastRest ?? {};
  s.lastRest = typeof lr.zone === 'string' && ZONES[lr.zone] && isWalkableStart(lr.zone, lr.x, lr.y) ? { zone: lr.zone, x: lr.x, y: lr.y } : base.lastRest;
  s.rngState = Math.floor(num(raw.rngState, 12345)) >>> 0;
  s.uidCounter = Math.floor(num(raw.uidCounter, 1000, 1));
  s.endings = Array.isArray(raw.endings) ? raw.endings.filter((e: unknown) => typeof e === 'string') : [];
  s.options = sanitizeOptions(raw.options);
  // Position : si la tuile n'est pas praticable, retour au dernier lieu de repos.
  if (!isWalkableStart(s.player.zone, s.player.x, s.player.y)) {
    repairs.push('position invalide, retour au dernier repos');
    s.player.zone = s.lastRest.zone;
    s.player.x = s.lastRest.x;
    s.player.y = s.lastRest.y;
  }
  return { state: s, repairs };
}

export function sanitizeOptions(o: any): Options {
  const d = DEFAULT_OPTIONS;
  if (!o || typeof o !== 'object') return { ...d };
  return {
    textSpeed: ['lent', 'normal', 'rapide', 'instantane'].includes(o.textSpeed) ? o.textSpeed : d.textSpeed,
    animSpeed: [1, 2, 4].includes(o.animSpeed) ? o.animSpeed : d.animSpeed,
    musicVol: num(o.musicVol, d.musicVol, 0, 1),
    sfxVol: num(o.sfxVol, d.sfxVol, 0, 1),
    ambVol: num(o.ambVol, d.ambVol, 0, 1),
    textSize: o.textSize === 'grand' ? 'grand' : 'normal',
    reduceFlashes: !!o.reduceFlashes,
    reduceShake: !!o.reduceShake,
    horror: o.horror === 'attenue' ? 'attenue' : 'normal',
    highContrast: !!o.highContrast,
  };
}

// ---------------------------------------------------------------- Stockage

export class SaveStore {
  constructor(private kv: KV) {}

  private key(slot: SlotId, suffix = ''): string {
    return `${PREFIX}${slot}${suffix}`;
  }

  /** Écriture atomique : tmp → vérification → bak ← ancien → principal. */
  write(slot: SlotId, state: GameState, now = Date.now()): { ok: boolean; error?: string } {
    let raw: string;
    try {
      raw = serialize(state, now);
    } catch (e) {
      return { ok: false, error: 'serialisation' };
    }
    try {
      this.kv.setItem(this.key(slot, '.tmp'), raw);
      const check = deserialize(this.kv.getItem(this.key(slot, '.tmp')));
      if (!check.ok) return { ok: false, error: 'verification' };
      const prev = this.kv.getItem(this.key(slot));
      if (prev && deserialize(prev).ok) this.kv.setItem(this.key(slot, '.bak'), prev);
      this.kv.setItem(this.key(slot), raw);
      this.kv.removeItem(this.key(slot, '.tmp'));
      return { ok: true };
    } catch {
      return { ok: false, error: 'stockage' };
    }
  }

  read(slot: SlotId): LoadResult {
    const main = deserialize(this.safeGet(this.key(slot)));
    if (main.ok) return main;
    const tmp = deserialize(this.safeGet(this.key(slot, '.tmp')));
    const bak = deserialize(this.safeGet(this.key(slot, '.bak')));
    // On préfère la version la plus récente parmi les copies valides.
    const candidates: Array<[LoadResult & { ok: true }, 'tmp' | 'bak']> = [];
    if (tmp.ok) candidates.push([tmp, 'tmp']);
    if (bak.ok) candidates.push([bak, 'bak']);
    if (!candidates.length) return main;
    candidates.sort((a, b) => b[0].savedAt - a[0].savedAt);
    const [best, from] = candidates[0];
    return { ...best, recoveredFrom: from };
  }

  summary(slot: SlotId): (SaveSummary & { savedAt: number; recovered?: boolean }) | null {
    const raw = this.safeGet(this.key(slot));
    try {
      const env = raw ? (JSON.parse(raw) as Envelope) : null;
      if (env && deserialize(raw).ok) return { ...env.summary, savedAt: env.savedAt };
    } catch {
      /* ignoré */
    }
    const r = this.read(slot);
    if (r.ok) return { ...summaryOf(r.state), savedAt: r.savedAt, recovered: true };
    return null;
  }

  /** Emplacement le plus récent lisible (pour « Continuer »). */
  latest(): SlotId | null {
    let best: SlotId | null = null;
    let t = -1;
    for (const s of SLOTS) {
      const sum = this.summary(s);
      if (sum && sum.savedAt > t) {
        t = sum.savedAt;
        best = s;
      }
    }
    return best;
  }

  remove(slot: SlotId): void {
    for (const suf of ['', '.bak', '.tmp']) this.kv.removeItem(this.key(slot, suf));
  }

  private safeGet(k: string): string | null {
    try {
      return this.kv.getItem(k);
    } catch {
      return null;
    }
  }
}

export const OPTIONS_KEY = 'veilbound.options';
