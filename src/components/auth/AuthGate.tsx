import React, { useMemo } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { CurrentUser, CurrentUserContext } from '../../hooks/useCurrentUser';
import { useTheme } from '../../hooks/useTheme';
import { useLanguage } from '../../hooks/useLanguage';
import { ThemeToggle } from '../common/ThemeToggle';
import { SplashScreen } from './SplashScreen';
import { LogOut, ShieldAlert } from 'lucide-react';

interface AuthGateProps {
  children: React.ReactNode;
}

export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const { user, isFamilyMember, isLoading, isConfigured, error, signInWithGoogle, signOut } =
    useAuth();

  const { theme, toggleTheme } = useTheme();
  const { language, toggleLanguage, t } = useLanguage();

  const email = user?.email ?? '';
  const displayName = user?.displayName;
  const currentUser = useMemo<CurrentUser | null>(
    () => (email ? { email, name: displayName || email } : null),
    [email, displayName],
  );

  // 1. Loading Screen (Warm Heirloom Style)
  if (isLoading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center select-none transition-colors duration-200"
        style={{
          backgroundColor: 'var(--bg-main)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="w-24 h-24 flex items-center justify-center mb-4 animate-pulse">
          <img src="./Emblem.png" alt="Family Kitchen" className="w-full h-full object-contain" />
        </div>
      </div>
    );
  }

  // 2. Signed out: the animated splash with sign-in
  if (!user) {
    return <SplashScreen error={error} onSignIn={() => void signInWithGoogle()} />;
  }

  // 3. Authenticated but Unauthorized (Stranger / Non-Family Google Account)
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
                <img src="./apple-touch-icon.png" alt={t.logoAlt} className="brand-icon-img" />
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
                backgroundColor: 'var(--accent-subtle)',
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

            <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
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

  // 4. Authorized Family Member -> Render Full App!
  return (
    <>
      {!isConfigured && (
        <div
          className="px-4 py-2 text-xs text-center border-b font-medium flex items-center justify-center gap-2"
          style={{
            backgroundColor: 'var(--accent-gold-subtle)',
            color: 'var(--accent-gold)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <span>
            ⚠️ <strong>Development Mode:</strong> Firebase is not configured. Running with local
            browser storage.
          </span>
        </div>
      )}
      <CurrentUserContext value={currentUser}>{children}</CurrentUserContext>
    </>
  );
};
