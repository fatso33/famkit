import { describe, it, expect } from 'vitest';
import {
  FormState,
  addPath,
  editorNumbers,
  emptySection,
  emptyStep,
  formFromDraft,
  formFromRecipe,
  formText,
  formToRecipe,
  moveStep,
  pastedIngredients,
  pastedSteps,
  removePath,
  removeSection,
  removeStep,
  toggleFork,
} from '../utils/recipeForm';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

const labels = {
  bakingSection: UI_TEXT.en.bakingOptions,
  bakingPaths: UI_TEXT.en.legacyBakingPaths,
};

const texts = (form: FormState) => form.sections.map((s) => s.steps.map((st) => st.text));
const ids = (form: FormState) => form.sections.map((s) => s.steps.map((st) => st.id));

describe("Wanda's Cheese Bread in the editor", () => {
  const form = formFromRecipe(WANDAS_CHEESE_BREAD, labels);

  it('turns the lamination directive into unnumbered text after the steps, word for word', () => {
    const last = form.sections[0].steps.at(-1)!;
    expect(last.plain).toBe(true);
    expect(last.text).toBe(WANDAS_CHEESE_BREAD.laminationDirective);
    expect(form.sections[0].steps).toHaveLength(WANDAS_CHEESE_BREAD.steps.length + 1);
  });

  it('turns the baking options into a Baking Options section holding a two-path fork', () => {
    const { option1, option2 } = WANDAS_CHEESE_BREAD.bakingOptions!;
    const baking = form.sections[1];
    expect(baking.title).toBe(UI_TEXT.en.bakingOptions);
    expect(baking.steps).toHaveLength(1);

    const [fridge, dutchOven] = baking.steps[0].fork!.paths;
    expect(fridge).toMatchObject({ label: 'Refrigerator Rest', text: option1, steps: [] });
    expect(dutchOven.label).toBe('Dutch Oven Bake');
    expect(dutchOven.text).toBe(option2![0]);
    expect(dutchOven.steps.map((s) => s.text)).toEqual(option2!.slice(1));
    expect(dutchOven.sameAsFirst).toBe(false);
  });

  it('keeps counting from 0, and numbers the fork after the last step', () => {
    expect(form.numberFrom).toBe(0);
    const numbers = editorNumbers(form.sections, form.numberFrom);
    const first = form.sections[0].steps;
    expect(numbers.get(first[0].id)).toBe(0);
    expect(numbers.get(first[8].id)).toBe(8);
    expect(numbers.get(first[9].id)).toBeNull();
    expect(numbers.get(form.sections[1].steps[0].id)).toBe(9);
  });

  it('saves as steps only, with the same words and numbers', () => {
    const saved = formToRecipe(form);
    expect(saved.laminationDirective).toBeUndefined();
    expect(saved.bakingOptions).toBeUndefined();
    expect(saved.steps.slice(0, 9).map((s) => [s.num, s.text])).toEqual(
      WANDAS_CHEESE_BREAD.steps.map((s) => [s.num, s.text]),
    );
    const directive = saved.steps[9];
    expect(directive).toMatchObject({ plain: true, text: WANDAS_CHEESE_BREAD.laminationDirective });
    const fork = saved.steps[10];
    expect(fork.section).toBe(UI_TEXT.en.bakingOptions);
    expect(fork.num).toBe(9);
    expect(fork.text).toBe(WANDAS_CHEESE_BREAD.bakingOptions!.option1);
    expect(fork.fork!.paths[1].steps).toEqual(
      (WANDAS_CHEESE_BREAD.bakingOptions!.option2 as string[]).slice(1),
    );
  });

  it('writes untouched ingredient rows back exactly, so their amounts still scale', () => {
    const saved = formToRecipe(form);
    expect(saved.ingredients).toEqual(WANDAS_CHEESE_BREAD.ingredients);
    // Bracketed notes open in their own field.
    expect(form.ingredientRows[0]).toMatchObject({
      name: 'All-Purpose Flour',
      amount: '450g',
      note: 'weigh it',
      showNote: true,
    });
    expect(form.ingredientRows[3]).toMatchObject({ name: 'Water', note: 'very warm but not hot' });
  });

  it('stores an edited row as text, with its note and swap in their own fields', () => {
    const edited: FormState = {
      ...form,
      ingredientRows: form.ingredientRows.map((row, i) =>
        i === 4
          ? { ...row, substitute: 'Gouda', substituteAmount: '200g', showSubstitute: true }
          : row,
      ),
    };
    expect(formToRecipe(edited).ingredients[4]).toEqual({
      text: 'Cheese - 250g',
      name: 'Cheese',
      note: '',
      substitute: 'Gouda',
      substituteAmount: '200g',
    });
  });

  it('reopens what it saved just as it was', () => {
    const saved = { ...WANDAS_CHEESE_BREAD, ...formToRecipe(form) } as Recipe;
    const reopened = formFromRecipe(saved, labels);
    expect(texts(reopened)).toEqual(texts(form));
    expect(reopened.sections.map((s) => s.title)).toEqual(['', UI_TEXT.en.bakingOptions]);
    expect(reopened.numberFrom).toBe(0);
    expect(formText(reopened)).toBe(formText(form));
    expect(formToRecipe(reopened).steps).toEqual(formToRecipe(form).steps);
  });
});

