import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import App from '../App';
import { WANDAS_CHEESE_BREAD } from './fixtures/wandasCheeseBread';
import { UI_TEXT } from '../i18n/translations';
import { Make } from '../types/make';
import { MakeCard } from '../components/makes/MakeCard';
import { chooseFromMenu, goFromMenu } from './menu';

vi.mock('../services/gemini', () => ({
  isTranslationAvailable: false,
  translateDocuments: vi.fn(() => Promise.reject(new Error('offline'))),
}));

const t = UI_TEXT.en;
const PHOTO = 'data:image/jpeg;base64,AAAA';

const make: Make = {
  id: 'make-1',
  recipeId: WANDAS_CHEESE_BREAD.id,
  title: 'Sunday loaves',
  note: 'Doubled it.',
  photo: PHOTO,
  madeOn: '2026-09-12',
  ownerEmail: 'ola@example.com',
  ownerName: 'Ola Nowak',
  createdAt: 100,
  updatedAt: 100,
};

const storedMakes = () =>
  JSON.parse(localStorage.getItem('family_kitchen_makes') ?? '[]') as Make[];

/** jsdom runs no CSS animations: finish the layer's exit by hand. */
const finishExit = (el: Element | null) => {
  if (el) fireEvent.animationEnd(el);
};

describe('the Makes page', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('wandas_recipes', JSON.stringify([WANDAS_CHEESE_BREAD]));
    localStorage.setItem('family_kitchen_makes', JSON.stringify([make]));
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    window.scrollTo = vi.fn();
  });

  it('shows each make with its photo, its recipe, its words and who made it', async () => {
    render(<App />);
    await goFromMenu(t.makes);

    const card = screen
      .getByRole('heading', { name: 'Sunday loaves', level: 2 })
      .closest('article')!;
    expect(within(card).getByText('Doubled it.')).toBeInTheDocument();
    expect(within(card).getByText('Ola N.')).toBeInTheDocument();
    expect(within(card).getByText('12 Sept')).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: t.openRecipeNamed(WANDAS_CHEESE_BREAD.name) }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole('button', { name: t.viewMakePhoto('Sunday loaves') }),
    ).toBeInTheDocument();
  });

  it("goes from a make to its recipe, leaving this person's Recipe Box view as it was", async () => {
    localStorage.setItem('family_kitchen_vault_view', 'list');
    render(<App />);
    await goFromMenu(t.makes);

    fireEvent.click(
      screen.getByRole('button', { name: t.openRecipeNamed(WANDAS_CHEESE_BREAD.name) }),
    );
    expect(
      await screen.findByRole('heading', { name: WANDAS_CHEESE_BREAD.name, level: 1 }),
    ).toBeInTheDocument();
    expect(localStorage.getItem('family_kitchen_vault_view')).toBe('list');

    // Back returns to the Recipe Box, in this person's own view.
    fireEvent.click(screen.getByRole('button', { name: t.backToRecipes }));
    expect(screen.getByRole('heading', { name: t.vaultTitle, level: 1 })).toBeInTheDocument();
    expect(document.querySelector('.vault-box')).toHaveClass('is-list');
  });

  it('saves an edit to a make whose recipe has since been deleted', async () => {
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([{ ...make, recipeId: 'deleted-recipe' }]),
    );
    render(<App />);
    await goFromMenu(t.makes);

    fireEvent.click(screen.getByRole('button', { name: t.editMakeNamed('Sunday loaves') }));
    const form = screen.getByRole('dialog', { name: t.editMakeTitle });
    fireEvent.change(within(form).getByLabelText(t.makeNote), { target: { value: 'Tripled it.' } });
    fireEvent.click(within(form).getByRole('button', { name: t.save }));

    expect(within(form).queryByText(t.makeRecipeRequired)).toBeNull();
    expect(storedMakes()[0]).toMatchObject({ recipeId: 'deleted-recipe', note: 'Tripled it.' });
  });

  it('names a make without a title by its recipe, and a gone recipe as gone', async () => {
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([
        { ...make, title: undefined },
        { ...make, id: 'make-2', recipeId: 'deleted-recipe', title: 'Old loaf', createdAt: 50 },
      ]),
    );
    render(<App />);
    await goFromMenu(t.makes);

    expect(
      screen.getByRole('heading', { name: WANDAS_CHEESE_BREAD.name, level: 2 }),
    ).toBeInTheDocument();
    const gone = screen.getByRole('heading', { name: 'Old loaf' }).closest('article')!;
    expect(within(gone).getByText(t.recipeGone)).toBeInTheDocument();
    expect(within(gone).queryByRole('button', { name: /open the recipe/i })).toBeNull();
  });

  it('asks for a photo and a recipe before a new make can be shared', async () => {
    localStorage.setItem('family_kitchen_makes', '[]');
    render(<App />);
    await goFromMenu(t.makes);
    expect(screen.getByText(t.makesEmptyTitle)).toBeInTheDocument();

    chooseFromMenu(t.addMake);
    const form = screen.getByRole('dialog', { name: t.addMake });
    fireEvent.click(within(form).getByRole('button', { name: t.save }));

    expect(within(form).getByText(t.makePhotoRequired)).toBeInTheDocument();
    expect(within(form).getByText(t.makeRecipeRequired)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: t.addMake })).toBeInTheDocument();
    expect(storedMakes()).toEqual([]);
  });

  it('starts a make from a recipe page with that recipe picked', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name }));
    chooseFromMenu(t.addMake);

    const form = screen.getByRole('dialog', { name: t.addMake });
    expect(
      within(form).getByRole('button', { name: new RegExp(WANDAS_CHEESE_BREAD.name) }),
    ).toHaveAttribute('aria-haspopup', 'listbox');
    // Without a title, the make goes by its recipe's name, as the field suggests.
    expect(within(form).getByLabelText(t.makeTitle)).toHaveAttribute(
      'placeholder',
      WANDAS_CHEESE_BREAD.name,
    );
  });

  it('picks the recipe from a searchable list', async () => {
    localStorage.setItem('family_kitchen_makes', '[]');
    render(<App />);
    await goFromMenu(t.makes);
    chooseFromMenu(t.addMake);
    const form = screen.getByRole('dialog', { name: t.addMake });

    fireEvent.click(within(form).getByRole('button', { name: new RegExp(t.chooseRecipe) }));
    const list = within(form).getByRole('listbox');
    fireEvent.change(within(form).getByPlaceholderText(t.searchRecipes), {
      target: { value: 'chees' },
    });
    fireEvent.click(
      within(list).getByRole('option', { name: new RegExp(WANDAS_CHEESE_BREAD.name) }),
    );
    finishExit(form.querySelector('.category-list-layer'));

    expect(
      within(form).getByRole('button', { name: new RegExp(WANDAS_CHEESE_BREAD.name) }),
    ).toBeInTheDocument();
    expect(within(form).queryByText(t.makeRecipeRequired)).toBeNull();
  });

  it('lets its maker edit a make, keeping its photo and hearts', async () => {
    localStorage.setItem(
      'family_kitchen_makes',
      JSON.stringify([{ ...make, hearts: { 'zosia@example.com': true } }]),
    );
    render(<App />);
    await goFromMenu(t.makes);

    fireEvent.click(screen.getByRole('button', { name: t.editMakeNamed('Sunday loaves') }));
    const form = screen.getByRole('dialog', { name: t.editMakeTitle });
    fireEvent.change(within(form).getByLabelText(t.makeTitle), {
      target: { value: 'Saturday loaves' },
    });
    fireEvent.click(within(form).getByRole('button', { name: t.save }));
    finishExit(form);

    expect(screen.getByRole('heading', { name: 'Saturday loaves' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(t.makeSaved);
    expect(storedMakes()[0]).toMatchObject({
      title: 'Saturday loaves',
      photo: PHOTO,
      hearts: { 'zosia@example.com': true },
    });
  });

  it('asks before deleting a make, and can bring it back', async () => {
    render(<App />);
    await goFromMenu(t.makes);

    fireEvent.click(screen.getByRole('button', { name: t.editMakeNamed('Sunday loaves') }));
    const form = screen.getByRole('dialog', { name: t.editMakeTitle });
    fireEvent.click(within(form).getByRole('button', { name: t.deleteMake }));
    const sheet = screen.getByRole('alertdialog', { name: t.deleteMakeTitle });
    fireEvent.click(within(sheet).getByRole('button', { name: t.deleteMake }));
    finishExit(sheet.parentElement);
    finishExit(form);

    expect(screen.queryByRole('heading', { name: 'Sunday loaves' })).toBeNull();
    expect(storedMakes()[0].deletedAt).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: t.undo }));
    expect(screen.getByRole('heading', { name: 'Sunday loaves' })).toBeInTheDocument();
    expect(storedMakes()[0].deletedAt).toBeUndefined();
  });

  it("lists a recipe's makes from its badge, and goes to one", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name }));

    fireEvent.click(screen.getByRole('button', { name: t.makeCount(1) }));
    const popover = screen.getByRole('dialog', { name: t.makes });
    fireEvent.click(within(popover).getByRole('button', { name: /Sunday loaves/ }));
    await act(async () => {});

    expect(screen.getByRole('heading', { name: t.makes, level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sunday loaves' })).toBeInTheDocument();
  });

  it('counts the makes on the recipe card, after any remixes', () => {
    render(<App />);
    const card = screen.getByRole('button', { name: WANDAS_CHEESE_BREAD.name });
    const badge = card.querySelector('.vault-badges .make-badge');
    expect(badge).toHaveTextContent('1');
  });
});

