import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRecipeId } from '../utils/recipeId';

describe('newRecipeId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('gives recipes added in the same millisecond different ids', () => {
    // Two phones adding a recipe at the same moment used to get the same id, and the rules then
    // refused the second one's save, so it vanished from that phone.
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const ids = Array.from({ length: 1000 }, () => newRecipeId());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts with the time it was made, readable in the Firebase console', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    expect(newRecipeId()).toMatch(/^recipe-1700000000000-[0-9a-f]{12}$/);
  });
});
