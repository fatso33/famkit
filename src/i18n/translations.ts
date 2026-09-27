import { Language } from '../types/recipe';

/** Polish noun form for a count: 1 składnik, 2–4 (and 22–24, …) składniki, else składników. */
function plPlural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  return lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14) ? few : many;
}

export interface UiTranslations {
  vaultTitle: string;
  vaultSubtitle: string;
  allRecipes: string;
  breads: string;
  heirlooms: string;
  recent: string;
  heirloomBadge: string;
  familyBadge: string;
  viewRecipe: string;
  ingredientsCount: (n: number) => string;
  thIngredient: string;
  thAmount: string;
  ingredients: string;
  for1Loaf: string;
  forNLoaves: (n: number) => string;
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
  cookModeOn: string;
  cookModeOff: string;
  cookModeUnsupported: string;
  cookModeTooltip: string;
  shareSuccess: string;
  shareFailed: string;
  backToRecipes: string;
  settings: string;
  themeToggle: string;
  textScaling: string;
  addRecipe: string;
  saveToVault: string;
  cancel: string;
  recipeTitle: string;
  authorLabel: string;
  authorMe: string;
  authorSomeoneElse: string;
  authorShownAs: (name: string) => string;
  authorNameLabel: string;
  yieldHeader: string;
  heroPhoto: string;
  photoOptionalHelp: string;
  ingredientsHelp: string;
  stepsHelp: string;
  tipsOptional: string;
  notesOptional: string;
  editRecipe: string;
  editRecipeTitle: (version: number) => string;
  clearDraft: string;
  draftRestored: string;
  confirmClearDraft: string;
  addStep: string;
  removeStep: string;
  stepNotesLabel: string;
  stepPhoto: string;
  takePhoto: string;
  uploadPhoto: string;
  removePhoto: string;
  addIngredient: string;
  removeIngredient: string;
  quickPaste: string;
  quickPasteTitle: string;
  quickPasteApply: string;
  // Version history (only the recipe's author sees these, in the editor)
  versionHistory: string;
  versionLabel: (version: number) => string;
  currentVersion: string;
  versionLoading: string;
  versionLoadFailed: string;
  restoredFrom: (version: number, date: string) => string;
  changesCount: (n: number) => string;
  noChanges: string;
  nextChange: string;
  keepCurrent: string;
  restoredChip: string;
  changeNoteLabel: string;
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
  shareText: (name: string, author: string) => string;
  saveChanges: string;
  // Screen-reader labels, tooltips and image descriptions
  logoAlt: string;
  languageToggle: string;
  decreaseTextSize: string;
  increaseTextSize: string;
  shareRecipe: string;
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
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
  zoomResetTitle: string;
  closePhotoPreview: string;
  enlargedPhotoAlt: string;
  photoPreviewAlt: string;
  ingredientNameLabel: (n: number) => string;
  ingredientAmountLabel: (n: number) => string;
  moveIngredientUp: string;
  moveIngredientDown: string;
  stepLabel: (n: number) => string;
  stepInstructionLabel: (n: number) => string;
  moveStepUp: (n: number) => string;
  moveStepDown: (n: number) => string;
  photoCaptionLabel: string;
  draftRestoredTooltip: string;
  descriptionOptional: string;
  // Sign-in splash
  welcomeTo: string;
  welcomeKitchen: string;
  connectWithGoogle: string;
  liftTheLid: string;
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
    vaultTitle: 'Family Recipe Vault',
    vaultSubtitle:
      'Heirloom family recipes crafted with precision, love, and time-honored tradition.',
    allRecipes: 'All Recipes',
    breads: 'Artisan Breads',
    heirlooms: 'Heirlooms',
    recent: 'Recent Additions',
    heirloomBadge: 'Heirloom',
    familyBadge: 'Family Recipe',
    viewRecipe: 'View Recipe →',
    ingredientsCount: (n: number) => `${n} ingredient${n === 1 ? '' : 's'}`,
    thIngredient: 'Ingredient',
    thAmount: 'Amount',
    ingredients: 'Ingredients',
    for1Loaf: 'For 1 loaf:',
    forNLoaves: (n: number) => `For ${n} ${n === 1 ? 'loaf' : 'loaves'}:`,
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
    cookModeOn: 'Cook Mode: On (Screen Awake)',
    cookModeOff: 'Cook Mode: Off',
    cookModeUnsupported: 'Screen Wake Lock is not supported on this browser.',
    cookModeTooltip: 'Keeps the screen awake while you cook',
    shareSuccess: 'Recipe link copied to clipboard!',
    shareFailed: "Couldn't copy the recipe link.",
    backToRecipes: 'Back to Recipes',
    settings: 'Settings',
    themeToggle: 'Toggle Theme',
    textScaling: 'Text size',
    addRecipe: 'Add Family Recipe',
    saveToVault: 'Save to Vault',
    cancel: 'Cancel',
    recipeTitle: 'Recipe Title *',
    authorLabel: 'Author',
    authorMe: 'Me',
    authorSomeoneElse: 'Someone else',
    authorShownAs: (name: string) => `Shown as ${name}`,
    authorNameLabel: 'Whose recipe is it?',
    yieldHeader: 'Yield Header *',
    heroPhoto: 'Hero Photo',
    photoOptionalHelp: 'Or leave blank to use an artisan kitchen placeholder photo.',
    ingredientsHelp: 'Ingredients (One per line) *',
    stepsHelp: 'Steps (One per line) *',
    tipsOptional: 'Tips (Optional)',
    notesOptional: 'Crucial Notes / Warnings (Optional)',
    editRecipe: 'Edit Recipe',
    editRecipeTitle: (version: number) => `Edit Recipe (v${version})`,
    clearDraft: 'Clear Draft',
    draftRestored: 'Draft restored',
    confirmClearDraft: 'Are you sure you want to clear your saved draft?',
    addStep: '+ Add Step',
    removeStep: 'Remove step',
    stepNotesLabel: 'Step Note / Consistency Cue (Optional)',
    stepPhoto: 'Step Photo (Optional)',
    takePhoto: 'Take Photo',
    uploadPhoto: 'Upload Photo',
    removePhoto: 'Remove photo',
    addIngredient: '+ Add Ingredient',
    removeIngredient: 'Remove ingredient',
    quickPaste: 'Bulk Paste',
    quickPasteTitle: 'Paste Ingredients List',
    quickPasteApply: 'Insert Ingredients',
    versionHistory: 'Version history',
    versionLabel: (version: number) => `Version ${version}`,
    currentVersion: 'Current',
    versionLoading: 'Loading…',
    versionLoadFailed: "Couldn't load that version. Check your connection and try again.",
    restoredFrom: (version: number, date: string) => `Version ${version} from ${date}`,
    changesCount: (n: number) => `${n} change${n === 1 ? '' : 's'} highlighted`,
    noChanges: 'Same as the current version',
    nextChange: 'Next change',
    keepCurrent: 'Keep current',
    restoredChip: 'Restored',
    changeNoteLabel: 'What changed? (optional)',
    restoredNote: (version: number) => `Restored version ${version}`,
    deleteRecipe: 'Delete recipe',
    confirmDeleteRecipe: (name: string) =>
      `Delete “${name}”? You can bring it back later from Settings.`,
    recipeDeleted: 'Recipe deleted',
    undo: 'Undo',
    deletedRecipes: 'Deleted recipes',
    deletedRecipesInfo: 'Recipes you delete are kept here, so you can bring them back.',
    noDeletedRecipes: "You haven't deleted any recipes.",
    deletedAgo: (when: string) => `Deleted ${when}`,
    restoreRecipe: 'Restore',
    restoreRecipeLabel: (name: string) => `Restore ${name}`,
    recipeRestored: 'Recipe restored',
    byAuthor: (author: string) => `By ${author}`,
    addedBy: (name: string) => `Added by ${name}`,
    emptyVault: 'No recipes yet. Add the first one from the menu.',
    emptyFilter: 'No recipes here yet.',
    estimatedTime: (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      const hrs = `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
      if (hours === 0) return `~${mins} mins`;
      return mins === 0 ? `~${hrs}` : `~${hrs} ${mins} mins`;
    },
    shareText: (name: string, author: string) => `${name} by ${author} - Heirloom Family Recipe`,
    saveChanges: 'Save Changes',
    logoAlt: 'Family Kitchen logo',
    languageToggle: 'Toggle language: English / Polish',
    decreaseTextSize: 'Decrease text size',
    increaseTextSize: 'Increase text size',
    shareRecipe: 'Share recipe',
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
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    zoomReset: 'Reset',
    zoomResetTitle: 'Reset zoom',
    closePhotoPreview: 'Close image preview',
    enlargedPhotoAlt: 'Enlarged step photo',
    photoPreviewAlt: 'Photo preview',
    ingredientNameLabel: (n: number) => `Ingredient ${n}`,
    ingredientAmountLabel: (n: number) => `Amount for ingredient ${n}`,
    moveIngredientUp: 'Move ingredient up',
    moveIngredientDown: 'Move ingredient down',
    stepLabel: (n: number) => `Step ${n}`,
    stepInstructionLabel: (n: number) => `Instruction for step ${n}`,
    moveStepUp: (n: number) => `Move step ${n} up`,
    moveStepDown: (n: number) => `Move step ${n} down`,
    photoCaptionLabel: 'Photo caption (optional)',
    draftRestoredTooltip: 'Restored from previous session',
    descriptionOptional: 'Description (Optional)',
    welcomeTo: 'Welcome to',
    welcomeKitchen: 'Family Kitchen',
    connectWithGoogle: 'Connect with Google',
    liftTheLid: 'Lift the lid',
    menu: 'Menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    pages: 'Pages',
    preferences: 'Preferences',
    language: 'Language',
    darkMode: 'Dark mode',
    recipeVault: 'Recipe Vault',
    makes: 'Makes',
    addMake: 'Add Make',
    comingSoonToast: 'Makes are coming soon!',
    makesEmptyTitle: 'No makes yet',
    makesEmptyBody: 'This is where your makes will live. Coming soon.',
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
    vaultTitle: 'Skarbiec Przepisów Rodzinnych',
    vaultSubtitle: 'Dziedzictwo kulinarnych sekretów przekazywane z pokolenia na pokolenie.',
    allRecipes: 'Wszystkie przepisy',
    breads: 'Chleby rzemieślnicze',
    heirlooms: 'Z tradycją',
    recent: 'Nowe przepisy',
    heirloomBadge: 'Przepis z tradycją',
    familyBadge: 'Przepis Rodzinny',
    viewRecipe: 'Zobacz przepis →',
    ingredientsCount: (n: number) => `${n} ${plPlural(n, 'składnik', 'składniki', 'składników')}`,
    thIngredient: 'Składnik',
    thAmount: 'Ilość',
    ingredients: 'Składniki',
    for1Loaf: 'Na 1 bochenek:',
    forNLoaves: (n: number) =>
      `Na ${n} ${n === 1 ? 'bochenek' : n >= 2 && n <= 4 ? 'bochenki' : 'bochenków'}:`,
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
    cookModeOn: 'Tryb gotowania: Włączony (ekran wybudzony)',
    cookModeOff: 'Tryb gotowania: Wyłączony',
    cookModeUnsupported: 'Funkcja blokady wygaszania ekranu nie jest wspierana.',
    cookModeTooltip: 'Ekran nie wygaśnie podczas gotowania',
    shareSuccess: 'Link do przepisu skopiowany do schowka!',
    shareFailed: 'Nie udało się skopiować linku do przepisu.',
    backToRecipes: 'Powrót do przepisów',
    settings: 'Ustawienia',
    themeToggle: 'Zmień motyw',
    textScaling: 'Rozmiar tekstu',
    addRecipe: 'Dodaj przepis rodzinny',
    saveToVault: 'Zapisz w skarbcu',
    cancel: 'Anuluj',
    recipeTitle: 'Tytuł przepisu *',
    authorLabel: 'Autor',
    authorMe: 'Ja',
    authorSomeoneElse: 'Ktoś inny',
    authorShownAs: (name: string) => `Widoczne jako: ${name}`,
    authorNameLabel: 'Czyj to przepis?',
    yieldHeader: 'Porcja wyjściowa *',
    heroPhoto: 'Zdjęcie główne',
    photoOptionalHelp: 'Pozostaw puste, aby użyć domyślnego zdjęcia rzemieślniczego.',
    ingredientsHelp: 'Składniki (jeden w każdym wierszu) *',
    stepsHelp: 'Kroki przygotowania (jeden w każdym wierszu) *',
    tipsOptional: 'Wskazówki (opcjonalnie)',
    notesOptional: 'Ważne uwagi i ostrzeżenia (opcjonalnie)',
    editRecipe: 'Edytuj przepis',
    editRecipeTitle: (version: number) => `Edytuj przepis (v${version})`,
    clearDraft: 'Wyczyść wersję roboczą',
    draftRestored: 'Przywrócono wersję roboczą',
    confirmClearDraft: 'Czy na pewno chcesz usunąć zapisaną wersję roboczą?',
    addStep: '+ Dodaj krok',
    removeStep: 'Usuń krok',
    stepNotesLabel: 'Wskazówka / Konsystencja dla kroku (opcjonalnie)',
    stepPhoto: 'Zdjęcie dla tego kroku (opcjonalnie)',
    takePhoto: 'Zrób zdjęcie',
    uploadPhoto: 'Wgraj zdjęcie',
    removePhoto: 'Usuń zdjęcie',
    addIngredient: '+ Dodaj składnik',
    removeIngredient: 'Usuń składnik',
    quickPaste: 'Wklej listę',
    quickPasteTitle: 'Wklej listę składników',
    quickPasteApply: 'Wstaw składniki',
    versionHistory: 'Historia wersji',
    versionLabel: (version: number) => `Wersja ${version}`,
    currentVersion: 'Aktualna',
    versionLoading: 'Wczytywanie…',
    versionLoadFailed: 'Nie udało się wczytać tej wersji. Sprawdź połączenie i spróbuj ponownie.',
    restoredFrom: (version: number, date: string) => `Wersja ${version} z ${date}`,
    changesCount: (n: number) =>
      `${n} ${plPlural(n, 'zaznaczona zmiana', 'zaznaczone zmiany', 'zaznaczonych zmian')}`,
    noChanges: 'Taka sama jak aktualna wersja',
    nextChange: 'Następna zmiana',
    keepCurrent: 'Zostaw aktualną',
    restoredChip: 'Przywrócone',
    changeNoteLabel: 'Co się zmieniło? (opcjonalnie)',
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
    estimatedTime: (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours === 0) return `~${mins} min`;
      return mins === 0 ? `~${hours} godz.` : `~${hours} godz. ${mins} min`;
    },
    shareText: (name: string, author: string) =>
      `${name} (${author}) – rodzinny przepis z tradycją`,
    saveChanges: 'Zapisz zmiany',
    logoAlt: 'Logo Family Kitchen',
    languageToggle: 'Zmień język: angielski / polski',
    decreaseTextSize: 'Zmniejsz tekst',
    increaseTextSize: 'Powiększ tekst',
    shareRecipe: 'Udostępnij przepis',
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
    zoomIn: 'Powiększ',
    zoomOut: 'Pomniejsz',
    zoomReset: 'Resetuj',
    zoomResetTitle: 'Przywróć oryginalny rozmiar',
    closePhotoPreview: 'Zamknij podgląd zdjęcia',
    enlargedPhotoAlt: 'Powiększone zdjęcie kroku',
    photoPreviewAlt: 'Podgląd zdjęcia',
    ingredientNameLabel: (n: number) => `Składnik ${n}`,
    ingredientAmountLabel: (n: number) => `Ilość składnika ${n}`,
    moveIngredientUp: 'Przesuń składnik w górę',
    moveIngredientDown: 'Przesuń składnik w dół',
    stepLabel: (n: number) => `Krok ${n}`,
    stepInstructionLabel: (n: number) => `Opis kroku ${n}`,
    moveStepUp: (n: number) => `Przesuń krok ${n} w górę`,
    moveStepDown: (n: number) => `Przesuń krok ${n} w dół`,
    photoCaptionLabel: 'Podpis zdjęcia (opcjonalnie)',
    draftRestoredTooltip: 'Przywrócono z poprzedniej sesji',
    descriptionOptional: 'Opis (opcjonalnie)',
    welcomeTo: 'Witamy w',
    welcomeKitchen: 'Rodzinnej Kuchni',
    connectWithGoogle: 'Połącz przez Google',
    liftTheLid: 'Podnieś pokrywkę',
    menu: 'Menu',
    openMenu: 'Otwórz menu',
    closeMenu: 'Zamknij menu',
    pages: 'Strony',
    preferences: 'Preferencje',
    language: 'Język',
    darkMode: 'Tryb ciemny',
    recipeVault: 'Skarbiec przepisów',
    makes: 'Wypieki',
    addMake: 'Dodaj wypiek',
    comingSoonToast: 'Wypieki już wkrótce!',
    makesEmptyTitle: 'Nie ma jeszcze wypieków',
    makesEmptyBody: 'Tu wkrótce pojawią się Twoje wypieki.',
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
