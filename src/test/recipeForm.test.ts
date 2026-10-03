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
  hasContent,
  missingName,
  moveStep,
  addPastedMethod,
  pastedIngredients,
  pastedMethod,
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

// A recipe without Wanda's older blocks, which the editor would add as steps.
const plainRecipe: Recipe = {
  ...WANDAS_CHEESE_BREAD,
  laminationDirective: undefined,
  bakingOptions: undefined,
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

  it('lets a later section start its numbers again, and keeps that through a save', () => {
    const sections = twoSections();
    sections[1] = { ...sections[1], restart: true };
    const numbers = editorNumbers(sections, 1);
    expect(sections.flatMap((s) => s.steps.map((st) => numbers.get(st.id)))).toEqual([1, 2, 1]);

    const form = { ...formFromDraft({})!, sections };
    const steps = formToRecipe(form).steps;
    expect(steps.map((st) => [st.num, st.restart])).toEqual([
      [1, undefined],
      [2, undefined],
      [1, true],
    ]);
    const reopened = formFromRecipe({ ...plainRecipe, steps }, labels);
    expect(reopened.sections.map((s) => s.restart)).toEqual([false, true]);
    // The first section has nothing to start again from.
    const first = [{ ...sections[0], restart: true }, sections[1]];
    expect(formToRecipe({ ...form, sections: first }).steps[0].restart).toBeUndefined();
  });

  it('keeps a photo on the one fork path it was added to (regression: it showed on every path)', () => {
    const fork = addPath(toggleFork(emptyStep('Bake in a tin.')));
    fork.fork!.paths[1] = { ...fork.fork!.paths[1], label: 'Stone', text: 'Bake on a stone.' };
    fork.fork!.paths[2] = {
      ...fork.fork!.paths[2],
      label: 'Pot',
      text: 'Bake in a pot.',
      imageSrc: 'data:pot',
      imageCaption: 'The lid on',
      tip: 'Heat the pot first.',
      showTip: true,
    };
    const form = { ...formFromDraft({})!, sections: [{ ...emptySection(), steps: [fork] }] };
    const [saved] = formToRecipe(form).steps;
    expect(saved.imageSrc).toBeUndefined();
    expect(saved.hasImage).toBe(false);
    expect(saved.fork!.paths.map((p) => p.imageSrc)).toEqual([undefined, undefined, 'data:pot']);
    expect(saved.fork!.paths[2]).toMatchObject({ notes: 'Heat the pot first.', hasImage: true });

    const reopened = formFromRecipe({ ...WANDAS_CHEESE_BREAD, steps: [saved] } as Recipe, labels)
      .sections[0].steps[0];
    expect(reopened.fork!.paths.map((p) => [p.imageSrc, p.tip])).toEqual([
      ['', ''],
      ['', ''],
      ['data:pot', 'Heat the pot first.'],
    ]);
    // A new photo alone isn't a text edit.
    const newPhoto = structuredClone(form);
    newPhoto.sections[0].steps[0].fork!.paths[2].imageSrc = 'data:another';
    expect(formText(newPhoto)).toBe(formText(form));
  });

  it("gives an older fork's photo to its first path only", () => {
    const older = {
      ...WANDAS_CHEESE_BREAD,
      steps: [
        {
          num: 1,
          text: 'Bake.',
          hasImage: true,
          imageSrc: 'data:loaf',
          notes: 'Watch it.',
          fork: {
            paths: [
              { label: 'A', text: 'Bake.' },
              { label: 'B', text: 'Fry.' },
            ],
          },
        },
      ],
    } as Recipe;
    const step = formFromRecipe(older, labels).sections[0].steps[0];
    expect(step.imageSrc).toBe('');
    expect(step.fork!.paths.map((p) => [p.imageSrc, p.tip])).toEqual([
      ['data:loaf', 'Watch it.'],
      ['', ''],
    ]);
  });

  it('hands the tip and photo to the first path on forking, and back from the open one on joining', () => {
    const step = { ...emptyStep('Bake.'), tip: 'Hot oven.', showTip: true, imageSrc: 'data:x' };
    const forked = toggleFork(step);
    expect([forked.tip, forked.imageSrc]).toEqual(['', '']);
    expect([forked.fork!.paths[0].tip, forked.fork!.paths[0].imageSrc]).toEqual([
      'Hot oven.',
      'data:x',
    ]);
    const onSecond = { ...forked, fork: { ...forked.fork!, active: 1 } };
    onSecond.fork.paths[1] = { ...onSecond.fork.paths[1], imageSrc: 'data:y' };
    expect(toggleFork(onSecond)).toMatchObject({ imageSrc: 'data:y', tip: '' });
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

describe('an ingredient with no name', () => {
  const row = () => formFromDraft({})!.ingredientRows[0];
  it('is an amount on its own, which needs a name to mean anything', () => {
    expect(missingName({ ...row(), amount: '200 g' })).toBe(true);
    expect(missingName({ ...row(), name: 'Salt' })).toBe(false);
    expect(missingName(row())).toBe(false);
  });

  it('is left alone in an older recipe until the row is changed', () => {
    const older = formFromRecipe({ ...plainRecipe, ingredients: [{ text: ' - 200 g' }] }, labels);
    const kept = older.ingredientRows[0];
    expect(kept.name).toBe('');
    expect(missingName(kept)).toBe(false);
    expect(missingName({ ...kept, amount: '250 g' })).toBe(true);
  });
});

describe('what counts as written', () => {
  const empty = () => formFromDraft({})!;
  it('is nothing in an empty form', () => {
    expect(hasContent(empty())).toBe(false);
  });

  it('is any one field, not only a name, an ingredient or a step', () => {
    const one = (change: Partial<FormState>) => hasContent({ ...empty(), ...change });
    expect(one({ heroImage: 'data:image/jpeg;base64,AAAA' })).toBe(true);
    expect(one({ cardDescription: 'Soft' })).toBe(true);
    expect(one({ tips: 'Use cold butter' })).toBe(true);
    expect(one({ notes: 'Not in a glass dish' })).toBe(true);
    expect(one({ yieldHeader: '2 loaves' })).toBe(true);
    expect(one({ manualMinutes: 45 })).toBe(true);
    const rows = empty().ingredientRows;
    expect(one({ ingredientRows: [{ ...rows[0], amount: '200 g' }] })).toBe(true);
    const sections = empty().sections;
    const step = sections[0].steps[0];
    expect(one({ sections: [{ ...sections[0], steps: [{ ...step, imageSrc: 'data:x' }] }] })).toBe(
      true,
    );
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

  it('makes a note of what is in brackets after an ingredient name', () => {
    const rows = pastedIngredients(
      'Flour (sifted) - 300 g\n2 cups milk (warm)\n1 can (400 g) tomatoes\nButter [cold] (cubed): 100 g\n1 (14-ounce) can beans\n(optional)',
    );
    expect(rows.map((r) => [r.name, r.amount, r.note, r.showNote])).toEqual([
      ['Flour', '300 g', 'sifted', true],
      ['milk', '2 cups', 'warm', true],
      // Brackets straight after the amount are part of the amount.
      ['tomatoes', '1 can (400 g)', '', false],
      ['Butter', '100 g', 'cold, cubed', true],
      ['can beans', '1 (14-ounce)', '', false],
      ['(optional)', '', '', false],
    ]);
  });

  it('keeps a colon or a dash inside brackets out of the way', () => {
    const [row] = pastedIngredients('2 eggs (room temperature: important)');
    expect([row.name, row.amount, row.note]).toEqual(['eggs', '2', 'room temperature: important']);
    const [range] = pastedIngredients('1 - 2 cups stock');
    expect([range.name, range.amount]).toEqual(['stock', '1 - 2 cups']);
  });

  it('reads amounts written as a range or a sum, and leaves odd brackets as written', () => {
    const rows = pastedIngredients(
      '1/2 to 2/3 cup (113g to 152g) hot water\n1 and 1/4 cups chocolate chips\n500 g mince (beef (lean), or pork)\n2 cups broccoli ), chopped (1 head',
    );
    expect(rows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['hot water', '1/2 to 2/3 cup (113g to 152g)', ''],
      ['chocolate chips', '1 and 1/4 cups', ''],
      ['mince', '500 g', 'beef (lean), or pork'],
      // Brackets that don't pair up: nothing is guessed.
      ['broccoli ), chopped (1 head', '2 cups', ''],
    ]);
  });

  it('turns a line that only names a part of the list into a heading', () => {
    const rows = pastedIngredients('For the sauce:\n2 tomatoes\nSugar: 1 cup');
    expect(rows.map((r) => [Boolean(r.heading), r.name, r.amount])).toEqual([
      [true, 'For the sauce', ''],
      [false, 'tomatoes', '2'],
      [false, 'Sugar', '1 cup'],
    ]);
  });

  const shape = (text: string) =>
    pastedMethod(text).map((section) => [
      section.title,
      section.steps.map((s) =>
        s.substeps.length > 0 ? [s.text, s.substeps.map((sub) => sub.text)] : s.text,
      ),
    ]);

  it('drops the numbering pasted steps came with', () => {
    expect(shape('1. Mix.\n2) Knead.\nStep 3: Bake.\nKrok 4 - Ostudź.\n5.Serve.')).toEqual([
      ['', ['Mix.', 'Knead.', 'Bake.', 'Ostudź.', 'Serve.']],
    ]);
  });

  it('reads letters, numbers with letters and dashes under a numbered step as its substeps', () => {
    expect(
      shape('1. Make the dough\na) Mix.\nb) Knead.\n2. Bake\n- Preheat.\n- Bake 40 min.'),
    ).toEqual([
      [
        '',
        [
          ['Make the dough', ['Mix.', 'Knead.']],
          ['Bake', ['Preheat.', 'Bake 40 min.']],
        ],
      ],
    ]);
    expect(shape('1. Make the dough\n1a. Mix.\n1b) Knead.\n2. Bake.')).toEqual([
      ['', [['Make the dough', ['Mix.', 'Knead.']], 'Bake.']],
    ]);
  });

  it('makes each lettered part a step when no numbered line stands over them', () => {
    expect(shape('1a. Mix.\n1b. Knead.\n2a. Bake.')).toEqual([['', ['Mix.', 'Knead.', 'Bake.']]]);
  });

  it('joins a wrapped line to the step above it, and leaves amounts like 1.5 alone', () => {
    expect(shape('1. Mix the flour\nwith the water.\n2. Add\n1.5 cups of milk.')).toEqual([
      ['', ['Mix the flour with the water.', 'Add 1.5 cups of milk.']],
    ]);
  });

  it('reads dashes or bullets alone as steps, with letters under them as substeps', () => {
    expect(shape('- Mix.\n• Knead.\na) Fold.\nb) Turn.\n* Bake.')).toEqual([
      ['', ['Mix.', ['Knead.', ['Fold.', 'Turn.']], 'Bake.']],
    ]);
    expect(shape('a) Mix.\nb) Bake.')).toEqual([['', ['Mix.', 'Bake.']]]);
  });

  it('starts a section at a line that only names what follows', () => {
    expect(shape('Dough:\n1. Mix.\n2. Knead.\nFor the icing:\n1. Whisk.')).toEqual([
      ['Dough', ['Mix.', 'Knead.']],
      ['For the icing', ['Whisk.']],
    ]);
  });

  it('takes each line as a step when nothing marks the steps', () => {
    expect(shape('Mix.\n\nKnead well:\nBake.')).toEqual([['', ['Mix.', 'Knead well:', 'Bake.']]]);
  });

  it('turns sections headed as options of each other into one step with a path each', () => {
    const [section] = pastedMethod(
      '1. Shape the loaf.\nOption 1: Oven\n1. Bake at 220°C.\n2. Cool.\nOption 2: Dutch oven\n1. Heat the pot.\nGlaze:\n1. Brush.',
    );
    expect(section.steps.map((s) => s.text)).toEqual(['Shape the loaf.', 'Bake at 220°C.']);
    expect(
      section.steps[1].fork?.paths.map((p) => [p.label, p.text, p.steps.map((s) => s.text)]),
    ).toEqual([
      ['Oven', 'Bake at 220°C.', ['Cool.']],
      ['Dutch oven', 'Heat the pot.', []],
    ]);
    // A lone "Option 1", or options out of order, stay sections.
    expect(shape('Option 1:\n1. Bake.\nGlaze:\n1. Brush.').map(([title]) => title)).toEqual([
      'Option 1',
      'Glaze',
    ]);
  });

  it('does not take one stray dash or number among plain lines for a layout', () => {
    expect(shape('Mix.\nKnead.\n- Rest an hour.\nShape.\nBake.')).toEqual([
      ['', ['Mix.', 'Knead.', 'Rest an hour.', 'Shape.', 'Bake.']],
    ]);
  });

  it('adds a pasted method after what is written, filling an empty section', () => {
    const pasted = pastedMethod('1. Mix.\nIcing:\n1. Whisk.');
    const filled = addPastedMethod([emptySection()], pasted);
    expect(filled.map((s) => [s.title, s.steps.map((st) => st.text)])).toEqual([
      ['', ['Mix.']],
      ['Icing', ['Whisk.']],
    ]);
    const written = [{ ...emptySection('Dough'), steps: [emptyStep('Rest.')] }];
    expect(
      addPastedMethod(written, pasted).map((s) => [s.title, s.steps.map((st) => st.text)]),
    ).toEqual([
      ['Dough', ['Rest.', 'Mix.']],
      ['Icing', ['Whisk.']],
    ]);
  });
});

describe('where a recipe is from', () => {
  const saved = (source: string) => {
    const { sourceUrl, sourceText } = formToRecipe({
      ...formFromRecipe(plainRecipe, labels),
      source,
    });
    return { sourceUrl, sourceText };
  };

  it('is kept through the form, and a link only when it is a web address', () => {
    const form = formFromRecipe({ ...plainRecipe, sourceUrl: 'https://example.com/bread' }, labels);
    expect(form.source).toBe('https://example.com/bread');
    expect(formToRecipe(form).sourceUrl).toBe('https://example.com/bread');
    expect(
      formFromRecipe({ ...plainRecipe, sourceUrl: 'javascript:alert(1)' }, labels).source,
    ).toBe('');
    expect(saved('')).toEqual({ sourceUrl: undefined, sourceText: undefined });
    // A draft from before the one field kept an imported page's address as sourceUrl.
    expect(formFromDraft({ title: 'Soup', sourceUrl: 'https://example.com/soup' })?.source).toBe(
      'https://example.com/soup',
    );
    expect(formFromDraft({ title: 'Soup', source: "Aunt Ola's notebook" })?.source).toBe(
      "Aunt Ola's notebook",
    );
  });

  it('saves a link as the address, and anything else as words', () => {
    expect(saved('https://smittenkitchen.com/2024/03/babka/')).toEqual({
      sourceUrl: 'https://smittenkitchen.com/2024/03/babka/',
      sourceText: undefined,
    });
    // Typed without its https://.
    expect(saved('allrecipes.com/recipe/123')).toEqual({
      sourceUrl: 'https://allrecipes.com/recipe/123',
      sourceText: undefined,
    });
    expect(saved('www.kwestiasmaku.com').sourceUrl).toBe('https://www.kwestiasmaku.com/');
    expect(saved("  Aunt Ola's notebook ")).toEqual({
      sourceUrl: undefined,
      sourceText: "Aunt Ola's notebook",
    });
    for (const words of [
      'Mom',
      'Zeszyt cioci Oli, s. 12',
      'p.12 of the red book',
      'javascript:alert(1)',
    ]) {
      expect(saved(words)).toEqual({ sourceUrl: undefined, sourceText: words });
    }
  });

  it('opens an older recipe with words in the one field, and counts as something worth keeping', () => {
    const words = formFromRecipe({ ...plainRecipe, sourceText: "Aunt Ola's notebook" }, labels);
    expect(words.source).toBe("Aunt Ola's notebook");
    const empty = formFromDraft({})!;
    expect(hasContent(empty)).toBe(false);
    expect(hasContent({ ...empty, source: 'Babcia' })).toBe(true);
  });

  it('counts as a text edit only when it is words, which get translated', () => {
    const form = formFromRecipe(plainRecipe, labels);
    expect(formText({ ...form, source: 'https://example.com/a' })).toBe(formText(form));
    expect(formText({ ...form, source: "Aunt Ola's notebook" })).not.toBe(formText(form));
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
