import { RecipeCategory } from '../types/recipe';
import {
  FormState,
  IngredientRowState,
  PastedSection,
  addPastedMethod,
  emptyForm,
  emptyRow,
  foldForks,
  ingredientFromLine,
  pastedMethod,
  stepFromText,
  webAddress,
} from './recipeForm';

/**
 * Bringing a recipe in from a web page. Recipe sites describe their recipes to search engines
 * in a fixed format (schema.org's Recipe), as JSON-LD or as microdata in the page's markup.
 * That is what's read here: the site's own statement of its ingredients and steps. Only a page
 * that states neither is read by its headings, and the result says so (`guessed`). The words
 * are always the site's own, never reworded. Everything that arrives is untrusted and read
 * field by field.
 */

/** What the import worker sends back for a page (worker/src/lib.ts). */
export interface ImportedPage {
  /** The page's address after redirects. */
  url: string;
  /** The page's language, as it declares it ("pl", "en-GB"); empty when it doesn't. */
  lang: string;
  /** The page's JSON-LD blocks, as text. */
  jsonLd: string[];
  meta: { image: string; siteName: string };
  /** The page's markup, sent when its JSON-LD holds no recipe; empty otherwise. */
  html: string;
}

/** A recipe read from a page, as a form to check and save. */
export interface ImportedRecipe {
  form: FormState;
  /** The recipe's picture, to fetch and compress; empty when the page names none. */
  imageUrl: string;
  /**
   * The page doesn't state its ingredients and steps as data, so they were taken from the
   * lists under its "Ingredients" and "Method" headings: worth a closer look before saving.
   */
  guessed: boolean;
  /** No ingredient came with a number: some sites leave the amounts out of what they share. */
  amountsMissing: boolean;
}

/** Words the import needs from the app's translations. */
export interface ImportLabels {
  /** The yield line for a bare number of servings: "For 4 servings:". */
  servings: (n: number) => string;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

const MAX_INGREDIENTS = 150;
const MAX_STEPS = 150;
const MAX_DEPTH = 8;
const MAX_MARKUP_CHARS = 1_500_000;

/** The worker's reply as a page, or null when it isn't one. */
export function readImportedPage(raw: unknown): ImportedPage | null {
  if (!isObject(raw)) return null;
  const url = webAddress(str(raw.url));
  if (!url) return null;
  const meta = isObject(raw.meta) ? raw.meta : {};
  return {
    url,
    lang: str(raw.lang).slice(0, 20),
    jsonLd: asList(raw.jsonLd).filter((block): block is string => typeof block === 'string'),
    meta: { image: str(meta.image), siteName: plainText(meta.siteName).slice(0, 120) },
    html: str(raw.html).slice(0, MAX_MARKUP_CHARS),
  };
}

/**
 * Text as a person reads it: recipe sites often put HTML entities and tags ("&amp;", "<p>")
 * inside their data. Parsed in a detached document, which runs and loads nothing.
 */
export function plainText(value: unknown, keepLines = false): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return '';
  let text = value;
  if (/[<&]/.test(text)) {
    const html = text.replace(/<\s*br\s*\/?>|<\/\s*(?:p|li|div|h[1-6]|tr)\s*>/gi, '\n');
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    parsed.querySelectorAll('script, style, template').forEach((el) => el.remove());
    text = parsed.body.textContent ?? '';
  }
  const textLines = text
    .replaceAll(String.fromCharCode(0xa0), ' ')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return textLines.join(keepLines ? '\n' : ' ');
}

const typesOf = (node: Json) => asList(node['@type']).map((type) => str(type).toLowerCase());
const isType = (node: Json, type: string) =>
  typesOf(node).some((name) => name === type || name.endsWith(`/${type}`));

/** Every object in the data, with the ones that carry an @id listed under it. */
function collectNodes(value: unknown, nodes: Json[], byId: Map<string, Json>, depth = 0) {
  if (depth > MAX_DEPTH) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectNodes(item, nodes, byId, depth + 1));
  } else if (isObject(value)) {
    nodes.push(value);
    const id = str(value['@id']);
    // The fullest node wins: references carry the @id alone.
    if (id && Object.keys(value).length > Object.keys(byId.get(id) ?? {}).length) {
      byId.set(id, value);
    }
    Object.values(value).forEach((item) => collectNodes(item, nodes, byId, depth + 1));
  }
}

/** The node itself, or the one it points to by @id. */
const resolve = (value: unknown, byId: Map<string, Json>): unknown =>
  isObject(value) && Object.keys(value).length === 1 && typeof value['@id'] === 'string'
    ? (byId.get(value['@id']) ?? value)
    : value;

