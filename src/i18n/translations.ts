import { Language, RecipeCategory, VaultSortKey } from '../types/recipe';
import { plPlural } from '../utils/polish';
import type { Season } from '../utils/season';

/** "2h 05m" ("45m" under an hour), from a number of minutes: short, to fit a card's row. */
function duration(minutes: number, hourMark: string): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  return `${hours}${hourMark} ${String(mins).padStart(2, '0')}m`;
}

/** "2h 05m". */
const durationEn = (minutes: number) => duration(minutes, 'h');

/** "2g 05m" (godziny, minuty). */
const durationPl = (minutes: number) => duration(minutes, 'g');

export interface UiTranslations {
  vaultTitle: string;
  vaultCaption: (recipes: number, cooks: number) => string;
  allRecipes: string;
  recipeCategories: Record<RecipeCategory, string>;
  categoryLabel: string;
  vaultSorts: Record<VaultSortKey, string>;
  /** Each sort's two directions: its natural order, then turned round. */
  vaultSortOrders: Record<VaultSortKey, readonly [string, string]>;
  openSearch: string;
  searchPlaceholder: string;
  closeSearch: string;
  filterRecipes: string;
  sortRecipes: string;
  sortBy: string;
  removeFilter: (label: string) => string;
  filterAuthor: string;
  allAuthors: string;
  /** The filter for recipes this person hasn't opened yet. */
  unseen: string;
  unseenCaption: (n: number) => string;
  /** Nothing left to show with only unseen recipes. */
  allSeen: string;
  recipeLayout: string;
  layoutCards: string;
  layoutList: string;
  recipesShown: (n: number) => string;
  noMatches: string;
  showAllRecipes: string;
  /** On a photo card whose recipe has no description, tip or note to show. */
  cardDescriptionFallback: string;
  ingredientsCount: (n: number) => string;
  thIngredient: string;
  thAmount: string;
  ingredients: string;
  for1Loaf: string;
  kitchenTip: string;
  crucialNote: string;
  prepSteps: string;
  laminationDirective: string;
  bakingOptions: string;
  option1Tag: string;
  option2Tag: string;
  installBannerText: string;
  installBtn: string;
  iosModalTitle: string;
  iosModalSubtitle: string;
  /** Trusted static HTML; `{icon}` marks where the Safari icon is drawn. */
  iosStep1: string;
  iosStep2: string;
  iosStep3: string;
  iosModalDone: string;
  backToRecipes: string;
  settings: string;
  themeToggle: string;
  textScaling: string;
  addRecipe: string;
  cancel: string;
  recipeTitle: string;
  authorLabel: string;
  authorSomeoneElse: string;
  authorShownAs: (name: string) => string;
  authorNameLabel: string;
  yieldHeader: string;
  heroPhoto: string;
  editRecipe: string;
  draftRestored: string;
  confirmClearDraft: string;
  addStep: string;
  removeStep: string;
  takePhoto: string;
  uploadPhoto: string;
  removePhoto: string;
  addIngredient: string;
  removeIngredient: string;
  /** A heading over part of the ingredient list, e.g. "For the sauce". */
  addIngredientHeading: string;
  ingredientHeadingLabel: string;
  ingredientHeadingPlaceholder: string;
  ingredientHeadingTools: string;
  removeIngredientHeading: string;
  ingredientHeadingRemoved: string;
  // Version history (only the recipe's author sees these, in the editor)
  versionHistory: string;
  versionLabel: (version: number) => string;
  currentVersion: string;
  versionLoading: string;
  versionLoadFailed: string;
  /** A recipe's photos haven't reached this phone yet, so it can't be edited. */
  photosStillLoading: string;
  restoredFrom: (version: number, date: string) => string;
  changesCount: (n: number) => string;
  noChanges: string;
  nextChange: string;
  keepCurrent: string;
  restoredChip: string;
  /** Over the edit's note, naming the version it changes. */
  changeNoteLabel: (version: number) => string;
  restoredNote: (version: number) => string;
  // Deleting and restoring recipes
  deleteRecipe: string;
  confirmDeleteRecipe: (name: string) => string;
  recipeDeleted: string;
  undo: string;
  deletedRecipes: string;
  deletedRecipesInfo: string;
  noDeletedRecipes: string;
  deletedAgo: (when: string) => string;
  restoreRecipe: string;
  restoreRecipeLabel: (name: string) => string;
  recipeRestored: string;
  byAuthor: (author: string) => string;
  /** Who added a recipe that is credited to someone else. */
  addedBy: (name: string) => string;
  emptyVault: string;
  emptyFilter: string;
  /** Formats a duration already rounded to 5 minutes, e.g. "~2 hrs 25 mins". */
  estimatedTime: (minutes: number) => string;
  // Screen-reader labels, tooltips and image descriptions
  logoAlt: string;
  languageToggle: string;
  decreaseTextSize: string;
  increaseTextSize: string;
  /** The menu's action on a recipe page: start a remix of it. */
  remixRecipe: string;
  installBannerLabel: string;
  dismissBanner: string;
  closeDialog: string;
  scaleIngredients: string;
  decreasePortion: string;
  increasePortion: string;
  ingredientsTableLabel: string;
  viewStepPhoto: string;
  stepPhotoAlt: string;
  photoZoomDialog: string;
  closePhotoPreview: string;
  enlargedPhotoAlt: string;
  photoPreviewAlt: string;
  ingredientNameLabel: (n: number) => string;
  ingredientAmountLabel: (n: number) => string;
  moveIngredientUp: string;
  moveIngredientDown: string;
  stepInstructionLabel: (n: number) => string;
  moveStepUp: (n: number) => string;
  moveStepDown: (n: number) => string;
  photoCaptionLabel: string;
  descriptionLabel: string;
  // The recipe editor
  editorTitleNew: string;
  editorTitleEdit: string;
  editorTitleRemix: string;
  /** Under the remix editor's title: the recipe it's a remix of. */
  remixingFrom: (name: string) => string;
  /** The remix mark's popover: what it's a remix of. */
  remixedFrom: string;
  /** The remix mark on a remix's page: opens where it came from. */
  showRemixOriginal: string;
  /** The original was deleted after the remix was made. */
  remixOriginalGone: string;
  /** The remix badge's popover title. */
  remixesTitle: string;
  /** The remix badge on a recipe's page, e.g. "3 remixes". */
  remixCount: (count: number) => string;
  save: string;
  draftSaved: string;
  paste: string;
  preview: string;
  backToEditing: string;
  startOver: string;
  /** Tag beside an optional field's label. */
  optional: string;
  photoHint: string;
  replacePhoto: string;
  remove: string;
  chooseCategory: string;
  recipeTime: string;
  timeAuto: string;
  timeSet: string;
  timeWorkedOut: string;
  timeSetByYou: string;
  hoursShort: string;
  minutesShort: string;
  hourMore: string;
  hourLess: string;
  minutesMore: string;
  minutesLess: string;
  /** A total time the author set, e.g. "2 hrs 10 mins" (no "about"). */
  totalTime: (minutes: number) => string;
  moveUp: string;
  moveDown: string;
  note: string;
  swap: string;
  ingredientNoteLabel: (n: number) => string;
  substituteLabel: (n: number) => string;
  substituteAmountLabel: (n: number) => string;
  /** The tools strip under a tapped row or step, for screen readers. */
  ingredientTools: (n: number) => string;
  stepTools: (n: number) => string;
  textTools: string;
  ingredientRemoved: string;
  /** A substitute on the recipe page: "or Margarine". */
  orSubstitute: (name: string) => string;
  moreSteps: string;
  renameSection: string;
  sectionName: string;
  done: string;
  removeSection: string;
  /** A later section's choice: its step numbers carry on, or start again. */
  stepNumbering: string;
  numberingCarryOn: string;
  numberingRestart: (first: number) => string;
  sectionRemoved: string;
  addSection: string;
  addSectionHint: string;
  textBetweenSteps: string;
  removeStepNumber: string;
  numberThisStep: string;
  substep: string;
  substepsFull: string;
  substepLabel: (letter: string) => string;
  removeSubstep: string;
  tip: string;
  stepTipLabel: (n: number) => string;
  photo: string;
  fork: string;
  stepRemoved: string;
  photoRemoved: string;
  forkRemoved: string;
  // Forks: a step done one of two or three ways
  pathsAtStep: string;
  pathLetter: (i: number) => string;
  pathName: string;
  pathText: string;
  pathThen: string;
  sameStepsAsFirst: string;
  ownSteps: string;
  addPathStep: string;
  pathStepLabel: (n: number) => string;
  removePathStep: string;
  pathCarriesOn: string;
  pathFollowsFirst: string;
  addPath: string;
  removePath: string;
  chooseOne: string;
  /** Names for an older recipe's two baking options, when they become a fork. */
  legacyBakingPaths: readonly [string, string];
  // Pasting, confirming and checking before a save
  pasteTitle: string;
  pasteInto: string;
  stepsHeading: string;
  pasteHelpIngredients: string;
  pasteHelpSteps: string;
  pasteTextLabel: string;
  pasteAdd: string;
  pastedIngredients: (n: number) => string;
  pastedSteps: (n: number) => string;
  /** Pasting both at once: "3 ingredients and 4 steps added". */
  pastedBoth: (ingredients: number, steps: number) => string;
  /** The paste sheet's two sources, and the website one's fields. */
  pasteFrom: string;
  pasteFromWebsite: string;
  pasteFromText: string;
  pasteUrlLabel: string;
  pasteUrlFromClipboard: string;
  pasteHelpWebsite: string;
  /** Shown with it when there's already something written in the form. */
  pasteWebsiteReplaces: string;
  clipboardUnavailable: string;
  importing: string;
  importDone: string;
  /** The page doesn't state its recipe as data, so it was read from under its headings. */
  importDoneGuessed: string;
  /** The page shares its ingredients without their amounts. */
  importDoneNoAmounts: string;
  /** In the photo's place while a page's picture is on its way, and if it never arrives. */
  importPhotoLoading: string;
  importPhotoFailed: string;
  importErrors: Record<
    'badAddress' | 'offline' | 'refused' | 'busy' | 'notAllowed' | 'noRecipe' | 'failed',
    string
  >;
  /** The yield line of a recipe whose page gives only a number of servings. */
  importServings: (n: number) => string;
  discardTitle: string;
  discardBody: string;
  discard: string;
  keepEditing: string;
  /** Saving: the Save pill's two choices. */
  saveChoices: string;
  saveToVault: string;
  /** Under Save to Recipe Box: who sees it, and as which version (null for a new recipe). */
  saveToVaultHint: (version: number | null) => string;
  saveDraft: (version: number) => string;
  saveDraftHint: string;
  /** A draft, named by the version it becomes. */
  draftLabel: (version: number) => string;
  draftSavedToast: (version: number) => string;
  draftSaveFailed: string;
  /** The recipe page's way back into its draft. */
  continueDraft: string;
  continueDraftLabel: (version: number) => string;
  /** Under a recipe's byline while some of it waits to be translated into the reader's language. */
  translationOnItsWay: string;
  yourDrafts: string;
  /** Over the vault's recipes, when drafts are shown above them. */
  familyRecipes: string;
  draftRibbon: string;
  untitledDraft: string;
  /** A draft in the vault, for screen readers. */
  draftNamed: (name: string) => string;
  /** Leaving the editor with changes. */
  leaveTitle: string;
  leaveBody: string;
  discardDraft: string;
  discardDraftBody: string;
  draftDiscarded: string;
  titleRequired: string;
  authorRequired: string;
  categoryRequired: string;
  ingredientsRequired: string;
  stepsRequired: string;
  // Sign-in splash
  welcomeTo: string;
  welcomeKitchen: string;
  connectWithGoogle: string;
  liftTheLid: string;
  /** Read out while the app finds out who is signed in. */
  appLoading: string;
  familyListUnavailable: string;
  // Floating menu, pages and settings
  menu: string;
  openMenu: string;
  closeMenu: string;
  pages: string;
  preferences: string;
  language: string;
  darkMode: string;
  recipeVault: string;
  makes: string;
  addMake: string;
  comingSoonToast: string;
  makesEmptyTitle: string;
  makesEmptyBody: string;
  seasonSection: string;
  seasonInfo: string;
  seasonAuto: string;
  /** Under "Automatic": which season the calendar gives today. */
  seasonAutoNow: (season: Season) => string;
  seasonNames: Record<Season, string>;
  /** Each season's palette, named for what inspired it. */
  seasonPalettes: Record<Season, string>;
  translationSection: string;
  translationInfo: string;
  translationOfflineNote: string;
  // Required reCAPTCHA attribution, shown because the badge would cover the menu button.
  recaptchaNoticeStart: string;
  privacyPolicy: string;
  recaptchaNoticeAnd: string;
  termsOfService: string;
  recaptchaNoticeEnd: string;
}

