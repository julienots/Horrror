import type { ScriptCmd, ZoneDef } from '../types';
import { NIGHT, door, edges, look, pickup, rest, sign, trigger } from './helpers';

// ---------------------------------------------------------------- Cour de l'école

export const ecole_cour: ZoneDef = {
  id: 'ecole_cour',
  name: 'École Sainte-Brume — la cour',
  region: 'Vesper',
  theme: 'ecole',
  ambience: 'vent',
  music: 'ecole',
  fog: 0.35,
  mapPos: [1, 3],
  map: [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'TT,RRRRRRRRRRRRRRRRRR,TT',
    'TT,RRRRRRRRRRRRRRRRRR,TT',
    'TT,#######D##########,TT',
    'T,,,,,,,,,..,,,,,,,,,,,T',
    'T,""",,,,,..,,,,,,""",,T',
    'T,""",,,,,..,,,,,,""",,T',
    'T,,,,,,,,,..,,,,,,,,,,,T',
    'T,,,,o,,,,..,,,,,,,,,,,T',
    'T,,,,,,,,,..,,,,T,,,,,,T',
    'T,"",,,,,,..............',
    'T,"",,,,,,..............',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'T,"""",,,,,,,,,"""",,,,T',
    'T,,,,,,,,,,,,,,,,,,,,,,T',
    'TTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    door(10, 3, 'ecole', 13, 12, 'up', { when: { item: 'cle_ecole' }, locked: 'Le portail de l’école est fermé à clé. Une étiquette émaillée : « Sainte-Brume ».' }),
    ...edges([23], [10, 11], 'village', [1], [11, 12], 'right'),
  ],
  encounters: [
    { creature: 'gribouille', weight: 6, levels: [5, 7] },
    { creature: 'mitaine', weight: 3, levels: [4, 6] },
    { creature: 'gresille', weight: 2, levels: [5, 6], when: NIGHT },
  ],
  encounterRate: 0.1,
  entities: [
    sign('panneau_ecole', 12, 4, 'ÉCOLE SAINTE-BRUME. Fermée depuis 1997 « faute d’élèves ». Quelqu’un a ajouté au feutre : « ILS SONT ENCORE DEDANS ».'),
    look('balancoire', 5, 8, 'Un vieux puits condamné. On entend, très loin dessous, une comptine chantée à plusieurs voix.'),
    pickup('cour_encens', 21, 13, 'encens', 1),
    pickup('cour_tisane', 2, 10, 'tisane', 1),
    trigger('cour_arrivee', 11, 7, [{ horror: 'silhouette' }, { say: 'Derrière une fenêtre du premier étage, une silhouette d’enfant vous fait signe. Il n’y a pas de premier étage.' }]),
  ],
};

// ---------------------------------------------------------------- Intérieur

