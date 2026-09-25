# 🌾 Family Kitchen — Heirloom Family Recipe Vault

A professional, modern, offline-first Progressive Web App (PWA) built with **React 19**, **TypeScript**, **Tailwind CSS v4**, and **Vite 6**. Designed to preserve heirloom family recipes with verbatim culinary directives, dynamic portion scaling, screen wake lock for cooking, and authentic bilingual Polish/English support.

Deployable directly as a zero-server static Single Page Application (SPA) to **GitHub Pages**.

---

## ✨ Features

- **🍞 Wanda's Cheese Bread**: Verbatim heirloom instructions, authentic temperatures, ingredient weights, and folding steps preserved with precision.
- **🇵🇱 Bilingual Polish/English Localization**: Full culinary translation with natural terminology (e.g. *garnek żeliwny*, *luźne / rzadkie, klejące ciasto*, *instrukcja składania ciasta*) and grammatical unit pluralization (`łyżeczki` vs `łyżeczek`, `szklanki` vs `szklanek`).
- **⚖️ Dynamic Portion Scaling**: Intelligently scales ingredient amounts (0.5x, 1x, 2x, 4x, etc.) with culinary diagonal fraction formatting (½, ¼, 1 ½) and dual-unit conversions (cups / ml).
- **☀️ Cook Mode (Screen Wake Lock API)**: Keeps your phone or tablet screen awake while preparing dough and baking with hands covered in flour.
- **🔍 Click-to-Zoom Visual Lightbox**: Inspect step photos (e.g. sloppy dough consistency) with pan, drag, and 100%–350% zoom controls.
- **📱 Offline PWA & 1-Click Install**: Installs directly to iOS Safari Home Screen and Android/Desktop Chrome with instant offline caching.
- **🔒 Private Family Translation (Approach 2)**: Bundled with verified offline translations for heirloom recipes. Optional client-side Gemini 2.5 Flash translation for custom recipes via build-time secret or in-app Settings key.

---

## 🏗️ Architecture & Project Structure

The project has been refactored away from monolithic godfiles into clean, modular, testable components:

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
│   │   ├── common/                 # Toast, FontScaler, ThemeToggle
│   │   ├── layout/                 # Header, SettingsBar, PwaInstallBanner, IOSInstallModal
│   │   ├── recipe-detail/          # RecipeDetailView, IngredientsTable, StepsList,
│   │   │                           # PortionScaler, BakingOptionsView, ImageZoomModal
│   │   ├── recipe-grid/            # RecipeGridView, RecipeCard, FilterTabs
│   │   └── recipe-form/            # AddRecipeModal
│   ├── data/
│   │   └── defaultRecipe.ts        # Canonical Wanda's Cheese Bread with bilingual schemas
│   ├── hooks/
│   │   ├── useCookMode.ts          # Screen Wake Lock API controller
│   │   ├── useFontScale.ts         # Accessibility text scaling (85%–140%)
│   │   ├── useLanguage.ts          # EN / PL localization provider
│   │   ├── usePWAInstall.ts        # Chromium beforeinstallprompt & iOS detection
│   │   ├── useRecipes.ts           # LocalStorage catalog management & CRUD
│   │   └── useTheme.ts             # Light / Dark theme controller
│   ├── i18n/
│   │   └── translations.ts         # English and Polish UI text dictionaries
│   ├── services/
│   │   ├── gemini.ts               # Client-side translation via lazy-loaded @google/genai
│   │   └── storage.ts              # LocalStorage persistence & schema migration
│   ├── test/                       # Vitest unit test suite (21 tests)
│   │   ├── fractions.test.ts       # Fraction formatting & ingredient parsing tests
│   │   ├── timeEstimator.test.ts   # NLP recipe duration parsing tests
│   │   └── storage.test.ts         # LocalStorage persistence & preference tests
│   ├── types/
│   │   └── recipe.ts               # Strict TypeScript interfaces
│   ├── utils/
│   │   ├── fractions.ts            # Fractional mathematics & pluralization
│   │   └── timeEstimator.ts        # Intelligent duration analyzer
│   ├── App.tsx                     # Main view router & View Transition coordinator
│   ├── index.css                   # Tailwind CSS v4 design tokens & utilities
│   └── main.tsx                    # React 19 mount point
├── index.html                      # Semantic 40-line HTML5 shell
├── vite.config.ts                  # Vite 6 config with base: './' for GitHub Pages
└── vitest.config.ts                # Vitest configuration with jsdom
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20 or v22+
- **npm**: v10+

### Installation & Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run automated tests
npm test

# Run TypeScript type-checker
npm run lint

# Build production bundle
npm run build
```

---

## 🌐 Deploying to GitHub Pages

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: refactor into static React 19 SPA for GitHub Pages"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. **Enable GitHub Pages via Actions**:
   - In your GitHub repository, navigate to **Settings** → **Pages**.
   - Under **Build and deployment** → **Source**, select **GitHub Actions**.

3. **(Optional) Configure Gemini API Key for Custom Recipes**:
   - Go to [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
   - Create an API Key and set:
     - **Application restrictions**: `HTTP referrers` → `https://<your-username>.github.io/*` (and `http://localhost:*` for local testing).
     - **API restrictions**: Select **Generative Language API** only.
   - In your GitHub repository, navigate to **Settings** → **Secrets and variables** → **Actions**.
   - Click **New repository secret** and add:
     - Name: `VITE_GEMINI_API_KEY`
     - Value: `AIzaSy...` (your restricted key).

Every push to `main` will automatically test, build, and deploy your family recipe vault!
