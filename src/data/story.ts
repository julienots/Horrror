import type { ClueDef, EndingId, LeadDef, QuestDef } from './types';

// ------------------------------------------------------------------ Indices
// Chaque révélation majeure est préparée par des indices récupérables.
// Les indices « clés » comptent pour la fin « Mémoire ».

const clues: ClueDef[] = [
  { id: 'lettre', name: 'La lettre d’Élise', text: 'Élise vous a écrit de venir la nuit, rue des Tilleuls, n° 9. Personne au village ne connaît d’Élise.' },
  { id: 'maison_nuit', name: 'La maison de nuit', text: 'Le n° 9 de la rue des Tilleuls n’existe qu’après 22 h. Le jour, il y a un terrain vague.' },
  { id: 'oubli_villageois', name: 'Ils vous oublient', text: 'Madame Brève vous a demandé votre nom ce matin. Elle vous avait servi la soupe la veille.', key: true },
  { id: 'miroir_vide', name: 'Le miroir vide', text: 'Dans les toilettes de l’école, le miroir reflète la pièce entière. Mais pas vous.', key: true },
  { id: 'nom_theo', name: 'Un prénom : Théo', text: 'Le fils d’Agnès Morel s’appelait Théo. Elle ne s’en souvient plus. Son chien s’appelait Pilou.' },
  { id: 'photo_classe', name: 'Photo de classe, 1996', text: 'Une élève de 1996 a exactement votre visage. Elle s’appelait É. Varenne.', key: true },
  { id: 'ecriture', name: 'La même écriture', text: 'L’écriture de la lettre d’Élise est identique à celle de votre propre carnet.', key: true },
  { id: 'code_armoire', name: 'Le code de Mireille', text: 'Mireille Halden a noté le code d’une armoire : 0-9-1-7.' },
  { id: 'projet_veille', name: 'Le Projet VEILLE', text: 'L’Institut Halden voulait « archiver » les souvenirs des enfants malades de la fièvre grise sur un signal : le Voile.', key: true },
  { id: 'dossier_varenne', name: 'Dossier Varenne', text: 'Élise Varenne, 9 ans, transférée au Projet VEILLE le 11/12/1996. Sur la photo jointe : vous.', key: true },
  { id: 'nuit_blanche', name: 'La nuit de l’archivage', text: 'Kessin a archivé tout le quartier des Cendriers, pas seulement les enfants. C’est la Veille Blanche.', key: true },
  { id: 'train_enfants', name: 'Le train de 23 h 50', text: 'Trente-deux enfants ont pris le train pour les Cendriers le 11/12/1996. Arrivée non renseignée.' },
  { id: 'fredonnement', name: 'L’air fredonné', text: 'Sur la cassette n° 3, Élise fredonne l’air que vous fredonnez depuis toujours.', key: true },
  { id: 'chapelle', name: 'La chapelle des Lacets', text: 'Les mères des Cendriers ont cherché leurs enfants à la chapelle. Elle a brûlé cette nuit-là.' },
  { id: 'quai', name: 'La fillette du quai', text: 'Une fillette au ruban bleu attendait le train au quai du marais. Le marais est monté.' },
  { id: 'leviers', name: 'Les leviers de la cage', text: 'Pour la cage de la mine : gauche, droite, milieu.' },
  { id: 'lys', name: 'Les miroirs de Madame Lys', text: 'Madame Lys a couvert ses miroirs la nuit où son mari n’est pas rentré de l’Institut.' },
  { id: 'choix_kessin', name: 'Le choix de Kessin', text: 'Le Voile peut être scellé (oubli éternel, paix) ou ouvert (ils reviennent, autrement). Kessin n’a jamais choisi.', key: true },
  { id: 'veilleuse_verite', name: 'Ce que sait la Veilleuse', text: 'La Veilleuse était branchée au-dessus du lit d’Élise. Elle vous suit depuis que vous êtes sortie du Voile.', key: true },
];

export const CLUES: Record<string, ClueDef> = Object.fromEntries(clues.map((c) => [c.id, c]));
export const CLUE_LIST = clues;
export const KEY_CLUES = clues.filter((c) => c.key).map((c) => c.id);
/** Nombre d'indices clés nécessaires pour pouvoir révéler la vérité. */
export const TRUTH_THRESHOLD = 6;

