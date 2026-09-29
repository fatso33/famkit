# 🌾 Family Kitchen — Heirloom Family Recipe Vault

A professional, modern, offline-first Progressive Web App (PWA) built with **React 19**, **TypeScript**, **Tailwind CSS v4**, **Vite 6**, and **Firebase 12**. Designed to preserve heirloom family recipes with verbatim culinary directives, dynamic portion scaling, screen wake lock for cooking, multi-device cloud synchronization, and authentic bilingual Polish/English support.

Deployable directly as a zero-server static Single Page Application (SPA) to **GitHub Pages** with Cloud Firestore real-time sync.

---

## ✨ Features

- **🍞 Wanda's Cheese Bread**: Verbatim heirloom instructions, authentic temperatures, ingredient weights, and folding steps preserved with precision.
- **🇵🇱 Bilingual Polish/English Localization**: Full culinary translation with natural terminology (e.g. _garnek żeliwny_, _luźne / rzadkie, klejące ciasto_, _instrukcja składania ciasta_) and grammatical unit pluralization (`łyżeczki` vs `łyżeczek`, `szklanki` vs `szklanek`).
- **⚖️ Dynamic Portion Scaling**: Intelligently scales ingredient amounts (0.5x, 1x, 2x, 4x, etc.) with culinary diagonal fraction formatting (½, ¼, 1 ½) and dual-unit conversions (cups / ml).
- **☀️ Cook Mode (Screen Wake Lock API)**: Keeps your phone or tablet screen awake while preparing dough and baking with hands covered in flour.
- **🔍 Click-to-Zoom Visual Lightbox**: Inspect step photos (e.g. sloppy dough consistency) with pan, drag, and 100%–350% zoom controls.
- **📱 Offline PWA & 1-Click Install**: Installs directly to iOS Safari Home Screen and Android/Desktop Chrome with instant offline caching via Service Worker.
- **☁️ Cloud Sync & Multi-Device Sharing**: Powered by Cloud Firestore with IndexedDB multi-tab offline persistence. Recipes saved on one phone or tablet instantly appear across all family devices.
- **🔒 Family Google Authentication & Guest List**: Private heirloom vault protected by Google Sign-In with a family list kept in Firestore that only the project owner can change, in the Firebase console.
- **📝 Step Builder, Photos & Version Archiving**: Add step-by-step consistency notes, photo thumbnails, and automatic version incrementing (`v1`, `v2`, `v3`) with historical archive snapshots.
- **🤖 Two-way Family Translation via Gemini 3.8 Flash**: Bundled with verified offline translations for heirloom recipes. New and edited recipes are translated automatically between English and Polish through Firebase AI Logic (Gemini 3.8 Flash only, never a lighter model; an unusable answer is asked for once more straight away), protected by App Check. No Gemini key ships in the app.

---

## 🏗️ Architecture & Project Structure

The codebase is organized into clean, modular, testable components:

