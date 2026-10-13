// Personnages : apparence (pour les sprites et portraits procéduraux),
// rôle et secret. Les secrets se dévoilent par les quêtes et indices.

export interface CharacterDef {
  id: string;
  name: string;
  role: string;
  secret: string;
  look: {
    skin: string;
    hair: string;
    coat: string;
    accent: string;
    hairStyle: 'court' | 'chignon' | 'long' | 'casquette' | 'capuche' | 'chauve' | 'voile';
    height: 'enfant' | 'adulte';
    glasses?: boolean;
    faceless?: boolean;
  };
}

const list: CharacterDef[] = [
  {
    id: 'joueur',
    name: 'Sacha',
    role: 'Vous. Venu(e) à Vesper à cause d’une lettre.',
    secret: 'Vous êtes un Rémanent : ce qui reste d’Élise Varenne, sortie du Voile.',
    look: { skin: '#d9b99b', hair: '#2a2228', coat: '#3b4a5a', accent: '#9c4a4a', hairStyle: 'court', height: 'adulte' },
  },
  {
    id: 'breve',
    name: 'Madame Brève',
    role: 'Tient la pension de Saint-Ormel.',
    secret: 'Elle oublie chaque matin les clients de la veille. Elle tient un cahier pour s’en souvenir.',
    look: { skin: '#e0c0a8', hair: '#8a8a8a', coat: '#6a4a5a', accent: '#e8e0d0', hairStyle: 'chignon', height: 'adulte' },
  },
  {
    id: 'odile',
    name: 'Odile Vasseur',
    role: 'Archiviste de la mairie.',
    secret: 'Son registre de 1996 a des pages vides. Elle les a écrites elle-même, puis elles se sont effacées.',
    look: { skin: '#d8c0a8', hair: '#c9c9c9', coat: '#4a5a3a', accent: '#c9b458', hairStyle: 'chignon', height: 'adulte', glasses: true },
  },
  {
    id: 'agnes',
    name: 'Agnès Morel',
    role: 'Habitante. Prépare deux bols chaque matin.',
    secret: 'Son fils Théo était dans le train de 23 h 50.',
    look: { skin: '#e0b898', hair: '#5a3a2a', coat: '#5a5a6a', accent: '#a33a3a', hairStyle: 'long', height: 'adulte' },
  },
  {
    id: 'mireille',
    name: 'Dr Mireille Halden',
    role: 'Pharmacienne. Ancienne chercheuse de l’Institut.',
    secret: 'Elle accompagnait les enfants dans le train. Elle est la seule à être revenue.',
    look: { skin: '#e8d0c0', hair: '#f0f0f0', coat: '#d8d8d0', accent: '#4a6a7a', hairStyle: 'court', height: 'adulte', glasses: true },
  },
  {
    id: 'tobias',
    name: 'Tobias Lerne',
    role: 'Chef de gare d’une ligne fermée depuis trente ans.',
    secret: 'Il entend encore le train de 23 h 50. Il n’a jamais fermé le quai.',
    look: { skin: '#c8a080', hair: '#3a3a3a', coat: '#2a3a5a', accent: '#c9b458', hairStyle: 'casquette', height: 'adulte' },
  },
  {
    id: 'nora',
    name: 'Nora',
    role: 'Une enfant en ciré jaune. Voit les Rémanents.',
    secret: 'Elle n’a pas d’ombre. Elle vous l’a dit, mais vous n’avez pas écouté.',
    look: { skin: '#e8c8b0', hair: '#3a2a20', coat: '#c9a83a', accent: '#c9a83a', hairStyle: 'capuche', height: 'enfant' },
  },
  {
    id: 'gilles',
    name: 'Gilles, le facteur',
    role: 'Distribue des lettres à des adresses qui n’existent pas.',
    secret: 'C’est lui qui a déposé la lettre d’Élise. L’expéditeur, c’était vous.',
    look: { skin: '#d0a888', hair: '#6a4a2a', coat: '#3a5a8a', accent: '#c9b458', hairStyle: 'casquette', height: 'adulte' },
  },
  {
    id: 'lys',
    name: 'Madame Lys',
    role: 'Habitante des Cendriers. N’existe plus.',
    secret: 'Son mari travaillait avec Kessin.',
    look: { skin: '#c8ccd0', hair: '#141414', coat: '#1a1a1e', accent: '#8fb3b0', hairStyle: 'voile', height: 'adulte' },
  },
  {
    id: 'elise',
    name: 'Élise',
    role: 'Une fillette en chemise de nuit.',
    secret: 'C’est vous.',
    look: { skin: '#e0d8d0', hair: '#2a2228', coat: '#e8e4dc', accent: '#2a3a6a', hairStyle: 'long', height: 'enfant' },
  },
  {
    id: 'kessin',
    name: 'Aurèle Kessin',
    role: 'Directeur de l’Institut Halden.',
    secret: 'Il a appuyé sur le bouton.',
    look: { skin: '#e8e8e8', hair: '#f0f0f0', coat: '#f0f0f0', accent: '#c94a4a', hairStyle: 'chauve', height: 'adulte', faceless: true },
  },
  {
    id: 'habitant',
    name: 'Habitant',
    role: 'Quelqu’un de Saint-Ormel.',
    secret: '',
    look: { skin: '#d0b098', hair: '#4a3a2a', coat: '#5a4a3a', accent: '#7a6a5a', hairStyle: 'court', height: 'adulte' },
  },
  {
    id: 'silhouette',
    name: '???',
    role: 'Quelque chose qui ressemble à quelqu’un.',
    secret: '',
    look: { skin: '#0c0b10', hair: '#0c0b10', coat: '#0c0b10', accent: '#0c0b10', hairStyle: 'court', height: 'adulte', faceless: true },
  },
  {
    id: 'mineur',
    name: 'Le contremaître',
    role: 'Un mineur couvert de suie. Ne cligne jamais des yeux.',
    secret: 'Il est remonté seul, il y a trente ans.',
    look: { skin: '#8a7a6a', hair: '#1a1a1a', coat: '#3a3530', accent: '#c9b458', hairStyle: 'casquette', height: 'adulte' },
  },
];

export const CHARACTERS: Record<string, CharacterDef> = Object.fromEntries(list.map((c) => [c.id, c]));
