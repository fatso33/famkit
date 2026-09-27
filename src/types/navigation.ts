export type AppPage = 'recipes' | 'makes' | 'settings';

/** Pages the back gesture returns to. Settings returns to whichever was open last. */
export type MainPage = Exclude<AppPage, 'settings'>;
