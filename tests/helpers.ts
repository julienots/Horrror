import type { BattleOutcome } from '../src/battle/engine';
import type { Dir, EndingId, HorrorFx, Mood, ScriptCmd } from '../src/data/types';
import { ZONES } from '../src/data/zones';
import type { GameState } from '../src/core/state';
import { evalCondition } from '../src/systems/conditions';
import { runScript, type ScriptHost } from '../src/systems/script';
import { activeEntities, warpAt } from '../src/world/map';

/** Hôte de script sans interface, pilotable depuis les tests. */
export class HeadlessHost implements ScriptHost {
  log: string[] = [];
  notes: string[] = [];
  choices: Array<number | string> = [];
  battleResult: BattleOutcome = 'win';
  battles: Array<{ species: string; level: number }> = [];
  codes: string[] = [];
  endingReached: EndingId | null = null;
  chaseResult: 'caught' | 'escaped' = 'escaped';
  saves = 0;

  constructor(public state: GameState) {}

  async say(text: string, who: string, _mood: Mood) {
    this.log.push(`${who ? who + ': ' : ''}${text}`);
  }
  async choose(prompt: string, options: string[]) {
    this.log.push(`? ${prompt} [${options.join(' | ')}]`);
    const c = this.choices.shift();
    if (c === undefined) return 0;
    if (typeof c === 'number') return c;
    const i = options.findIndex((o) => o.includes(c));
    if (i < 0) throw new Error(`Option introuvable « ${c} » dans ${options.join(' | ')}`);
    return i;
  }
  notify(text: string) {
    this.notes.push(text);
  }
  async battle(species: string, level: number) {
    this.battles.push({ species, level });
    return this.battleResult;
  }
  async warp(zone: string, x: number, y: number, dir?: Dir) {
    this.state.player.zone = zone;
    this.state.player.x = x;
    this.state.player.y = y;
    if (dir) this.state.player.dir = dir;
  }
  async fade() {}
  async wait() {}
  sound() {}
  music() {}
  async horror(_fx: HorrorFx) {}
  async codeInput() {
    return this.codes.shift() ?? '0000';
  }
  async ending(id: EndingId) {
    this.endingReached = id;
  }
  save() {
    this.saves++;
  }
  async chase() {
    return this.chaseResult;
  }
  removeEntity() {}
  zoneEternalNight() {
    return !!ZONES[this.state.player.zone]?.eternalNight;
  }
}

/** Interagit avec une entité d'une zone (vérifie qu'elle est présente). */
export async function interact(host: HeadlessHost, zoneId: string, entityId: string, choices: Array<number | string> = []) {
  const zone = ZONES[zoneId];
  if (!zone) throw new Error(`zone ${zoneId}`);
  host.state.player.zone = zoneId;
  const ents = activeEntities(zone, host.state);
  const e = ents.find((x) => x.id === entityId);
  if (!e) throw new Error(`Entité absente : ${zoneId}/${entityId}`);
  host.choices.push(...choices);
  await runScript(e.script ?? [], host.state, host);
  host.choices = [];
}

export function isPresent(state: GameState, zoneId: string, entityId: string): boolean {
  return activeEntities(ZONES[zoneId], state).some((e) => e.id === entityId);
}

/** Entre dans une zone par une porte (vérifie la condition) et joue l'événement d'entrée. */
export async function enter(host: HeadlessHost, fromZone: string, x: number, y: number): Promise<string> {
  const w = warpAt(ZONES[fromZone], x, y);
  if (!w) throw new Error(`Pas de passage en ${fromZone} ${x},${y}`);
  const ok = evalCondition(host.state, w.when, { eternalNight: ZONES[fromZone].eternalNight });
  if (!ok) throw new Error(`Passage verrouillé : ${w.locked ?? fromZone + '→' + w.to}`);
  host.state.player.zone = w.to;
  host.state.player.x = w.tx;
  host.state.player.y = w.ty;
  await enterZoneScripts(host, w.to);
  return w.to;
}

export async function enterZoneScripts(host: HeadlessHost, zoneId: string) {
  const z = ZONES[zoneId];
  if (z.onEnter && (!z.enterOnceFlag || !host.state.flags[z.enterOnceFlag])) {
    if (z.enterOnceFlag) host.state.flags[z.enterOnceFlag] = true;
    await runScript(z.onEnter, host.state, host);
  }
}

export async function touch(host: HeadlessHost, zoneId: string, entityId: string, choices: Array<number | string> = []) {
  return interact(host, zoneId, entityId, choices);
}

export function walkScripts(cmds: ScriptCmd[] | undefined, visit: (c: ScriptCmd) => void) {
  for (const c of cmds ?? []) {
    visit(c);
    if ('choice' in c) for (const o of c.options) walkScripts(o.then, visit);
    if ('if' in c) {
      walkScripts(c.then, visit);
      walkScripts(c.else, visit);
    }
    if ('battle' in c) {
      walkScripts(c.then, visit);
      walkScripts(c.onBond, visit);
      walkScripts(c.onWin, visit);
    }
    if ('codeInput' in c) {
      walkScripts(c.then, visit);
      walkScripts(c.else, visit);
    }
    if ('chase' in c) {
      walkScripts(c.caught, visit);
      walkScripts(c.escaped, visit);
    }
  }
}
