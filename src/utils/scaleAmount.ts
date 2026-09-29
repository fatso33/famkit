import { Language } from '../types/recipe';
import { polishUnit } from './polish';

/**
 * Scales an amount as a person typed it ("2½ Tbsp", "400 g/14oz", "1-2 tbsp", "3"), for rows
 * that carry no quantity field. The first number is scaled, along with any equivalent given
 * with it ("/ 14oz", "(250 ml)", "or 375ml"). Anything else stays as typed: amounts with no
 * number ("pinch"), and sizes ("1 28-ounce can" scales the 1, not the 28).
 *
 * Results read like a cook would write them: spoons and cups land on kitchen fractions, grams
 * on whole numbers, units move up or down when that reads better (6 tsp → 2 Tbsp,
 * 1500 g → 1.5 kg), and a count of whole things never becomes "1 ½" (it becomes "1–2").
 * `stored` gives the forms an older row kept for its own unit, for units the app doesn't know.
 */
export function scaleAmountText(
  text: string,
  ratio: number,
  lang: Language = 'en',
  stored: StoredUnitForms = {},
): string {
  if (ratio === 1 || !text) return text;
  const first = findAmount(text, 0);
  if (!first) return text;

  const lead = scaled(first, ratio, lang, stored);
  let out = text.slice(0, first.start) + lead.text;
  let pos = first.end;
  // Equivalents given alongside: "400 g/14oz", "1 cup (250 ml)", "1.5 cups or 375ml".
  for (;;) {
    const next = findAmount(text, pos);
    if (!next || !EQUIVALENT_JOIN.test(text.slice(pos, next.start))) break;
    // "1 (14 oz) can": the brackets give the can's size, which stays, and the can follows
    // the count ("2 (14 oz) cans").
    const size = text.slice(pos, next.start).includes('(')
      ? text.slice(next.end).match(/^[^)]*\)\s*(\p{L}+)/u)
      : null;
    if (size) {
      const end = next.end + size[0].length;
      out += text.slice(pos, end - size[1].length) + inflect(size[1], lead.shown, lang, stored);
      pos = end;
      break;
    }
    out += text.slice(pos, next.start) + scaled(next, ratio, lang, stored).text;
    pos = next.end;
  }
  return out + text.slice(pos);
}

// --- Reading amounts --------------------------------------------------------------------------

const GLYPHS: Record<string, number> = {
  '¼': 1 / 4,
  '½': 1 / 2,
  '¾': 3 / 4,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅕': 1 / 5,
  '⅖': 2 / 5,
  '⅗': 3 / 5,
  '⅘': 4 / 5,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 1 / 8,
  '⅜': 3 / 8,
  '⅝': 5 / 8,
  '⅞': 7 / 8,
};
const G = Object.keys(GLYPHS).join('');

