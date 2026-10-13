import type { AbilityDef } from './types';

// Capacités. Coût = énergie (EN). Une capacité de coût 0 existe toujours
// dans chaque affinité pour qu'une créature ne soit jamais sans action.

const list: AbilityDef[] = [
  // --- Chair
  { id: 'griffure', name: 'Griffure', affinity: 'chair', category: 'physique', power: 40, accuracy: 1, cost: 0, fx: 'slash', description: 'Des ongles trop longs. Attaque de base.' },
  { id: 'etreinte', name: 'Étreinte moite', affinity: 'chair', category: 'physique', power: 60, accuracy: 0.95, cost: 3, fx: 'slash', description: 'Serre jusqu’à faire saigner.', effect: { status: { id: 'saignement', chance: 0.3 } } },
  { id: 'battement', name: 'Battement sourd', affinity: 'chair', category: 'psychique', power: 75, accuracy: 0.9, cost: 5, fx: 'wave', description: 'Un cœur bat dans la tête de la cible.' },
  { id: 'chair_nouvelle', name: 'Chair nouvelle', affinity: 'chair', category: 'soutien', power: 0, accuracy: 1, cost: 4, fx: 'heal', description: 'Se recoud. Rend 40 % des PV.', effect: { healFraction: 0.4 } },
  { id: 'devorer', name: 'Dévorer', affinity: 'chair', category: 'physique', power: 85, accuracy: 0.9, cost: 6, fx: 'slash', description: 'Mord et récupère la moitié des dégâts.', effect: { drainFraction: 0.5 } },

  // --- Écho
  { id: 'murmure', name: 'Murmure', affinity: 'echo', category: 'psychique', power: 40, accuracy: 1, cost: 0, fx: 'wave', description: 'Un mot à l’oreille, prononcé de l’intérieur.' },
  { id: 'repetition', name: 'Répétition', affinity: 'echo', category: 'psychique', power: 25, accuracy: 0.95, cost: 3, fx: 'wave', description: 'Le même son, deux à trois fois.', effect: { multiHit: [2, 3] } },
  { id: 'voix_perdue', name: 'Voix perdue', affinity: 'echo', category: 'psychique', power: 70, accuracy: 0.9, cost: 5, fx: 'wave', description: 'La voix de quelqu’un qui n’existe plus.', effect: { status: { id: 'effroi', chance: 0.3 } } },
  { id: 'hurlement', name: 'Hurlement creux', affinity: 'echo', category: 'soutien', power: 0, accuracy: 0.9, cost: 3, fx: 'wave', description: 'Inspire l’Effroi.', effect: { status: { id: 'effroi', chance: 1 } } },
  { id: 'cri_sans_fin', name: 'Cri sans fin', affinity: 'echo', category: 'psychique', power: 95, accuracy: 0.85, cost: 7, fx: 'wave', description: 'Un cri qui n’a jamais cessé depuis trente ans.' },

  // --- Cendre
  { id: 'braise', name: 'Braise', affinity: 'cendre', category: 'physique', power: 40, accuracy: 1, cost: 0, fx: 'ash', description: 'Une brûlure qui sent le papier.' },
  { id: 'pluie_cendre', name: 'Pluie de cendres', affinity: 'cendre', category: 'psychique', power: 55, accuracy: 0.95, cost: 3, fx: 'ash', description: 'Couvre la cible de cendres.', effect: { status: { id: 'cendres', chance: 0.4 } } },
  { id: 'bucher', name: 'Bûcher', affinity: 'cendre', category: 'physique', power: 90, accuracy: 0.85, cost: 6, fx: 'ash', description: 'Les flammes d’une chapelle oubliée.', effect: { recoilFraction: 0.15 } },
  { id: 'veille_feu', name: 'Veillée', affinity: 'cendre', category: 'soutien', power: 0, accuracy: 1, cost: 3, fx: 'buff', description: 'Attise sa flamme intérieure.', effect: { stages: { target: 'self', changes: { atk: 1, psy: 1 } } } },

  // --- Vide
  { id: 'absence', name: 'Absence', affinity: 'vide', category: 'psychique', power: 40, accuracy: 1, cost: 0, fx: 'void', description: 'Un instant où rien n’existe.' },
  { id: 'repli_mur', name: 'Repli dans le mur', affinity: 'vide', category: 'physique', power: 60, accuracy: 0.95, cost: 3, priority: 1, fx: 'void', description: 'Frappe depuis la cloison. Agit en premier.' },
  { id: 'effacer', name: 'Effacer', affinity: 'vide', category: 'psychique', power: 70, accuracy: 0.9, cost: 5, fx: 'void', description: 'Gomme une partie de la cible.', effect: { status: { id: 'oubli', chance: 0.35 } } },
  { id: 'trou_noir', name: 'Trou de mémoire', affinity: 'vide', category: 'psychique', power: 95, accuracy: 0.85, cost: 7, fx: 'void', description: 'Un vide qui aspire tout souvenir.' },
  { id: 'evanescence', name: 'Évanescence', affinity: 'vide', category: 'soutien', power: 0, accuracy: 1, cost: 3, fx: 'buff', description: 'Devient presque absent.', effect: { stages: { target: 'self', changes: { def: 1, vit: 1 } } } },

  // --- Rêve
  { id: 'songe', name: 'Songe', affinity: 'reve', category: 'psychique', power: 40, accuracy: 1, cost: 0, fx: 'dream', description: 'Une image floue derrière les paupières.' },
  { id: 'berceuse', name: 'Berceuse', affinity: 'reve', category: 'soutien', power: 0, accuracy: 0.75, cost: 3, fx: 'dream', description: 'Plonge la cible dans la Torpeur.', effect: { status: { id: 'torpeur', chance: 1 } } },
  { id: 'cauchemar', name: 'Cauchemar', affinity: 'reve', category: 'psychique', power: 70, accuracy: 0.9, cost: 5, fx: 'dream', description: 'Le rêve que tout le monde fait à Vesper.', effect: { status: { id: 'effroi', chance: 0.25 } } },
  { id: 'veilleuse_douce', name: 'Lueur douce', affinity: 'reve', category: 'soutien', power: 0, accuracy: 1, cost: 3, fx: 'heal', description: 'Rend 30 % des PV et chasse les statuts.', effect: { healFraction: 0.3, cleanse: true } },
  { id: 'reve_eveille', name: 'Rêve éveillé', affinity: 'reve', category: 'psychique', power: 90, accuracy: 0.9, cost: 6, fx: 'dream', description: 'Fait douter la cible d’être réveillée.' },

  // --- Verre
  { id: 'eclat', name: 'Éclat', affinity: 'verre', category: 'physique', power: 40, accuracy: 1, cost: 0, fx: 'shards', description: 'Un fragment de miroir.' },
  { id: 'reflet_tranchant', name: 'Reflet tranchant', affinity: 'verre', category: 'physique', power: 65, accuracy: 0.95, cost: 4, fx: 'shards', critBonus: 0.15, description: 'Coupe là où le reflet est déjà blessé.' },
  { id: 'feler', name: 'Fêler', affinity: 'verre', category: 'soutien', power: 0, accuracy: 0.9, cost: 3, fx: 'shards', description: 'Fragilise la cible.', effect: { status: { id: 'fele', chance: 1 } } },
  { id: 'miroir_brise', name: 'Miroir brisé', affinity: 'verre', category: 'physique', power: 90, accuracy: 0.85, cost: 6, fx: 'shards', description: 'Sept ans de malheur d’un coup.', effect: { status: { id: 'saignement', chance: 0.3 } } },
  { id: 'vitrail', name: 'Vitrail', affinity: 'verre', category: 'soutien', power: 0, accuracy: 1, cost: 3, fx: 'buff', description: 'Se pare de verre coloré.', effect: { stages: { target: 'self', changes: { def: 2 } } } },

  // --- Racine
  { id: 'radicelle', name: 'Radicelle', affinity: 'racine', category: 'physique', power: 40, accuracy: 1, cost: 0, fx: 'roots', description: 'Une racine fine sous la peau.' },
  { id: 'ronces', name: 'Ronces', affinity: 'racine', category: 'physique', power: 60, accuracy: 0.95, cost: 3, fx: 'roots', description: 'Entrave et fait saigner.', effect: { status: { id: 'saignement', chance: 0.3 } } },
  { id: 'seve_noire', name: 'Sève noire', affinity: 'racine', category: 'psychique', power: 50, accuracy: 0.95, cost: 4, fx: 'roots', description: 'Boit la force de la cible.', effect: { drainFraction: 0.5 } },
  { id: 'enracinement', name: 'Enracinement', affinity: 'racine', category: 'soutien', power: 0, accuracy: 1, cost: 4, fx: 'heal', description: 'Puise dans la terre. Rend 35 % des PV.', effect: { healFraction: 0.35 } },
  { id: 'foret_close', name: 'Forêt close', affinity: 'racine', category: 'physique', power: 90, accuracy: 0.85, cost: 6, fx: 'roots', description: 'Les arbres se referment sur la cible.' },

  // --- Signal
  { id: 'gresillement', name: 'Grésillement', affinity: 'signal', category: 'psychique', power: 40, accuracy: 1, cost: 0, fx: 'static', description: 'Parasites sur la ligne.' },
  { id: 'interference', name: 'Interférence', affinity: 'signal', category: 'psychique', power: 55, accuracy: 0.95, cost: 3, fx: 'static', description: 'Vide l’énergie de la cible.', effect: { energyDrain: 2 } },
  { id: 'appel_coupe', name: 'Appel coupé', affinity: 'signal', category: 'psychique', power: 75, accuracy: 0.9, cost: 5, fx: 'static', description: 'Une sonnerie sur une ligne débranchée.', effect: { status: { id: 'effroi', chance: 0.2 } } },
  { id: 'surtension', name: 'Surtension', affinity: 'signal', category: 'physique', power: 95, accuracy: 0.85, cost: 7, fx: 'static', description: 'Tout le courant de la ville d’un coup.', effect: { recoilFraction: 0.2 } },
  { id: 'frequence', name: 'Fréquence basse', affinity: 'signal', category: 'soutien', power: 0, accuracy: 1, cost: 3, fx: 'buff', description: 'S’accorde sur une onde rapide.', effect: { stages: { target: 'self', changes: { vit: 2 } } } },
  { id: 'glas_cloche', name: 'Glas', affinity: 'signal', category: 'psychique', power: 65, accuracy: 0.95, cost: 4, fx: 'bell', description: 'Trois coups de cloche. Quelqu’un va disparaître.', effect: { status: { id: 'effroi', chance: 0.35 } } },

  // --- Capacités signatures
  { id: 'pli_absolu', name: 'Pli absolu', affinity: 'vide', category: 'physique', power: 100, accuracy: 0.9, cost: 7, fx: 'void', description: 'Replie la cible sur elle-même.' },
  { id: 'cendre_mere', name: 'Berceau de cendres', affinity: 'cendre', category: 'soutien', power: 0, accuracy: 1, cost: 5, fx: 'heal', description: 'Rend 50 % des PV et chasse les statuts.', effect: { healFraction: 0.5, cleanse: true } },
  { id: 'eau_noire', name: 'Eau noire', affinity: 'reve', category: 'psychique', power: 80, accuracy: 0.9, cost: 6, fx: 'dream', description: 'L’eau du quai monte dans les poumons.', effect: { stages: { target: 'foe', changes: { vit: -1 } } } },
  { id: 'archivage', name: 'Archivage', affinity: 'vide', category: 'psychique', power: 85, accuracy: 0.9, cost: 6, fx: 'void', description: 'Classe la cible dans un dossier sans nom.', effect: { status: { id: 'oubli', chance: 0.5 } } },
  { id: 'voix_du_disparu', name: 'Voix du disparu', affinity: 'echo', category: 'soutien', power: 0, accuracy: 0.85, cost: 4, fx: 'wave', description: 'Appelle la cible par le nom d’un mort. Baisse sa défense.', effect: { stages: { target: 'foe', changes: { def: -2 } } } },
  { id: 'fragments', name: 'Pluie de fragments', affinity: 'verre', category: 'physique', power: 20, accuracy: 0.95, cost: 4, fx: 'shards', description: 'Deux à cinq éclats.', effect: { multiHit: [2, 5] } },
  { id: 'masque', name: 'Masque', affinity: 'reve', category: 'soutien', power: 0, accuracy: 1, cost: 2, fx: 'buff', description: 'Porte le visage d’un ami. Monte l’attaque et la psyché.', effect: { stages: { target: 'self', changes: { atk: 1, psy: 1 } } } },
  { id: 'dernier_train', name: 'Dernier train', affinity: 'signal', category: 'physique', power: 85, accuracy: 0.95, cost: 6, priority: 1, fx: 'static', description: 'Passe sans s’arrêter. Agit en premier.' },
  { id: 'blanc', name: 'Blanc', affinity: 'vide', category: 'psychique', power: 110, accuracy: 0.9, cost: 8, fx: 'void', description: 'La Veille Blanche, en un instant.' },
  { id: 'lumiere_veille', name: 'Lumière de veille', affinity: 'verre', category: 'psychique', power: 70, accuracy: 1, cost: 4, fx: 'dream', description: 'Une veilleuse qui refuse de s’éteindre.' },
];

export const ABILITIES: Record<string, AbilityDef> = Object.fromEntries(list.map((a) => [a.id, a]));
export const ABILITY_LIST = list;
