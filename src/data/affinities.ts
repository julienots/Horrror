import type { AffinityId } from './types';

// Système d'affinités de VEILBOUND.
// Règle unique et lisible : si A « domine » B, les attaques de A contre B
// sont renforcées (×STRONG) et celles de B contre A sont atténuées (×WEAK).
// Une affinité résiste aussi à elle-même. Tout est modifiable ici.

export const STRONG = 1.5;
export const WEAK = 0.6;
export const SAME = 0.8;

export interface AffinityInfo {
  id: AffinityId;
  name: string;
  color: string;
  motto: string;
  dominates: AffinityId[];
}

export const AFFINITIES: Record<AffinityId, AffinityInfo> = {
  chair: {
    id: 'chair',
    name: 'Chair',
    color: '#9c4a4a',
    motto: 'Le corps se souvient de ce que l’esprit oublie.',
    dominates: ['reve', 'signal'],
  },
  echo: {
    id: 'echo',
    name: 'Écho',
    color: '#7b8fa3',
    motto: 'Tout son finit par revenir.',
    dominates: ['verre', 'vide'],
  },
  cendre: {
    id: 'cendre',
    name: 'Cendre',
    color: '#b0704a',
    motto: 'Ce qui a brûlé ne peut plus brûler.',
    dominates: ['racine', 'chair'],
  },
  vide: {
    id: 'vide',
    name: 'Vide',
    color: '#4b4766',
    motto: 'Il n’y a rien ici. Rien qui respire.',
    dominates: ['racine', 'cendre'],
  },
  reve: {
    id: 'reve',
    name: 'Rêve',
    color: '#8a6fa8',
    motto: 'Fermer les yeux n’a jamais protégé personne.',
    dominates: ['vide', 'echo'],
  },
  verre: {
    id: 'verre',
    name: 'Verre',
    color: '#8fb3b0',
    motto: 'Chaque reflet garde une copie.',
    dominates: ['signal', 'cendre'],
  },
  racine: {
    id: 'racine',
    name: 'Racine',
    color: '#5d7347',
    motto: 'Sous la ville, quelque chose pousse encore.',
    dominates: ['verre', 'chair'],
  },
  signal: {
    id: 'signal',
    name: 'Signal',
    color: '#c9b458',
    motto: 'La ligne est débranchée. Quelqu’un répond quand même.',
    dominates: ['echo', 'reve'],
  },
};

export const AFFINITY_IDS = Object.keys(AFFINITIES) as AffinityId[];

/** Multiplicateur d'une attaque d'affinité `atk` contre une seule affinité `def`. */
export function singleMultiplier(atk: AffinityId, def: AffinityId): number {
  if (AFFINITIES[atk].dominates.includes(def)) return STRONG;
  if (AFFINITIES[def].dominates.includes(atk)) return WEAK;
  if (atk === def) return SAME;
  return 1;
}

/** Multiplicateur total contre une créature à une ou deux affinités. */
export function affinityMultiplier(atk: AffinityId, defs: readonly AffinityId[]): number {
  let m = 1;
  for (const d of defs) m *= singleMultiplier(atk, d);
  // On borne pour éviter des extrêmes illisibles.
  return Math.max(0.25, Math.min(2.25, Math.round(m * 100) / 100));
}

export function effectivenessLabel(mult: number): string | null {
  if (mult >= 1.5) return 'Ça déchire quelque chose en elle.';
  if (mult > 1) return 'Elle vacille.';
  if (mult <= 0.5) return 'Ça la traverse presque sans effet…';
  if (mult < 1) return 'Elle encaisse sans broncher.';
  return null;
}
