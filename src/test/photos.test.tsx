import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { fetchPhotoFromCloud } from '../services/firestore';
import {
  fillPhotos,
  photoState,
  photosCommitted,
  readPhotosFirst,
  requestPhoto,
  withPhotosApart,
} from '../services/photos';
import { usePhoto } from '../hooks/usePhoto';
import { Photo } from '../components/common/Photo';
import { Recipe } from '../types/recipe';
import {
  dataUrlBytes,
  mapRecipePhotos,
  photoIdOf,
  photoRef,
  recipePhotoIds,
  uploadGroups,
} from '../utils/photoRefs';

// Only I/O is mocked: the cloud's photos. (jsdom has no IndexedDB, so nothing is kept on the
// "phone": every photo not added here comes from the cloud.)
vi.mock('../services/firestore', () => ({
  hasCloud: true,
  fetchPhotoFromCloud: vi.fn(),
}));
const fetchPhoto = vi.mocked(fetchPhotoFromCloud);

// Each test uses photos of its own, as the photo store lasts the whole run (like a session).
let next = 0;
const freshId = () => (++next).toString(16).padStart(32, '0');

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const dataUrl = (text: string) => `data:image/jpeg;base64,${btoa(text)}`;

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: 'babka',
  name: 'Babka',
  author: 'Ola',
  category: 'cakes',
  heroImage: '',
  yieldHeader: '',
  ingredients: [],
  steps: [{ num: 1, text: 'Bake.' }],
  ...over,
});

beforeEach(() => {
  fetchPhoto.mockReset();
});

describe('photo pointers', () => {
  it('reads only well-formed pointers', () => {
    const id = 'ab'.repeat(16);
    expect(photoIdOf(photoRef(id))).toBe(id);
    expect(photoIdOf('photo:../recipes/x')).toBeNull();
    expect(photoIdOf(dataUrl('x'))).toBeNull();
    expect(photoIdOf(42)).toBeNull();
  });

  it("goes through every photo field: the recipe's own, each step's and each path's", () => {
    const r = recipe({
      heroImage: 'h',
      steps: [
        { num: 1, text: 'a', imageSrc: 's' },
        {
          num: 2,
          text: 'b',
          fork: {
            paths: [
              { label: 'A', text: 'a' },
              { label: 'B', text: 'b', imageSrc: 'p' },
            ],
          },
        },
      ],
    });
    const upper = mapRecipePhotos(r, (src) => src.toUpperCase());
    expect(upper.heroImage).toBe('H');
    expect(upper.steps[0].imageSrc).toBe('S');
    expect(upper.steps[1].fork!.paths[1].imageSrc).toBe('P');
    expect(upper.steps[1].fork!.paths[0]).toBe(r.steps[1].fork!.paths[0]);
    // Nothing changed: the very same recipe.
    expect(mapRecipePhotos(r, (src) => src)).toBe(r);
  });

  it('lists the photos pointed at, the recipe’s own first, each once', () => {
    const [a, b] = [freshId(), freshId()];
    const r = recipe({
      heroImage: photoRef(a),
      steps: [
        { num: 1, text: 'x', imageSrc: photoRef(b) },
        { num: 2, text: 'y', imageSrc: photoRef(a) },
        { num: 3, text: 'z', imageSrc: dataUrl('old') },
      ],
    });
    expect(recipePhotoIds(r)).toEqual([a, b]);
  });

  it('decodes a data URL, and groups uploads to a size', () => {
    expect(dataUrlBytes(dataUrl('AB'))?.bytes).toEqual(new Uint8Array([65, 66]));
    expect(dataUrlBytes('data:text/plain,AB')).toBeNull();
    const up = (n: number) => ({ id: String(n), bytes: new Uint8Array(n) });
    expect(uploadGroups([up(4), up(4), up(9), up(1)], 8).map((g) => g.map((u) => u.id))).toEqual([
      ['4', '4'],
      ['9'],
      ['1'],
    ]);
  });
});

describe('moving photos out at save', () => {
  it('points at each photo instead of holding it, and sends each once', () => {
    const hero = dataUrl('hero photo');
    const r = recipe({
      heroImage: hero,
      steps: [
        { num: 1, text: 'a', hasImage: true, imageSrc: dataUrl('step photo') },
        { num: 2, text: 'b', hasImage: true, imageSrc: hero },
      ],
    });
    const first = withPhotosApart(r);
    const heroId = photoIdOf(first.recipe.heroImage);
    expect(heroId).not.toBeNull();
    expect(first.recipe.steps[1].imageSrc).toBe(first.recipe.heroImage);
    expect(first.uploads.map((u) => new TextDecoder().decode(u.bytes))).toEqual([
      'hero photo',
      'step photo',
    ]);
    // Shown from this phone at once, never fetched.
    expect(photoState(heroId!)?.status).toBe('ready');

    // Saved again before the cloud confirmed it (a draft, then the recipe): sent again, same id.
    const again = withPhotosApart(r);
    expect(again.recipe).toEqual(first.recipe);
    expect(again.uploads).toHaveLength(2);

    photosCommitted(first.uploads);
    expect(withPhotosApart(r).uploads).toEqual([]);
  });

  it('leaves photos already kept apart, and anything that is not a photo it holds', () => {
    const r = recipe({ heroImage: photoRef(freshId()) });
    const result = withPhotosApart(r);
    expect(result.recipe).toBe(r);
    expect(result.uploads).toEqual([]);
  });
});

