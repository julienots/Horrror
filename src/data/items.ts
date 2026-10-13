import type { ItemDef } from './types';

export const MAX_STACK = 99;
/** Nombre maximal d'emplacements distincts pour les objets non uniques. */
export const BAG_SLOTS = 24;

const list: ItemDef[] = [
  // --- Soin
  { id: 'tisane', name: 'Tisane amère', category: 'soin', description: 'Rend 30 PV à un Rémanent. Ça sent le tilleul et la poussière.', usableIn: ['combat', 'exploration'], effect: { kind: 'heal', amount: 30 }, value: 20 },
  { id: 'bouillon', name: 'Bouillon de la pension', category: 'soin', description: 'Rend 80 PV. Madame Brève le prépare depuis toujours.', usableIn: ['combat', 'exploration'], effect: { kind: 'heal', amount: 80 }, value: 50 },
  { id: 'eau_benite', name: 'Eau de source claire', category: 'soin', description: 'Rend tous les PV.', usableIn: ['combat', 'exploration'], effect: { kind: 'healFull' }, value: 120 },
  { id: 'sucre_orge', name: 'Sucre d’orge', category: 'soin', description: 'Rend 5 points d’énergie.', usableIn: ['combat'], effect: { kind: 'energy', amount: 5 }, value: 30 },
  { id: 'sel', name: 'Pincée de sel', category: 'soin', description: 'Chasse tous les statuts.', usableIn: ['combat', 'exploration'], effect: { kind: 'cure' }, value: 25 },
  { id: 'souvenir_chaud', name: 'Souvenir chaud', category: 'soin', description: 'Rappelle un Rémanent dissipé avec la moitié de ses PV.', usableIn: ['combat', 'exploration'], effect: { kind: 'revive', fraction: 0.5 }, value: 150 },
  { id: 'encens', name: 'Encens gris', category: 'soin', description: 'Éloigne les Rémanents faibles pendant 120 pas.', usableIn: ['exploration'], effect: { kind: 'repel', steps: 120 }, value: 40 },

  // --- Lien
  { id: 'fil_rouge', name: 'Fil rouge', category: 'lien', description: 'Noue un pacte avec un Rémanent affaibli. Plus il vous comprend, plus le nœud tient.', usableIn: ['combat'], effect: { kind: 'bond', power: 1 }, value: 30 },
  { id: 'fil_dore', name: 'Fil doré', category: 'lien', description: 'Un fil cousu par Odile. Pacte bien plus solide.', usableIn: ['combat'], effect: { kind: 'bond', power: 1.8 }, value: 90 },
  { id: 'cierge_apaisement', name: 'Cierge d’apaisement', category: 'lien', description: 'Permet d’apaiser un Rémanent compris : il trouve le repos et vous laisse un fragment de mémoire.', usableIn: ['combat'], value: 40 },
  { id: 'fragment_memoire', name: 'Fragment de mémoire', category: 'lien', description: 'Un souvenir qui ne vous appartient pas. Donne 120 points d’expérience à un Rémanent.', usableIn: ['exploration'], effect: { kind: 'xp', amount: 120 }, value: 60 },

  // --- Équipement
  { id: 'clochette_felee', name: 'Clochette fêlée', category: 'equipement', description: 'À tenir. Augmente la vitesse.', equip: { stat: { vit: 1 }, desc: 'VIT +1 cran' }, unique: true },
  { id: 'chapelet', name: 'Chapelet de bois', category: 'equipement', description: 'À tenir. Protège de l’Effroi.', equip: { resist: 'effroi', desc: 'Immunité à l’Effroi' }, unique: true },
  { id: 'bague_verre', name: 'Bague de verre', category: 'equipement', description: 'À tenir. Augmente la défense.', equip: { stat: { def: 1 }, desc: 'DÉF +1 cran' }, unique: true },
  { id: 'mouchoir_brode', name: 'Mouchoir brodé « É. V. »', category: 'equipement', description: 'À tenir. Protège de l’Oubli et renforce la psyché.', equip: { stat: { psy: 1 }, resist: 'oubli', desc: 'PSY +1 cran, immunité à l’Oubli' }, unique: true },

  // --- Outils (progression garantie, jamais aléatoire)
  { id: 'lampe_torche', name: 'Lampe-torche', category: 'outil', description: 'Éclaire les lieux obscurs. Les piles tiennent étrangement longtemps.', unique: true },
  { id: 'radio', name: 'Radio de poche', category: 'outil', description: 'Capte des émissions qui ne devraient plus exister. Grésille près des Rémanents.', unique: true },
  { id: 'pince', name: 'Pince coupante', category: 'outil', description: 'Coupe les grillages et les chaînes rouillées.', unique: true },
  { id: 'carte_region', name: 'Carte de Vesper', category: 'outil', description: 'Une carte de la région. Certaines rues y sont dessinées au crayon, puis gommées.', unique: true },

  // --- Clés
  { id: 'cle_ecole', name: 'Clé de l’école', category: 'cle', description: 'Clé en laiton étiquetée « Sainte-Brume — portail ».', unique: true },
  { id: 'cle_hopital', name: 'Passe de l’hôpital', category: 'cle', description: 'Un passe-partout d’infirmier, encore chaud.', unique: true },
  { id: 'badge_institut', name: 'Badge de l’Institut', category: 'cle', description: 'Badge « Institut Halden — Accès B ». La photo a été grattée.', unique: true },
  { id: 'ticket_sans_date', name: 'Ticket sans date', category: 'cle', description: 'Billet de train Vesper → Cendriers. La date est vide. Le nom du passager, c’est le vôtre.', unique: true },
  { id: 'cle_mine', name: 'Clé de la cage', category: 'cle', description: 'Ouvre la cage d’ascenseur de la mine.', unique: true },

  // --- Quête
  { id: 'lettre_elise', name: 'Lettre d’Élise', category: 'quete', unique: true, description: 'La lettre qui vous a fait venir à Vesper.', document: '« Viens vite. Ils oublient. Bientôt ils m’auront oubliée moi aussi. Rue des Tilleuls, n° 9. Viens la nuit, le jour la maison n’est pas là. — Élise »', clue: 'lettre' },
  { id: 'photo_brulee', name: 'Photo brûlée', category: 'quete', unique: true, description: 'Une mère et son enfant devant la chapelle. Le visage de l’enfant est consumé.', document: 'Au dos : « Pour maman, de la part de — » La suite a brûlé.' },
  { id: 'ruban_bleu', name: 'Ruban bleu', category: 'quete', unique: true, description: 'Un ruban bleu, trempé, qui ne sèche jamais.' },
  { id: 'dessin_theo', name: 'Dessin de Théo', category: 'quete', unique: true, description: 'Un dessin d’enfant : trois portes numérotées 3, 1 et 4, et un chien.', document: 'En bas, au feutre : « Pour passer : 3 puis 1 puis 4. Le chien s’appelle Pilou. Moi c’est THÉO. »', clue: 'nom_theo' },
  { id: 'journal_perso', name: 'Votre carnet', category: 'quete', unique: true, description: 'Votre carnet personnel. Votre écriture est penchée, avec des « É » très ronds.', document: 'Votre propre écriture. Les « É » sont ronds, les « t » barrés très haut. Exactement comme dans la lettre d’Élise… et comme sur la feuille du 9, rue des Tilleuls.', clue: 'ecriture', clueWhen: { clue: 'maison_nuit' } },

  // --- Documents / cassettes
  { id: 'cassette_1', name: 'Cassette n° 1', category: 'document', unique: true, description: 'Étiquette : « V. — séance 1 ».', document: '« …les sujets sont stables. Les enfants des Cendriers ne souffrent plus. Leurs souvenirs sont transférés sur le Voile. Si tout fonctionne, ils pourront être restaurés quand la fièvre grise sera vaincue. » — Dr M. Halden', clue: 'projet_veille' },
  { id: 'cassette_2', name: 'Cassette n° 2', category: 'document', unique: true, description: 'Étiquette : « V. — la nuit ».', document: '« Kessin a lancé l’archivage complet. Pas seulement les enfants. Tout le quartier. Les maisons s’effacent une par une. Les gens dehors… ils ne se souviennent déjà plus qu’il y avait des maisons. » (bruit de cloches)', clue: 'nuit_blanche' },
  { id: 'cassette_3', name: 'Cassette n° 3', category: 'document', unique: true, description: 'Pas d’étiquette. Une voix d’enfant fredonne.', document: 'Une fillette fredonne un air. Vous le connaissez par cœur. Vous l’avez fredonné dans le bus en venant. À la fin, elle dit : « Je m’appelle Élise Varenne et je ne veux pas dormir. »', clue: 'fredonnement' },
  { id: 'cassette_4', name: 'Cassette n° 4', category: 'document', unique: true, description: 'Étiquette : « Aurèle — dernier message ».', document: '« Si quelqu’un entend ceci : le Voile peut être scellé ou ouvert. Scellé, tout le monde oubliera pour toujours, et ils seront en paix. Ouvert… ils reviendront. Pas comme avant. Je n’ai pas eu le courage de choisir. »', clue: 'choix_kessin' },
  { id: 'dossier_varenne', name: 'Dossier « Varenne, É. »', category: 'document', unique: true, description: 'Fiche d’admission de l’hôpital Saint-Aubin.', document: 'VARENNE Élise, 9 ans. Fièvre grise, stade 3. Transférée Projet VEILLE le 11/12/1996. Signe particulier : refuse d’éteindre sa veilleuse. Photo jointe : c’est votre visage, enfant.', clue: 'dossier_varenne' },
  { id: 'photo_classe', name: 'Photo de classe 1996', category: 'document', unique: true, description: 'École Sainte-Brume, CM1, 1996.', document: 'Vingt-quatre enfants. Au deuxième rang, une fillette avec votre visage exact. Sous elle : « É. Varenne ». Tous les enfants du deuxième rang ont un visage flou.', clue: 'photo_classe' },
  { id: 'ordonnance', name: 'Ordonnance de Mireille', category: 'document', unique: true, description: 'Une ordonnance griffonnée.', document: 'Patient : « Moi-même ». Traitement : « Ne pas oublier la combinaison de l’armoire : 0-9-1-7. Ne pas oublier pourquoi. »', clue: 'code_armoire' },
  { id: 'note_mineur', name: 'Note du contremaître', category: 'document', unique: true, description: 'Une note tachée de suie.', document: '« Pour la cage : levier GAUCHE, puis DROITE, puis MILIEU. Si vous entendez chanter dans la galerie 3, ne répondez pas. »', clue: 'leviers' },
  { id: 'registre_gare', name: 'Registre de la gare', category: 'document', unique: true, description: 'Registre des départs, décembre 1996.', document: '11/12/1996 — 23 h 50 — Vesper → Cendriers — 32 passagers (enfants), accompagnés par Dr Halden. Arrivée : non renseignée. Ligne fermée le lendemain « faute de quartier à desservir ».', clue: 'train_enfants' },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));
export const ITEM_LIST = list;

export function isUnique(id: string): boolean {
  const def = ITEMS[id];
  if (!def) return false;
  return !!def.unique || ['cle', 'outil', 'quete', 'document'].includes(def.category);
}

export function maxStackOf(id: string): number {
  if (isUnique(id)) return 1;
  return ITEMS[id]?.maxStack ?? MAX_STACK;
}
