import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTheme } from './hooks/useTheme';
import { useFontScale } from './hooks/useFontScale';
import { useSeason } from './hooks/useSeason';
import { useLanguage } from './hooks/useLanguage';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useRecipes, getLocalizedRecipe } from './hooks/useRecipes';
import { useToast } from './hooks/useToast';
import { useRecipeDownload } from './hooks/useRecipeDownload';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useBackStep } from './hooks/useBackStep';
import { useSeenRecipes } from './hooks/useSeenRecipes';
import { useDrafts } from './hooks/useDrafts';
import { useMakes } from './hooks/useMakes';
import { useCounterMemory } from './hooks/useCounter';
import { useSplashUp } from './hooks/useSplashUp';
import { useWideScreen } from './hooks/useWideScreen';
import { isFirebaseConfigured } from './services/firebase';
import { canEditRecipe, isOwnRecipe } from './utils/ownership';
import { hasLeftOutPhotos } from './utils/deviceCopy';
import {
  editingLanguage,
  localizeRecipe,
  recipeForEditing,
  resolveEdit,
} from './utils/recipeTranslation';
import { diffRecipes, recipeAtVersion, versionSummaries } from './utils/recipeVersions';
import { restorableRecipes } from './utils/recipeTrash';
import {
  draftFor,
  draftVersion,
  editDraftId,
  newDraftId,
  newRecipeDrafts,
} from './utils/recipeDrafts';
import { NO_FILTER } from './utils/vault';
import {
  getStoredMakesSort,
  getStoredVaultSort,
  getStoredVaultView,
  setStoredMakesSort,
  setStoredVaultSort,
  setStoredVaultView,
} from './services/storage';
import {
  isOnScreen,
  nameGlide,
  prefersReducedMotion,
  setFlipAxis,
  setWindowRect,
  nameOpeningWindow,
  nameTransitionPart,
  transitionTheme,
  transitionView,
  vaultItemKey,
  type NavMotion,
} from './utils/viewTransition';
import { familyNames, heartNews, latestMakes } from './utils/counter';
import { firstName } from './utils/greeting';
import { SeasonPreference } from './utils/season';
import {
  remixLanguage,
  remixOriginal,
  remixOriginalId,
  remixStart,
  remixesOf,
} from './utils/recipeRemix';
import { CookingPot, Download, PencilLine, Plus, Shuffle } from 'lucide-react';
import { NO_MAKES_FILTER, canEditMake, makeCounts, makesOf } from './utils/makes';
import { localizeMake } from './utils/makeTranslation';
import { NavIsland, MenuAction } from './components/layout/NavIsland';
import { NavDeck, NavDeckScrim, type DeckKind } from './components/layout/NavDeck';
import { RecipeDeck } from './components/recipe-grid/RecipeDeck';
import { MakesDeck } from './components/makes/MakesDeck';
import { InstallCard } from './components/layout/InstallCard';
import { RecipeGridView } from './components/recipe-grid/RecipeGridView';
import {
  RecipeDetailView,
  type RecipePageHandle,
} from './components/recipe-detail/RecipeDetailView';
import { AddRecipeModal, type DraftContent } from './components/recipe-form/AddRecipeModal';
import { IOSInstallModal } from './components/layout/IOSInstallModal';
import { DownloadSheet } from './components/recipe-detail/DownloadSheet';
import { MakesView, type MakesPageHandle } from './components/makes/MakesView';
import { AddMakeModal } from './components/makes/AddMakeModal';
import { SettingsView } from './components/settings/SettingsView';
import { CounterView, type CounterEntrance } from './components/counter/CounterView';
import { Toast } from './components/common/Toast';
import {
  Language,
  Recipe,
  RecipeDraft,
  RecipeVersion,
  VaultFilter,
  VaultSort,
  VaultView,
} from './types/recipe';
import { AppPage, MAIN_PAGES, MainPage } from './types/navigation';
import { Make, MakeContent, MakesFilter, MakesSort } from './types/make';

// Page changes jump straight to their scroll position: html's smooth scrolling would
// otherwise play out in the middle of the page transition.
const jumpTo = (top: number) => window.scrollTo({ top, behavior: 'instant' });

/** The centre of an element on screen, where a page can open out of it. */
const centreOf = (el: Element | null) => {
  if (!el) return undefined;
  const { left, top, width, height } = el.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2 };
};

/** Scrolls so the element sits in the middle of the screen (as far as the page allows). */
const centreOnScreen = (el: Element) => {
  const { top, height } = el.getBoundingClientRect();
  jumpTo(Math.max(0, window.scrollY + top + height / 2 - window.innerHeight / 2));
};

// A main page slides in from the side its tab sits on, on the navigation island.
const sideFrom = (from: MainPage, to: MainPage): NavMotion =>
  MAIN_PAGES.indexOf(to) > MAIN_PAGES.indexOf(from) ? 'side-next' : 'side-prev';

// How long a tapped card takes to lift out of the box before it flips (index.css, data-lifted).
const CARD_LIFT_MS = 200;

/** Whether a recipe card can flip open and shut (a view transition, and motion welcome). */
const canFlip = () => !!document.startViewTransition && !prefersReducedMotion();

interface NavigateOptions {
  /** False when the browser already animated it (the iOS back swipe). */
  animated?: boolean;
  /** False when the open recipe's card won't be there to flip back into. */
  morph?: boolean;
  /** How the page moves, when not the usual for where it's going. */
  motion?: NavMotion;
  /** Other state changes that belong to the same transition. */
  alongside?: () => void;
  /**
   * Going back to a page at the same depth (Makes back to the Recipe Box): it slides back like
   * any return, at its remembered spot, without its entrance.
   */
  back?: boolean;
}

/** A recipe's name or photo, or a make's photo, gliding between My Counter and its page. */
interface GlidePart {
  name: string;
  kind: 'name' | 'photo';
  /** Where it is on the page being left. */
  from: () => Element | null;
  /** Where it lands on the page arriving. */
  to: () => Element | null;
}

/**
 * Names the parts on the page being left, those on screen, so each glides to its place on the
 * next page (`arrive`, once that page is there, names the other ends that are on screen too).
 */
function nameGlides(parts: GlidePart[]) {
  const clears: (() => void)[] = [];
  const named = parts.filter((part) => {
    const el = part.from();
    if (!el || !isOnScreen(el)) return false;
    clears.push(nameGlide(el, part.name, part.kind));
    return true;
  });
  return {
    arrive: () => {
      for (const part of named) {
        const el = part.to();
        if (el && isOnScreen(el)) clears.push(nameGlide(el, part.name, part.kind));
      }
    },
    clear: () => {
      for (const clear of clears) clear();
    },
  };
}

const counterMake = (key: string) => document.querySelector(`[data-counter-make="${key}"]`);

interface AppProps {
  /** Where the app opens: My Counter (tests may start elsewhere). */
  initialPage?: AppPage;
}

