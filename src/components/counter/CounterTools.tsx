import React, { useEffect, useId, useRef, useState } from 'react';
import { CookingPot, Moon, Plus, Settings, Sun } from 'lucide-react';
import { Language, Theme } from '../../types/recipe';
import { UiTranslations } from '../../i18n/translations';
import { useBackStep } from '../../hooks/useBackStep';
import { PrefsGlyph } from '../common/PrefsGlyph';

interface CounterToolsProps {
  language: Language;
  onToggleLanguage: () => void;
  theme: Theme;
  /** From the centre of the theme pill, where the new theme spreads out from. */
  onToggleTheme: (origin: { x: number; y: number }) => void;
  fontPercent: number;
  onIncreaseFont: () => void;
  onDecreaseFont: () => void;
  /** Given the key, which the editor opens out of. */
  onAddRecipe: (from: HTMLElement) => void;
  onAddMake: (from: HTMLElement) => void;
  onOpenSettings: () => void;
  t: UiTranslations;
}

/**
 * The row under the greeting: Add Recipe and Add Make on the left, the preferences key on the
 * right. The key opens a bar that sweeps out leftwards from it over the two keys, holding the
 * language, theme and text size, each pill under its label so all three fit one row on a phone.
 * While the bar is open the key turns into a settings cog, which takes you to Settings; a tap
 * anywhere outside the bar folds it away, and the cog turns back into the sliders.
 */
export const CounterTools: React.FC<CounterToolsProps> = ({
  language,
  onToggleLanguage,
  theme,
  onToggleTheme,
  fontPercent,
  onIncreaseFont,
  onDecreaseFont,
  onAddRecipe,
  onAddMake,
  onOpenSettings,
  t,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef<HTMLButtonElement>(null);
  const barId = useId();
  const languageId = useId();
  const themeId = useId();
  const textId = useId();

  const close = () => {
    setOpen(false);
    keyRef.current?.focus({ preventScroll: true });
  };
  // The phone's back gesture folds the bar away first, as it closes the menu.
  useBackStep(open, close);

  // A tap anywhere outside the bar folds it away, and only that: what was under the finger isn't
  // pressed too (a drag, which scrolls instead, lets the next tap through).
  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    let swallow = false;
    const onDown = (e: PointerEvent) => {
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      swallow = true;
      setOpen(false);
    };
    const onCancel = () => {
      swallow = false;
    };
    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // Escape folds it away too, handing focus back to the key.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      keyRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('pointercancel', onCancel, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      const stop = () => {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('pointercancel', stop, true);
      };
      document.removeEventListener('pointercancel', onCancel, true);
      if (!swallow) {
        stop();
        return;
      }
      // The click that follows the tap closing the bar comes after this: it's swallowed, unless
      // that touch turns into a scroll (pointercancel), which has no click to swallow.
      document.addEventListener('pointercancel', stop, true);
      window.setTimeout(stop, 600);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="counter-tools"
      data-prefs={open ? 'open' : 'closed'}
      onBlur={(e) => {
        // Keyboard focus moving on past the bar folds it away.
        const next = e.relatedTarget;
        if (open && next instanceof Node && !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <div className="counter-quick" inert={open}>
        <button type="button" className="counter-key" onClick={(e) => onAddRecipe(e.currentTarget)}>
          <Plus className="counter-key-icon" size="1.15em" strokeWidth={2.2} aria-hidden="true" />
          <span>{t.addRecipe}</span>
        </button>
        <button type="button" className="counter-key" onClick={(e) => onAddMake(e.currentTarget)}>
          <CookingPot
            className="counter-key-icon"
            size="1.1em"
            strokeWidth={2}
            aria-hidden="true"
          />
          <span>{t.addMake}</span>
        </button>
      </div>

      <div
        id={barId}
        className="counter-prefs-bar"
        role="group"
        aria-label={t.preferences}
        inert={!open}
      >
        <div className="counter-pref" style={{ '--k': 2 } as React.CSSProperties}>
          <span id={languageId} className="counter-pref-label">
            {t.language}
          </span>
          <button
            type="button"
            className="fk-segmented counter-pill"
            data-value={language}
            aria-label={t.languageToggle}
            aria-describedby={languageId}
            onClick={onToggleLanguage}
          >
            <span className="fk-segmented-thumb" aria-hidden="true" />
            <span className={language === 'en' ? 'is-active' : ''}>EN</span>
            <span className={language === 'pl' ? 'is-active' : ''}>PL</span>
          </button>
        </div>

        <div className="counter-pref" style={{ '--k': 1 } as React.CSSProperties}>
          <span id={themeId} className="counter-pref-label">
            {t.themeLabel}
          </span>
          <button
            type="button"
            role="switch"
            className="fk-segmented counter-pill"
            data-value={theme}
            aria-checked={theme === 'dark'}
            aria-label={t.darkMode}
            onClick={(e) => {
              const pill = e.currentTarget.getBoundingClientRect();
              onToggleTheme({ x: pill.left + pill.width / 2, y: pill.top + pill.height / 2 });
            }}
          >
            <span className="fk-segmented-thumb" aria-hidden="true" />
            <span className={theme === 'light' ? 'is-active' : ''}>
              <Sun size="1.35em" strokeWidth={2} aria-hidden="true" />
            </span>
            <span className={theme === 'dark' ? 'is-active' : ''}>
              <Moon size="1.25em" strokeWidth={2} aria-hidden="true" />
            </span>
          </button>
        </div>

        <div className="counter-pref" style={{ '--k': 0 } as React.CSSProperties}>
          <span id={textId} className="counter-pref-label" aria-live="polite">
            {t.textLabel(fontPercent)}
          </span>
          <div className="fk-stepper counter-pill" role="group" aria-labelledby={textId}>
            <button type="button" aria-label={t.decreaseTextSize} onClick={onDecreaseFont}>
              A−
            </button>
            <button type="button" aria-label={t.increaseTextSize} onClick={onIncreaseFont}>
              A+
            </button>
          </div>
        </div>
      </div>

      <button
        ref={keyRef}
        type="button"
        className="fk-prefs-toggle counter-prefs-toggle"
        data-handoff="prefs"
        // Closed, it opens the preferences; open, it's the way to Settings (Escape, a tap
        // outside or the back gesture fold the bar away).
        aria-label={open ? t.settings : t.preferences}
        aria-expanded={open ? undefined : false}
        aria-controls={open ? undefined : barId}
        onClick={() => (open ? onOpenSettings() : setOpen(true))}
      >
        <span className="fk-prefs-key">
          <span className="counter-glyph is-prefs">
            <PrefsGlyph />
          </span>
          <span className="counter-glyph is-cog">
            <Settings size="1.3em" strokeWidth={1.9} aria-hidden="true" />
          </span>
        </span>
      </button>
    </div>
  );
};
