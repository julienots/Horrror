import type { ZoneDef } from '../types';
import { DAY, NIGHT, door, edges, look, npc, pickup, sign, trigger } from './helpers';

// ---------------------------------------------------------------- Saint-Ormel

export const village: ZoneDef = {
  id: 'village',
  name: 'Saint-Ormel',
  region: 'Vesper',
  theme: 'village',
  ambience: 'village',
  music: 'village',
  fog: 0.25,
  mapPos: [3, 3],
  map: [
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
    'T,,,,,,,,,,,,,,..,,,,,,,,,,,,,,T',
    'T,RRRRRRR,,,,,,..,,,,,,RRRRRRR,T',
    'T,RRRRRRR,p,,,,..,,,,p,RRRRRRR,T',
    'T,###D###,,,,,,..,,,,,,###D###,T',
    'T,,,,.,,,,,,,,,..,,,,,,,,,.,,,,T',
    'T,,,,......................,,,,T',
    'T,,,,,,,,,,,,,,..,,,,,,,,,,,,,,T',
    'T,,,,,,,,,,,,,,..,,,,,RRRRR,,,,T',
    'T,,,,,,,,,,,,,,..,,,,,RRRRR,,,,T',
    'T,,,,,,,,,,,,,p..,,,,,##D##,,,,T',
    '................................',
    '................................',
    'T,,,,,,,,,,,,,,..p,,,,,,,,,,,,,T',
    'T,RRRRRR,,,,,,,..,,,,,,,,,,,,,,T',
    'T,RRRRRR,,,,,,,..,,,,,ffffffff,T',
    'T,##D###,,,,,,,..,,,,,f,,,,,,f,T',
    'T,,,.,,,,,,,,,,..,,,,,f""""""f,T',
    'T,,,.,,,,,,,,,,..,,,,,f""""""f,T',
    'T,,,.,,,,,,,,,,..,,,,,fff..fff,T',
    'T,,,........................,,,T',
    'T,,,,,,,,,,,,,,..,,,,,,,,,,,p,,T',
    'TT,,,,,,,,,,,,,..,,,,,,,,,,,,,TT',
    'TTTTTTTTTTTTTTT..TTTTTTTTTTTTTTT',
  ],
  variants: [
    {
      // La maison n° 9 n'existe que la nuit.
      when: NIGHT,
      patches: [{ x: 23, y: 16, rows: ['RRRRRR', 'RRRRRR', '##D###'] }],
    },
  ],
  warps: [
    door(5, 4, 'pension', 5, 7, 'up'),
    door(26, 4, 'mairie', 6, 8, 'up'),
    door(24, 10, 'pharmacie', 5, 7, 'up'),
    door(4, 16, 'maison_morel', 3, 6, 'up'),
    door(25, 18, 'tilleuls9', 3, 8, 'up', { when: NIGHT }),
    ...edges([15, 16], [0], 'foret', [15, 16], [22], 'up'),
    ...edges([0], [11, 12], 'ecole_cour', [22], [10, 11], 'left'),
    ...edges([31], [11, 12], 'gare', [1], [9, 10], 'right'),
    ...edges([15, 16], [23], 'marais', [15, 16], [1], 'down'),
  ],
  encounters: [
    { creature: 'mitaine', weight: 5, levels: [3, 5] },
    { creature: 'gresille', weight: 3, levels: [3, 5], when: NIGHT },
    { creature: 'palefeu', weight: 2, levels: [4, 5], when: NIGHT },
  ],
  encounterRate: 0.08,
  onEnter: [
    { music: null },
    { say: 'Le bus vous dépose à Saint-Ormel et repart aussitôt. Il n’y avait personne d’autre à bord. Il n’y avait pas de chauffeur non plus, maintenant que vous y pensez.' },
    { say: 'Dans votre poche : une lettre, et votre carnet.' },
    { give: 'lettre_elise', silent: true },
    { give: 'journal_perso', silent: true },
    { give: 'tisane', qty: 2, silent: true },
    { give: 'fil_rouge', qty: 3, silent: true },
    { give: 'cierge_apaisement', qty: 1, silent: true },
    { clue: 'lettre' },
    { quest: 'q_main', stage: 0 },
    { sound: 'souffle' },
    { say: 'Quelque chose de pâle se pose sur votre épaule. Une petite lumière qui bat comme un cœur.' },
    { bondDirect: 'veilleuse', level: 5 },
    { say: 'La Veilleuse vous a rejoint(e). Elle semble vous connaître depuis toujours.' },
    { say: 'Flèches ou ZQSD : marcher. Entrée/Espace : agir. Échap : menu. Les options d’accessibilité sont dans le menu.' },
    { music: 'village' },
    { save: true },
  ],
  enterOnceFlag: 'intro',
  entities: [
    sign('panneau_village', 13, 21, 'SAINT-ORMEL — 312 habitants. Le chiffre a été corrigé plusieurs fois au feutre : 340… 327… 312.'),
    sign('panneau_tilleuls', 21, 19, 'Rue des Tilleuls. Numéros 1 à 8.'),
    trigger(
      'terrain_vague',
      25,
      19,
      [
        { say: 'Un terrain vague envahi d’herbes. Une boîte aux lettres rouillée, plantée là, porte un numéro peint à la main : 9.' },
        { say: 'Il n’y a pas de maison. Il n’y a jamais eu de maison, à en juger par l’herbe.' },
        { quest: 'q_main', stage: 2 },
      ],
      true,
      DAY,
    ),
    trigger(
      'maison_apparue',
      25,
      19,
      [
        { horror: 'souffle' },
        { say: 'Il y a une maison au numéro 9. Les volets sont clos. Une lumière de veilleuse filtre sous la porte.' },
        { quest: 'q_main', stage: 2 },
      ],
      true,
      NIGHT,
    ),
    npc(
      'nora',
      13,
      13,
      'nora',
      [
        {
          if: { flag: 'revelation' },
          then: [{ say: 'Tu t’es souvenue, hein ? Moi aussi, un jour, je me souviendrai. Mais pas tout de suite.', who: 'nora', mood: 'sourire' }],
          else: [
            {
              if: { notFlag: 'nora_1' },
              then: [
                { say: 'T’as pas d’ombre, toi non plus.', who: 'nora', mood: 'sourire' },
                { say: 'Regarde par terre. Moi non plus j’en ai pas. Les grands ne remarquent jamais.', who: 'nora' },
                { say: 'Si tu cherches les enfants, va dans la forêt après minuit. Les chemins tournent pas pareil.', who: 'nora' },
                { setFlag: 'nora_1' },
                { quest: 'q_chapelle', stage: 0 },
              ],
              else: [
                {
                  if: { time: ['nuit', 'minuit'] },
                  then: [{ say: 'La nuit, la rue des Tilleuls a neuf maisons. Tu le savais ?', who: 'nora', mood: 'vide' }],
                  else: [{ say: 'Minuit, la forêt. Le train, aussi. Tout se passe à minuit, ici.', who: 'nora' }],
                },
              ],
            },
          ],
        },
      ],
    ),
    npc(
      'gilles',
      20,
      7,
      'gilles',
      [
        {
          if: { notFlag: 'gilles_1' },
          then: [
            { say: 'Une lettre pour le 9, rue des Tilleuls ? C’est moi qui l’ai distribuée, oui. Enfin… je crois.', who: 'gilles' },
            { say: 'Il n’y a pas de numéro 9. Mais j’avais la lettre dans ma sacoche, alors je l’ai déposée. La nuit, je vois mieux les adresses.', who: 'gilles', mood: 'peur' },
            { say: 'L’expéditeur ? L’adresse au dos, c’était la pension de Madame Brève. Et l’écriture… je l’ai déjà vue quelque part.', who: 'gilles' },
            { setFlag: 'gilles_1' },
            { quest: 'q_main', stage: 1 },
          ],
          else: [{ say: 'Je distribue aussi des lettres aux Cendriers. Je ne sais pas où c’est. Mes pieds le savent.', who: 'gilles' }],
        },
      ],
      { when: DAY },
    ),
    npc(
      'habitant_1',
      9,
      7,
      'habitant',
      [
        {
          if: { flag: 'oubli_breve' },
          then: [{ say: 'On se connaît ? Non… Je ne crois pas. Bienvenue à Saint-Ormel, en tout cas.', who: 'habitant' }],
          else: [{ say: 'Bonjour ! Vous n’êtes pas d’ici. On n’a pas beaucoup de visiteurs. On n’en garde pas beaucoup non plus.', who: 'habitant' }],
        },
      ],
      { when: DAY },
    ),
    npc(
      'silhouette_rue',
      27,
      21,
      'silhouette',
      [{ horror: 'chuchotement' }, { say: 'La silhouette ne bouge pas. Elle n’a pas de visage. Quand vous clignez des yeux, elle est un peu plus près.' }],
      { when: { time: 'minuit' } },
    ),
    pickup('village_fil', 1, 1, 'fil_rouge', 2),
    pickup('village_encens', 30, 13, 'encens', 1),
    pickup('village_tisane', 2, 22, 'tisane', 2),
  ],
};

