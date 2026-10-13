import { BAG_SLOTS, ITEMS, isUnique, maxStackOf } from '../data/items';
import type { ItemCategory } from '../data/types';
import type { CreatureInstance, GameState } from '../core/state';
import { healCreature, maxEnergy, maxHp } from './creatures';

export type AddResult =
  | { ok: true; added: number }
  | { ok: false; reason: 'inconnu' | 'unique' | 'pile' | 'sac'; added: number };

export function count(state: GameState, id: string): number {
  return state.inventory[id] ?? 0;
}

export function has(state: GameState, id: string, qty = 1): boolean {
  return count(state, id) >= qty;
}

/** Emplacements occupés par des objets non uniques (les clés/documents ne prennent pas de place). */
export function usedSlots(state: GameState): number {
  return Object.entries(state.inventory).filter(([id, n]) => n > 0 && !isUnique(id)).length;
}

/**
 * Ajoute un objet. Ne duplique jamais un objet unique et n'ajoute rien
 * partiellement : soit la quantité entière est ajoutée, soit rien.
 */
export function addItem(state: GameState, id: string, qty = 1): AddResult {
  const def = ITEMS[id];
  if (!def || qty <= 0) return { ok: false, reason: 'inconnu', added: 0 };
  const cur = count(state, id);
  if (isUnique(id)) {
    if (cur >= 1) return { ok: false, reason: 'unique', added: 0 };
    state.inventory[id] = 1;
    return { ok: true, added: 1 };
  }
  const max = maxStackOf(id);
  if (cur + qty > max) return { ok: false, reason: 'pile', added: 0 };
  if (cur === 0 && usedSlots(state) >= BAG_SLOTS) return { ok: false, reason: 'sac', added: 0 };
  state.inventory[id] = cur + qty;
  return { ok: true, added: qty };
}

export function removeItem(state: GameState, id: string, qty = 1): boolean {
  const cur = count(state, id);
  if (qty <= 0 || cur < qty) return false;
  const left = cur - qty;
  if (left <= 0) delete state.inventory[id];
  else state.inventory[id] = left;
  return true;
}

export function addFailMessage(reason: string, name: string): string {
  switch (reason) {
    case 'unique':
      return `Vous avez déjà : ${name}.`;
    case 'pile':
      return `Vous ne pouvez pas porter davantage de « ${name} ». L’objet reste là où il est.`;
    case 'sac':
      return `Votre sac est plein. « ${name} » reste là où il est.`;
    default:
      return 'Cet objet semble ne pas exister.';
  }
}

export const CATEGORY_LABEL: Record<ItemCategory, string> = {
  soin: 'Soins',
  lien: 'Lien',
  cle: 'Clés',
  outil: 'Outils',
  document: 'Documents',
  enquete: 'Enquête',
  equipement: 'Équipement',
  quete: 'Quête',
};

export function itemsByCategory(state: GameState): Array<[ItemCategory, Array<[string, number]>]> {
  const cats = Object.keys(CATEGORY_LABEL) as ItemCategory[];
  return cats
    .map((cat) => [cat, Object.entries(state.inventory).filter(([id, n]) => n > 0 && ITEMS[id]?.category === cat)] as [ItemCategory, Array<[string, number]>])
    .filter(([, list]) => list.length > 0);
}

export type UseResult = { ok: boolean; message: string };

/** Utilise un objet sur une créature (hors combat ou en combat). Consomme l'objet seulement en cas d'effet. */
export function useItemOn(state: GameState, id: string, target: CreatureInstance | undefined, context: 'combat' | 'exploration'): UseResult {
  const def = ITEMS[id];
  if (!def || !has(state, id)) return { ok: false, message: 'Vous n’en avez pas.' };
  if (!def.usableIn?.includes(context)) return { ok: false, message: context === 'combat' ? 'Inutilisable en combat.' : 'Inutilisable maintenant.' };
  const e = def.effect;
  if (!e) return { ok: false, message: 'Rien ne se passe.' };
  if (e.kind === 'repel') {
    state.repelSteps = Math.max(state.repelSteps, e.steps);
    removeItem(state, id);
    return { ok: true, message: 'Une fumée grise vous entoure. Les Rémanents faibles se tiendront à l’écart.' };
  }
  if (!target) return { ok: false, message: 'Choisissez un Rémanent.' };
  switch (e.kind) {
    case 'heal': {
      if (target.hp <= 0) return { ok: false, message: 'Il est dissipé. Il faut d’abord le rappeler.' };
      if (target.hp >= maxHp(target)) return { ok: false, message: 'Ses PV sont déjà au maximum.' };
      const before = target.hp;
      target.hp = Math.min(maxHp(target), target.hp + e.amount);
      removeItem(state, id);
      return { ok: true, message: `+${target.hp - before} PV.` };
    }
    case 'healFull': {
      if (target.hp <= 0) return { ok: false, message: 'Il est dissipé. Il faut d’abord le rappeler.' };
      if (target.hp >= maxHp(target)) return { ok: false, message: 'Ses PV sont déjà au maximum.' };
      target.hp = maxHp(target);
      removeItem(state, id);
      return { ok: true, message: 'PV entièrement restaurés.' };
    }
    case 'energy': {
      if (target.hp <= 0) return { ok: false, message: 'Il est dissipé.' };
      if (target.energy >= maxEnergy(target)) return { ok: false, message: 'Son énergie est déjà pleine.' };
      target.energy = Math.min(maxEnergy(target), target.energy + e.amount);
      removeItem(state, id);
      return { ok: true, message: `+${e.amount} énergie.` };
    }
    case 'cure': {
      // Les statuts n'existent qu'en combat ; hors combat, le sel n'a pas d'effet.
      if (context !== 'combat') return { ok: false, message: 'Aucun statut à chasser.' };
      removeItem(state, id);
      return { ok: true, message: 'Les statuts sont chassés.' };
    }
    case 'revive': {
      if (target.hp > 0) return { ok: false, message: 'Il n’est pas dissipé.' };
      target.hp = Math.max(1, Math.floor(maxHp(target) * e.fraction));
      removeItem(state, id);
      return { ok: true, message: 'Il se reforme, pâle mais présent.' };
    }
    case 'xp':
      return { ok: false, message: 'À utiliser depuis le menu Équipe.' };
    case 'bond':
      return { ok: false, message: 'À utiliser pendant un combat.' };
  }
  return { ok: false, message: 'Rien ne se passe.' };
}

/** Équipe un objet : le retire de l'inventaire ; l'ancien objet y retourne. Jamais de perte ni de duplication. */
export function equipItem(state: GameState, c: CreatureInstance, id: string): UseResult {
  const def = ITEMS[id];
  if (!def?.equip) return { ok: false, message: 'Cet objet ne se tient pas.' };
  if (!has(state, id)) return { ok: false, message: 'Vous ne l’avez pas.' };
  removeItem(state, id);
  if (c.equip) {
    const back = addItem(state, c.equip, 1);
    if (!back.ok) {
      // Impossible de rendre l'ancien objet : on annule.
      addItem(state, id, 1);
      return { ok: false, message: 'Impossible de reprendre l’objet actuel.' };
    }
  }
  c.equip = id;
  return { ok: true, message: `${def.name} est maintenant tenu.` };
}

export function unequipItem(state: GameState, c: CreatureInstance): UseResult {
  if (!c.equip) return { ok: false, message: 'Rien à retirer.' };
  const res = addItem(state, c.equip, 1);
  if (!res.ok) return { ok: false, message: 'Impossible : sac plein.' };
  c.equip = undefined;
  return { ok: true, message: 'Objet retiré.' };
}

export { healCreature };
