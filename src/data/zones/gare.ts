import type { Condition, ScriptCmd, ZoneDef } from '../types';
import { MIDNIGHT, NIGHT, door, edges, look, npc, pickup, rest, sign, trigger } from './helpers';

const notResolved = (id: string): Condition => ({ all: [{ not: { owned: id } }, { not: { pacified: id } }] });

// ---------------------------------------------------------------- Gare de Vesper

export const gare: ZoneDef = {
  id: 'gare',
  name: 'Gare de Vesper',
  region: 'Vesper',
  theme: 'gare',
  ambience: 'gare',
  music: 'gare',
  fog: 0.35,
  mapPos: [5, 3],
  map: [
    'TTTTTTTTTTTTTTTTTTTTTT..TTTTTT',
    'T,,,,,,,,,,,,,,,,,,,,,..,,,,,T',
    'T,,RRRRRRRRRR,,,,,,,,,..,,,,,T',
    'T,,RRRRRRRRRR,,p,,,,,,..,,"",T',
    'T,,####D#####,,,,,,,,,..,,"",T',
    'T,,,,,,.,,,,,,,,,,,,,,..,,,,,T',
    'T,,,,,,.................,,,,,T',
    'T,,,,,,.,,,,,""",,,,,,,,,,,,,T',
    'T,,,,,,.,,,,,""",,,,,,,,,,,,,T',
    '........,,,,,,,,,,,,,,,,,,,,,T',
    '........,,,,,,,,,,,,,,,,,,,,,T',
    'T,,,,,,.,,,,,,,,,,,,,,,,,,,,,T',
    'T----------------------------T',
    'T----------------------------T',
    'TrrrrrrrrrrrrrrrrrrrrrrrrrrrrT',
    'TrrrrrrrrrrrrrrrrrrrrrrrrrrrrT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    ...edges([0], [9, 10], 'village', [30], [11, 12], 'left'),
    ...edges([22, 23], [0], 'hopital_ext', [9, 10], [12], 'up'),
    door(7, 4, 'gare_hall', 6, 7, 'up'),
  ],
  encounters: [
    { creature: 'gresille', weight: 6, levels: [9, 12] },
    { creature: 'murmure_mur', weight: 3, levels: [9, 11] },
    { creature: 'coquemort', weight: 2, levels: [10, 12] },
  ],
  encounterRate: 0.09,
  entities: [
    sign('panneau_gare', 9, 11, 'GARE DE VESPER — Ligne Vesper–Cendriers. Le nom « Cendriers » a été recouvert de peinture. Il transparaît quand il pleut.'),
    sign('horloge_gare', 15, 3, [{ say: 'L’horloge de la gare. Ses aiguilles sont bloquées sur 23 h 50. Pourtant, elle fait tic-tac.' }]),
    {
      id: 'train_minuit',
      x: 15,
      y: 14,
      kind: 'apparition',
      sprite: 'train',
      solid: true,
      when: MIDNIGHT,
      script: [
        { sound: 'train' },
        { say: 'Un train de voyageurs attend, portes ouvertes. Pas de conducteur dans la cabine. Les vitres sont embuées de l’intérieur, comme si quelqu’un respirait contre chacune.' },
        {
          if: { item: 'ticket_sans_date' },
          then: [
            {
              choice: 'Monter dans le train de 23 h 50 ?',
              options: [
                { text: 'Monter', then: [{ quest: 'q_main', stage: 7 }, { warp: 'train', x: 1, y: 2, dir: 'right' }] },
                { text: 'Rester sur le quai', then: [{ say: 'Les portes restent ouvertes. Elles attendront.' }] },
              ],
            },
          ],
          else: [{ say: 'Une voix, dans le haut-parleur : « Les voyageurs sans titre de transport ne sont pas admis. » Vous n’avez pas de billet pour ce train.' }],
        },
      ],
    },
    trigger('quai_minuit', 15, 13, [{ horror: 'souffle' }, { say: 'Un sifflement dans le brouillard. Des phares, sans bruit de moteur. Le train de 23 h 50 entre en gare avec trente ans de retard.' }], true, MIDNIGHT),
    pickup('gare_sucre', 28, 1, 'sucre_orge', 2),
    pickup('gare_tisane', 1, 5, 'tisane', 2),
  ],
};

