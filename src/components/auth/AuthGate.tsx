import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { ThemeToggle } from '../common/ThemeToggle';
import { LogOut, ShieldAlert } from 'lucide-react';

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
  const [forcePreviewSplash, setForcePreviewSplash] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('preview') === 'splash';
  });

  // 1. Loading Screen (Warm Heirloom Style)
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none transition-colors duration-200"
        style={{
          backgroundColor: theme === 'dark' ? 'var(--bg-main)' : '#FAF5ED',
          color: 'var(--text-primary)',
        }}
      >
        <div className="w-24 h-24 flex items-center justify-center mb-4 animate-pulse">
          <img
            src={theme === 'dark' ? './pot-illustration-transparent.png' : './pot-illustration.png'}
            alt="Family Kitchen"
            className="w-full h-full object-contain"
          />
        </div>
        <h2
          className="text-2xl font-bold tracking-tight mb-1"
          style={{
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {language === 'pl' ? 'Rodzinna Kuchnia' : 'Family Kitchen'}
        </h2>
        <p
          className="text-base italic tracking-wide"
          style={{
            color: theme === 'dark' ? 'var(--accent)' : '#AF552D',
            fontFamily: 'var(--font-serif)',
          }}
        >
          {language === 'pl' ? 'Otwieranie skarbca...' : 'Opening recipe vault...'}
        </p>
      </div>
    );
  }

  // 2. Local Development Fallback (If Firebase env variables are not yet configured)
  if (!isConfigured && !forcePreviewSplash) {
    return (
      <>
        <div
          className="px-4 py-2 text-xs text-center border-b font-medium flex items-center justify-center gap-3"
          style={{
            backgroundColor: 'var(--accent-gold-subtle)',
            color: 'var(--accent-gold)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span>⚠️ <strong>Development Mode:</strong> Firebase is not configured. Running with local browser storage.</span>
          <button
            onClick={() => setForcePreviewSplash(true)}
            className="underline font-bold hover:opacity-80 cursor-pointer ml-1"
          >
            Preview Splash Screen
          </button>
        </div>
        {children}
      </>
    );
  }

  // 3. Unauthenticated State (Splash Screen matching attached image)
  if (!user) {
    return (
      <div
        className="min-h-screen flex flex-col justify-between items-center transition-colors duration-250 select-none relative overflow-x-hidden"
        style={{
          backgroundColor: theme === 'dark' ? 'var(--bg-main)' : '#FAF5ED',
          color: 'var(--text-primary)',
        }}
      >
        {/* Top Controls Bar: Language and Theme Toggles */}
        <header className="w-full max-w-4xl mx-auto flex items-center justify-end gap-2.5 p-4 sm:p-6 z-10">
          <button
            onClick={toggleLanguage}
            className="px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-150 cursor-pointer shadow-sm hover:shadow active:scale-95 flex items-center justify-center min-w-[42px] min-h-[36px]"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-primary)',
            }}
            title={language === 'pl' ? 'Switch to English' : 'Przełącz na język polski'}
            aria-label="Toggle language: English / Polish"
          >
            <span>{language === 'pl' ? 'PL' : 'EN'}</span>
          </button>

          <ThemeToggle
            theme={theme}
            onToggle={toggleTheme}
            className="!rounded-full shadow-sm hover:shadow !w-9 !h-9 !min-h-[36px]"
            title={language === 'pl' ? 'Przełącz motyw' : 'Toggle theme'}
          />
        </header>

        {/* Main Center Content: Identical to the attached image */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 w-full max-w-md -mt-8 sm:-mt-12 animate-[fadeIn_0.25s_ease-out]">
          {/* Pot Illustration */}
          <div className="flex items-center justify-center">
            <img
              src={theme === 'dark' ? './pot-illustration-transparent.png' : './pot-illustration.png'}
              alt="Family Kitchen"
              className="w-[188px] sm:w-[216px] h-auto object-contain select-none pointer-events-none drop-shadow-sm transition-transform duration-300 hover:scale-[1.02]"
            />
          </div>

          {/* Title: Family Kitchen */}
          <h1
            className="mt-3 sm:mt-4 text-[1.85rem] sm:text-[2.2rem] font-bold tracking-tight text-center leading-none"
            style={{
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {language === 'pl' ? 'Rodzinna Kuchnia' : 'Family Kitchen'}
          </h1>

          {/* Subtitle: Recipe Vault */}
          <p
            className="mt-1 text-[1.15rem] sm:text-[1.3rem] italic text-center font-normal"
            style={{
              color: theme === 'dark' ? 'var(--accent)' : '#AF552D',
              fontFamily: 'var(--font-serif)',
            }}
          >
            {language === 'pl' ? 'Skarbiec Przepisów' : 'Recipe Vault'}
          </p>

          {/* Action Button: Connect with Google */}
          <div className="w-full flex flex-col items-center mt-12 sm:mt-16">
            <button
              onClick={() => void signInWithGoogle()}
              className="w-full max-w-[340px] sm:max-w-[380px] h-[58px] sm:h-[62px] rounded-full border flex items-center justify-center gap-3.5 px-6 font-semibold text-base transition-all duration-200 cursor-pointer shadow-[0_4px_20px_-2px_rgba(35,25,15,0.06),0_2px_6px_-1px_rgba(35,25,15,0.04)] hover:shadow-[0_8px_25px_-2px_rgba(35,25,15,0.12),0_4px_10px_-1px_rgba(35,25,15,0.06)] active:scale-[0.98] group"
              style={{
                backgroundColor: '#ffffff',
                borderColor: 'rgba(0, 0, 0, 0.08)',
                color: '#1e1b19',
              }}
            >
              {/* Official Google 4-Color G Icon */}
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
              <span className="text-[0.98rem] sm:text-[1.05rem] font-semibold text-[#1e1b19] tracking-tight">
                {language === 'pl' ? 'Połącz przez Google' : 'Connect with Google'}
              </span>
            </button>

            {/* Error Alert if sign-in fails */}
            {error && (
              <div
                className="mt-4 px-4 py-2 rounded-full border text-xs flex items-center justify-center gap-2 max-w-sm text-center animate-[fadeIn_0.2s_ease-out]"
                style={{
                  backgroundColor: 'rgba(200, 90, 50, 0.1)',
                  borderColor: 'var(--accent)',
                  color: 'var(--text-primary)',
                }}
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </main>

        {/* Bottom Spacer / Dev Mode Exit Preview */}
        <footer className="w-full p-4 sm:p-6 flex items-center justify-center">
          {!isConfigured ? (
            <button
              onClick={() => setForcePreviewSplash(false)}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold border shadow-sm transition-all duration-150 cursor-pointer hover:shadow active:scale-95"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              ✕ Exit Preview (Return to App)
            </button>
          ) : (
            <span className="text-xs opacity-0 pointer-events-none select-none">&nbsp;</span>
          )}
        </footer>
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
                <img src="./apple-touch-icon.png" alt="Family Kitchen logo" className="brand-icon-img" />
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