// ---------------------------------------------------------------- Pension

export const pension: ZoneDef = {
  id: 'pension',
  name: 'Pension Brève',
  region: 'Vesper',
  theme: 'interieur',
  ambience: 'interieur',
  indoor: true,
  map: [
    '############',
    '#ll===b=b=l#',
    '#==========#',
    '#=kc====kc=#',
    '#==========#',
    '#CCC=======#',
    '#==========#',
    '#====++====#',
    '#####D######',
  ],
  warps: [door(5, 8, 'village', 5, 5, 'down')],
  entities: [
    npc('breve', 2, 4, 'breve', [
      {
        if: { notFlag: 'breve_1' },
        then: [
          { say: 'Bonsoir ! Une chambre ? Bien sûr. Vous avez de la chance, il ne reste que des chambres libres.', who: 'breve', mood: 'sourire' },
          { say: 'La rue des Tilleuls ? Elle n’a que huit numéros, ma petite, ma grand-mère y habitait. Un numéro 9… Non.', who: 'breve' },
          { say: 'Prenez le lit du fond. Et tenez, des tisanes. Les nuits sont longues, à Vesper.', who: 'breve' },
          { give: 'tisane', qty: 3 },
          { setFlag: 'breve_1' },
          { quest: 'q_main', stage: 1 },
        ],
        else: [
          {
            if: { all: [{ flag: 'oubli_breve' }, { notFlag: 'breve_oubli_dit' }] },
            then: [
              { say: 'Bonjour ! Vous êtes nouveau… nouvelle ? On ne m’a pas prévenue d’une arrivée.', who: 'breve', mood: 'sourire' },
              { say: 'Attendez. Mon cahier dit que vous avez dormi ici cette nuit. C’est mon écriture. Je… je ne m’en souviens pas.', who: 'breve', mood: 'peur' },
              { say: 'Ça arrive de plus en plus souvent, vous savez. On oublie les gens. Pas les objets, pas les rues. Les gens.', who: 'breve', mood: 'triste' },
              { clue: 'oubli_villageois' },
              { setFlag: 'breve_oubli_dit' },
            ],
            else: [
              {
                if: { quest: 'q_main', atLeast: 3 },
                then: [{ say: 'Vous rentrez tard. Ne dormez pas avec la lumière éteinte, d’accord ? Ici, ça ne se fait pas.', who: 'breve' }],
                else: [{ say: 'Si vous cherchez quelqu’un, demandez à Odile, à la mairie. Ou au facteur. Lui, il connaît des adresses qui n’existent pas.', who: 'breve' }],
              },
            ],
          },
        ],
      },
    ]),
    {
      id: 'lit_pension',
      x: 8,
      y: 1,
      kind: 'panneau',
      solid: true,
      script: [
        { say: 'Votre lit à la pension. Les draps sentent la lavande et autre chose, de plus ancien.' },
        {
          choice: 'Dormir ?',
          options: [
            { text: 'Jusqu’au matin (8 h)', then: [{ fade: 'out' }, { setTime: 480 }, { heal: true }, { if: { notFlag: 'premiere_nuit' }, then: [{ setFlag: 'premiere_nuit' }, { npcForget: 'breve' }] }, { if: { not: { item: 'fil_rouge', qty: 3 } }, then: [{ give: 'fil_rouge', qty: 3 }, { say: 'Quelqu’un a laissé des bobines de fil rouge sur la table de nuit.' }] }, { fade: 'in' }, { save: true }] },
            { text: 'Jusqu’à la nuit (22 h)', then: [{ fade: 'out' }, { setTime: 1320 }, { heal: true }, { fade: 'in' }, { save: true }] },
            { text: 'Attendre minuit (23 h 40)', then: [{ fade: 'out' }, { setTime: 1420 }, { heal: true }, { fade: 'in' }, { save: true }] },
            { text: 'Ne pas dormir', then: [] },
          ],
        },
      ],
    },
    look('miroir_pension', 1, 1, 'Une étagère de livres de comptes. Chaque année, la colonne « clients » a des lignes raturées jusqu’à en trouer le papier.'),
    pickup('pension_bouillon', 10, 2, 'bouillon', 1),
  ],
};