export const ecole: ZoneDef = {
  id: 'ecole',
  name: 'École Sainte-Brume',
  region: 'Vesper',
  theme: 'ecole',
  ambience: 'ecole',
  music: 'ecole',
  indoor: true,
  dark: 0.45,
  encounterAll: true,
  encounterRate: 0.035,
  map: [
    '############################',
    '#l==k==l#l==k==l#m_m_m__#==#',
    '#=c=c=c=#=c=c=c=#_______#==#',
    '#=======#=c=c=c=#_______#l=#',
    '#=cc=cc=#=======#_______#==#',
    '####D#######D#######D#######',
    '#__________________________D',
    '#__________________________#',
    '####D####__________#####D###',
    '#=======#__________#=======#',
    '#=b=b=l=#__P____P__#=k=k=l=#',
    '#=======#__________#=======#',
    '#=b===l=#__________#==c====#',
    '#############D##############',
  ],
  warps: [
    door(13, 13, 'ecole_cour', 10, 4, 'down'),
    door(27, 6, 'ecole_couloir', 1, 3, 'right'),
  ],
  encounters: [
    { creature: 'gribouille', weight: 6, levels: [6, 9] },
    { creature: 'murmure_mur', weight: 4, levels: [6, 8] },
    { creature: 'faux_ami', weight: 1, levels: [8, 10], when: NIGHT },
  ],
  entities: [
    trigger('ecole_entree', 13, 11, [
      { horror: 'pas' },
      { say: 'Le hall sent la craie et la cire. Quelque part, une voix d’homme compte à voix basse : « …vingt-deux, vingt-trois… »' },
      { quest: 'q_main', stage: 4 },
    ]),
    look('tableau_classe1', 4, 1, 'Au tableau, à la craie : « Appel — 23 présents, 1 absent. » Le nom de l’absent a été effacé si fort que le tableau est rayé.'),
    pickup('dessin_theo', 11, 3, 'dessin_theo', 1, [
      { say: 'Un dessin d’enfant glissé sous un pupitre : trois portes numérotées 3, 1, 4, et un chien gris.' },
      { clue: 'nom_theo' },
      { quest: 'q_theo', stage: 1 },
    ]),
    look('miroir_toilettes', 19, 1, [
      { horror: 'flash' },
      { say: 'Le miroir des toilettes reflète les lavabos, la porte, le carrelage fendu, la lumière qui grésille.' },
      { say: 'Il ne reflète pas vous.' },
      { clue: 'miroir_vide' },
    ]),
    look('miroir_toilettes2', 21, 1, 'Un autre miroir. Dans celui-ci, il y a un enfant derrière vous. Vous vous retournez. Personne. Vous regardez à nouveau : personne non plus dans le miroir, maintenant.'),
    rest('lit_infirmerie', 2, 10, 'Un lit d’infirmerie. Une petite veilleuse murale s’allume quand vous approchez.'),
    pickup('ecole_tisane', 6, 11, 'tisane', 2),
    pickup('ecole_fil', 24, 11, 'fil_rouge', 3),
    look('registre_appel', 21, 10, 'Registre d’appel, CM1, 1996. Vingt-quatre élèves. Le 11 décembre, vingt-trois croix « absent ». Une seule « présente » : la ligne n’a pas de nom.'),
    pickup('placard_encens', 26, 2, 'encens', 2),
    pickup('placard_souvenir', 25, 1, 'souvenir_chaud', 1),
    {
      id: 'fissure_placard',
      x: 26,
      y: 5,
      kind: 'declencheur',
      solid: true,
      script: [
        {
          if: { flag: 'dans_placard' },
          then: [{ say: 'Vous vous glissez de nouveau par la fissure.' }, { setFlag: 'dans_placard', value: false }, { warp: 'ecole', x: 26, y: 6, dir: 'down' }],
          else: [
            {
              if: { fieldSkill: 'glisser' },
              then: [{ say: 'Le Pli se déplie le long de la fissure et vous attire de l’autre côté. Ça fait mal comme un souvenir.' }, { setFlag: 'dans_placard' }, { warp: 'ecole', x: 26, y: 4, dir: 'up' }],
              else: [{ say: 'Une fissure fine dans le mur du placard. Quelque chose de très plat pourrait s’y glisser.' }],
            },
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------- Le couloir impossible
// Les portes 1 à 4 ramènent au début du couloir, sauf la séquence 3 → 1 → 4.

function couloirDoor(n: number, x: number): ReturnType<typeof trigger> {
  const expected: Record<number, number> = { 3: 0, 1: 1, 4: 2 };
  const reset: ScriptCmd[] = [
    { counter: 'couloir', set: 0 },
    { horror: 'pas' },
    { say: `Porte n° ${n}. Elle s’ouvre sur… le début du même couloir. Il vous semble un peu plus long qu’avant.` },
    { warp: 'ecole_couloir', x: 1, y: 3, dir: 'right' },
  ];
  let ok: ScriptCmd[];
  if (n === 4) {
    ok = [{ counter: 'couloir', set: 0 }, { sound: 'porte' }, { say: 'Porte n° 4. Cette fois, il y a une classe derrière.' }, { warp: 'classe_absente', x: 5, y: 7, dir: 'up' }];
  } else {
    ok = [
      { counter: 'couloir', add: 1 },
      { sound: 'porte' },
      { say: `Porte n° ${n}. Le même couloir… mais les numéros des portes ont changé de place. Non. C’est vous qui avez changé de place.` },
      { warp: 'ecole_couloir', x: 1, y: 3, dir: 'right' },
    ];
  }
  const step = expected[n];
  return {
    id: `porte_couloir_${n}`,
    x,
    y: 1,
    kind: 'declencheur',
    touch: true,
    solid: false,
    script: step === undefined ? reset : [{ if: { counter: 'couloir', eq: step }, then: ok, else: reset }],
  };
}

export const ecole_couloir: ZoneDef = {
  id: 'ecole_couloir',
  name: 'Couloir B',
  region: 'Vesper',
  theme: 'ecole',
  ambience: 'ecole',
  music: 'silence',
  indoor: true,
  dark: 0.6,
  map: [
    '######################',
    '###D####D####D####D###',
    '#____________________#',
    'D____________________#',
    '#____________________#',
    '#__P____P____P____P__#',
    '######################',
  ],
  warps: [door(0, 3, 'ecole', 26, 6, 'left')],
  onEnter: [{ say: 'Couloir B. Quatre portes, numérotées 1, 2, 3, 4. Le couloir est plus long que le bâtiment.' }],
  enterOnceFlag: 'couloir_vu',
  entities: [
    couloirDoor(1, 3),
    couloirDoor(2, 8),
    couloirDoor(3, 13),
    couloirDoor(4, 18),
    look('affiche_couloir', 3, 5, 'Une affiche d’élève punaisée au pilier : « Mon chemin pour aller en classe : TROIS, UN, QUATRE. Sinon on tourne en rond. »'),
    look('pilier2', 8, 5, 'Gravé dans le plâtre : « 24 ». Puis « 23 ». Puis « 22 », très profond.'),
  ],
};

// ---------------------------------------------------------------- La classe qui n'existe pas

export const classe_absente: ZoneDef = {
  id: 'classe_absente',
  name: 'La classe absente',
  region: 'Vesper',
  theme: 'ecole',
  ambience: 'silence',
  music: 'silence',
  indoor: true,
  dark: 0.5,
  map: [
    '############',
    '#l==kkk==l=#',
    '#==========#',
    '#=c=c=c=c==#',
    '#==========#',
    '#=c=c=c=c==#',
    '#==========#',
    '#==========#',
    '#####D######',
  ],
  warps: [door(5, 8, 'ecole', 26, 6, 'down')],
  onEnter: [{ quest: 'q_main', stage: 4 }, { say: 'Une salle de classe intacte. Vingt-quatre chaises. Sur chacune, un cartable. La poussière ne touche rien.' }],
  enterOnceFlag: 'classe_vue',
  entities: [
    pickup('photo_classe', 5, 1, 'photo_classe', 1, [
      { say: 'Une photo de classe, encadrée sur le bureau du maître. Sainte-Brume, CM1, 1996.' },
      { say: 'Deuxième rang. Une fillette vous regarde avec votre visage. Exactement le vôtre. Dessous, à la plume : « É. Varenne ».' },
      { clue: 'photo_classe' },
      { quest: 'q_main', stage: 5 },
      { horror: 'pas' },
      { say: 'Derrière vous, la voix compte : « …vingt-trois. Vingt-quatre. » Elle s’arrête. « Le compte est bon. »' },
      { battle: 'pli', level: 8, then: [{ setFlag: 'pli_rencontre' }] },
    ]),
    look('tableau_absente', 1, 1, 'Au tableau : une liste de vingt-quatre prénoms. Vingt-trois sont barrés. Le dernier est illisible, comme vu à travers de l’eau.'),
    look('cartable', 8, 3, 'Un cartable ouvert. Dedans, une trousse, un goûter emballé dans du papier journal du 11 décembre 1996, et une veilleuse débranchée.'),
    pickup('classe_fragment', 10, 6, 'fragment_memoire', 1),
  ],
};
