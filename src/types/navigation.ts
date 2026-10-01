/** My Counter (the home page, where the app opens), the Recipe Box, Makes, and Settings. */
export type AppPage = 'counter' | 'recipes' | 'makes' | 'settings';

/** Pages the back gesture returns to. Settings returns to whichever was open last. */
export type MainPage = Exclude<AppPage, 'settings'>;
