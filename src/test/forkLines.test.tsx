import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ForkSwitch } from '../components/common/ForkSwitch';
import { StepsList } from '../components/recipe-detail/StepsList';
import { UI_TEXT } from '../i18n/translations';
import { Step } from '../types/recipe';
import {
  LABEL_FIT_FLOOR,
  joinPath,
  labelFit,
  labelFloor,
  labelsOverflow,
  splitPath,
} from '../utils/forkLines';
import { PathChoices } from '../utils/recipeMethod';

const t = UI_TEXT.en;

describe('fork line geometry', () => {
  it('runs straight down from the middle, then curves onto the button', () => {
    expect(splitPath(100, 50, 52)).toBe('M100 0V12C100 32 50 32 50 52');
    expect(splitPath(100, 150, 52)).toBe('M100 0V12C100 32 150 32 150 52');
  });

  it('drops straight onto a button under the middle', () => {
    expect(splitPath(100, 100.4, 52)).toBe('M100 0V52');
  });

  it('joins from under a path back to the middle', () => {
    expect(joinPath(100, 50, 46)).toBe('M50 0C50 17 100 17 100 34V46');
    expect(joinPath(100, 100, 46)).toBe('M100 0V46');
  });
});

describe('fitting the switch names', () => {
  it('leaves names whose words fit alone', () => {
    expect(labelFit([150, 150], [95, 120])).toBe(1);
  });

  it('shrinks every name together so the widest word fits whole', () => {
    // "Refrigerator" is 95px; its button has 88px.
    expect(labelFit([88, 88], [95, 60])).toBeCloseTo(88 / 95, 3);
  });

  it('never shrinks past the floor', () => {
    expect(labelFit([40], [95])).toBe(LABEL_FIT_FLOOR);
  });

  it('lets large text shrink further, but not below 14px', () => {
    expect(labelFloor(16)).toBe(LABEL_FIT_FLOOR);
    expect(labelFloor(21)).toBeCloseTo(14 / 21, 5);
  });

  it('knows when words cannot sit whole even in uneven columns', () => {
    // Three buttons in 328px with 12px gaps and 18px of padding each.
    expect(labelsOverflow([118, 60, 56], 0.67, 18, 12, 328)).toBe(false);
    expect(labelsOverflow([200, 160, 150], 0.67, 18, 12, 328)).toBe(true);
  });

  it('ignores names not measured yet', () => {
    expect(labelFit([0, 120], [95, 80])).toBe(1);
  });
});

const fork: Step = {
  num: 9,
  text: 'Cover the bowl.',
  fork: {
    paths: [
      { label: 'Refrigerator Rest', text: 'Cover the bowl.' },
      {
        label: 'Dutch Oven Bake',
        text: 'Preheat the Dutch oven.',
        steps: ['Put the dough in.', 'Bake.'],
      },
    ],
  },
};

const renderSteps = (steps: Step[]) =>
  render(
    <StepsList
      steps={steps}
      choices={{}}
      onChoosePath={() => undefined}
      onZoomImage={() => undefined}
      t={t}
    />,
  );

describe('a fork on the recipe page', () => {
  it('names each path on the switch, with no icon, and keeps words whole', () => {
    renderSteps([{ num: 8, text: 'Cover.' }, fork]);
    const rest = screen.getByRole('radio', { name: 'Refrigerator Rest' });
    expect(rest).toBeChecked();
    expect(rest.querySelector('svg')).toBeNull();
    expect(Array.from(rest.querySelectorAll('.fork-word'), (w) => w.textContent)).toEqual([
      'Refrigerator',
      'Rest',
    ]);
  });

  it('joins back only when a step follows the fork', () => {
    const { container, unmount } = renderSteps([{ num: 8, text: 'Cover.' }, fork]);
    expect(container.querySelector('.fork-lines.is-split')).not.toBeNull();
    expect(container.querySelector('.fork-lines.is-join')).toBeNull();
    unmount();

    const after = renderSteps([fork, { num: 10, text: 'Cool it.' }]);
    expect(after.container.querySelector('.fork-lines.is-join')).not.toBeNull();
  });

  it('lights the chosen branch and numbers its steps on from the fork', () => {
    const Page = () => {
      const [choices, setChoices] = useState<PathChoices>({});
      return (
        <StepsList
          steps={[fork, { num: 10, text: 'Cool it.' }]}
          choices={choices}
          onChoosePath={(step, path) => setChoices({ ...choices, [step]: path })}
          onZoomImage={() => undefined}
          t={t}
        />
      );
    };
    const { container } = render(<Page />);
    const lit = (kind: string) =>
      Array.from(container.querySelectorAll(`.${kind} .fork-line-lit`), (p) =>
        p.classList.contains('is-on'),
      );
    const numberOf = (text: string) =>
      screen.getByText(text).closest('.step-card')?.querySelector('.step-num')?.textContent;

    expect(lit('is-split')).toEqual([true, false]);
    expect(numberOf('Cover the bowl.')).toBe('1');
    expect(numberOf('Cool it.')).toBe('2');

    fireEvent.click(screen.getByRole('radio', { name: 'Dutch Oven Bake' }));

    expect(lit('is-split')).toEqual([false, true]);
    expect(lit('is-join')).toEqual([false, true]);
    expect(numberOf('Preheat the Dutch oven.')).toBe('1');
    expect(numberOf('Put the dough in.')).toBe('2');
    expect(numberOf('Bake.')).toBe('3');
    expect(numberOf('Cool it.')).toBe('4');
  });
});

describe('fitting the switch names to the text size', () => {
  it('refits when the text size changes without the row changing width', () => {
    let notify = () => {};
    class FakeObserver {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeObserver);
    vi.stubGlobal('requestAnimationFrame', (run: () => void) => {
      run();
      return 1;
    });
    const measuring = vi.spyOn(DOMTokenList.prototype, 'add');
    const fits = () => measuring.mock.calls.filter(([name]) => name === 'is-measuring').length;
    try {
      render(
        <ForkSwitch
          labels={['Refrigerator Rest', 'Dutch Oven Bake']}
          active={0}
          onChange={() => undefined}
          label={t.chooseOne}
        />,
      );
      const before = fits();
      notify();
      expect(fits()).toBe(before);

      document.documentElement.style.fontSize = '22px';
      notify();
      expect(fits()).toBe(before + 1);
    } finally {
      document.documentElement.style.removeProperty('font-size');
      measuring.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
