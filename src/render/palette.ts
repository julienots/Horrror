import type { ZoneTheme } from '../data/types';

// Palettes par thème : désaturées, noirs profonds, bleus froids, verts
// maladifs, bruns, et quelques touches de rouge.

export interface ThemePalette {
  grass: [string, string, string];
  tall: [string, string];
  dirt: [string, string, string];
  wall: [string, string, string];
  roof: [string, string, string];
  floor: [string, string, string];
  tileFloor: [string, string, string];
  water: [string, string, string];
  tree: [string, string, string];
  trunk: string;
  accent: string;
  window: string;
  ash: [string, string];
  sky: [string, string];
  void: [string, string];
}

const base: ThemePalette = {
  grass: ['#2f3b2b', '#37442f', '#283325'],
  tall: ['#3e4d33', '#24301f'],
  dirt: ['#4c4236', '#433a30', '#564b3e'],
  wall: ['#45454f', '#3a3a43', '#2c2c33'],
  roof: ['#4a2a2c', '#3c2224', '#5a3436'],
  floor: ['#4a3a2c', '#423326', '#3a2c21'],
  tileFloor: ['#5a5d5c', '#4f5251', '#666968'],
  water: ['#1c2a36', '#22333f', '#2d4252'],
  tree: ['#1f2b1f', '#263425', '#18221a'],
  trunk: '#2e241c',
  accent: '#8a3a3a',
  window: '#c9b458',
  ash: ['#55504b', '#44403c'],
  sky: ['#0d1016', '#1b2028'],
  void: ['#e8e6e1', '#d6d4cf'],
};

export const PALETTES: Record<ZoneTheme, ThemePalette> = {
  village: base,
  interieur: { ...base, wall: ['#4f4038', '#433630', '#2e2420'], floor: ['#54402e', '#4a3828', '#3e2f22'] },
  foret: { ...base, grass: ['#26331f', '#2d3b25', '#1f2a1a'], tall: ['#34452a', '#1c2617'], tree: ['#16211a', '#1c2a20', '#101812'], dirt: ['#3f382c', '#373126', '#474033'] },
  ecole: { ...base, wall: ['#5b5a4c', '#4e4d41', '#3a3930'], floor: ['#4f3d2b', '#463626', '#3c2e20'], tileFloor: ['#5c5f58', '#51544e', '#686b63'], roof: ['#3b3f4a', '#30343d', '#474c58'] },
  hopital: { ...base, wall: ['#5d6766', '#525b5a', '#3d4544'], tileFloor: ['#6b7473', '#606867', '#7a8382'], roof: ['#3c4446', '#30373a', '#4a5356'], grass: ['#2c3428', '#323b2c', '#262d22'] },
  gare: { ...base, roof: ['#2e3644', '#262d39', '#3a4354'], dirt: ['#46423c', '#3e3a35', '#504c45'] },
  marais: { ...base, grass: ['#2c3528', '#323c2c', '#252d22'], tall: ['#3d4a30', '#222b1d'], water: ['#16201f', '#1b2726', '#26332f'] },
  mine: { ...base, wall: ['#2f2a25', '#26221e', '#1a1714'], dirt: ['#3a332c', '#322c26', '#423a32'] },
  cendriers: { ...base, grass: ['#2a2d2f', '#303437', '#232628'], tall: ['#3a3f42', '#1e2123'], roof: ['#3a2a2e', '#2e2125', '#47343a'], wall: ['#3d3c44', '#33323a', '#26252c'], dirt: ['#3b3836', '#33302e', '#45413e'] },
  institut: { ...base, wall: ['#5a6066', '#4e5359', '#3a3e43'], tileFloor: ['#6f7478', '#64696d', '#7d8286'] },
  seuil: { ...base, tileFloor: ['#dcdad5', '#cfccc6', '#e8e6e1'], floor: ['#bdb5aa', '#b0a89c', '#c9c1b6'], grass: ['#b9c0b2', '#aeb5a7', '#c6cdbf'], dirt: ['#c9c1b2', '#bdb5a6', '#d4ccbd'] },
  train: { ...base, tileFloor: ['#3a3430', '#332e2a', '#443d38'], wall: ['#4a3a32', '#40322b', '#2e241f'] },
};
