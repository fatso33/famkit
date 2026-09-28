import { describe, it, expect, vi } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { IngredientsTable } from '../components/recipe-detail/IngredientsTable';
import { ImageZoomModal } from '../components/recipe-detail/ImageZoomModal';
import { MethodEditor } from '../components/recipe-form/MethodEditor';
import { IngredientEditor } from '../components/recipe-form/IngredientEditor';
import { emptyRow, emptySection, emptyStep } from '../utils/recipeForm';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { IOSInstallModal } from '../components/layout/IOSInstallModal';
import { useLanguage } from '../hooks/useLanguage';
import { UI_TEXT } from '../i18n/translations';

const pl = UI_TEXT.pl;
const noop = vi.fn();

describe('screen-reader labels follow the selected language', () => {
  it('names the portion scaler and ingredient table in Polish', () => {
    render(
      <IngredientsTable
        ingredients={[{ text: 'Mąka - 450g' }]}
        scale={1}
        onIncreaseScale={noop}
        onDecreaseScale={noop}
        yieldHeader=""
        language="pl"
        t={pl}
      />,
    );

    expect(screen.getByRole('button', { name: 'Zmniejsz porcję' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zwiększ porcję' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Składniki przepisu' })).toBeInTheDocument();
  });

  it('names the photo zoom dialog and its controls in Polish', () => {
    render(<ImageZoomModal imageSrc="x.jpg" onClose={noop} t={pl} />);

    expect(screen.getByRole('dialog', { name: 'Powiększenie zdjęcia kroku' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Powiększ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pomniejsz' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zamknij podgląd zdjęcia' })).toBeInTheDocument();
    expect(screen.getByAltText('Powiększone zdjęcie kroku')).toBeInTheDocument();
  });

  it('labels step editor fields and controls in Polish', () => {
    const step = { ...emptyStep('Wymieszaj'), tip: 'Na gładko', showTip: true };
    render(
      <MethodEditor
        sections={[{ ...emptySection(), steps: [step] }]}
        onChange={noop}
        numberFrom={1}
        activeId={step.id}
        onToast={noop}
        t={pl}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sposób przygotowania' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Opis kroku 1' })).toHaveValue('Wymieszaj');
    expect(screen.getByRole('textbox', { name: 'Wskazówka do kroku 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Przesuń krok 1 w górę' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Narzędzia kroku 1' })).toBeInTheDocument();
  });

  it('labels ingredient rows in Polish', () => {
    const row = { ...emptyRow(), name: 'Mąka', amount: '450g' };
    render(
      <IngredientEditor
        rows={[row]}
        onChange={noop}
        yieldHeader=""
        onYieldChange={noop}
        activeId={row.id}
        onToast={noop}
        t={pl}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Składnik 1' })).toHaveValue('Mąka');
    expect(screen.getByRole('textbox', { name: 'Ilość składnika 1' })).toHaveValue('450g');
    expect(screen.getByRole('button', { name: 'Przesuń składnik w dół' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Narzędzia składnika 1' })).toBeInTheDocument();
  });
});

describe('recipe editor', () => {
  it('has no placeholder text, and every text field still has a label', () => {
    const { container } = render(<AddRecipeModal onClose={noop} onSave={noop} t={pl} />);

    expect(container.querySelectorAll('[placeholder]')).toHaveLength(0);
    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toHaveAccessibleName();
    }
    expect(screen.getByLabelText('Opis')).toBeInTheDocument();
  });
});

describe('iOS install instructions', () => {
  it('shows the steps in Polish, keeping the Safari icons', () => {
    const { container } = render(<IOSInstallModal onClose={noop} t={pl} />);

    expect(screen.getByText('Udostępnij')).toBeInTheDocument();
    expect(screen.getByText('Do ekranu początkowego')).toBeInTheDocument();
    expect(screen.queryByText(/Tap the/)).not.toBeInTheDocument();
    expect(container.querySelector('.ios-share-badge svg')).toBeInTheDocument();
    expect(container.querySelector('.ios-add-badge')).toBeInTheDocument();
  });
});

describe('page language', () => {
  it('sets <html lang> to the selected language so screen readers pronounce it correctly', () => {
    localStorage.setItem('wandas_language', 'pl');
    const { result } = renderHook(() => useLanguage());
    expect(document.documentElement.lang).toBe('pl');

    act(() => result.current.toggleLanguage());
    expect(document.documentElement.lang).toBe('en');
  });
});