// --- The recipe's parts ------------------------------------------------------------------------

/** "PT1H30M" as minutes, or null. */
export function isoMinutes(value: unknown): number | null {
  const match = str(value)
    .trim()
    .match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:\d+(?:\.\d+)?S)?)?$/i);
  if (!match) return null;
  const minutes = Math.round(
    Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0),
  );
  return minutes > 0 && minutes <= 14 * 1440 ? minutes : null;
}

function minutesOf(recipe: Json): number | null {
  const time = (value: unknown) => isoMinutes(Array.isArray(value) ? value[0] : value);
  const total = time(recipe.totalTime);
  if (total) return total;
  const parts = (time(recipe.prepTime) ?? 0) + (time(recipe.cookTime) ?? 0);
  return parts > 0 ? parts : null;
}

/** The yield line: the site's own words ("12 cookies:"), or a bare number as servings. */
function yieldOf(recipe: Json, labels: ImportLabels): string | null {
  const stated = asList(recipe.recipeYield)
    .map((item) => plainText(item))
    .filter(Boolean);
  const worded = stated.find((text) => /\p{L}/u.test(text));
  if (worded) return `${worded.replace(/[:\s]+$/, '').slice(0, 80)}:`;
  const count = Number(stated[0]);
  return Number.isInteger(count) && count > 0 && count < 1000 ? labels.servings(count) : null;
}

/**
 * The picture's address, against the page's own address. Sites often list the same picture in
 * several sizes, thumbnails first ("bread-225x225.jpg"): the largest stated size wins, and a
 * picture with no size stated is taken for the original.
 */
