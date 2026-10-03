import { describe, it, expect } from 'vitest';
import {
  ImportedPage,
  categoryFrom,
  importAddress,
  isoMinutes,
  plainText,
  readImportedPage,
  recipeFromPage,
} from '../utils/recipeImport';
import { formToRecipe } from '../utils/recipeForm';
import { UI_TEXT } from '../i18n/translations';

const labels = { servings: UI_TEXT.en.importServings, time: UI_TEXT.en.totalTime };

const pageOf = (...blocks: unknown[]): ImportedPage => ({
  url: 'https://www.example.com/recipes/bread',
  lang: 'en',
  jsonLd: blocks.map((block) => (typeof block === 'string' ? block : JSON.stringify(block))),
  meta: { image: 'https://www.example.com/share.jpg', siteName: 'Example Kitchen' },
  html: '',
});

const bread = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'Mum&#39;s Bread &amp; Butter',
  description: '<p>A soft loaf.</p>',
  author: { '@type': 'Person', name: 'Jane Baker' },
  image: ['https://www.example.com/bread.jpg', 'https://www.example.com/bread-small.jpg'],
  recipeYield: ['1', '1 loaf'],
  totalTime: 'PT1H30M',
  recipeCategory: 'Bread',
  recipeIngredient: ['500 g bread flour (sifted)', '1 1/2 cups water', '&frac12; tsp salt'],
  recipeInstructions: [
    { '@type': 'HowToStep', name: 'Mix', text: '1. Mix the flour and water.' },
    { '@type': 'HowToStep', text: 'Knead for 10 minutes.' },
  ],
};

describe('reading a recipe from a page', () => {
  it('fills the form from the page’s own recipe data, words as written', () => {
    const imported = recipeFromPage(pageOf(bread), labels);
    expect(imported?.imageUrl).toBe('https://www.example.com/bread.jpg');
    const form = imported!.form;
    expect(form.title).toBe("Mum's Bread & Butter");
    expect(form.cardDescription).toBe('A soft loaf.');
    // Credited to whoever adds it, not to the site's author.
    expect([form.authorMode, form.author]).toEqual(['auto', '']);
    expect(form.yieldHeader).toBe('1 loaf:');
    expect(form.manualMinutes).toBe(90);
    expect(form.category).toBe('breads');
    expect(form.source).toBe('https://www.example.com/recipes/bread');
    expect(form.ingredientRows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['bread flour', '500 g', 'sifted'],
      ['water', '1 1/2 cups', ''],
      ['salt', '½ tsp', ''],
    ]);
    expect(form.sections.map((s) => [s.title, s.steps.map((st) => st.text)])).toEqual([
      ['', ['Mix the flour and water.', 'Knead for 10 minutes.']],
    ]);
    // It saves as a recipe like any other, with where it came from.
    const recipe = formToRecipe(form);
    expect(recipe.steps.map((s) => s.num)).toEqual([1, 2]);
    expect(recipe.sourceUrl).toBe('https://www.example.com/recipes/bread');
  });

  it('finds the recipe inside a graph, following references to its picture', () => {
    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', '@id': 'https://www.example.com/#website', name: 'Example' },
        { '@type': 'Person', '@id': 'https://www.example.com/#/person/1', name: 'Ania' },
        {
          '@type': 'ImageObject',
          '@id': 'https://www.example.com/#primaryimage',
          url: '/uploads/zupa.jpg',
        },
        {
          '@type': ['Recipe', 'NewsArticle'],
          name: 'Zupa pomidorowa',
          author: { '@id': 'https://www.example.com/#/person/1' },
          image: { '@id': 'https://www.example.com/#primaryimage' },
          recipeYield: 4,
          prepTime: 'PT15M',
          cookTime: 'PT45M',
          recipeCategory: ['Zupy', 'Obiad'],
          recipeIngredient: ['1 kg pomidorów', '2 łyżki masła'],
          recipeInstructions: 'Pokrój pomidory.\nGotuj 45 minut.',
        },
      ],
    };
    const imported = recipeFromPage(pageOf('not json {', graph), {
      servings: UI_TEXT.pl.importServings,
      time: UI_TEXT.pl.totalTime,
    });
    const form = imported!.form;
    expect(imported!.imageUrl).toBe('https://www.example.com/uploads/zupa.jpg');
    expect(form.yieldHeader).toBe('Na 4 porcje:');
    // Prep and cook come in as typed times, written as the app writes them.
    expect(form.times).toEqual({ prep: '15m', cook: '45m', rest: '' });
    expect(form.manualMinutes).toBeNull();
    // Two categories named: no guess.
    expect(form.category).toBe('');
    expect(form.ingredientRows.map((r) => [r.name, r.amount])).toEqual([
      ['pomidorów', '1 kg'],
      ['masła', '2 łyżki'],
    ]);
    expect(form.sections[0].steps.map((s) => s.text)).toEqual([
      'Pokrój pomidory.',
      'Gotuj 45 minut.',
    ]);
  });

  it('keeps the site’s sections, substeps inside a step, and options as a choice', () => {
    const recipe = {
      ...bread,
      author: undefined,
      image: undefined,
      recipeInstructions: [
        {
          '@type': 'HowToSection',
          name: 'Dough:',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Make the dough:<br>a) Mix.<br>b) Knead.' },
            { '@type': 'HowToStep', text: 'Let it rise.' },
          ],
        },
        {
          '@type': 'HowToSection',
          name: 'Option 1: Oven',
          itemListElement: [{ '@type': 'HowToStep', text: 'Bake at 220°C.' }],
        },
        {
          '@type': 'HowToSection',
          name: 'Option 2: Bread machine',
          itemListElement: [
            { '@type': 'HowToStep', text: 'Set to basic.' },
            { '@type': 'HowToStep', text: 'Start.' },
          ],
        },
      ],
    };
    const imported = recipeFromPage(pageOf(recipe), labels)!;
    // No picture named: the page's share picture.
    expect(imported.imageUrl).toBe('https://www.example.com/share.jpg');

    const [dough, ...rest] = imported.form.sections;
    expect(rest).toEqual([]);
    expect(dough.title).toBe('Dough');
    expect(dough.steps[0].text).toBe('Make the dough:');
    expect(dough.steps[0].substeps.map((s) => s.text)).toEqual(['Mix.', 'Knead.']);
    expect(
      dough.steps[2].fork?.paths.map((p) => [p.label, p.text, p.steps.map((s) => s.text)]),
    ).toEqual([
      ['Oven', 'Bake at 220°C.', []],
      ['Bread machine', 'Set to basic.', ['Start.']],
    ]);
  });

  it('finds no recipe on a page without one, or with half of one', () => {
    expect(recipeFromPage(pageOf({ '@type': 'Article', name: 'News' }), labels)).toBeNull();
    expect(recipeFromPage(pageOf({ ...bread, recipeInstructions: [] }), labels)).toBeNull();
    expect(recipeFromPage(pageOf({ ...bread, recipeIngredient: undefined }), labels)).toBeNull();
    expect(recipeFromPage(pageOf(), labels)).toBeNull();
  });

  it('takes the fullest of several recipes on one page', () => {
    const teaser = { ...bread, name: 'Teaser', recipeIngredient: ['1 egg'] };
    expect(recipeFromPage(pageOf(teaser, bread), labels)?.form.title).toBe("Mum's Bread & Butter");
  });

  it('runs nothing from the page: markup in its text is read as text', () => {
    const hostile = {
      ...bread,
      name: '<img src=x onerror="window.__hacked = true">Bread<script>window.__hacked = true</script>',
      image: 'javascript:alert(1)',
    };
    const imported = recipeFromPage(
      { ...pageOf(hostile), meta: { image: '', siteName: '' } },
      labels,
    )!;
    expect(imported.form.title).toBe('Bread');
    expect(imported.imageUrl).toBe('');
    expect((window as { __hacked?: boolean }).__hacked).toBeUndefined();
  });
});

