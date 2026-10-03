import { flushSync } from 'react-dom';
import { prefersReducedMotion } from '../utils/viewTransition';

const GLIDE = 'cubic-bezier(0.32, 0.72, 0, 1)';
// How near the top or bottom of the scroller the finger must be for the page to scroll along,
// and how fast it scrolls (px a frame) right at the edge.
const EDGE = 72;
const SPEED = 14;

/** Where the scroller's visible part starts: under its bar, when one is laid over it. */
function visibleTop(scroller: HTMLElement) {
  const bar = scroller.parentElement?.querySelector<HTMLElement>('.editor-bar');
  const top = scroller.getBoundingClientRect().top;
  return bar ? Math.max(top, bar.getBoundingClientRect().bottom) : top;
}

function visibleBottom(scroller: HTMLElement) {
  const bottom = scroller.getBoundingClientRect().bottom;
  const viewport = window.visualViewport;
  return viewport ? Math.min(bottom, viewport.offsetTop + viewport.height) : bottom;
}

/**
 * Where an item sits on screen without its lift (the raised card's rise and scale), so the
 * others make room for its real height and it lands exactly where the reorder puts it.
 */
function laidOut(el: HTMLElement) {
  const box = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  const scale = parseFloat(style.scale) || 1;
  const rise = parseFloat(style.translate?.split(' ')[1] ?? '') || 0;
  const height = box.height / scale;
  const top = box.top + (box.height - height) / 2 - rise;
  return { top, bottom: top + height, height };
}

/**
 * Drags `item` by its grip to a new place among its siblings (those with data-motion-id). The
 * item follows the finger while the others slide aside to show where it will land, and the
 * scroller scrolls along near its edges. On release the item glides into its place, and then
 * `onDrop` puts it there for real: `targetId` is the sibling whose place it takes. Nothing is
 * changed until then, so a drag let go where it began changes nothing.
 *
 * Only transforms move (on the compositor); the reorder itself lands in the same frame the
 * transforms are cleared, so nothing jumps.
 */
