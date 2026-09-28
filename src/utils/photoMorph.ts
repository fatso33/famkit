/**
 * The recipe photo morphs between a card and the recipe's hero, which crop it differently
 * (16:10 centred, and 4:3 a little above centre). Morphing the two crops cross-fades two
 * different pictures, which reads as a double image. Instead, each end lays its photo out
 * uncropped, at the size and offset object-fit: cover gives it, inside a frame that clips it.
 * The browser then morphs one whole photo inside a morphing frame (index.css nests the photo's
 * view transition group in the frame's), so every in-between frame shows exactly one picture
 * and both ends land on exactly the crop the page shows.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  left: number;
  top: number;
}

/** Where object-fit: cover puts a photo in a frame; align is object-position as 0–1 fractions. */
export function coverBox(frame: Size, photo: Size, align: { x: number; y: number }): Box {
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  const width = photo.width * scale;
  const height = photo.height * scale;
  return {
    left: (frame.width - width) * align.x,
    top: (frame.height - height) * align.y,
    width,
    height,
  };
}

/** A computed object-position ("50% 35%") as fractions; anything else counts as centred. */
export function parseObjectPosition(value: string): { x: number; y: number } {
  const [x, y] = value.split(/\s+/).map((part) => {
    const match = /^(-?[\d.]+)%$/.exec(part);
    return match ? Number(match[1]) / 100 : 0.5;
  });
  return { x: x ?? 0.5, y: y ?? x ?? 0.5 };
}

/** Whether the browser can nest one morph inside another, which the uncropped morph needs. */
export function canNestMorphs(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('view-transition-group', 'nearest') &&
    CSS.supports('selector(::view-transition-group-children(a))')
  );
}

const LAID_OUT = ['position', 'left', 'top', 'width', 'height', 'max-width', 'object-fit'];

/**
 * Lays out each loaded photo marked data-morph-photo uncropped in its frame, for the browser to
 * snapshot. It looks exactly as before. Returns how many it laid out (a photo still loading is
 * left as it is) and a function that puts them back.
 */
export function uncropMorphPhotos(): { laidOut: number; undo: () => void } {
  const photos = [...document.querySelectorAll<HTMLImageElement>('img[data-morph-photo]')];
  const done: HTMLImageElement[] = [];
  const heldFrames: HTMLElement[] = [];
  for (const img of photos) {
    const holder = img.parentElement;
    const frame = holder?.getBoundingClientRect();
    if (!holder || !frame || !img.naturalWidth || !img.naturalHeight || !frame.width) continue;
    // The photo is placed against its frame, so the frame must hold it: placed against some
    // ancestor instead, it would sit shifted and unclipped, and the morph would start with a jump.
    const position = getComputedStyle(holder).position;
    if (!position || position === 'static') {
      holder.style.position = 'relative';
      heldFrames.push(holder);
    }
    const box = coverBox(
      frame,
      { width: img.naturalWidth, height: img.naturalHeight },
      parseObjectPosition(getComputedStyle(img).objectPosition),
    );
    Object.assign(img.style, {
      position: 'absolute',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
      maxWidth: 'none',
      objectFit: 'fill',
    });
    done.push(img);
  }
  const undo = () => {
    for (const img of done) for (const property of LAID_OUT) img.style.removeProperty(property);
    for (const holder of heldFrames) holder.style.removeProperty('position');
  };
  return { laidOut: done.length, undo };
}
