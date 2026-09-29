import React, { useLayoutEffect, useRef } from 'react';
import { labelFit, labelFloor, labelsOverflow } from '../../utils/forkLines';

interface ForkSwitchProps {
  /** Each path's name on the switch. */
  labels: string[];
  active: number;
  onChange: (index: number) => void;
  /** What the choice is, for screen readers. */
  label: string;
  className?: string;
}

/** A name's words, each kept whole on one line; the spaces between them are where it wraps. */
const words = (text: string) =>
  text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part, k) =>
      /\s/.test(part) ? (
        part
      ) : (
        <span key={k} className="fork-word">
          {part}
        </span>
      ),
    );

/**
 * The two or three buttons a fork's line splits into, on the recipe page and in the editor.
 * Choosing one floods it with the accent from the top, where its branch lands (index.css).
 * A radio group: arrow keys move between the paths.
 */
export const ForkSwitch: React.FC<ForkSwitchProps> = ({
  labels,
  active,
  onChange,
  label,
  className = '',
}) => {
  const root = useRef<HTMLDivElement>(null);
  const options = useRef<(HTMLButtonElement | null)[]>([]);
  const names = labels.join('\n');

  const choose = (index: number) => {
    const next = (index + labels.length) % labels.length;
    onChange(next);
    options.current[next]?.focus();
  };

  // A word is never split. When the widest one is wider than an even share of the row, all the
  // names shrink together until it fits (utils/forkLines has the floor). Past the floor, the
  // columns share the row unevenly so each word still sits whole (index.css); only when even
  // that can't fit may words hyphenate.
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const fit = () => {
      el.style.setProperty('--fork-fit', '1');
      el.classList.remove('is-cramped');
      el.classList.add('is-measuring');
      const room: number[] = [];
      const widest: number[] = [];
      let pad = 0;
      el.querySelectorAll<HTMLElement>('.fork-switch-label').forEach((name) => {
        room.push(name.clientWidth);
        pad = (name.parentElement?.offsetWidth ?? 0) - name.clientWidth;
        let widestWord = 0;
        name.querySelectorAll('.fork-word').forEach((word) => {
          widestWord = Math.max(widestWord, word.getBoundingClientRect().width);
        });
        widest.push(widestWord);
      });
      el.classList.remove('is-measuring');
      const option = el.querySelector('.fork-switch-option');
      const fontPx = option ? parseFloat(getComputedStyle(option).fontSize) : 0;
      const scale = labelFit(room, widest, labelFloor(fontPx));
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      el.style.setProperty('--fork-fit', String(scale));
      el.classList.toggle('is-cramped', labelsOverflow(widest, scale, pad, gap, el.clientWidth));
    };
    fit();
    if (typeof ResizeObserver === 'undefined') return;
    // Refit when the row's width changes (turning the phone) or the text size does (the menu's
    // A+/A− keys, which also make the switch taller), a frame later so the refit's own change of
    // height isn't reported back inside the observer.
    const measure = () =>
      `${el.clientWidth} ${getComputedStyle(document.documentElement).fontSize}`;
    let size = measure();
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const now = measure();
      if (now === size) return;
      size = now;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(el);
    document.fonts?.ready.then(fit, () => undefined);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [names]);

  return (
    <div
      ref={root}
      className={`fork-switch${labels.length > 2 ? ' has-three' : ''} ${className}`.trim()}
      role="radiogroup"
      aria-label={label}
      style={{ '--paths': labels.length } as React.CSSProperties}
    >
      {labels.map((text, i) => (
        <button
          key={i}
          ref={(el) => {
            options.current[i] = el;
          }}
          type="button"
          role="radio"
          aria-checked={i === active}
          tabIndex={i === active ? 0 : -1}
          className={`fork-switch-option${i === active ? ' is-on' : ''}`}
          onClick={() => onChange(i)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
              e.preventDefault();
              choose(i + 1);
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
              e.preventDefault();
              choose(i - 1);
            }
          }}
        >
          <span className="fork-switch-label">{words(text)}</span>
        </button>
      ))}
    </div>
  );
};
