import type { Condition, Dir, EntityDef, ScriptCmd, WarpDef } from '../types';

// Petits constructeurs pour écrire les zones de façon lisible.

export function npc(
  id: string,
  x: number,
  y: number,
  sprite: string,
  script: ScriptCmd[],
  opts: Partial<EntityDef> = {},
): EntityDef {
  return { id, x, y, kind: 'npc', sprite, dir: 'down', solid: true, script, ...opts };
}

export function sign(id: string, x: number, y: number, text: string | ScriptCmd[], opts: Partial<EntityDef> = {}): EntityDef {
  const script = typeof text === 'string' ? [{ say: text }] : text;
  return { id, x, y, kind: 'panneau', solid: true, script, ...opts };
}

/** Objet à ramasser une seule fois. */
export function pickup(
  id: string,
  x: number,
  y: number,
  item: string,
  qty = 1,
  extra: ScriptCmd[] = [],
  when?: Condition,
): EntityDef {
  const flag = `pris_${id}`;
  const cond: Condition = when ? { all: [{ notFlag: flag }, when] } : { notFlag: flag };
  return {
    id,
    x,
    y,
    kind: 'objet',
    solid: true,
    when: cond,
    // `give` échoue proprement si le sac est plein : le drapeau n'est posé
    // que si l'objet a réellement été ajouté (géré par l'interpréteur).
    script: [{ give: item, qty }, { if: { gaveOk: true }, then: [{ setFlag: flag }, ...extra] }],
  };
}

/** Examiner un élément du décor. */
export function look(id: string, x: number, y: number, script: ScriptCmd[] | string, opts: Partial<EntityDef> = {}): EntityDef {
  const s = typeof script === 'string' ? [{ say: script }] : script;
  return { id, x, y, kind: 'declencheur', solid: false, script: s, ...opts };
}

/** Déclencheur au passage (une seule fois si `once`). */
export function trigger(id: string, x: number, y: number, script: ScriptCmd[], once = true, when?: Condition): EntityDef {
  const flag = `vu_${id}`;
  const base: Condition | undefined = once ? { notFlag: flag } : undefined;
  const cond = base && when ? { all: [base, when] } : base ?? when;
  return {
    id,
    x,
    y,
    kind: 'declencheur',
    touch: true,
    solid: false,
    when: cond,
    script: once ? [{ setFlag: flag }, ...script] : script,
  };
}

/** Point de repos : soigne l'équipe et sauvegarde. */
export function rest(id: string, x: number, y: number, label: string): EntityDef {
  return {
    id,
    x,
    y,
    kind: 'panneau',
    solid: true,
    light: 3,
    script: [
      { say: label },
      {
        choice: 'Se reposer un instant ?',
        options: [
          { text: 'Se reposer (soigne et sauvegarde)', then: [{ fade: 'out' }, { heal: true }, { fade: 'in' }, { say: 'Vos Rémanents se rassemblent autour de la lumière.' }, { save: true }] },
          { text: 'Continuer', then: [] },
        ],
      },
    ],
  };
}

export function door(x: number, y: number, to: string, tx: number, ty: number, dir: Dir = 'down', extra: Partial<WarpDef> = {}): WarpDef {
  return { x, y, to, tx, ty, dir, sound: 'porte', ...extra };
}

export function edge(x: number, y: number, to: string, tx: number, ty: number, dir: Dir, extra: Partial<WarpDef> = {}): WarpDef {
  return { x, y, to, tx, ty, dir, sound: 'pas', ...extra };
}

/** Raccourci pour plusieurs tuiles de bord alignées. */
export function edges(xs: number[], ys: number[], to: string, txs: number[], tys: number[], dir: Dir): WarpDef[] {
  const out: WarpDef[] = [];
  const n = Math.max(xs.length, ys.length);
  for (let i = 0; i < n; i++) {
    out.push(edge(xs[i] ?? xs[0], ys[i] ?? ys[0], to, txs[i] ?? txs[0], tys[i] ?? tys[0], dir));
  }
  return out;
}

export const NIGHT: Condition = { time: ['nuit', 'minuit'] };
export const DAY: Condition = { time: ['jour', 'crepuscule'] };
export const MIDNIGHT: Condition = { time: 'minuit' };
