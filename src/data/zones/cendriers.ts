import type { Condition, ScriptCmd, ZoneDef } from '../types';
import { door, look, npc, pickup, rest, sign, trigger } from './helpers';
import { HOUSE_MAP } from './village';

const notResolved = (id: string): Condition => ({ all: [{ not: { owned: id } }, { not: { pacified: id } }] });

// ---------------------------------------------------------------- Quartier des Cendriers

const lockedHouse = (id: string, x: number, y: number, text: string) =>
  ({ id, x, y, kind: 'panneau' as const, solid: true, script: [{ say: text }] });

export const cendriers: ZoneDef = {
  id: 'cendriers',
  name: 'Les Cendriers',
  region: 'Vesper',
  theme: 'cendriers',
  ambience: 'cendriers',
  music: 'cendriers',
  eternalNight: true,
  fog: 0.55,
  dark: 0.5,
  mapPos: [6, 5],
  map: [
    '###########TTTT..TTTT###########',
    '#,,,,,,,,,,,,,,..,,,,,,,,,,,,,,#',
    '#,RRRRRR,,RRRR,..,RRRR,,RRRRRR,#',
    '#,RRRRRR,,RRRR,..,RRRR,,RRRRRR,#',
    '#,##D###,,#D##,..,##D#,,###D##,#',
    '#,,,.,,,,,,.,,,..,,,.,,,,,,.,,,#',
    '#,,,........................,,,#',
    '#,,,,,,p,,,,,,,..,,,,,,,p,,,,,,#',
    '#,,"""",,,,,,,,..,,,,,,,,"""",,#',
    '#,,"""",,,,,,,,..,,,,,,,,"""",,#',
    '#,,,,,,,,,,,,,,..,,,,,,,,,,,,,,#',
    'D................,,,,,,,,,,,,,,#',
    '#,,,,,,,,,,,,,,..,,,,,,,,,,,,,,#',
    '#,RRRRRR,,,,,,,..,,,,,,,RRRRRR,#',
    '#,RRRRRR,,,,,,,..,,,,,,,RRRRRR,#',
    '#,###D##,,,,,,,..,,,,,,,##D###,#',
    '#,,,,,,,,,,,,,,..,,,,,,,,,,,,,,#',
    '#,,,""",,,,,,,,..,,,,,,,,""",,,#',
    '#,,,,,,,,,,,,,,..,,,,,,,,,,,,,,#',
    '#,,,,,--------------------,,,,,#',
    '#,,,,,--------------------,,,,,#',
    '#rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#',
    '#rrrrrrrrrrrrrrrrrrrrrrrrrrrrrr#',
    '################################',
  ],
  warps: [
    door(0, 11, 'mine', 28, 2, 'left', { sound: 'escalier' }),
    { x: 15, y: 0, to: 'institut', tx: 13, ty: 12, dir: 'up', sound: 'porte', when: { item: 'badge_institut' }, locked: 'Un portail grillagé. Un lecteur de badge clignote : « INSTITUT HALDEN — ACCÈS B ».' },
    { x: 16, y: 0, to: 'institut', tx: 14, ty: 12, dir: 'up', sound: 'porte', when: { item: 'badge_institut' }, locked: 'Un portail grillagé. Un lecteur de badge clignote : « INSTITUT HALDEN — ACCÈS B ».' },
    door(4, 4, 'maison_lys', 3, 8, 'up'),
    door(27, 4, 'maison_varenne', 3, 8, 'up'),
  ],
  encounters: [
    { creature: 'faux_ami', weight: 4, levels: [18, 21] },
    { creature: 'main_froide', weight: 4, levels: [18, 21] },
    { creature: 'antenne_pale', weight: 3, levels: [18, 20] },
    { creature: 'grand_cierge', weight: 2, levels: [18, 20] },
    { creature: 'dessin_fini', weight: 1, levels: [19, 21] },
  ],
  encounterRate: 0.1,
  onEnter: [
    { quest: 'q_main', stage: 8 },
    { say: 'Les Cendriers. Un quartier entier, intact, figé dans une nuit qui ne finit pas. Les réverbères brûlent. Les fenêtres sont éclairées. Il n’y a personne.' },
    { say: 'Il neige des cendres. Elles ne touchent jamais le sol.' },
  ],
  enterOnceFlag: 'cendriers_vu',
  entities: [
    lockedHouse('maison_2', 11, 4, 'La porte est ouverte sur un mur de briques. Derrière les briques, une télévision allumée.'),
    lockedHouse('maison_3', 20, 4, 'Sur la porte, une affiche : « Fête des Lumières, 11 décembre, minuit. Apportez vos veilleuses ! »'),
    lockedHouse('maison_4', 5, 15, 'Vous frappez. De l’autre côté, quelqu’un frappe aussi. Exactement en même temps.'),
    lockedHouse('maison_5', 26, 15, 'La poignée est chaude, comme si quelqu’un la tenait de l’autre côté depuis trente ans.'),
    sign('panneau_rue', 18, 5, 'Rue des Tilleuls. Numéros 1 à 9.'),
    rest('reverbere', 24, 7, 'Le seul réverbère dont la lumière est chaude. Une veilleuse d’enfant est scotchée sur le poteau.'),
    {
      id: 'train_retour',
      x: 15,
      y: 21,
      kind: 'apparition',
      sprite: 'train',
      solid: true,
      script: [
        { say: 'Le train de 23 h 50 attend à quai, portes ouvertes. Il attend toujours, ici.' },
        {
          choice: 'Rentrer à la gare de Vesper ?',
          options: [
            { text: 'Monter', then: [{ sound: 'train' }, { say: 'Le voyage dure une seconde. Ou trente ans.' }, { warp: 'gare', x: 15, y: 13, dir: 'up' }] },
            { text: 'Rester', then: [] },
          ],
        },
      ],
    },
    npc(
      'elise_rue',
      16,
      9,
      'elise',
      [
        { say: 'Une fillette en chemise de nuit. Elle tient une veilleuse débranchée contre son cœur.', who: '' },
        { say: '« Tu es rentrée ! Maman disait que tu reviendrais. La maison est au bout de la rue. Le numéro 9. »', who: 'elise', mood: 'sourire' },
        { say: '« Moi ? Je suis personne. Je suis ce que tu as oublié. »', who: 'elise', mood: 'vide' },
        { horror: 'flash' },
        { setFlag: 'elise_vue' },
      ],
      { when: { all: [{ notFlag: 'revelation' }, { notFlag: 'elise_vue' }] } },
    ),
    npc('nora_cendriers', 29, 17, 'nora', [
      { say: 'Tu vois ? Je te l’avais dit. Moi non plus, j’ai pas d’ombre.', who: 'nora', mood: 'sourire' },
      { say: 'J’habitais là, avant. Mais je préfère Saint-Ormel. Là-bas, au moins, les gens oublient doucement.', who: 'nora', mood: 'vide' },
    ]),
    pickup('cendriers_bouillon', 1, 1, 'bouillon', 2),
    pickup('cendriers_fil', 30, 12, 'fil_dore', 1),
    pickup('cendriers_souvenir', 2, 18, 'souvenir_chaud', 1),
  ],
};