export function dragToReorder(
  e: React.PointerEvent<HTMLElement>,
  item: HTMLElement | null,
  onDrop: (id: string, targetId: string) => void,
) {
  if (!item || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const list = item.parentElement;
  const items = [...(list?.children ?? [])].filter(
    (el): el is HTMLElement => el instanceof HTMLElement && Boolean(el.dataset.motionId),
  );
  const from = items.indexOf(item);
  if (from === -1 || items.length < 2) return;

  // Keeps the keyboard where it is (no blur), and the browser from selecting text.
  e.preventDefault();
  const grip = e.currentTarget;
  grip.setPointerCapture?.(e.pointerId);
  const pointerId = e.pointerId;
  const scroller = item.closest<HTMLElement>('.editor-scroll');
  const reduced = prefersReducedMotion();

  const rects = items.map(laidOut);
  const gap =
    from < items.length - 1
      ? rects[from + 1].top - rects[from].bottom
      : rects[from].top - rects[from - 1].bottom;
  const slot = rects[from].height + gap;
  const y0 = e.clientY;
  const scroll0 = scroller?.scrollTop ?? 0;
  let y = y0;
  let to = from;
  let frame = 0;

  item.classList.add('is-dragging');
  document.documentElement.classList.add('is-reordering');
  for (const el of items) {
    if (el !== item) el.style.transition = reduced ? 'none' : `transform 0.28s ${GLIDE}`;
  }

  // How far the item has come, counting what the scroller scrolled meanwhile.
  const offset = () => y - y0 + ((scroller?.scrollTop ?? scroll0) - scroll0);

  const place = () => {
    const dy = offset();
    item.style.transform = `translateY(${dy}px)`;
    // It passes a neighbour once its leading edge crosses that one's middle: a tall card (its
    // tools open) moves as readily as a short row.
    const bottom = rects[from].bottom + dy;
    const top = rects[from].top + dy;
    let next = from;
    for (let i = from + 1; i < items.length; i++) {
      if (bottom > rects[i].top + rects[i].height / 2) next = i;
    }
    for (let i = from - 1; i >= 0; i--) {
      if (top < rects[i].top + rects[i].height / 2) next = i;
    }
    if (next === to) return;
    to = next;
    items.forEach((el, i) => {
      if (i === from) return;
      const shift =
        from < to && i > from && i <= to ? -slot : to < from && i >= to && i < from ? slot : 0;
      el.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  };

  // Near an edge, the page scrolls along, faster the nearer the finger.
  const scrollAlong = () => {
    frame = 0;
    if (!scroller) return;
    const top = visibleTop(scroller);
    const bottom = visibleBottom(scroller);
    const speed =
      y < top + EDGE
        ? -SPEED * Math.min(1, (top + EDGE - y) / EDGE)
        : y > bottom - EDGE
          ? SPEED * Math.min(1, (y - bottom + EDGE) / EDGE)
          : 0;
    if (!speed) return;
    const before = scroller.scrollTop;
    scroller.scrollTop += speed;
    if (scroller.scrollTop === before) return;
    place();
    frame = requestAnimationFrame(scrollAlong);
  };

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    y = ev.clientY;
    place();
    if (!frame) frame = requestAnimationFrame(scrollAlong);
  };

  let ended = false;
  const end = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId || ended) return;
    ended = true;
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', end);
    grip.removeEventListener('pointercancel', end);
    grip.removeEventListener('lostpointercapture', end);
    if (frame) cancelAnimationFrame(frame);
    document.documentElement.classList.remove('is-reordering');
    if (!item.isConnected) return;
    // Only letting go moves it. A drag the system took over (a back gesture, a call) or one
    // whose grip went away puts it back where it was.
    if (ev.type !== 'pointerup' && to !== from) {
      to = from;
      for (const el of items) if (el !== item) el.style.transform = '';
    }

    // Where it lands: its bottom where the last one passed ended (going down), or its top where
    // the last one passed began (going up).
    const target =
      to > from
        ? rects[to].bottom - rects[from].bottom
        : to < from
          ? rects[to].top - rects[from].top
          : 0;
    const settle = () => {
      const focused = document.activeElement as HTMLElement | null;
      for (const el of items) {
        el.style.transition = 'none';
        el.style.transform = '';
      }
      item.classList.remove('is-dragging');
      if (to !== from) {
        flushSync(() => onDrop(item.dataset.motionId!, items[to].dataset.motionId!));
        // Moving a field in the page drops its focus in some browsers: give it back.
        if (focused?.isConnected && document.activeElement !== focused) {
          focused.focus({ preventScroll: true });
        }
      }
      requestAnimationFrame(() => {
        for (const el of items) el.style.removeProperty('transition');
      });
    };
    const dy = offset();
    if (reduced || Math.abs(dy - target) < 1) {
      settle();
      return;
    }
    // The glide home: the tilt eases off at the same time (CSS, as is-dragging comes off).
    item.style.transition = ['transform', 'rotate', 'scale']
      .map((property) => `${property} 0.32s ${GLIDE}`)
      .join(', ');
    item.style.transform = `translateY(${target}px)`;
    item.classList.remove('is-dragging');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      item.removeEventListener('transitionend', onEnd);
      settle();
    };
    const onEnd = (te: TransitionEvent) => {
      if (te.target === item && te.propertyName === 'transform') finish();
    };
    item.addEventListener('transitionend', onEnd);
    window.setTimeout(finish, 400);
  };

  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', end);
  grip.addEventListener('pointercancel', end);
  grip.addEventListener('lostpointercapture', end);
}

/** Moves the item with `id` into the place of the one with `targetId` (the rest shift over). */
export function moveToPlaceOf<T extends { id: string }>(list: T[], id: string, targetId: string) {
  const from = list.findIndex((x) => x.id === id);
  const to = list.findIndex((x) => x.id === targetId);
  if (from === -1 || to === -1 || from === to) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
