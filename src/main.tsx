import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './components/auth/AuthGate';
import { clearLegacyApiKey, loadDevicePhotosForLaunch, recipeHeroIds } from './services/storage';
import { readPhotosFirst } from './services/photos';
import './index.css';

clearLegacyApiKey();

// The vault makes its entrance with the photos kept on this phone, rather than filling them in a
// moment later: the first render waits briefly for My Counter's (only the page colour shows
// meanwhile). The other recipes' photos are read straight after, for the pages behind it.
const LAUNCH_WAIT = 300;
const heroes = recipeHeroIds();
const counterPhotos = readPhotosFirst(heroes.first);
void counterPhotos.then(() => readPhotosFirst(heroes.rest));
void Promise.race([
  Promise.all([loadDevicePhotosForLaunch(LAUNCH_WAIT), counterPhotos]),
  new Promise((resolve) => setTimeout(resolve, LAUNCH_WAIT)),
]).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthGate>
        <App />
      </AuthGate>
    </StrictMode>,
  ),
);
