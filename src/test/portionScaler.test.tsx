import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { IngredientsTable } from '../components/recipe-detail/IngredientsTable';
import { UI_TEXT } from '../i18n/translations';
import { Ingredient, Language } from '../types/recipe';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

// Rows as the current editor saves them: the amount is text, with no quantity field.
const mapoTofu: Ingredient[] = [
  { text: 'silken tofu - 400 g/14oz', name: 'silken tofu', note: '' },
  { text: 'doubanjiang - 2½ Tbsp', name: 'doubanjiang', note: '' },
  { text: 'garlic - 1 clove', name: 'garlic', note: '' },
  { text: 'Sichuan pepper - pinch', name: 'Sichuan pepper', note: '' },
];

// Steps the scaler the way App's recipe page does (RecipeDetailView).
function Scaled({
  ingredients,
  yieldHeader,
  language = 'en',
}: {
  ingredients: Ingredient[];
  yieldHeader?: string;
  language?: Language;
}) {
  const [scale, setScale] = useState(1);
  return (
    <IngredientsTable
      ingredients={ingredients}
      scale={scale}
      onIncreaseScale={() => setScale((s) => (s === 0.5 ? 1 : Math.min(8, s + 1)))}
      onDecreaseScale={() => setScale((s) => (s === 1 ? 0.5 : Math.max(0.5, s - 1)))}
      yieldHeader={yieldHeader}
      language={language}
      t={UI_TEXT[language]}
    />
  );
}

const t = UI_TEXT.en;
const amounts = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[1].textContent);

describe('portion scaler', () => {
  it('scales amounts the current editor saved as text', () => {
    render(<Scaled ingredients={mapoTofu} yieldHeader="Servings: 4" />);
    expect(amounts()).toEqual(['400 g/14oz', '2½ Tbsp', '1 clove', 'pinch']);

    fireEvent.click(screen.getByRole('button', { name: t.increasePortion }));
    expect(amounts()).toEqual(['800 g/28oz', '5 Tbsp', '2 cloves', 'pinch']);
  });

  it("keeps the recipe's own yield and marks how many times it is made", () => {
    render(<Scaled ingredients={mapoTofu} yieldHeader="Servings: 4" />);
    const yieldLine = () => document.getElementById('yieldHeaderDisplay');
    expect(yieldLine()).toHaveTextContent(/^Servings: 4$/);

    fireEvent.click(screen.getByRole('button', { name: t.increasePortion }));
    expect(yieldLine()).toHaveTextContent('Servings: 4×2');
    expect(yieldLine()).not.toHaveTextContent(/loaf|loaves/);

    fireEvent.click(screen.getByRole('button', { name: t.decreasePortion }));
    fireEvent.click(screen.getByRole('button', { name: t.decreasePortion }));
    expect(yieldLine()).toHaveTextContent('Servings: 4×½');
  });

  it('shows only the mark for a scaled recipe that gives no yield', () => {
    render(<Scaled ingredients={mapoTofu} yieldHeader="" />);
    expect(document.getElementById('yieldHeaderDisplay')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t.increasePortion }));
    expect(document.getElementById('yieldHeaderDisplay')).toHaveTextContent(/^×2$/);
  });

  it('declines Polish units for the scaled amount', () => {
    const pl: Ingredient[] = [
      { text: 'sos sojowy - 2 łyżki', name: 'sos sojowy', note: '' },
      { text: 'czosnek - 1 ząbek', name: 'czosnek', note: '' },
    ];
    render(<Scaled ingredients={pl} yieldHeader="Porcje: 4" language="pl" />);
    const more = screen.getByRole('button', { name: UI_TEXT.pl.increasePortion });
    fireEvent.click(more);
    expect(amounts()).toEqual(['4 łyżki', '2 ząbki']);
    fireEvent.click(more);
    fireEvent.click(more);
    fireEvent.click(more);
    expect(amounts()).toEqual(['10 łyżek', '5 ząbków']);
  });

  it("scales Wanda's rows the same way, from the amounts her recipe gives", () => {
    render(<Scaled ingredients={WANDAS_CHEESE_BREAD.ingredients} yieldHeader="For 1 loaf:" />);
    const more = screen.getByRole('button', { name: t.increasePortion });
    expect(amounts()).toEqual([
      '450g',
      '2 teaspoons',
      '1 ½ teaspoons',
      '1 ½ cups or 375ml',
      '250g',
      '½ cup crushed',
    ]);
    fireEvent.click(more);
    expect(amounts()).toEqual([
      '900g',
      '4 teaspoons',
      '1 tablespoon',
      '3 cups or 750ml',
      '500g',
      '1 cup crushed',
    ]);
    fireEvent.click(more);
    expect(amounts()).toEqual([
      '1.35kg',
      '2 tablespoons',
      '1 ½ tablespoons',
      '4 ½ cups or 1125ml',
      '750g',
      '1 ½ cups crushed',
    ]);
    expect(document.getElementById('yieldHeaderDisplay')).toHaveTextContent('For 1 loaf:×3');
  });

  it("scales Wanda's Polish rows with Polish units", () => {
    const pl = WANDAS_CHEESE_BREAD.translations!.pl!.ingredients!;
    render(<Scaled ingredients={pl} yieldHeader="Na 1 bochenek:" language="pl" />);
    fireEvent.click(screen.getByRole('button', { name: UI_TEXT.pl.increasePortion }));
    expect(amounts()).toEqual([
      '900g',
      '4 łyżeczki',
      '1 łyżka',
      '3 szklanki lub 750ml',
      '500g',
      '1 szklanka posiekanych',
    ]);
  });
});
