// Types centraux des données du jeu. Toutes les données de contenu
// (créatures, capacités, objets, quêtes, zones) respectent ces formes.

export type AffinityId =
  | 'chair'
  | 'echo'
  | 'cendre'
  | 'vide'
  | 'reve'
  | 'verre'
  | 'racine'
  | 'signal';

export type StatusId = 'effroi' | 'saignement' | 'cendres' | 'oubli' | 'fele' | 'torpeur';

export type StatKey = 'hp' | 'atk' | 'def' | 'psy' | 'vit';
export type StageKey = 'atk' | 'def' | 'psy' | 'vit';

export type TimePhase = 'jour' | 'crepuscule' | 'nuit' | 'minuit';

// ---------------------------------------------------------------- Conditions

export type Condition =
  | { flag: string }
  | { notFlag: string }
  | { item: string; qty?: number }
  | { notItem: string }
  | { clue: string }
  | { clueCount: number }
  | { time: TimePhase | TimePhase[] }
  | { quest: string; atLeast?: number; below?: number; done?: boolean }
  | { owned: string }
  | { bonded: string }
  | { pacified: string }
  | { teamAffinity: AffinityId }
  | { fieldSkill: FieldSkill }
  | { counter: string; atLeast?: number; below?: number; eq?: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { gaveOk: true }; // le dernier `give` du script a réussi

// ---------------------------------------------------------------- Capacités

export type AbilityTarget = 'foe' | 'self';
export type AbilityCategory = 'physique' | 'psychique' | 'soutien';

export interface AbilityEffect {
  status?: { id: StatusId; chance: number; target?: AbilityTarget };
  stages?: { target: AbilityTarget; changes: Partial<Record<StageKey, number>> };
  healFraction?: number; // soin du lanceur (fraction des PV max)
  drainFraction?: number; // fraction des dégâts infligés récupérée
  recoilFraction?: number; // fraction des dégâts infligés subie
  cleanse?: boolean; // retire les statuts du lanceur
  energyDrain?: number; // énergie retirée à la cible
  multiHit?: [number, number];
}

export interface AbilityDef {
  id: string;
  name: string;
  affinity: AffinityId;
  category: AbilityCategory;
  power: number; // 0 pour les capacités de soutien
  accuracy: number; // 0..1
  cost: number; // énergie
  priority?: number;
  critBonus?: number;
  description: string;
  effect?: AbilityEffect;
  fx: 'slash' | 'wave' | 'shards' | 'ash' | 'void' | 'dream' | 'roots' | 'static' | 'bell' | 'heal' | 'buff';
}

// ---------------------------------------------------------------- Créatures

export type FieldSkill = 'eclairer' | 'glisser' | 'bruler' | 'ecouter';

export type BondMethod =
  | { kind: 'pacte' } // affaiblir puis Fil rouge
  | { kind: 'offrande'; item: string; hint: string } // donner un objet précis
  | { kind: 'choix'; prompt: string; answers: string[]; correct: number; requiresClue?: string }
  | { kind: 'aucun'; reason: string };

export type PassiveId =
  | 'repli'
  | 'couvee'
  | 'glas'
  | 'noyade'
  | 'devoreur'
  | 'mimetisme'
  | 'eclats'
  | 'imitation'
  | 'griffonnage'
  | 'chaleur'
  | 'meche'
  | 'epines'
  | 'parasite'
  | 'resonance'
  | 'phare'
  | 'coquille'
  | 'controle'
  | 'veille'
  | 'effacement'
  | 'seuil';

export interface PassiveDef {
  id: PassiveId;
  name: string;
  description: string;
}

export type MapBehavior = 'errance' | 'traque' | 'reflet' | 'immobile' | 'murs' | 'poursuite';

export interface CreatureDef {
  id: string;
  name: string;
  affinities: [AffinityId] | [AffinityId, AffinityId];
  base: Record<StatKey, number>;
  learnset: Array<[number, string]>; // [niveau, idCapacité]
  passive: PassiveId;
  rarity: 'commun' | 'peu-commun' | 'rare' | 'unique';
  silhouette: string; // description courte du design
  lore: string; // histoire liée (débloquée progressivement)
  tragic?: boolean;
  signs: { fear: string; desire: string; tell: string }; // révélés par Observer
  bond: BondMethod;
  transform?: { into: string; level?: number; condition?: Condition; bondLevel?: number };
  fieldSkill?: FieldSkill;
  mapBehavior: MapBehavior;
  baseXp: number;
  catchRate: number; // 0..1 facilité du pacte
  cry: { base: number; shape: OscillatorShape; pattern: number[]; noise?: number };
  palette: string[]; // couleurs utilisées par le sprite procédural
  boss?: boolean;
}

export type OscillatorShape = 'sine' | 'square' | 'sawtooth' | 'triangle';

// ---------------------------------------------------------------- Objets

export type ItemCategory =
  | 'soin'
  | 'lien'
  | 'cle'
  | 'outil'
  | 'document'
  | 'enquete'
  | 'equipement'
  | 'quete';

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  description: string;
  unique?: boolean;
  maxStack?: number;
  usableIn?: Array<'combat' | 'exploration'>;
  effect?:
    | { kind: 'heal'; amount: number }
    | { kind: 'healFull' }
    | { kind: 'energy'; amount: number }
    | { kind: 'cure' }
    | { kind: 'revive'; fraction: number }
    | { kind: 'repel'; steps: number }
    | { kind: 'bond'; power: number }
    | { kind: 'xp'; amount: number };
  equip?: { stat?: Partial<Record<StageKey, number>>; resist?: StatusId; desc: string };
  requirement?: string; // prérequis affiché
  clueWhen?: Condition; // l'indice n'est obtenu à la lecture que si...
  document?: string; // texte lisible pour les documents/cassettes
  clue?: string; // indice obtenu en lisant
  value?: number;
}

