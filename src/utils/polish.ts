/** Polish noun form for a count: 1 składnik, 2–4 (and 22–24, …) składniki, else składników. */
export function plPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

/** A unit's forms: 1 łyżeczka, 2 łyżeczki, 5 łyżeczek, ½ łyżeczki (genitive singular). */
type UnitForms = readonly [one: string, few: string, many: string, fraction: string];

const KITCHEN_UNITS: readonly UnitForms[] = [
  ['łyżeczka', 'łyżeczki', 'łyżeczek', 'łyżeczki'],
  ['łyżka', 'łyżki', 'łyżek', 'łyżki'],
  ['szklanka', 'szklanki', 'szklanek', 'szklanki'],
  ['filiżanka', 'filiżanki', 'filiżanek', 'filiżanki'],
  ['kubek', 'kubki', 'kubków', 'kubka'],
  ['szczypta', 'szczypty', 'szczypt', 'szczypty'],
  ['garść', 'garście', 'garści', 'garści'],
  ['ząbek', 'ząbki', 'ząbków', 'ząbka'],
  ['sztuka', 'sztuki', 'sztuk', 'sztuki'],
  ['plaster', 'plastry', 'plastrów', 'plastra'],
  ['plasterek', 'plasterki', 'plasterków', 'plasterka'],
  ['kostka', 'kostki', 'kostek', 'kostki'],
  ['opakowanie', 'opakowania', 'opakowań', 'opakowania'],
  ['paczka', 'paczki', 'paczek', 'paczki'],
  ['torebka', 'torebki', 'torebek', 'torebki'],
  ['puszka', 'puszki', 'puszek', 'puszki'],
  ['słoik', 'słoiki', 'słoików', 'słoika'],
  ['listek', 'listki', 'listków', 'listka'],
  ['gałązka', 'gałązki', 'gałązek', 'gałązki'],
  ['pęczek', 'pęczki', 'pęczków', 'pęczka'],
  ['główka', 'główki', 'główek', 'główki'],
  ['kropla', 'krople', 'kropli', 'kropli'],
  ['litr', 'litry', 'litrów', 'litra'],
];

const UNIT_BY_FORM = new Map<string, UnitForms>(
  KITCHEN_UNITS.flatMap((forms) => forms.map((form) => [form, forms] as const)),
);

/**
 * The Polish unit for an amount as shown: whole numbers follow the count (1 łyżeczka,
 * 2 łyżeczki, 5 łyżeczek) and fractions take the genitive singular (½ łyżeczki).
 * Common kitchen units come from the table, whichever form was stored; any other unit
 * uses the forms a translation stored (renderUnit up to 4, renderUnitPlural from 5).
 */
export function polishUnit(
  amount: number,
  unit: string,
  stored: { renderUnit?: string; renderUnitPlural?: string } = {},
): string {
  const whole = Number.isInteger(amount);
  const known = [unit, stored.renderUnit, stored.renderUnitPlural]
    .map((form) => form && UNIT_BY_FORM.get(form.trim().toLowerCase()))
    .find(Boolean);
  if (known) {
    const [one, few, many, fraction] = known;
    return whole ? plPlural(amount, one, few, many) : fraction;
  }
  const few = stored.renderUnit || unit;
  return whole ? plPlural(amount, few, few, stored.renderUnitPlural || few) : few;
}