// ---------------------------------------------------------------- Mairie

export const mairie: ZoneDef = {
  id: 'mairie',
  name: 'Mairie — Archives',
  region: 'Vesper',
  theme: 'interieur',
  ambience: 'interieur',
  indoor: true,
  map: [
    '##############',
    '#llll=ll=llll#',
    '#============#',
    '#=kc===kc====#',
    '#============#',
    '#CCCCCC======#',
    '#============#',
    '#==l=====l===#',
    '#============#',
    '######D#######',
  ],
  warps: [door(6, 9, 'village', 26, 5, 'down')],
  entities: [
    npc('odile', 3, 4, 'odile', [
      {
        if: { notFlag: 'odile_1' },
        then: [
          { say: 'Les archives sont ouvertes, mais il n’y a pas grand-chose à archiver. Vous cherchez quelqu’un ?', who: 'odile' },
          { say: 'Élise ? Non. Mais regardez : mon registre de 1996. Des pages entières, vides. Je les ai écrites, j’en suis sûre. L’encre est partie.', who: 'odile', mood: 'triste' },
          { say: 'Vous avez un Rémanent avec vous. Je les vois, moi aussi, un peu. Ce sont des choses que la ville a oubliées et qui n’ont pas accepté de disparaître.', who: 'odile' },
          { say: 'Si l’une d’elles vous attaque : affaiblissez-la, observez-la. Comprenez ce qu’elle craint et ce qu’elle veut.', who: 'odile' },
          { say: 'Ensuite, un cierge pour l’apaiser et la laisser partir. Ou un fil rouge, pour qu’elle reste avec vous. Ou chassez-la, si vous n’avez pas le cœur.', who: 'odile' },
          { give: 'fil_rouge', qty: 5 },
          { give: 'cierge_apaisement', qty: 3 },
          { give: 'carte_region' },
          { setFlag: 'odile_1' },
          { quest: 'q_archives', stage: 1 },
        ],
        else: [
          {
            if: { quest: 'q_archives', done: true },
            then: [{ say: 'Les pages restent écrites. Pour la première fois depuis trente ans. Merci… Élise.', who: 'odile', mood: 'sourire' }],
            else: [
              {
                if: { clueCount: 6 },
                then: [
                  { quest: 'q_archives', stage: 2 },
                  { say: 'Vous avez trouvé tout ça ? Le Projet VEILLE, les enfants du train, la nuit de l’archivage…', who: 'odile', mood: 'peur' },
                  {
                    choice: 'Révéler à Odile ce que vous avez compris, sur la ville et sur vous ?',
                    options: [
                      {
                        text: 'Tout lui raconter',
                        then: [
                          { say: 'Odile écrit. Elle écrit longtemps. Cette fois, l’encre reste sur la page.', who: '' },
                          { say: 'Alors c’est vrai. On a oublié tout un quartier. Et vous… vous êtes l’une d’entre eux.', who: 'odile', mood: 'triste' },
                          { say: 'Quand vous serez là-bas, au bout, je lirai les noms à voix haute. Tous. Ils auront quelqu’un pour les attendre.', who: 'odile' },
                          { questDone: 'q_archives' },
                          { setFlag: 'verite_revelee' },
                          { morality: 'light', amount: 2 },
                        ],
                      },
                      { text: 'Garder le silence pour l’instant', then: [{ say: 'Prenez votre temps. Mais n’attendez pas d’avoir oublié.', who: 'odile' }] },
                    ],
                  },
                ],
                else: [
                  { say: 'Il me faut des preuves que la ville ne pourra pas effacer. Vous en avez {cles} sur 6. Cherchez encore.', who: 'odile' },
                  { if: { not: { item: 'fil_rouge', qty: 3 } }, then: [{ say: 'Tenez, j’ai cousu d’autres fils.', who: 'odile' }, { give: 'fil_rouge', qty: 3 }] },
                ],
              },
            ],
          },
        ],
      },
    ]),
    look('registre_1996', 6, 1, 'Registre d’état civil, 1996. Les naissances, les mariages… et, en décembre, quarante pages parfaitement blanches.'),
    look('plan_cendriers', 9, 7, 'Un plan cadastral de Vesper. Au sud-est de la gare, un quartier entier est dessiné au crayon puis gommé. On lit encore : « Les Cendr… ».'),
    pickup('mairie_sel', 12, 8, 'sel', 2),
  ],
};