// ---------------------------------------------------------------- Maison Lys

function lysMirror(n: number, x: number, y: number) {
  return {
    id: `miroir_lys_${n}`,
    x,
    y,
    kind: 'declencheur' as const,
    solid: true,
    script: [
      {
        if: { flag: `lys_m${n}` },
        then: [{ say: 'Le miroir est couvert d’un drap noir. On entend respirer derrière.' }],
        else: [
          { say: 'Un grand miroir au cadre noir. Votre reflet a un temps de retard. Il sourit une seconde après vous.' },
          {
            choice: 'Couvrir le miroir avec un drap ?',
            options: [
              {
                text: 'Le couvrir',
                then: [
                  { setFlag: `lys_m${n}` },
                  { counter: 'lys', add: 1 },
                  { sound: 'tissu' },
                  { quest: 'q_lys', stage: 1 },
                  { say: 'Vous couvrez le miroir. La maison soupire.' },
                  { if: { counter: 'lys', atLeast: 3 }, then: [{ quest: 'q_lys', stage: 2 }, { horror: 'chuchotement' }, { say: 'Dans la chambre, quelque chose de verre se met à chanter, très doucement.' }] },
                ],
              },
              { text: 'Le laisser', then: [] },
            ],
          },
        ],
      },
    ] as ScriptCmd[],
  };
}

