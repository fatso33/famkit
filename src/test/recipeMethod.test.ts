import { describe, it, expect } from 'vitest';
import {
  chosenPath,
  firstStepNumber,
  methodSections,
  numberSteps,
  pathStepCount,
  pathSteps,
} from '../utils/recipeMethod';
import { Step, StepFork } from '../types/recipe';

const step = (text: string, extra: Partial<Step> = {}): Step => ({ num: 0, text, ...extra });

// Bake one of two ways: in the fridge first (two steps of its own), or straight away.
const bake: StepFork = {
  paths: [
    { label: 'Fridge', text: 'Chill overnight.', steps: ['Warm up.', 'Bake.'] },
    { label: 'Now', text: 'Bake at once.' },
  ],
};

describe('methodSections', () => {
  it('groups steps under the section each one starts', () => {
    const steps = [
      step('Mix.'),
      step('Knead.'),
      step('Preheat.', { section: 'Baking' }),
      step('Bake.'),
    ];
    expect(methodSections(steps).map((s) => [s.title, s.start, s.steps.length])).toEqual([
      ['', 0, 2],
      ['Baking', 2, 2],
    ]);
  });

  it("renames the first section from the first step's heading", () => {
    const sections = methodSections([step('Mix.', { section: ' Dough ' }), step('Knead.')]);
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe('Dough');
  });

  it('has no sections for no steps', () => {
    expect(methodSections([])).toEqual([]);
  });
});

describe('numberSteps', () => {
  it('runs on across sections and skips unnumbered text', () => {
    const steps = [
      step('Mix.'),
      step('Leave it for an hour.', { plain: true }),
      step('Shape.', { section: 'Shaping' }),
    ];
    expect(numberSteps(steps, 1)).toEqual([1, null, 2]);
  });

  it("carries on after a fork from the path the cook is on, counting that path's own steps", () => {
    const steps = [step('Mix.'), step('Chill overnight.', { fork: bake }), step('Slice.')];
    // The fridge path: 2 is the fork, 3 and 4 its own steps, so slicing is 5.
    expect(numberSteps(steps, 1)).toEqual([1, 2, 5]);
    // Baking at once has no steps of its own.
    expect(numberSteps(steps, 1, { 1: 1 })).toEqual([1, 2, 3]);
  });

  it("counts the first path's steps for a path that shares them", () => {
    const shared: StepFork = {
      paths: [bake.paths[0], { label: 'Also', text: 'x', sameAsFirst: true }],
    };
    expect(numberSteps([step('a', { fork: shared }), step('b')], 1, { 0: 1 })).toEqual([1, 4]);
  });

  it('starts from 0 for a recipe numbered from 0', () => {
    const steps = [step('Divide.', { num: 0 }), step('Mix.', { num: 1 })];
    expect(firstStepNumber(steps)).toBe(0);
    expect(numberSteps(steps, firstStepNumber(steps))).toEqual([0, 1]);
    expect(firstStepNumber([step('Mix.', { num: 1 })])).toBe(1);
    // Unnumbered text before it doesn't count.
    expect(firstStepNumber([step('Note.', { plain: true }), step('Mix.', { num: 0 })])).toBe(0);
  });
});

describe('fork paths', () => {
  it('falls back to the first path for a choice that no longer exists', () => {
    expect(chosenPath(bake, undefined)).toBe(0);
    expect(chosenPath(bake, 1)).toBe(1);
    expect(chosenPath(bake, 2)).toBe(0);
    expect(chosenPath(bake, -1)).toBe(0);
  });

  it("lists a path's own steps, or the first path's when it shares them", () => {
    const withShared: StepFork = {
      paths: [...bake.paths, { label: 'Same', text: 'Chill briefly.', sameAsFirst: true }],
    };
    expect(pathSteps(withShared, 0)).toEqual(['Warm up.', 'Bake.']);
    expect(pathSteps(withShared, 1)).toEqual([]);
    expect(pathSteps(withShared, 2)).toEqual(['Warm up.', 'Bake.']);
    expect(pathStepCount(withShared, 2)).toBe(2);
    expect(pathStepCount(withShared, 1)).toBe(0);
  });
});
