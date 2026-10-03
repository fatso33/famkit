import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AddRecipeModal } from '../components/recipe-form/AddRecipeModal';
import { StepsList } from '../components/recipe-detail/StepsList';
import { UI_TEXT } from '../i18n/translations';
import { Recipe, Step } from '../types/recipe';
import { printableRecipe } from '../utils/printableRecipe';

const t = UI_TEXT.en;

// A tiny JPEG stand-in: data: photos are drawn straight from the recipe.
const LOAF = 'data:image/jpeg;base64,AAAA';

const steps: Step[] = [
  { num: 1, text: 'Mix.' },
  { num: 0, text: '', plain: true, hasImage: true, imageSrc: LOAF, imageCaption: 'the loaf' },
  { num: 2, text: 'Bake.' },
];

const recipe: Recipe = {
  id: 'r1',
  name: 'Loaf',
  author: 'Ola',
  category: 'breads',
  heroImage: '',
  yieldHeader: '',
  ingredients: [{ text: 'Flour - 2 cups' }],
  steps,
};

describe('a photo between the steps on the recipe page', () => {
  it('shows the photo alone, captioned, and the steps around it keep counting', () => {
    const onZoom = vi.fn();
    const { container } = render(
      <StepsList
        steps={steps}
        choices={{}}
        onChoosePath={() => undefined}
        onZoomImage={onZoom}
        t={t}
      />,
    );
    const figure = container.querySelector('figure.method-photo')!;
    expect(figure.querySelector('.step-num')).toBeNull();
    expect(within(figure as HTMLElement).getByRole('img')).toHaveAccessibleName(t.methodPhotoAlt);
    expect(figure.querySelector('figcaption')).toHaveTextContent('The loaf');
    // Two numbered tiles, not three: the photo isn't a step.
    expect(container.querySelectorAll('.step-card')).toHaveLength(2);

    fireEvent.click(within(figure as HTMLElement).getByRole('button'));
    expect(onZoom).toHaveBeenCalledWith(LOAF, 1);
  });
});

describe('a photo between the steps whose photo is missing', () => {
  // A phone's words-only copy leaves an embedded photo out until it's put back.
  const { imageSrc: _photo, ...withoutPhoto } = steps[1];
  const missing = [steps[0], withoutPhoto, steps[2]];

  it('leaves no empty tile on the page', () => {
    const { container } = render(
      <StepsList
        steps={missing}
        choices={{}}
        onChoosePath={() => undefined}
        onZoomImage={() => undefined}
        t={t}
      />,
    );
    expect(container.querySelector('figure.method-photo')).toBeNull();
    expect(container.querySelector('.step-card.is-plain')).toBeNull();
    expect(container.querySelectorAll('.step-card')).toHaveLength(2);
  });

  it('prints nothing for it', () => {
    const pdf = printableRecipe({ ...recipe, steps: missing }, 'en', t, { photos: true });
    expect(pdf.method[0].steps.map((s) => s.kind)).toEqual(['step', 'step']);
  });
});

describe('a photo between the steps in the PDF', () => {
  it('is printed with its caption when the PDF has photos, and left out when not', () => {
    const kinds = (photos: boolean) =>
      printableRecipe(recipe, 'en', t, { photos }).method[0].steps.map((s) =>
        s.kind === 'photo' ? ['photo', s.caption] : [s.kind, 'number' in s ? s.number : null],
      );
    expect(kinds(true)).toEqual([
      ['step', 1],
      ['photo', 'The loaf'],
      ['step', 2],
    ]);
    expect(kinds(false)).toEqual([
      ['step', 1],
      ['step', 2],
    ]);
  });
});

describe('a photo between the steps in the editor', () => {
  it('opens as a photo, with no step number of its own', () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={vi.fn()} onSave={vi.fn()} t={t} />);
    const photo = screen.getByRole('group', { name: t.photoBetweenSteps });
    expect(within(photo).getByDisplayValue('the loaf')).toBeInTheDocument();
    expect(screen.getByLabelText(t.stepInstructionLabel(2))).toHaveValue('Bake.');
    expect(screen.queryByLabelText(t.stepInstructionLabel(3))).toBeNull();
  });

  it('adds one from the Photo key, ready to take or choose', async () => {
    render(<AddRecipeModal initialRecipe={recipe} onClose={vi.fn()} onSave={vi.fn()} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: t.addMethodPhoto }));
    const added = screen.getAllByRole('group', { name: t.photoBetweenSteps }).at(-1)!;
    const take = within(added).getByRole('button', { name: t.takePhoto });
    expect(within(added).getByRole('button', { name: t.uploadPhoto })).toBeInTheDocument();
    await waitFor(() => expect(take).toHaveFocus());
  });

  it('still asks for a step when the method is only a photo', () => {
    const onSave = vi.fn();
    render(
      <AddRecipeModal
        initialRecipe={{ ...recipe, steps: [steps[1]] }}
        onClose={vi.fn()}
        onSave={onSave}
        t={t}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.stepsRequired);
  });

  it('saves the photo where it was put, unnumbered', () => {
    const onSave = vi.fn();
    render(<AddRecipeModal initialRecipe={recipe} onClose={vi.fn()} onSave={onSave} t={t} />);
    fireEvent.click(screen.getByRole('button', { name: t.save }));
    const saved = onSave.mock.calls[0][0] as Recipe;
    expect(saved.steps.map((s) => [s.num, s.text, s.plain, s.imageSrc])).toEqual([
      [1, 'Mix.', undefined, undefined],
      [0, '', true, LOAF],
      [2, 'Bake.', undefined, undefined],
    ]);
  });
});