```
├── .github/
│   └── workflows/
│       └── deploy.yml              # Automated GitHub Pages CI/CD on push to main
├── public/
│   ├── assets/                     # Recipe photos & visual step guides
│   ├── apple-touch-icon.png        # iOS Home Screen icon (180x180)
│   ├── favicon.ico                 # Multi-res browser favicon (16/32/48)
│   ├── favicon.svg                 # Scalable vector logo icon
│   ├── icon-192x192.png            # Android PWA standard icon
│   ├── icon-512x512.png            # Android PWA splash & standard icon
│   ├── icon-maskable-512x512.png   # Android adaptive launcher maskable icon
│   ├── manifest.webmanifest        # Static PWA web app manifest
│   └── sw.js                       # Offline caching service worker
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   └── AuthGate.tsx        # Heirloom splash screen & Google auth gateway
│   │   ├── common/
│   │   │   ├── ThemeToggle.tsx     # Light / Dark theme switch
│   │   │   └── Toast.tsx           # Floating notification toast
│   │   ├── layout/
│   │   │   ├── Header.tsx          # App bar with settings drawer & install banner
│   │   │   └── IOSInstallModal.tsx # Step-by-step Safari install guide modal
│   │   ├── recipe-detail/
│   │   │   ├── BakingOptionsView.tsx # Dutch oven & baking method options
│   │   │   ├── ImageZoomModal.tsx    # Pan & zoom lightbox modal
│   │   │   ├── IngredientsTable.tsx  # Dynamic portion scaled ingredients
│   │   │   ├── PortionScaler.tsx     # Portion multiplier (0.5x, 1x, 2x, etc.)
│   │   │   ├── RecipeDetailView.tsx  # Master 2-column recipe display
│   │   │   └── StepsList.tsx         # Verbatim steps with notes & thumbnails
│   │   ├── recipe-form/
│   │   │   ├── AddRecipeModal.tsx    # Modal for creating and editing recipes
│   │   │   ├── ImagePickerWithPreview.tsx # Camera capture & auto-compression
│   │   │   ├── IngredientBuilder.tsx # Row-by-row ingredient editor & bulk paste
│   │   │   └── StepBuilder.tsx       # Step editor with consistency cues & photos
│   │   └── recipe-grid/
│   │       ├── FilterTabs.tsx        # Category tabs (All, Breads, Heirlooms, Recent)
│   │       ├── RecipeCard.tsx        # Recipe summary card with estimated duration
│   │       └── RecipeGridView.tsx    # Vault gallery view
│   ├── data/
│   │   └── defaultRecipe.ts        # Canonical Wanda's Cheese Bread with bilingual data
│   ├── hooks/
│   │   ├── useAuth.ts              # Firebase Google Auth & family list check
│   │   ├── useCookMode.ts          # Screen Wake Lock API controller
│   │   ├── useFontScale.ts         # Accessibility text scaling (85%–140%)
│   │   ├── useLanguage.ts          # EN / PL localization provider
│   │   ├── usePWAInstall.ts        # Chromium beforeinstallprompt & iOS detection
│   │   ├── useRecipes.ts           # Local + Cloud synchronization & versioning
│   │   └── useTheme.ts             # Light / Dark theme controller
│   ├── i18n/
│   │   └── translations.ts         # English and Polish UI text dictionaries
│   ├── services/
│   │   ├── firebase.ts             # Firebase App, Auth, & IndexedDB Firestore cache
│   │   ├── firestore.ts            # Real-time listener & cloud CRUD operations
│   │   ├── gemini.ts               # Two-way translation via Firebase AI Logic
│   │   └── storage.ts              # LocalStorage fallback & preference persistence
│   ├── test/                       # Vitest unit test suite (31 tests across 6 files)
│   │   ├── auth.test.tsx           # Family list & splash screen tests
│   │   ├── fractions.test.ts       # Fraction formatting & ingredient parsing tests
│   │   ├── gemini.test.ts          # Translation service tests
│   │   ├── recipeVersioning.test.ts # Version increments & historical archive tests
│   │   ├── setup.ts                # Test environment initialization
│   │   ├── storage.test.ts         # LocalStorage persistence & preference tests
│   │   └── timeEstimator.test.ts   # NLP recipe duration parsing tests
│   ├── types/
│   │   └── recipe.ts               # Strict TypeScript interfaces
│   ├── utils/
│   │   ├── fractions.ts            # Fractional mathematics & pluralization
│   │   └── timeEstimator.ts        # Intelligent duration analyzer
│   ├── App.tsx                     # Main view router & View Transition coordinator
│   ├── index.css                   # Tailwind CSS v4 design tokens & utilities
│   └── main.tsx                    # React 19 mount point
├── .env.example                    # Environment variables template
├── firestore.rules                 # Cloud Firestore security rules
├── firebase.json                   # Firebase deployment configuration
├── index.html                      # Semantic HTML5 shell with PWA manifest
├── package.json                    # Project metadata & scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite 6 config with base: './' for GitHub Pages
└── vitest.config.ts                # Vitest configuration with jsdom
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20 or v22+
- **npm**: v10+

### Installation & Local Development

```bash
# Clone the repository
git clone https://github.com/fatso33/famkit.git
cd famkit

# Install dependencies
npm install

# Start local development server (runs at http://localhost:3000)
npm run dev

# Run automated test suite (31 tests)
npm test

# Run TypeScript type-checker
npm run lint