export const UI_TEXT: Record<Language, UiTranslations> = {
  en: {
    vaultTitle: 'Recipe Box',
    vaultCaption: (recipes: number, cooks: number) =>
      `${recipes} recipe${recipes === 1 ? '' : 's'} from ${cooks} cook${cooks === 1 ? '' : 's'}`,
    allRecipes: 'All recipes',
    recipeCategories: {
      breakfast: 'Breakfast',
      soups: 'Soups',
      mains: 'Mains',
      sides: 'Sides & salads',
      breads: 'Breads & baking',
      cakes: 'Cakes & desserts',
      preserves: 'Preserves',
      drinks: 'Drinks',
      other: 'Other',
    },
    categoryLabel: 'Category',
    vaultSorts: {
      time: 'Cooking time',
      name: 'Name',
      changed: 'Last added',
      cook: 'Cook',
      category: 'Category',
    },
    vaultSortOrders: {
      time: ['Quickest first', 'Longest first'],
      name: ['A to Z', 'Z to A'],
      changed: ['Newest first', 'Oldest first'],
      cook: ['A to Z', 'Z to A'],
      category: ['Breakfast to drinks', 'Drinks to breakfast'],
    },
    openSearch: 'Search recipes',
    searchPlaceholder: 'Recipes, cooks, ingredients…',
    closeSearch: 'Close search',
    filterRecipes: 'Filter recipes',
    sortRecipes: 'Sort recipes',
    sortBy: 'Sort by',
    removeFilter: (label: string) => `Remove filter: ${label}`,
    filterAuthor: 'Author',
    allAuthors: 'All authors',
    unseen: 'Unseen',
    unseenCaption: (n: number) =>
      n === 0 ? "You've opened every one" : `${n} you haven't opened yet`,
    allSeen: "Nothing new here: you've opened every one.",
    recipeLayout: 'Recipe layout',
    layoutCards: 'Cards',
    layoutList: 'List',
    recipesShown: (n: number) => `${n} recipe${n === 1 ? '' : 's'}`,
    noMatches: 'No recipes match that.',
    showAllRecipes: 'Show all recipes',
    cardDescriptionFallback: 'A time-tested family favorite.',
    ingredientsCount: (n: number) => `${n} ingredient${n === 1 ? '' : 's'}`,
    thIngredient: 'Ingredient',
    thAmount: 'Amount',
    ingredients: 'Ingredients',
    for1Loaf: 'For 1 loaf:',
    kitchenTip: 'Kitchen Tip',
    crucialNote: 'Crucial Note',
    prepSteps: 'Preparation Steps',
    laminationDirective: 'Lamination Directive',
    bakingOptions: 'Baking Options',
    option1Tag: 'Option 1 · Refrigerator Rest',
    option2Tag: 'Option 2 · Dutch Oven Bake',
    installBannerText: 'Install <strong>Family Kitchen</strong> for quick offline access',
    installBtn: 'Install',
    iosModalTitle: 'Install Family Kitchen',
    iosModalSubtitle: 'Add to your Home Screen in Safari',
    iosStep1: 'Tap the <strong>Share</strong> button {icon} in Safari (bottom or top bar).',
    iosStep2: 'Scroll down and tap <strong>Add to Home Screen</strong> {icon}.',
    iosStep3: 'Tap <strong>Add</strong> in the top-right corner to finish.',
    iosModalDone: 'Got it',
    backToRecipes: 'Back to Recipes',
    settings: 'Settings',
    themeToggle: 'Toggle Theme',
    textScaling: 'Text size',
    addRecipe: 'Add Recipe',
    cancel: 'Cancel',
    recipeTitle: 'Recipe name',
    authorLabel: 'Recipe by',
    authorSomeoneElse: 'Someone else',
    authorShownAs: (name: string) => `Shown as ${name}`,
    authorNameLabel: 'Whose recipe is it?',
    yieldHeader: 'Yield',
    heroPhoto: 'Photo',
    editRecipe: 'Edit Recipe',
    draftRestored: 'Unsaved work restored',
    confirmClearDraft: 'Start over? What you wrote here will be cleared.',
    addStep: 'Add step',
    removeStep: 'Remove step',
    takePhoto: 'Take photo',
    uploadPhoto: 'Choose photo',
    removePhoto: 'Remove photo',
    addIngredient: 'Add ingredient',
    removeIngredient: 'Remove ingredient',
    addIngredientHeading: 'Add heading',
    ingredientHeadingLabel: 'Ingredient heading',
    ingredientHeadingPlaceholder: 'e.g. For the sauce',
    ingredientHeadingTools: 'Tools for the heading',
    removeIngredientHeading: 'Remove heading',
    ingredientHeadingRemoved: 'Heading removed',
    versionHistory: 'Version history',
    versionLabel: (version: number) => `Version ${version}`,
    currentVersion: 'Current',
    versionLoading: 'Loading…',
    versionLoadFailed: "Couldn't load that version. Check your connection and try again.",
    photosStillLoading: "This recipe's photos are still loading. Try again in a moment.",
    restoredFrom: (version: number, date: string) => `Version ${version} from ${date}`,
    changesCount: (n: number) => `${n} change${n === 1 ? '' : 's'} highlighted`,
    noChanges: 'Same as the current version',
    nextChange: 'Next change',
    keepCurrent: 'Keep current',
    restoredChip: 'Restored',
    changeNoteLabel: (version: number) => `What changed since v${version}?`,
    restoredNote: (version: number) => `Restored version ${version}`,
    deleteRecipe: 'Remove recipe',
    confirmDeleteRecipe: (name: string) =>
      `Remove “${name}”? You can bring it back later from Settings.`,
    recipeDeleted: 'Recipe removed',
    undo: 'Undo',
    deletedRecipes: 'Removed recipes',
    deletedRecipesInfo: 'Recipes you remove are kept here, so you can bring them back.',
    noDeletedRecipes: "You haven't removed any recipes.",
    deletedAgo: (when: string) => `Removed ${when}`,
    restoreRecipe: 'Restore',
    restoreRecipeLabel: (name: string) => `Restore ${name}`,
    recipeRestored: 'Recipe restored',
    byAuthor: (author: string) => `By ${author}`,
    addedBy: (name: string) => `Added by ${name}`,
    emptyVault: 'No recipes yet. Add the first one from the menu.',
    emptyFilter: 'No recipes here yet.',
    estimatedTime: (minutes: number) => `~${durationEn(minutes)}`,
    logoAlt: 'Family Kitchen logo',
    languageToggle: 'Toggle language: English / Polish',
    decreaseTextSize: 'Decrease text size',
    increaseTextSize: 'Increase text size',
    remixRecipe: 'Remix Recipe',
    installBannerLabel: 'Install app banner',
    dismissBanner: 'Dismiss banner',
    closeDialog: 'Close',
    scaleIngredients: 'Scale ingredient quantities',
    decreasePortion: 'Decrease portion',
    increasePortion: 'Increase portion',
    ingredientsTableLabel: 'Recipe ingredients',
    viewStepPhoto: 'Click to view and zoom photo',
    stepPhotoAlt: 'Step consistency visual',
    photoZoomDialog: 'Step photo zoom',
    closePhotoPreview: 'Close image preview',
    enlargedPhotoAlt: 'Enlarged step photo',
    photoPreviewAlt: 'Photo preview',
    ingredientNameLabel: (n: number) => `Ingredient ${n}`,
    ingredientAmountLabel: (n: number) => `Amount for ingredient ${n}`,
    moveIngredientUp: 'Move ingredient up',
    moveIngredientDown: 'Move ingredient down',
    stepInstructionLabel: (n: number) => `Instruction for step ${n}`,
    moveStepUp: (n: number) => `Move step ${n} up`,
    moveStepDown: (n: number) => `Move step ${n} down`,
    photoCaptionLabel: 'Photo caption',
    descriptionLabel: 'Description',
    editorTitleNew: 'New Recipe',
    editorTitleEdit: 'Edit Recipe',
    editorTitleRemix: 'Remix Recipe',
    remixingFrom: (name: string) => `Remix of ${name}`,
    remixedFrom: 'Remixed from',
    showRemixOriginal: 'A remix: show the original recipe',
    remixOriginalGone: 'The original is no longer in the Recipe Box.',
    remixesTitle: 'Remixes',
    remixCount: (count: number) => `${count} ${count === 1 ? 'remix' : 'remixes'}`,
    save: 'Save',
    draftSaved: 'Kept on this phone',
    paste: 'Paste',
    preview: 'Preview',
    backToEditing: 'Back to editing',
    startOver: 'Start over',
    optional: 'optional',
    photoHint: 'The picture the family sees first',
    replacePhoto: 'Replace',
    remove: 'Remove',
    chooseCategory: 'Choose a category',
    recipeTime: 'Recipe time',
    timeAuto: 'Auto',
    timeSet: 'Set',
    timeWorkedOut: 'Worked out from the steps',
    timeSetByYou: 'Set by you',
    hoursShort: 'h',
    minutesShort: 'min',
    hourMore: 'One hour more',
    hourLess: 'One hour less',
    minutesMore: 'Five minutes more',
    minutesLess: 'Five minutes less',
    totalTime: (minutes: number) => durationEn(minutes),
    moveUp: 'Up',
    moveDown: 'Down',
    note: 'Note',
    swap: 'Swap',
    ingredientNoteLabel: (n: number) => `Note for ingredient ${n}`,
    substituteLabel: (n: number) => `Swap for ingredient ${n}`,
    substituteAmountLabel: (n: number) => `Amount of the swap for ingredient ${n}`,
    ingredientTools: (n: number) => `Tools for ingredient ${n}`,
    stepTools: (n: number) => `Tools for step ${n}`,
    textTools: 'Tools for the text between steps',
    ingredientRemoved: 'Ingredient removed',
    orSubstitute: (name: string) => `or ${name}`,
    moreSteps: 'More steps',
    renameSection: 'Rename section',
    sectionName: 'Section name',
    done: 'Done',
    removeSection: 'Remove section',
    stepNumbering: 'Step numbers',
    numberingCarryOn: 'Carry on',
    numberingRestart: (first: number) => `Start at ${first}`,
    sectionRemoved: 'Section removed',
    addSection: 'Add a section',
    addSectionHint: 'Baking, icing, filling…',
    textBetweenSteps: 'Text between steps',
    removeStepNumber: 'Remove the step number',
    numberThisStep: 'Number this step',
    substep: 'Substep',
    substepsFull: '26 at most',
    substepLabel: (letter: string) => `Substep ${letter})`,
    removeSubstep: 'Remove substep',
    tip: 'Tip',
    stepTipLabel: (n: number) => `Tip for step ${n}`,
    photo: 'Photo',
    fork: 'Fork',
    stepRemoved: 'Step removed',
    photoRemoved: 'Photo removed',
    forkRemoved: 'Paths joined into one step',
    pathsAtStep: 'Ways to do this step',
    pathLetter: (i: number) => `Path ${'ABC'[i] ?? i + 1}`,
    pathName: 'Name on the switch',
    pathText: 'What to do',
    pathThen: 'Then',
    sameStepsAsFirst: 'Same steps as A',
    ownSteps: 'Its own steps',
    addPathStep: 'Add a step to this path',
    pathStepLabel: (n: number) => `Step ${n} on this path`,
    removePathStep: 'Remove this step',
    pathCarriesOn: 'Then the recipe carries on below',
    pathFollowsFirst: "Follows path A's steps, then the recipe carries on below",
    addPath: 'Add a third path',
    removePath: 'Remove this path',
    chooseOne: 'Choose one',
    legacyBakingPaths: ['Refrigerator Rest', 'Dutch Oven Bake'],
    pasteTitle: 'Paste a recipe',
    pasteInto: 'Add to',
    stepsHeading: 'Steps',
    pasteHelpIngredients:
      'One ingredient per line, like “Flour - 300 g” or “2 cups flour”. Words in brackets after the name become its note, and a line ending in a colon becomes a heading.',
    pasteHelpSteps:
      'Numbers, letters and dashes are read for you: “1.” or “2)” starts a step, and “a)”, “1a” or dashes under a step become its substeps. With none of these, each line is a step.',
    pasteTextLabel: 'Text to paste',
    pasteAdd: 'Add',
    pastedIngredients: (n: number) => `${n} ingredient${n === 1 ? '' : 's'} added`,
    pastedSteps: (n: number) => `${n} step${n === 1 ? '' : 's'} added`,
    pastedBoth: (ingredients: number, steps: number) =>
      `${ingredients} ingredient${ingredients === 1 ? '' : 's'} and ${steps} step${steps === 1 ? '' : 's'} added`,
    pasteFrom: 'Paste from',
    pasteFromWebsite: 'Website',
    pasteFromText: 'Text',
    pasteUrlLabel: 'Recipe page address',
    pasteUrlFromClipboard: 'Paste the address you copied',
    pasteHelpWebsite:
      'The name, photo, ingredients and steps are filled in from the page, for you to check before saving.',
    pasteWebsiteReplaces: 'This replaces what you’ve written so far.',
    clipboardUnavailable: 'Couldn’t read what you copied. Press and hold the field to paste.',
    importing: 'Reading…',
    importDone: 'Recipe filled in. Look it over before saving.',
    importDoneGuessed:
      'Recipe filled in from the page’s headings, as this site doesn’t list it the usual way. Check it carefully before saving.',
    importDoneNoAmounts:
      'Recipe filled in, but this site doesn’t share its amounts. Add them before saving.',
    importPhotoLoading: 'Fetching the photo…',
    importPhotoFailed: 'The page’s photo couldn’t be fetched. You can add one yourself.',
    importErrors: {
      badAddress: 'That doesn’t look like a web address.',
      offline: 'You’re offline. Connect to the internet and try again.',
      refused: 'That site wouldn’t share the page. Try pasting the recipe as text.',
      busy: 'Too many recipes at once. Wait a minute and try again.',
      notAllowed: 'Sign in with your family account to add recipes from websites.',
      noRecipe: 'No recipe could be read from that page. Try pasting it as text.',
      failed: 'The recipe couldn’t be fetched. Try again in a moment.',
    },
    importServings: (n: number) => `For ${n} serving${n === 1 ? '' : 's'}:`,
    discardTitle: 'Discard your changes?',
    discardBody: "Closing now loses what you've changed since you opened the recipe.",
    discard: 'Discard',
    keepEditing: 'Keep editing',
    saveChoices: 'Save',
    saveToVault: 'Save to Recipe Box',
    saveToVaultHint: (version: number | null) =>
      version === null ? 'The family can see it' : `The family sees v${version}`,
    saveDraft: (version: number) => `Save draft v${version}`,
    saveDraftHint: 'Only you can see it. Finish it later.',
    draftLabel: (version: number) => `Draft v${version}`,
    draftSavedToast: (version: number) => `Draft v${version} saved`,
    draftSaveFailed: "Couldn't save the draft",
    continueDraft: 'Continue',
    continueDraftLabel: (version: number) => `Continue draft v${version}`,
    translationOnItsWay: 'The translation is on its way',
    yourDrafts: 'Your drafts',
    familyRecipes: 'Family recipes',
    draftRibbon: 'Draft',
    untitledDraft: 'Untitled recipe',
    draftNamed: (name: string) => `Draft: ${name}`,
    leaveTitle: 'Keep your changes?',
    leaveBody: 'Save them as a draft to finish later, or let them go.',
    discardDraft: 'Discard draft',
    discardDraftBody: 'This draft will be deleted for good. What the family sees stays as it is.',
    draftDiscarded: 'Draft discarded',
    titleRequired: 'Add a name to save the recipe',
    authorRequired: 'Add whose recipe it is',
    categoryRequired: 'Choose a category',
    ingredientsRequired: 'Add at least one ingredient',
    stepsRequired: 'Add at least one step',
    welcomeTo: 'Welcome to',
    welcomeKitchen: 'Family Kitchen',
    connectWithGoogle: 'Connect with Google',
    liftTheLid: 'Lift the lid',
    appLoading: 'Opening Family Kitchen…',
    familyListUnavailable:
      "We couldn't check the family list. Check your connection and try again.",
    menu: 'Menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    pages: 'Pages',
    preferences: 'Preferences',
    language: 'Language',
    darkMode: 'Dark mode',
    recipeVault: 'Recipe Box',
    makes: 'Makes',
    addMake: 'Add Make',
    comingSoonToast: 'Makes are coming soon!',
    makesEmptyTitle: 'No makes yet',
    makesEmptyBody: 'This is where your makes will live. Coming soon.',
    seasonSection: 'Seasons',
    seasonInfo:
      'The colours change with the seasons. Text stays just as easy to read all year round.',
    seasonAuto: 'Automatic',
    seasonAutoNow: (season: Season) =>
      `Follows the calendar, now ${UI_TEXT.en.seasonNames[season].toLowerCase()}`,
    seasonNames: { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' },
    seasonPalettes: {
      spring: 'Dill & Butter',
      summer: 'Baltic',
      autumn: 'Heirloom Hearth',
      winter: 'Porcelain & Cobalt',
    },
    translationSection: 'Recipe translation',
    translationInfo:
      'New and edited recipes are translated automatically between English and Polish, so everyone can read them in their own language.',
    translationOfflineNote:
      'Without an internet connection, a recipe shows in the language it was written in until its translation is ready.',
    recaptchaNoticeStart: 'This app is protected by reCAPTCHA, and the Google ',
    privacyPolicy: 'Privacy Policy',
    recaptchaNoticeAnd: ' and ',
    termsOfService: 'Terms of Service',
    recaptchaNoticeEnd: ' apply.',
  },
  pl: {
    vaultTitle: 'Przepiśnik',
    vaultCaption: (recipes: number, cooks: number) =>
      `${recipes} ${plPlural(recipes, 'przepis', 'przepisy', 'przepisów')} od ${cooks} ${cooks === 1 ? 'osoby' : 'osób'}`,
    allRecipes: 'Wszystkie przepisy',
    recipeCategories: {
      breakfast: 'Śniadania',
      soups: 'Zupy',
      mains: 'Dania główne',
      sides: 'Dodatki i sałatki',
      breads: 'Pieczywo i wypieki',
      cakes: 'Ciasta i desery',
      preserves: 'Przetwory',
      drinks: 'Napoje',
      other: 'Inne',
    },
    categoryLabel: 'Kategoria',
    vaultSorts: {
      time: 'Czas przygotowania',
      name: 'Nazwa',
      changed: 'Ostatnio dodane',
      cook: 'Autor',
      category: 'Kategoria',
    },
    vaultSortOrders: {
      time: ['Najpierw najszybsze', 'Najpierw najdłuższe'],
      name: ['Od A do Z', 'Od Z do A'],
      changed: ['Najpierw najnowsze', 'Najpierw najstarsze'],
      cook: ['Od A do Z', 'Od Z do A'],
      category: ['Od śniadań do napojów', 'Od napojów do śniadań'],
    },
    openSearch: 'Szukaj przepisów',
    searchPlaceholder: 'Przepisy, autorzy, składniki…',
    closeSearch: 'Zamknij wyszukiwanie',
    filterRecipes: 'Filtruj przepisy',
    sortRecipes: 'Sortuj przepisy',
    sortBy: 'Sortuj według',
    removeFilter: (label: string) => `Usuń filtr: ${label}`,
    filterAuthor: 'Autor',
    allAuthors: 'Wszyscy autorzy',
    unseen: 'Nieobejrzane',
    unseenCaption: (n: number) =>
      n === 0
        ? 'Wszystkie już obejrzane'
        : `${n} ${plPlural(n, 'przepis', 'przepisy', 'przepisów')} do obejrzenia`,
    allSeen: 'Nie ma tu nic nowego: wszystko już obejrzane.',
    recipeLayout: 'Układ przepisów',
    layoutCards: 'Karty',
    layoutList: 'Lista',
    recipesShown: (n: number) => `${n} ${plPlural(n, 'przepis', 'przepisy', 'przepisów')}`,
    noMatches: 'Żaden przepis tu nie pasuje.',
    showAllRecipes: 'Pokaż wszystkie przepisy',
    cardDescriptionFallback: 'Tradycyjny, sprawdzony przepis rodzinny.',
    ingredientsCount: (n: number) => `${n} ${plPlural(n, 'składnik', 'składniki', 'składników')}`,
    thIngredient: 'Składnik',
    thAmount: 'Ilość',
    ingredients: 'Składniki',
    for1Loaf: 'Na 1 bochenek:',
    kitchenTip: 'Wskazówka kuchenna',
    crucialNote: 'Ważna uwaga',
    prepSteps: 'Sposób przygotowania',
    laminationDirective: 'Instrukcja składania ciasta (laminowanie)',
    bakingOptions: 'Warianty pieczenia',
    option1Tag: 'Wariant 1 · Odpoczynek w lodówce',
    option2Tag: 'Wariant 2 · Pieczenie w garnku żeliwnym',
    installBannerText: 'Zainstaluj <strong>Family Kitchen</strong>, aby korzystać offline',
    installBtn: 'Zainstaluj',
    iosModalTitle: 'Zainstaluj Family Kitchen',
    iosModalSubtitle: 'Dodaj do ekranu początkowego w Safari',
    iosStep1: 'Dotknij przycisku <strong>Udostępnij</strong> {icon} na pasku Safari.',
    iosStep2: 'Przewiń w dół i wybierz <strong>Do ekranu początkowego</strong> {icon}.',
    iosStep3: 'Dotknij <strong>Dodaj</strong> w prawym górnym rogu ekranu.',
    iosModalDone: 'Rozumiem',
    backToRecipes: 'Powrót do przepisów',
    settings: 'Ustawienia',
    themeToggle: 'Zmień motyw',
    textScaling: 'Rozmiar tekstu',
    addRecipe: 'Dodaj Przepis',
    cancel: 'Anuluj',
    recipeTitle: 'Nazwa przepisu',
    authorLabel: 'Autor przepisu',
    authorSomeoneElse: 'Ktoś inny',
    authorShownAs: (name: string) => `Widoczne jako: ${name}`,
    authorNameLabel: 'Czyj to przepis?',
    yieldHeader: 'Wydajność',
    heroPhoto: 'Zdjęcie',
    editRecipe: 'Edytuj Przepis',
    draftRestored: 'Przywrócono niezapisaną pracę',
    confirmClearDraft: 'Zacząć od nowa? To, co tu napisano, zostanie usunięte.',
    addStep: 'Dodaj krok',
    removeStep: 'Usuń krok',
    takePhoto: 'Zrób zdjęcie',
    uploadPhoto: 'Wybierz zdjęcie',
    removePhoto: 'Usuń zdjęcie',
    addIngredient: 'Dodaj składnik',
    removeIngredient: 'Usuń składnik',
    addIngredientHeading: 'Dodaj nagłówek',
    ingredientHeadingLabel: 'Nagłówek składników',
    ingredientHeadingPlaceholder: 'np. Na sos',
    ingredientHeadingTools: 'Narzędzia nagłówka',
    removeIngredientHeading: 'Usuń nagłówek',
    ingredientHeadingRemoved: 'Usunięto nagłówek',
    versionHistory: 'Historia wersji',
    versionLabel: (version: number) => `Wersja ${version}`,
    currentVersion: 'Aktualna',
    versionLoading: 'Wczytywanie…',
    versionLoadFailed: 'Nie udało się wczytać tej wersji. Sprawdź połączenie i spróbuj ponownie.',
    photosStillLoading: 'Zdjęcia tego przepisu jeszcze się wczytują. Spróbuj ponownie za chwilę.',
    restoredFrom: (version: number, date: string) => `Wersja ${version} z ${date}`,
    changesCount: (n: number) =>
      `${n} ${plPlural(n, 'zaznaczona zmiana', 'zaznaczone zmiany', 'zaznaczonych zmian')}`,
    noChanges: 'Taka sama jak aktualna wersja',
    nextChange: 'Następna zmiana',
    keepCurrent: 'Zostaw aktualną',
    restoredChip: 'Przywrócone',
    changeNoteLabel: (version: number) => `Co się zmieniło od wersji ${version}?`,
    restoredNote: (version: number) => `Przywrócono wersję ${version}`,
    deleteRecipe: 'Usuń przepis',
    confirmDeleteRecipe: (name: string) =>
      `Usunąć „${name}”? Możesz go później przywrócić w Ustawieniach.`,
    recipeDeleted: 'Przepis usunięty',
    undo: 'Cofnij',
    deletedRecipes: 'Usunięte przepisy',
    deletedRecipesInfo:
      'Usunięte przez Ciebie przepisy są tu przechowywane, więc możesz je przywrócić.',
    noDeletedRecipes: 'Nie usunięto jeszcze żadnego przepisu.',
    deletedAgo: (when: string) => `Usunięto ${when}`,
    restoreRecipe: 'Przywróć',
    restoreRecipeLabel: (name: string) => `Przywróć: ${name}`,
    recipeRestored: 'Przepis przywrócony',
    byAuthor: (author: string) => `Autor: ${author}`,
    addedBy: (name: string) => `Dodane przez: ${name}`,
    emptyVault: 'Nie ma jeszcze żadnych przepisów. Dodaj pierwszy z menu.',
    emptyFilter: 'Nie ma tu jeszcze przepisów.',
    estimatedTime: (minutes: number) => `~${durationPl(minutes)}`,
    logoAlt: 'Logo Family Kitchen',
    languageToggle: 'Zmień język: angielski / polski',
    decreaseTextSize: 'Zmniejsz tekst',
    increaseTextSize: 'Powiększ tekst',
    remixRecipe: 'Zremiksuj Przepis',
    installBannerLabel: 'Baner instalacji aplikacji',
    dismissBanner: 'Zamknij baner',
    closeDialog: 'Zamknij',
    scaleIngredients: 'Przelicz ilości składników',
    decreasePortion: 'Zmniejsz porcję',
    increasePortion: 'Zwiększ porcję',
    ingredientsTableLabel: 'Składniki przepisu',
    viewStepPhoto: 'Kliknij, aby obejrzeć i powiększyć zdjęcie',
    stepPhotoAlt: 'Zdjęcie konsystencji ciasta w tym kroku',
    photoZoomDialog: 'Powiększenie zdjęcia kroku',
    closePhotoPreview: 'Zamknij podgląd zdjęcia',
    enlargedPhotoAlt: 'Powiększone zdjęcie kroku',
    photoPreviewAlt: 'Podgląd zdjęcia',
    ingredientNameLabel: (n: number) => `Składnik ${n}`,
    ingredientAmountLabel: (n: number) => `Ilość składnika ${n}`,
    moveIngredientUp: 'Przesuń składnik w górę',
    moveIngredientDown: 'Przesuń składnik w dół',
    stepInstructionLabel: (n: number) => `Opis kroku ${n}`,
    moveStepUp: (n: number) => `Przesuń krok ${n} w górę`,
    moveStepDown: (n: number) => `Przesuń krok ${n} w dół`,
    photoCaptionLabel: 'Podpis zdjęcia',
    descriptionLabel: 'Opis',
    editorTitleNew: 'Nowy Przepis',
    editorTitleEdit: 'Edytuj Przepis',
    editorTitleRemix: 'Remiks Przepisu',
    remixingFrom: (name: string) => `Remiks przepisu: ${name}`,
    remixedFrom: 'Remiks przepisu',
    showRemixOriginal: 'Remiks: pokaż oryginalny przepis',
    remixOriginalGone: 'Oryginału nie ma już w Przepiśniku.',
    remixesTitle: 'Remiksy',
    remixCount: (count: number) => `${count} ${plPlural(count, 'remiks', 'remiksy', 'remiksów')}`,
    save: 'Zapisz',
    draftSaved: 'Zachowano na tym telefonie',
    paste: 'Wklej',
    preview: 'Podgląd',
    backToEditing: 'Wróć do edycji',
    startOver: 'Zacznij od nowa',
    optional: 'opcjonalnie',
    photoHint: 'To zdjęcie rodzina zobaczy jako pierwsze',
    replacePhoto: 'Zmień',
    remove: 'Usuń',
    chooseCategory: 'Wybierz kategorię',
    recipeTime: 'Czas przygotowania',
    timeAuto: 'Auto',
    timeSet: 'Ustaw',
    timeWorkedOut: 'Obliczony na podstawie kroków',
    timeSetByYou: 'Ustawiony przez Ciebie',
    hoursShort: 'godz.',
    minutesShort: 'min',
    hourMore: 'Godzina więcej',
    hourLess: 'Godzina mniej',
    minutesMore: 'Pięć minut więcej',
    minutesLess: 'Pięć minut mniej',
    totalTime: (minutes: number) => durationPl(minutes),
    moveUp: 'W górę',
    moveDown: 'W dół',
    note: 'Notatka',
    swap: 'Zamiennik',
    ingredientNoteLabel: (n: number) => `Notatka do składnika ${n}`,
    substituteLabel: (n: number) => `Zamiennik składnika ${n}`,
    substituteAmountLabel: (n: number) => `Ilość zamiennika składnika ${n}`,
    ingredientTools: (n: number) => `Narzędzia składnika ${n}`,
    stepTools: (n: number) => `Narzędzia kroku ${n}`,
    textTools: 'Narzędzia tekstu między krokami',
    ingredientRemoved: 'Usunięto składnik',
    orSubstitute: (name: string) => `lub ${name}`,
    moreSteps: 'Dalsze kroki',
    renameSection: 'Zmień nazwę sekcji',
    sectionName: 'Nazwa sekcji',
    done: 'Gotowe',
    removeSection: 'Usuń sekcję',
    stepNumbering: 'Numeracja kroków',
    numberingCarryOn: 'Kontynuuj',
    numberingRestart: (first: number) => `Zacznij od ${first}`,
    sectionRemoved: 'Usunięto sekcję',
    addSection: 'Dodaj sekcję',
    addSectionHint: 'Pieczenie, lukier, nadzienie…',
    textBetweenSteps: 'Tekst między krokami',
    removeStepNumber: 'Usuń numer kroku',
    numberThisStep: 'Ponumeruj ten krok',
    substep: 'Podpunkt',
    substepsFull: 'Najwyżej 26',
    substepLabel: (letter: string) => `Podpunkt ${letter})`,
    removeSubstep: 'Usuń podpunkt',
    tip: 'Wskazówka',
    stepTipLabel: (n: number) => `Wskazówka do kroku ${n}`,
    photo: 'Zdjęcie',
    fork: 'Warianty',
    stepRemoved: 'Usunięto krok',
    photoRemoved: 'Usunięto zdjęcie',
    forkRemoved: 'Warianty połączone w jeden krok',
    pathsAtStep: 'Sposoby wykonania tego kroku',
    pathLetter: (i: number) => `Wariant ${'ABC'[i] ?? i + 1}`,
    pathName: 'Nazwa na przełączniku',
    pathText: 'Co zrobić',
    pathThen: 'Potem',
    sameStepsAsFirst: 'Te same kroki co A',
    ownSteps: 'Własne kroki',
    addPathStep: 'Dodaj krok do tego wariantu',
    pathStepLabel: (n: number) => `Krok ${n} w tym wariancie`,
    removePathStep: 'Usuń ten krok',
    pathCarriesOn: 'Potem przepis przechodzi do kolejnych kroków',
    pathFollowsFirst: 'Idzie krokami wariantu A, a potem przepis przechodzi do kolejnych kroków',
    addPath: 'Dodaj trzeci wariant',
    removePath: 'Usuń ten wariant',
    chooseOne: 'Wybierz wariant',
    legacyBakingPaths: ['Odpoczynek w lodówce', 'Pieczenie w garnku żeliwnym'],
    pasteTitle: 'Wklej przepis',
    pasteInto: 'Dodaj do',
    stepsHeading: 'Kroki',
    pasteHelpIngredients:
      'Jeden składnik w każdej linii, np. „Mąka - 300 g” albo „2 szklanki mąki”. Słowa w nawiasie po nazwie stają się uwagą do składnika, a linia zakończona dwukropkiem staje się nagłówkiem.',
    pasteHelpSteps:
      'Numery, litery i myślniki rozpoznajemy sami: „1.” lub „2)” zaczyna krok, a „a)”, „1a” lub myślniki pod krokiem stają się jego podpunktami. Bez takich oznaczeń każda linia to osobny krok.',
    pasteTextLabel: 'Tekst do wklejenia',
    pasteAdd: 'Dodaj',
    pastedIngredients: (n: number) =>
      `Dodano ${n} ${plPlural(n, 'składnik', 'składniki', 'składników')}`,
    pastedSteps: (n: number) => `Dodano ${n} ${plPlural(n, 'krok', 'kroki', 'kroków')}`,
    pastedBoth: (ingredients: number, steps: number) =>
      `Dodano ${ingredients} ${plPlural(ingredients, 'składnik', 'składniki', 'składników')} i ${steps} ${plPlural(steps, 'krok', 'kroki', 'kroków')}`,
    pasteFrom: 'Wklej z',
    pasteFromWebsite: 'Strona',
    pasteFromText: 'Tekst',
    pasteUrlLabel: 'Adres strony z przepisem',
    pasteUrlFromClipboard: 'Wklej skopiowany adres',
    pasteHelpWebsite:
      'Nazwa, zdjęcie, składniki i kroki zostaną uzupełnione ze strony. Sprawdź je przed zapisaniem.',
    pasteWebsiteReplaces: 'To zastąpi wszystko, co już tu wpisano.',
    clipboardUnavailable: 'Nie udało się odczytać schowka. Przytrzymaj pole, aby wkleić.',
    importing: 'Czytamy…',
    importDone: 'Przepis uzupełniony. Przejrzyj go przed zapisaniem.',
    importDoneGuessed:
      'Przepis odczytany z nagłówków strony, bo ta strona nie podaje go w zwykły sposób. Sprawdź go uważnie przed zapisaniem.',
    importDoneNoAmounts:
      'Przepis uzupełniony, ale ta strona nie podaje ilości składników. Dopisz je przed zapisaniem.',
    importPhotoLoading: 'Pobieramy zdjęcie…',
    importPhotoFailed: 'Nie udało się pobrać zdjęcia ze strony. Możesz dodać własne.',
    importErrors: {
      badAddress: 'To nie wygląda na adres strony.',
      offline: 'Brak połączenia. Połącz się z internetem i spróbuj ponownie.',
      refused: 'Ta strona nie udostępniła przepisu. Spróbuj wkleić go jako tekst.',
      busy: 'Za dużo przepisów naraz. Odczekaj minutę i spróbuj ponownie.',
      notAllowed: 'Zaloguj się rodzinnym kontem, aby dodawać przepisy ze stron.',
      noRecipe: 'Nie udało się odczytać przepisu z tej strony. Spróbuj wkleić go jako tekst.',
      failed: 'Nie udało się pobrać przepisu. Spróbuj ponownie za chwilę.',
    },
    importServings: (n: number) => `Na ${n} ${plPlural(n, 'porcję', 'porcje', 'porcji')}:`,
    discardTitle: 'Odrzucić zmiany?',
    discardBody: 'Jeśli zamkniesz teraz, stracisz zmiany wprowadzone od otwarcia przepisu.',
    discard: 'Odrzuć',
    keepEditing: 'Edytuj dalej',
    saveChoices: 'Zapisz',
    saveToVault: 'Zapisz w przepiśniku',
    saveToVaultHint: (version: number | null) =>
      version === null ? 'Rodzina go zobaczy' : `Rodzina zobaczy wersję ${version}`,
    saveDraft: (version: number) => `Zapisz szkic wersji ${version}`,
    saveDraftHint: 'Widzisz go tylko Ty. Dokończysz go później.',
    draftLabel: (version: number) => `Szkic wersji ${version}`,
    draftSavedToast: (version: number) => `Zapisano szkic wersji ${version}`,
    draftSaveFailed: 'Nie udało się zapisać szkicu',
    continueDraft: 'Kontynuuj',
    continueDraftLabel: (version: number) => `Kontynuuj szkic wersji ${version}`,
    translationOnItsWay: 'Tłumaczenie jest w drodze',
    yourDrafts: 'Twoje szkice',
    familyRecipes: 'Przepisy rodziny',
    draftRibbon: 'Szkic',
    untitledDraft: 'Przepis bez nazwy',
    draftNamed: (name: string) => `Szkic: ${name}`,
    leaveTitle: 'Zachować zmiany?',
    leaveBody: 'Zapisz je jako szkic, by dokończyć później, albo je odrzuć.',
    discardDraft: 'Odrzuć szkic',
    discardDraftBody:
      'Ten szkic zostanie usunięty na zawsze. To, co widzi rodzina, zostanie bez zmian.',
    draftDiscarded: 'Szkic odrzucony',
    titleRequired: 'Dodaj nazwę, aby zapisać przepis',
    authorRequired: 'Wpisz, czyj to przepis',
    categoryRequired: 'Wybierz kategorię',
    ingredientsRequired: 'Dodaj co najmniej jeden składnik',
    stepsRequired: 'Dodaj co najmniej jeden krok',
    welcomeTo: 'Witamy w',
    welcomeKitchen: 'Rodzinnej Kuchni',
    connectWithGoogle: 'Połącz przez Google',
    liftTheLid: 'Podnieś pokrywkę',
    appLoading: 'Otwieranie Rodzinnej Kuchni…',
    familyListUnavailable:
      'Nie udało się sprawdzić listy rodziny. Sprawdź połączenie i spróbuj ponownie.',
    menu: 'Menu',
    openMenu: 'Otwórz menu',
    closeMenu: 'Zamknij menu',
    pages: 'Strony',
    preferences: 'Preferencje',
    language: 'Język',
    darkMode: 'Tryb ciemny',
    recipeVault: 'Przepiśnik',
    makes: 'Popisy',
    addMake: 'Dodaj popis',
    comingSoonToast: 'Popisy już wkrótce!',
    makesEmptyTitle: 'Nie ma jeszcze popisów',
    makesEmptyBody: 'Tu wkrótce pojawią się Twoje popisy.',
    seasonSection: 'Pory roku',
    seasonInfo:
      'Kolory zmieniają się razem z porami roku. Tekst przez cały rok czyta się równie łatwo.',
    seasonAuto: 'Automatycznie',
    seasonAutoNow: (season: Season) =>
      `Według kalendarza, teraz ${UI_TEXT.pl.seasonNames[season].toLowerCase()}`,
    seasonNames: { spring: 'Wiosna', summer: 'Lato', autumn: 'Jesień', winter: 'Zima' },
    seasonPalettes: {
      spring: 'Koperek i masło',
      summer: 'Bałtyk',
      autumn: 'Domowe ognisko',
      winter: 'Porcelana i kobalt',
    },
    translationSection: 'Tłumaczenie przepisów',
    translationInfo:
      'Nowe i edytowane przepisy są automatycznie tłumaczone między polskim a angielskim, aby każdy mógł je przeczytać w swoim języku.',
    translationOfflineNote:
      'Bez połączenia z internetem przepis wyświetla się w języku, w którym został napisany, dopóki tłumaczenie nie będzie gotowe.',
    recaptchaNoticeStart: 'Ta aplikacja jest chroniona przez reCAPTCHA. Obowiązują ',
    privacyPolicy: 'Polityka prywatności',
    recaptchaNoticeAnd: ' oraz ',
    termsOfService: 'Warunki korzystania z usług',
    recaptchaNoticeEnd: ' Google.',
  },
};
