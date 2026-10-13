import type { Condition, ScriptCmd, ZoneDef } from '../types';
import { MIDNIGHT, NIGHT, door, edges, look, pickup, rest, sign, trigger } from './helpers';

const notResolved = (id: string): Condition => ({ all: [{ not: { owned: id } }, { not: { pacified: id } }] });

// ---------------------------------------------------------------- Forêt des Lacets

export const foret: ZoneDef = {
  id: 'foret',
  name: 'Forêt des Lacets',
  region: 'Vesper',
  theme: 'foret',
  ambience: 'foret',
  music: 'foret',
  fog: 0.5,
  dark: 0.15,
  mapPos: [3, 1],
  map: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TT,,,,TTTTTT,,,,,,,,TTTTTT,,,,TT',
    'TT,"",TTTTTT,""""",,TTTTTT,"",TT',
    'TT,"",TTTTTT,,,..,,,TTTTTT,"",TT',
    'TT,,,,TTTTTTTTT..TTTTTTTTT,,,,TT',
    'TT,"",TTTTTTTTT..TTTTTTTTT,"",TT',
    'TT,,,,TTTTTTTTT..TTTTTTTTT,,,,TT',
    'TT,"",TTTT,,,,,..,,,,,TTTT,"",TT',
    'TT,,,,TTTT,""",..,""",TTTT,,,,TT',
    'TT............................TT',
    'TT............................TT',
    'TT,,,,TTTT,""",..,""",TTTT,,,,TT',
    'TT,"",TTTT,,,,,..,,,,,TTTT,"",TT',
    'TT,,,,TTTTTTTTT..TTTTTTTTT,,,,TT',
    'TT,"",TTTTTTTTT..TTTTTTTTT,"",TT',
    'TT,,,,WWW,,TTTT..TTTT,,""",TTTTT',
    'TT,,,,WWW,aTTTT..TTTT,,""",,,,TT',
    'TT,,,,,,,,,TTTT..TTTT,,,,,,TTTTT',
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
  ],
  variants: [
    {
      // Après minuit, les sentiers tournent : un passage s'ouvre au nord.
      when: MIDNIGHT,
      patches: [
        { x: 15, y: 0, rows: ['..', '..'] },
        { x: 8, y: 5, rows: ['::'] },
        { x: 22, y: 7, rows: ['::'] },
      ],
    },
  ],
  warps: [
    ...edges([15, 16], [23], 'village', [15, 16], [1], 'down'),
    { x: 15, y: 0, to: 'clairiere', tx: 7, ty: 10, dir: 'up', sound: 'pas', when: MIDNIGHT },
    { x: 16, y: 0, to: 'clairiere', tx: 8, ty: 10, dir: 'up', sound: 'pas', when: MIDNIGHT },
  ],
  encounters: [
    { creature: 'ronceline', weight: 5, levels: [5, 8] },
    { creature: 'mitaine', weight: 3, levels: [5, 7] },
    { creature: 'palefeu', weight: 4, levels: [6, 8], when: NIGHT },
    { creature: 'gresille', weight: 2, levels: [6, 8] },
    { creature: 'faux_ami', weight: 1, levels: [10, 12], when: MIDNIGHT },
  ],
  encounterRate: 0.1,
  entities: [
    sign('panneau_foret', 14, 21, 'FORÊT DES LACETS — Ne quittez pas les sentiers après minuit. Ne répondez pas si on vous appelle.'),
    look('arbres_nord', 15, 1, [
      { if: MIDNIGHT, then: [{ say: 'Le sentier continue vers le nord. Il n’était pas là tout à l’heure.' }], else: [{ say: 'Les arbres semblent s’être rapprochés pour fermer le sentier. Les troncs sont tièdes. Revenez quand l’horloge aura passé minuit.' }] },
    ]),
    pickup('photo_brulee', 10, 17, 'photo_brulee', 1, [
      { say: 'Une souche calcinée. Coincée dans l’écorce : une photo brûlée. Une mère et son enfant devant une petite chapelle. Le visage de l’enfant est consumé.' },
      { quest: 'q_chapelle', stage: 1 },
    ]),
    pickup('foret_tisane', 2, 2, 'tisane', 2),
    pickup('foret_fil', 29, 2, 'fil_rouge', 2),
    pickup('foret_encens', 2, 17, 'encens', 1),
    trigger('radio_foret', 28, 4, [{ horror: 'radio' }, { say: 'La radio grésille fort : « …ici Radio Vesper, il est 23 h 41, et vous écoutez… » La voix se coupe net.' }, { counter: 'radio_freq', add: 1 }, { if: { counter: 'radio_freq', atLeast: 3 }, then: [{ quest: 'q_radio', stage: 1 }] }], true, { item: 'radio' }),
    {
      id: 'ronces_foret',
      x: 26,
      y: 17,
      kind: 'panneau',
      solid: true,
      sprite: 'ronces',
      when: { notFlag: 'ronces_brulees' },
      script: [
        {
          if: { fieldSkill: 'bruler' },
          then: [{ sound: 'feu' }, { say: 'Votre Rémanent de Cendre souffle sur les ronces noires. Elles se tordent, crient presque, et tombent en cendres.' }, { setFlag: 'ronces_brulees' }],
          else: [{ say: 'Des ronces noires, dures comme du fil de fer. Derrière, quelque chose brille. Une flamme en viendrait à bout.' }],
        },
      ],
    },
    pickup('cache_clochette', 29, 17, 'clochette_felee', 1, [{ say: 'Une clochette fêlée attachée à un ruban. Elle ne sonne que quand personne ne la touche.' }]),
    {
      id: 'chien_creux_rencontre',
      x: 24,
      y: 17,
      kind: 'apparition',
      sprite: 'chien_creux',
      solid: true,
      behavior: 'traque',
      when: { all: [{ quest: 'q_theo', atLeast: 1 }, notResolved('chien_creux')] },
      script: [
        { horror: 'chuchotement' },
        { say: '« Maman ? Maman, t’es là ? » La voix d’un petit garçon. Elle sort de la gueule d’un chien. Sa cage thoracique est vide ; on voit les arbres à travers.' },
        { battle: 'chien_creux', level: 12, onBond: [{ quest: 'q_theo', stage: 2 }, { say: 'Le chien baisse la tête. « Théo », répète-t-il avec la voix d’un enfant. Il faudrait le dire à Agnès.' }] },
      ],
    },
  ],
};

