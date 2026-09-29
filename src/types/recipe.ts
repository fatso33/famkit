export interface Ingredient {
  text: string;
  name?: string;
  qty?: number | null;
  unit?: string;
  altQty?: number | null;
  altUnit?: string;
  prefix?: string;
  suffix?: string;
  renderUnit?: string;
  renderUnitPlural?: string;
  /**
   * The note shown under the name (e.g. "sifted"), typed in its own field. Rows saved by the
   * current editor always have it (empty when there's none); older rows don't, and show the text
   * in brackets instead.
   */
  note?: string;
  /** A suggested stand-in (e.g. "Margarine"), and how much of it. */
  substitute?: string;
  substituteAmount?: string;
  /**
   * This row starts a new part of the list, under this heading (e.g. "For the sauce"). Rows
   * before the first heading have none. Older app versions ignore it and show one list.
   */
  section?: string;
}

export interface Step {
  /**
   * Legacy: the number older app versions show. Numbers are worked out from the order now
   * (utils/recipeMethod). Only the first numbered step's still counts: 0 there means the
   * recipe numbers its steps from 0.
   */
  num: number;
  /** What to do. On a fork, the first path's text (older app versions show only this). */
  text: string;
  hasImage?: boolean;
  imageSrc?: string;
  imageCaption?: string;
  notes?: string;
  /** Unnumbered text shown between the steps. */
  plain?: boolean;
  /** Up to three smaller steps, shown as a), b), c). */
  substeps?: string[];
  /**
   * This step starts a new section with this heading. On the first step it renames the first
   * section; later, an empty heading still starts a section.
   */
  section?: string;
  /** The cook chooses between two or three ways of doing this step. */
  fork?: StepFork;
}

/** A step with two or three paths. The first path's text is also the step's text. */
export interface StepFork {
  paths: ForkPath[];
}

export interface ForkPath {
  /** The short name on the switch, e.g. "Oven". */
  label: string;
  /** What to do on this path. */
  text: string;
  /** Follows the first path's own steps, with its own text at the fork. */
  sameAsFirst?: boolean;
  /** Steps only this path has, numbered on from the fork. The recipe then carries on. */
  steps?: string[];
}

/** Legacy: earlier versions used to be kept inside the recipe, without photos. */
export interface RecipeHistoryEntry {
  version: number;
  savedAt: number;
  recipe: Omit<Recipe, 'history'>;
  changeNote?: string;
}

/** A recipe's content as it was at one version: everything except the version bookkeeping. */
export type RecipeSnapshot = Omit<Recipe, 'history' | 'versionIndex'>;

/** The list entry for a saved earlier version (kept on the recipe, so listing costs no reads). */
export interface VersionSummary {
  /** Document id in the recipe's `versions` collection. */
  id: string;
  version: number;
  /** When this version was saved (it stayed current until the next edit). */
  savedAt: number;
  /** The author's optional note on what this version changed. */
  note?: string;
}

/** A saved earlier version: `recipes/{recipeId}/versions/{id}`. Never changed once written. */
export interface RecipeVersion extends VersionSummary {
  recipe: RecipeSnapshot;
  /** False for versions from before photos were kept: restoring one leaves the photos alone. */
  hasPhotos: boolean;
}

export interface BakingOptions {
  option1?: string | string[];
  option2?: string | string[];
}

export interface LocalizedRecipeContent {
  name?: string;
  cardDescription?: string;
  yieldHeader?: string;
  tips?: string;
  notes?: string;
  laminationDirective?: string;
  ingredients?: Ingredient[];
  steps?: Step[];
  bakingOptions?: BakingOptions;
  /** Fingerprint of the source text this was translated from (see utils/recipeTranslation). */
  sourceHash?: string;
  /**
   * For each translated piece, by its key, the fingerprint of the words it translates (see
   * utils/translationPieces). Lets an edit keep the translation of every piece it didn't change.
   * Missing on translations made before pieces.
   */
  pieceSources?: Record<string, string>;
  /**
   * Set on translations stored since the translator was told to translate unit words. Missing
   * on older ones, whose pieces that kept the original's units ("Mąka - 2 cups") are asked for
   * once more (see utils/recipeTranslation).
   */
  unitsTranslated?: boolean;
}

