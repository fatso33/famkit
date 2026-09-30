import {
  Ingredient,
  Language,
  Recipe,
  RecipeSnapshot,
  RecipeVersion,
  Step,
  VersionSummary,
} from '../types/recipe';

/** Document id for a version: readable in the Firebase console and unique per save. */
export const versionId = (version: number, savedAt: number) => `v${version}-${savedAt}`;

/** The recipe's content at this moment, photos included, without the version bookkeeping. */
export function snapshotOf(recipe: Recipe): RecipeSnapshot {
  const { history: _history, versionIndex: _index, ...snapshot } = recipe;
  return snapshot;
}

const summaryOf = ({ id, version, savedAt, note }: VersionSummary): VersionSummary => ({
  id,
  version,
  savedAt,
  note,
});

const newestFirst = (a: VersionSummary, b: VersionSummary) =>
  b.version - a.version || b.savedAt - a.savedAt;

/** Versions from the old inline history. Those were saved without photos. */
export function legacyVersions(recipe: Recipe): RecipeVersion[] {
  return (recipe.history ?? []).map((entry) => ({
    id: versionId(entry.version, entry.savedAt),
    version: entry.version,
    savedAt: entry.savedAt,
    note: entry.changeNote,
    hasPhotos: false,
    recipe: snapshotOf(entry.recipe as Recipe),
  }));
}

/** Earlier versions the owner can pick from, newest first. Listing them needs no reads. */
export function versionSummaries(recipe: Recipe): VersionSummary[] {
  const saved = recipe.versionIndex ?? [];
  const known = new Set(saved.map((v) => v.id));
  const legacy = legacyVersions(recipe).filter((v) => !known.has(v.id));
  return [...saved, ...legacy.map(summaryOf)].sort(newestFirst);
}

/**
 * Applies an edit on top of `existing`. The version being replaced is backed up whole (photos
 * too), the version number goes up, and any legacy inline history moves out to be stored with
 * the other versions. Returns the new record and the versions to write.
 */
export function prepareEdit(
  existing: Recipe,
  edited: Recipe,
  note: string,
  now: number,
): { recipe: Recipe; newVersions: RecipeVersion[] } {
  const currentVersion = existing.version ?? 1;
  const replacedAt = existing.updatedAt ?? existing.createdAt ?? now;
  const replaced: RecipeVersion = {
    id: versionId(currentVersion, replacedAt),
    version: currentVersion,
    savedAt: replacedAt,
    note: existing.changeNote,
    hasPhotos: true,
    recipe: snapshotOf(existing),
  };
  const indexed = new Set((existing.versionIndex ?? []).map((v) => v.id));
  const moved = legacyVersions(existing).filter((v) => !indexed.has(v.id) && v.id !== replaced.id);
  const newVersions = [replaced, ...moved];

  const { history: _history, ...rest } = edited;
  return {
    recipe: {
      ...rest,
      version: currentVersion + 1,
      changeNote: note.trim() || undefined,
      versionIndex: [...newVersions.map(summaryOf), ...(existing.versionIndex ?? [])].sort(
        newestFirst,
      ),
      updatedAt: now,
    },
    newVersions,
  };
}

/**
 * The current record with an earlier version's content. Identity, owner and version bookkeeping
 * stay current. Old versions saved without photos keep today's photos.
 */
export function recipeAtVersion(current: Recipe, version: RecipeVersion): Recipe {
  const merged: Recipe = {
    ...version.recipe,
    id: current.id,
    ownerEmail: current.ownerEmail,
    ownerName: current.ownerName,
    ownerNameAsTyped: current.ownerNameAsTyped,
    createdAt: current.createdAt,
    updatedAt: current.updatedAt,
    version: current.version,
    changeNote: current.changeNote,
    versionIndex: current.versionIndex,
    history: current.history,
  };
  if (version.hasPhotos) return merged;
  return {
    ...merged,
    heroImage: current.heroImage,
    steps: (merged.steps || []).map((st, i) => {
      const now = current.steps?.[i];
      return {
        ...st,
        hasImage: now?.hasImage,
        imageSrc: now?.imageSrc,
        fork: st.fork && {
          paths: st.fork.paths.map((path, k) => ({
            ...path,
            hasImage: now?.fork?.paths[k]?.hasImage,
            imageSrc: now?.fork?.paths[k]?.imageSrc,
          })),
        },
      };
    }),
  };
}

export type RestorableField =
  'name' | 'author' | 'cardDescription' | 'yieldHeader' | 'heroImage' | 'tips' | 'notes' | 'time';