// ---------------------------------------------------------------- Clairière brûlée

export const clairiere: ZoneDef = {
  id: 'clairiere',
  name: 'Chapelle des Lacets',
  region: 'Vesper',
  theme: 'foret',
  ambience: 'cendres',
  music: 'silence',
  fog: 0.6,
  dark: 0.35,
  map: [
    'TTTTTTTTTTTTTTTT',
    'TTTTaaaaaaaaTTTT',
    'TTTaa::::aaaaTTT',
    'TTa:#aaaa#:aTTTT',
    'TTa:aaaaaa:aTTTT',
    'TTa:#aaaa#:aTTTT',
    'TTaa:aaaa:aaTTTT',
    'TTTa::aa::aTTTTT',
    'TTTTaaa..aaaTTTT',
    'TTTTTTT..TTTTTTT',
    'TTTTTTT..TTTTTTT',
    'TTTTTTT..TTTTTTT',
  ],
  warps: [...edges([7, 8], [11], 'foret', [15, 16], [2], 'down')],
  encounters: [
    { creature: 'palefeu', weight: 5, levels: [9, 12] },
    { creature: 'ronceline', weight: 3, levels: [9, 11] },
  ],
  encounterRate: 0.08,
  onEnter: [
    { quest: 'q_chapelle', stage: 2 },
    { clue: 'chapelle' },
    { horror: 'cloches' },
    { say: 'Une clairière couverte de cendres. Les restes d’une chapelle. Des cendres tombent du ciel, alors qu’il n’y a pas de feu.' },
  ],
  enterOnceFlag: 'clairiere_vue',
  entities: [
    {
      id: 'mere_cendre',
      x: 6,
      y: 3,
      kind: 'apparition',
      sprite: 'mere_cendre',
      solid: true,
      behavior: 'immobile',
      when: notResolved('mere_cendre'),
      script: [
        { say: 'Une forme agenouillée berce un berceau vide. Racines, châles, cendres. Elle chantonne sans bouche.' },
        {
          if: { item: 'photo_brulee' },
          then: [
            {
              choice: 'Elle tend une main de racines vers vous.',
              options: [
                {
                  text: 'Lui montrer la photo brûlée',
                  then: [
                    { take: 'photo_brulee' },
                    { say: 'Elle prend la photo. Le berceau cesse de bouger. Elle approche la photo de là où devrait être son visage.' },
                    { say: '« C’est toi, ma petite ? Tu es revenue de l’école ? »', who: '', mood: 'triste' },
                    { say: 'Elle vous prend pour quelqu’un d’autre. Ou peut-être pas.' },
                    ...motherResolution(),
                  ],
                },
                { text: 'Reculer', then: [{ say: 'Elle se remet à bercer le vide.' }] },
              ],
            },
          ],
          else: [
            { horror: 'secousse' },
            { say: 'Elle se dresse. Les cendres tourbillonnent. Elle ne vous laissera pas approcher du berceau.' },
            { battle: 'mere_cendre', level: 16, boss: true, onBond: [{ questDone: 'q_chapelle' }, { give: 'mouchoir_brode' }] },
          ],
        },
      ],
    },
    look('berceau', 7, 4, 'Un berceau de fer noirci. Au fond, une petite couverture brodée de deux lettres : É. V.'),
    look('cloche', 4, 3, 'Un morceau de la cloche de la chapelle, fondu. Quand le vent passe dessus, on entend un prénom.'),
    pickup('clairiere_fragment', 10, 6, 'fragment_memoire', 1),
  ],
};

