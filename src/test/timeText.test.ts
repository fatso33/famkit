import { describe, it, expect } from 'vitest';
import { parseDuration, shownTime, timesFromText, timesTotal } from '../utils/timeText';
import { UI_TEXT } from '../i18n/translations';

describe('parseDuration', () => {
  it('reads minutes, hours and both, as people type them', () => {
    expect(parseDuration('20 min')).toBe(20);
    expect(parseDuration('45')).toBe(45);
    expect(parseDuration('1 h')).toBe(60);
    expect(parseDuration('1 h 10')).toBe(70);
    expect(parseDuration('1h10')).toBe(70);
    expect(parseDuration('1 hour 10 minutes')).toBe(70);
    expect(parseDuration('1:10')).toBe(70);
    expect(parseDuration('1½ h')).toBe(90);
    expect(parseDuration('1.5 hours')).toBe(90);
  });

  it('reads Polish', () => {
    expect(parseDuration('20 minut')).toBe(20);
    expect(parseDuration('1 godz. 10 min')).toBe(70);
    expect(parseDuration('1,5 godziny')).toBe(90);
    expect(parseDuration('pół godziny')).toBe(30);
    expect(parseDuration('półtorej godziny')).toBe(90);
    expect(parseDuration('2 dni')).toBe(2 * 24 * 60);
    expect(parseDuration('1 dzień')).toBe(24 * 60);
    expect(parseDuration('przez noc')).toBe(480);
    // As the app itself writes it.
    expect(parseDuration('1g 20m')).toBe(80);
    expect(parseDuration('~45m')).toBe(45);
  });

  it('reads words and days', () => {
    expect(parseDuration('overnight')).toBe(480);
    expect(parseDuration('half an hour')).toBe(30);
    expect(parseDuration('2 days')).toBe(2 * 24 * 60);
    expect(parseDuration('1 day')).toBe(24 * 60);
  });

  it('takes the middle of a range', () => {
    expect(parseDuration('20-30 min')).toBe(25);
    expect(parseDuration('1 to 2 hours')).toBe(90);
  });

  it("is null for what isn't a time", () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('   ')).toBeNull();
    expect(parseDuration('until golden')).toBeNull();
    expect(parseDuration('a while')).toBeNull();
  });
});

describe('shownTime', () => {
  const en = UI_TEXT.en;
  const pl = UI_TEXT.pl;

  it('shows a typed number of minutes in the app’s own way', () => {
    expect(shownTime({ text: '1 h 10', minutes: 70 }, en)).toBe('1h 10m');
    expect(shownTime({ text: '45', minutes: 45 }, en)).toBe('45m');
    expect(shownTime({ text: '1:10', minutes: 70 }, pl)).toBe('1g 10m');
  });

  it('shows whole days as days, with Polish plurals', () => {
    expect(shownTime({ text: '2 days', minutes: 2880 }, en)).toBe('2 days');
    expect(shownTime({ text: '1 day', minutes: 1440 }, en)).toBe('1 day');
    expect(shownTime({ text: '1 dzień', minutes: 1440 }, pl)).toBe('1 dzień');
    expect(shownTime({ text: '2 dni', minutes: 2880 }, pl)).toBe('2 dni');
    expect(shownTime({ text: '5 dni', minutes: 7200 }, pl)).toBe('5 dni');
  });

  it('keeps words and ranges as they were typed', () => {
    expect(shownTime({ text: 'overnight', minutes: 480 }, en)).toBe('overnight');
    expect(shownTime({ text: ' przez noc ', minutes: 480 }, pl)).toBe('przez noc');
    expect(shownTime({ text: '20–30 min', minutes: 25 }, en)).toBe('20–30 min');
    expect(shownTime({ text: 'until golden', minutes: null }, en)).toBe('until golden');
  });
});

describe('typed times', () => {
  const en = UI_TEXT.en;

  it('parses each typed time once, keeping the words', () => {
    expect(timesFromText({ prep: '20 min', cook: '', rest: 'overnight' })).toEqual({
      prep: { text: '20 min', minutes: 20 },
      rest: { text: 'overnight', minutes: 480 },
    });
    expect(timesFromText({ prep: ' ', cook: '', rest: '' })).toBeUndefined();
  });

  it('totals prep and cook, with the rest after a plus', () => {
    const times = timesFromText({ prep: '30 min', cook: '50 min', rest: 'overnight' })!;
    expect(timesTotal(times, en)).toEqual({ minutes: 30 + 50 + 480, label: '1h 20m + overnight' });
    expect(timesTotal(timesFromText({ prep: '', cook: '', rest: '2 days' })!, en)).toEqual({
      minutes: 2880,
      label: '2 days',
    });
    expect(timesTotal(timesFromText({ prep: '10', cook: '', rest: '' })!, en)).toEqual({
      minutes: 10,
      label: '10m',
    });
  });

  it("leaves out what it can't read from the total, but still shows it", () => {
    const times = timesFromText({ prep: 'until ready', cook: '1 h', rest: '' })!;
    expect(timesTotal(times, en)).toEqual({ minutes: 60, label: '1h 00m' });
  });
});
