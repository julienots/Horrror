import type { TimePhase } from '../data/types';

export const MINUTES_PER_DAY = 1440;

/** Phase de la journée pour une heure donnée (minutes depuis minuit). */
export function phaseOf(minutes: number, eternalNight = false): TimePhase {
  if (eternalNight) return 'nuit';
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  // « Minuit » couvre le passage du train de 23 h 50 : de 23 h 30 à 1 h.
  if (m >= 23 * 60 + 30 || m < 60) return 'minuit';
  if (m < 6 * 60) return 'nuit';
  if (m < 19 * 60) return 'jour';
  if (m < 22 * 60) return 'crepuscule';
  return 'nuit';
}

export function formatTime(minutes: number): string {
  const m = ((Math.floor(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')} h ${String(mm).padStart(2, '0')}`;
}

export const PHASE_LABEL: Record<TimePhase, string> = {
  jour: 'Jour',
  crepuscule: 'Crépuscule',
  nuit: 'Nuit',
  minuit: 'Minuit',
};

/** Luminosité ambiante 0 (noir) → 1 (plein jour). */
export function ambientLight(minutes: number, eternalNight = false): number {
  if (eternalNight) return 0.34;
  const m = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const h = m / 60;
  if (h >= 8 && h < 18) return 1;
  if (h >= 18 && h < 22) return 1 - ((h - 18) / 4) * 0.7;
  if (h >= 6 && h < 8) return 0.3 + ((h - 6) / 2) * 0.7;
  return 0.22;
}
