import { CREATURES } from '../data/creatures';
import { ITEMS } from '../data/items';
import { ENDINGS } from '../data/story';
import type { Dir, EndingId, HorrorFx, Mood, ScriptCmd } from '../data/types';
import type { GameState } from '../core/state';
import { codexOf } from '../core/state';
import { evalCondition } from './conditions';
import { addBonded, healTeam, makeCreature } from './creatures';
import { addFailMessage, addItem, removeItem } from './inventory';
import { addClue, completeQuest, keyClueCount, setStage } from './quests';
import type { BattleOutcome } from '../battle/engine';

/** Ce que l'interpréteur demande à la présentation (UI réelle ou hôte de test). */
export interface ScriptHost {
  say(text: string, who: string, mood: Mood): Promise<void>;
  choose(prompt: string, options: string[], who: string): Promise<number>;
  notify(text: string): void;
  battle(species: string, level: number, opts: { boss: boolean; noFlee: boolean }): Promise<BattleOutcome>;
  warp(zone: string, x: number, y: number, dir?: Dir): Promise<void>;
  fade(dir: 'out' | 'in'): Promise<void>;
  wait(ms: number): Promise<void>;
  sound(id: string): void;
  music(id: string | null): void;
  horror(fx: HorrorFx): Promise<void>;
  codeInput(prompt: string, length: number): Promise<string>;
  ending(id: EndingId): Promise<void>;
  save(): void;
  chase(species: string, from: [number, number], escape: [number, number, number, number]): Promise<'caught' | 'escaped'>;
  removeEntity(id: string): void;
  zoneEternalNight(): boolean;
}

export interface ScriptCtx {
  gaveOk: boolean;
  aborted: boolean; // un combat perdu interrompt le script en cours
}

export function interpolate(state: GameState, text: string): string {
  return text.replace(/\{cles\}/g, String(keyClueCount(state))).replace(/\{nom\}/g, state.player.name);
}

/** Exécute une liste de commandes. Ne laisse jamais l'état à moitié modifié : chaque commande est atomique. */
export async function runScript(cmds: ScriptCmd[], state: GameState, host: ScriptHost, ctx: ScriptCtx = { gaveOk: false, aborted: false }): Promise<ScriptCtx> {
  for (const cmd of cmds) {
    if (ctx.aborted) break;
    await runCmd(cmd, state, host, ctx);
  }
  return ctx;
}

function cond(state: GameState, host: ScriptHost, ctx: ScriptCtx, c: Parameters<typeof evalCondition>[1]) {
  return evalCondition(state, c, { eternalNight: host.zoneEternalNight(), gaveOk: ctx.gaveOk });
}

