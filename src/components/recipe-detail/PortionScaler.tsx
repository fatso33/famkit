import React from 'react';

interface PortionScalerProps {
  scale: number;
  onIncrease: () => void;
  onDecrease: () => void;
}

export const PortionScaler: React.FC<PortionScalerProps> = ({
  scale,
  onIncrease,
  onDecrease,
}) => {
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded border"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
      }}
      title="Scale ingredient quantities"
    >
      <button
        onClick={onDecrease}
        className="w-7 h-7 rounded border-none font-bold text-sm grid place-items-center cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }}
        aria-label="Decrease portion"
      >
        −
      </button>

      <span
        className="text-xs font-bold px-2 min-w-[34px] text-center"
        style={{ color: 'var(--text-primary)' }}
      >
        {scale}x
      </span>

      <button
        onClick={onIncrease}
        className="w-7 h-7 rounded border-none font-bold text-sm grid place-items-center cursor-pointer transition-colors hover:bg-black/10 dark:hover:bg-white/10"
        style={{
          backgroundColor: 'var(--bg-surface)',
          color: 'var(--text-primary)',
        }}
        aria-label="Increase portion"
      >
        +
      </button>
    </div>
  );
};
