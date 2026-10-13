import type { ZoneDef } from '../types';
import { cendriers, institut, maison_lys, maison_varenne, seuil } from './cendriers';
import { classe_absente, ecole, ecole_couloir, ecole_cour } from './ecole';
import { gare, gare_hall, hopital, hopital_ext, train } from './gare';
import { clairiere, foret, marais, mine } from './nature';
import { maison_morel, mairie, pension, pharmacie, tilleuls9, village } from './village';

const list: ZoneDef[] = [
  village,
  pension,
  mairie,
  pharmacie,
  maison_morel,
  tilleuls9,
  ecole_cour,
  ecole,
  ecole_couloir,
  classe_absente,
  foret,
  clairiere,
  marais,
  mine,
  gare,
  gare_hall,
  hopital_ext,
  hopital,
  train,
  cendriers,
  maison_lys,
  maison_varenne,
  institut,
  seuil,
];

export const ZONES: Record<string, ZoneDef> = Object.fromEntries(list.map((z) => [z.id, z]));
export const ZONE_LIST = list;

export const START = { zone: 'village', x: 16, y: 21, dir: 'up' as const, time: 19 * 60 + 40 };
