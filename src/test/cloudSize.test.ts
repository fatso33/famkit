import { describe, it, expect } from 'vitest';
import { fitsInCloud } from '../utils/cloudSize';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

// An embedded photo of about `kb` kilobytes, as the editor stores one.
const photo = (kb: number) => `data:image/jpeg;base64,${'A'.repeat(kb * 1024)}`;

const withStepPhotos = (count: number, kb: number) => ({
  ...WANDAS_CHEESE_BREAD,
  heroImage: photo(kb),
  steps: WANDAS_CHEESE_BREAD.steps.map((step, i) =>
    i < count - 1 ? { ...step, hasImage: true, imageSrc: photo(kb) } : step,
  ),
});

describe('fitsInCloud', () => {
  it('takes a recipe with a few photos', () => {
    expect(fitsInCloud(WANDAS_CHEESE_BREAD)).toBe(true);
    expect(fitsInCloud(withStepPhotos(3, 200))).toBe(true);
  });

  it("refuses one whose photos take it past the cloud's 1 MiB limit for a recipe", () => {
    expect(fitsInCloud(withStepPhotos(6, 200))).toBe(false);
  });

  it('keeps room for the translation still to come', () => {
    // Just under the limit with its photos, but its words will be translated too.
    const words = 'x'.repeat(200 * 1024);
    const nearlyFull = { ...withStepPhotos(4, 200), notes: words };
    expect(fitsInCloud({ ...nearlyFull, notes: '' })).toBe(true);
    expect(fitsInCloud(nearlyFull)).toBe(false);
  });
});