// One number as typed: 1 ½, 1½, 1-1/2, 1 and 1/2, 3/4, ¾, 2.5, 2,5 (Polish), 12.
const NUMBER = `\\d+\\s?[${G}]|\\d+(?:\\s+(?:and|i)\\s+|\\s+|-)\\d+\\/\\d+|\\d+\\/\\d+|[${G}]|\\d+(?:\\.\\d+|,\\d{1,2}(?!\\d))?`;
// A number, maybe a range ("1-2", "4 – 5", "1/4 to 1/2"), then maybe a unit word.
const AMOUNT = new RegExp(
  `(${NUMBER})(?:(\\s*(?:-|–|—|\\s(?:to|do|or|lub)\\s)\\s*)(${NUMBER}))?(?:(\\s*)(\\p{L}+\\.?))?`,
  'gu',
);
const EQUIVALENT_JOIN =
  /^\s*(?:\/|\(\s*(?:about|approx\.?|roughly|około|ok\.|ca\.?|~)?|or|lub)\s*$/iu;

interface Amount {
  start: number;
  end: number;
  low: string;
  join?: string;
  high?: string;
  space: string;
  unit: string;
}

function findAmount(text: string, from: number): Amount | null {
  AMOUNT.lastIndex = from;
  for (let m = AMOUNT.exec(text); m; m = AMOUNT.exec(text)) {
    const before = text[m.index - 1] ?? ' ';
    const after = text.slice(m.index + m[1].length);
    // Part of a word or code ("B12"), a size ("28-ounce"), or not an amount ("2%", "180°").
    const partOfSomething =
      /[\p{L}\d.,]/u.test(before) || (!m[3] && /^(?:-\p{L}|\s*[%°])/u.test(after));
    if (!partOfSomething) {
      const unit = m[5] ?? '';
      return {
        start: m.index,
        end: m.index + m[0].length,
        low: m[1],
        join: m[2],
        high: m[3],
        space: unit ? (m[4] ?? '') : '',
        unit,
      };
    }
    AMOUNT.lastIndex = m.index + 1;
  }
  return null;
}

type Style = 'fraction' | 'decimal' | 'whole';

function readNumber(s: string): { value: number; style: Style } {
  const t = s.trim();
  const glyph = t.match(new RegExp(`^(\\d*)\\s?([${G}])$`));
  if (glyph) return { value: Number(glyph[1] || 0) + GLYPHS[glyph[2]], style: 'fraction' };
  const mixed = t.match(/^(\d+)(?:\s+(?:and|i)\s+|\s+|-)(\d+)\/(\d+)$/);
  if (mixed) return { value: Number(mixed[1]) + ratioOf(mixed[2], mixed[3]), style: 'fraction' };
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return { value: ratioOf(frac[1], frac[2]), style: 'fraction' };
  if (/[.,]/.test(t)) return { value: Number(t.replace(',', '.')), style: 'decimal' };
  return { value: Number(t), style: 'whole' };
}

const ratioOf = (a: string, b: string) => (Number(b) ? Number(a) / Number(b) : Number(a));

// --- Units --------------------------------------------------------------------------------

type Kind = 'metric' | 'bigMetric' | 'spoon' | 'imperial' | 'count';

interface UnitInfo {
  kind: Kind;
  /** Where it sits in its family, for moving up or down: tsp / tbsp / cup, g / kg, ml / l. */
  family?: 'tsp' | 'tbsp' | 'cup' | 'g' | 'kg' | 'ml' | 'l' | 'łyżeczka' | 'łyżka';
}

const UNITS: Record<string, UnitInfo> = {
  g: { kind: 'metric', family: 'g' },
  gram: { kind: 'metric', family: 'g' },
  grams: { kind: 'metric', family: 'g' },
  gramów: { kind: 'metric', family: 'g' },
  ml: { kind: 'metric', family: 'ml' },
  dl: { kind: 'metric' },
  cl: { kind: 'metric' },
  kg: { kind: 'bigMetric', family: 'kg' },
  l: { kind: 'bigMetric', family: 'l' },
  tsp: { kind: 'spoon', family: 'tsp' },
  teaspoon: { kind: 'spoon', family: 'tsp' },
  teaspoons: { kind: 'spoon', family: 'tsp' },
  tbsp: { kind: 'spoon', family: 'tbsp' },
  tbs: { kind: 'spoon', family: 'tbsp' },
  tablespoon: { kind: 'spoon', family: 'tbsp' },
  tablespoons: { kind: 'spoon', family: 'tbsp' },
  cup: { kind: 'spoon', family: 'cup' },
  cups: { kind: 'spoon', family: 'cup' },
  łyżeczka: { kind: 'spoon', family: 'łyżeczka' },
  łyżeczki: { kind: 'spoon', family: 'łyżeczka' },
  łyżeczek: { kind: 'spoon', family: 'łyżeczka' },
  łyżka: { kind: 'spoon', family: 'łyżka' },
  łyżki: { kind: 'spoon', family: 'łyżka' },
  łyżek: { kind: 'spoon', family: 'łyżka' },
  szklanka: { kind: 'spoon' },
  szklanki: { kind: 'spoon' },
  szklanek: { kind: 'spoon' },
  pint: { kind: 'spoon' },
  pints: { kind: 'spoon' },
  quart: { kind: 'spoon' },
  quarts: { kind: 'spoon' },
  gallon: { kind: 'spoon' },
  gallons: { kind: 'spoon' },
  oz: { kind: 'imperial' },
  fl: { kind: 'imperial' }, // "fl oz"
  ounce: { kind: 'imperial' },
  ounces: { kind: 'imperial' },
  lb: { kind: 'imperial' },
  lbs: { kind: 'imperial' },
  pound: { kind: 'imperial' },
  pounds: { kind: 'imperial' },
  uncja: { kind: 'imperial' },
  uncje: { kind: 'imperial' },
  uncji: { kind: 'imperial' },
  funt: { kind: 'imperial' },
  funty: { kind: 'imperial' },
  funtów: { kind: 'imperial' },
};

const unitInfo = (unit: string): UnitInfo =>
  UNITS[unit.toLowerCase().replace(/\.$/, '')] ?? { kind: 'count' };

// English nouns that follow the count ("1 clove", "2 cloves"). Others are left as typed.
const EN_PLURALS: Record<string, string> = {
  cup: 'cups',
  teaspoon: 'teaspoons',
  tablespoon: 'tablespoons',
  clove: 'cloves',
  pound: 'pounds',
  ounce: 'ounces',
  gram: 'grams',
  slice: 'slices',
  piece: 'pieces',
  sprig: 'sprigs',
  can: 'cans',
  jar: 'jars',
  batch: 'batches',
  package: 'packages',
  packet: 'packets',
  block: 'blocks',
  serving: 'servings',
  bunch: 'bunches',
  stalk: 'stalks',
  leaf: 'leaves',
  head: 'heads',
  pinch: 'pinches',
  dash: 'dashes',
  handful: 'handfuls',
  stick: 'sticks',
  bag: 'bags',
  bottle: 'bottles',
  drop: 'drops',
  egg: 'eggs',
  quart: 'quarts',
  pint: 'pints',
};
const EN_SINGULARS = Object.fromEntries(Object.entries(EN_PLURALS).map(([s, p]) => [p, s]));

const matchCase = (word: string, like: string) =>
  /^\p{Lu}/u.test(like) ? word[0].toUpperCase() + word.slice(1) : word;

/**
 * The forms an older row stored for its unit: `unit` for one, `renderUnit` for more (in Polish,
 * up to 4) and `renderUnitPlural` for 5 and up in Polish.
 */
export interface StoredUnitForms {
  unit?: string;
  renderUnit?: string;
  renderUnitPlural?: string;
}

function inflect(unit: string, shown: number, lang: Language, stored: StoredUnitForms): string {
  if (!unit) return unit;
  // Only the row's own unit has stored forms, not an equivalent or a tidier unit.
  const own = [stored.unit, stored.renderUnit, stored.renderUnitPlural].includes(unit)
    ? stored
    : {};
  if (lang === 'pl') return polishUnit(shown, unit, own);
  if (own.renderUnit) return shown > 1 ? own.renderUnit : (own.unit ?? unit);
  const lower = unit.toLowerCase();
  const plural = shown > 1;
  const word = plural ? EN_PLURALS[lower] : EN_SINGULARS[lower];
  return word ? matchCase(word, unit) : unit;
}

// Moves to the unit that reads better once scaled: 6 tsp → 2 Tbsp, 4 Tbsp → ¼ cup,
// ¼ cup halved → 2 Tbsp, 1500 g → 1.5 kg (1125 ml stays), 0.5 kg → 500 g. Only to amounts a
// cook can measure.
function tidyUnit(value: number, unit: string, lang: Language): { value: number; unit: string } {
  const { family } = unitInfo(unit);
  const lower = unit.toLowerCase();
  // Written the way the author wrote theirs: "teaspoon" → "tablespoon", "tsp" → "tbsp",
  // "Tsp" → "Tbsp"; from cups, "Tbsp" as most recipes write it.
  const spoon = (to: 'tsp' | 'tbsp' | 'cup') => {
    if (to === 'cup') return 'cup';
    if (lower.includes('spoon')) return to === 'tsp' ? 'teaspoon' : 'tablespoon';
    if (to === 'tsp') return 'tsp';
    return unit.startsWith('tsp') ? 'tbsp' : 'Tbsp';
  };
  const isStep = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

  switch (family) {
    case 'tsp':
    case 'łyżeczka':
      if (value >= 3 && isStep(value / 3, 0.5))
        return { value: value / 3, unit: family === 'tsp' ? spoon('tbsp') : 'łyżka' };
      break;
    case 'tbsp':
      if (value >= 4 && isStep(value, 4)) return { value: value / 16, unit: spoon('cup') };
      if (value < 1 && isStep(value * 3, 0.25)) return { value: value * 3, unit: spoon('tsp') };
      break;
    case 'łyżka':
      if (value < 1 && isStep(value * 3, 0.25)) return { value: value * 3, unit: 'łyżeczka' };
      break;
    case 'cup':
      // Under ¼ cup, or an eighth no cup measure has (⅜ cup → 6 Tbsp).
      if (value < 0.25 || (value < 1 && !isStep(value, 0.25) && isStep(value * 16, 1)))
        return { value: value * 16, unit: spoon('tbsp') };
      break;
    case 'g':
      if (value >= 1000 && lower === 'g' && isStep(value, 10))
        return { value: value / 1000, unit: 'kg' };
      break;
    case 'ml':
      if (value >= 1000 && isStep(value, 10))
        return { value: value / 1000, unit: lang === 'pl' ? 'l' : 'L' };
      break;
    case 'kg':
      if (value < 1) return { value: value * 1000, unit: 'g' };
      break;
    case 'l':
      if (value < 1) return { value: value * 1000, unit: 'ml' };
      break;
    case undefined: // szklanka, dl, pint, oz, lb: no better unit to move to
      break;
  }
  return { value, unit };
}

// --- Writing amounts ----------------------------------------------------------------------

const KITCHEN_FRACTIONS: [number, string][] = [
  [0, ''],
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [3 / 8, '⅜'],
  [1 / 2, '½'],
  [5 / 8, '⅝'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
  [7 / 8, '⅞'],
  [1, ''],
];

/** The nearest amount a cook can measure: 1.33 → "1 ⅓", 0.5 → "½", 2 → "2". */
function kitchenFraction(value: number): string {
  let whole = Math.floor(value);
  const [part, glyph] = KITCHEN_FRACTIONS.reduce((best, f) =>
    Math.abs(value - whole - f[0]) < Math.abs(value - whole - best[0]) ? f : best,
  );
  if (part === 1) whole += 1;
  // Never rounds a little down to nothing: 1/16 tsp shows as the smallest spoon, ⅛.
  if (!glyph) return whole === 0 && value > 0 ? '⅛' : String(whole);
  return whole > 0 ? `${whole} ${glyph}` : glyph;
}

/** A decimal with at most `places` places and no trailing zeros, in the language's style. */
function decimal(value: number, places: number, lang: Language): string {
  const text = String(Number(value.toFixed(places)));
  return lang === 'pl' ? text.replace('.', ',') : text;
}

function write(value: number, style: Style, kind: Kind, lang: Language): string {
  switch (kind) {
    case 'metric':
      return decimal(value, value >= 10 ? 0 : 1, lang);
    case 'bigMetric':
      return decimal(value, 2, lang);
    case 'imperial':
      return style === 'decimal' ? decimal(value, 1, lang) : kitchenFraction(value);
    case 'spoon':
    case 'count':
      return style === 'decimal' ? decimal(value, 2, lang) : kitchenFraction(value);
  }
}

// The displayed number back as a value, so the unit agrees with what's shown.
const shownValue = (text: string): number => readNumber(text).value;

/** The amount scaled, and the number shown (for the words that follow it). */
function scaled(
  a: Amount,
  ratio: number,
  lang: Language,
  stored: StoredUnitForms,
): { text: string; shown: number } {
  const low = readNumber(a.low);
  const high = a.high === undefined ? undefined : readNumber(a.high);
  const kind = unitInfo(a.unit).kind;
  // Whole things counted in whole numbers ("3", "2 cloves", "1 large") stay whole.
  const wholeThings =
    kind === 'count' && low.style === 'whole' && (!high || high.style === 'whole');

  if (high) {
    let lo = low.value * ratio;
    let hi = high.value * ratio;
    if (wholeThings && lo >= 1) {
      lo = Math.floor(lo);
      hi = Math.ceil(hi);
    }
    const hiText = write(hi, high.style, kind, lang);
    const loText = write(lo, low.style, kind, lang);
    const shown = shownValue(hiText);
    return {
      text: `${loText}${a.join}${hiText}${a.space}${inflect(a.unit, shown, lang, stored)}`,
      shown,
    };
  }

  const value = low.value * ratio;
  if (wholeThings && value > 1 && !Number.isInteger(value)) {
    // 3 eggs halved: "1–2 eggs", not "1 ½ eggs".
    const hi = Math.ceil(value);
    return {
      text: `${Math.floor(value)}–${hi}${a.space}${inflect(a.unit, hi, lang, stored)}`,
      shown: hi,
    };
  }
  const tidy = kind === 'count' ? { value, unit: a.unit } : tidyUnit(value, a.unit, lang);
  const tidyKind = tidy.unit === a.unit ? kind : unitInfo(tidy.unit).kind;
  const text = write(tidy.value, low.style, tidyKind, lang);
  const shown = shownValue(text);
  // A new unit after a bare number ("400g" → "1.2kg") keeps the typed spacing.
  return { text: `${text}${a.space}${inflect(tidy.unit, shown, lang, stored)}`, shown };
}
