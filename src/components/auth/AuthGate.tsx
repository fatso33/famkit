import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { ThemeToggle } from '../common/ThemeToggle';
import { Lock, LogOut, ShieldAlert, Sparkles, ChefHat } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const {
    user,
    isFamilyMember,
    isLoading,
    isConfigured,
    error,
    signInWithGoogle,
    signOut,
  } = useAuth();

  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const [imageError, setImageError] = useState(false);

  const heroImageSrc = imageError
    ? 'https://images.unsplash.com/photo-1589367920969-ab8e050bbb04?auto=format&fit=crop&w=1200&q=80'
    : './assets/wandas-cheese-bread.jpg';

  // 1. Loading Screen (Styled with App Design Tokens)
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none"
        style={{
          backgroundColor: 'var(--bg-main)',
          color: 'var(--text-primary)',
        }}
      >
        <div
          className="w-16 h-16 rounded-[var(--radius-md)] flex items-center justify-center mb-5 shadow-sm border animate-pulse"
          style={{
            backgroundColor: 'var(--accent-subtle)',
            color: 'var(--accent)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <ChefHat className="w-8 h-8" />
        </div>
        <h2
          className="font-serif text-2xl font-bold tracking-tight mb-2"
          style={{ color: 'var(--text-primary)' }}
        >
          {language === 'pl' ? 'Rodzinna Kuchnia' : 'Family Kitchen'}
        </h2>
        <p
          className="text-sm tracking-wide"
          style={{ color: 'var(--text-muted)' }}
        >
          {language === 'pl' ? 'Otwieranie skarbca...' : 'Opening recipe vault...'}
        </p>
      </div>
    );
  }

  // 2. Local Development Fallback (If Firebase env variables are not yet configured)
  if (!isConfigured) {
    return (
      <>
        <div
          className="px-4 py-2 text-xs text-center border-b font-medium flex items-center justify-center gap-2"
          style={{
            backgroundColor: 'var(--accent-gold-subtle)',
            color: 'var(--accent-gold)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span>⚠️ <strong>Development Mode:</strong> Firebase is not configured. Running with local browser storage.</span>
        </div>
        {children}
      </>
    );
  }

  // 3. Unauthenticated State (Full Gate Welcome Screen)
  if (!user) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{
          backgroundColor: 'var(--bg-main)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Harmonious App Header Bar */}
        <header className="app-header">
          <div className="header-main-row">
            <div className="brand-group">
              <div className="brand-icon">
                <span>🍞</span>
              </div>
              <div>
                <span className="brand-title">
                  {language === 'pl' ? 'Rodzinna Kuchnia' : 'Family Kitchen'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className="btn px-2.5 py-1 text-xs font-bold cursor-pointer min-w-[44px]"
                title="Switch language (EN / PL)"
                aria-label="Toggle language: English / Polish"
              >
                <span>{language === 'pl' ? 'PL' : 'EN'}</span>
              </button>

              <ThemeToggle
                theme={theme}
                onToggle={toggleTheme}
                title={language === 'pl' ? 'Przełącz motyw' : 'Toggle theme'}
              />
            </div>
          </div>
        </header>

        {/* Central Recipe Vault Presentation Card */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div
            className="w-full max-w-[480px] rounded-[var(--radius-lg)] border overflow-hidden shadow-lg transition-all animate-[fadeIn_0.2s_ease-out]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {/* Heirloom Media Header */}
            <div className="card-media relative" style={{ aspectRatio: '16/10' }}>
              <img
                src={heroImageSrc}
                alt="Wanda's Cheese Bread"
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/30" />
              
              <div
                className="card-badge flex items-center gap-1.5"
                style={{
                  backgroundColor: 'rgba(27, 25, 23, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'var(--accent-gold-subtle)',
                }}
              >
                <Lock className="w-3 h-3 text-amber-400" />
                <span>
                  {language === 'pl' ? 'Prywatny Skarbiec Rodzinny' : 'Private Family Vault'}
                </span>
              </div>

              <div className="absolute bottom-3 left-4 right-4 text-white">
                <span className="text-[0.72rem] uppercase tracking-wider font-semibold opacity-90 text-amber-200">
                  {language === 'pl' ? 'Dziedzictwo Kulinarne' : 'Culinary Heirloom Archive'}
                </span>
                <h1 className="font-serif text-xl sm:text-2xl font-bold leading-tight drop-shadow-sm">
                  {language === 'pl' ? 'Skarbiec Przepisów Wandy' : "Wanda's Recipe Vault"}
                </h1>
              </div>
            </div>

            {/* Card Content & Action */}
            <div className="p-6 sm:p-7 flex flex-col gap-5">
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {language === 'pl'
                  ? 'Autentyczne przepisy rodzinne, instrukcje pieczenia ciasta w garnku żeliwnym, dynamiczne skalowanie porcji oraz automatyczna synchronizacja między urządzeniami naszej rodziny.'
                  : 'Preserved heirloom instructions, Dutch-oven baking directives, dynamic portion scaling, and real-time synchronization across our family devices.'}
              </p>

              {/* Error Notice if any */}
              {error && (
                <div
                  className="p-3 rounded-[var(--radius-sm)] border text-xs flex items-start gap-2"
                  style={{
                    backgroundColor: 'rgba(200, 90, 50, 0.1)',
                    borderColor: 'var(--accent)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <span>{error}</span>
                </div>
              )}

              {/* Artisan Google Sign-In Button */}
              <button
                onClick={() => void signInWithGoogle()}
                className="w-full flex items-center justify-center gap-3.5 py-3.5 px-5 rounded-[var(--radius-md)] border font-semibold text-sm transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md active:scale-[0.99] group"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-strong)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-card)';
                }}
              >
                {/* Official Google Vector Icon */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span className="group-hover:text-[var(--accent)] transition-colors">
                  {language === 'pl' ? 'Zaloguj się przez Google' : 'Sign in with Google'}
                </span>
              </button>

              {/* Vault Feature Highlights */}
              <div
                className="grid grid-cols-2 gap-2 pt-2 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div
                  className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>🍞</span>
                  <span>{language === 'pl' ? 'Sprawdzone receptury' : 'Heirloom formulas'}</span>
                </div>
                <div
                  className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>⚖️</span>
                  <span>{language === 'pl' ? 'Skalowanie porcji' : 'Portion scaling'}</span>
                </div>
                <div
                  className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>☀️</span>
                  <span>{language === 'pl' ? 'Tryb gotowania' : 'Cook wake lock'}</span>
                </div>
                <div
                  className="flex items-center gap-1.5 p-2 rounded-[var(--radius-sm)] text-xs font-medium"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span>🔄</span>
                  <span>{language === 'pl' ? 'Synchronizacja chmury' : 'Real-time sync'}</span>
                </div>
              </div>

              {/* Privacy Footer */}
              <div
                className="pt-2 text-center text-xs flex items-center justify-center gap-1.5"
                style={{ color: 'var(--text-muted)' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  {language === 'pl'
                    ? 'Dostęp wyłącznie dla zatwierdzonych członków rodziny'
                    : 'Exclusive access for approved family accounts'}
                </span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 4. Authenticated but Unauthorized (Stranger / Non-Family Google Account)
  if (!isFamilyMember) {
    return (
      <div
        className="min-h-screen flex flex-col"
        style={{
          backgroundColor: 'var(--bg-main)',
          color: 'var(--text-primary)',
        }}
      >
        <header className="app-header">
          <div className="header-main-row">
            <div className="brand-group">
              <div className="brand-icon">
                <span>🍞</span>
              </div>
              <span className="brand-title">
                {language === 'pl' ? 'Rodzinna Kuchnia' : 'Family Kitchen'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleLanguage}
                className="btn px-2.5 py-1 text-xs font-bold cursor-pointer min-w-[44px]"
              >
                <span>{language === 'pl' ? 'PL' : 'EN'}</span>
              </button>
              <ThemeToggle theme={theme} onToggle={toggleTheme} />
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
          <div
            className="w-full max-w-[460px] rounded-[var(--radius-lg)] border p-7 text-center shadow-lg animate-[fadeIn_0.2s_ease-out]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div
              className="w-14 h-14 rounded-[var(--radius-md)] flex items-center justify-center mx-auto mb-4 border"
              style={{
                backgroundColor: 'rgba(200, 90, 50, 0.1)',
                borderColor: 'var(--accent)',
                color: 'var(--accent)',
              }}
            >
              <ShieldAlert className="w-7 h-7" />
            </div>

            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase mb-3"
              style={{
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent)',
              }}
            >
              {language === 'pl' ? 'Dostęp Ograniczony' : 'Access Restricted'}
            </span>

            <h2
              className="font-serif text-2xl font-bold mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {language === 'pl' ? 'Dostęp Tylko dla Rodziny' : 'Family Access Only'}
            </h2>

            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: 'var(--text-secondary)' }}
            >
              {language === 'pl' ? 'Zalogowano jako' : 'You are signed in as'}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{user.email}</strong>.
            </p>

            <div
              className="p-4 rounded-[var(--radius-md)] border text-xs text-left mb-6 leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              {language === 'pl'
                ? 'Ten adres e-mail nie znajduje się na liście gości naszego rodzinnego skarbca. Jeśli jesteś członkiem rodziny, poproś administratora o dodanie Twojego adresu Gmail.'
                : 'This email account is not on our family guest list. If you are a family member, please ask the vault administrator to add your Gmail address.'}
            </div>

            <button
              onClick={() => void signOut()}
              className="btn btn-primary w-full py-3 text-sm font-semibold cursor-pointer flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>
                {language === 'pl' ? 'Wyloguj się / Zmień konto' : 'Sign Out or Switch Account'}
              </span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  // 5. Authorized Family Member -> Render Full App!
  return <>{children}</>;
};
