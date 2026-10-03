/** Seasons in their yearly order. */
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

export const MINUTES_PER_DAY = 24 * 60;
export const DAYS_PER_SEASON = 3;

/** An in-game moment. `minutes` count from day 1 00:00 (docs/decisions.md D8). */
export interface WorldTime {
  readonly minutes: number;
  readonly day: number;
  readonly minuteOfDay: number;
  readonly season: Season;
  readonly timeOfDay: TimeOfDay;
}

/**
 * The same rule as the server's `WorldTime`: seasons last three in-game days, and the times of day are
 * morning 05:00–09:59, day 10:00–17:59, evening 18:00–21:59, night 22:00–04:59.
 */
export function worldTimeAt(minutes: number): WorldTime {
  const whole = Math.floor(minutes);
  const day = Math.floor(whole / MINUTES_PER_DAY) + 1;
  const minuteOfDay = whole % MINUTES_PER_DAY;
  const season = SEASONS[Math.floor((day - 1) / DAYS_PER_SEASON) % SEASONS.length];
  const hour = Math.floor(minuteOfDay / 60);
  const timeOfDay: TimeOfDay =
    hour >= 5 && hour < 10
      ? 'morning'
      : hour >= 10 && hour < 18
        ? 'day'
        : hour >= 18 && hour < 22
          ? 'evening'
          : 'night';
  return { minutes: whole, day, minuteOfDay, season, timeOfDay };
}
