import { useState } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { IngredientEditor } from '../components/recipe-form/IngredientEditor';
import { moveToPlaceOf } from '../hooks/dragToReorder';
import { UI_TEXT } from '../i18n/translations';
import { IngredientRowState, emptyRow, headingRow } from '../utils/recipeForm';

const t = UI_TEXT.en;
const ROW = 50;

// jsdom has no PointerEvent: a mouse event carrying the pointer's id and kind stands in.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventStandIn extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
      this.pointerType = init.pointerType ?? 'mouse';
    }
  }
  window.PointerEvent = PointerEventStandIn as unknown as typeof PointerEvent;
}

describe('moveToPlaceOf', () => {
  const list = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const ids = (l: { id: string }[]) => l.map((x) => x.id).join('');

  it('moves an item down into the place of a later one', () => {
    expect(ids(moveToPlaceOf(list, 'a', 'c'))).toBe('bcad');
  });

  it('moves an item up into the place of an earlier one', () => {
    expect(ids(moveToPlaceOf(list, 'd', 'b'))).toBe('adbc');
  });

  it('leaves the list be for an unknown id or the same place', () => {
    expect(moveToPlaceOf(list, 'x', 'b')).toBe(list);
    expect(moveToPlaceOf(list, 'b', 'b')).toBe(list);
  });
});

// The ingredient editor with its own rows, the second one lifted.
function Editor({ initial }: { initial: IngredientRowState[] }) {
  const [rows, setRows] = useState(initial);
  return (
    <IngredientEditor
      rows={rows}
      onChange={(change) => setRows((current) => change(current))}
      yieldHeader=""
      onYieldChange={() => {}}
      activeId={initial[1].id}
      onToast={() => {}}
      t={t}
    />
  );
}

const named = (name: string) => ({ ...emptyRow(), name });

// jsdom lays nothing out: give each row a 50px slot, top to bottom, in its current order.
function layOut(list: HTMLElement) {
  for (const li of list.children) {
    vi.spyOn(li, 'getBoundingClientRect').mockImplementation(() => {
      const top = [...list.children].indexOf(li) * ROW;
      return {
        top,
        bottom: top + ROW,
        height: ROW,
        left: 0,
        right: 300,
        width: 300,
        x: 0,
        y: top,
      } as DOMRect;
    });
  }
}

const rowNames = (list: HTMLElement) =>
  [...list.children].map((li) => li.querySelector<HTMLInputElement>('textarea, input')?.value);

afterEach(() => vi.restoreAllMocks());

describe('dragging a row by its grip', () => {
  it('puts it where it was let go, and slides the others aside meanwhile', async () => {
    const rows = [named('Flour'), named('Milk'), headingRow('For the filling'), named('Egg')];
    const { container } = render(<Editor initial={rows} />);
    const list = container.querySelector<HTMLElement>('.ingredient-rows')!;
    layOut(list);
    const grip = list.children[1].querySelector<HTMLElement>('.drag-grip')!;
    expect(grip.getAttribute('aria-hidden')).toBe('true');

    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 75, button: 0, pointerType: 'touch' });
    expect(list.children[1].classList.contains('is-dragging')).toBe(true);
    // Its bottom (100 + 60) passes the heading's middle (125) and the egg's (175)? Only the first.
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 135 });
    expect((list.children[1] as HTMLElement).style.transform).toBe('translateY(60px)');
    expect((list.children[2] as HTMLElement).style.transform).toBe(`translateY(-${ROW}px)`);
    expect((list.children[3] as HTMLElement).style.transform).toBe('');
    // Nothing is reordered until it's let go.
    expect(rowNames(list)).toEqual(['Flour', 'Milk', 'For the filling', 'Egg']);

    fireEvent.pointerUp(grip, { pointerId: 1, clientY: 135 });
    await waitFor(() =>
      expect(rowNames(list)).toEqual(['Flour', 'For the filling', 'Milk', 'Egg']),
    );
    for (const li of list.children) {
      expect((li as HTMLElement).style.transform).toBe('');
      expect(li.classList.contains('is-dragging')).toBe(false);
    }
  });

  it('changes nothing when let go where it began', async () => {
    const rows = [named('Flour'), named('Milk'), named('Egg')];
    const { container } = render(<Editor initial={rows} />);
    const list = container.querySelector<HTMLElement>('.ingredient-rows')!;
    layOut(list);
    const grip = list.children[1].querySelector<HTMLElement>('.drag-grip')!;
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 75, button: 0 });
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 85 });
    fireEvent.pointerUp(grip, { pointerId: 1, clientY: 85 });
    await waitFor(() => expect(list.children[1].classList.contains('is-dragging')).toBe(false));
    expect(rowNames(list)).toEqual(['Flour', 'Milk', 'Egg']);
  });

  it('puts it back when the system takes the touch over mid-drag', async () => {
    const rows = [named('Flour'), named('Milk'), named('Egg')];
    const { container } = render(<Editor initial={rows} />);
    const list = container.querySelector<HTMLElement>('.ingredient-rows')!;
    layOut(list);
    const grip = list.children[1].querySelector<HTMLElement>('.drag-grip')!;
    fireEvent.pointerDown(grip, { pointerId: 1, clientY: 75, button: 0, pointerType: 'touch' });
    fireEvent.pointerMove(grip, { pointerId: 1, clientY: 135 });
    expect((list.children[2] as HTMLElement).style.transform).toBe(`translateY(-${ROW}px)`);
    fireEvent.pointerCancel(grip, { pointerId: 1 });
    expect((list.children[2] as HTMLElement).style.transform).toBe('');
    await waitFor(() => expect(list.children[1].classList.contains('is-dragging')).toBe(false));
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(rowNames(list)).toEqual(['Flour', 'Milk', 'Egg']);
    expect(document.documentElement.classList.contains('is-reordering')).toBe(false);
  });
});
