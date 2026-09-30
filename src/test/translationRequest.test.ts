import { describe, it, expect } from 'vitest';
import { Piece, pieceHash } from '../utils/translationPieces';
import {
  DocReply,
  TranslationDoc,
  amountsIn,
  buildRequest,
  ingredientRequest,
  parseReply,
  pieceProblem,
  reviewReply,
} from '../utils/translationRequest';

const title: Piece = { key: 'name', kind: 'title', text: 'Apple Pie' };
const flour: Piece = {
  key: 'ingredients:0',
  kind: 'ingredient',
  ingredient: { text: 'Flour - 2 cups', name: 'Flour', note: '' },
};
const step: Piece = { key: 'steps:0:text', kind: 'step', text: 'Bake for 30 minutes.' };
const doc: TranslationDoc = { ref: 'pie', pieces: [title, flour, step], language: 'en' };

describe('ingredientRequest', () => {
  it('sends an editor row as its name and amount, and only the fields with words', () => {
    expect(ingredientRequest({ text: 'Flour - 2 cups', name: 'Flour', note: '' })).toEqual({
      name: 'Flour',
      amount: '2 cups',
    });
    expect(ingredientRequest({ text: 'Salt', name: 'Salt', note: 'to taste' })).toEqual({
      name: 'Salt',
      note: 'to taste',
    });
  });

  it('keeps a name with its own dash whole', () => {
    expect(
      ingredientRequest({
        text: 'beans - drained - 1 (16 ounce)',
        name: 'beans - drained',
        note: '',
      }),
    ).toEqual({ name: 'beans - drained', amount: '1 (16 ounce)' });
  });

  it('sends an older row, whose line isn’t "name - amount", as its line', () => {
    expect(ingredientRequest({ text: '2 cups flour', unit: 'cups', name: 'flour' })).toEqual({
      text: '2 cups flour',
      name: 'flour',
      unit: 'cups',
    });
  });
});

describe('buildRequest and parseReply', () => {
  const request = buildRequest([doc]);

  it('gives each piece an id in its own list, with the fields its reply must have', () => {
    expect(request.shape.documents).toEqual([
      {
        key: 'd1',
        detect: false,
        texts: ['p1', 'p3'],
        // Into Polish: a row without a unit gets no unit forms.
        ingredients: [{ id: 'p2', required: ['name', 'amount'], optional: [] }],
      },
    ]);
    expect(request.payload).toEqual({
      d1: {
        from: 'English',
        texts: [
          { id: 'p1', kind: 'title', text: 'Apple Pie' },
          { id: 'p3', kind: 'step', text: 'Bake for 30 minutes.' },
        ],
        ingredients: [{ id: 'p2', name: 'Flour', amount: '2 cups' }],
      },
    });
  });

  it('asks for the Polish unit forms of a row with a unit, going into Polish', () => {
    const unitRow: Piece = {
      key: 'ingredients:0',
      kind: 'ingredient',
      ingredient: { text: 'Flour - 2 cups', unit: 'cups' },
    };
    const [into] = buildRequest([{ ref: 'x', pieces: [unitRow], language: 'en' }]).shape.documents;
    expect(into.ingredients[0].required).toEqual([
      'text',
      'unit',
      'renderUnit',
      'renderUnitPlural',
    ]);
    const [back] = buildRequest([{ ref: 'x', pieces: [unitRow], language: 'pl' }]).shape.documents;
    expect(back.ingredients[0].required).toEqual(['text', 'unit']);
  });

  it('takes each piece from its own list, with every field, and nothing else', () => {
    const [reply] = parseReply(
      {
        documents: {
          d1: {
            detectedLanguage: 'pl',
            texts: { p1: 'Szarlotka', p2: 'Mąka - 2 szklanki', p3: 42, p9: 'never asked' },
            ingredients: { p2: { name: 'Mąka', amount: '2 szklanki', onclick: 'x' } },
          },
        },
      },
      [doc],
      request,
    );
    // The settled language stands, whatever the model says.
    expect(reply.detectedLanguage).toBe('en');
    expect(reply.values).toEqual(
      new Map<string, unknown>([
        [pieceHash(title), 'Szarlotka'],
        [pieceHash(flour), { text: 'Mąka - 2 szklanki', name: 'Mąka', note: '' }],
      ]),
    );
  });

  it('leaves out a row missing a field it was sent with', () => {
    const [reply] = parseReply(
      { documents: { d1: { ingredients: { p2: { name: 'Mąka' } } } } },
      [doc],
      request,
    );
    expect(reply.values.size).toBe(0);
  });

  it('never takes an amount the row wasn’t sent with', () => {
    const salt: Piece = {
      key: 'ingredients:0',
      kind: 'ingredient',
      ingredient: { text: 'Salt', name: 'Salt' },
    };
    const saltDoc: TranslationDoc = { ref: 's', pieces: [salt], language: 'en' };
    const [reply] = parseReply(
      { documents: { d1: { ingredients: { p1: { name: 'Sól', amount: '1 łyżeczka' } } } } },
      [saltDoc],
      buildRequest([saltDoc]),
    );
    expect(reply.values.get(pieceHash(salt))).toEqual({ text: 'Sól', name: 'Sól' });
  });

  it('throws only when the reply has no documents at all', () => {
    expect(() => parseReply('text', [doc], request)).toThrow();
    expect(() => parseReply({ texts: {} }, [doc], request)).toThrow();
    expect(parseReply({ documents: {} }, [doc], request)[0].values.size).toBe(0);
  });
});