function motherResolution(): ScriptCmd[] {
  return [
    {
      choice: 'Que faire ?',
      options: [
        {
          text: 'La laisser reposer (apaiser)',
          then: [{ pacify: 'mere_cendre' }, { say: 'Elle serre la photo contre elle et s’effondre doucement en cendres tièdes. Le berceau reste vide, mais plus personne ne le berce.' }, { give: 'mouchoir_brode' }, { say: 'Dans les cendres, un mouchoir brodé « É. V. ». Il est à vous. Vous le savez.' }, { questDone: 'q_chapelle' }],
        },
        {
          text: 'Lui proposer de venir avec vous (pacte)',
          then: [{ bondDirect: 'mere_cendre', level: 16 }, { say: 'Elle se lève. Elle vous suivra, comme on suit un enfant qui rentre trop tard.' }, { give: 'mouchoir_brode' }, { questDone: 'q_chapelle' }],
        },
      ],
    },
  ];
}

// ---------------------------------------------------------------- Marais des Noyés

export const marais: ZoneDef = {
  id: 'marais',
  name: 'Marais des Noyés',
  region: 'Vesper',
  theme: 'marais',
  ambience: 'marais',
  music: 'marais',
  fog: 0.7,
  dark: 0.2,
  mapPos: [3, 5],
  map: [
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
    'T,,,,,,"",,,,,,..,,,,,,"",,,,,,T',
    'T,WWWW,"",,,,,,..,,,,,,,,,oooooT',
    'T,WWWWW"",,,,,,..,,,,,,,,ooDoooT',
    'T,WWWWWw",,,,,,.............,,,T',
    'T,WWWWWWw,,,,,,..,,,,,,""",,,,,T',
    'T,WWWWWWww,,,,,..,,,,,,""",,,,,T',
    'T,WWWWWWWw"",,,..,,,,,,,,,,,,,,T',
    'T,WWWWWWWww",,,..,,,,WWWW,,,,,,T',
    'T,WWWWWWWWw"",,..,,,WWWWWW,,,,,T',
    'T,WWWWWWWWww",,..,,WWWWWWW,,,,,T',
    'T,WWWWWWWWWw",,..,,WWWWWWW"",,,T',
    'T,WWWWWWWWWww,,..,,,WWWWW,"",,,T',
    'T,WWWWWWWWWWww,..,,,,WWWW,,,,,,T',
    'T,WWWWWWWW--------------WW,,,,,T',
    'T,WWWWWWWW--------------WW,,"""T',
    'T,WWWWWWWWrrrrrrrrrrrrrrWW,,,,,T',
    'T,WWWWWWWWWWWWWWWWWWWWWWWWWWWWWT',
    'TWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT',
    'TWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT',
    'TWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    ...edges([15, 16], [0], 'village', [15, 16], [22], 'up'),
    door(27, 3, 'mine', 2, 15, 'up', {
      when: { any: [{ item: 'lampe_torche' }, { fieldSkill: 'eclairer' }] },
      locked: 'Une galerie de mine, noire comme un puits. Impossible d’avancer sans lumière. Le chef de gare doit bien avoir une lampe.',
    }),
  ],
  encounters: [
    { creature: 'coquemort', weight: 6, levels: [8, 11] },
    { creature: 'gresille', weight: 3, levels: [8, 10] },
    { creature: 'ronceline', weight: 2, levels: [9, 11] },
    { creature: 'mitaine', weight: 2, levels: [8, 10] },
  ],
  encounterRate: 0.1,
  entities: [
    sign('panneau_quai', 17, 13, 'HALTE DU MARAIS — Ligne Vesper–Cendriers. Service suspendu. Les horaires ont été arrachés, sauf un : 23 h 50.'),
    trigger('mine_vue', 27, 4, [{ setFlag: 'vu_mine' }, { say: 'Une entrée de mine à moitié murée. Une plaque : « Houillères de Basse-Vesper ». Un courant d’air tiède monte de l’obscurité.' }]),
    {
      id: 'enfant_quai',
      x: 12,
      y: 13,
      kind: 'apparition',
      sprite: 'enfant_quai',
      solid: true,
      behavior: 'reflet',
      when: notResolved('enfant_quai'),
      script: [
        {
          if: { item: 'ruban_bleu' },
          then: [
            { say: 'Le reflet d’une fillette trempée vous regarde depuis l’eau. Cette fois, elle ne disparaît pas quand vous levez les yeux.' },
            {
              choice: 'Elle porte la main à ses cheveux.',
              options: [
                {
                  text: 'Lui rendre le ruban bleu',
                  then: [
                    { take: 'ruban_bleu' },
                    { say: 'Elle noue le ruban dans ses cheveux mouillés. L’eau du marais redescend d’un centimètre.' },
                    { say: '« Le train n’est pas venu. Tu crois qu’il viendra ? Tu m’emmènes ? »', who: '', mood: 'triste' },
                    {
                      choice: 'Que faire ?',
                      options: [
                        { text: 'L’emmener avec vous (pacte)', then: [{ bondDirect: 'enfant_quai', level: 15 }, { say: 'Elle prend votre main. Elle est froide, mais elle serre fort.' }, { questDone: 'q_quai' }] },
                        { text: 'Lui dire que le train est passé (apaiser)', then: [{ pacify: 'enfant_quai' }, { say: '« Ah. Alors je peux rentrer. » Elle s’assoit sur le quai, ferme les yeux, et il n’y a plus qu’une flaque.' }, { questDone: 'q_quai' }] },
                      ],
                    },
                  ],
                },
                { text: 'Attendre', then: [{ say: 'Elle attend aussi. Elle a l’habitude.' }] },
              ],
            },
          ],
          else: [
            { horror: 'chuchotement' },
            { say: 'Dans l’eau, le reflet d’une fillette trempée se tient à côté du vôtre. Vous levez les yeux : personne sur le quai.' },
            { say: 'Elle porte la main à ses cheveux, là où quelque chose manque. Puis elle désigne la gare, au loin.' },
            { quest: 'q_quai', stage: 1 },
            { clue: 'quai' },
          ],
        },
      ],
    },
    trigger('radio_marais', 24, 6, [{ horror: 'radio' }, { say: 'La radio crachote : « …les parents des Cendriers sont priés de se présenter à la chapelle des Lacets… » Puis un long sifflement.' }, { counter: 'radio_freq', add: 1 }, { if: { counter: 'radio_freq', atLeast: 3 }, then: [{ quest: 'q_radio', stage: 1 }] }], true, { item: 'radio' }),
    pickup('marais_encens', 29, 15, 'encens', 2),
    pickup('marais_eau', 30, 11, 'eau_benite', 1),
    pickup('marais_souvenir', 2, 1, 'souvenir_chaud', 1),
    look('coquilles', 25, 12, 'Des dizaines de coquilles d’œufs, grandes comme des têtes. Toutes vides. Toutes fêlées de l’intérieur.'),
  ],
};

