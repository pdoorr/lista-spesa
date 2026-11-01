import { describe, it, expect } from 'vitest';
import { guessCategory, normalize } from '../lib/categories';
import { parseItemInput, parseMultiline } from '../lib/parse';
import { stepUp, stepDown, formatQuantity, estimatePrice } from '../lib/units';
import { buildGeneratedList, getDueProducts, describeInterval } from '../lib/predict';

describe('normalize', () => {
  it('rimuove accenti e punteggiatura', () => {
    expect(normalize('  Caffè   Lavazza! ')).toBe('caffe lavazza');
  });
});

describe('guessCategory', () => {
  it.each([
    ['Mele', 'frutta-verdura'],
    ['Passata di pomodoro', 'dispensa'],
    ['Pomodori ciliegino', 'frutta-verdura'],
    ['Latte di mandorla', 'bevande'],
    ['Latte', 'latticini'],
    ['Gelato al cioccolato', 'surgelati'],
    ['Patatine', 'dispensa'],
    ['Patate', 'frutta-verdura'],
    ['Carta igienica', 'casa'],
    ['Prosciutto cotto', 'salumi-formaggi'],
    ['Pasta fresca', 'latticini'],
    ['Spazzolino', 'igiene'],
    ['Cosa strana', 'altro']
  ])('%s -> %s', (name, cat) => {
    expect(guessCategory(name)).toBe(cat);
  });
});

describe('parseItemInput', () => {
  it.each([
    ['2 kg mele', { name: 'Mele', quantity: 2, unit: 'kg' }],
    ['mele 2kg', { name: 'Mele', quantity: 2, unit: 'kg' }],
    ['latte x3', { name: 'Latte', quantity: 3, unit: null }],
    ['3x latte', { name: 'Latte', quantity: 3, unit: null }],
    ['500g farina', { name: 'Farina', quantity: 500, unit: 'g' }],
    ['2 hg prosciutto', { name: 'Prosciutto', quantity: 200, unit: 'g' }],
    ['Coca cola 1,5 l', { name: 'Coca cola', quantity: 1.5, unit: 'l' }],
    ['2 grandi mele', { name: 'Grandi mele', quantity: 2, unit: null }],
    ['pane', { name: 'Pane', quantity: null, unit: null }],
    ['7up', { name: '7up', quantity: null, unit: null }],
    ['Mele – 1 kg', { name: 'Mele', quantity: 1, unit: 'kg' }]
  ])('%s', (input, expected) => {
    expect(parseItemInput(input)).toMatchObject(expected);
  });

  it('estrae la nota tra parentesi', () => {
    expect(parseItemInput('Banane – 6 pz (mature)')).toMatchObject({ name: 'Banane', quantity: 6, unit: 'pz', note: 'mature' });
  });
});

describe('parseMultiline', () => {
  it('interpreta una lista condivisa', () => {
    const text = '🛒 Lista della spesa\n\n*🥦 Frutta e verdura*\n• Mele – 1 kg\n- 1.5 kg patate\n[ ] Latte\n2) Pane';
    expect(parseMultiline(text).map(i => [i.name, i.quantity, i.unit])).toEqual([
      ['Mele', 1, 'kg'], ['Patate', 1.5, 'kg'], ['Latte', null, null], ['Pane', null, null]
    ]);
  });
});

describe('units', () => {
  it('passi coerenti', () => {
    expect(stepUp(1, 'pz')).toBe(2);
    expect(stepDown(1, 'pz')).toBe(1);
    expect(stepUp(0.3, 'kg')).toBe(0.5);
    expect(stepDown(2, 'kg')).toBe(1.5);
    expect(stepDown(0.3, 'kg')).toBe(0.1);
    expect(stepUp(500, 'g')).toBe(600);
  });
  it('formatta in italiano', () => {
    expect(formatQuantity(1.5, 'kg').replace(/\s/g, ' ')).toBe('1,5 kg');
  });
  it('stima il prezzo convertendo le unità', () => {
    expect(estimatePrice({ lastPrice: 3, lastQuantity: 1, unit: 'kg' }, 500, 'g')).toBe(1.5);
    expect(estimatePrice({ lastPrice: 3, lastQuantity: 1, unit: 'kg' }, 2, 'pz')).toBeNull();
  });
});

describe('predict', () => {
  const day = 86400000;
  const now = new Date('2026-06-30T12:00:00').getTime();
  const h = (name, daysAgo) => ({ itemName: name, quantity: 1, purchasedAt: new Date(now - daysAgo * day).toISOString() });
  const history = [h('Latte', 21), h('Latte', 14), h('Latte', 7), h('Pane', 3), h('Pane', 1), h('Caffè', 40)];

  it('individua i prodotti in esaurimento', () => {
    const due = getDueProducts(history, { now });
    expect(due.map(d => d.name)).toEqual(['Latte']);
    expect(Math.round(due[0].avgInterval)).toBe(7);
  });

  it('esclude ciò che è già in lista', () => {
    expect(getDueProducts(history, { now, exclude: new Set(['latte']) })).toEqual([]);
  });

  it('genera una lista ordinata con preselezione', () => {
    const list = buildGeneratedList(history, { now });
    expect(list[0].name).toBe('Latte');
    expect(list[0].selected).toBe(true);
    expect(list.find(i => i.name === 'Caffè').selected).toBe(false);
  });

  it('descrive gli intervalli', () => {
    expect(describeInterval(7)).toBe('ogni settimana');
    expect(describeInterval(3)).toBe('ogni 3 giorni');
  });
});
