/**
 * Document id for a new recipe: the time it was made, readable in the Firebase console, plus a
 * random part, so two phones adding a recipe in the same millisecond can't pick the same id.
 * getRandomValues rather than randomUUID, which older iPhones (before iOS 15.4) lack.
 */
export function newRecipeId(): string {
  const random = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `recipe-${Date.now()}-${random}`;
}
