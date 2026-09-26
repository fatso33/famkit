import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import {
  getAuth,
  GoogleAuthProvider,
  Auth,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  getFirestore,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
export const isAppCheckEnabled = isFirebaseConfigured && Boolean(recaptchaSiteKey);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    // App Check proves requests come from this site, which guards the AI Logic (Gemini) quota.
    if (isAppCheckEnabled && recaptchaSiteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }

    auth = getAuth(app);
    // Ensure auth state persists in browser across reloads and tab closures
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Could not set browserLocalPersistence:', err);
    });

    try {
      // Initialize Firestore with IndexedDB multi-tab offline caching
      db = initializeFirestore(app, {
        // Optional recipe fields are often undefined (e.g. empty tips); without this, Firestore
        // rejects the whole write and the recipe never leaves the device.
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Fallback if already initialized
      db = getFirestore(app);
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
}

export { app, auth, db, googleProvider };
