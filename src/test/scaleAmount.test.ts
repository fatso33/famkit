import { describe, it, expect } from 'vitest';
import { scaleAmountText } from '../utils/scaleAmount';

const x = (text: string, ratio: number) => scaleAmountText(text, ratio, 'en');
const pl = (text: string, ratio: number) => scaleAmountText(text, ratio, 'pl');

// Amounts as typed in the family's recipes (most from Raye's import).
describe('scaleAmountText', () => {
  it('leaves every amount exactly as typed at 1x', () => {
    for (const typed of ['1-1/2 cups', '400 g/14oz', 'pinch', '3', '2½ Tbsp', '']) {
      expect(x(typed, 1)).toBe(typed);
    }
  });

  it('reads the ways people type numbers', () => {
    expect(x('3', 2)).toBe('6');
    expect(x('3/4 cup', 2)).toBe('1 ½ cups');
    expect(x('½ lb', 2)).toBe('1 lb');
    expect(x('2½ Tbsp', 2)).toBe('5 Tbsp');
    expect(x('1¾ teaspoons', 2)).toBe('3 ½ teaspoons');
    expect(x('1 ½ tablespoon', 2)).toBe('3 tablespoons');
    expect(x('1-1/2 cups', 2)).toBe('3 cups');
    expect(x('1 and 1/2 teaspoons', 2)).toBe('1 tablespoon');
    expect(x('2.5 Tbsp', 3)).toBe('7.5 Tbsp');
    expect(x('Optional: 1 Tbsp', 2)).toBe('Optional: 2 Tbsp');
  });

  it('scales both ends of a range', () => {
    expect(x('1-2 tbsp', 2)).toBe('2-4 tbsp');
    expect(x('4 – 5', 3)).toBe('12 – 15');
    expect(x('1/3-1/2 cup', 2)).toBe('⅔-1 cup');
    expect(x('1/4 to 1/2 tsp', 2)).toBe('½ to 1 tsp');
    expect(x('4 to 5 pounds', 2)).toBe('8 to 10 pounds');
    expect(x('2 or 3 cloves', 2)).toBe('4 or 6 cloves');
  });

  it('scales the equivalents given alongside', () => {
    expect(x('400 g/14oz', 2)).toBe('800 g/28oz');
    expect(x('600 g / 1.2lb', 2)).toBe('1.2 kg / 2.4lb');
    expect(x('1 cup (250 ml)', 2)).toBe('2 cups (500 ml)');
    expect(x('1 tsp (4 g)', 3)).toBe('1 tbsp (12 g)');
    expect(x('2 (about 300 g)', 2)).toBe('4 (about 600 g)');
    expect(x('1.5 cups or 375ml', 2)).toBe('3 cups or 750ml');
  });

  it('keeps sizes, which are not amounts', () => {
    expect(x('1 28-ounce', 2)).toBe('2 28-ounce');
    expect(x('1 4-inch', 3)).toBe('3 4-inch');
    expect(x('1 (14 oz) can', 2)).toBe('2 (14 oz) cans');
    expect(x('4-inch piece', 2)).toBe('4-inch piece');
  });

  it('leaves amounts with no number as typed', () => {
    expect(x('pinch', 2)).toBe('pinch');
    expect(x('to taste', 3)).toBe('to taste');
  });

  it('rounds to amounts a cook can measure', () => {
    expect(x('113.5g', 2)).toBe('227g');
    expect(x('31.5g', 0.5)).toBe('16g');
    expect(x('1.4 g', 0.5)).toBe('0.7 g');
    expect(x('1/3 cup', 2)).toBe('⅔ cup');
    expect(x('⅓ cup', 0.5)).toBe('2 ⅔ Tbsp');
    expect(x('9.6 oz', 3)).toBe('28.8 oz');
    expect(x('1/8 tsp', 0.5)).toBe('⅛ tsp');
  });

  it('moves to the unit that reads better', () => {
    expect(x('1 tsp', 3)).toBe('1 tbsp');
    expect(x('1 Tsp', 3)).toBe('1 Tbsp');
    expect(x('1 teaspoon', 6)).toBe('2 tablespoons');
    expect(x('2 tsp', 2)).toBe('4 tsp');
    expect(x('2 Tbsp', 2)).toBe('¼ cup');
    expect(x('4 Tbsp', 2)).toBe('½ cup');
    expect(x('3 Tbsp', 2)).toBe('6 Tbsp');
    expect(x('¼ cup', 0.5)).toBe('2 Tbsp');
    expect(x('3/4 cup', 0.5)).toBe('6 Tbsp');
    expect(x('1¾ cups', 0.5)).toBe('14 Tbsp');
    expect(x('1/3 cup', 0.5)).toBe('2 ⅔ Tbsp');
    expect(x('1 Tbsp', 0.5)).toBe('1 ½ tsp');
    expect(x('1 kg / 2 lb', 0.5)).toBe('500 g / 1 lb');
    expect(x('600 ml', 2)).toBe('1.2 L');
  });

  it('keeps whole things whole', () => {
    expect(x('3', 0.5)).toBe('1–2');
    expect(x('3 cloves', 0.5)).toBe('1–2 cloves');
    expect(x('1 large', 0.5)).toBe('½ large');
    expect(x('13-16', 0.5)).toBe('6-8');
    expect(x('½ block', 3)).toBe('1 ½ blocks');
  });

  it('makes English units agree with the new amount', () => {
    expect(x('1 clove', 2)).toBe('2 cloves');
    expect(x('2 cups', 0.5)).toBe('1 cup');
    expect(x('1 batch', 2)).toBe('2 batches');
    expect(x('1 Cup', 2)).toBe('2 Cups');
  });

  it('declines Polish units and writes decimal commas', () => {
    expect(pl('2 łyżki', 5)).toBe('10 łyżek');
    expect(pl('1 ząbek', 2)).toBe('2 ząbki');
    expect(pl('½ szklanki', 2)).toBe('1 szklanka');
    expect(pl('1 łyżeczka', 3)).toBe('1 łyżka');
    expect(pl('1 łyżka', 0.5)).toBe('1 ½ łyżeczki');
    expect(pl('1,5 szklanki', 3)).toBe('4,5 szklanki');
    expect(pl('750 g', 2)).toBe('1,5 kg');
    expect(pl('3 jajka', 0.5)).toBe('1–2 jajka');
  });
});