function imageOf(value: unknown, byId: Map<string, Json>, pageUrl: string): string {
  let best = { href: '', pixels: 0 };
  for (const item of asList(value)) {
    const node = resolve(item, byId);
    const src = isObject(node) ? str(node.url) || str(node.contentUrl) : str(node);
    if (!src) continue;
    let href: string;
    try {
      const url = new URL(src.trim(), pageUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') continue;
      href = url.href;
    } catch {
      // Not an address: try the next one.
      continue;
    }
    const named = href.match(/-(\d{2,4})x(\d{2,4})\.[a-z]{3,4}(?:$|\?)/i);
    const stated = isObject(node) ? Number(node.width) * Number(node.height) : NaN;
    const pixels =
      stated > 0 ? stated : named ? Number(named[1]) * Number(named[2]) : Number.MAX_SAFE_INTEGER;
    if (pixels > best.pixels) best = { href, pixels };
  }
  return best.href;
}

// Word starts in a site's own category that place it in one of the vault's.
const CATEGORY_WORDS: [RecipeCategory, RegExp][] = [
  ['breakfast', /breakfast|brunch|śniadani/gi],
  ['soups', /soup|stew|zup/gi],
  ['breads', /bread|chleb|pieczyw|bułk/gi],
  ['cakes', /cake|dessert|cookie|pastr|ciast|deser|tort/gi],
  ['preserves', /preserve|jam|pickle|canning|przetwor|dżem|konfitur/gi],
  ['drinks', /drink|beverage|cocktail|smoothie|napoj|napój|koktajl/gi],
  ['sides', /side|salad|dodatk|sałatk|surówk/gi],
  ['mains', /main|dinner|entr[ée]e|lunch|obiad|dani[ea] główn/gi],
];

/** The vault category a site's category names, when it names exactly one. */
export function categoryFrom(value: unknown): RecipeCategory | '' {
  const stated = asList(value)
    .map((item) => plainText(item))
    .join(', ');
  // Word starts are checked by hand: \b doesn't take Polish letters for word characters.
  const found = CATEGORY_WORDS.filter(([, words]) =>
    [...stated.matchAll(words)].some((m) => m.index === 0 || !/\p{L}/u.test(stated[m.index - 1])),
  );
  return found.length === 1 ? found[0][0] : '';
}

function ingredientsOf(recipe: Json): IngredientRowState[] {
  return asList(recipe.recipeIngredient ?? recipe.ingredients)
    .map((item) => plainText(item))
    .filter(Boolean)
    .slice(0, MAX_INGREDIENTS)
    .map((line) => ingredientFromLine(line, true));
}

/** A step's text: its own, or the texts of the directions and tips it's made of. */
function stepText(node: unknown): string {
  if (!isObject(node)) return plainText(node, true);
  const own = plainText(node.text, true) || plainText(node.description, true);
  if (own) return own;
  const parts = asList(node.itemListElement).map(stepText).filter(Boolean);
  return parts.length > 0 ? parts.join('\n') : plainText(node.name, true);
}

/**
 * The method, from however the site wrote it: one block of text, a list of texts, a list of
 * steps, or sections of steps (each becomes a section here, under the site's heading).
 */
function methodOf(recipe: Json, byId: Map<string, Json>): PastedSection[] {
  const stated = recipe.recipeInstructions;
  if (typeof stated === 'string') return pastedMethod(plainText(stated, true));

  const sections: PastedSection[] = [{ title: '', steps: [] }];
  let count = 0;
  const add = (value: unknown, depth: number) => {
    const node = resolve(value, byId);
    if (depth > MAX_DEPTH || count >= MAX_STEPS) return;
    if (Array.isArray(node)) {
      node.forEach((item) => add(item, depth + 1));
    } else if (isObject(node) && isType(node, 'howtosection')) {
      sections.push({ title: plainText(node.name).replace(/:$/, '').slice(0, 80), steps: [] });
      asList(node.itemListElement).forEach((item) => add(item, depth + 1));
    } else if (isObject(node) && isType(node, 'itemlist')) {
      asList(node.itemListElement).forEach((item) => add(item, depth + 1));
    } else if (isObject(node) && isType(node, 'listitem') && node.item !== undefined) {
      add(node.item, depth + 1);
    } else {
      const step = stepFromText(stepText(node));
      if (!step) return;
      sections.at(-1)!.steps.push(step);
      count += 1;
    }
  };
  add(stated, 0);
  return foldForks(sections.filter((section) => section.steps.length > 0));
}

// --- Recipes written into the page's own markup ------------------------------------------------

// Where a microdata property keeps its value when it isn't the element's text.
const VALUE_ATTRIBUTE: Record<string, string> = {
  META: 'content',
  IMG: 'src',
  A: 'href',
  LINK: 'href',
  TIME: 'datetime',
  DATA: 'value',
};

/**
 * A microdata item (an element with `itemscope`) as the same kind of object JSON-LD gives:
 * its `itemprop`s by name, nested items as objects. Text values keep their markup, which
 * plainText() reads like any other.
 */
function microdataItem(scope: Element, depth = 0): Json {
  const item: Json = {};
  const type = scope.getAttribute('itemtype');
  if (type) item['@type'] = type.trim().split(/\s+/);
  const visit = (parent: Element) => {
    for (const el of parent.children) {
      const names = (el.getAttribute('itemprop') ?? '').trim().split(/\s+/).filter(Boolean);
      const nested = el.hasAttribute('itemscope');
      if (names.length > 0) {
        const attribute = VALUE_ATTRIBUTE[el.tagName];
        const value: unknown = nested
          ? depth < MAX_DEPTH
            ? microdataItem(el, depth + 1)
            : {}
          : ((attribute ? el.getAttribute(attribute) : null) ?? el.innerHTML);
        for (const name of names) {
          item[name] = name in item ? [...asList(item[name]), value] : value;
        }
      }
      // A nested item's properties are its own.
      if (!nested) visit(el);
    }
  };
  visit(scope);
  return item;
}

const isHeading = (el: Element) => /^H[1-6]$/.test(el.tagName);
const INGREDIENTS_HEADING = /^(?:ingredients|składniki)(?:\s|:|$)/i;
const METHOD_HEADING =
  /^(?:method|instructions|directions|preparation|steps|how to make it|przygotowanie|wykonanie|sposób (?:przygotowania|wykonania))\s*:?$/i;

/**
 * The list items between a heading and the next one ("Ingredients", then its list), or for a
 * method written as paragraphs, those.
 */
function listedUnder(doc: Document, heading: RegExp, paragraphsToo: boolean): string[] {
  const marks = [...doc.body.querySelectorAll('h1, h2, h3, h4, h5, h6, li, p')];
  const start = marks.findIndex((el) => isHeading(el) && heading.test(plainText(el.innerHTML)));
  if (start < 0) return [];
  const items: Element[] = [];
  const paragraphs: Element[] = [];
  for (const el of marks.slice(start + 1)) {
    if (isHeading(el)) break;
    if (el.tagName === 'P') {
      if (!el.closest('li')) paragraphs.push(el);
    } else if (!el.querySelector('li')) items.push(el);
  }
  return (items.length > 0 ? items : paragraphsToo ? paragraphs : [])
    .map((el) => plainText(el.innerHTML))
    .filter(Boolean)
    .slice(0, MAX_STEPS);
}

/**
 * The recipes in the page's markup: those it states as microdata, then (last, and marked as a
 * guess) one read from the lists under its "Ingredients" and "Method" headings, with whatever
 * else the page states about it. The markup is parsed in a detached document, which runs and
 * loads nothing, and is only ever read as text.
 */
function markupRecipes(page: ImportedPage): { recipe: Json; guessed: boolean }[] {
  if (!page.html) return [];
  const doc = new DOMParser().parseFromString(page.html, 'text/html');
  doc.querySelectorAll('script, style, template').forEach((el) => el.remove());
  const title = plainText(doc.querySelector('h1')?.innerHTML ?? '') || plainText(doc.title);
  const stated = [...doc.querySelectorAll('[itemscope][itemtype]')]
    .filter((el) => /schema\.org\/Recipe\s*$/i.test(el.getAttribute('itemtype') ?? ''))
    .map((el) => {
      const recipe = microdataItem(el);
      return { recipe: { ...recipe, name: recipe.name ?? title }, guessed: false };
    });

  // The page's furniture (menus, sign-up forms) has lists and headings of its own.
  doc.querySelectorAll('nav, header, footer, aside, form').forEach((el) => el.remove());
  const guess: Json = {
    ...stated[0]?.recipe,
    '@type': 'Recipe',
    name: stated[0]?.recipe.name ?? title,
    recipeIngredient: listedUnder(doc, INGREDIENTS_HEADING, false),
    recipeInstructions: listedUnder(doc, METHOD_HEADING, true),
  };
  return [...stated, { recipe: guess, guessed: true }];
}

// --- The recipe ----------------------------------------------------------------------------

/** Microdata may state a property more than once: the first stands. */
const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

/**
 * The recipe a page describes, as a form, or null when it describes none with both
 * ingredients and steps. Its JSON-LD is read first, then its microdata, then its headings;
 * where several recipes are stated the same way, the fullest is taken.
 */
export function recipeFromPage(page: ImportedPage, labels: ImportLabels): ImportedRecipe | null {
  const nodes: Json[] = [];
  const byId = new Map<string, Json>();
  for (const block of page.jsonLd) {
    try {
      collectNodes(JSON.parse(block) as unknown, nodes, byId);
    } catch {
      // A block that isn't valid JSON: the others may still hold the recipe.
    }
  }

  const candidates = [
    ...nodes.filter((node) => isType(node, 'recipe')).map((recipe) => ({ recipe, rank: 0 })),
    ...markupRecipes(page).map(({ recipe, guessed }) => ({ recipe, rank: guessed ? 2 : 1 })),
  ];
  let best: {
    recipe: Json;
    rank: number;
    rows: IngredientRowState[];
    method: PastedSection[];
  } | null = null;
  for (const { recipe, rank } of candidates) {
    // A better-stated recipe is never passed over for a fuller, worse-stated one.
    if (best && rank > best.rank) break;
    const rows = ingredientsOf(recipe);
    const method = methodOf(recipe, byId);
    if (rows.length === 0 || method.length === 0 || !plainText(first(recipe.name))) continue;
    if (!best || rows.length > best.rows.length) best = { recipe, rank, rows, method };
  }
  if (!best) return null;
  const { recipe, rows, method } = best;
  const form = emptyForm();
  return {
    form: {
      ...form,
      title: plainText(first(recipe.name)).slice(0, 200),
      // Credited to whoever adds it, like a recipe of their own; sourceUrl says where it came from.
      authorMode: 'auto',
      author: '',
      category: categoryFrom(recipe.recipeCategory),
      cardDescription: plainText(first(recipe.description)).slice(0, 2000),
      // A page that states no yield gets none, rather than the form's example.
      yieldHeader: yieldOf(recipe, labels) ?? '',
      manualMinutes: minutesOf(recipe),
      ingredientRows: rows.length > 0 ? rows : [emptyRow()],
      sections: addPastedMethod(form.sections, method),
      sourceUrl: page.url,
    },
    imageUrl: imageOf(recipe.image, byId, page.url) || imageOf(page.meta.image, byId, page.url),
    guessed: best.rank === 2,
    amountsMissing:
      rows.length >= 3 && !rows.some((row) => /\d|[¼-¾⅐-⅞]/.test(`${row.amount} ${row.name}`)),
  };
}

/** A pasted address as one to fetch: "example.com/soup" and "http://…" become https. */
export function importAddress(text: string): string {
  const typed = text.trim();
  if (!typed || /\s/.test(typed)) return '';
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(typed) ? typed : `https://${typed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol === 'http:') url.protocol = 'https:';
    // A real site's name has a dot in it.
    return url.protocol === 'https:' && url.hostname.includes('.') ? url.href : '';
  } catch {
    return '';
  }
}