describe('a make card', () => {
  const card = (props: Partial<React.ComponentProps<typeof MakeCard>> = {}) => {
    const onHeart = vi.fn();
    render(
      <MakeCard
        make={make}
        recipeName="Cheese Bread"
        language="en"
        hearted={false}
        own={false}
        zoomSource={false}
        translating={false}
        eager
        onOpenRecipe={vi.fn()}
        onZoom={vi.fn()}
        onHeart={onHeart}
        onEdit={vi.fn()}
        t={t}
        {...props}
      />,
    );
    return onHeart;
  };

  it("gives and takes back a heart on someone else's make", () => {
    const onHeart = card({ make: { ...make, hearts: { 'zosia@example.com': true } } });
    const heart = screen.getByRole('button', { name: t.giveHeart });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText(t.heartCount(1))).toBeInTheDocument();
    fireEvent.click(heart);
    expect(onHeart).toHaveBeenCalledWith(true);
  });

  it('shows its author the count, with no heart to give, and Edit after it', () => {
    card({ own: true, make: { ...make, hearts: { 'zosia@example.com': true } } });
    expect(screen.queryByRole('button', { name: t.giveHeart })).toBeNull();
    const count = screen.getByText(t.heartCount(1));
    const edit = screen.getByRole('button', { name: t.editMakeNamed('Sunday loaves') });
    expect(count.compareDocumentPosition(edit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("offers no Edit on someone else's make", () => {
    card();
    expect(screen.queryByRole('button', { name: t.editMakeNamed('Sunday loaves') })).toBeNull();
  });
});
