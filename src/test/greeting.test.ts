import { describe, it, expect } from 'vitest';
import {
  easterSunday,
  firstName,
  GREETING_IDS,
  greetingCandidates,
  holidayOn,
  pickGreeting,
  splitGreeting,
  type GreetingContext,
} from '../utils/greeting';
import { UI_TEXT } from '../i18n/translations';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const context = (now: Date, extra: Partial<GreetingContext> = {}): GreetingContext => ({
  now,
  season: 'autumn',
  unseenRecipes: 0,
  daysAway: 1,
  ...extra,
});

describe('greeting', () => {
  it('greets by the first name only', () => {
    expect(firstName('Peter G.')).toBe('Peter');
    expect(firstName('  Ciocia Zosia ')).toBe('Ciocia');
    expect(firstName('Wanda')).toBe('Wanda');
    expect(firstName('p.gzowski33@gmail.com')).toBe('P');
    expect(firstName('raye@example.com')).toBe('Raye');
  });

  it('finds Easter by the Gregorian computus', () => {
    expect(easterSunday(2024)).toEqual(new Date(2024, 2, 31));
    expect(easterSunday(2025)).toEqual(new Date(2025, 3, 20));
    expect(easterSunday(2026)).toEqual(new Date(2026, 3, 5));
    expect(easterSunday(2027)).toEqual(new Date(2027, 2, 28));
  });

  it("knows the family's holidays", () => {
    expect(holidayOn(at(2026, 12, 24))).toBe('wigilia');
    expect(holidayOn(at(2026, 12, 25))).toBe('christmas');
    expect(holidayOn(at(2026, 12, 26))).toBe('christmas');
    expect(holidayOn(at(2027, 1, 1))).toBe('newYear');
    expect(holidayOn(at(2026, 4, 5))).toBe('easter');
    expect(holidayOn(at(2026, 4, 6))).toBe('easter');
    // Tłusty Czwartek: the Thursday before Ash Wednesday.
    expect(holidayOn(at(2026, 2, 12))).toBe('fatThursday');
    expect(holidayOn(at(2025, 2, 27))).toBe('fatThursday');
    // The fourth Thursday of November.
    expect(holidayOn(at(2026, 11, 26))).toBe('thanksgiving');
    expect(holidayOn(at(2026, 11, 19))).toBeNull();
    expect(holidayOn(at(2026, 10, 1))).toBeNull();
  });

  it('fits the time of day', () => {
    expect(greetingCandidates(context(at(2026, 10, 1, 7)))).toContain('goodMorning');
    expect(greetingCandidates(context(at(2026, 10, 1, 19)))).toContain('goodEvening');
    expect(greetingCandidates(context(at(2026, 10, 1, 19)))).not.toContain('goodMorning');
    expect(greetingCandidates(context(at(2026, 10, 1, 1)))).toEqual(['midnightSnack', 'stillUp']);
    // Not "good afternoon" before noon.
    expect(greetingCandidates(context(at(2026, 10, 1, 11)))).not.toContain('goodAfternoon');
  });

  it('adds the season, the weekend and new recipes by day', () => {
    // Saturday 3 October 2026, early afternoon.
    const ids = greetingCandidates(context(at(2026, 10, 3, 13), { unseenRecipes: 2 }));
    expect(ids).toEqual(expect.arrayContaining(['seasonAutumn', 'weekendBaking', 'newInBox']));
    expect(greetingCandidates(context(at(2026, 1, 14, 13), { season: 'winter' }))).toContain(
      'seasonWinter',
    );
  });

  it('puts a holiday, then a return after days away, before everything else', () => {
    expect(greetingCandidates(context(at(2026, 12, 24, 19), { daysAway: 9 }))).toEqual(['wigilia']);
    expect(greetingCandidates(context(at(2026, 10, 1, 19), { daysAway: 5 }))).toEqual([
      'welcomeBack',
    ]);
    expect(greetingCandidates(context(at(2026, 10, 1, 19), { daysAway: null }))).not.toContain(
      'welcomeBack',
    );
  });

  it('never repeats the last greeting where there is another', () => {
    const evening = context(at(2026, 10, 1, 23), { lastId: 'midnightSnack' });
    for (const random of [0, 0.3, 0.6, 0.99]) {
      expect(pickGreeting(evening, random)).toBe('stillUp');
    }
    // A holiday has only its own.
    expect(pickGreeting(context(at(2026, 12, 25), { lastId: 'christmas' }), 0.5)).toBe('christmas');
  });

  it('has words with one place for the name, in both languages', () => {
    for (const language of ['en', 'pl'] as const) {
      for (const id of GREETING_IDS) {
        const words = UI_TEXT[language].greetings[id];
        expect(words.split('{name}')).toHaveLength(2);
      }
    }
    expect(splitGreeting('Good evening, {name}', 'Peter')).toEqual({
      before: 'Good evening, ',
      name: 'Peter',
      after: '',
    });
    expect(splitGreeting('Still up, {name}?', 'Peter').after).toBe('?');
  });
});
