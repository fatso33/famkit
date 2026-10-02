import { Language, RecipeCategory } from './recipe';

/** A make's words in its other language (see utils/makeTranslation). */
export interface MakeTranslation {
  title?: string;
  note?: string;
  /** Fingerprint of the words this was translated from: a mismatch means it's out of date. */
  sourceHash?: string;
  /** For each translated piece ('title', 'note'), the fingerprint of the words it translates. */
  pieceSources?: Record<string, string>;
  /** When the translator last added to it. */
  translatedAt?: number;
  /** Pieces the translator got wrong twice, by key, with their words' fingerprint. */
  untranslated?: Record<string, string>;
}

/**
 * Something a family member made from a recipe, shared on the Makes page: `makes/{id}`. Only
 * the family member who added it may change it; anyone may heart it, and any phone may store
 * its translation. Never erased: deleting only marks it.
 */
export interface Make {
  id: string;
  /** The recipe it was made from. */
  recipeId: string;
  /** Optional: a make without one shows its recipe's name. */
  title?: string;
  note?: string;
  /** The photo, compressed and embedded like a recipe's. */
  photo: string;
  /** The day it was made, as YYYY-MM-DD on the maker's calendar. */
  madeOn?: string;
  /** Google email of the family member who added it. Only they may change it. */
  ownerEmail?: string;
  /** Their name as they last saved it. */
  ownerName?: string;
  /** Their name is the family list's, shown as written (see utils/ownership memberName). */
  ownerNameAsTyped?: boolean;
  /** Who has hearted it: their lowercase email, mapped to true. */
  hearts?: Record<string, true>;
  /** Language of `title` and `note`. Settled by the translator; the app language until then. */
  sourceLanguage?: Language;
  translations?: { en?: MakeTranslation; pl?: MakeTranslation };
  createdAt: number;
  updatedAt: number;
  /** Set when its maker deleted it. Deleted makes are hidden, never erased. */
  deletedAt?: number;
  /**
   * Only on this device's copy, never in the cloud: its photo is kept apart (services/photoStore)
   * and wasn't there to fill back in, so it's shown waiting for the photo until the cloud's copy
   * arrives, and is never saved from.
   */
  photoOmitted?: boolean;
}

/** What the Add Make form saves: everything its maker writes. */
export type MakeContent = Pick<Make, 'recipeId' | 'title' | 'note' | 'photo' | 'madeOn'>;

/** What the Makes page orders its makes by. */
export type MakesSortKey = 'newest' | 'hearts' | 'recipe' | 'maker';

/**
 * How the Makes page orders its makes: by what, and whether the other way round from that key's
 * natural order (the newest shared, the most hearted, recipes A to Z, makers A to Z).
 */
export interface MakesSort {
  by: MakesSortKey;
  reversed: boolean;
}

/** Which makes the Makes page shows. */
export interface MakesFilter {
  /** One maker, by makerKey; '' for everyone's makes. */
  maker: string;
  /** The category of the recipe each was made from, or every one. */
  category: RecipeCategory | 'all';
  /** One recipe's makes, by its id; '' for every recipe's. */
  recipeId: string;
  /** Only the makes this person has hearted. */
  hearted: boolean;
}
