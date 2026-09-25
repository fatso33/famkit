import React from 'react';
import { useAuth } from '../../hooks/useAuth';
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

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-6 text-stone-800 dark:text-stone-100">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-full border-4 border-amber-200 dark:border-amber-900 border-t-amber-600 dark:border-t-amber-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-amber-600 dark:text-amber-500 animate-pulse" />
          </div>
        </div>
        <h2 className="text-xl font-serif font-bold text-stone-800 dark:text-stone-200">
          Family Kitchen Vault
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Checking family credentials...
        </p>
      </div>
    );
  }

  // 2. Unconfigured Dev State (Gracefully permit local development if no Firebase keys yet)
  if (!isConfigured) {
    return (
      <>
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 text-center flex items-center justify-center gap-2">
          <span>⚠️ <strong>Development Mode:</strong> Firebase is not configured. Running with local browser storage.</span>
        </div>
        {children}
      </>
    );
  }

  // 3. Unauthenticated State (Full Gate Welcome)
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/60 via-stone-50 to-stone-100 dark:from-stone-950 dark:via-stone-900 dark:to-stone-950 flex flex-col items-center justify-center p-4 sm:p-6 text-stone-800 dark:text-stone-100">
        <div className="max-w-md w-full bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-stone-200/80 dark:border-stone-800 p-8 sm:p-10 text-center relative overflow-hidden">
          {/* Subtle warm decorative glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-600/10 dark:bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />

          {/* Logo / Badge */}
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-amber-500/20">
            <span className="text-3xl" role="img" aria-label="Bread icon">🍞</span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100/80 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Private Family Vault
          </span>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-50 tracking-tight mb-2">
            Family Kitchen
          </h1>
          <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed mb-8">
            Heirloom recipes, baking guides, and culinary secrets preserved for our family. Please sign in to enter.
          </p>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs text-left flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={() => void signInWithGoogle()}
            className="w-full py-3.5 px-5 rounded-2xl bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-700/80 text-stone-700 dark:text-stone-100 font-medium text-sm border border-stone-300 dark:border-stone-700 shadow-sm hover:shadow transition-all duration-200 flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer group"
          >
            {/* Official Google 'G' icon */}
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
            <span className="group-hover:text-stone-900 dark:group-hover:text-white transition-colors">
              Sign in with Google
            </span>
          </button>

          {/* Security Notice */}
          <div className="mt-8 pt-6 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
            <span>Encrypted cloud storage with family access control</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Authenticated but Not Authorized (Stranger Google Account)
  if (!isFamilyMember) {
    return (
      <div className="min-h-screen bg-stone-50 dark:bg-stone-950 flex flex-col items-center justify-center p-4 sm:p-6 text-stone-800 dark:text-stone-100">
        <div className="max-w-md w-full bg-white dark:bg-stone-900 rounded-3xl shadow-xl border border-red-200 dark:border-red-900/40 p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-5">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-serif font-bold text-stone-900 dark:text-stone-50 mb-2">
            Access Restricted
          </h2>
          <p className="text-sm text-stone-600 dark:text-stone-400 mb-4">
            You are signed in as <strong className="text-stone-800 dark:text-stone-200">{user.email}</strong>.
          </p>
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-900 dark:text-amber-200 text-left mb-6 leading-relaxed">
            This account is not yet on the family guest list. If you are a family member, ask the vault owner to add your email address to the allowed list.
          </div>

          <button
            onClick={() => void signOut()}
            className="w-full py-3 px-4 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out or Switch Account</span>
          </button>
        </div>
      </div>
    );
  }

  // 5. Authorized Family Member -> Render Full App!
  return <>{children}</>;
};