// ------------------------------------------------------------------ Quêtes

const quests: QuestDef[] = [
  {
    id: 'q_main',
    name: 'La Veille Blanche',
    main: true,
    stages: [
      'Trouver la pension de Madame Brève, au village de Saint-Ormel.',
      'Trouver la rue des Tilleuls, n° 9. Personne ne semble la connaître.',
      'La maison n’existe que la nuit. Revenir rue des Tilleuls après 22 h.',
      'Entrer dans l’école Sainte-Brume, à l’ouest du village.',
      'Trouver la classe qui n’existe pas, au bout du couloir impossible.',
      'Montrer la photo de classe à quelqu’un qui se souvient : la pharmacienne ?',
      'Explorer l’hôpital Saint-Aubin, au nord de la gare.',
      'Prendre le train de 23 h 50 à la gare de Vesper (ou trouver un autre chemin).',
      'Trouver la maison Varenne dans le quartier des Cendriers.',
      'Entrer dans l’Institut Halden, au bout des Cendriers.',
      'Descendre jusqu’au Seuil Blanc.',
      'Décider de ce que devient le Voile.',
    ],
  },
  {
    id: 'q_theo',
    name: 'Le fils d’Agnès',
    stages: [
      'Agnès Morel prépare deux bols chaque matin. Elle ne sait plus pour qui.',
      'Trouver qui manque à Agnès. Un enfant de l’école, peut-être ?',
      'Un chien appelle « Maman » dans la Forêt des Lacets. Lui répondre.',
      'Retourner voir Agnès et décider quoi lui dire.',
    ],
    reward: { items: [['bouillon', 2]], light: 1 },
  },
  {
    id: 'q_chapelle',
    name: 'La chapelle des Lacets',
    stages: [
      'On dit que les sentiers de la forêt changent après minuit.',
      'Trouver la clairière brûlée dans la Forêt des Lacets, entre minuit et 1 h.',
      'Une forme berce un berceau vide parmi les cendres. L’apaiser.',
    ],
    reward: { items: [['fil_dore', 1]], light: 1 },
  },
  {
    id: 'q_quai',
    name: 'Le ruban bleu',
    stages: [
      'Une enfant trempée apparaît dans les reflets du marais.',
      'Trouver ce qu’elle a perdu. Le chef de gare garde les objets trouvés.',
      'Rendre le ruban bleu à l’enfant du quai.',
    ],
    reward: { items: [['souvenir_chaud', 1]], light: 1 },
  },
  {
    id: 'q_sonnettes',
    name: 'Les sonnettes de Saint-Aubin',
    stages: [
      'Toutes les sonnettes de l’hôpital sonnent en même temps.',
      'Quelque chose vient quand elles sonnent. Survivre, ou répondre.',
    ],
    reward: { items: [['chapelet', 1]] },
  },
  {
    id: 'q_lys',
    name: 'Les miroirs de Madame Lys',
    stages: [
      'Dans les Cendriers, une maison a tous ses miroirs découverts.',
      'Couvrir les trois miroirs de la maison Lys.',
      'Quelque chose de verre attend dans la chambre.',
    ],
    reward: { items: [['bague_verre', 1]], light: 1 },
  },
  {
    id: 'q_radio',
    name: 'Radio Vesper',
    stages: [
      'La radio capte des fragments d’une émission de 1996. Trouver trois fréquences (lieux où elle grésille fort).',
      'Rapporter la dernière phrase de l’animateur au chef de gare.',
    ],
    reward: { items: [['fil_rouge', 5]], xp: 200 },
  },
  {
    id: 'q_archives',
    name: 'Ce que la ville a oublié',
    stages: [
      'Odile, l’archiviste, tient un registre où des pages entières sont vides.',
      'Rassembler assez de preuves pour remplir les pages vides (indices clés).',
      'Remettre les preuves à Odile.',
    ],
    reward: { light: 2 },
  },
];

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(quests.map((q) => [q.id, q]));
export const QUEST_LIST = quests;

// ------------------------------------------------------------------ Pistes