// ---------------------------------------------------------------- Pharmacie

export const pharmacie: ZoneDef = {
  id: 'pharmacie',
  name: 'Pharmacie Halden',
  region: 'Vesper',
  theme: 'interieur',
  ambience: 'interieur',
  indoor: true,
  map: [
    '############',
    '#llll==llll#',
    '#==========#',
    '#CCCCCC====#',
    '#==========#',
    '#=l======l=#',
    '#==========#',
    '#==========#',
    '#####D######',
  ],
  warps: [door(5, 8, 'village', 24, 11, 'down')],
  entities: [
    npc('mireille', 3, 2, 'mireille', [
      {
        if: { all: [{ item: 'photo_classe' }, { notFlag: 'mireille_photo' }] },
        then: [
          { say: 'Où avez-vous trouvé ça ?', who: 'mireille', mood: 'peur' },
          { say: 'Sainte-Brume, 1996… Cette petite, au deuxième rang. Varenne. Élise Varenne. Elle refusait d’éteindre sa veilleuse.', who: 'mireille', mood: 'peur' },
          { say: 'Elle a votre visage. Exactement votre visage.', who: 'mireille', mood: 'vide' },
          { say: 'Je ne peux pas vous expliquer. Je ne sais plus. Mais tout est à l’hôpital Saint-Aubin, au nord de la gare. Prenez ça. Et ne me rapportez rien.', who: 'mireille', mood: 'peur' },
          { give: 'cle_hopital' },
          { setFlag: 'mireille_photo' },
          { quest: 'q_main', stage: 6 },
        ],
        else: [
          {
            if: { notFlag: 'mireille_1' },
            then: [
              { say: 'Pharmacie Halden. Je soigne les gens… et les choses qui vous accompagnent, si elles se laissent faire.', who: 'mireille' },
              { say: 'Halden ? Oui, comme l’Institut. Mon père. Je ne parle pas de l’Institut.', who: 'mireille', mood: 'colere' },
              { give: 'tisane', qty: 3 },
              { give: 'sel', qty: 1 },
              { setFlag: 'mireille_1' },
            ],
            else: [{ say: 'Laissez-moi voir vos… compagnons. Voilà. Ils iront mieux.', who: 'mireille' }],
          },
          { heal: true },
          { say: 'Votre équipe est soignée.' },
        ],
      },
    ]),
    pickup('ordonnance', 10, 2, 'ordonnance', 1, [{ clue: 'code_armoire' }]),
    look('etagere_pharma', 2, 5, 'Des flacons étiquetés « Fièvre grise — stade 1 », « stade 2 », « stade 3 ». Ils sont tous vides et époussetés.'),
  ],
};

