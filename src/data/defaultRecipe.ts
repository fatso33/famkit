import { Recipe } from '../types/recipe';

export const DEFAULT_RECIPE: Recipe = {
  id: 'wandas-cheese-bread',
  name: "Wanda's Cheese Bread",
  author: 'Wanda G.',
  category: 'breads',
  isDefault: true,
  heroImage: './assets/cheese-bread-cutting-board-e1754529029689.jpg',
  yieldHeader: 'For 1 loaf:',
  baseYield: 1,
  ingredients: [
    {
      text: 'All-Purpose Flour - 450g (weigh it)',
      qty: 450,
      unit: 'g',
      prefix: 'All-Purpose Flour - ',
      suffix: ' (weigh it)',
    },
    {
      text: 'Yeast - 2 teaspoons',
      qty: 2,
      unit: 'teaspoons',
      prefix: 'Yeast - ',
      suffix: '',
    },
    {
      text: 'Salt - 1.5 teaspoons',
      qty: 1.5,
      unit: 'teaspoons',
      prefix: 'Salt - ',
      suffix: '',
    },
    {
      text: 'Water (very warm but not hot) - 1.5 cups or 375ml',
      qty: 1.5,
      unit: 'cups',
      altQty: 375,
      altUnit: 'ml',
      prefix: 'Water (very warm but not hot) - ',
      suffix: '',
    },
    {
      text: 'Cheese - 250g',
      qty: 250,
      unit: 'g',
      prefix: 'Cheese - ',
      suffix: '',
    },
    {
      text: 'Jalapenos - 0.5 cup crushed',
      qty: 0.5,
      unit: 'cup',
      prefix: 'Jalapenos - ',
      suffix: ' crushed',
    },
  ],
  cardDescription:
    'A delicious crusty Dutch-oven cheese bread with melted cheddar and spicy crushed jalapenos.',
  tips: 'Use a non-stick spatula or similar tool for handling the dough.',
  steps: [
    {
      num: 0,
      text: 'Divide cheese and jalapenos into 3 equal portions, and reserve a little cheese to put on top of the bread.',
    },
    {
      num: 1,
      text: 'Add flour, yeast, and salt to a bowl and mix well.',
    },
    {
      num: 2,
      text: 'Add water and mix until a sloppy dough forms (use a non-stick or wooden spoon).',
      hasImage: true,
      imageSrc: './assets/sloppy_dough_step2.jpg',
      imageCaption: 'Sloppy dough consistency after adding warm water',
    },
    {
      num: 3,
      text: "Cover the bowl with a towel or plastic wrap, and let it rise for at least an hour. (Check at 30 mins; if it hasn't risen, move to a warm location).",
    },
    {
      num: 4,
      text: 'Drop the dough onto a floured surface.',
    },
    {
      num: 5,
      text: 'Spread the dough with your fingers to form a square.',
    },
    {
      num: 6,
      text: 'Evenly spread one portion of cheese and jalapenos on the dough.',
    },
    {
      num: 7,
      text: 'Roll the square dough in one direction, then in the other.',
    },
    {
      num: 8,
      text: 'Put the dough ball back in the bowl and cover.',
    },
  ],
  laminationDirective:
    'Repeat steps 3 to 8 two more times. After rolling the last portion of cheese and jalapenos into the dough, line the bowl with parchment paper before putting the dough into the bowl. Sprinkle the reserved cheese on top of the dough in the bowl.',
  bakingOptions: {
    option1:
      'Cover the bowl with plastic wrap and put it in the fridge to bake later. The dough must be at room temperature before baking.',
    option2: [
      'Place the Dutch oven inside the oven, and set the oven to 450°F. Preheat the Dutch oven for 30 minutes.',
      'After 30 minutes, remove the Dutch oven and place the parchment paper and dough into it.',
      'Bake for 25 minutes covered and approximately 10 minutes uncovered. When uncovered, monitor the bread for burning.',
    ],
  },
  notes: 'Will not work in an air fryer.',
  translations: {
    pl: {
      name: 'Chleb Serowy Wandy',
      yieldHeader: 'Na 1 bochenek:',
      cardDescription:
        'Pyszny, chrupiący chleb serowy pieczony w garnku żeliwnym z roztopionym cheddarem i pikantnymi jalapeños.',
      tips: 'Do przekładania i formowania ciasta użyj nieprzywierającej szpatułki lub podobnego narzędzia kuchennego.',
      notes: 'Nie piec we frytkownicy beztłuszczowej (air fryer).',
      ingredients: [
        {
          text: 'Mąka pszenna - 450g (zważ ją)',
          qty: 450,
          unit: 'g',
          prefix: 'Mąka pszenna - ',
          suffix: ' (zważ ją)',
        },
        {
          text: 'Drożdże - 2 łyżeczki',
          qty: 2,
          unit: 'łyżeczki',
          prefix: 'Drożdże - ',
          suffix: '',
          renderUnit: 'łyżeczki',
          renderUnitPlural: 'łyżeczek',
        },
        {
          text: 'Sól - 1.5 łyżeczki',
          qty: 1.5,
          unit: 'łyżeczki',
          prefix: 'Sól - ',
          suffix: '',
          renderUnit: 'łyżeczki',
          renderUnitPlural: 'łyżeczek',
        },
        {
          text: 'Woda (bardzo ciepła, lecz nie gorąca) - 1.5 szklanki lub 375ml',
          qty: 1.5,
          unit: 'szklanki',
          altQty: 375,
          altUnit: 'ml',
          prefix: 'Woda (bardzo ciepła, lecz nie gorąca) - ',
          suffix: '',
          renderUnit: 'szklanki',
          renderUnitPlural: 'szklanek',
        },
        {
          text: 'Ser żółty / cheddar - 250g',
          qty: 250,
          unit: 'g',
          prefix: 'Ser żółty / cheddar - ',
          suffix: '',
        },
        {
          text: 'Papryczki jalapeño - 0.5 szklanki posiekanych',
          qty: 0.5,
          unit: 'szklanki',
          prefix: 'Papryczki jalapeño - ',
          suffix: ' posiekanych',
          renderUnit: 'szklanki',
          renderUnitPlural: 'szklanek',
        },
      ],
      steps: [
        {
          num: 0,
          text: 'Podziel ser i papryczki jalapeño na 3 równe porcje, odkładając odrobinę sera do posypania wierzchu bochenka.',
        },
        {
          num: 1,
          text: 'Wsyp mąkę, drożdże i sól do miski i dokładnie wymieszaj.',
        },
        {
          num: 2,
          text: 'Dodaj wodę i mieszaj, aż utworzy się luźne, klejące ciasto (użyj nieprzywierającej lub drewnianej łyżki).',
          hasImage: true,
          imageSrc: './assets/sloppy_dough_step2.jpg',
          imageCaption: 'Konsystencja luźnego, klejącego ciasta po dodaniu ciepłej wody',
        },
        {
          num: 3,
          text: 'Przykryj miskę ściereczką lub folią spożywczą i odstaw do wyrośnięcia na co najmniej godzinę. (Sprawdź po 30 minutach; jeśli nie rośnie, przenieś w cieplejsze miejsce).',
        },
        {
          num: 4,
          text: 'Wyłóż ciasto na oprószoną mąką powierzchnię.',
        },
        {
          num: 5,
          text: 'Rozciągnij ciasto palcami, formując kwadrat.',
        },
        {
          num: 6,
          text: 'Równomiernie rozłóż jedną porcję sera i jalapeños na powierzchni ciasta.',
        },
        {
          num: 7,
          text: 'Zwiń ciasto w rulon w jednym kierunku, a następnie zwiń w drugim kierunku.',
        },
        {
          num: 8,
          text: 'Włóż kulę ciasta z powrotem do miski i przykryj.',
        },
      ],
      laminationDirective:
        'Powtórz kroki od 3 do 8 jeszcze dwa razy. Po zwinięciu ostatniej porcji sera i jalapeños w ciasto, wyłóż miskę papierem do pieczenia przed włożeniem ciasta. Posyp odłożonym serem wierzch ciasta w misce.',
      bakingOptions: {
        option1:
          'Przykryj miskę folią spożywczą i wstaw do lodówki, aby upiec później. Przed pieczeniem ciasto musi osiągnąć temperaturę pokojową.',
        option2: [
          'Umieść garnek żeliwny w piekarniku i rozgrzej piekarnik do 230°C (450°F). Nagrzewaj garnek żeliwny przez 30 minut.',
          'Po 30 minutach wyjmij ostrożnie garnek żeliwny i przełóż do niego ciasto wraz z papierem do pieczenia.',
          'Piecz pod przykryciem przez 25 minut, a następnie około 10 minut bez przykrycia. Po odkryciu kontroluj wypiek, aby chleb się nie przypalił.',
        ],
      },
    },
  },
};
