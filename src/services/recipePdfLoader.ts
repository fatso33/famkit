/**
 * The recipe PDF maker, fetched the first time it's needed: pdf-lib is large, so it stays out of
 * the app's first download (the build puts it in a file of its own).
 */
export const loadRecipePdf = () => import('./recipePdf');