export const maison_lys: ZoneDef = {
  id: 'maison_lys',
  name: 'Maison Lys',
  region: 'Vesper',
  theme: 'interieur',
  ambience: 'maison_nuit',
  music: 'silence',
  indoor: true,
  dark: 0.6,
  eternalNight: true,
  map: [
    '##############',
    '#m====l#=b==m#',
    '#======#=====#',
    '#=kc===+=====#',
    '#======#=====#',
    '#m=====#######',
    '#======#######',
    '#==l===#######',
    '#======#######',
    '###D##########',
  ],
  warps: [door(3, 9, 'cendriers', 4, 5, 'down')],
  onEnter: [{ quest: 'q_lys', stage: 0 }, { clue: 'lys' }, { say: 'Tous les miroirs de la maison sont découverts. Les draps noirs sont pliés au pied de chacun, comme si quelqu’un venait de les retirer.' }],
  enterOnceFlag: 'lys_entree',
  entities: [
    lysMirror(1, 1, 1),
    lysMirror(2, 1, 5),
    lysMirror(3, 12, 1),
    npc('madame_lys', 5, 7, 'lys', [
      { say: 'Mon mari n’est pas rentré de l’Institut. J’ai couvert les miroirs, comme on fait pour les morts.', who: 'lys', mood: 'triste' },
      { say: 'Quelqu’un les découvre toutes les nuits. Je crois que c’est moi.', who: 'lys', mood: 'vide' },
    ], { when: { notFlag: 'veuve_resolue' } }),
    {
      id: 'veuve_verre',
      x: 10,
      y: 2,
      kind: 'apparition',
      sprite: 'veuve_verre',
      solid: true,
      when: { all: [{ counter: 'lys', atLeast: 3 }, { notFlag: 'veuve_resolue' }, notResolved('veuve_verre')] },
      script: [
        { horror: 'flash' },
        { say: 'Une femme de verre teinté en robe de deuil. Son voile est un miroir fendu. Dedans, votre reflet pleure.' },
        { battle: 'veuve_verre', level: 22, then: [{ setFlag: 'veuve_resolue' }, { questDone: 'q_lys' }] },
      ],
    },
    look('photo_lys', 2, 3, 'Une photo de mariage. Le marié porte un badge : « Inst. Halden — Dr P. Lys, assistant du directeur ».'),
    pickup('lys_bague_eau', 3, 7, 'eau_benite', 1),
  ],
};

// ---------------------------------------------------------------- Maison Varenne (la vraie)

