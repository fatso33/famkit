import { BakingOptions, ForkPath, Ingredient, LocalizedRecipeContent, Step } from '../types/recipe';

/**
 * A recipe's words, split into pieces: the title, each step, each fork label, each ingredient
 * row and so on. Translation works piece by piece, so an edit re-translates only the pieces it
 * changed, and the recipe's shape is rebuilt here rather than trusted to the model.
 *
 * A piece's key says where it sits (e.g. `steps:10:fork:1:label`); its fingerprint says what it
 * says. Translations are remembered by fingerprint, so moving a step doesn't lose its words.
 */

/** What a piece is, so the translator can word it for its place (a label stays short). */
export type TextKind =
  | 'title'
  | 'description'
  | 'yield'
  | 'tips'
  | 'notes'
  | 'step'
  | 'stepTip'
  | 'caption'
  | 'heading'
  | 'substep'
  | 'pathLabel'
  | 'pathText'
  | 'pathStep';

/** An ingredient row's words. Amounts used for scaling always stay with the original. */
export type IngredientWords = Pick<
  Ingredient,
  | 'text'
  | 'name'
  | 'prefix'
  | 'unit'
  | 'renderUnit'
  | 'renderUnitPlural'
  | 'altUnit'
  | 'suffix'
  | 'note'
  | 'substitute'
  | 'substituteAmount'
>;

export const INGREDIENT_WORD_KEYS = [
  'name',
  'prefix',
  'unit',
  'renderUnit',
  'renderUnitPlural',
  'altUnit',
  'suffix',
  'note',
  'substitute',
  'substituteAmount',
] as const;

export type Piece =
  | { key: string; kind: TextKind; text: string }
  | { key: string; kind: 'ingredient'; ingredient: IngredientWords };

/** A piece's translation: text for a text piece, the row's words for an ingredient. */
export type PieceValue = string | IngredientWords;

// FNV-1a (32-bit): a cheap fingerprint to tell whether words have changed.
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** The row's words, in a fixed order, with only the fields it has. */
export function ingredientWords(ing: Partial<Ingredient>): IngredientWords {
  const words: IngredientWords = { text: typeof ing.text === 'string' ? ing.text : '' };
  for (const key of INGREDIENT_WORD_KEYS) {
    const value = ing[key];
    if (typeof value === 'string') words[key] = value;
  }
  return words;
}

/** Fingerprint of what a piece says. Two pieces with the same words share a translation. */
export function pieceHash(piece: Piece): string {
  return piece.kind === 'ingredient'
    ? fnv1a(`i${JSON.stringify(ingredientWords(piece.ingredient))}`)
    : fnv1a(`t${piece.text}`);
}

export const pieceValue = (piece: Piece): PieceValue =>
  piece.kind === 'ingredient' ? piece.ingredient : piece.text;

const hasWords = (value: string | undefined): value is string => Boolean(value?.trim());

const optionEntries = (option: string | string[] | undefined): [string, string][] =>
  Array.isArray(option)
    ? option.map((text, j) => [String(j), text])
    : option === undefined
      ? []
      : [['', option]];

/**
 * Every piece with words in it, in reading order. Works on a recipe's text or on a stored
 * translation, which have the same shape.
 */
export function recipePieces(content: LocalizedRecipeContent): Piece[] {
  const pieces: Piece[] = [];
  const text = (key: string, kind: TextKind, value: string | undefined) => {
    if (hasWords(value)) pieces.push({ key, kind, text: value });
  };

  text('name', 'title', content.name);
  text('cardDescription', 'description', content.cardDescription);
  text('yieldHeader', 'yield', content.yieldHeader);
  text('tips', 'tips', content.tips);
  text('notes', 'notes', content.notes);
  text('laminationDirective', 'step', content.laminationDirective);
  for (const option of ['option1', 'option2'] as const) {
    for (const [j, value] of optionEntries(content.bakingOptions?.[option])) {
      text(j ? `bakingOptions:${option}:${j}` : `bakingOptions:${option}`, 'step', value);
    }
  }

  (content.ingredients ?? []).forEach((ing, i) => {
    text(`ingredients:${i}:section`, 'heading', ing.section);
    if (hasWords(ing.text) || hasWords(ing.name)) {
      pieces.push({
        key: `ingredients:${i}`,
        kind: 'ingredient',
        ingredient: ingredientWords(ing),
      });
    }
  });

  (content.steps ?? []).forEach((step, i) => {
    const at = `steps:${i}`;
    text(`${at}:text`, 'step', step.text);
    text(`${at}:notes`, 'stepTip', step.notes);
    text(`${at}:imageCaption`, 'caption', step.imageCaption);
    text(`${at}:section`, 'heading', step.section);
    step.substeps?.forEach((sub, j) => text(`${at}:substeps:${j}`, 'substep', sub));
    step.fork?.paths.forEach((path, k) => {
      text(`${at}:fork:${k}:label`, 'pathLabel', path.label);
      text(`${at}:fork:${k}:text`, 'pathText', path.text);
      path.steps?.forEach((sub, j) => text(`${at}:fork:${k}:steps:${j}`, 'pathStep', sub));
      text(`${at}:fork:${k}:notes`, 'stepTip', path.notes);
      text(`${at}:fork:${k}:imageCaption`, 'caption', path.imageCaption);
    });
  });
  return pieces;
}

