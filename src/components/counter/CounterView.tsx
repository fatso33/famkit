import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, CookingPot, Heart, NotebookPen, PencilLine } from 'lucide-react';
import { Language, Recipe, RecipeDraft, Theme } from '../../types/recipe';
import { Make } from '../../types/make';
import { UiTranslations } from '../../i18n/translations';
import type { Season } from '../../utils/season';
import { getLocalizedRecipe } from '../../hooks/useRecipes';
import { useSplashUp } from '../../hooks/useSplashUp';
import { recipePhoto } from '../../utils/vault';
import { creditName } from '../../utils/ownership';
import { photoPending } from '../../utils/deviceCopy';
import { makerName } from '../../utils/makes';
import { localizeMake } from '../../utils/makeTranslation';
import { draftVersion } from '../../utils/recipeDrafts';
import { changedAt, latestMakes, latestRecipes, recipeChange, timeAgo } from '../../utils/counter';
import { splitGreeting } from '../../utils/greeting';
import { prefersReducedMotion, vaultItemKey } from '../../utils/viewTransition';
import { HeartFlourish } from '../common/HeartFlourish';
import { CategoryTile } from '../recipe-grid/CategoryTile';
import { skyClock } from '../../utils/sky';
import { launchFlourishShown } from '../auth/launchFlourish';
import { CounterSky } from './CounterSky';
import { CounterTools } from './CounterTools';
import { COUNTER_ENTRANCE_MS, COUNTER_SINK_MS } from './counterTiming';

/**
 * How the counter arrives: the app's first page out of the launch screen, handed over from the
 * sign-in splash, or come back to from another page (whose transition carries it in).
 */
export type CounterEntrance = 'launch' | 'handoff' | 'return';

/** The hearts line under the greeting. */
export interface CounterNews {
  text: string;
}

interface CounterViewProps {
  entrance: CounterEntrance;
  season: Season;
  /** This launch's greeting, with {name} where the first name goes, and the name. */
  greeting: string;
  firstName: string;
  news: CounterNews | null;
  recipes: Recipe[];
  /** Whether this person has opened the recipe (or it's theirs). */
  isSeen: (recipe: Recipe) => boolean;
  makes: Make[];
  /** This person's drafts, the latest first. */
  drafts: RecipeDraft[];
  language: Language;
  theme: Theme;
  onToggleLanguage: () => void;
  onToggleTheme: (origin: { x: number; y: number }) => void;
  fontPercent: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  onAddRecipe: (from: HTMLElement) => void;
  onAddMake: (from: HTMLElement) => void;
  onOpenSettings: () => void;
  /** A recipe tapped: its name, which flies to its row in the Recipe Box. */
  onOpenRecipe: (id: string, name: HTMLElement) => void;
  onSeeAllRecipes: () => void;
  /** A make tapped: its photo, which grows into its card on the Makes page. */
  onOpenMake: (id: string, photo: HTMLElement) => void;
  onSeeAllMakes: () => void;
  /** A draft tapped: its row, which the editor opens out of. */
  onOpenDraft: (draft: RecipeDraft, from: HTMLElement) => void;
  t: UiTranslations;
}

/**
 * My Counter: each family member's own page, and where the app opens. A greeting under the
 * splash's heart flourish, then the quick keys and preferences, and three windows: the Recipe
 * Box's latest recipes, the latest makes, and this person's drafts. The season's particles
 * drift behind it all.
 */