export const maison_varenne: ZoneDef = {
  id: 'maison_varenne',
  name: 'Maison Varenne',
  region: 'Vesper',
  theme: 'interieur',
  ambience: 'maison_nuit',
  music: 'silence',
  indoor: true,
  dark: 0.5,
  eternalNight: true,
  map: HOUSE_MAP,
  warps: [door(3, 9, 'cendriers', 27, 5, 'down')],
  onEnter: [
    { say: 'C’est la même maison. Exactement la même que celle de la rue des Tilleuls, à Saint-Ormel. Le même papier peint, les mêmes oiseaux.' },
    { say: 'Mais ici, tout est couvert de cendres fines. Et la porte de la chambre est ouverte.' },
  ],
  enterOnceFlag: 'varenne_entree',
  entities: [
    look('miroir_varenne', 4, 1, [
      {
        if: { flag: 'revelation' },
        then: [{ say: 'Le miroir vous montre une fillette en chemise de nuit. Elle vous sourit. Vous lui souriez.' }],
        else: [
          { say: 'Ici, le miroir n’est pas couvert.' },
          { horror: 'souffle' },
          { say: 'Il reflète la pièce. Les oiseaux. La porte. Et une fillette de neuf ans en chemise de nuit, une petite lumière posée sur l’épaule.' },
          { say: 'Elle lève la main droite. Vous levez la main droite.' },
          { say: 'Élise Varenne n’est jamais revenue de l’Institut. Ce qui est revenu trente ans plus tard, ce qui a pris le bus pour Saint-Ormel avec une lettre écrite de sa propre main…' },
          { say: 'C’est vous.' },
          { if: { owned: 'veilleuse' }, then: [{ say: 'La Veilleuse se pose sur votre épaule. Elle vous a attendue. Elle n’a jamais cessé de briller, pour que vous trouviez la sortie du Voile.' }, { clue: 'veilleuse_verite' }] },
          { setFlag: 'revelation' },
          { morality: 'light', amount: 1 },
          { quest: 'q_main', stage: 9 },
          { say: 'L’Institut Halden est au nord du quartier. C’est là que tout a été archivé. C’est là que tout peut être rendu.' },
        ],
      },
    ]),
    pickup('cassette_3', 12, 2, 'cassette_3', 1, [{ clue: 'fredonnement' }]),
    look('bureau_varenne', 10, 6, [
      { say: 'Le même petit bureau. La feuille est vierge. Il y a un stylo, et vous savez exactement ce qu’il faut écrire : « Viens vite. Ils oublient. »' },
      { say: 'Vous avez écrit cette lettre. Vous ne vous en souvenez pas, mais votre main, si.' },
      { clue: 'ecriture' },
    ]),
    look('lit_varenne', 9, 1, 'Le lit d’enfant. Au-dessus, la prise murale. Une auréole jaunie, exactement de la taille de votre Veilleuse.'),
    rest('cuisine_varenne', 2, 6, 'La table de la cuisine. Sur la prise près de l’évier, une veilleuse est branchée et brille. La maison vous laisse vous reposer.'),
    pickup('varenne_eau', 1, 7, 'eau_benite', 1),
  ],
};

// ---------------------------------------------------------------- Institut Halden

export const institut: ZoneDef = {
  id: 'institut',
  name: 'Institut Halden',
  region: 'Vesper',
  theme: 'institut',
  ambience: 'institut',
  music: 'institut',
  indoor: true,
  dark: 0.45,
  eternalNight: true,
  encounterAll: true,
  encounterRate: 0.04,
  map: [
    '##############################',
    '#zzz_zzz#lllll#k__k#zzzzzzzzz#',
    '#_______#_____#____#____S____#',
    '#_______#_k___#____#_________#',
    '####D######D####D#######D#####',
    '#____________________________#',
    '#____________________________#',
    '####D####__________#####D#####',
    '#_______#__________#_________#',
    '#_b_b_b_#__C___C___#_L_L_L_L_#',
    '#_______#__________#_________#',
    '#_b_b_b_#__________#_L_L_L_L_#',
    '#_______#__________#_________#',
    '#############DD###############',
  ],
  warps: [
    { x: 13, y: 13, to: 'cendriers', tx: 15, ty: 1, dir: 'down', sound: 'porte' },
    { x: 14, y: 13, to: 'cendriers', tx: 16, ty: 1, dir: 'down', sound: 'porte' },
    { x: 24, y: 2, to: 'seuil', tx: 11, ty: 21, dir: 'up', sound: 'escalier' },
  ],
  encounters: [
    { creature: 'antenne_pale', weight: 5, levels: [22, 25] },
    { creature: 'main_froide', weight: 3, levels: [22, 24] },
    { creature: 'murmure_mur', weight: 3, levels: [22, 24] },
    { creature: 'grand_pli', weight: 1, levels: [23, 25] },
  ],
  onEnter: [
    { quest: 'q_main', stage: 10 },
    { setFlag: 'archivore_mange' },
    { horror: 'chuchotement' },
    { say: 'Votre carnet tremble dans votre poche. Quand vous l’ouvrez, des lignes entières s’effacent sous vos yeux. Quelque chose ici mange les souvenirs.' },
  ],
  enterOnceFlag: 'institut_entre',
  entities: [
    {
      id: 'archivore',
      x: 24,
      y: 4,
      kind: 'apparition',
      sprite: 'archivore',
      solid: true,
      behavior: 'immobile',
      when: { notFlag: 'archivore_vaincu' },
      script: [
        { horror: 'radio' },
        { say: 'Un classeur métallique haut comme une porte bloque le passage. Ses tiroirs s’ouvrent et se ferment comme des bouches. Des fiches, des photos, des bandes magnétiques en dégueulent.' },
        { say: 'Sur une fiche qui flotte, votre nom. Votre vrai nom.' },
        {
          battle: 'archivore',
          level: 26,
          boss: true,
          noFlee: true,
          then: [{ setFlag: 'archivore_vaincu' }, { setFlag: 'archivore_mange', value: false }, { say: 'Les pages de votre carnet se remplissent à nouveau. L’encre revient, plus noire qu’avant.' }],
        },
      ],
    },
    pickup('cassette_4', 15, 1, 'cassette_4', 1, [{ clue: 'choix_kessin' }]),
    look('fiches', 10, 3, 'Des fiches cartonnées, une par enfant. Trente-deux. Toutes vierges, sauf une : « VARENNE É. — restauration partielle en cours — sortie du Voile non autorisée. »'),
    look('dortoir', 2, 9, 'Trente-deux lits d’enfant alignés. Au-dessus de chacun, une prise pour une veilleuse. Une seule prise est vide.'),
    look('machine', 2, 1, 'Une console couverte de cadrans. Une étiquette : « VOILE — archivage mémoriel — NE PAS INTERROMPRE ». L’interrupteur est en position « marche » depuis trente ans.'),
    rest('poste_garde', 11, 9, 'Le poste de garde. Une veilleuse de secours fonctionne encore. Elle a été branchée récemment.'),
    pickup('institut_souvenir', 21, 10, 'souvenir_chaud', 2),
    pickup('institut_eau', 27, 12, 'eau_benite', 2),
    pickup('institut_fil', 21, 8, 'fil_dore', 2),
    pickup('institut_bouillon', 6, 12, 'bouillon', 2),
  ],
};