describe('amountsIn', () => {
  it.each([
    ['1.5 teaspoons', [1.5]],
    ['1,5 łyżeczki', [1.5]],
    ['1 1/2 cups', [1.5]],
    ['1 and 1/2 cups', [1.5]],
    ['1 i 1/2 szklanki', [1.5]],
    ['1½ szklanki', [1.5]],
    ['½ teaspoon', [0.5]],
    ['0.5 łyżeczki', [0.5]],
    ['1 (28 ounce)', [1, 28]],
    ['6 to 8 minutes', [6, 8]],
    ['od 6 do 8 minut', [6, 8]],
    ['350°F (175°C)', [175, 350]],
    ['Gather all ingredients.', []],
  ])('%s', (text, amounts) => {
    expect(amountsIn(text)).toEqual(amounts);
  });
});

describe('pieceProblem', () => {
  it('passes a translation that keeps every amount, however it writes them', () => {
    expect(pieceProblem('water - 1.5 cups', 'woda - 1,5 szklanki')).toBeNull();
    expect(pieceProblem('Simmer 6 to 8 minutes.', 'Gotuj od 6 do 8 minut.')).toBeNull();
  });

  it('lets a translation write a number as a digit, or add a measure, as long as none goes missing', () => {
    expect(pieceProblem('Add two eggs.', 'Dodaj 2 jajka.')).toBeNull();
    expect(pieceProblem('Bake at 350°F.', 'Piecz w 350°F (175°C).')).toBeNull();
  });

  it('catches a changed or missing amount', () => {
    expect(pieceProblem('water - 2 cups', 'woda - 3 szklanki')).toBe('numbers');
    expect(pieceProblem('water - 1.5 cups', 'woda - półtorej szklanki')).toBe('numbers');
    expect(
      pieceProblem(
        { text: 'Flour - 2 cups', name: 'Flour' },
        { text: 'Mąka - 1 szklanka', name: 'Mąka' },
      ),
    ).toBe('numbers');
  });

  it('catches words sent back as they were', () => {
    expect(pieceProblem('Gather all ingredients.', 'Gather all ingredients.')).toBe('untranslated');
    const row = { text: 'olive oil - 1.5 teaspoons', name: 'olive oil', note: '' };
    expect(pieceProblem(row, { ...row })).toBe('untranslated');
    // Nothing to translate in a bare amount; a word or two may well be the same in both.
    expect(pieceProblem('2', '2')).toBeNull();
    expect(pieceProblem('Pierogi', 'Pierogi')).toBeNull();
    expect(
      pieceProblem({ text: 'oregano', name: 'oregano' }, { text: 'oregano', name: 'oregano' }),
    ).toBeNull();
  });
});

describe('reviewReply', () => {
  const answer = (values: [Piece, unknown][]): DocReply => ({
    ref: 'pie',
    detectedLanguage: 'en',
    values: new Map(values.map(([p, v]) => [pieceHash(p), v as string])),
  });

  it('keeps good pieces and asks again for the rest, the first time', () => {
    const reviewed = reviewReply(
      doc,
      answer([
        [title, 'Szarlotka'],
        [step, 'Piecz 45 minut.'],
      ]),
      false,
    );
    expect([...reviewed.values.values()]).toEqual(['Szarlotka']);
    expect(reviewed.retry).toEqual([flour, step]);
    expect(reviewed.gaveUp).toEqual([]);
  });

  it('the last time, takes words that are the same in both languages, and gives up on amounts', () => {
    const oregano: Piece = {
      key: 'ingredients:1',
      kind: 'ingredient',
      ingredient: { text: 'oregano', name: 'oregano' },
    };
    const reviewed = reviewReply(
      { ...doc, pieces: [oregano, step, title] },
      answer([
        [oregano, { text: 'oregano', name: 'oregano' }],
        [step, 'Piecz 45 minut.'],
      ]),
      true,
    );
    expect([...reviewed.values.values()]).toEqual([{ text: 'oregano', name: 'oregano' }]);
    expect(reviewed.gaveUp).toEqual([step]);
    // Missing again: waits for a later request rather than being given up on.
    expect(reviewed.retry).toEqual([]);
  });
});