// ---------------------------------------------------------------- Maison Morel

export const maison_morel: ZoneDef = {
  id: 'maison_morel',
  name: 'Maison Morel',
  region: 'Vesper',
  theme: 'interieur',
  ambience: 'interieur',
  indoor: true,
  map: [
    '##########',
    '#ll==b=ll#',
    '#========#',
    '#=kc=====#',
    '#========#',
    '#=====+==#',
    '#========#',
    '###D######',
  ],
  warps: [door(3, 7, 'village', 4, 17, 'down')],
  entities: [
    npc('agnes', 4, 4, 'agnes', [
      {
        if: { quest: 'q_theo', done: true },
        then: [
          {
            if: { flag: 'agnes_sait' },
            then: [{ say: 'Théo. Je le dis tous les matins, maintenant, pour ne pas le perdre une deuxième fois.', who: 'agnes', mood: 'triste' }],
            else: [{ say: 'Il fait beau, non ? Je ne sais pas pourquoi j’ai fait deux bols. Quelle tête en l’air.', who: 'agnes', mood: 'sourire' }],
          },
        ],
        else: [
          {
            if: { quest: 'q_theo', atLeast: 2 },
            then: [
              { say: 'Vous revenez de la forêt ? Vous sentez la terre mouillée. Et… le chien. Comment je sais qu’on avait un chien ?', who: 'agnes', mood: 'peur' },
              {
                choice: 'Que dire à Agnès ?',
                options: [
                  {
                    text: 'Lui parler de Théo',
                    then: [
                      { say: 'Votre fils s’appelait Théo. Il avait un chien, Pilou. Il a pris le train de 23 h 50, en 1996.', who: 'joueur' },
                      { say: '…', who: 'agnes', mood: 'vide' },
                      { say: 'Théo. Mon Théo. Comment ai-je pu… Il détestait le bol bleu. C’est pour ça que je lui donnais toujours le bol bleu.', who: 'agnes', mood: 'triste' },
                      { setFlag: 'agnes_sait' },
                      { morality: 'light', amount: 1 },
                      { questDone: 'q_theo' },
                    ],
                  },
                  {
                    text: 'Lui laisser son oubli',
                    then: [
                      { say: 'Ce n’est rien. Juste un chien errant.', who: 'joueur' },
                      { say: 'Ah. Tant mieux. Vous voulez un bol de café ? J’en ai fait deux.', who: 'agnes', mood: 'sourire' },
                      { morality: 'shadow', amount: 1 },
                      { questDone: 'q_theo' },
                    ],
                  },
                ],
              },
            ],
            else: [
              {
                if: { quest: 'q_theo', atLeast: 1 },
                then: [{ say: 'Théo ? Ce prénom… Il me fait mal au ventre. Je ne connais pas de Théo. Je crois.', who: 'agnes', mood: 'peur' }],
                else: [
                  { say: 'Entrez, entrez. Excusez le désordre. J’ai encore fait deux bols ce matin. Je fais toujours deux bols.', who: 'agnes' },
                  { say: 'Pour qui ? Pour… je ne sais pas. Pour personne. C’est une habitude, j’imagine.', who: 'agnes', mood: 'vide' },
                  { quest: 'q_theo', stage: 0 },
                ],
              },
            ],
          },
        ],
      },
    ]),
    look('bols', 2, 3, 'Deux bols sur la table. Sur le bleu, un prénom a été gravé au couteau, puis limé jusqu’à disparaître.'),
    look('cadre', 7, 1, 'Une photo encadrée : Agnès, souriante, la main posée sur le vide, à hauteur d’une épaule d’enfant.'),
    look('panier', 1, 1, 'Un panier pour chien. Une couverture. Des poils gris. Pas de chien.'),
  ],
};