// ---------------------------------------------------------------- Mines de Basse-Vesper

function lever(id: string, x: number, label: string, step: number, last: boolean): ReturnType<typeof look> {
  const success: ScriptCmd[] = last
    ? [{ counter: 'leviers', set: 0 }, { sound: 'mecanisme' }, { say: `Levier ${label}. Un grondement. La cage d’ascenseur se déverrouille avec un claquement de mâchoire.` }, { setFlag: 'cage_ouverte' }]
    : [{ counter: 'leviers', add: 1 }, { sound: 'mecanisme' }, { say: `Levier ${label}. Quelque chose s’enclenche, loin dans la roche.` }];
  return {
    id,
    x,
    y: 1,
    kind: 'declencheur',
    solid: true,
    script: [
      {
        if: { flag: 'cage_ouverte' },
        then: [{ say: 'Le levier ne bouge plus. La cage est ouverte.' }],
        else: [{ if: { counter: 'leviers', eq: step }, then: success, else: [{ counter: 'leviers', set: 0 }, { sound: 'mecanisme' }, { horror: 'coups' }, { say: `Levier ${label}. Les trois leviers remontent d’un coup. Quelqu’un frappe trois coups dans la paroi.` }] }],
      },
    ],
  };
}

export const mine: ZoneDef = {
  id: 'mine',
  name: 'Mines de Basse-Vesper',
  region: 'Vesper',
  theme: 'mine',
  ambience: 'mine',
  music: 'mine',
  indoor: true,
  dark: 0.95,
  map: [
    '##############################',
    '#nnnnnnnnnnnnnnnnnnnn#_z_z_z_#',
    '#nnnnnnnnnnnnnnnnnnnn________D',
    '#nn################nn#_______#',
    '#nn#nnnnnnnnnnnnn#nnn#########',
    '#nn#nn########nnn#nnnnnnnnnn##',
    '#nn#nn#nnnnnn#nnn#nnnnnnnnnn##',
    '#nn#nn#nn##nn#nnn#nn######nn##',
    '#nn#nn#nn##nn#nnn#nn#nnnn#nn##',
    '#nnnnn#nn##nnnnnn#nn#nnnn#nn##',
    '#nnnnn#nn##nnnnnn#nn#nnnnnnn##',
    '######nn##########nn##########',
    '#nnnnnnnnnnnnnnnnnnnn#########',
    '#nn###################nnnnnnn#',
    '#nn#nnnnnnnnnnnnnnnnnnnnnnnnn#',
    '#nnnn#####oooooo#####nnnnnnnn#',
    '##D###########################',
  ],
  warps: [
    door(2, 16, 'marais', 27, 4, 'down'),
    door(29, 2, 'cendriers', 1, 11, 'right', { when: { flag: 'cage_ouverte' }, locked: 'La cage d’ascenseur est verrouillée. Trois leviers, au-dessus, attendent un ordre précis.', sound: 'escalier' }),
  ],
  encounters: [
    { creature: 'lampiste', weight: 5, levels: [13, 16] },
    { creature: 'coquemort', weight: 3, levels: [13, 15] },
    { creature: 'ronceline', weight: 2, levels: [14, 16] },
    { creature: 'palefeu', weight: 2, levels: [14, 16] },
  ],
  encounterRate: 0.09,
  onEnter: [{ setFlag: 'vu_mine' }, { say: 'L’air sent le charbon froid et la cire. Très loin, quelqu’un chante.' }],
  enterOnceFlag: 'mine_entree',
  entities: [
    lever('levier_gauche', 23, 'gauche', 0, false),
    lever('levier_droite', 27, 'droit', 1, false),
    lever('levier_milieu', 25, 'du milieu', 2, true),
    {
      id: 'contremaitre',
      x: 8,
      y: 8,
      kind: 'npc',
      sprite: 'mineur',
      solid: true,
      script: [
        { say: 'Un mineur couvert de suie. Il ne cligne pas des yeux.', who: '' },
        { say: 'La cage ? Elle descend aux Cendriers. Personne ne la prend plus. Le code est sur ma note, au fond de la galerie de droite.', who: 'mineur' },
        { say: 'Je suis remonté seul, cette nuit-là. Les autres chantent encore, en bas. Ne leur répondez pas.', who: 'mineur', mood: 'vide' },
      ],
    },
    pickup('note_mineur', 22, 9, 'note_mineur', 1, [{ clue: 'leviers' }]),
    rest('lampe_mine', 1, 13, 'Une lampe de mineur, toujours allumée, accrochée pour ceux qui ne sont pas remontés.'),
    pickup('mine_souvenir', 1, 5, 'souvenir_chaud', 1),
    pickup('mine_fil', 20, 12, 'fil_rouge', 3),
    pickup('mine_eau', 27, 14, 'eau_benite', 1),
    look('chant', 12, 15, [{ horror: 'chuchotement' }, { say: 'Derrière l’éboulement, des voix d’hommes chantent une chanson de mine. L’un d’eux s’arrête et demande : « C’est toi, petite ? »' }]),
  ],
};
