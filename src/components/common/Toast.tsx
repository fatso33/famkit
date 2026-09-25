import React from 'react';

interface ToastProps {
  message: string | null;
  icon?: string;
}

export const Toast: React.FC<ToastProps> = ({ message, icon = '✓' }) => {
  if (!message) return null;

  return (
    <div
      className="app-toast show"
      id="appToast"
      role="status"
      aria-live="polite"
    >
      <span>{icon}</span>
      <span>{message}</span>
    </div>
  );
};
