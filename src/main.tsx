import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthGate } from './components/auth/AuthGate';
import { clearLegacyApiKey, loadDevicePhotosForLaunch } from './services/storage';
import './index.css';

clearLegacyApiKey();

// The vault makes its entrance with the photos kept on this phone, rather than filling them in a
// moment later: the first render waits for them briefly (only the page colour shows meanwhile).
void loadDevicePhotosForLaunch(300).then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AuthGate>
        <App />
      </AuthGate>
    </StrictMode>,
  ),
);
