import { describe, it, expect } from 'vitest';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { getLocalizedRecipe } from '../hooks/useRecipes';
import { Recipe } from '../types/recipe';
import {
  hasPrintablePhotos,
  printableRecipe,
  recipePdfName,
  PrintStep,
} from '../utils/printableRecipe';

const t = UI_TEXT.en;

const forked: Recipe = {
  ...WANDAS_CHEESE_BREAD,
  id: 'roast',
  name: 'Roast Chicken',
  author: 'Ola Nowak',
  authorMode: 'auto',
  heroImage: '',
  tips: undefined,
  notes: undefined,
  laminationDirective: undefined,
  bakingOptions: undefined,
  translations: undefined,
  ingredients: [{ text: 'Chicken', name: 'Chicken', qty: 1, unit: '', note: '' }],
  steps: [
    { num: 1, text: 'Dry the chicken.' },
    {
      num: 2,
      text: 'Roast it.',
      fork: {
        paths: [
          { label: 'Oven', text: 'Roast it.' },
          {
            label: '',
            text: 'Grill it.',
            steps: ['Turn it.', 'Rest it.'],
            notes: 'Lid down.',
            hasImage: true,
            imageSrc: 'data:image/jpeg;base64,grill',
          },
        ],
      },
    },
    { num: 3, text: 'Carve.' },
  ],
};

const stepsOf = (steps: PrintStep[]) =>
  steps.map((s) => (s.kind === 'plain' ? ['plain', s.text] : [s.kind, s.number]));

describe('the recipe as its PDF shows it', () => {
  it("carries Wanda's bread as the recipe page shows it, amounts as written", () => {
    const pdf = printableRecipe(WANDAS_CHEESE_BREAD, 'en', t, { photos: false });
    expect(pdf.title).toBe("Wanda's Cheese Bread");
    expect(pdf.credits).toEqual([
      'By Wanda G.',
      'Added by Peter G.',
      expect.stringMatching(/^Time: /),
    ]);
    expect(pdf.yieldText).toBe('For 1 loaf:');
    expect(pdf.ingredients[0].rows[0]).toEqual({
      name: 'All-Purpose Flour',
      amount: '450g',
      note: 'weigh it',
      substitute: '',
    });
    expect(pdf.callouts.map((c) => c.label)).toEqual([t.kitchenTip, t.crucialNote]);
    // Wanda numbers her steps from 0, as on the page.
    expect(pdf.method[0].steps[0]).toMatchObject({ kind: 'step', number: 0 });
    expect(pdf.lists.map((l) => l.heading)).toEqual([t.laminationDirective, t.bakingOptions]);
  });

  it('leaves every photo out of a text-only PDF, and keeps them in one with photos', () => {
    const without = printableRecipe(WANDAS_CHEESE_BREAD, 'en', t, { photos: false });
    const withPhotos = printableRecipe(WANDAS_CHEESE_BREAD, 'en', t, { photos: true });
    const photos = (pdf: typeof without) => [
      pdf.photo,
      ...pdf.method.flatMap((s) =>
        s.steps.map((step) => ('photo' in step ? step.photo : undefined)),
      ),
    ];
    expect(photos(without).filter(Boolean)).toEqual([]);
    expect(photos(withPhotos).filter(Boolean)).toEqual([
      WANDAS_CHEESE_BREAD.heroImage,
      './assets/sloppy_dough_step2.jpg',
    ]);
  });

  it('is in the language the recipe is shown in', () => {
    const pl = UI_TEXT.pl;
    const shown = getLocalizedRecipe(WANDAS_CHEESE_BREAD, 'pl')!;
    const pdf = printableRecipe(shown, 'pl', pl, { photos: false });
    expect(pdf.title).toBe(shown.name);
    expect(pdf.credits[0]).toBe(pl.byAuthor('Wanda G.'));
    expect(pdf.labels.footer).toBe(pl.pdfFooter);
    expect(pdf.method[0].heading).toBe(pl.prepSteps);
  });

  it('lists every way of a fork, and numbers the steps after it from the fork alone', () => {
    const pdf = printableRecipe(forked, 'en', t, { photos: true, choices: { 1: 1 } });
    expect(stepsOf(pdf.method[0].steps)).toEqual([
      ['step', 1],
      ['fork', 2],
      // Not 5: the grill's own steps are numbered within it on paper.
      ['step', 3],
    ]);
    const fork = pdf.method[0].steps[1];
    expect(fork.kind === 'fork' && fork.paths).toEqual([
      { label: 'Oven', text: 'Roast it.', steps: [], note: '', photo: undefined },
      {
        label: t.pathLetter(1),
        text: 'Grill it.',
        steps: ['Turn it.', 'Rest it.'],
        note: 'Lid down.',
        photo: 'data:image/jpeg;base64,grill',
      },
    ]);
  });

  it('knows whether there are photos to ask about, a fork way’s included', () => {
    expect(hasPrintablePhotos(WANDAS_CHEESE_BREAD)).toBe(true);
    expect(hasPrintablePhotos(forked)).toBe(true);
    const plain = { ...forked, steps: forked.steps.filter((s) => !s.fork) };
    expect(hasPrintablePhotos(plain)).toBe(false);
  });
});

describe('the PDF file name', () => {
  it("is the recipe's name, with its accents and apostrophes", () => {
    expect(recipePdfName("Wanda's Cheese Bread", 'Recipe')).toBe("Wanda's Cheese Bread.pdf");
    expect(recipePdfName('Żurek babci Zosi', 'Przepis')).toBe('Żurek babci Zosi.pdf');
  });

  it('drops what a file name cannot hold', () => {
    expect(recipePdfName('Bread / Rolls: "best"?  ', 'Recipe')).toBe('Bread Rolls best.pdf');
    expect(recipePdfName('...', 'Recipe')).toBe('Recipe.pdf');
    expect(recipePdfName('', 'Przepis')).toBe('Przepis.pdf');
  });
});