export const CounterView: React.FC<CounterViewProps> = ({
  entrance,
  season,
  greeting,
  firstName,
  news,
  recipes,
  isSeen,
  makes,
  drafts,
  language,
  theme,
  onToggleLanguage,
  onToggleTheme,
  fontPercent,
  onIncreaseFont,
  onDecreaseFont,
  onAddRecipe,
  onAddMake,
  onOpenSettings,
  onOpenRecipe,
  onSeeAllRecipes,
  onOpenMake,
  onSeeAllMakes,
  onOpenDraft,
  t,
}) => {
  const pageRef = useRef<HTMLElement>(null);
  const splashUp = useSplashUp();
  // The sky's clock as the counter arrives, which its particles carry on from.
  const [skyAge] = useState(skyClock);
  const [now] = useState(Date.now);
  // Arriving fresh, the page plays its entrance with a few particles drifting in front of it;
  // when it's over they sink behind the page. Come back to, it's already settled.
  const arriving = entrance !== 'return' && !prefersReducedMotion();
  const [stage, setStage] = useState<'entering' | 'sinking' | 'settled'>(
    arriving ? 'entering' : 'settled',
  );
  // On a slow launch the launch screen's heart flourish was showing: it glides up into place
  // rather than this one drawing in.
  const [flourishFrom] = useState(() => (entrance === 'launch' ? launchFlourishShown() : null));

  useEffect(() => {
    if (stage === 'settled') return;
    if (stage === 'sinking') {
      const timer = window.setTimeout(() => setStage('settled'), COUNTER_SINK_MS);
      return () => window.clearTimeout(timer);
    }
    // The entrance plays once the page's first frame is on screen (as the Recipe Box's does),
    // so its start isn't spent while the page is still being built.
    let timer = 0;
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const page = pageRef.current;
        page?.setAttribute('data-entrance', entrance);
        const flourish = page?.querySelector<SVGElement>('.counter-flourish');
        if (flourish && flourishFrom) glideFlourish(flourish, flourishFrom);
        timer = window.setTimeout(() => setStage('sinking'), COUNTER_ENTRANCE_MS);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [stage, entrance, flourishFrom]);

  // A window with nothing to show is a single line; it opens out when its first one arrives
  // while the counter is up (not when it already had some as the page came).
  const [hadMakes] = useState(() => latestMakes(makes).length > 0);
  const [hadDrafts] = useState(() => drafts.length > 0);

  const words = splitGreeting(greeting, firstName);
  const latest = latestRecipes(recipes);
  const shownMakes = latestMakes(makes);
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  // A draft of a recipe that has gone since waits, unseen, until the recipe comes back.
  const shownDrafts = drafts.filter((d) => !d.recipeId || recipesById.has(d.recipeId));
  const makesArrived = !hadMakes && shownMakes.length > 0;
  const draftsArrived = !hadDrafts && shownDrafts.length > 0;

  // Each word is its own span, so the greeting can come into focus word by word.
  let wordIndex = 0;
  const wordSpans = (text: string) =>
    text.split(/(\s+)/).map((part, i) =>
      /^\s+$/.test(part) || part === '' ? (
        part
      ) : (
        <span
          key={`${i}-${part}`}
          className="counter-word"
          style={{ '--i': wordIndex++ } as React.CSSProperties}
        >
          {part}
        </span>
      ),
    );

  return (
    <section
      ref={pageRef}
      id="viewCounter"
      className={`counter-page${stage === 'entering' ? ' is-entering' : ''}${flourishFrom ? ' has-flourish-glide' : ''}`}
      data-arrival={entrance}
    >
      <CounterSky
        season={season}
        age={skyAge}
        front={stage === 'entering' ? 'over' : stage === 'sinking' ? 'sinking' : 'behind'}
        hidden={splashUp}
      />

      <div className="counter-content">
        <header className="counter-greeting">
          <h1 className="counter-hello">
            {wordSpans(words.before)}
            {words.name && (
              <em
                className="counter-word counter-name"
                style={{ '--i': wordIndex++ } as React.CSSProperties}
              >
                {words.name}
              </em>
            )}
            {/* "?" comes into focus with the name it follows. */}
            {words.after && (
              <span
                className="counter-word"
                style={{ '--i': Math.max(0, wordIndex - 1) } as React.CSSProperties}
              >
                {words.after}
              </span>
            )}
          </h1>
          <span data-handoff="flourish" className="counter-flourish-slot">
            <HeartFlourish className="counter-flourish vault-flourish" />
          </span>
          {news && (
            <p className="counter-news">
              {news.text}
              <Heart
                className="counter-news-heart"
                size="0.95em"
                strokeWidth={2.2}
                aria-hidden="true"
              />
            </p>
          )}
        </header>

        <CounterTools
          language={language}
          onToggleLanguage={onToggleLanguage}
          theme={theme}
          onToggleTheme={onToggleTheme}
          fontPercent={fontPercent}
          onIncreaseFont={onIncreaseFont}
          onDecreaseFont={onDecreaseFont}
          onAddRecipe={onAddRecipe}
          onAddMake={onAddMake}
          onOpenSettings={onOpenSettings}
          t={t}
        />

        <section
          className="counter-window"
          data-counter-window="recipes"
          aria-labelledby="counterRecipesTitle"
          style={{ '--w': 0 } as React.CSSProperties}
        >
          <div className="counter-window-head">
            <h2 id="counterRecipesTitle" className="counter-window-title">
              {t.freshInBox}
            </h2>
            {latest.length > 0 && (
              <button
                type="button"
                className="counter-see-all"
                aria-label={t.seeAllRecipes}
                onClick={onSeeAllRecipes}
              >
                {t.seeAll}
                <ChevronRight size="1.05em" strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </div>
          {latest.length === 0 ? (
            <p className="counter-empty">
              <NotebookPen size="1.2em" strokeWidth={1.8} aria-hidden="true" />
              {t.boxEmpty}
            </p>
          ) : (
            <ul className="counter-rows">
              {latest.map((recipe, i) => {
                const shown = getLocalizedRecipe(recipe, language) ?? recipe;
                const photo = recipePhoto(shown);
                const change = recipeChange(recipe);
                return (
                  <li key={recipe.id} style={{ '--r': i } as React.CSSProperties}>
                    <button
                      type="button"
                      className="counter-row"
                      data-counter-recipe={vaultItemKey(recipe.id)}
                      onClick={(e) =>
                        onOpenRecipe(
                          recipe.id,
                          e.currentTarget.querySelector<HTMLElement>('[data-counter-name]') ??
                            e.currentTarget,
                        )
                      }
                    >
                      <span className="counter-row-text">
                        <span className="counter-row-name" data-counter-name="">
                          {shown.name}
                        </span>
                        <span className="counter-row-meta">
                          <span className={`counter-tag is-${change}`}>
                            {change === 'new' ? t.recipeNew : t.recipeUpdated}
                          </span>
                          <span className="counter-row-detail">
                            {creditName(shown)} · {timeAgo(changedAt(recipe), now, language)}
                          </span>
                          {!isSeen(recipe) && (
                            <span className="counter-unseen" title={t.unseen}>
                              <span className="sr-only">{t.unseen}</span>
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="counter-row-photo" data-counter-photo="">
                        {photo ? (
                          <img src={photo} alt="" />
                        ) : photoPending(recipe) ? (
                          <span className="photo-pending" />
                        ) : (
                          <CategoryTile recipe={recipe} />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section
          className="counter-window"
          data-counter-window="makes"
          aria-labelledby="counterMakesTitle"
          style={{ '--w': 1 } as React.CSSProperties}
        >
          <div className="counter-window-head">
            <h2 id="counterMakesTitle" className="counter-window-title">
              {t.latestMakes}
            </h2>
            {shownMakes.length > 0 && (
              <button
                type="button"
                className="counter-see-all"
                aria-label={t.seeAllMakes}
                onClick={onSeeAllMakes}
              >
                {t.seeAll}
                <ChevronRight size="1.05em" strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
          </div>
          {/* Collapsed to a line while there are none; it opens out when the first one arrives. */}
          <div className={`counter-unfold${makesArrived ? ' is-arrived' : ''}`}>
            <div className="counter-unfold-inner">
              {shownMakes.length === 0 ? (
                <p className="counter-empty">
                  <CookingPot size="1.2em" strokeWidth={1.8} aria-hidden="true" />
                  {t.makesEmptyTitle}
                </p>
              ) : (
                <ul className="counter-tiles">
                  {shownMakes.map((raw, i) => {
                    const make = localizeMake(raw, language);
                    const recipe = recipesById.get(raw.recipeId);
                    const title =
                      make.title ||
                      (recipe ? (getLocalizedRecipe(recipe, language) ?? recipe).name : '');
                    return (
                      <li key={raw.id} style={{ '--r': i } as React.CSSProperties}>
                        <button
                          type="button"
                          className="counter-tile"
                          data-counter-make={vaultItemKey(raw.id)}
                          aria-label={t.openMakeNamed(title)}
                          onClick={(e) =>
                            onOpenMake(
                              raw.id,
                              e.currentTarget.querySelector<HTMLElement>('[data-counter-photo]') ??
                                e.currentTarget,
                            )
                          }
                        >
                          <span className="counter-tile-photo" data-counter-photo="">
                            {raw.photo ? (
                              <img src={raw.photo} alt="" />
                            ) : (
                              <span className="photo-pending" />
                            )}
                          </span>
                          <span className="counter-tile-title" aria-hidden="true">
                            {title}
                          </span>
                          <span className="counter-tile-maker" aria-hidden="true">
                            {makerName(raw)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section
          className="counter-window"
          data-counter-window="drafts"
          aria-labelledby="counterDraftsTitle"
          style={{ '--w': 2 } as React.CSSProperties}
        >
          <div className="counter-window-head">
            <h2 id="counterDraftsTitle" className="counter-window-title">
              {t.yourDrafts}
            </h2>
          </div>
          <div className={`counter-unfold${draftsArrived ? ' is-arrived' : ''}`}>
            <div className="counter-unfold-inner">
              {shownDrafts.length === 0 ? (
                <p className="counter-empty">
                  <PencilLine size="1.2em" strokeWidth={1.8} aria-hidden="true" />
                  {t.noDrafts}
                </p>
              ) : (
                <ul className="counter-rows">
                  {shownDrafts.map((draft, i) => {
                    const of = draft.recipeId ? recipesById.get(draft.recipeId) : undefined;
                    const name = draft.recipe.name.trim() || t.untitledDraft;
                    return (
                      <li key={draft.id} style={{ '--r': i } as React.CSSProperties}>
                        <button
                          type="button"
                          className="counter-row is-draft"
                          aria-label={t.draftNamed(name)}
                          onClick={(e) => onOpenDraft(draft, e.currentTarget)}
                        >
                          <span className="counter-row-text">
                            <span className="counter-row-name">{name}</span>
                            <span className="counter-row-meta">
                              <span className="counter-tag is-draft">
                                {t.draftLabel(draftVersion(of))}
                              </span>
                              <span className="counter-row-detail">
                                {draft.recipeId ? t.draftOfEdit : t.draftOfNew} ·{' '}
                                {t.draftSavedAgo(timeAgo(draft.savedAt, now, language))}
                              </span>
                            </span>
                          </span>
                          <span className="counter-row-photo is-draft" aria-hidden="true">
                            <PencilLine size="1.25rem" strokeWidth={1.9} />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
};

/**
 * The launch screen's heart flourish, which was showing in the middle of the screen, gliding up
 * into the greeting's place and size (a transform, so it runs on the compositor).
 */
function glideFlourish(flourish: SVGElement, from: DOMRectReadOnly) {
  const to = flourish.getBoundingClientRect();
  if (!to.width) return;
  const scale = from.width / to.width;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  flourish.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${scale})` }, { transform: 'none' }],
    { duration: 900, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'backwards' },
  );
}
