import { describe, it, expect } from 'vitest';
import React, { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import { useInertBehind } from '../hooks/useInertBehind';

const Layer: React.FC<{ name: string }> = ({ name }) => {
  const ref = useRef<HTMLDivElement>(null);
  useInertBehind(ref);
  return (
    <div ref={ref}>
      <button type="button">{name}</button>
    </div>
  );
};

const page = () => screen.getByRole('button', { name: 'Page', hidden: true }).parentElement!;

describe('useInertBehind', () => {
  it('keeps the page out of reach while a later layer is open, when the first one goes', () => {
    // The start sheet hands on to the editor: the editor opens over it, then the sheet goes.
    const { rerender } = render(
      <div>
        <main>
          <button type="button">Page</button>
        </main>
        <Layer name="Sheet" />
      </div>,
    );
    expect(page()).toHaveAttribute('inert');

    rerender(
      <div>
        <main>
          <button type="button">Page</button>
        </main>
        <Layer name="Sheet" key="sheet" />
        <Layer name="Editor" key="editor" />
      </div>,
    );
    rerender(
      <div>
        <main>
          <button type="button">Page</button>
        </main>
        <Layer name="Editor" key="editor" />
      </div>,
    );
    expect(page()).toHaveAttribute('inert');
  });

  it('lets go only of what it made inert', () => {
    const { rerender } = render(
      <div>
        <main inert>
          <button type="button">Page</button>
        </main>
        <Layer name="Sheet" />
      </div>,
    );
    rerender(
      <div>
        <main inert>
          <button type="button">Page</button>
        </main>
      </div>,
    );
    expect(page()).toHaveAttribute('inert');
  });
});