// ---------------------------------------------------------------- Le Seuil Blanc

const finalChoice: ScriptCmd[] = [
  { say: 'Le Voile frémit autour de vous comme un drap qu’on va retirer. Derrière, trente-deux enfants. Un quartier entier. Et vous.' },
  {
    choice: 'Que faites-vous du Voile ?',
    options: [
      {
        text: 'L’ouvrir',
        then: [
          {
            if: { flag: 'verite_revelee' },
            then: [{ setFlag: 'fin_atteinte' }, { ending: 'memoire' }],
            else: [
              { say: 'En bas, personne ne se souvient d’eux. Ils reviendront dans une ville qui ne les attend pas. Odile, peut-être, pourrait encore écrire leurs noms…' },
              {
                choice: 'Ouvrir quand même ?',
                options: [
                  { text: 'Ouvrir quand même', then: [{ setFlag: 'fin_atteinte' }, { ending: 'brouillard' }] },
                  { text: 'Pas encore', then: [{ say: 'Le Voile attendra. Il a l’habitude.' }] },
                ],
              },
            ],
          },
        ],
      },
      { text: 'Le sceller pour toujours', then: [{ setFlag: 'fin_atteinte' }, { ending: 'sceau' }] },
      { text: 'Rester dans le Voile', then: [{ setFlag: 'fin_atteinte' }, { ending: 'brouillard' }] },
      { text: 'Pas encore', then: [{ say: 'Vous pouvez revenir quand vous serez prête. Le Seuil ne se ferme pas tout seul.' }] },
    ],
  },
];