async function runCmd(cmd: ScriptCmd, state: GameState, host: ScriptHost, ctx: ScriptCtx): Promise<void> {
  if ('say' in cmd) {
    await host.say(interpolate(state, cmd.say), cmd.who ?? '', cmd.mood ?? 'neutre');
    return;
  }
  if ('choice' in cmd) {
    const opts = cmd.options.filter((o) => cond(state, host, ctx, o.when));
    if (!opts.length) return;
    const i = await host.choose(interpolate(state, cmd.choice), opts.map((o) => interpolate(state, o.text)), cmd.who ?? '');
    const picked = opts[Math.max(0, Math.min(opts.length - 1, i))];
    await runScript(picked.then, state, host, ctx);
    return;
  }
  if ('if' in cmd) {
    if (cond(state, host, ctx, cmd.if)) await runScript(cmd.then, state, host, ctx);
    else if (cmd.else) await runScript(cmd.else, state, host, ctx);
    return;
  }
  if ('setFlag' in cmd) {
    if (cmd.value === false) delete state.flags[cmd.setFlag];
    else state.flags[cmd.setFlag] = true;
    return;
  }
  if ('counter' in cmd) {
    const cur = state.counters[cmd.counter] ?? 0;
    state.counters[cmd.counter] = cmd.set !== undefined ? cmd.set : cur + (cmd.add ?? 1);
    return;
  }
  if ('give' in cmd) {
    const qty = cmd.qty ?? 1;
    const def = ITEMS[cmd.give];
    const res = addItem(state, cmd.give, qty);
    ctx.gaveOk = res.ok;
    if (res.ok) {
      if (!cmd.silent) {
        host.sound('objet');
        host.notify(`Obtenu : ${def?.name ?? cmd.give}${qty > 1 ? ` ×${qty}` : ''}`);
      }
    } else if (res.reason === 'unique') {
      // Objet unique déjà possédé : on considère la remise comme faite (aucune duplication).
      ctx.gaveOk = true;
    } else {
      await host.say(addFailMessage(res.reason, def?.name ?? cmd.give), '', 'neutre');
    }
    return;
  }
  if ('take' in cmd) {
    removeItem(state, cmd.take, cmd.qty ?? 1);
    return;
  }
  if ('clue' in cmd) {
    const msg = addClue(state, cmd.clue);
    if (msg) {
      host.sound('indice');
      host.notify(msg);
    }
    return;
  }
  if ('quest' in cmd) {
    const ev = setStage(state, cmd.quest, cmd.stage);
    if (ev) host.notify(ev.text);
    return;
  }
  if ('questDone' in cmd) {
    const ev = completeQuest(state, cmd.questDone);
    if (ev) {
      host.sound('quete');
      host.notify(ev.text);
    }
    return;
  }
  if ('battle' in cmd) {
    const outcome = await host.battle(cmd.battle, cmd.level, { boss: !!cmd.boss, noFlee: !!cmd.noFlee });
    if (outcome === 'lose') {
      ctx.aborted = true;
      return;
    }
    if ((outcome === 'bond' || outcome === 'pacify') && cmd.onBond) await runScript(cmd.onBond, state, host, ctx);
    if (outcome === 'win' && cmd.onWin) await runScript(cmd.onWin, state, host, ctx);
    if (cmd.then) await runScript(cmd.then, state, host, ctx);
    return;
  }
  if ('pacify' in cmd) {
    const e = codexOf(state, cmd.pacify);
    e.seen = true;
    e.pacified = true;
    state.morality.light += 1;
    const res = addItem(state, 'fragment_memoire', 1);
    if (res.ok) host.notify('Obtenu : Fragment de mémoire');
    host.notify(`${CREATURES[cmd.pacify]?.name ?? 'Le Rémanent'} est apaisé.`);
    return;
  }
  if ('bondDirect' in cmd) {
    const c = makeCreature(state, cmd.bondDirect, cmd.level);
    const dest = addBonded(state, c);
    host.sound('lien');
    const name = CREATURES[cmd.bondDirect]?.name ?? cmd.bondDirect;
    host.notify(dest === 'equipe' ? `${name} rejoint votre équipe.` : dest === 'reliquaire' ? `${name} attend dans le Reliquaire.` : `${name} vous suit, invisible.`);
    return;
  }
  if ('warp' in cmd) {
    await host.warp(cmd.warp, cmd.x, cmd.y, cmd.dir);
    return;
  }
  if ('sound' in cmd) {
    host.sound(cmd.sound);
    return;
  }
  if ('music' in cmd) {
    host.music(cmd.music);
    return;
  }
  if ('horror' in cmd) {
    await host.horror(cmd.horror);
    return;
  }
  if ('wait' in cmd) {
    await host.wait(cmd.wait);
    return;
  }
  if ('fade' in cmd) {
    await host.fade(cmd.fade);
    return;
  }
  if ('setTime' in cmd) {
    // Dormir fait toujours avancer le temps (jamais en arrière).
    if (cmd.setTime <= state.time) state.day += 1;
    state.time = cmd.setTime;
    return;
  }
  if ('morality' in cmd) {
    if (cmd.morality === 'light') state.morality.light += cmd.amount;
    else state.morality.shadow += cmd.amount;
    return;
  }
  if ('heal' in cmd) {
    healTeam(state);
    host.sound('soin');
    return;
  }
  if ('codeInput' in cmd) {
    const code = await host.codeInput(cmd.codeInput, cmd.correct.length);
    if (code === cmd.correct) await runScript(cmd.then, state, host, ctx);
    else if (cmd.else) await runScript(cmd.else, state, host, ctx);
    return;
  }
  if ('ending' in cmd) {
    if (ENDINGS[cmd.ending] && !state.endings.includes(cmd.ending)) state.endings.push(cmd.ending);
    await host.ending(cmd.ending);
    ctx.aborted = true;
    return;
  }
  if ('save' in cmd) {
    host.save();
    return;
  }
  if ('npcForget' in cmd) {
    state.flags[`oubli_${cmd.npcForget}`] = true;
    return;
  }
  if ('read' in cmd) {
    const def = ITEMS[cmd.read];
    if (def?.document) await host.say(def.document, '', 'neutre');
    return;
  }
  if ('removeEntity' in cmd) {
    host.removeEntity(cmd.removeEntity);
    return;
  }
  if ('chase' in cmd) {
    const r = await host.chase(cmd.chase, cmd.from, cmd.escape);
    await runScript(r === 'caught' ? cmd.caught : cmd.escaped, state, host, ctx);
    return;
  }
}

/** Lecture d'un document de l'inventaire : texte + éventuel indice. */
export function readDocument(state: GameState, itemId: string): { text: string; clueMsg: string | null } {
  const def = ITEMS[itemId];
  if (!def?.document) return { text: def?.description ?? '', clueMsg: null };
  if (!state.readDocs.includes(itemId)) state.readDocs.push(itemId);
  let clueMsg: string | null = null;
  if (def.clue && evalCondition(state, def.clueWhen)) clueMsg = addClue(state, def.clue);
  const alt = def.documentAlt?.find((a) => evalCondition(state, a.when));
  return { text: alt?.text ?? def.document, clueMsg };
}