describe('showing a photo kept apart', () => {
  it('waits for it, then shows it', async () => {
    const id = freshId();
    const reply = deferred<Uint8Array | null>();
    fetchPhoto.mockReturnValueOnce(reply.promise);

    const { result } = renderHook(() => usePhoto(photoRef(id)));
    expect(result.current).toEqual({ src: '', pending: true });
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledWith(id));

    await act(async () => reply.resolve(new Uint8Array([0xff, 0xd8])));
    expect(result.current.pending).toBe(false);
    expect(result.current.src).toMatch(/^blob:/);
  });

  it('shows a photo the record holds as it is', () => {
    const { result } = renderHook(() => usePhoto(dataUrl('x')));
    expect(result.current).toEqual({ src: dataUrl('x'), pending: false });
    expect(fetchPhoto).not.toHaveBeenCalled();
  });

  it("shows the fallback, not endless waiting, for one that can't be had", async () => {
    const id = freshId();
    fetchPhoto.mockResolvedValueOnce(null);
    render(<Photo value={photoRef(id)} alt="Babka" fallback={<p>No photo</p>} />);
    expect(await screen.findByText('No photo')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('tries again when the phone is back online', async () => {
    const id = freshId();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchPhoto.mockRejectedValueOnce(new Error('unavailable'));
    render(<Photo value={photoRef(id)} alt="Babka" fallback={<p>No photo</p>} />);
    expect(await screen.findByText('No photo')).toBeInTheDocument();

    fetchPhoto.mockResolvedValueOnce(new Uint8Array([0xff, 0xd8]));
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(await screen.findByRole('img', { name: 'Babka' })).toBeInTheDocument();
  });
});

describe('filling in the box in the background', () => {
  it('keeps photos without holding them, and lets one on screen go ahead of the rest', async () => {
    const waiting = Array.from({ length: 6 }, freshId);
    const onScreen = freshId();
    const replies = new Map<string, ReturnType<typeof deferred<Uint8Array | null>>>();
    fetchPhoto.mockImplementation((id) => {
      const reply = deferred<Uint8Array | null>();
      replies.set(id, reply);
      return reply.promise;
    });

    await fillPhotos(waiting);
    // Four at a time.
    expect(fetchPhoto.mock.calls.map(([id]) => id)).toEqual(waiting.slice(0, 4));

    requestPhoto(onScreen);
    expect(replies.has(onScreen)).toBe(false);
    await act(async () => replies.get(waiting[0])!.resolve(new Uint8Array([1])));
    // The freed place goes to the photo on screen, not the next in the background.
    await waitFor(() => expect(fetchPhoto).toHaveBeenLastCalledWith(onScreen));
    // Fetched in the background: kept, not held in memory.
    expect(photoState(waiting[0])).toBeUndefined();

    // Every fetch settles, so none is left holding a place for the tests after.
    fetchPhoto.mockImplementation(() => Promise.resolve(null));
    await act(async () => replies.forEach((reply) => reply.resolve(null)));
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(waiting.length + 1));
  });
});

describe('photos read before the app first draws (regressions)', () => {
  it("fetches one a screen asked for while the read was going on, if it wasn't kept here", async () => {
    const id = freshId();
    fetchPhoto.mockResolvedValueOnce(new Uint8Array([0xff, 0xd8]));
    const reading = readPhotosFirst([id]);
    // The screen shows it mid-read: its ask finds it already loading.
    const { result } = renderHook(() => usePhoto(photoRef(id)));
    await act(() => reading);
    await waitFor(() => expect(result.current.src).toMatch(/^blob:/));
    expect(fetchPhoto).toHaveBeenCalledWith(id);
  });

  it('fetches each photo once a session in the background, even where none can be kept', async () => {
    const [kept, gone] = [freshId(), freshId()];
    fetchPhoto.mockImplementation((id) =>
      Promise.resolve(id === kept ? new Uint8Array([1]) : null),
    );
    await fillPhotos([kept, gone]);
    await waitFor(() => expect(fetchPhoto).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The box changes (a snapshot): nothing is fetched again.
    await fillPhotos([kept, gone]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchPhoto).toHaveBeenCalledTimes(2);
  });
});