// ---------------------------------------------------------------- Quêtes / indices

export interface QuestDef {
  id: string;
  name: string;
  main?: boolean;
  stages: string[]; // descriptions d'objectif, index = étape
  reward?: { items?: Array<[string, number]>; xp?: number; light?: number };
}

export interface ClueDef {
  id: string;
  name: string;
  text: string;
  key?: boolean; // indice clé pour la révélation finale
}

export interface LeadDef {
  id: string;
  text: string;
  appearsWhen: Condition;
  resolvedWhen: Condition;
}

// ---------------------------------------------------------------- Scripts

export type Speaker = string; // id de personnage ou '' pour narration

export type ScriptCmd =
  | { say: string; who?: Speaker; mood?: Mood }
  | { choice: string; who?: Speaker; options: Array<{ text: string; when?: Condition; then: ScriptCmd[] }> }
  | { if: Condition; then: ScriptCmd[]; else?: ScriptCmd[] }
  | { setFlag: string; value?: boolean }
  | { counter: string; add?: number; set?: number }
  | { give: string; qty?: number; silent?: boolean }
  | { take: string; qty?: number }
  | { clue: string }
  | { quest: string; stage: number }
  | { questDone: string }
  | { battle: string; level: number; boss?: boolean; noFlee?: boolean; then?: ScriptCmd[]; onBond?: ScriptCmd[]; onWin?: ScriptCmd[] }
  | { pacify: string }
  | {
      chase: string; // créature qui poursuit
      from: [number, number];
      escape: [number, number, number, number]; // rectangle x1,y1,x2,y2 à atteindre
      caught: ScriptCmd[];
      escaped: ScriptCmd[];
    }
  | { bondDirect: string; level: number }
  | { warp: string; x: number; y: number; dir?: Dir }
  | { sound: string }
  | { music: string | null }
  | { horror: HorrorFx }
  | { wait: number }
  | { fade: 'out' | 'in' }
  | { setTime: number }
  | { morality: 'light' | 'shadow'; amount: number }
  | { heal: true }
  | { codeInput: string; correct: string; then: ScriptCmd[]; else?: ScriptCmd[] }
  | { ending: EndingId }
  | { save: true }
  | { npcForget: string }
  | { read: string }
  | { removeEntity: string };

export type Mood = 'neutre' | 'peur' | 'triste' | 'sourire' | 'vide' | 'colere';

export type HorrorFx =
  | 'silhouette'
  | 'coups'
  | 'lumieres'
  | 'radio'
  | 'souffle'
  | 'pas'
  | 'cloches'
  | 'flash'
  | 'secousse'
  | 'chuchotement';

export type EndingId = 'memoire' | 'sceau' | 'brouillard';

export type Dir = 'up' | 'down' | 'left' | 'right';

// ---------------------------------------------------------------- Zones

export interface WarpDef {
  x: number;
  y: number;
  to: string;
  tx: number;
  ty: number;
  dir?: Dir;
  when?: Condition;
  locked?: string; // message si condition non remplie
  sound?: 'porte' | 'escalier' | 'pas' | 'train';
}

export interface EntityDef {
  id: string;
  x: number;
  y: number;
  kind: 'npc' | 'objet' | 'panneau' | 'apparition' | 'declencheur' | 'coffre';
  sprite?: string; // id de personnage ou de créature
  dir?: Dir;
  when?: Condition; // présent seulement si...
  script?: ScriptCmd[];
  touch?: boolean; // déclenché en marchant dessus
  solid?: boolean;
  behavior?: MapBehavior;
  light?: number; // rayon lumineux
  hidden?: boolean; // visible uniquement avec Écouter / proximité
}

export interface EncounterEntry {
  creature: string;
  weight: number;
  levels: [number, number];
  when?: Condition;
}

export type ZoneTheme =
  | 'village'
  | 'interieur'
  | 'foret'
  | 'ecole'
  | 'hopital'
  | 'gare'
  | 'marais'
  | 'mine'
  | 'cendriers'
  | 'institut'
  | 'seuil'
  | 'train';

export interface ZoneDef {
  id: string;
  name: string;
  region: string;
  theme: ZoneTheme;
  map: string[]; // grille ASCII
  variants?: Array<{ when: Condition; patches: Array<{ x: number; y: number; rows: string[] }> }>;
  warps: WarpDef[];
  entities: EntityDef[];
  encounters?: EncounterEntry[];
  encounterRate?: number; // probabilité par pas sur une tuile de rencontre
  ambience: string;
  music?: string;
  dark?: number; // 0..1 obscurité de base
  fog?: number; // 0..1 densité de brume
  eternalNight?: boolean;
  encounterAll?: boolean; // rencontres possibles sur toute tuile praticable (intérieurs)
  indoor?: boolean;
  mapPos?: [number, number]; // position sur la carte de la région
  onEnter?: ScriptCmd[];
  enterOnceFlag?: string;
}
