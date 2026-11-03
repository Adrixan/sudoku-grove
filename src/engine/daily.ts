/** Daily puzzle: date and weekday in Europe/Vienna, so every device in Austria gets the same puzzle. */
import type { Difficulty } from './rater.ts';

const TZ = 'Europe/Vienna';

export function viennaDate(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Gentle start into the week, hardest on Sunday. */
const BY_WEEKDAY: Record<string, Difficulty> = {
  Mon: 'leicht',
  Tue: 'leicht',
  Wed: 'mittel',
  Thu: 'mittel',
  Fri: 'schwer',
  Sat: 'schwer',
  Sun: 'experte',
};

export function dailyDifficulty(now: Date = new Date()): Difficulty {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now);
  return BY_WEEKDAY[day] ?? 'mittel';
}

export const dailySeed = (date: string): string => `daily-${date}`;