/** Translated words for a piece, or undefined when there are none yet. */
export type PieceLookup = (piece: Piece) => PieceValue | undefined;

/**
 * The translation of `source`, in its exact shape, from translated pieces. A piece without a
 * translation keeps the original words and is left out of `pieceSources`, so it's asked for
 * again. `pieceSources` records, by key, the fingerprint of the words each piece translates.
 * Never contains undefined values (Firestore rejects them).
 */
export function buildTranslation(
  source: LocalizedRecipeContent,
  lookup: PieceLookup,
): { content: LocalizedRecipeContent; pieceSources: Record<string, string> } {
  const pieceSources: Record<string, string> = {};

  const text = (key: string, kind: TextKind, value: string): string => {
    if (!hasWords(value)) return value;
    const piece: Piece = { key, kind, text: value };
    const found = lookup(piece);
    if (typeof found !== 'string') return value;
    pieceSources[key] = pieceHash(piece);
    return found;
  };
  const optional = (key: string, kind: TextKind, value: string | undefined) =>
    value === undefined ? undefined : text(key, kind, value);

  const content: LocalizedRecipeContent = {};
  const set = <K extends keyof LocalizedRecipeContent>(
    key: K,
    value: LocalizedRecipeContent[K] | undefined,
  ) => {
    if (value !== undefined) content[key] = value;
  };

  set('name', optional('name', 'title', source.name));
  set('cardDescription', optional('cardDescription', 'description', source.cardDescription));
  set('yieldHeader', optional('yieldHeader', 'yield', source.yieldHeader));
  set('tips', optional('tips', 'tips', source.tips));
  set('notes', optional('notes', 'notes', source.notes));
  set('laminationDirective', optional('laminationDirective', 'step', source.laminationDirective));

  if (source.bakingOptions) {
    const bakingOptions: BakingOptions = {};
    for (const option of ['option1', 'option2'] as const) {
      const value = source.bakingOptions[option];
      if (Array.isArray(value)) {
        bakingOptions[option] = value.map((s, j) =>
          text(`bakingOptions:${option}:${j}`, 'step', s),
        );
      } else if (value !== undefined) {
        bakingOptions[option] = text(`bakingOptions:${option}`, 'step', value);
      }
    }
    content.bakingOptions = bakingOptions;
  }

  if (source.ingredients) {
    content.ingredients = source.ingredients.map((ing, i): Ingredient => {
      const section = optional(`ingredients:${i}:section`, 'heading', ing.section);
      const withSection = (row: IngredientWords): Ingredient =>
        section === undefined ? row : { ...row, section };
      const words = ingredientWords(ing);
      if (!hasWords(words.text) && !hasWords(words.name)) return withSection(words);
      const piece: Piece = { key: `ingredients:${i}`, kind: 'ingredient', ingredient: words };
      const found = lookup(piece);
      if (found === undefined || typeof found === 'string') return withSection(words);
      pieceSources[piece.key] = pieceHash(piece);
      return withSection(ingredientWords(found));
    });
  }

  if (source.steps) {
    content.steps = source.steps.map((step, i) => {
      const at = `steps:${i}`;
      const out: Step = { num: step.num, text: text(`${at}:text`, 'step', step.text ?? '') };
      const notes = optional(`${at}:notes`, 'stepTip', step.notes);
      const caption = optional(`${at}:imageCaption`, 'caption', step.imageCaption);
      const section = optional(`${at}:section`, 'heading', step.section);
      if (notes !== undefined) out.notes = notes;
      if (caption !== undefined) out.imageCaption = caption;
      if (section !== undefined) out.section = section;
      if (step.substeps) {
        out.substeps = step.substeps.map((s, j) => text(`${at}:substeps:${j}`, 'substep', s));
      }
      if (step.fork) {
        out.fork = {
          paths: step.fork.paths.map((path, k) => {
            const translated: ForkPath = {
              label: text(`${at}:fork:${k}:label`, 'pathLabel', path.label ?? ''),
              text: text(`${at}:fork:${k}:text`, 'pathText', path.text ?? ''),
            };
            if (path.steps) {
              translated.steps = path.steps.map((s, j) =>
                text(`${at}:fork:${k}:steps:${j}`, 'pathStep', s),
              );
            }
            const tip = optional(`${at}:fork:${k}:notes`, 'stepTip', path.notes);
            const caption = optional(`${at}:fork:${k}:imageCaption`, 'caption', path.imageCaption);
            if (tip !== undefined) translated.notes = tip;
            if (caption !== undefined) translated.imageCaption = caption;
            return translated;
          }),
        };
      }
      return out;
    });
  }

  return { content, pieceSources };
}
