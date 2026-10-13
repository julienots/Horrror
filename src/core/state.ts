import type { Dir, StatusId } from '../data/types';
import { START } from '../data/zones';

export const SAVE_VERSION = 2;
export const TEAM_MAX = 4;
export const RELIQUARY_MAX = 60;

export interface CreatureInstance {
  uid: string;
  species: string;
  level: number;
  xp: number; // expérience cumulée
  hp: number;
  energy: number;
  abilities: string[]; // actives (4 max)
  known: string[]; // toutes les capacités apprises
  bond: number; // niveau de lien 0..5
  bondXp: number;
  equip?: string;
  mutated?: boolean; // a déjà subi une transformation
}

export interface CodexEntry {
  seen: boolean;
  observed: number; // 0..3 : signes compris
  bonded: boolean;
  pacified: boolean;
  repelled: number;
  defeated: number;
}

export interface QuestState {
  stage: number;
  done: boolean;
}

export interface Options {
  textSpeed: 'lent' | 'normal' | 'rapide' | 'instantane';
  animSpeed: 1 | 2 | 4;
  musicVol: number; // 0..1
  sfxVol: number;
  ambVol: number;
  textSize: 'normal' | 'grand';
  reduceFlashes: boolean;
  reduceShake: boolean;
  horror: 'normal' | 'attenue';
  highContrast: boolean;
}

export const DEFAULT_OPTIONS: Options = {
  textSpeed: 'normal',
  animSpeed: 1,
  musicVol: 0.6,
  sfxVol: 0.7,
  ambVol: 0.6,
  textSize: 'normal',
  reduceFlashes: false,
  reduceShake: false,
  horror: 'normal',
  highContrast: false,
};

export interface GameState {
  version: number;
  player: { name: string; zone: string; x: number; y: number; dir: Dir };
  time: number; // minutes depuis minuit
  day: number;
  team: CreatureInstance[];
  reliquary: CreatureInstance[];
  inventory: Record<string, number>;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  quests: Record<string, QuestState>;
  clues: string[];
  readDocs: string[];
  codex: Record<string, CodexEntry>;
  morality: { light: number; shadow: number };
  repelSteps: number;
  steps: number;
  playSeconds: number;
  lastRest: { zone: string; x: number; y: number };
  rngState: number;
  uidCounter: number;
  endings: string[];
  options: Options;
}

export function newGame(seed = (Math.random() * 2 ** 32) >>> 0): GameState {
  return {
    version: SAVE_VERSION,
    player: { name: 'Sacha', zone: START.zone, x: START.x, y: START.y, dir: START.dir },
    time: START.time,
    day: 1,
    team: [],
    reliquary: [],
    inventory: {},
    flags: {},
    counters: {},
    quests: {},
    clues: [],
    readDocs: [],
    codex: {},
    morality: { light: 0, shadow: 0 },
    repelSteps: 0,
    steps: 0,
    playSeconds: 0,
    lastRest: { zone: 'pension', x: 5, y: 7 },
    rngState: seed >>> 0,
    uidCounter: 1,
    endings: [],
    options: { ...DEFAULT_OPTIONS },
  };
}

export function codexOf(state: GameState, species: string): CodexEntry {
  let e = state.codex[species];
  if (!e) {
    e = { seen: false, observed: 0, bonded: false, pacified: false, repelled: 0, defeated: 0 };
    state.codex[species] = e;
  }
  return e;
}

export function nextUid(state: GameState): string {
  const id = `r${state.uidCounter}`;
  state.uidCounter += 1;
  return id;
}

export type BattleStatus = { id: StatusId; turns: number };