export const LEADS: LeadDef[] = [
  { id: 'l_elise', text: 'Qui est vraiment Élise ? Personne ne la connaît.', appearsWhen: { clue: 'lettre' }, resolvedWhen: { clue: 'dossier_varenne' } },
  { id: 'l_reflet', text: 'Pourquoi le miroir de l’école ne vous reflétait-il pas ?', appearsWhen: { clue: 'miroir_vide' }, resolvedWhen: { flag: 'revelation' } },
  { id: 'l_ecriture', text: 'L’écriture de la lettre ressemble à la vôtre. Coïncidence ?', appearsWhen: { clue: 'ecriture' }, resolvedWhen: { flag: 'revelation' } },
  { id: 'l_train', text: 'Où sont allés les enfants du train de 23 h 50 ?', appearsWhen: { clue: 'train_enfants' }, resolvedWhen: { clue: 'nuit_blanche' } },
  { id: 'l_mineurs', text: 'Les mines passent sous les Cendriers. Un autre chemin ?', appearsWhen: { flag: 'vu_mine' }, resolvedWhen: { flag: 'cage_ouverte' } },
  { id: 'l_kessin', text: 'Qu’est devenu le directeur Aurèle Kessin ?', appearsWhen: { clue: 'nuit_blanche' }, resolvedWhen: { flag: 'kessin_vaincu' } },
  { id: 'l_voile', text: 'Sceller ou ouvrir le Voile ? Que voulait Kessin ?', appearsWhen: { clue: 'choix_kessin' }, resolvedWhen: { flag: 'fin_atteinte' } },
  { id: 'l_odile', text: 'Odile pourrait remplir ses pages vides avec assez de preuves.', appearsWhen: { quest: 'q_archives', atLeast: 0 }, resolvedWhen: { quest: 'q_archives', done: true } },
];

// ------------------------------------------------------------------ Fins

export interface EndingDef {
  id: EndingId;
  title: string;
  lines: string[];
}

export const ENDINGS: Record<EndingId, EndingDef> = {
  memoire: {
    id: 'memoire',
    title: 'Fin — La Mémoire',
    lines: [
      'Vous ouvrez le Voile, et vous ne le faites pas seul(e) : Odile lit à voix haute les pages qu’elle a remplies.',
      'Trente-deux prénoms. Puis tout un quartier. Saint-Ormel se souvient d’un coup, comme on se réveille en sursaut.',
      'Agnès pleure Théo. Les cloches de la chapelle sonnent pour quelqu’un, enfin.',
      'Les Rémanents ne disparaissent pas. Ils deviennent ce qu’ils étaient censés être : des souvenirs. Ils restent près de ceux qui les portent.',
      'Et vous ? Élise Varenne a neuf ans pour toujours sur une photo de classe. Mais quelqu’un, désormais, connaît son nom.',
      'La Veilleuse brille au-dessus d’un lit vide. Personne ne l’éteindra.',
    ],
  },
  sceau: {
    id: 'sceau',
    title: 'Fin — Le Sceau',
    lines: [
      'Vous scellez le Voile. Le Seuil se referme sans un bruit.',
      'Un à un, vos Rémanents pâlissent, vous regardent, et s’effacent. La Veilleuse est la dernière à s’éteindre.',
      'Au matin, Saint-Ormel est paisible. Personne ne se souvient de rien. Il n’y a rien dont se souvenir.',
      'Vous prenez le bus du retour. Vous ne savez plus pourquoi vous étiez venu(e).',
      'Dans votre poche, une lettre. L’écriture vous semble familière. Vous la jetez sans la lire.',
    ],
  },
  brouillard: {
    id: 'brouillard',
    title: 'Fin — Le Brouillard',
    lines: [
      'Vous laissez le Voile s’étendre. Rien ne sera plus jamais perdu, puisque tout sera archivé.',
      'La brume monte des Cendriers, passe la gare, entre dans Saint-Ormel. Les habitants sourient. Ils ne se souviennent de rien, mais rien ne leur manque.',
      'La nuit éternelle s’installe sur Vesper. Le train de 23 h 50 passe toutes les heures.',
      'Vous êtes enfin chez vous, rue des Tilleuls, n° 9. La maison existe pour toujours.',
      'Personne n’y vient jamais.',
    ],
  },
};