export interface RecipeTranslations {
  en?: LocalizedRecipeContent;
  pl?: LocalizedRecipeContent;
  [lang: string]: LocalizedRecipeContent | undefined;
}

export interface Recipe {
  id: string;
  name: string;
  /** The name shown as the recipe's author (see `authorMode`). */
  author: string;
  /**
   * 'auto': the author is the family member who added it. 'custom': it's someone else's recipe
   * (e.g. a grandma who doesn't use the app), typed in. Missing on older records.
   */
  authorMode?: AuthorMode;
  /** Google email of the family member who added the recipe. Only they may edit it. */
  ownerEmail?: string;
  /** Their Google name when they added it, shown as "added by" on someone else's recipe. */
  ownerName?: string;
  /**
   * A RecipeCategory. Older records hold 'family' or 'heirloom', which the vault files under
   * 'other' until the owner picks a category (utils/vault).
   */
  category: RecipeCategory | string;
  version?: number;
  /** The author's optional note on what the current version changed. */
  changeNote?: string;
  /** Earlier versions, newest first. Their content is in the `versions` collection. */
  versionIndex?: VersionSummary[];
  /** Legacy inline history; moved into the `versions` collection on the next save. */
  history?: RecipeHistoryEntry[];
  heroImage: string;
  yieldHeader: string;
  baseYield?: number;
  ingredients: Ingredient[];
  cardDescription?: string;
  tips?: string;
  steps: Step[];
  /** Legacy: the editor turns it into unnumbered text after the steps. */
  laminationDirective?: string;
  /** Legacy: the editor turns it into a Baking section with a fork. */
  bakingOptions?: BakingOptions;
  notes?: string;
  /** The recipe's total time in minutes, when the author set it; otherwise it's estimated. */
  manualMinutes?: number;
  /** Language of the top-level text fields. Missing on older records, which are English. */
  sourceLanguage?: Language;
  translations?: RecipeTranslations;
  createdAt?: number;
  updatedAt?: number;
  /** Set when the owner deleted it. Deleted recipes are hidden, never erased, and can be restored. */
  deletedAt?: number;
  /**
   * Only on this device's quick-start copy (utils/deviceCopy), never in the cloud: its photos
   * were left out to fit, so it's shown until the full recipe arrives but never edited or saved.
   * `hero`: whether the recipe's own photo was one of them.
   */
  photosOmitted?: { hero: boolean };
}

export type AuthorMode = 'auto' | 'custom';
export type Language = 'en' | 'pl';
export type Theme = 'light' | 'dark';
/** What a recipe is, for filtering the vault. The order is the order the filter lists them in. */
export type RecipeCategory =
  'breakfast' | 'soups' | 'mains' | 'sides' | 'breads' | 'cakes' | 'preserves' | 'drinks' | 'other';

/** What the vault orders its recipes by. */
export type VaultSortKey = 'added' | 'time' | 'name' | 'changed' | 'cook' | 'category';

/**
 * How the vault orders its recipes: by what, and whether the other way round from that key's
 * natural order (newest, quickest, A to Z, most recently changed, cooks A to Z, the filter's
 * category order).
 */
export interface VaultSort {
  by: VaultSortKey;
  reversed: boolean;
}

/** How the vault lays its recipes out: photo cards, or a compact list. */
export type VaultView = 'cards' | 'list';

/** Which recipes the vault shows. */
export interface VaultFilter {
  category: RecipeCategory | 'all';
  /** One author, as utils/vault's authorKey gives their name; '' for everyone's recipes. */
  author: string;
  /** Only the recipes this person hasn't opened yet. */
  unseen: boolean;
  /** Search text, matched against names, cooks and ingredients. */
  query: string;
}

export interface ParsedIngredientRow {
  name: string;
  notes: string[];
  amount: string;
  originalText: string;
  /** The suggested stand-in, with its amount when given. */
  substitute?: { name: string; amount: string };
}