// ---------------------------------------------------------------- 9, rue des Tilleuls (la nuit)

export const HOUSE_MAP = [
  '##############',
  '#ll=m==#=b=l=#',
  '#======#=====#',
  '#=kc===#==+==#',
  '#======+=====#',
  '#======#=====#',
  '#=C====#==k==#',
  '#======#=====#',
  '#======#######',
  '###D##########',
];

export const tilleuls9: ZoneDef = {
  id: 'tilleuls9',
  name: '9, rue des Tilleuls',
  region: 'Vesper',
  theme: 'interieur',
  ambience: 'maison_nuit',
  music: 'silence',
  indoor: true,
  dark: 0.55,
  map: HOUSE_MAP,
  warps: [door(3, 9, 'village', 25, 19, 'down')],
  onEnter: [
    { clue: 'maison_nuit' },
    { quest: 'q_main', stage: 2 },
    { say: 'L’intérieur sent la poussière tiède et le lait chaud. Tout est rangé, comme si quelqu’un venait de partir.' },
    { horror: 'lumieres' },
  ],
  enterOnceFlag: 'tilleuls_vu',
  entities: [
    look('telephone', 2, 6, [
      { if: { notFlag: 'tel_1' }, then: [
        { sound: 'telephone' },
        { say: 'Le téléphone sonne. Le fil pend, arraché du mur.' },
        { choice: 'Décrocher ?', options: [
          { text: 'Décrocher', then: [{ horror: 'radio' }, { say: '« …Tu es rentrée ? Maman a laissé la veilleuse allumée. Ne la laisse pas s’éteindre. »', who: 'elise', mood: 'vide' }, { say: 'C’est une voix d’enfant. Elle vous semble familière, comme une chanson qu’on fredonne sans savoir d’où elle vient.' }, { setFlag: 'tel_1' }] },
          { text: 'Laisser sonner', then: [{ say: 'Il sonne treize fois, puis s’arrête. Le silence qui suit est pire.' }, { setFlag: 'tel_1' }] },
        ] },
      ], else: [{ say: 'Un vieux téléphone à cadran. Le fil a été arraché du mur il y a longtemps.' }] },
    ]),
    look('miroir_tilleuls', 4, 1, 'Un drap noir couvre le miroir. Il est cousu au cadre, à gros points. De l’intérieur.'),
    look('lit_enfant', 9, 1, [
      { say: 'Un lit d’enfant aux draps bleus. Au-dessus, une prise murale vide, entourée d’une auréole jaunie.' },
      { if: { owned: 'veilleuse' }, then: [{ say: 'La Veilleuse quitte votre épaule et se pose sur la prise. Sa lumière devient chaude, presque heureuse. Elle était là, avant.' }, { clue: 'veilleuse_verite' }] },
    ]),
    look('bureau_elise', 10, 6, [
      { say: 'Un petit bureau. Une feuille, une écriture ronde : « L’école. Ma classe n’est plus là. Ils ne viennent plus me chercher. Viens. »' },
      { say: 'C’est la même écriture que la lettre. Et elle vous rappelle quelque chose d’autre, de plus proche.' },
      { quest: 'q_main', stage: 3 },
    ]),
    pickup('cle_ecole', 10, 5, 'cle_ecole', 1, [{ say: 'Une clé de laiton, étiquetée « Sainte-Brume ». L’école est à l’ouest du village.' }, { quest: 'q_main', stage: 3 }]),
    pickup('tilleuls_tisane', 1, 7, 'tisane', 2),
    look('tapisserie', 11, 1, 'Une tapisserie à oiseaux. Vous savez, sans savoir comment, qu’il y en a quarante et un. Vous les comptez : quarante et un.'),
  ],
};