describe('reading a recipe from a page’s markup', () => {
  const markupPage = (html: string): ImportedPage => ({ ...pageOf(), html });

  it('reads microdata as the site states it, without taking a site’s dashes for amounts', () => {
    const imported = recipeFromPage(
      markupPage(`<html lang="pl"><body>
        <article itemscope itemtype="https://schema.org/Recipe">
          <h1 itemprop="name">Żurek staropolski</h1>
          <div itemprop="author" itemscope itemtype="https://schema.org/Person">
            <meta itemprop="name" content="Ania Gotuje"></div>
          <meta itemprop="totalTime" content="PT1H0M">
          <meta itemprop="recipeYield" content="około 2 litry zupy">
          <meta itemprop="recipeCategory" content="zupy">
          <meta itemprop="image" content="https://cdn.example.com/zurek-1500x1500.jpg">
          <ul>
            <li><span itemprop="recipeIngredient"><span>1 litr bulionu</span><!----></span></li>
            <li><span itemprop="recipeIngredient">1 ząbek czosnku - 5 g</span></li>
            <li><span itemprop="recipeIngredient">do podania: jajka na twardo</span></li>
            <li><span itemprop="recipeIngredient">Mąka - 300 g</span></li>
          </ul>
          <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
            <span itemprop="name">Kiełbasa</span>
            <div itemprop="text"><p>Podsmaż kiełbasę.</p>
              <img src="x.jpg" onerror="window.__hacked = true"><p>Odstaw.</p></div>
          </div>
          <div itemprop="recipeInstructions" itemscope itemtype="https://schema.org/HowToStep">
            <div itemprop="text">Wlej zakwas.</div>
          </div>
        </article></body></html>`),
      labels,
    )!;
    expect(imported.guessed).toBe(false);
    expect(imported.imageUrl).toBe('https://cdn.example.com/zurek-1500x1500.jpg');
    const form = imported.form;
    expect([form.title, form.category]).toEqual(['Żurek staropolski', 'soups']);
    expect([form.yieldHeader, form.manualMinutes]).toEqual(['około 2 litry zupy:', 60]);
    expect(form.ingredientRows.map((r) => [r.name, r.amount])).toEqual([
      ['bulionu', '1 litr'],
      ['czosnku - 5 g', '1 ząbek'],
      ['do podania: jajka na twardo', ''],
      ['Mąka', '300 g'],
    ]);
    expect(form.sections[0].steps.map((s) => s.text)).toEqual([
      'Podsmaż kiełbasę. Odstaw.',
      'Wlej zakwas.',
    ]);
    expect((window as { __hacked?: boolean }).__hacked).toBeUndefined();
  });

  it('falls back to the lists under the page’s headings, and says it guessed', () => {
    const imported = recipeFromPage(
      markupPage(`<html><head><title>Racuchy | Kuchnia</title></head><body>
        <nav><h3>Składniki</h3><ul><li>Kasze</li><li>Ziarna</li></ul></nav>
        <div itemscope itemtype="https://schema.org/Recipe">
          <meta itemprop="image" content="/files/racuchy.jpg"></div>
        <h1>Racuchy z jabłkami</h1>
        <h3>Składniki</h3>
        <div><ul><li>2 jabłka</li><li>200 ml mleka (niepełna szklanka)</li></ul></div>
        <h3> Przygotowanie </h3>
        <div><ul><li>Mąkę przesiać.</li><li>Smażyć na złoto.</li></ul></div>
        <h3>Wskazówki</h3><ul><li>Podawać ciepłe.</li></ul>
      </body></html>`),
      labels,
    )!;
    expect(imported.guessed).toBe(true);
    expect(imported.imageUrl).toBe('https://www.example.com/files/racuchy.jpg');
    expect(imported.form.title).toBe('Racuchy z jabłkami');
    // No yield stated: none made up.
    expect(imported.form.yieldHeader).toBe('');
    expect(imported.form.ingredientRows.map((r) => [r.name, r.amount, r.note])).toEqual([
      ['jabłka', '2', ''],
      ['mleka', '200 ml', 'niepełna szklanka'],
    ]);
    expect(imported.form.sections[0].steps.map((s) => s.text)).toEqual([
      'Mąkę przesiać.',
      'Smażyć na złoto.',
    ]);
  });

  it('prefers what the page states as data, and finds nothing in a page with half a recipe', () => {
    const stated = recipeFromPage(
      { ...pageOf(bread), html: '<h2>Ingredients</h2><ul><li>1 egg</li></ul>' },
      labels,
    )!;
    expect([stated.guessed, stated.form.title]).toEqual([false, "Mum's Bread & Butter"]);
    expect(
      recipeFromPage(
        markupPage('<h1>Soup</h1><h2>Ingredients</h2><ul><li>1 egg</li></ul>'),
        labels,
      ),
    ).toBeNull();
    expect(recipeFromPage(markupPage('<p>Nothing here.</p>'), labels)).toBeNull();
  });
});

