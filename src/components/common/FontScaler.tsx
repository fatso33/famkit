import React from 'react';

interface FontScalerProps {
  percent: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export const FontScaler: React.FC<FontScalerProps> = ({
  percent,
  onIncrease,
  onDecrease,
}) => {
  return (
    <div
      className="inline-flex items-center border rounded overflow-hidden"
      style={{
        borderColor: 'var(--border-subtle)',
        backgroundColor: 'var(--bg-surface)',
      }}
      title="Adjust text scaling"
    >
      <button
        onClick={onDecrease}
        className="px-2.5 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        style={{ color: 'var(--text-primary)' }}
        aria-label="Decrease text size"
      >
        A−
      </button>
      <span
        className="text-xs px-1.5 border-x font-semibold min-w-[44px] text-center"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-muted)',
        }}
      >
        {percent}%
      </span>
      <button
        onClick={onIncrease}
        className="px-2.5 py-1 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
        style={{ color: 'var(--text-primary)' }}
        aria-label="Increase text size"
      >
        A+
      </button>
    </div>
  );
};