/** What restoring a version would change, for highlighting in the edit form. */
export interface RecipeChanges {
  fields: ReadonlySet<RestorableField>;
  /** Positions of ingredient rows and steps that differ. */
  ingredients: ReadonlySet<number>;
  steps: ReadonlySet<number>;
  count: number;
}

const text = (s?: string) => (s ?? '').trim();

const ingredientKey = (ing?: Ingredient) =>
  ing
    ? JSON.stringify([
        text(ing.text),
        text(ing.name),
        ing.qty ?? null,
        text(ing.unit),
        text(ing.note),
        text(ing.substitute),
        text(ing.substituteAmount),
        ing.section === undefined ? null : text(ing.section),
      ])
    : '';

// The method's shape and wording besides a step's own text: sections, substeps and forks.
const stepShape = (step: Step) =>
  JSON.stringify([
    Boolean(step.plain),
    step.section === undefined ? null : text(step.section),
    (step.substeps ?? []).map(text),
    step.fork?.paths.map((p) => [
      text(p.label),
      text(p.text),
      Boolean(p.sameAsFirst),
      (p.steps ?? []).map(text),
      text(p.notes),
      text(p.imageCaption),
    ]) ?? null,
    Boolean(step.restart),
  ]);

const pathPhotos = (step?: Step) => (step?.fork?.paths ?? []).map((p) => p.imageSrc ?? '').join();

function stepDiffers(restored: Step, current: Step | undefined, photos: boolean) {
  if (!current) return true;
  return (
    text(restored.text) !== text(current.text) ||
    text(restored.notes) !== text(current.notes) ||
    text(restored.imageCaption) !== text(current.imageCaption) ||
    stepShape(restored) !== stepShape(current) ||
    (photos &&
      ((restored.imageSrc ?? '') !== (current.imageSrc ?? '') ||
        pathPhotos(restored) !== pathPhotos(current)))
  );
}

/**
 * Parts of `restored` (an earlier version) that differ from `current`. Something the earlier
 * version doesn't have (added later) isn't a change to highlight: it simply won't be there.
 * Photos count only when the version kept them.
 */
export function diffRecipes(current: Recipe, restored: Recipe, comparePhotos: boolean) {
  const fields = new Set<RestorableField>();
  const textFields = ['name', 'cardDescription', 'yieldHeader', 'tips', 'notes'] as const;
  for (const field of textFields) {
    const value = text(restored[field]);
    if (value && value !== text(current[field])) fields.add(field);
  }
  if (
    text(restored.author) !== text(current.author) ||
    (restored.authorMode ?? 'custom') !== (current.authorMode ?? 'custom')
  ) {
    fields.add('author');
  }
  if (comparePhotos && restored.heroImage && restored.heroImage !== current.heroImage) {
    fields.add('heroImage');
  }
  if ((restored.manualMinutes ?? null) !== (current.manualMinutes ?? null)) fields.add('time');

  const ingredients = new Set<number>();
  (restored.ingredients || []).forEach((ing, i) => {
    if (ingredientKey(ing) !== ingredientKey(current.ingredients?.[i])) ingredients.add(i);
  });

  const steps = new Set<number>();
  (restored.steps || []).forEach((st, i) => {
    if (stepDiffers(st, current.steps?.[i], comparePhotos)) steps.add(i);
  });

  const changes: RecipeChanges = {
    fields,
    ingredients,
    steps,
    count: fields.size + ingredients.size + steps.size,
  };
  return changes;
}

/** "12 Sep 2026, 14:05" / "12 wrz 2026, 14:05". */
export function formatVersionDate(timestamp: number, language: Language): string {
  return new Intl.DateTimeFormat(language === 'pl' ? 'pl-PL' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp);
}

// --- Validation of stored versions (read back from Firestore, so untrusted) ---------------

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A stored version, if it has the shape the form needs; otherwise null. */
export function parseRecipeVersion(raw: unknown): RecipeVersion | null {
  if (!isObject(raw) || !isObject(raw.recipe)) return null;
  const { id, version, savedAt, note, hasPhotos, recipe } = raw;
  if (typeof id !== 'string' || typeof version !== 'number' || typeof savedAt !== 'number') {
    return null;
  }
  if (
    typeof recipe.name !== 'string' ||
    !Array.isArray(recipe.ingredients) ||
    !Array.isArray(recipe.steps) ||
    !recipe.ingredients.every((ing) => isObject(ing) && typeof ing.text === 'string') ||
    !recipe.steps.every((st) => isObject(st) && typeof st.text === 'string')
  ) {
    return null;
  }
  return {
    id,
    version,
    savedAt,
    note: typeof note === 'string' ? note : undefined,
    hasPhotos: hasPhotos !== false,
    recipe: recipe as unknown as RecipeSnapshot,
  };
}