describe('editing the method', () => {
  const twoSections = (): FormState['sections'] => [
    { ...emptySection(), steps: [emptyStep('Mix.'), emptyStep('Knead.')] },
    { ...emptySection('Baking'), steps: [emptyStep('Bake.')] },
  ];

  it('moves a step within its section, then across into the next', () => {
    const sections = twoSections();
    const knead = sections[0].steps[1].id;
    const down = moveStep(sections, knead, 1);
    expect(down.map((s) => s.steps.map((st) => st.text))).toEqual([['Mix.'], ['Knead.', 'Bake.']]);
    const up = moveStep(down, knead, -1);
    expect(up.map((s) => s.steps.map((st) => st.text))).toEqual([['Mix.', 'Knead.'], ['Bake.']]);
    // Nowhere further to go: unchanged.
    expect(moveStep(sections, sections[0].steps[0].id, -1)).toBe(sections);
  });

  it('puts a removed step back where it was with Undo, even after other edits', () => {
    const sections = twoSections();
    const { sections: without, undo } = removeStep(sections, sections[0].steps[0].id);
    expect(without[0].steps.map((s) => s.text)).toEqual(['Knead.']);
    const edited = [...without, { ...emptySection('Icing'), steps: [emptyStep('Ice.')] }];
    expect(undo(edited).map((s) => s.steps.map((st) => st.text))).toEqual([
      ['Mix.', 'Knead.'],
      ['Bake.'],
      ['Ice.'],
    ]);
  });

  it('removes a later section with Undo, but never the first', () => {
    const sections = twoSections();
    expect(removeSection(sections, sections[0].id).sections).toBe(sections);
    const { sections: without, undo } = removeSection(sections, sections[1].id);
    expect(without).toHaveLength(1);
    expect(undo(without).map((s) => s.title)).toEqual(['', 'Baking']);
  });

  it('forks a step and joins it again, keeping the open path', () => {
    const forked = toggleFork(emptyStep('Bake.'));
    expect(forked.fork!.paths.map((p) => [p.text, p.sameAsFirst])).toEqual([
      ['Bake.', false],
      ['', true],
    ]);
    const three = addPath(forked);
    expect(three.fork!.paths).toHaveLength(3);
    expect(three.fork!.active).toBe(2);
    expect(addPath(three)).toBe(three);
    // Taking the second path away leaves two; taking another joins the fork.
    const two = removePath(three, 1);
    expect(two.fork!.paths).toHaveLength(2);
    expect(removePath(two, 1).fork).toBeNull();
    expect(toggleFork({ ...forked, fork: { ...forked.fork!, active: 0 } }).text).toBe('Bake.');
  });

  it('numbers steps after a fork from the path open in the editor', () => {
    const fork = toggleFork(emptyStep('Chill.'));
    fork.fork!.paths[0].steps = [
      { id: 'a', text: 'Warm.' },
      { id: 'b', text: 'Bake.' },
    ];
    const after = emptyStep('Slice.');
    const sections = [{ ...emptySection(), steps: [fork, after] }];

    // The second path shares the first's steps.
    expect(editorNumbers(sections, 1).get(after.id)).toBe(4);
    fork.fork!.paths[1].sameAsFirst = false;
    fork.fork!.active = 1;
    expect(editorNumbers(sections, 1).get(after.id)).toBe(2);
    expect(editorNumbers(sections, 1).get(`${fork.id}:1`)).toBe(2);
  });

  it('leaves out empty steps and sections, and a section heading on a lone default section', () => {
    const sections = [
      { ...emptySection(), steps: [emptyStep('Mix.'), emptyStep('  ')] },
      emptySection('Nothing here'),
    ];
    const form = { ...formFromDraft({})!, sections };
    const steps = formToRecipe(form).steps;
    expect(steps).toEqual([expect.objectContaining({ num: 1, text: 'Mix.' })]);
    expect(steps[0].section).toBeUndefined();
  });
});

