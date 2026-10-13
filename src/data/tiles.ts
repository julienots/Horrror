// Légende des tuiles. L'apparence dépend du thème de la zone ;
// les propriétés (collision, son de pas, rencontres) sont fixes.

export type Ground = 'herbe' | 'terre' | 'bois' | 'pierre' | 'eau' | 'carrelage' | 'cendre' | 'metal' | 'vide';

export interface TileDef {
  ch: string;
  name: string;
  solid: boolean;
  ground: Ground;
  encounter?: boolean;
  light?: number; // émet de la lumière (rayon en tuiles)
  tall?: boolean; // dessiné au-dessus du joueur partiellement
}

const defs: TileDef[] = [
  { ch: '.', name: 'chemin', solid: false, ground: 'terre' },
  { ch: ',', name: 'herbe', solid: false, ground: 'herbe' },
  { ch: '"', name: 'herbes hautes', solid: false, ground: 'herbe', encounter: true },
  { ch: '#', name: 'mur', solid: true, ground: 'pierre' },
  { ch: 'R', name: 'toit', solid: true, ground: 'pierre' },
  { ch: 'T', name: 'arbre', solid: true, ground: 'herbe', tall: true },
  { ch: 'W', name: 'eau profonde', solid: true, ground: 'eau' },
  { ch: 'w', name: 'eau peu profonde', solid: false, ground: 'eau', encounter: true },
  { ch: '=', name: 'plancher', solid: false, ground: 'bois' },
  { ch: '_', name: 'carrelage', solid: false, ground: 'carrelage' },
  { ch: '+', name: 'tapis', solid: false, ground: 'bois' },
  { ch: 'D', name: 'porte', solid: false, ground: 'bois' },
  { ch: 'S', name: 'escalier', solid: false, ground: 'pierre' },
  { ch: 'f', name: 'clôture', solid: true, ground: 'bois' },
  { ch: 'x', name: 'gouffre', solid: true, ground: 'vide' },
  { ch: 'r', name: 'rails', solid: true, ground: 'metal' },
  { ch: '-', name: 'quai', solid: false, ground: 'pierre' },
  { ch: 'k', name: 'bureau', solid: true, ground: 'bois' },
  { ch: 'b', name: 'lit', solid: true, ground: 'bois' },
  { ch: 'l', name: 'étagère', solid: true, ground: 'bois' },
  { ch: 'm', name: 'miroir', solid: true, ground: 'pierre' },
  { ch: 'p', name: 'réverbère', solid: true, ground: 'metal', light: 3 },
  { ch: 'g', name: 'tombe', solid: true, ground: 'pierre' },
  { ch: 'o', name: 'rocher', solid: true, ground: 'pierre' },
  { ch: 'a', name: 'cendres', solid: false, ground: 'cendre' },
  { ch: ':', name: 'cendres hautes', solid: false, ground: 'cendre', encounter: true },
  { ch: 'C', name: 'comptoir', solid: true, ground: 'bois' },
  { ch: 'P', name: 'pilier', solid: true, ground: 'pierre' },
  { ch: 'L', name: 'casier', solid: true, ground: 'metal' },
  { ch: 'v', name: 'blanc', solid: true, ground: 'vide' },
  { ch: 'u', name: 'sol blanc', solid: false, ground: 'vide', encounter: true },
  { ch: 'n', name: 'galerie', solid: false, ground: 'pierre', encounter: true },
  { ch: 'z', name: 'machine', solid: true, ground: 'metal', light: 1 },
  { ch: 'c', name: 'chaise', solid: true, ground: 'bois' },
];

export const TILES: Record<string, TileDef> = Object.fromEntries(defs.map((d) => [d.ch, d]));

export function tileAt(ch: string | undefined): TileDef {
  return (ch && TILES[ch]) || TILES['#'];
}
