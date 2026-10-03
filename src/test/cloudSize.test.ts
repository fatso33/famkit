import { describe, it, expect } from 'vitest';
import { fitsInCloud } from '../utils/cloudSize';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';

// An embedded photo of about `kb` kilobytes, as the editor stores one.
const photo = (kb: number) =>
  `data:image/jpeg;base64,${'A'.repeat(Math.ceil((kb * 1024 * 4) / 3))}`;

const withStepPhotos = (count: number, kb: number) => ({
  ...WANDAS_CHEESE_BREAD,
  heroImage: photo(kb),
  steps: WANDAS_CHEESE_BREAD.steps.map((step, i) =>
    i < count - 1 ? { ...step, hasImage: true, imageSrc: photo(kb) } : step,
  ),
});

describe('fitsInCloud', () => {
  it('takes a recipe with any number of photos, since each is kept on its own', () => {
    expect(fitsInCloud(WANDAS_CHEESE_BREAD)).toBe(true);
    expect(fitsInCloud(withStepPhotos(3, 200))).toBe(true);
    // Once more than the 1 MiB a recipe document holds, which used to be refused.
    expect(fitsInCloud(withStepPhotos(8, 250))).toBe(true);
  });

  it("refuses a photo past the cloud's limit for one photo", () => {
    expect(fitsInCloud(withStepPhotos(2, 880))).toBe(true);
    expect(fitsInCloud(withStepPhotos(2, 920))).toBe(false);
  });

  it('keeps room for the translation still to come', () => {
    // Words just under half the limit fit; over half, their translation wouldn't.
    const fits = { ...WANDAS_CHEESE_BREAD, notes: 'x'.repeat(470 * 1024) };
    const tooLong = { ...WANDAS_CHEESE_BREAD, notes: 'x'.repeat(520 * 1024) };
    expect(fitsInCloud(fits)).toBe(true);
    expect(fitsInCloud(tooLong)).toBe(false);
  });
});
