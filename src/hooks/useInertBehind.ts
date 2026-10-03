import { useEffect, type RefObject } from 'react';

// How many open layers hold each element inert. A layer opening over another (the start sheet
// handing on to the editor) holds the same page; it stays inert until the last of them goes.
const holds = new WeakMap<Element, number>();

/**
 * While a full-screen layer is mounted, the page under it (every element before the layer among
 * its siblings) is out of reach: Tab, taps and screen readers stay in the layer. Elements after
 * it, such as the toast with its Undo, stay reachable. Only what these layers set inert is let
 * go, and only once no layer still needs it.
 */
export function useInertBehind(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const held: Element[] = [];
    for (let el = ref.current?.previousElementSibling; el; el = el.previousElementSibling) {
      const count = holds.get(el);
      // Inert for some other reason: not this hook's to let go.
      if (count === undefined && el.hasAttribute('inert')) continue;
      if (count === undefined) el.setAttribute('inert', '');
      holds.set(el, (count ?? 0) + 1);
      held.push(el);
    }
    return () =>
      held.forEach((el) => {
        const count = (holds.get(el) ?? 1) - 1;
        if (count > 0) {
          holds.set(el, count);
          return;
        }
        holds.delete(el);
        el.removeAttribute('inert');
      });
  }, [ref]);
}
