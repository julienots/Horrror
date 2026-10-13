import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { newGame } from '../src/core/state';
import { abilityOptions, chooseAbility, playerTurn, startBattle } from '../src/battle/engine';
import { makeCreature } from '../src/systems/creatures';

// Chaque combat imposé par l'histoire doit être gagnable avec une équipe
// plausible à ce stade, sans être une formalité. Les équipes simulées jouent
// avec la même IA que les adversaires, sans utiliser d'objets.
const BOSSES: Array<{ boss: string; level: number; team: Array<[string, number]>; minWin: number; minFainted: number }> = [
  { boss: 'pli', level: 8, team: [['veilleuse', 9], ['mitaine', 7]], minWin: 0.8, minFainted: 0 },
  { boss: 'chien_creux', level: 12, team: [['veilleuse', 11], ['ronceline', 9], ['gribouille', 9]], minWin: 0.6, minFainted: 0.5 },
  { boss: 'mere_cendre', level: 15, team: [['veilleuse', 14], ['palefeu', 12], ['gribouille', 12]], minWin: 0.6, minFainted: 0.5 },
  { boss: 'sonneur', level: 18, team: [['veilleuse', 16], ['main_froide', 16], ['dessin_fini', 15]], minWin: 0.5, minFainted: 1 },
  { boss: 'controleur', level: 20, team: [['veilleuse', 18], ['main_froide', 17], ['dessin_fini', 17], ['coquemort', 16]], minWin: 0.7, minFainted: 0.5 },
  { boss: 'archivore', level: 26, team: [['veilleuse_eveillee', 23], ['main_froide', 22], ['dessin_fini', 22], ['grand_cierge', 22]], minWin: 0.7, minFainted: 1 },
  { boss: 'gardien_blanc', level: 30, team: [['veilleuse_eveillee', 27], ['chien_des_voix', 26], ['grand_cierge', 26], ['ronce_reine', 26]], minWin: 0.7, minFainted: 1 },
];

describe('combats de l’histoire', () => {
  for (const c of BOSSES) {
    it(`${c.boss} (niv. ${c.level}) : gagnable et exigeant`, () => {
      const N = 40;
      let wins = 0;
      let fainted = 0;
      for (let i = 0; i < N; i++) {
        const s = newGame(i + 1);
        for (const [sp, l] of c.team) s.team.push(makeCreature(s, sp, l));
        const b = startBattle(s, { species: c.boss, level: c.level, boss: true, noFlee: true }, new Rng(i * 31 + 5)).battle;
        let t = 0;
        while (!b.outcome && t < 150) {
          if (b.needSwitch) {
            playerTurn(s, b, { kind: 'switch', index: s.team.findIndex((x) => x.hp > 0) });
            continue;
          }
          const ab = chooseAbility(b, 'player');
          const usable = abilityOptions(b).filter((o) => o.usable);
          expect(usable.length).toBeGreaterThan(0); // jamais sans action
          playerTurn(s, b, { kind: 'ability', id: usable.some((o) => o.id === ab.id) ? ab.id : usable[0].id });
          t++;
        }
        expect(b.outcome, 'le combat doit se terminer').not.toBeNull();
        if (b.outcome === 'win') wins++;
        fainted += s.team.filter((x) => x.hp <= 0).length;
      }
      expect(wins / N).toBeGreaterThanOrEqual(c.minWin);
      expect(fainted / N).toBeGreaterThanOrEqual(c.minFainted);
    });
  }
});