export const gare_hall: ZoneDef = {
  id: 'gare_hall',
  name: 'Gare — salle des pas perdus',
  region: 'Vesper',
  theme: 'gare',
  ambience: 'interieur',
  indoor: true,
  map: [
    '##############',
    '#llll======ll#',
    '#=====CCCC===#',
    '#=c=c=c======#',
    '#============#',
    '#=c=c=c====l=#',
    '#============#',
    '#============#',
    '######D#######',
  ],
  warps: [door(6, 8, 'gare', 7, 5, 'down')],
  entities: [
    npc('tobias', 8, 1, 'tobias', [
      {
        if: { notFlag: 'tobias_1' },
        then: [
          { say: 'Gare de Vesper, bonsoir. Il n’y a plus de train depuis 1996, mais je fais quand même mon service. Quelqu’un doit bien tenir le quai.', who: 'tobias' },
          { say: 'Vous voulez aller dans le marais, ou plus loin ? Prenez ça. Une lampe-torche. Et cette radio : la nuit, elle capte des choses.', who: 'tobias' },
          { say: 'Si vous trouvez des endroits où elle grésille fort, notez ce qu’elle dit. Il y a une phrase que je n’ai jamais entendue en entier.', who: 'tobias', mood: 'triste' },
          { give: 'lampe_torche' },
          { give: 'radio' },
          { setFlag: 'tobias_1' },
          { quest: 'q_radio', stage: 0 },
        ],
        else: [
          {
            if: { all: [{ quest: 'q_quai', atLeast: 1, below: 2 }, { notFlag: 'ruban_donne' }] },
            then: [
              { say: 'Une petite fille au quai du marais ? Avec les cheveux mouillés ?', who: 'tobias', mood: 'peur' },
              { say: 'Les objets trouvés… Il y a ce ruban. Je l’ai trouvé sur le quai le 12 décembre 1996. Il est toujours trempé. Je l’ai jamais jeté.', who: 'tobias', mood: 'triste' },
              { give: 'ruban_bleu' },
              { setFlag: 'ruban_donne' },
              { quest: 'q_quai', stage: 2 },
            ],
            else: [
              {
                if: { all: [{ quest: 'q_radio', atLeast: 1 }, { quest: 'q_radio', done: false }] },
                then: [
                  { say: 'Trois fréquences ? Faites-moi entendre… « …chers auditeurs, ce soir, à minuit, la ville va… »', who: 'tobias' },
                  { say: '« …se souvenir. » C’était ça. « La ville va se souvenir. » Il annonçait une fête. La fête des Lumières. Personne n’est venu.', who: 'tobias', mood: 'triste' },
                  { questDone: 'q_radio' },
                ],
                else: [
                  {
                    if: { item: 'ticket_sans_date' },
                    then: [{ say: 'Ce billet… Le poinçon est le mien. Le train de 23 h 50 passe entre 23 h 30 et 1 h. Ne descendez pas avant le terminus.', who: 'tobias', mood: 'peur' }],
                    else: [{ say: 'Le train de 23 h 50 ? Je l’entends toujours, vers minuit. Mais il ne prend personne sans billet. Plus personne n’en vend.', who: 'tobias' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]),
    rest('banc_gare', 2, 3, 'Un banc de bois. Une affiche décolorée : « Prochain départ : 23 h 50 ». En dessous, une veilleuse électrique, toujours allumée.'),
    pickup('registre_gare', 12, 1, 'registre_gare', 1, [{ clue: 'train_enfants' }]),
    look('consigne', 11, 5, 'Les objets trouvés. Une étagère de chaussures d’enfants, toutes du pied gauche.'),
    pickup('gare_hall_fil', 12, 7, 'fil_rouge', 2),
  ],
};

// ---------------------------------------------------------------- Hôpital Saint-Aubin

export const hopital_ext: ZoneDef = {
  id: 'hopital_ext',
  name: 'Hôpital Saint-Aubin — jardin',
  region: 'Vesper',
  theme: 'hopital',
  ambience: 'vent',
  music: 'hopital',
  fog: 0.5,
  mapPos: [5, 1],
  map: [
    'TTTTTTTTTTTTTTTTTTTT',
    'TTRRRRRRRRRRRRRRRRTT',
    'TTRRRRRRRRRRRRRRRRTT',
    'TT#######D########TT',
    'T,,,,,,,,..,,,,,,,,T',
    'T,g,g,g,,..,,"""",,T',
    'T,,,,,,,,..,,"""",,T',
    'T,g,g,g,,..,,,,,,,,T',
    'T,,,,,,,,..,,,p,,,,T',
    'T,,"""",,..,,,,,,,,T',
    'T,,"""",,..,,"""",,T',
    'T,,,,,,,,..,,"""",,T',
    'TTTTTTTTT..TTTTTTTTT',
    'TTTTTTTTT..TTTTTTTTT',
  ],
  warps: [
    ...edges([9, 10], [13], 'gare', [22, 23], [1], 'down'),
    door(9, 3, 'hopital', 11, 12, 'up', { when: { item: 'cle_hopital' }, locked: 'Chaînes et cadenas sur la grande porte. Il faudrait le passe d’un membre du personnel.' }),
  ],
  encounters: [
    { creature: 'gresille', weight: 4, levels: [11, 13] },
    { creature: 'murmure_mur', weight: 4, levels: [11, 13] },
    { creature: 'coquemort', weight: 2, levels: [11, 13] },
  ],
  encounterRate: 0.1,
  entities: [
    look('tombe_1', 2, 5, 'Une petite tombe sans nom. Une date : 11/12/1996.'),
    look('tombe_2', 4, 7, 'Une petite tombe. Le nom a été gratté. On devine un « T ».'),
    look('tombe_3', 6, 5, 'Une petite tombe. Quelqu’un y a déposé une veilleuse débranchée.'),
    trigger('radio_hopital', 15, 6, [{ horror: 'radio' }, { say: 'La radio hurle : « …la ville va… » puis une voix de petite fille : « Je veux pas dormir. »' }, { counter: 'radio_freq', add: 1 }, { if: { counter: 'radio_freq', atLeast: 3 }, then: [{ quest: 'q_radio', stage: 1 }] }], true, { item: 'radio' }),
    pickup('jardin_sucre', 17, 11, 'sucre_orge', 1),
    pickup('jardin_sel', 1, 11, 'sel', 1),
  ],
};

const chaseSonneur: ScriptCmd[] = [
  { horror: 'cloches' },
  { say: 'Toutes les sonnettes de l’hôpital se mettent à sonner. Toutes. En même temps. Au bout du couloir, quelque chose se détache du mur.' },
  { quest: 'q_sonnettes', stage: 1 },
  {
    choice: 'Les clochettes approchent.',
    options: [
      {
        text: 'Fuir vers le hall',
        then: [
          {
            chase: 'sonneur',
            from: [28, 6],
            escape: [7, 8, 16, 12],
            caught: [
              { say: 'Une main froide se pose sur votre épaule. Les clochettes se taisent d’un coup.' },
              { setFlag: 'sonneur_fui' },
              { battle: 'sonneur', level: 18, boss: true, onBond: [{ questDone: 'q_sonnettes' }] },
            ],
            escaped: [{ say: 'Vous atteignez le hall. Les sonnettes se taisent. Il ne vous a pas suivi(e). Il attend, quelque part dans les chambres.' }, { setFlag: 'sonneur_fui' }],
          },
        ],
      },
      {
        text: 'Répondre : « J’arrive. »',
        then: [
          { say: '« J’arrive. »', who: 'joueur' },
          { say: 'Les sonnettes se taisent, une à une. Une grande forme sans visage, couverte de clochettes, s’arrête devant vous. Elle s’incline, comme un malade qui remercie.' },
          {
            choice: 'Le Sonneur attend.',
            options: [
              { text: 'Lui proposer de vous suivre (pacte)', then: [{ bondDirect: 'sonneur', level: 18 }, { say: 'Désormais, quand ses clochettes sonneront, quelqu’un viendra.' }, { questDone: 'q_sonnettes' }] },
              { text: 'Lui dire que tout le monde est venu (apaiser)', then: [{ pacify: 'sonneur' }, { say: 'Il se défait comme une blouse qu’on suspend. Les clochettes tombent sans bruit.' }, { questDone: 'q_sonnettes' }] },
            ],
          },
        ],
      },
    ],
  },
];

export const hopital: ZoneDef = {
  id: 'hopital',
  name: 'Hôpital Saint-Aubin',
  region: 'Vesper',
  theme: 'hopital',
  ambience: 'hopital',
  music: 'hopital',
  indoor: true,
  dark: 0.6,
  encounterAll: true,
  encounterRate: 0.04,
  map: [
    '##############################',
    '#b_b_b#b_b_b#b_b_b#lllll#llll#',
    '#_____#_____#_____#_____#____#',
    '#b___b#b___b#b___b#_k___#__k_#',
    '###D#####D#####D#####D####D###',
    '#____________________________#',
    '#____________________________#',
    '###D###__________######D######',
    '#_____#__________#___________#',
    '#_b_b_#__C_C_C___#_L_L_L_____#',
    '#_____#__________#___________#',
    '#_b_b_#__________#_L_L_L_____#',
    '#_____#__________#___________#',
    '###########D##################',
  ],
  warps: [door(11, 13, 'hopital_ext', 9, 4, 'down')],
  encounters: [
    { creature: 'murmure_mur', weight: 6, levels: [12, 15] },
    { creature: 'gribouille', weight: 2, levels: [12, 14] },
    { creature: 'main_froide', weight: 1, levels: [15, 17], when: NIGHT },
  ],
  onEnter: [{ quest: 'q_main', stage: 6 }, { quest: 'q_sonnettes', stage: 0 }, { say: 'Le hall de l’hôpital. Chaque lit, au-delà, a sa sonnette de chevet. Le silence ici a une forme.' }],
  enterOnceFlag: 'hopital_entre',
  entities: [
    {
      id: 'cadenas_archives',
      x: 21,
      y: 4,
      kind: 'panneau',
      solid: true,
      sprite: 'cadenas',
      when: { notFlag: 'archives_ouvertes' },
      script: [
        { say: 'Porte « ARCHIVES — PROJET V. ». Un cadenas à quatre chiffres.' },
        { if: { clue: 'code_armoire' }, then: [{ say: 'L’ordonnance de Mireille parlait d’une combinaison…' }] },
        {
          codeInput: 'Composer le code',
          correct: '0917',
          then: [{ sound: 'mecanisme' }, { say: 'Clic. Le cadenas s’ouvre. Derrière la porte, une odeur de papier humide et d’ozone.' }, { setFlag: 'archives_ouvertes' }],
          else: [{ say: 'Le cadenas ne bouge pas. Quelque part, une sonnette tinte une fois.' }],
        },
      ],
    },
    pickup('dossier_varenne', 20, 3, 'dossier_varenne', 1, [{ clue: 'dossier_varenne' }, { say: 'Fiche d’admission : VARENNE Élise, 9 ans. La photo agrafée… c’est vous. Enfant. Vous vous souvenez de ce pull.' }, { horror: 'souffle' }]),
    pickup('cassette_1', 19, 2, 'cassette_1', 1, [{ clue: 'projet_veille' }]),
    pickup('badge_institut', 23, 2, 'badge_institut', 1, [{ quest: 'q_main', stage: 7 }]),
    pickup('ticket_sans_date', 23, 3, 'ticket_sans_date', 1, [{ say: 'Un billet de train Vesper → Cendriers. La date est vide. Le nom du passager est écrit de votre main.' }, { quest: 'q_main', stage: 7 }]),
    pickup('cassette_2', 27, 3, 'cassette_2', 1, [{ clue: 'nuit_blanche' }, { setFlag: 'bureau_vu' }]),
    look('bureau_halden', 26, 1, 'Des étagères de classeurs « Projet VEILLE ». Sur l’un : « Sujets : 32. Restaurés : 0. »'),
    look('sonnettes', 9, 2, 'Les sonnettes de chevet pendent toutes au-dessus des lits, les fils coupés. Elles se balancent quand même.'),
    {
      id: 'declencheur_sonneur',
      x: 26,
      y: 5,
      kind: 'declencheur',
      touch: true,
      solid: false,
      when: { all: [{ flag: 'bureau_vu' }, { notFlag: 'sonneur_fui' }, notResolved('sonneur')] },
      script: chaseSonneur,
    },
    {
      id: 'sonneur_chambre',
      x: 15,
      y: 2,
      kind: 'apparition',
      sprite: 'sonneur',
      solid: true,
      behavior: 'immobile',
      when: { all: [{ flag: 'sonneur_fui' }, notResolved('sonneur')] },
      script: [{ horror: 'cloches' }, { say: 'Le Sonneur se tient au pied d’un lit vide. Ses clochettes frémissent quand vous approchez.' }, { battle: 'sonneur', level: 18, boss: true, onBond: [{ questDone: 'q_sonnettes' }] }],
    },
    rest('lit_isolement', 2, 9, 'Un lit d’isolement, trop propre. Une veilleuse de secours clignote au-dessus. Elle vous connaît.'),
    pickup('hopital_souvenir', 19, 10, 'souvenir_chaud', 1),
    pickup('hopital_sel', 27, 12, 'sel', 2),
    pickup('hopital_eau', 14, 2, 'eau_benite', 1),
    pickup('hopital_fil', 28, 8, 'fil_rouge', 3),
    look('accueil', 11, 9, 'Le registre d’accueil. Dernière entrée : « 11/12/1996, 23 h 10 — 32 enfants — transfert Institut, départ gare 23 h 50 — accompagnés Dr M. Halden. »'),
  ],
};

export const train: ZoneDef = {
  id: 'train',
  name: 'Le train de 23 h 50',
  region: 'Vesper',
  theme: 'train',
  ambience: 'train',
  music: 'silence',
  indoor: true,
  dark: 0.4,
  map: [
    '####################',
    '#c_c_c_c_c_c_c_c_c_#',
    '#__________________D',
    '#__________________#',
    '#c_c_c_c_c_c_c_c_c_#',
    '####################',
  ],
  warps: [
    {
      x: 19,
      y: 2,
      to: 'cendriers',
      tx: 15,
      ty: 19,
      dir: 'up',
      sound: 'train',
      when: { flag: 'controleur_vu' },
      locked: 'La porte ne s’ouvre pas tant que le train roule. Dehors, il n’y a que du blanc.',
    },
  ],
  onEnter: [{ sound: 'train' }, { say: 'Le train démarre sans secousse. Pas de conducteur. Sur chaque siège, une petite valise d’enfant étiquetée.' }],
  entities: [
    {
      id: 'controleur',
      x: 16,
      y: 3,
      kind: 'apparition',
      sprite: 'controleur',
      solid: true,
      when: { notFlag: 'controleur_vu' },
      script: [
        { say: 'Un uniforme de contrôleur parfaitement repassé. Casquette, poinçon. Rien à l’intérieur.' },
        { say: '« Billet, s’il vous plaît. »', who: '' },
        { say: 'Il poinçonne votre ticket sans le prendre. « Varenne, Élise. Vous êtes en retard de trente ans. Vous étiez sur la liste. »', who: '', mood: 'vide' },
        { setFlag: 'controleur_vu' },
        { battle: 'controleur', level: 20, then: [{ say: 'Le train ralentit. Terminus : les Cendriers.' }] },
      ],
    },
    look('valise', 5, 1, 'Une valise d’enfant. Étiquette : « Théo M. — ne pas ouvrir avant l’arrivée ».'),
    look('valise2', 11, 4, 'Une valise d’enfant. Étiquette : « Élise V. ». Dedans, une chemise de nuit et une prise multiple.'),
    look('fenetre', 9, 1, 'Par la vitre : du blanc. Puis, une seconde, une rue éclairée, la vôtre, avec vous dedans, qui regarde passer le train.'),
  ],
};