export default function App({ initialPage = 'counter' }: AppProps = {}) {
  const { theme, toggleTheme } = useTheme();
  const { percent: fontPercent, increaseScale, decreaseScale } = useFontScale();
  const {
    preference: seasonPreference,
    season,
    calendarSeason,
    setPreference: setSeasonPreference,
    seasonFor,
  } = useSeason();
  const { language, toggleLanguage, t } = useLanguage();
  const { isBannerVisible, triggerInstall, dismissBanner, showIOSModal, setShowIOSModal } =
    usePWAInstall();

  const { toast, visible: isToastVisible, showToast, hideToast, clearToast } = useToast();
  const download = useRecipeDownload(language, t, showToast, hideToast);
  const currentUser = useCurrentUser();
  const { seen, markSeen } = useSeenRecipes(currentUser?.email ?? '');

  // What the family made from the recipes. Their words join the recipes' translation requests.
  const { makes, addMake, updateMake, deleteMake, restoreMake, setHeart, collectMakeJobs } =
    useMakes(currentUser);
  const {
    recipes,
    allRecipes,
    selectedRecipe,
    setSelectedRecipeId,
    addRecipe,
    updateRecipe,
    loadVersion,
    deleteRecipe,
    restoreRecipe,
  } = useRecipes(currentUser, collectMakeJobs);
  // The signed-in family member's unfinished recipes and edits, seen only by them.
  const {
    drafts,
    loaded: draftsLoaded,
    saveDraft,
    discardDraft,
    canDraft,
  } = useDrafts(currentUser);

  const [page, setPage] = useState<AppPage>(initialPage);
  // The last main page (not Settings), where the back gesture returns to.
  const [mainPage, setMainPage] = useState<MainPage>(
    initialPage === 'settings' ? 'counter' : initialPage,
  );
  // How My Counter arrives: out of the launch screen, handed over from the sign-in splash, and
  // once it has been left, come back to.
  const splashUp = useSplashUp();
  const [counterArrival, setCounterArrival] = useState<CounterEntrance>(
    splashUp ? 'handoff' : 'launch',
  );
  if (page !== 'counter' && counterArrival !== 'return') setCounterArrival('return');
  // The vault's filter and each main page's scroll survive a visit to a sub-page, so going
  // back returns to the same spot (and a recipe's photo can shrink back into its card).
  const [vaultFilter, setVaultFilter] = useState<VaultFilter>(NO_FILTER);
  // What the Unseen filter goes by: the recipes opened as of its last change, so one opened
  // from the unseen list is still there to come back to (and its photo still has its card).
  const [seenForFilter, setSeenForFilter] = useState(seen);
  // How the vault is ordered and laid out is this person's preference, kept on the device.
  const [vaultSort, setVaultSort] = useState<VaultSort>(getStoredVaultSort);
  const [vaultView, setVaultView] = useState<VaultView>(getStoredVaultView);
  // The same for Makes: its filter for the session, its order kept on the device.
  const [makesFilter, setMakesFilter] = useState<MakesFilter>(NO_MAKES_FILTER);
  const [makesSort, setMakesSort] = useState<MakesSort>(getStoredMakesSort);
  // The vault's banner plays its entrance when the vault arrives, not when a recipe or
  // Settings slides back to reveal it.
  const [vaultEntrance, setVaultEntrance] = useState(true);
  const mainScroll = useRef<Record<MainPage, number>>({ counter: 0, recipes: 0, makes: 0 });
  // The recipe last opened from the vault: its card is the one that flips open and shut.
  const [lastRecipeId, setLastRecipeId] = useState<string | null>(null);
  // The page an open recipe was opened over, where back folds it onto its card: the Recipe Box,
  // or My Counter's latest recipes; on a tablet, whatever page a card deck was raised over.
  const [recipeHome, setRecipeHome] = useState<AppPage>('recipes');
  // On a tablet or desktop, the Recipe Box and Makes tabs raise their card decks over the page
  // (NavDeck). The one open, and one still folding back into its tab.
  const wide = useWideScreen();
  const [deck, setDeck] = useState<DeckKind | null>(null);
  const [deckLeaving, setDeckLeaving] = useState<DeckKind | null>(null);
  // A phone (or the window narrowed) has no decks.
  if (!wide && (deck || deckLeaving)) {
    setDeck(null);
    setDeckLeaving(null);
  }
  const shownDeck = deckLeaving ?? deck;
  // The open recipe was picked from a deck: with no card of its own on the page beneath to fold
  // onto, it folds down towards the Recipe Box tab the deck rose from.
  const [recipeFromDeck, setRecipeFromDeck] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  // The draft the editor carried on with, if any: saving it again replaces it.
  const [editingDraft, setEditingDraft] = useState<RecipeDraft | null>(null);
  // A remix the editor holds: the recipe it's a remix of, what the form starts from (none when
  // it carries on with the remix's draft), and the language it's written in.
  const [remixing, setRemixing] = useState<{
    from: string;
    start: Recipe | null;
    language: Language;
  } | null>(null);
  // Whether the drafts were known when the editor opened. An edit opened before then can't tell
  // if its recipe already has a draft, which saving one would replace unseen.
  const [draftsKnownAtOpen, setDraftsKnownAtOpen] = useState(false);
  // Where the editor opens out of: the button that asked for it.
  const [editorOrigin, setEditorOrigin] = useState<{ x: number; y: number } | undefined>();
  // An earlier version the author loaded into the editor, to restore on save.
  const [restoredVersion, setRestoredVersion] = useState<RecipeVersion | null>(null);
  // Switching versions remounts the editor, which shouldn't slide in again.
  const [editorReopened, setEditorReopened] = useState(false);
  // The open recipe page (its step photo viewer).
  const recipePage = useRef<RecipePageHandle>(null);
  // Set once the recipe has opened: a back button slides out from behind the navigation island.
  const [backShown, setBackShown] = useState(false);
  // The recipe whose step photo is open full screen, if any: the back button takes the menu
  // button's place and closes it. Kept by id, so it can't outlive that recipe's page.
  const [photoOpenFor, setPhotoOpenFor] = useState<string | null>(null);
  // A card lifting out of the box before it flips open: a second tap waits for it.
  const liftingCard = useRef(false);
  // The Recipe Box shown unfiltered, laid out as cards, while it takes you from a make's recipe
  // link to the recipe's card: only for that trip, so this person's own view and filter are
  // never changed.
  const [boxShowcase, setBoxShowcase] = useState<VaultView | null>(null);
  // A recipe just added from elsewhere: back from it, the Recipe Box opens on its card or row (in
  // this person's own view), as no scroll position of theirs leads there.
  const centreOnReturn = useRef<string | null>(null);
  // A recipe opened from a make's link: the make's card, whose link its name flies back into.
  const recipeFromMake = useRef<{ cardId: string; recipeId: string } | null>(null);
  // The Add Make page: the make being edited (null for a new one), a new make's recipe, and
  // where the page opens out of.
  const [makeEditor, setMakeEditor] = useState<{
    make: Make | null;
    recipeId?: string;
    origin?: { x: number; y: number };
  } | null>(null);
  // A make arriving on the Makes page: just shared, or come to from a recipe's makes.
  const [arrivingMake, setArrivingMake] = useState<{ id: string; kind: 'new' | 'visit' } | null>(
    null,
  );
  // The open Makes page (its photo viewer), and whether a make's photo is open full screen.
  const makesPage = useRef<MakesPageHandle>(null);
  const [makePhotoOpen, setMakePhotoOpen] = useState(false);

  // What the editor starts from: the recipe, or an earlier version's content on it.
  const editBase =
    editingRecipe && restoredVersion
      ? recipeAtVersion(editingRecipe, restoredVersion)
      : editingRecipe;
  // Edit in the viewer's language where possible (a draft, in the one it was written in); see
  // resolveEdit for how saves merge.
  const editLanguage = editingDraft?.language ?? remixing?.language ?? language;
  const editForm = editBase && recipeForEditing(editBase, editLanguage);
  const restore =
    editingRecipe && editBase && editForm && restoredVersion
      ? {
          version: restoredVersion,
          changes: diffRecipes(
            localizeRecipe(editingRecipe, editingLanguage(editBase, editLanguage)),
            editForm,
            restoredVersion.hasPhotos,
          ),
        }
      : undefined;

  // The name of the recipe a remix is of, as the editor shows it; none when that's gone.
  const remixSource = remixing && recipes.find((r) => r.id === remixing.from);
  const remixFromName = remixSource
    ? (getLocalizedRecipe(remixSource, language) ?? remixSource).name
    : undefined;

  const closeEditor = () => {
    setIsAddModalOpen(false);
    setEditingRecipe(null);
    setEditingDraft(null);
    setRemixing(null);
    setRestoredVersion(null);
    setEditorReopened(false);
  };

  const handleDelete = (id: string) => {
    // Inside the transition, so it animates from the recipe rather than an already-empty page,
    // to the page the recipe was opened over.
    navigateTo(page === 'recipes' && selectedRecipe ? recipeHome : 'recipes', {
      morph: false,
      alongside: () => {
        deleteRecipe(id);
        closeEditor();
      },
    });
    showToast(t.recipeDeleted, 'info', { label: t.undo, onAction: () => restoreRecipe(id) });
  };

  // A new season's colours spread out in a circle from the option that was tapped.
  const changeSeason = (next: SeasonPreference, origin: { x: number; y: number }) => {
    if (seasonFor(next) === season) setSeasonPreference(next);
    else transitionTheme(() => setSeasonPreference(next), origin);
  };

  const handleRestore = (id: string) => {
    if (restoreRecipe(id)) showToast(t.recipeRestored);
    else showToast(t.photosStillLoading, 'error');
  };

  const pickVersion = async (id: string): Promise<boolean> => {
    if (!editingRecipe) return false;
    try {
      setRestoredVersion(await loadVersion(editingRecipe, id));
      setEditorReopened(true);
      return true;
    } catch (err) {
      console.warn('Could not load an earlier recipe version:', err);
      showToast(t.versionLoadFailed, 'error');
      return false;
    }
  };

  // Sub-pages (a recipe, Settings) sit one level above the main pages.
  const onSubPage = page === 'settings' || (page === 'recipes' && !!selectedRecipe);

  // The deck folds back into its tab (its exit, then deckLeaving clears).
  const closeDeck = () => {
    if (!deck) return;
    // Mid-swap, the one already folding carries on; the one waiting to rise never does.
    if (!deckLeaving) setDeckLeaving(deck);
    setDeck(null);
  };
  // Gone at once, with a page change: it leaves with the page it was over.
  const dropDeck = () => {
    setDeck(null);
    setDeckLeaving(null);
  };
  // Remembers where the main page on screen was scrolled to, as it's left (not from a recipe or
  // Settings over it, whose scroll is their own).
  const keepMainScroll = () => {
    if (!onSubPage) mainScroll.current[page as MainPage] = window.scrollY;
  };
  // The tabs that raise a deck: on a tablet, the Recipe Box's and Makes', except over their own
  // page, where the tab returns to its top as on a phone. Over a recipe both do.
  const deckTabs: DeckKind[] = wide
    ? (['recipes', 'makes'] as const).filter((tab) => onSubPage || tab !== page)
    : [];

  // Opening a recipe: its card lifts out of the box, flips over on its middle, and the recipe
  // unfolds from the card's back (the flip motions in index.css). Then the back button springs
  // out from behind the navigation island.
  // `marked`: it was marked seen already, on the way here (a make's link).
  // `home`: the page it's opened over, the Recipe Box or My Counter, where back returns it.
  // `fromDeck`: picked from a card deck (on a tablet), over whatever page was there.
  const handleSelectRecipe = (
    id: string,
    card?: HTMLElement,
    marked = false,
    home: AppPage = 'recipes',
    fromDeck = false,
  ) => {
    if (liftingCard.current) return;
    // A card left lifted by a return cut short (another page change took over) drops back first.
    dropFlippedCard();
    centreOnReturn.current = null;
    keepMainScroll();
    if (!marked) markSeen(id);
    // Marks the tapped card before the browser snapshots the page.
    flushSync(() => setLastRecipeId(id));
    const open = (motion: NavMotion) =>
      transitionView(
        () => {
          setBackShown(false);
          // The deck goes with the page behind as the recipe unfolds from its card.
          dropDeck();
          setRecipeFromDeck(fromDeck);
          // Behind the recipe, the Recipe Box goes back to this person's own view.
          setBoxShowcase(null);
          setRecipeHome(home);
          // The recipe is the Recipe Box's, wherever it was opened (its tab stays lit).
          setPage('recipes');
          setSelectedRecipeId(id);
          jumpTo(0);
        },
        { motion, onFinished: () => setBackShown(true) },
      );
    if (!card || !canFlip() || !isOnScreen(card)) {
      open('forward');
      return;
    }
    liftingCard.current = true;
    card.dataset.lifted = '';
    window.setTimeout(() => {
      liftingCard.current = false;
      // The vault has gone meanwhile (the menu took the page elsewhere).
      if (!card.isConnected) return;
      open(setFlipAxis(card) ? 'flip-open' : 'forward');
    }, CARD_LIFT_MS);
  };

  // Closing a recipe, its card is shown lifted, as it left, while the recipe folds onto it; it
  // then flips back and drops into its place in the box. False where it isn't on screen.
  const landFlippedCard = (): boolean => {
    const card = document.querySelector<HTMLElement>('.vault-item.is-flip-target');
    if (!card) return false;
    card.dataset.lifted = 'landing';
    if (setFlipAxis(card)) return true;
    delete card.dataset.lifted;
    return false;
  };
  // At once where another card is about to lift; otherwise it settles back ('dropping', as long
  // as the lift), tucking behind the card in front of it again.
  const dropFlippedCard = (settle = false) => {
    const card = document.querySelector<HTMLElement>('.vault-item[data-lifted]');
    if (!card) return;
    if (!settle) {
      delete card.dataset.lifted;
      return;
    }
    card.dataset.lifted = 'dropping';
    // A little past the drop, so it has fully settled when the card goes back behind.
    window.setTimeout(() => {
      if (card.dataset.lifted === 'dropping') delete card.dataset.lifted;
    }, CARD_LIFT_MS + 100);
  };

  const navigateTo = (
    target: AppPage,
    {
      animated = true,
      morph = true,
      motion: motionOverride,
      alongside,
      back = false,
    }: NavigateOptions = {},
  ) => {
    const fromDepth = onSubPage ? 1 : 0;
    const toDepth = target === 'settings' ? 1 : 0;
    const goingBack = toDepth < fromDepth || back;
    keepMainScroll();
    // The recipe folds away onto its card, which flips back into the page it was opened over
    // (landFlippedCard).
    const flipsBack =
      morph && animated && target === recipeHome && page === 'recipes' && !!selectedRecipe;
    const motion: NavMotion =
      flipsBack && canFlip()
        ? 'flip-close'
        : (motionOverride ?? (toDepth > fromDepth ? 'forward' : goingBack ? 'back' : 'fade'));
    // Between main pages on the island's tabs: the slide is the page's entrance, and each page
    // comes back where it was left, as a tab does.
    const sideways = motion === 'side-next' || motion === 'side-prev';

    transitionView(
      () => {
        flushSync(() => {
          alongside?.();
          setBackShown(false);
          dropDeck();
          setBoxShowcase(null);
          setArrivingMake(null);
          setMakePhotoOpen(false);
          setVaultEntrance(!goingBack && !flipsBack && !sideways);
          setPage(target);
          if (target !== 'settings') setMainPage(target);
          setSelectedRecipeId(null);
        });
        // Only once the page is there: a shorter page it replaces (a recipe) can't scroll as
        // far, and the jump would land short of the spot.
        jumpTo((goingBack || sideways) && target !== 'settings' ? mainScroll.current[target] : 0);
        // Back from a recipe opened from a make: its card or row in the middle of the screen.
        const leftRecipe = target === 'recipes' && page === 'recipes' && !!selectedRecipe;
        const centre = leftRecipe ? centreOnReturn.current : null;
        centreOnReturn.current = null;
        const flipTarget = centre && document.querySelector('.vault-item.is-flip-target');
        if (flipTarget) centreOnScreen(flipTarget);
        // Only now is the card there to measure. Out of sight, the vault simply fades in; a
        // recipe picked from a deck folds down towards the Recipe Box tab the deck rose from.
        if (
          motion === 'flip-close' &&
          !landFlippedCard() &&
          !(recipeFromDeck && setFlipAxis(document.querySelector('.nav-tab[data-tab="recipes"]')))
        )
          document.documentElement.dataset.nav = 'fade';
      },
      {
        motion,
        animated,
        onFinished: motion === 'flip-close' ? () => dropFlippedCard(true) : undefined,
      },
    );
  };

  const changeVaultFilter = (filter: VaultFilter) => {
    setVaultFilter(filter);
    setSeenForFilter(seen);
  };
  const vaultSeen = vaultFilter.unseen ? seenForFilter : seen;

  const changeVaultSort = (sort: VaultSort) => {
    setVaultSort(sort);
    setStoredVaultSort(sort);
  };
  const changeMakesSort = (sort: MakesSort) => {
    setMakesSort(sort);
    setStoredMakesSort(sort);
  };
  const changeVaultView = (view: VaultView) => {
    setVaultView(view);
    setStoredVaultView(view);
  };
  // Back from a recipe: it folds away onto its card, as the back button tucks away, and the
  // card flips back into its place, in the box or on My Counter.
  const leaveRecipe = (animated = true) => {
    setBackShown(false);
    if (recipeHome === 'makes') returnToMakes(animated);
    else navigateTo(recipeHome, { animated });
  };

  // Back from a recipe opened from a make's link: Makes comes forward where it was left as the
  // recipe recedes, the recipe's name flying back into that link (the 'to-makes' motion and
  // 'title' morph). Only that recipe's name flies (not one hopped to since), and only from on screen.
  const returnToMakes = (animated: boolean) => {
    const link = recipeFromMake.current;
    recipeFromMake.current = null;
    const title = document.getElementById('detailTitle');
    const flies =
      animated &&
      !prefersReducedMotion() &&
      !!link &&
      selectedRecipe?.id === link.recipeId &&
      isOnScreen(title);
    const unnameTitle = flies ? nameTransitionPart(title, 'recipe-title') : null;
    let unnameLink: (() => void) | null = null;
    transitionView(
      () => {
        flushSync(() => {
          setBackShown(false);
          dropDeck();
          setBoxShowcase(null);
          setArrivingMake(null);
          setMakePhotoOpen(false);
          setVaultEntrance(false);
          setPage('makes');
          setMainPage('makes');
          setSelectedRecipeId(null);
        });
        jumpTo(mainScroll.current.makes);
        if (!flies || !link) return;
        const name = document.getElementById(link.cardId)?.querySelector('.make-recipe-name');
        // Its make gone or out of sight: the name simply goes with the recipe.
        if (name && isOnScreen(name)) unnameLink = nameTransitionPart(name, 'recipe-title');
        else delete document.documentElement.dataset.morph;
      },
      {
        motion: 'to-makes',
        morph: flies ? 'title' : undefined,
        animated,
        always: () => {
          unnameTitle?.();
          unnameLink?.();
        },
      },
    );
  };

  // A tab on the navigation island. Its page slides in from the side its tab sits on; on a
  // recipe, the tab of the page it was opened over takes it back to its card, as back does
  // (the Recipe Box's tab, lit under every recipe, slides the box in when that was My Counter);
  // the current page's own tab returns to its top. On a tablet, the Recipe Box and Makes tabs
  // raise their card decks instead, over any page but their own (deckTabs); tapped again, the
  // deck folds away, and the other one swaps it.
  const selectTab = (target: MainPage) => {
    const kind = deckTabs.find((tab) => tab === target);
    if (kind) {
      if (deck === kind) {
        closeDeck();
      } else if (deckLeaving === kind) {
        // Tapped again as it folds away: it rises again, and any deck waiting on it never does.
        setDeckLeaving(null);
        setDeck(kind);
      } else {
        // The open one folds away first (one already folding carries on), then this one rises.
        if (deck && !deckLeaving) setDeckLeaving(deck);
        setDeck(kind);
      }
      return;
    }
    if (page === 'recipes' && selectedRecipe) {
      if (target === recipeHome) leaveRecipe();
      else navigateTo(target, { motion: sideFrom('recipes', target), morph: false });
      return;
    }
    if (page === 'settings') {
      navigateTo(target, target === mainPage ? {} : { motion: sideFrom(mainPage, target) });
      return;
    }
    if (target === page) {
      // Over its own page, the tab only folds the deck away.
      if (deck) closeDeck();
      else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
      return;
    }
    navigateTo(target, { motion: sideFrom(page, target) });
  };

  // What glides from the makes window of My Counter out to the Makes page: each latest make's
  // photo, from its tile to its card. (The Recipe Box's recipes stand in this person's own
  // order, where the latest are seldom on screen, and a name flying over the box's other names
  // reads as a muddle, so the recipes window simply opens out.)
  const makeGlides = (): GlidePart[] =>
    latestMakes(makes).map((make) => {
      const key = vaultItemKey(make.id);
      return {
        name: `glide-make-${key}`,
        kind: 'photo',
        from: () => counterMake(key)?.querySelector('[data-counter-photo]') ?? null,
        to: () => document.getElementById(`make-${make.id}`)?.querySelector('.make-photo') ?? null,
      };
    });

  // "See all" on a window of My Counter: the window opens out into its page, the Recipe Box or
  // Makes, which comes up inside it as it grows (the 'window-open' motion). Only the newest
  // make's photo glides out to its card, the one sure to be at the top of Makes. A card deck's
  // "See all" opens out of the deck the same way.
  const openWindow = (win: 'recipes' | 'makes', from: Element | null) => {
    keepMainScroll();
    const opens = !prefersReducedMotion() && setWindowRect(from);
    const glides =
      opens && win === 'makes' && page === 'counter' && !shownDeck
        ? nameGlides(makeGlides().slice(0, 1))
        : null;
    const unnameWindow = opens ? nameOpeningWindow(from) : null;
    transitionView(
      () => {
        flushSync(() => {
          setBackShown(false);
          dropDeck();
          setBoxShowcase(null);
          setArrivingMake(null);
          setMakePhotoOpen(false);
          // Opening out of the window is its entrance.
          setVaultEntrance(!opens);
          setPage(win);
          setMainPage(win);
          setSelectedRecipeId(null);
        });
        jumpTo(0);
        glides?.arrive();
      },
      {
        motion: opens ? 'window-open' : 'fade',
        always: () => {
          glides?.clear();
          unnameWindow?.();
        },
      },
    );
  };

  // From the Recipe Box or Makes, and anything open over them, the phone's back gesture comes
  // home to My Counter, sliding in as its tab on the island brings it; only from there does it
  // leave the app. Registered before the sub-pages' step below, so a recipe or Settings open over
  // them is undone first.
  useBackStep(mainPage !== 'counter', (animated) =>
    navigateTo('counter', { animated, motion: sideFrom(mainPage, 'counter') }),
  );
  // From a recipe or Settings, the phone's back gesture returns to the last main page.
  useBackStep(onSubPage, (animated) =>
    selectedRecipe && page === 'recipes'
      ? leaveRecipe(animated)
      : navigateTo(mainPage, { animated }),
  );
  // An open card deck is the newest step: the gesture folds it away first.
  useBackStep(deck !== null, closeDeck);

  // The editor opens out of the button that asked for it: the island's actions button, where "Add recipe"
  // or "Edit recipe" was chosen, unless a draft's card or chip was tapped.
  const openEditor = (
    recipe: Recipe | null,
    draft: RecipeDraft | null,
    from?: Element | null,
    remix: typeof remixing = null,
  ) => {
    // A remix's draft carries on as a remix.
    const draftOf = draft && !draft.recipeId ? remixOriginalId(draft.recipe) : null;
    setRemixing(
      remix ?? (draft && draftOf ? { from: draftOf, start: null, language: draft.language } : null),
    );
    setEditingRecipe(recipe);
    setEditingDraft(draft);
    setDraftsKnownAtOpen(draftsLoaded);
    setEditorOrigin(centreOf(from ?? document.getElementById('navActionsBtn')));
    setIsAddModalOpen(true);
  };

  const openAddRecipe = () => openEditor(null, null);

  // Editing a recipe carries on with its draft, if its owner left one.
  const editRecipe = (recipe: Recipe, from?: Element | null) => {
    // Editing a copy without its photos would save the recipe without them.
    if (hasLeftOutPhotos(recipe)) {
      showToast(t.photosStillLoading, 'info');
      return;
    }
    openEditor(recipe, draftFor(drafts, recipe.id), from);
  };

  // A remix starts as a new recipe holding a copy of this one, for whoever remixes it to make
  // their own (theirs to own, at version 1). The original stays as it is.
  const remixRecipe = (original: Recipe) => {
    // A copy without its photos would leave them out of the remix.
    if (hasLeftOutPhotos(original)) {
      showToast(t.photosStillLoading, 'info');
      return;
    }
    openEditor(null, null, null, {
      from: original.id,
      start: remixStart(original, language),
      language: remixLanguage(original, language),
    });
  };

  // Keeps what the editor holds as a draft: the open one again, else the recipe's, else a new one.
  const keepDraft = (content: DraftContent, changeNote: string) => {
    const recipeId = editingRecipe?.id;
    const id = editingDraft?.id ?? (recipeId ? editDraftId(recipeId) : newDraftId());
    const draft: RecipeDraft = {
      id,
      recipe: { ...content, id: recipeId ?? id, ...(remixing && { remixOf: remixing.from }) },
      language: editLanguage,
      savedAt: Date.now(),
    };
    if (editingRecipe && recipeId) {
      draft.recipeId = recipeId;
      draft.baseVersion = editingRecipe.version ?? 1;
    }
    if (changeNote.trim()) draft.changeNote = changeNote.trim();
    showToast(t.draftSavedToast(draftVersion(editingRecipe)));
    saveDraft(draft).catch((err: unknown) => {
      console.warn('Failed to save a recipe draft:', err);
      showToast(t.draftSaveFailed, 'error');
    });
  };

  // A draft goes once it's discarded, or saved to the vault.
  const dropDraft = (draft: RecipeDraft) =>
    discardDraft(draft.id).catch((err: unknown) => {
      console.warn('Failed to remove a recipe draft:', err);
    });

  // From a recipe's remix popover to another recipe: the name tapped there flies up into the new
  // page's title as that page fades up over this one (index.css, the 'hop' motion and 'title'
  // morph). Only the two names and the page are snapshotted, so it stays light. Back still
  // returns to the Recipe Box, where this recipe's card is the one that takes it back.
  const openLinkedRecipe = (id: string, name: HTMLElement) => {
    markSeen(id);
    const title = () => document.getElementById('detailTitle');
    // A hop cut short by another page change never cleared this page's title: two elements
    // sharing the name would cancel this one.
    title()?.style.removeProperty('view-transition-name');
    // With less motion asked for, the pages only cross-fade.
    const morph = !prefersReducedMotion();
    if (morph) name.style.setProperty('view-transition-name', 'recipe-title');
    transitionView(
      () => {
        flushSync(() => {
          setLastRecipeId(id);
          setPhotoOpenFor(null);
          setSelectedRecipeId(id);
        });
        jumpTo(0);
        if (morph) title()?.style.setProperty('view-transition-name', 'recipe-title');
      },
      {
        motion: 'hop',
        morph: morph ? 'title' : undefined,
        onFinished: () => title()?.style.removeProperty('view-transition-name'),
      },
    );
  };

  // From a make to its recipe, through the Recipe Box: the Makes page recedes as the box comes
  // forward, laid out as cards (this person's own view and filter untouched), and opened on the
  // recipe's card, into whose title the tapped name flies (the 'to-box' motion and 'title'
  // morph). Then the card lifts and flips open into the recipe, as when it's tapped in the box.
  // Back from the recipe returns to Makes where it was left, the recipe's name flying back into the
  // link it was opened from (returnToMakes).
  const openRecipeThroughBox = (recipeId: string, name: HTMLElement) => {
    if (liftingCard.current) return;
    const makesScroll = window.scrollY;
    mainScroll.current.makes = makesScroll;
    // The box is only passed through: where this person left it stays as it was. (Opening the
    // card keeps the scroll of the page it was asked from, Makes, so both are put back after.)
    const boxScroll = mainScroll.current.recipes;
    const makeCardId = name.closest('.make-card')?.id ?? '';
    const cardOf = () =>
      document.querySelector<HTMLElement>(
        `.vault-item[data-vault-item="${vaultItemKey(recipeId)}"]`,
      );
    const titleOf = (card: HTMLElement | null) =>
      card?.querySelector<HTMLElement>('[data-vault-name]') ?? null;
    if (!canFlip()) {
      // Less motion asked for (or no view transitions): straight to the recipe.
      dropFlippedCard();
      centreOnReturn.current = null;
      recipeFromMake.current = { cardId: makeCardId, recipeId };
      transitionView(
        () => {
          flushSync(() => {
            setBackShown(false);
            setArrivingMake(null);
            setMakePhotoOpen(false);
            setPage('recipes');
            setRecipeHome('makes');
            setLastRecipeId(recipeId);
            setSelectedRecipeId(recipeId);
            markSeen(recipeId);
          });
          jumpTo(0);
        },
        { motion: 'forward', onFinished: () => setBackShown(true) },
      );
      return;
    }
    name.style.setProperty('view-transition-name', 'recipe-title');
    let card: HTMLElement | null = null;
    transitionView(
      () => {
        flushSync(() => {
          setBackShown(false);
          setArrivingMake(null);
          setMakePhotoOpen(false);
          setBoxShowcase('cards');
          setVaultEntrance(false);
          setPage('recipes');
          setMainPage('recipes');
          setSelectedRecipeId(null);
          setLastRecipeId(recipeId);
          // With the page change, not after: marking it later would build the box once more
          // between the card landing and lifting.
          markSeen(recipeId);
        });
        card = cardOf();
        if (card) centreOnScreen(card);
        else jumpTo(0);
        titleOf(card)?.style.setProperty('view-transition-name', 'recipe-title');
      },
      {
        motion: 'to-box',
        morph: 'title',
        onFinished: () => {
          titleOf(card)?.style.removeProperty('view-transition-name');
          // No card to flip (the recipe went meanwhile): the box goes back to this person's view.
          if (!card) {
            setBoxShowcase(null);
            return;
          }
          // The box has gone meanwhile (another page change took over).
          if (!card.isConnected) return;
          handleSelectRecipe(recipeId, card, true, 'makes');
          mainScroll.current.recipes = boxScroll;
          mainScroll.current.makes = makesScroll;
          recipeFromMake.current = { cardId: makeCardId, recipeId };
        },
      },
    );
  };

  // From a recipe's makes popover to that make on the Makes page: the name tapped flies into the
  // make's title as the Makes page fades up (the 'hop' motion and 'title' morph), opened on it.
  const openMakeFromRecipe = (makeId: string, name: HTMLElement) => {
    const morph = !prefersReducedMotion();
    if (morph) name.style.setProperty('view-transition-name', 'recipe-title');
    const titleOf = () =>
      document.getElementById(`make-${makeId}`)?.querySelector<HTMLElement>('.make-title');
    transitionView(
      () => {
        flushSync(() => {
          setBackShown(false);
          setPhotoOpenFor(null);
          setBoxShowcase(null);
          setVaultEntrance(false);
          setArrivingMake({ id: makeId, kind: 'visit' });
          setPage('makes');
          setMainPage('makes');
          setSelectedRecipeId(null);
        });
        const card = document.getElementById(`make-${makeId}`);
        if (card) centreOnScreen(card);
        if (morph) titleOf()?.style.setProperty('view-transition-name', 'recipe-title');
      },
      {
        motion: 'hop',
        morph: morph ? 'title' : undefined,
        onFinished: () => titleOf()?.style.removeProperty('view-transition-name'),
      },
    );
  };

  // From a make on My Counter, or in the Makes deck, to it on the Makes page: its photo grows from
  // the tile into the make's card as the Makes page fades up (the 'hop' motion), opened on it.
  const openMakeFromTile = (makeId: string, photo: HTMLElement) => {
    keepMainScroll();
    const key = vaultItemKey(makeId);
    const glides = prefersReducedMotion()
      ? null
      : nameGlides([
          {
            name: `glide-make-${key}`,
            kind: 'photo',
            from: () => photo,
            to: () =>
              document.getElementById(`make-${makeId}`)?.querySelector('.make-photo') ?? null,
          },
        ]);
    transitionView(
      () => {
        flushSync(() => {
          setBackShown(false);
          dropDeck();
          setPhotoOpenFor(null);
          setBoxShowcase(null);
          setVaultEntrance(false);
          setArrivingMake({ id: makeId, kind: 'visit' });
          setPage('makes');
          setMainPage('makes');
          setSelectedRecipeId(null);
        });
        const card = document.getElementById(`make-${makeId}`);
        if (card) centreOnScreen(card);
        else jumpTo(0);
        glides?.arrive();
      },
      { motion: 'hop', always: glides?.clear },
    );
  };

  // A draft on My Counter carries on in the editor, which opens out of its row: an edit's draft
  // as its recipe's edit (as the recipe page's chip does), a new recipe's on its own.
  const openDraftFromCounter = (draft: RecipeDraft, from: HTMLElement) => {
    const recipe = draft.recipeId ? recipes.find((r) => r.id === draft.recipeId) : undefined;
    if (recipe) editRecipe(recipe, from);
    else openEditor(null, draft, from);
  };

  // The Add Make page opens out of the button that asked for it (the island's actions button by default).
  const openMakeEditor = (make: Make | null, recipeId?: string, from?: Element | null) => {
    if (make?.photoOmitted) {
      showToast(t.photosStillLoading, 'info');
      return;
    }
    setMakeEditor({
      make,
      recipeId,
      origin: centreOf(from ?? document.getElementById('navActionsBtn')),
    });
  };

  // A new make lands at the top of the Makes page, which the closing page sinks away to show.
  const saveMake = (content: MakeContent) => {
    const editing = makeEditor?.make;
    if (editing) {
      if (updateMake(editing.id, content)) showToast(t.makeSaved);
      else showToast(t.photosStillLoading, 'error');
      return;
    }
    const added = addMake(content, language);
    flushSync(() => {
      setBackShown(false);
      setPhotoOpenFor(null);
      setBoxShowcase(null);
      setVaultEntrance(false);
      setArrivingMake({ id: added.id, kind: 'new' });
      setPage('makes');
      setMainPage('makes');
      setSelectedRecipeId(null);
    });
    jumpTo(0);
  };

  const removeMake = (id: string) => {
    if (deleteMake(id)) {
      showToast(t.makeDeleted, 'info', { label: t.undo, onAction: () => restoreMake(id) });
    } else {
      showToast(t.photosStillLoading, 'error');
    }
  };

  const heartMake = (id: string, on: boolean) => {
    void setHeart(id, on).then((done) => {
      if (!done) showToast(t.heartFailed, 'error');
    });
  };

  const onRecipe = page === 'recipes' && !!selectedRecipe;
  const photoOpen =
    (onRecipe && photoOpenFor === selectedRecipe.id) || (page === 'makes' && makePhotoOpen);

  // What can be done on each page, in the navigation island's actions panel.
  let pageActions: MenuAction[] = [];
  switch (page) {
    case 'recipes':
      if (!selectedRecipe) {
        pageActions = [
          { id: 'add-recipe', label: t.addRecipe, icon: Plus, onSelect: openAddRecipe },
        ];
        break;
      }
      pageActions.push(
        {
          id: 'download-recipe',
          label: t.downloadRecipe,
          icon: Download,
          onSelect: () => download.start(selectedRecipe),
        },
        // Anyone can remix any recipe, their own too.
        {
          id: 'remix-recipe',
          label: t.remixRecipe,
          icon: Shuffle,
          onSelect: () => remixRecipe(selectedRecipe),
        },
        // And share what they made from it, with the recipe already picked.
        {
          id: 'add-make',
          label: t.addMake,
          icon: CookingPot,
          onSelect: () => openMakeEditor(null, selectedRecipe.id),
        },
      );
      // Only the family member who added a recipe can edit it. Their Edit key has the bottom
      // row to itself, under Download and Remix.
      if (canEditRecipe(selectedRecipe, currentUser, isFirebaseConfigured)) {
        pageActions.push({
          id: 'edit-recipe',
          label: t.editRecipe,
          icon: PencilLine,
          onSelect: () => editRecipe(selectedRecipe),
          wide: true,
        });
      }
      break;
    case 'makes':
      pageActions = [
        { id: 'add-make', label: t.addMake, icon: Plus, onSelect: () => openMakeEditor(null) },
      ];
      break;
    case 'counter':
      pageActions = [
        { id: 'add-recipe', label: t.addRecipe, icon: Plus, onSelect: openAddRecipe },
        {
          id: 'add-make',
          label: t.addMake,
          icon: CookingPot,
          onSelect: () => openMakeEditor(null),
        },
      ];
      break;
    case 'settings':
      break;
  }

  // My Counter's greeting, picked once per launch, and news of hearts on this person's makes
  // since they last saw them.
  const email = currentUser?.email ?? '';
  const counterMemory = useCounterMemory(
    email,
    season,
    page === 'counter'
      ? recipes.filter((r) => !seen.has(r.id) && !isOwnRecipe(r, currentUser)).length
      : 0,
  );
  const news =
    page === 'counter'
      ? heartNews(makes, email, counterMemory.heartsShown, familyNames(allRecipes, makes))
      : null;
  const newsRecipe = news && recipes.find((r) => r.id === news.make.recipeId);
  const newsTitle = news
    ? localizeMake(news.make, language).title ||
      (newsRecipe ? (getLocalizedRecipe(newsRecipe, language) ?? newsRecipe).name : '')
    : '';
  // Shown on the counter now, so they aren't news next launch.
  const shownNews = news && JSON.stringify([news.make.id, news.hearts]);
  const { markHeartsShown } = counterMemory;
  useEffect(() => {
    if (!shownNews) return;
    const [makeId, hearts] = JSON.parse(shownNews) as [string, string[]];
    markHeartsShown(makeId, hearts);
  }, [shownNews, markHeartsShown]);

  return (
    <div className="min-h-screen flex flex-col transition-colors duration-200">
      {/* Main Container */}
      <main className="app-container">
        {page === 'counter' ? (
          <CounterView
            entrance={counterArrival}
            season={season}
            greeting={t.greetings[counterMemory.greetingId]}
            firstName={firstName(currentUser?.name ?? '')}
            news={
              news && newsTitle ? { text: t.heartNews(news.names, news.count, newsTitle) } : null
            }
            recipes={recipes}
            isSeen={(recipe) => seen.has(recipe.id) || isOwnRecipe(recipe, currentUser)}
            makes={makes}
            drafts={[...drafts].sort((a, b) => b.savedAt - a.savedAt)}
            language={language}
            theme={theme}
            onToggleLanguage={toggleLanguage}
            onToggleTheme={(origin) => transitionTheme(toggleTheme, origin)}
            fontPercent={fontPercent}
            onIncreaseFont={increaseScale}
            onDecreaseFont={decreaseScale}
            onAddRecipe={(from) => openEditor(null, null, from)}
            onAddMake={(from) => openMakeEditor(null, undefined, from)}
            onOpenRecipe={(id, card) => handleSelectRecipe(id, card, false, 'counter')}
            // While a deck is up, its card is the one that flips open (names must be unique).
            flipRecipeId={shownDeck ? null : lastRecipeId}
            onSeeAllRecipes={() =>
              openWindow('recipes', document.querySelector('[data-counter-window="recipes"]'))
            }
            onOpenMake={openMakeFromTile}
            onSeeAllMakes={() =>
              openWindow('makes', document.querySelector('[data-counter-window="makes"]'))
            }
            onOpenDraft={openDraftFromCounter}
            t={t}
          />
        ) : page === 'makes' ? (
          <MakesView
            ref={makesPage}
            makes={makes}
            recipes={recipes}
            language={language}
            canEdit={(make) => canEditMake(make, currentUser, isFirebaseConfigured)}
            arriving={arrivingMake}
            animateIn={vaultEntrance}
            filter={makesFilter}
            onFilterChange={setMakesFilter}
            sort={makesSort}
            onSortChange={changeMakesSort}
            onOpenRecipe={openRecipeThroughBox}
            onEditMake={(make, from) => openMakeEditor(make, undefined, from)}
            onHeart={heartMake}
            onAddMake={(from) => openMakeEditor(null, undefined, from)}
            onPhotoOpenChange={setMakePhotoOpen}
            t={t}
          />
        ) : page === 'settings' ? (
          <SettingsView
            deletedRecipes={restorableRecipes(allRecipes, currentUser, isFirebaseConfigured)}
            language={language}
            onRestore={handleRestore}
            seasonPreference={seasonPreference}
            season={season}
            calendarSeason={calendarSeason}
            onSeasonChange={changeSeason}
            t={t}
          />
        ) : selectedRecipe ? (
          <RecipeDetailView
            key={selectedRecipe.id}
            recipe={selectedRecipe}
            language={language}
            ref={recipePage}
            unroll={false}
            onPhotoOpenChange={(open) => setPhotoOpenFor(open ? selectedRecipe.id : null)}
            draftVersion={
              draftFor(drafts, selectedRecipe.id) ? draftVersion(selectedRecipe) : undefined
            }
            onContinueDraft={(from) => editRecipe(selectedRecipe, from)}
            remixOriginal={remixOriginal(recipes, selectedRecipe)}
            remixes={remixesOf(recipes, selectedRecipe.id)}
            onOpenRecipe={openLinkedRecipe}
            makes={makesOf(makes, selectedRecipe.id).map((m) => localizeMake(m, language))}
            onOpenMake={openMakeFromRecipe}
            t={t}
          />
        ) : (
          <RecipeGridView
            recipes={recipes}
            language={language}
            // On the way to a make's recipe, the box shows every recipe as a card.
            filter={boxShowcase ? NO_FILTER : vaultFilter}
            onFilterChange={changeVaultFilter}
            sort={vaultSort}
            onSortChange={changeVaultSort}
            view={boxShowcase ?? vaultView}
            onViewChange={changeVaultView}
            makeCounts={makeCounts(makes)}
            isSeen={(recipe) => vaultSeen.has(recipe.id) || isOwnRecipe(recipe, currentUser)}
            animateIn={vaultEntrance}
            // While a deck is up, its card is the one that flips open (names must be unique).
            flipRecipeId={shownDeck ? null : lastRecipeId}
            onSelectRecipe={handleSelectRecipe}
            drafts={newRecipeDrafts(drafts)}
            onOpenDraft={(draft, from) => openEditor(null, draft, from)}
            banner={
              isBannerVisible && (
                <InstallCard
                  onInstall={() => void triggerInstall()}
                  onDismiss={dismissBanner}
                  t={t}
                />
              )
            }
            t={t}
          />
        )}
      </main>

      {shownDeck && <NavDeckScrim closing={!deck} onClose={closeDeck} />}
      {shownDeck && (
        <NavDeck
          key={shownDeck}
          kind={shownDeck}
          title={shownDeck === 'recipes' ? t.recipeVault : t.makes}
          viewAllLabel={shownDeck === 'recipes' ? t.seeAllRecipes : t.seeAllMakes}
          onViewAll={(from) => openWindow(shownDeck, from)}
          closing={deckLeaving !== null}
          swapping={deck !== null}
          onClose={closeDeck}
          onClosed={() => setDeckLeaving(null)}
          t={t}
        >
          {shownDeck === 'recipes' ? (
            <RecipeDeck
              recipes={recipes}
              language={language}
              filter={vaultFilter}
              onFilterChange={changeVaultFilter}
              sort={vaultSort}
              onSortChange={changeVaultSort}
              isSeen={(recipe) => vaultSeen.has(recipe.id) || isOwnRecipe(recipe, currentUser)}
              makeCounts={makeCounts(makes)}
              flipRecipeId={lastRecipeId}
              onSelectRecipe={(id, card) =>
                handleSelectRecipe(id, card, false, onRecipe ? recipeHome : page, true)
              }
              t={t}
            />
          ) : (
            <MakesDeck
              makes={makes}
              recipes={recipes}
              language={language}
              onOpenMake={openMakeFromTile}
              t={t}
            />
          )}
        </NavDeck>
      )}

      <NavIsland
        page={page}
        // While a recipe is open, the Recipe Box's tab is lit, its tin holding the recipe's card.
        litTab={onRecipe ? 'recipes' : mainPage}
        onRecipe={onRecipe}
        onSelectTab={selectTab}
        deckTabs={deckTabs}
        deck={deck}
        onActionsOpen={closeDeck}
        // Under the panel's blurring scrim, Settings cross-fades in as the scrim clears. Never
        // the card flip back from a recipe: the scrim and panel would fold away with the recipe.
        onOpenSettings={() => navigateTo('settings', { motion: 'menu', morph: false })}
        actions={pageActions}
        panelTitle={
          onRecipe
            ? (getLocalizedRecipe(selectedRecipe, language) ?? selectedRecipe).name
            : { counter: t.counter, recipes: t.recipeVault, makes: t.makes, settings: t.settings }[
                page
              ]
        }
        language={language}
        onToggleLanguage={toggleLanguage}
        theme={theme}
        onToggleTheme={(origin) => transitionTheme(toggleTheme, origin)}
        fontPercent={fontPercent}
        onIncreaseFont={increaseScale}
        onDecreaseFont={decreaseScale}
        showBack={
          ((backShown || photoOpen) && onRecipe) ||
          (photoOpen && page === 'makes') ||
          page === 'settings'
        }
        backLabel={page === 'settings' || recipeHome !== 'recipes' ? t.goBack : t.backToRecipes}
        photoOpen={photoOpen}
        onBack={() =>
          photoOpen
            ? page === 'makes'
              ? makesPage.current?.closePhoto()
              : recipePage.current?.closePhoto()
            : page === 'settings'
              ? navigateTo(mainPage)
              : leaveRecipe()
        }
        t={t}
      />

      {/* Add / Edit Recipe Modal */}
      {isAddModalOpen && (
        <AddRecipeModal
          // A restored version reopens the form on its content.
          key={`${editingRecipe?.id ?? editingDraft?.id ?? 'new'}:${restoredVersion?.id ?? 'current'}`}
          initialRecipe={editForm ?? remixing?.start}
          remixFrom={remixing ? (remixFromName ?? '') : undefined}
          // An earlier version picked from the list replaces the draft's content in the form.
          draft={restoredVersion ? null : editingDraft}
          onSaveDraft={
            canDraft && (!editingRecipe || editingDraft || draftsKnownAtOpen)
              ? keepDraft
              : undefined
          }
          onDiscardDraft={
            editingDraft
              ? () => {
                  void dropDraft(editingDraft);
                  showToast(t.draftDiscarded);
                }
              : undefined
          }
          versions={editingRecipe ? versionSummaries(editingRecipe) : []}
          restore={restore}
          onPickVersion={pickVersion}
          onKeepCurrent={() => {
            setRestoredVersion(null);
            setEditorReopened(true);
          }}
          animateIn={!editorReopened}
          origin={editorOrigin}
          onToast={(message, action) => showToast(message, action ? 'info' : 'success', action)}
          onDelete={editingRecipe ? () => handleDelete(editingRecipe.id) : undefined}
          language={language}
          onClose={closeEditor}
          onSave={(recipeData, existingId, textChanged, changeNote) => {
            if (existingId && editBase) {
              const edited: Recipe = { ...recipeData, id: existingId };
              const saved = hasLeftOutPhotos(editBase)
                ? null
                : updateRecipe(
                    resolveEdit(editBase, edited, editLanguage, textChanged),
                    changeNote,
                  );
              if (!saved) {
                showToast(t.photosStillLoading, 'error');
                return;
              }
            } else {
              // Provisional: translation detects the real language and corrects this.
              const added = addRecipe({
                ...recipeData,
                sourceLanguage: editLanguage,
                ...(remixing && { remixOf: remixing.from }),
              });
              // Its page opens under the closing editor; its card is the one back takes it to.
              setLastRecipeId(added.id);
              // Wherever the last recipe was opened from, this one is the Recipe Box's.
              setRecipeHome('recipes');
              // Added from My Counter (or Makes), it opens over the Recipe Box like any recipe,
              // so back goes to its card there (at the top, newly added), then home.
              if (page !== 'recipes') {
                mainScroll.current.recipes = 0;
                centreOnReturn.current = added.id;
                setPage('recipes');
                setMainPage('recipes');
              }
            }
            // In the vault now, so its draft is done with.
            if (editingDraft) void dropDraft(editingDraft);
            // The editor then closes itself, and closeEditor clears it once it has slid away.
          }}
          t={t}
        />
      )}

      {makeEditor && (
        <AddMakeModal
          make={makeEditor.make}
          recipeId={makeEditor.recipeId}
          recipes={recipes}
          language={language}
          origin={makeEditor.origin}
          onSave={saveMake}
          onDelete={makeEditor.make ? () => removeMake(makeEditor.make!.id) : undefined}
          onClose={() => setMakeEditor(null)}
          t={t}
        />
      )}

      {download.sheet && (
        <DownloadSheet
          key={download.sheet.recipe.id}
          fileName={download.sheet.fileName}
          photo={download.sheet.photo}
          onChoose={download.choose}
          onClose={download.close}
          t={t}
        />
      )}

      {/* iOS Install Guide Modal */}
      {showIOSModal && <IOSInstallModal onClose={() => setShowIOSModal(false)} t={t} />}

      {/* Toast Feedback */}
      <Toast toast={toast} visible={isToastVisible} onHidden={clearToast} onDismiss={hideToast} />
    </div>
  );
}
