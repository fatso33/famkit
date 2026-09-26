import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IngredientsTable } from '../components/recipe-detail/IngredientsTable';
import { ImageZoomModal } from '../components/recipe-detail/ImageZoomModal';
import { StepBuilder } from '../components/recipe-form/StepBuilder';
import { IngredientBuilder } from '../components/recipe-form/IngredientBuilder';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
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
    render(
      <StepBuilder
        steps={[{ id: 'a', text: 'Wymieszaj', notes: '', imageSrc: '', imageCaption: '' }]}
        onChange={noop}
        t={pl}
      />,
    );

    expect(screen.getByText('Krok 1')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Opis kroku 1' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Wskazówka \/ Konsystencja/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Przesuń krok 1 w górę' })).toBeInTheDocument();
  });

  it('labels ingredient rows in Polish', () => {
    render(
      <IngredientBuilder
        rows={[{ id: 'r1', name: 'Mąka', amount: '450g' }]}
        onChange={noop}
        t={pl}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Składnik 1' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Ilość składnika 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Przesuń składnik w dół' })).toBeInTheDocument();
  });
});

describe('recipe editor', () => {
  it('has no placeholder text, and every text field still has a label', () => {
    const { container } = render(<AddRecipeModal onClose={noop} onSave={noop} t={pl} />);

    expect(container.querySelectorAll('[placeholder]')).toHaveLength(0);
    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toHaveAccessibleName();
    }
    expect(screen.getByLabelText('Opis (opcjonalnie)')).toBeInTheDocument();
  });
});