# Build production bundle
npm run build
```

> [!NOTE]
> If Firebase is not configured locally, the app automatically runs in **Development Mode** with local browser storage, allowing you to develop and test offline without needing a Firebase project immediately.

---

## 🔐 Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure the following variables:

| Variable                            | Required? | Description                                                                        |
| :---------------------------------- | :-------: | :--------------------------------------------------------------------------------- |
| `VITE_FIREBASE_API_KEY`             | Optional* | Firebase project Web API Key                                                       |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Optional* | Firebase Auth Domain (e.g. `your-app.firebaseapp.com`)                             |
| `VITE_FIREBASE_PROJECT_ID`          | Optional* | Firebase Project ID                                                                |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Optional  | Firebase Storage Bucket name                                                       |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Optional  | Firebase Cloud Messaging sender ID                                                 |
| `VITE_FIREBASE_APP_ID`              | Optional* | Firebase Web Application ID                                                        |
| `VITE_RECAPTCHA_SITE_KEY`           | Optional  | reCAPTCHA Enterprise site key for Firebase App Check (protects recipe translation) |

_\*Required only if enabling multi-device cloud synchronization and Google family authentication._

---

## 🔥 Firebase & Cloud Firestore Setup

To enable multi-device sync and family authentication:

### 1. Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. In Project Settings under **Your apps**, click the Web icon (`</>`) to register a web app.
3. Copy the configuration credentials (`apiKey`, `authDomain`, `projectId`, etc.) into your `.env.local` or GitHub repository secrets.

### 2. Enable Google Authentication & Authorized Domains

1. In Firebase Console, go to **Build** → **Authentication** → **Sign-in method**.
2. Enable **Google** as a sign-in provider and click Save.
3. In Authentication → **Settings** → **Authorized domains**, ensure the following domains are added:
   - `localhost` (for local development)
   - `fatso33.github.io` (for GitHub Pages deployment)

### 3. Create Cloud Firestore Database

1. Go to **Build** → **Firestore Database** and click **Create database**.
2. Choose a region close to your family (e.g. `nam5` or `eur3`).
3. Start in **Production mode**.

### 4. Add Family Members

Who may sign in is the Firestore collection `family_members`, one document per person. The rules stop anyone changing it from the app, so it is edited only in the Firebase Console. Add everyone **before** deploying the rules below, or nobody can reach the cloud.

1. Go to **Firestore Database** → **Data** and open (or start) the `family_members` collection.
2. **Add document**, with the **Document ID** set to their Google account email in **lowercase** (e.g. `mom@gmail.com`). An ID with capitals never matches.
3. Optionally add a string field `name` (e.g. `Babcia`). Recipes they add are then credited to that name instead of their Google name. Leave it out to use the Google name.

To remove someone, delete their document. They lose access to the cloud at once; recipes already on their phone stay there.

### 5. Deploy Security Rules

[`firestore.rules`](firestore.rules) holds no emails, so deploy it as it is:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login and deploy rules
firebase login
firebase deploy --only firestore:rules
```

_(Alternatively, copy and paste the rules directly into the Firebase Console under **Firestore Database** → **Rules**. The console keeps earlier versions, so a bad deploy can be rolled back there.)_

---

## 🌐 Deploying to GitHub Pages

The repository includes an automated GitHub Actions deployment workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

### 1. Enable GitHub Pages via Actions

1. In your GitHub repository, navigate to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.

### 2. Configure Repository Secrets

To enable Cloud Sync and recipe translation on GitHub Pages, navigate to **Settings** → **Secrets and variables** → **Actions** and add:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_RECAPTCHA_SITE_KEY`: reCAPTCHA Enterprise site key (see below)

### 3. Enable Recipe Translation (Firebase AI Logic + App Check)

Translation calls Gemini through Firebase AI Logic, which holds the Gemini key on Google's side, so no Gemini key is ever in the public bundle. It runs on the free Spark plan.

- **Firebase console → AI Logic**: get started with the **Gemini Developer API**.
- **reCAPTCHA Enterprise** ([Google Cloud console → Security → reCAPTCHA](https://console.cloud.google.com/security/recaptcha), same project as Firebase): create a **Website** key for `fatso33.github.io` and `localhost`, with **Use checkbox challenge** off. Free up to 10,000 checks a month; no billing account needed.
- **Firebase console → App Check**: register the web app with the **reCAPTCHA Enterprise** provider (paste the site key), then **enforce** App Check for AI Logic.
- Add the site key as the `VITE_RECAPTCHA_SITE_KEY` repository secret.

Every push to `main` will automatically run type checks, execute the 31-test suite, build the production bundle, and deploy to GitHub Pages!

---

## 🧪 Testing

The test suite runs with [Vitest](https://vitest.dev/) and `@testing-library/react`:

```bash
# Run all tests once
npm test

# Run tests in interactive watch mode
npm run test:watch
```

**Coverage highlights:**

- **Fraction & Unit Mathematics**: Verifies diagonal fractions (`1 ½`, `¾`), unit pluralization (`szklanki` vs `szklanek`), and bracketed culinary note extraction.
- **NLP Time Estimator**: Tests natural language duration extraction (`"bake for 25-30 mins"`, `"rest overnight"`).
- **Authentication & Allowlist**: Tests case-insensitive email matching and unauthorized access gates.
- **Recipe Versioning**: Tests version increments and historical snapshot archiving.
- **Recipe Translation**: Tests language detection, stale-translation fingerprinting, edits in either language, offline retries, and validation of the untrusted model response.
