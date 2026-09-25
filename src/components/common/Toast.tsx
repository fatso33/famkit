import React from 'react';

interface ToastProps {
  message: string | null;
  icon?: string;
}

export const Toast: React.FC<ToastProps> = ({ message, icon = '✓' }) => {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm shadow-xl transition-all pointer-events-none animate-[slideDownRow_0.2s_ease-out]"
      style={{
        backgroundColor: 'var(--text-primary)',
        color: 'var(--bg-surface)',
      }}
    >
      <span>{icon}</span>
      <span>{message}</span>
    </div>
  );
};