describe('drafts', () => {
  it('reads a draft from before the redesign', () => {
    const form = formFromDraft({
      title: 'Babka',
      author: 'Zosia',
      ingredientRows: [{ name: 'Flour', amount: '500g' }],
      steps: [{ text: 'Mix.', notes: 'Gently' }, { text: 'Bake.' }],
    })!;
    expect(form.authorMode).toBe('custom');
    expect(ids(form)).toHaveLength(1);
    expect(texts(form)).toEqual([['Mix.', 'Bake.']]);
    expect(form.sections[0].steps[0]).toMatchObject({ tip: 'Gently', showTip: true });
    expect(form.ingredientRows[0]).toMatchObject({ name: 'Flour', amount: '500g' });
  });

  it('reads sections and forks, and ignores what it cannot use', () => {
    const form = formFromDraft({
      category: 'not-a-category',
      manualMinutes: -5,
      sections: [
        {
          title: 'Bake',
          steps: [
            {
              text: 'Bake.',
              fork: {
                active: 7,
                paths: [
                  { label: 'A', text: 'Bake.' },
                  { label: 'B', sameAsFirst: true },
                ],
              },
            },
          ],
        },
        { title: 'Empty', steps: [] },
        'nonsense',
      ],
    })!;
    expect(form.category).toBe('');
    expect(form.manualMinutes).toBeNull();
    expect(form.sections.map((s) => s.title)).toEqual(['Bake']);
    const fork = form.sections[0].steps[0].fork!;
    expect(fork.active).toBe(0);
    expect(fork.paths.map((p) => [p.label, p.sameAsFirst])).toEqual([
      ['A', false],
      ['B', true],
    ]);
    expect(formFromDraft('not a draft')).toBeNull();
  });
});

describe('pasting', () => {
  it('reads ingredients written in the usual ways', () => {
    const rows = pastedIngredients(
      'Flour - 300 g\n• Sugar: 1 cup\n2 szklanki mąki\n\n3 eggs\nA pinch of salt',
    );
    expect(rows.map((r) => [r.name, r.amount])).toEqual([
      ['Flour', '300 g'],
      ['Sugar', '1 cup'],
      ['mąki', '2 szklanki'],
      ['eggs', '3'],
      ['A pinch of salt', ''],
    ]);
  });

  it('drops the numbering pasted steps came with', () => {
    const steps = pastedSteps('1. Mix.\n2) Knead.\nStep 3: Bake.\nKrok 4 - Ostudź.\n- Serve.');
    expect(steps.map((s) => s.text)).toEqual(['Mix.', 'Knead.', 'Bake.', 'Ostudź.', 'Serve.']);
  });
});

describe('substeps', () => {
  it('keeps one for every letter, a) to z), and no more', () => {
    const parts = Array.from({ length: 27 }, (_, i) => `Part ${i + 1}.`);
    const recipe: Recipe = {
      id: 'r',
      name: 'Pierogi',
      author: 'Ola',
      category: 'mains',
      heroImage: '',
      yieldHeader: '',
      ingredients: [],
      steps: [{ num: 1, text: 'Fill.', substeps: parts }],
    };
    const form = formFromRecipe(recipe, labels);
    expect(form.sections[0].steps[0].substeps).toHaveLength(26);
    expect(formToRecipe(form).steps[0].substeps).toEqual(parts.slice(0, 26));
  });
});