describe('the worker’s reply', () => {
  it('is read field by field', () => {
    expect(readImportedPage(null)).toBeNull();
    expect(readImportedPage({ url: 'file:///etc/passwd', jsonLd: [] })).toBeNull();
    expect(
      readImportedPage({ url: 'https://a.example/x', lang: 7, jsonLd: ['{}', 3, null], meta: 'x' }),
    ).toEqual({
      url: 'https://a.example/x',
      lang: '',
      jsonLd: ['{}'],
      meta: { image: '', siteName: '' },
      html: '',
    });
  });
});

describe('the pieces', () => {
  it('reads ISO durations', () => {
    expect(isoMinutes('PT45M')).toBe(45);
    expect(isoMinutes('PT1H')).toBe(60);
    expect(isoMinutes('P1DT2H')).toBe(1560);
    expect(isoMinutes('PT0M')).toBeNull();
    expect(isoMinutes('45 minutes')).toBeNull();
    expect(isoMinutes(undefined)).toBeNull();
  });

  it('turns HTML in a text into plain words, keeping lines when asked', () => {
    expect(plainText('Fish &amp; chips&nbsp;<b>now</b>')).toBe('Fish & chips now');
    expect(plainText('<p>One.</p><p>Two.</p>', true)).toBe('One.\nTwo.');
    expect(plainText({ not: 'text' })).toBe('');
  });

  it('places a site’s category only when it names exactly one of ours', () => {
    expect(categoryFrom('Dessert')).toBe('cakes');
    expect(categoryFrom(['Main Course'])).toBe('mains');
    expect(categoryFrom('Śniadania')).toBe('breakfast');
    expect(categoryFrom('Soup, Dinner')).toBe('');
    // "side" inside another word isn't a side dish.
    expect(categoryFrom('Countryside')).toBe('');
    expect(categoryFrom(undefined)).toBe('');
  });

  it('reads an address as typed or pasted', () => {
    expect(importAddress(' example.com/soup ')).toBe('https://example.com/soup');
    expect(importAddress('http://example.com/soup')).toBe('https://example.com/soup');
    expect(importAddress('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(importAddress('just some words')).toBe('');
    expect(importAddress('ftp://example.com/x')).toBe('');
    expect(importAddress('localhost')).toBe('');
    expect(importAddress('')).toBe('');
  });
});
