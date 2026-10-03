import { Season, TimeOfDay, worldTimeAt } from './world-time';

describe('worldTimeAt', () => {
  // The same cases as the server's WorldTimeTests: real seconds since the save's creation, where one
  // real second is one in-game minute and the save starts at minute 480 (day 1, 08:00).
  const cases: [number, number, number, number, Season, TimeOfDay][] = [
    [0, 480, 1, 480, 'spring', 'morning'],
    [119, 599, 1, 599, 'spring', 'morning'],
    [120, 600, 1, 600, 'spring', 'day'],
    [600, 1080, 1, 1080, 'spring', 'evening'],
    [839, 1319, 1, 1319, 'spring', 'evening'],
    [840, 1320, 1, 1320, 'spring', 'night'],
    [1260, 1740, 2, 300, 'spring', 'morning'],
    [3839, 4319, 3, 1439, 'spring', 'night'],
    [3840, 4320, 4, 0, 'summer', 'night'],
    [4320, 4800, 4, 480, 'summer', 'morning'],
    [12960, 13440, 10, 480, 'winter', 'morning'],
    [17280, 17760, 13, 480, 'spring', 'morning'],
  ];

  it.each(cases)(
    'after %i s: minute %i, day %i, minute of day %i, %s, %s',
    (seconds, minutes, day, minuteOfDay, season, timeOfDay) => {
      expect(worldTimeAt(480 + seconds)).toEqual({ minutes, day, minuteOfDay, season, timeOfDay });
    },
  );

  it('ignores fractions of a minute', () => {
    expect(worldTimeAt(599.9).timeOfDay).toBe('morning');
  });
});
