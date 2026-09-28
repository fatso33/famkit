import {
  AuthorMode,
  BakingOptions,
  ForkPath,
  Ingredient,
  Recipe,
  RecipeCategory,
  Step,
} from '../types/recipe';
import { isRecipeCategory, recipePhoto } from './vault';
import { authorModeOf } from './ownership';
import { chosenPath, firstStepNumber, methodSections, numberSteps } from './recipeMethod';

/**
 * The recipe editor's state and the pure edits made to it. The form holds text as typed; it
 * becomes a Recipe on save (formToRecipe), dropping what's empty.
 */

export const MAX_SUBSTEPS = 3;
export const MAX_PATHS = 3;
export const DEFAULT_YIELD = 'For 1 loaf:';

let idCount = 0;
/** An id for a row, step or section, unique for this session. */
export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${(idCount++).toString(36)}`;

/** An ingredient row's text, as compared to tell an edited row from an untouched one. */
interface RowText {
  name: string;
  amount: string;
  note: string;
  substitute: string;
  substituteAmount: string;
}

export interface IngredientRowState extends RowText {
  id: string;
  /** Whether the note field is open (it can be while still empty). */
  showNote: boolean;
  showSubstitute: boolean;
  /**
   * The stored row it came from, with its text as first shown. While the row is untouched it's
   * written back as it was, so amounts stored as numbers (e.g. Wanda's) still scale.
   */
  source?: { ingredient: Ingredient; shown: RowText };
  /** Its position in the loaded recipe, for highlighting what a restored version changes. */
  origin?: number;
}

export interface TextItem {
  id: string;
  text: string;
}

export interface PathState {
  id: string;
  label: string;
  text: string;
  sameAsFirst: boolean;
  steps: TextItem[];
}

export interface ForkState {
  paths: PathState[];
  /** The path open in the editor. */
  active: number;
}

export interface StepState {
  id: string;
  /** What to do. A fork's paths each have their own. */
  text: string;
  plain: boolean;
  substeps: TextItem[];
  tip: string;
  showTip: boolean;
  imageSrc: string;
  imageCaption: string;
  fork: ForkState | null;
  origin?: number;
}

export interface SectionState {
  id: string;
  /** Empty: the default heading. */
  title: string;
  steps: StepState[];
}

export interface FormState {
  title: string;
  authorMode: AuthorMode;
  /** The typed name, used when the recipe is someone else's. */
  author: string;
  /** Empty until picked: a new recipe, or an older one saved before categories. */
  category: RecipeCategory | '';
  cardDescription: string;
  yieldHeader: string;
  heroImage: string;
  tips: string;
  notes: string;
  /** The time the author set, in minutes; null to estimate it from the steps. */
  manualMinutes: number | null;
  ingredientRows: IngredientRowState[];
  sections: SectionState[];
  /** The first numbered step's number: 1, or 0 for a recipe that starts at 0. */
  numberFrom: number;
}

/** Words the editor needs to turn an older recipe's extra blocks into steps. */
export interface LegacyLabels {
  /** Heading for the section its baking options become. */
  bakingSection: string;
  /** Names of its two baking options, for the fork's switch. */
  bakingPaths: readonly [string, string];
}

// --- New pieces -----------------------------------------------------------------------------

export const emptyRow = (): IngredientRowState => ({
  id: newId('ing'),
  name: '',
  amount: '',
  note: '',
  showNote: false,
  substitute: '',
  substituteAmount: '',
  showSubstitute: false,
});

export const textItem = (text = ''): TextItem => ({ id: newId('txt'), text });

export const emptyStep = (text = ''): StepState => ({
  id: newId('step'),
  text,
  plain: false,
  substeps: [],
  tip: '',
  showTip: false,
  imageSrc: '',
  imageCaption: '',
  fork: null,
});

export const emptySection = (title = ''): SectionState => ({
  id: newId('sec'),
  title,
  steps: [emptyStep()],
});

const emptyPath = (text = '', sameAsFirst = false): PathState => ({
  id: newId('path'),
  label: '',
  text,
  sameAsFirst,
  steps: [],
});

export const emptyForm = (): FormState => ({
  title: '',
  authorMode: 'auto',
  author: '',
  category: '',
  cardDescription: '',
  yieldHeader: DEFAULT_YIELD,
  heroImage: '',
  tips: '',
  notes: '',
  manualMinutes: null,
  ingredientRows: [emptyRow()],
  sections: [emptySection()],
  numberFrom: 1,
});

// --- From a recipe --------------------------------------------------------------------------

// Takes (bracketed notes) out of text: "Water (very warm)" → "Water" and "very warm".
function takeBrackets(text: string, notes: string[]): string {
  return text
    .replace(/\(([^)]+)\)|\[([^\]]+)\]/g, (_m, round?: string, square?: string) => {
      const inner = (round ?? square ?? '').trim();
      if (inner && !notes.includes(inner)) notes.push(inner);
      return '';
    })
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitNameAmount(raw: string): { name: string; amount: string } {
  if (raw.includes(' - ')) {
    const parts = raw.split(' - ');
    return { name: parts[0].trim(), amount: parts.slice(1).join(' - ').trim() };
  }
  return { name: raw.trim(), amount: '' };
}

function rowFromIngredient(ing: Ingredient, origin: number): IngredientRowState {
  const raw = ing.text || '';
  let shown: RowText;
  if (ing.note !== undefined) {
    // Saved by the current editor: the note is its own field, and brackets are just text.
    const { name, amount } =
      ing.name !== undefined && raw.startsWith(ing.name)
        ? { name: ing.name, amount: raw.slice(ing.name.length).replace(/^\s*-\s*/, '') }
        : splitNameAmount(raw);
    shown = {
      name: name.trim(),
      amount: amount.trim(),
      note: ing.note.trim(),
      substitute: '',
      substituteAmount: '',
    };
  } else {
    // Older rows keep notes in brackets; the note gets its own field now.
    let { name, amount } = splitNameAmount(raw);
    if (ing.name && ing.qty !== undefined && ing.qty !== null) {
      name = ing.name;
      amount = `${ing.qty} ${ing.unit || ''}`.trim();
    } else if (!raw.includes(' - ')) {
      // Also covers translated rows, which carry a name but no quantity field.
      name = raw || ing.name || '';
      amount = '';
    }
    const notes: string[] = [];
    name = takeBrackets(name, notes);
    amount = takeBrackets(amount, notes);
    shown = { name, amount, note: notes.join(', '), substitute: '', substituteAmount: '' };
  }
  shown.substitute = (ing.substitute ?? '').trim();
  shown.substituteAmount = (ing.substituteAmount ?? '').trim();
  return {
    id: newId('ing'),
    ...shown,
    showNote: Boolean(shown.note),
    showSubstitute: Boolean(shown.substitute || shown.substituteAmount),
    source: { ingredient: ing, shown: { ...shown } },
    origin,
  };
}

function stepFromRecipe(step: Step, origin: number): StepState {
  const paths = step.fork?.paths ?? [];
  return {
    id: newId('step'),
    text: step.text ?? '',
    plain: Boolean(step.plain),
    substeps: (step.substeps ?? []).slice(0, MAX_SUBSTEPS).map((s) => textItem(s)),
    tip: step.notes ?? '',
    showTip: Boolean(step.notes?.trim()),
    imageSrc: step.imageSrc ?? '',
    imageCaption: step.imageCaption ?? '',
    fork:
      paths.length >= 2
        ? {
            active: 0,
            paths: paths.slice(0, MAX_PATHS).map((p: ForkPath, i) => ({
              id: newId('path'),
              label: p.label ?? '',
              text: p.text ?? (i === 0 ? step.text : ''),
              sameAsFirst: i > 0 && Boolean(p.sameAsFirst),
              steps: (p.steps ?? []).map((s) => textItem(s)),
            })),
          }
        : null,
    origin,
  };
}

const asText = (option: string | string[]) => (Array.isArray(option) ? option.join(' ') : option);
const asList = (option: string | string[]) => (Array.isArray(option) ? option : [option]);

/**
 * An older recipe's extra blocks, as steps: its lamination directive becomes unnumbered text
 * after the steps, and its two baking options a Baking section with a fork. The words stay
 * exactly as they were.
 */
function legacyMethod(recipe: Recipe, labels: LegacyLabels, sections: SectionState[]) {
  const directive = recipe.laminationDirective?.trim();
  if (directive) {
    sections.at(-1)!.steps.push({ ...emptyStep(directive), plain: true });
  }

  const { option1, option2 }: BakingOptions = recipe.bakingOptions ?? {};
  const first = option1 ? asText(option1).trim() : '';
  const second = option2
    ? asList(option2)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  if (!first && second.length === 0) return;

  let steps: StepState[];
  if (first && second.length > 0) {
    const fork: ForkState = {
      active: 0,
      paths: [
        { ...emptyPath(first), label: labels.bakingPaths[0] },
        {
          ...emptyPath(second[0]),
          label: labels.bakingPaths[1],
          steps: second.slice(1).map((s) => textItem(s)),
        },
      ],
    };
    steps = [{ ...emptyStep(first), fork }];
  } else {
    steps = (first ? [first] : second).map((text) => emptyStep(text));
  }
  sections.push({ id: newId('sec'), title: labels.bakingSection, steps });
}

/** The form for editing a recipe. */
export function formFromRecipe(recipe: Recipe, labels: LegacyLabels): FormState {
  const authorMode = authorModeOf(recipe);
  const steps = recipe.steps ?? [];
  const sections: SectionState[] = methodSections(steps).map((section) => ({
    id: newId('sec'),
    title: section.title,
    steps: section.steps.map((step, k) => stepFromRecipe(step, section.start + k)),
  }));
  if (sections.length === 0) sections.push(emptySection());
  legacyMethod(recipe, labels, sections);

  return {
    title: recipe.name || '',
    authorMode,
    author: authorMode === 'custom' ? recipe.author || '' : '',
    category: isRecipeCategory(recipe.category) ? recipe.category : '',
    cardDescription: recipe.cardDescription || '',
    yieldHeader: recipe.yieldHeader || DEFAULT_YIELD,
    // An older recipe saved with a stock photo in place of its own starts with none.
    heroImage: recipePhoto(recipe),
    tips: recipe.tips || '',
    notes: recipe.notes || '',
    manualMinutes:
      typeof recipe.manualMinutes === 'number' && recipe.manualMinutes > 0
        ? recipe.manualMinutes
        : null,
    ingredientRows:
      recipe.ingredients?.length > 0
        ? recipe.ingredients.map((ing, i) => rowFromIngredient(ing, i))
        : [emptyRow()],
    sections,
    numberFrom: firstStepNumber(steps),
  };
}

// --- From a saved draft ---------------------------------------------------------------------

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const list = (v: unknown): Json[] => (Array.isArray(v) ? v.filter(isObject) : []);
const texts = (v: unknown, max = Infinity): TextItem[] =>
  (Array.isArray(v) ? v : [])
    .map((item) => (typeof item === 'string' ? item : isObject(item) ? str(item.text) : null))
    .filter((t): t is string => t !== null)
    .slice(0, max)
    .map((t) => textItem(t));

function draftRow(raw: Json): IngredientRowState {
  const row: IngredientRowState = {
    ...emptyRow(),
    name: str(raw.name),
    amount: str(raw.amount),
    note: str(raw.note),
    substitute: str(raw.substitute),
    substituteAmount: str(raw.substituteAmount),
  };
  row.showNote = raw.showNote === true || Boolean(row.note);
  row.showSubstitute = raw.showSubstitute === true || Boolean(row.substitute);
  return row;
}

function draftStep(raw: Json): StepState {
  const fork = isObject(raw.fork) ? list(raw.fork.paths).slice(0, MAX_PATHS) : [];
  const step: StepState = {
    ...emptyStep(str(raw.text)),
    plain: raw.plain === true,
    substeps: texts(raw.substeps, MAX_SUBSTEPS),
    // Drafts from before the redesign called the tip "notes".
    tip: str(raw.tip) || str(raw.notes),
    imageSrc: str(raw.imageSrc),
    imageCaption: str(raw.imageCaption),
  };
  step.showTip = raw.showTip === true || Boolean(step.tip);
  if (fork.length >= 2) {
    const active = isObject(raw.fork) && typeof raw.fork.active === 'number' ? raw.fork.active : 0;
    step.fork = {
      active: chosenPath({ paths: fork }, active),
      paths: fork.map((p, i) => ({
        ...emptyPath(str(p.text), i > 0 && p.sameAsFirst === true),
        label: str(p.label),
        steps: texts(p.steps),
      })),
    };
  }
  return step;
}

/** A saved create-mode draft as a form, or null if it isn't one. Drafts are checked field by field. */
export function formFromDraft(raw: unknown): FormState | null {
  if (!isObject(raw)) return null;
  const form = emptyForm();
  form.title = str(raw.title);
  form.author = str(raw.author);
  // Drafts from before the author choice only have a typed name.
  form.authorMode =
    raw.authorMode === 'auto' || raw.authorMode === 'custom'
      ? raw.authorMode
      : form.author
        ? 'custom'
        : 'auto';
  form.category = isRecipeCategory(raw.category) ? raw.category : '';
  form.cardDescription = str(raw.cardDescription);
  form.yieldHeader = str(raw.yieldHeader) || DEFAULT_YIELD;
  form.heroImage = recipePhoto({ heroImage: str(raw.heroImage) });
  form.tips = str(raw.tips);
  form.notes = str(raw.notes);
  form.manualMinutes =
    typeof raw.manualMinutes === 'number' && raw.manualMinutes > 0 ? raw.manualMinutes : null;
  form.numberFrom = raw.numberFrom === 0 ? 0 : 1;

  const rows = list(raw.ingredientRows).map(draftRow);
  if (rows.length > 0) form.ingredientRows = rows;

  const sections = list(raw.sections)
    .map((s) => ({ id: newId('sec'), title: str(s.title), steps: list(s.steps).map(draftStep) }))
    .filter((s) => s.steps.length > 0);
  // Drafts from before sections kept one list of steps.
  const steps = list(raw.steps).map(draftStep);
  if (sections.length > 0) form.sections = sections;
  else if (steps.length > 0) form.sections = [{ id: newId('sec'), title: '', steps }];
  return form;
}

// --- To a recipe ----------------------------------------------------------------------------

const rowText = (row: IngredientRowState): RowText => ({
  name: row.name.trim(),
  amount: row.amount.trim(),
  note: row.showNote ? row.note.trim() : '',
  substitute: row.showSubstitute ? row.substitute.trim() : '',
  substituteAmount: row.showSubstitute ? row.substituteAmount.trim() : '',
});

const sameText = (a: RowText, b: RowText) =>
  a.name === b.name &&
  a.amount === b.amount &&
  a.note === b.note &&
  a.substitute === b.substitute &&
  a.substituteAmount === b.substituteAmount;

/** The row as stored, or null when it's empty. */
export function rowToIngredient(row: IngredientRowState): Ingredient | null {
  const shown = rowText(row);
  if (!shown.name && !shown.amount) return null;
  if (row.source && sameText(shown, row.source.shown)) return row.source.ingredient;
  const ingredient: Ingredient = {
    text:
      shown.name && shown.amount ? `${shown.name} - ${shown.amount}` : shown.name || shown.amount,
    name: shown.name,
    note: shown.note,
  };
  if (shown.substitute) {
    ingredient.substitute = shown.substitute;
    if (shown.substituteAmount) ingredient.substituteAmount = shown.substituteAmount;
  }
  return ingredient;
}

/** The step as stored (its number comes later), or null when there's nothing in it. */
function stateToStep(state: StepState): Step | null {
  const photo = {
    hasImage: Boolean(state.imageSrc),
    imageSrc: state.imageSrc || undefined,
    imageCaption: state.imageCaption.trim() || undefined,
  };
  const notes = (state.showTip && state.tip.trim()) || undefined;

  if (state.fork) {
    const paths = state.fork.paths
      .map((p, i) => ({
        label: p.label.trim(),
        text: p.text.trim(),
        sameAsFirst: i > 0 && p.sameAsFirst,
        steps: p.steps.map((s) => s.text.trim()).filter(Boolean),
      }))
      .filter((p, i) => i === 0 || p.label || p.text || (!p.sameAsFirst && p.steps.length > 0));
    if (!paths.some((p) => p.text)) return null;
    if (paths.length < 2) {
      return { num: 0, text: paths[0].text, notes, ...photo };
    }
    return {
      num: 0,
      text: paths[0].text,
      notes,
      ...photo,
      fork: {
        paths: paths.map(({ label, text, sameAsFirst, steps }) => {
          const path: ForkPath = { label, text };
          if (sameAsFirst) path.sameAsFirst = true;
          else if (steps.length > 0) path.steps = steps;
          return path;
        }),
      },
    };
  }

  const text = state.text.trim();
  if (!text) return null;
  const substeps = state.plain ? [] : state.substeps.map((s) => s.text.trim()).filter(Boolean);
  return {
    num: 0,
    text,
    notes,
    ...photo,
    plain: state.plain || undefined,
    substeps: substeps.length > 0 ? substeps.slice(0, MAX_SUBSTEPS) : undefined,
  };
}

/** The method as stored: sections flattened into steps, empty ones dropped, numbers filled in. */
export function methodToSteps(sections: SectionState[], numberFrom: number): Step[] {
  const kept = sections
    .map((section) => ({
      title: section.title.trim(),
      steps: section.steps.map(stateToStep).filter((s): s is Step => s !== null),
    }))
    .filter((section) => section.steps.length > 0);

  const steps: Step[] = [];
  kept.forEach((section, s) => {
    section.steps.forEach((step, k) => {
      if (k === 0 && (s > 0 || section.title)) step.section = section.title;
      steps.push(step);
    });
  });
  // The numbers older app versions show, and the start that keeps a count from 0.
  const numbers = numberSteps(steps, numberFrom);
  steps.forEach((step, i) => {
    step.num = numbers[i] ?? 0;
  });
  return steps;
}

/** The recipe's content from the form, besides who wrote it. */
export function formToRecipe(form: FormState) {
  return {
    name: form.title.trim(),
    category: form.category,
    heroImage: form.heroImage,
    yieldHeader: form.yieldHeader.trim() || DEFAULT_YIELD,
    cardDescription: form.cardDescription.trim() || undefined,
    ingredients: form.ingredientRows
      .map(rowToIngredient)
      .filter((i): i is Ingredient => i !== null),
    tips: form.tips.trim() || undefined,
    notes: form.notes.trim() || undefined,
    steps: methodToSteps(form.sections, form.numberFrom),
    manualMinutes: form.manualMinutes ?? undefined,
    // Now steps in the method, so the old blocks go.
    laminationDirective: undefined,
    bakingOptions: undefined,
  };
}

/**
 * The form's readable text and the method's shape, for telling a real text edit apart from a
 * change to photos, author, category or time alone.
 */
export function formText(form: FormState): string {
  const recipe = formToRecipe(form);
  return JSON.stringify([
    recipe.name,
    recipe.cardDescription ?? '',
    recipe.yieldHeader,
    recipe.tips ?? '',
    recipe.notes ?? '',
    form.ingredientRows.map(rowText).filter((r) => r.name || r.amount),
    recipe.steps.map(({ hasImage: _h, imageSrc: _s, num: _n, ...text }) => text),
  ]);
}

/** Whether a new recipe's form has anything worth keeping as a draft. */
export function hasContent(form: FormState): boolean {
  return Boolean(
    form.title.trim() ||
    (form.authorMode === 'custom' && form.author.trim()) ||
    form.ingredientRows.some((r) => r.name.trim()) ||
    form.sections.some((s) => s.steps.some((st) => st.text.trim() || st.fork)),
  );
}

// --- Edits to the method ----------------------------------------------------------------------

/** Where a step is: its section and position there. */
function locate(sections: SectionState[], stepId: string) {
  for (let s = 0; s < sections.length; s++) {
    const k = sections[s].steps.findIndex((st) => st.id === stepId);
    if (k !== -1) return { s, k };
  }
  return null;
}

export function updateStep(
  sections: SectionState[],
  stepId: string,
  change: (step: StepState) => StepState,
): SectionState[] {
  return sections.map((section) =>
    section.steps.some((st) => st.id === stepId)
      ? { ...section, steps: section.steps.map((st) => (st.id === stepId ? change(st) : st)) }
      : section,
  );
}

/**
 * Moves a step up or down. Past the top or bottom of its section it crosses into the next one.
 * Returns the sections unchanged when it can't go further.
 */
export function moveStep(sections: SectionState[], stepId: string, dir: -1 | 1): SectionState[] {
  const at = locate(sections, stepId);
  if (!at) return sections;
  const target = at.k + dir;
  const inSection = target >= 0 && target < sections[at.s].steps.length;
  const neighbour = at.s + dir;
  if (!inSection && (neighbour < 0 || neighbour >= sections.length)) return sections;

  const next = sections.map((section) => ({ ...section, steps: [...section.steps] }));
  const [step] = next[at.s].steps.splice(at.k, 1);
  if (inSection) next[at.s].steps.splice(target, 0, step);
  else if (dir === -1) next[neighbour].steps.push(step);
  else next[neighbour].steps.unshift(step);
  return next;
}

/** Removes a step. `undo` puts it back where it was, into whatever the sections are by then. */
export function removeStep(sections: SectionState[], stepId: string) {
  const at = locate(sections, stepId);
  if (!at) return { sections, undo: (current: SectionState[]) => current };
  const step = sections[at.s].steps[at.k];
  const sectionId = sections[at.s].id;
  const next = sections.map((section, s) =>
    s === at.s ? { ...section, steps: section.steps.filter((st) => st.id !== stepId) } : section,
  );
  const undo = (current: SectionState[]) => {
    const home = current.find((section) => section.id === sectionId) ?? current[0];
    if (!home) return [{ ...emptySection(), steps: [step] }];
    return current.map((section) =>
      section === home
        ? {
            ...section,
            steps: [...section.steps.slice(0, at.k), step, ...section.steps.slice(at.k)],
          }
        : section,
    );
  };
  return { sections: next, undo };
}

/** Removes a section and its steps; `undo` puts it back. The first section always stays. */
export function removeSection(sections: SectionState[], sectionId: string) {
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index <= 0) return { sections, undo: (current: SectionState[]) => current };
  const section = sections[index];
  return {
    sections: sections.filter((s) => s.id !== sectionId),
    undo: (current: SectionState[]) => [
      ...current.slice(0, index),
      section,
      ...current.slice(index),
    ],
  };
}

/** Splits a step into two paths (its text goes to the first), or joins a fork back into one step. */
export function toggleFork(step: StepState): StepState {
  if (step.fork) {
    const open = step.fork.paths[step.fork.active] ?? step.fork.paths[0];
    return { ...step, text: open.text, fork: null };
  }
  return {
    ...step,
    plain: false,
    substeps: [],
    fork: { active: 0, paths: [emptyPath(step.text), emptyPath('', true)] },
  };
}

export function addPath(step: StepState): StepState {
  if (!step.fork || step.fork.paths.length >= MAX_PATHS) return step;
  const paths = [...step.fork.paths, emptyPath('', true)];
  return { ...step, fork: { paths, active: paths.length - 1 } };
}

export function removePath(step: StepState, index: number): StepState {
  if (!step.fork || index <= 0) return step;
  const paths = step.fork.paths.filter((_, i) => i !== index);
  if (paths.length < 2) return toggleFork({ ...step, fork: { paths, active: 0 } });
  return { ...step, fork: { paths, active: Math.min(step.fork.active, paths.length - 1) } };
}

export function updatePath(
  step: StepState,
  index: number,
  change: (path: PathState) => PathState,
): StepState {
  if (!step.fork) return step;
  return {
    ...step,
    fork: {
      ...step.fork,
      paths: step.fork.paths.map((path, i) => (i === index ? change(path) : path)),
    },
  };
}

/**
 * The number shown on each step, by id: null for unnumbered text. A fork's own steps are
 * listed under `${forkId}:${pathIndex}`, numbered for each path; the steps after a fork follow
 * the path open in the editor.
 */
export function editorNumbers(sections: SectionState[], numberFrom: number) {
  const steps = sections.flatMap((section) => section.steps);
  const choices: Record<number, number> = {};
  steps.forEach((step, i) => {
    if (step.fork) choices[i] = step.fork.active;
  });
  const numbers = numberSteps(steps, numberFrom, choices);
  const byId = new Map<string, number | null>();
  steps.forEach((step, i) => {
    byId.set(step.id, numbers[i]);
    step.fork?.paths.forEach((_path, p) => {
      byId.set(`${step.id}:${p}`, (numbers[i] ?? 0) + 1);
    });
  });
  return byId;
}

// --- Pasting ----------------------------------------------------------------------------------

const lines = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

/**
 * Ingredient rows from pasted lines: "Flour - 300 g", "Flour: 300 g" or "300 g flour". A line's
 * list marker ("- ", "• ") is dropped.
 */
export function pastedIngredients(text: string): IngredientRowState[] {
  return lines(text).map((line) => {
    const clean = line.replace(/^[-•*·]\s+/, '');
    const row = emptyRow();
    const dash = clean.split(' - ');
    const colon = clean.indexOf(':');
    const leading = clean.match(
      /^([\d\s/.,¼-¾⅐-⅞]+(?:\s*(?:cups?|tsp|teaspoons?|tbsp|tablespoons?|g|ml|kg|l|oz|lbs?|cloves?|slices?|pinch(?:es)?|handfuls?|szklank[aiy]?|łyżeczk[aiy]|łyżeczek|łyż(?:ka|ki|ek)|sztuk[aiy]?|szt\.?|dag|kostk[aiy]|opakowani[ae])\b)?)\s+(.+)$/i,
    );
    if (dash.length > 1) {
      row.name = dash[0].trim();
      row.amount = dash.slice(1).join(' - ').trim();
    } else if (colon > 0) {
      row.name = clean.slice(0, colon).trim();
      row.amount = clean.slice(colon + 1).trim();
    } else if (leading) {
      row.amount = leading[1].trim();
      row.name = leading[2].trim();
    } else {
      row.name = clean;
    }
    return row;
  });
}

/** Steps from pasted lines, without the numbering they came with ("1.", "2)", "Step 3:"). */
export function pastedSteps(text: string): StepState[] {
  return lines(text).map((line) =>
    emptyStep(
      line
        .replace(/^(?:step|krok)\s*\d+\s*[:.)-]?\s*/i, '')
        .replace(/^\d+\s*[.)]\s*/, '')
        .replace(/^[-•*·]\s+/, ''),
    ),
  );
}