export const seuil: ZoneDef = {
  id: 'seuil',
  name: 'Le Seuil Blanc',
  region: 'Voile',
  theme: 'seuil',
  ambience: 'seuil',
  music: 'seuil',
  indoor: true,
  eternalNight: true,
  fog: 0.3,
  map: [
    'vvvvvvvvvvvvvvvvvvvvvvvv',
    'vvvvvvvvvuuuuuuvvvvvvvvv',
    'vvvvvvvvuuuuuuuuvvvvvvvv',
    'vvvvvvvvuuuuuuuuvvvvvvvv',
    'vvvvvvvvvvuuuuvvvvvvvvvv',
    'vvvvvvvvvvv__vvvvvvvvvvv',
    'vvvvvvvvvvv__vvvvvvvvvvv',
    'vvvvv======__vvvvvvvvvvv',
    'vvvvv=vvvvvvvvvvvvvvvvvv',
    'vvvvv=vvvvvvvvvvvvvvvvvv',
    'vvvvv=uuuu,,,,,,,vvvvvvv',
    'vvvvvvvvvvvvvvvv,vvvvvvv',
    'vvvvvvvvvvvvvvvv,vvvvvvv',
    'vvvvvvvvvvvv....,vvvvvvv',
    'vvvvvvvvvvvv.vvvvvvvvvvv',
    'vvvvvvvvvvvv.vvvvvvvvvvv',
    'vvvvvuuuuuuu.vvvvvvvvvvv',
    'vvvvvuvvvvvvvvvvvvvvvvvv',
    'vvvvvuvvvvvvvvvvvvvvvvvv',
    'vvvvvu______vvvvvvvvvvvv',
    'vvvvvvvvvvv_vvvvvvvvvvvv',
    'vvvvvvvvvvv_vvvvvvvvvvvv',
    'vvvvvvvvvvvSvvvvvvvvvvvv',
    'vvvvvvvvvvvvvvvvvvvvvvvv',
  ],
  warps: [{ x: 11, y: 22, to: 'institut', tx: 24, ty: 3, dir: 'down', sound: 'escalier' }],
  encounters: [
    { creature: 'antenne_pale', weight: 3, levels: [25, 28] },
    { creature: 'grand_cierge', weight: 3, levels: [25, 28] },
    { creature: 'dessin_fini', weight: 3, levels: [25, 28] },
    { creature: 'faux_ami', weight: 2, levels: [25, 28] },
    { creature: 'grand_pli', weight: 1, levels: [26, 28] },
  ],
  encounterRate: 0.08,
  onEnter: [{ quest: 'q_main', stage: 11 }, { say: 'Le Seuil Blanc. Le sol se souvient d’être d’autres sols : le plancher de la pension, le carrelage de l’école, l’herbe de la forêt.' }],
  enterOnceFlag: 'seuil_entre',
  entities: [
    trigger('fragment_pension', 7, 7, [{ say: 'Un morceau de la pension flotte dans le blanc. Madame Brève essuie une tasse. Elle lève les yeux : « Bonsoir, Élise. »' }]),
    trigger('fragment_ecole', 12, 13, [{ say: 'Une voix compte : « …vingt-trois, vingt-quatre. Le compte est bon. Tout le monde peut rentrer. »' }]),
    trigger('fragment_foret', 14, 10, [{ horror: 'cloches' }, { say: 'Le vent porte une odeur de cendres et de lait chaud. Quelqu’un appelle « Théo ! » et cette fois, quelqu’un répond.' }]),
    {
      id: 'archiviste_blanc',
      x: 11,
      y: 2,
      kind: 'apparition',
      sprite: 'gardien_blanc',
      solid: true,
      when: { notFlag: 'fin_atteinte' },
      script: [
        {
          if: { flag: 'kessin_vaincu' },
          then: finalChoice,
          else: [
            { horror: 'flash' },
            { say: '« Sujet Varenne, Élise. Sortie du Voile non autorisée. »', who: 'kessin', mood: 'vide' },
            { say: '« J’ai sauvé trente-deux enfants de la fièvre grise. J’ai sauvé tout un quartier du chagrin. Rien n’est perdu, ici. Tout est classé. »', who: 'kessin' },
            { say: '« Vous voulez les rendre au monde ? Le monde les a oubliés en une nuit. Il les oubliera encore. »', who: 'kessin', mood: 'colere' },
            { battle: 'gardien_blanc', level: 30, boss: true, noFlee: true, then: [{ setFlag: 'kessin_vaincu' }, { say: 'L’écran blanc qui lui sert de visage grésille, puis montre un homme fatigué. « Choisissez. Moi, je n’ai jamais pu. »', who: 'kessin', mood: 'triste' }, ...finalChoice] },
          ],
        },
      ],
    },
  ],
};
