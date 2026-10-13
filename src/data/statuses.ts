import type { PassiveDef, PassiveId, StatusId } from './types';

export interface StatusDef {
  id: StatusId;
  name: string;
  short: string;
  color: string;
  duration: [number, number]; // tours min/max
  description: string;
}

export const STATUSES: Record<StatusId, StatusDef> = {
  effroi: {
    id: 'effroi',
    name: 'Effroi',
    short: 'EFF',
    color: '#c9c9e0',
    duration: [2, 3],
    description: '30 % de chance de rester paralysé de peur.',
  },
  saignement: {
    id: 'saignement',
    name: 'Saignement',
    short: 'SAI',
    color: '#a33a3a',
    duration: [3, 4],
    description: 'Perd 1/12 de ses PV max à chaque tour.',
  },
  cendres: {
    id: 'cendres',
    name: 'Cendres',
    short: 'CEN',
    color: '#b0704a',
    duration: [3, 4],
    description: 'Perd 1/16 de ses PV max par tour, attaque réduite.',
  },
  oubli: {
    id: 'oubli',
    name: 'Oubli',
    short: 'OUB',
    color: '#6f6a8f',
    duration: [2, 3],
    description: 'Une capacité est scellée par l’oubli.',
  },
  fele: {
    id: 'fele',
    name: 'Fêlé',
    short: 'FÊL',
    color: '#8fb3b0',
    duration: [2, 3],
    description: 'Subit 25 % de dégâts supplémentaires.',
  },
  torpeur: {
    id: 'torpeur',
    name: 'Torpeur',
    short: 'TOR',
    color: '#5a6f8a',
    duration: [1, 3],
    description: 'Ne peut pas agir. Un coup la réveille.',
  },
};

export const PASSIVES: Record<PassiveId, PassiveDef> = {
  repli: { id: 'repli', name: 'Repli', description: '15 % de chance d’esquiver une attaque physique en se pliant.' },
  couvee: { id: 'couvee', name: 'Couvée', description: 'Récupère 1/16 de ses PV à chaque fin de tour.' },
  glas: { id: 'glas', name: 'Glas', description: 'À son entrée, peut inspirer l’Effroi à l’adversaire.' },
  noyade: { id: 'noyade', name: 'Noyade lente', description: 'Ses attaques Rêve réduisent la vitesse de la cible.' },
  devoreur: { id: 'devoreur', name: 'Dévoreur de souvenirs', description: 'Ses coups ont 20 % de chance d’infliger l’Oubli.' },
  mimetisme: { id: 'mimetisme', name: 'Mimétisme vocal', description: 'Résiste à l’Effroi. Ses attaques Écho sont plus précises.' },
  eclats: { id: 'eclats', name: 'Éclats', description: 'Renvoie 25 % des dégâts physiques subis en fragments.' },
  imitation: { id: 'imitation', name: 'Imitation', description: 'Prend l’affinité principale de l’adversaire à son entrée.' },
  griffonnage: { id: 'griffonnage', name: 'Griffonnage', description: 'Ses statuts infligés durent un tour de plus.' },
  chaleur: { id: 'chaleur', name: 'Chaleur fragile', description: 'Se soigne un peu quand elle reste en retrait.' },
  meche: { id: 'meche', name: 'Mèche courte', description: 'Ses attaques Cendre font 10 % de dégâts en plus quand ses PV sont bas.' },
  epines: { id: 'epines', name: 'Épines', description: 'Blesse légèrement qui la frappe au corps à corps.' },
  parasite: { id: 'parasite', name: 'Parasite', description: 'Draine 1 énergie à l’adversaire à chaque coup.' },
  resonance: { id: 'resonance', name: 'Résonance', description: 'Les capacités de soutien coûtent 1 énergie de moins.' },
  phare: { id: 'phare', name: 'Phare', description: 'Immunisée contre la Torpeur. Éclaire les lieux sombres.' },
  coquille: { id: 'coquille', name: 'Coquille', description: 'Réduit de 20 % le premier coup reçu à chaque combat.' },
  controle: { id: 'controle', name: 'Contrôle des billets', description: 'Ses attaques agissent en premier quand ses PV sont pleins.' },
  veille: { id: 'veille', name: 'Veille', description: 'Protège son lien : résiste à l’Effroi et à l’Oubli.' },
  effacement: { id: 'effacement', name: 'Effacement', description: 'Les soins de l’adversaire sont réduits de moitié.' },
  seuil: { id: 'seuil', name: 'Seuil', description: 'Change d’affinité à chaque tour. Ne peut être lié.' },
};
