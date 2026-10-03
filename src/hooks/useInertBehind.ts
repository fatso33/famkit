import { useEffect, type RefObject } from 'react';

/**
 * While a full-screen layer is mounted, the page under it (every element before the layer among
 * its siblings) is out of reach: Tab, taps and screen readers stay in the layer. Elements after
 * it, such as the toast with its Undo, stay reachable. Only what this set inert is let go.
 */
export function useInertBehind(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const made: Element[] = [];
    for (let el = ref.current?.previousElementSibling; el; el = el.previousElementSibling) {
      if (el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      made.push(el);
    }
    return () => made.forEach((el) => el.removeAttribute('inert'));
  }, [ref]);
}
