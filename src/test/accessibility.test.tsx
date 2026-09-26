import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IOSInstallModal } from '../components/layout/IOSInstallModal';
import { RecipeCard } from '../components/recipe-grid/RecipeCard';
import { UI_TEXT } from '../i18n/translations';
import { Recipe } from '../types/recipe';

const t = UI_TEXT.en;

describe('dialog dismissal (useDialogDismiss)', () => {
  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<IOSInstallModal onClose={onClose} t={t} />);

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click but not on clicks inside the dialog content', () => {
    const onClose = vi.fn();
    render(<IOSInstallModal onClose={onClose} t={t} />);

    fireEvent.click(screen.getByText(t.iosModalTitle));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RecipeCard keyboard access', () => {
  const recipe: Recipe = {
    id: 'custom-1',
    name: 'Aunt Ola Pierogi',
    author: 'Ola',
    category: 'family',
    heroImage: '',
    yieldHeader: 'For 1 batch:',
    ingredients: [],
    steps: [],
  };

  it.each(['Enter', ' '])('opens the recipe with the %j key', (key) => {
    const onSelect = vi.fn();
    render(<RecipeCard recipe={recipe} language="en" onSelect={onSelect} t={t} />);

    const card = screen.getByRole('button', { name: 'Aunt Ola Pierogi' });
    expect(card).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(card, { key });

    expect(onSelect).toHaveBeenCalledWith('custom-1');
  });
});
