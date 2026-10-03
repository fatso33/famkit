import React, { useLayoutEffect, useRef } from 'react';
import { fitScale, mostCrowded, toolStripRows } from '../../utils/fitText';

// How many times wider than its key the most crowded label is with its longest word whole.
const crowding = (strip: HTMLElement) =>
  mostCrowded(
    // Each label is at most as wide as its key (index.css), so a word too long for it overflows.
    [
      ...strip.querySelectorAll<HTMLElement>('.tool-strip-button > span:not(.tool-strip-letter)'),
    ].map((label) => ({
      // Widths round to whole pixels, so a label that just fits can read a pixel over.
      needed: label.scrollWidth > label.clientWidth + 1 ? label.scrollWidth : label.clientWidth,
      available: label.clientWidth,
    })),
  );

interface ToolStripProps {
  /** Names the group for screen readers, e.g. "Tools for step 2". */
  label: string;
  /** The keys' labels, so they're measured again when one changes. */
  labels: readonly string[];
  children: React.ReactNode;
}

/**
 * A row or step's tools, as keys with an icon over a label. A label never breaks mid-word: on a
 * narrow phone at large text the labels shrink alike until the longest fits its key whole
 * ("Zamiennik"), and where that would make them too small to read, the keys go onto two rows.
 * Measured again when the strip changes size (text size, rotation), a font loads, or a label
 * changes (see useFitText, which this follows).
 */
export const ToolStrip: React.FC<ToolStripProps> = ({ label, labels, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const text = labels.join('\n');

  useLayoutEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const fit = () => {
      strip.style.removeProperty('--fit-tool');
      delete strip.dataset.rows;
      let scale = fitScale(1, crowding(strip));
      const rows = toolStripRows(scale, strip.children.length);
      if (rows > 1) {
        strip.dataset.rows = String(rows);
        scale = fitScale(1, crowding(strip));
      }
      if (scale < 1) strip.style.setProperty('--fit-tool', String(scale));
    };
    fit();
    // A frame later, so changing the strip here isn't reported as a resize within the observer's
    // own callback.
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(later);
    observer?.observe(strip);
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) fit();
    });
    document.fonts?.addEventListener?.('loadingdone', later);
    return () => {
      live = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.fonts?.removeEventListener?.('loadingdone', later);
    };
  }, [text]);

  return (
    <div ref={ref} className="tool-strip" role="group" aria-label={label}>
      {children}
    </div>
  );
};
