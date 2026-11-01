// Reparti del supermercato, nell'ordine "tipico" di un percorso in negozio.
// L'ordine può essere personalizzato per ogni supermercato.

export const CATEGORIES = [
  {
    id: 'frutta-verdura', name: 'Frutta e verdura', emoji: '🥦', color: '#3f9b4f',
    keywords: [
      'frutta', 'verdura', 'verdure', 'insalata', 'lattuga', 'rucola', 'spinaci', 'mela', 'mele', 'pera', 'pere',
      'banana', 'banane', 'arancia', 'arance', 'limone', 'limoni', 'mandarini', 'clementine', 'kiwi', 'uva',
      'fragole', 'ciliegie', 'pesche', 'albicocche', 'prugne', 'susine', 'melone', 'anguria', 'ananas', 'avocado',
      'mirtilli', 'lamponi', 'pomodori', 'pomodorini', 'pomodoro', 'zucchine', 'zucchina', 'zucca', 'melanzane',
      'melanzana', 'peperoni', 'peperone', 'carote', 'carota', 'cipolle', 'cipolla', 'aglio', 'patate', 'patata',
      'sedano', 'finocchi', 'finocchio', 'broccoli', 'cavolfiore', 'cavolo', 'verza', 'cetrioli', 'cetriolo',
      'funghi', 'champignon', 'basilico', 'prezzemolo', 'rosmarino', 'salvia', 'menta', 'radicchio', 'carciofi',
      'asparagi', 'fagiolini', 'porri', 'porro', 'scalogno', 'zenzero', 'cime di rapa', 'bietole', 'valeriana',
      'datteri', 'fichi', 'cocco', 'mango', 'melograno', 'castagne', 'frutti di bosco'
    ]
  },
  {
    id: 'panetteria', name: 'Pane e forno', emoji: '🥖', color: '#c4892f',
    keywords: [
      'pane', 'panini', 'panino', 'baguette', 'focaccia', 'pizza', 'piadina', 'piadine', 'grissini', 'crackers',
      'cracker', 'fette biscottate', 'pancarre', 'pan carre', 'pan bauletto', 'tramezzini', 'taralli', 'friselle',
      'cornetti', 'cornetto', 'brioche', 'croissant', 'pangrattato', 'pane grattugiato', 'tortillas', 'wraps'
    ]
  },
  {
    id: 'carne-pesce', name: 'Carne e pesce', emoji: '🥩', color: '#c2453d',
    keywords: [
      'carne', 'pollo', 'petto di pollo', 'cosce', 'tacchino', 'manzo', 'vitello', 'maiale', 'agnello', 'macinato',
      'macinata', 'hamburger', 'salsiccia', 'salsicce', 'wurstel', 'bistecca', 'bistecche', 'fettine', 'arrosto',
      'spezzatino', 'cotolette', 'polpette', 'involtini', 'costine', 'pesce', 'salmone', 'merluzzo', 'orata',
      'branzino', 'spigola', 'gamberi', 'gamberetti', 'cozze', 'vongole', 'calamari', 'polpo', 'seppie', 'sogliola',
      'trota', 'baccala', 'acciughe fresche', 'alici'
    ]
  },
  {
    id: 'salumi-formaggi', name: 'Salumi e formaggi', emoji: '🧀', color: '#d9a21b',
    keywords: [
      'prosciutto', 'crudo', 'cotto', 'salame', 'mortadella', 'bresaola', 'speck', 'pancetta', 'guanciale',
      'coppa', 'affettati', 'affettato', 'formaggio', 'formaggi', 'parmigiano', 'grana', 'pecorino', 'mozzarella',
      'mozzarelle', 'burrata', 'stracchino', 'ricotta', 'gorgonzola', 'provola', 'scamorza', 'emmental', 'fontina',
      'asiago', 'philadelphia', 'formaggini', 'sottilette', 'mascarpone', 'feta', 'taleggio', 'brie', 'caciotta',
      'robiola', 'squacquerone', 'crescenza'
    ]
  },
  {
    id: 'latticini', name: 'Latte, uova e frigo', emoji: '🥛', color: '#4f8fd6',
    keywords: [
      'latte', 'uova', 'uovo', 'yogurt', 'yoghurt', 'burro', 'panna', 'kefir', 'skyr', 'budino', 'budini',
      'margarina', 'tofu', 'hummus', 'pasta fresca', 'tortellini', 'ravioli', 'gnocchi', 'pasta sfoglia',
      'pasta brisee', 'pasta frolla', 'besciamella', 'pesto', 'insalata pronta', 'lievito di birra'
    ]
  },
  {
    id: 'dispensa', name: 'Pasta, riso e dispensa', emoji: '🍝', color: '#b5652b',
    keywords: [
      'pasta', 'spaghetti', 'penne', 'fusilli', 'rigatoni', 'linguine', 'tagliatelle', 'lasagne', 'farfalle',
      'maccheroni', 'orecchiette', 'riso', 'farro', 'orzo', 'cous cous', 'couscous', 'quinoa', 'farina', 'zucchero',
      'sale', 'olio', 'aceto', 'passata', 'pelati', 'polpa di pomodoro', 'concentrato', 'sugo', 'sughi', 'ragu',
      'tonno', 'sgombro', 'acciughe', 'legumi', 'fagioli', 'ceci', 'lenticchie', 'piselli', 'mais', 'olive',
      'capperi', 'sottaceti', 'sottoli', 'carciofini', 'funghi secchi', 'brodo', 'dado', 'dadi', 'spezie', 'pepe',
      'origano', 'curry', 'paprika', 'cannella', 'noce moscata', 'maionese', 'ketchup', 'senape', 'salsa', 'lievito',
      'patatine', 'pop corn', 'popcorn', 'frutta secca', 'noci', 'mandorle', 'nocciole', 'pistacchi', 'arachidi',
      'semi', 'pangrattato', 'polenta', 'purè', 'pure', 'vellutata', 'zuppa', 'minestrone', 'gallette'
    ]
  },
  {
    id: 'colazione', name: 'Colazione e dolci', emoji: '🍪', color: '#a0522d',
    keywords: [
      'biscotti', 'biscotto', 'caffe', 'caffè', 'cialde', 'capsule', 'te', 'tè', 'the', 'tisana', 'tisane',
      'camomilla', 'orzo solubile', 'cereali', 'muesli', 'corn flakes', 'fiocchi', 'marmellata', 'confettura',
      'miele', 'nutella', 'crema spalmabile', 'cioccolato', 'cioccolata', 'cacao', 'merendine', 'merendina',
      'snack', 'barrette', 'torta', 'crostata', 'plumcake', 'wafer', 'caramelle', 'gomme', 'chewing gum',
      'cornflakes', 'pan di spelle', 'savoiardi', 'zucchero di canna'
    ]
  },
  {
    id: 'surgelati', name: 'Surgelati', emoji: '🧊', color: '#3aa6c4',
    keywords: [
      'surgelati', 'surgelato', 'surgelate', 'gelato', 'gelati', 'ghiaccioli', 'ghiaccio', 'bastoncini',
      'sofficini', 'spinaci surgelati', 'piselli surgelati', 'minestrone surgelato', 'pizza surgelata',
      'patatine surgelate', 'frozen'
    ]
  },
  {
    id: 'bevande', name: 'Bevande', emoji: '🧃', color: '#e0662f',
    keywords: [
      'acqua', 'acqua frizzante', 'acqua naturale', 'vino', 'birra', 'birre', 'succo', 'succhi', 'spremuta',
      'coca', 'coca cola', 'cola', 'aranciata', 'chinotto', 'gassosa', 'tonica', 'gin', 'vodka', 'rum', 'whisky',
      'amaro', 'liquore', 'prosecco', 'spumante', 'aperol', 'campari', 'bibite', 'bibita', 'energy drink',
      'te freddo', 'tè freddo', 'estathe', 'sprite', 'fanta', 'latte di soia', 'latte di mandorla', 'bevanda'
    ]
  },
  {
    id: 'casa', name: 'Casa e pulizia', emoji: '🧽', color: '#7b61c9',
    keywords: [
      'detersivo', 'detersivi', 'ammorbidente', 'candeggina', 'varechina', 'sgrassatore', 'anticalcare',
      'brillantante', 'pastiglie lavastoviglie', 'lavastoviglie', 'piatti', 'spugne', 'spugna', 'carta igienica',
      'scottex', 'carta cucina', 'carta assorbente', 'tovaglioli', 'fazzoletti', 'sacchetti', 'sacchi', 'pellicola',
      'alluminio', 'carta forno', 'stagnola', 'guanti', 'panni', 'mocio', 'scopa', 'lampadine', 'pile', 'batterie',
      'insetticida', 'deodorante ambiente', 'profumatore', 'sale lavastoviglie', 'lavatrice', 'bicarbonato',
      'alcool', 'alcol', 'vetril', 'piatti di plastica', 'bicchieri', 'posate di plastica', 'accendino', 'fiammiferi',
      'candele', 'sacchetti freezer', 'zip'
    ]
  },
  {
    id: 'igiene', name: 'Cura della persona', emoji: '🧴', color: '#d14f8b',
    keywords: [
      'shampoo', 'balsamo', 'bagnoschiuma', 'docciaschiuma', 'sapone', 'saponetta', 'dentifricio', 'spazzolino',
      'collutorio', 'filo interdentale', 'deodorante', 'assorbenti', 'salvaslip', 'rasoi', 'rasoio', 'lamette',
      'schiuma da barba', 'crema', 'crema viso', 'crema mani', 'cotone', 'cotton fioc', 'dischetti', 'struccante',
      'trucchi', 'smalto', 'cerotti', 'disinfettante', 'gel', 'lacca', 'tinta', 'protezione solare', 'solare',
      'salviette', 'fazzolettini', 'intimo', 'calze'
    ]
  },
  {
    id: 'bambini', name: 'Bambini', emoji: '🍼', color: '#e49b2c',
    keywords: ['pannolini', 'pannolino', 'omogeneizzati', 'omogeneizzato', 'latte in polvere', 'biberon', 'ciuccio', 'pappa', 'salviettine', 'crema cambio']
  },
  {
    id: 'animali', name: 'Animali', emoji: '🐾', color: '#8a6d4b',
    keywords: ['crocchette', 'scatolette', 'cibo gatto', 'cibo cane', 'lettiera', 'sabbia gatto', 'gatto', 'cane', 'snack cane', 'snack gatto', 'antiparassitario']
  },
  {
    id: 'altro', name: 'Altro', emoji: '🛒', color: '#6b7a70',
    keywords: []
  }
];

export const DEFAULT_CATEGORY = 'altro';

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export function getCategory(id) {
  return CATEGORY_MAP[id] || CATEGORY_MAP[DEFAULT_CATEGORY];
}

export const DEFAULT_CATEGORY_ORDER = CATEGORIES.map(c => c.id);

// Normalizza testo: minuscolo, senza accenti, spazi singoli
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Indice di parole chiave pre-normalizzate
const KEYWORD_INDEX = CATEGORIES.flatMap(cat =>
  cat.keywords.map(k => ({ keyword: normalize(k), category: cat.id }))
);

/**
 * Indovina il reparto di un prodotto dal nome.
 * Vince la parola chiave che compare per prima nel nome (in italiano il
 * sostantivo principale viene di solito prima: "passata di pomodoro"),
 * a parità di posizione vince quella più lunga.
 */
export function guessCategory(name) {
  const text = ` ${normalize(name)} `;
  if (!text.trim()) return DEFAULT_CATEGORY;

  let best = null;
  for (const { keyword, category } of KEYWORD_INDEX) {
    if (!keyword) continue;
    // corrispondenza a inizio parola, con eventuale plurale/suffisso breve
    const idx = text.indexOf(` ${keyword}`);
    if (idx === -1) continue;
    const after = text.slice(idx + keyword.length + 1);
    const suffix = after.match(/^[a-z]*/)[0];
    if (suffix.length > 2) continue; // evita "patate" -> "patatine"
    if (!best || idx < best.idx || (idx === best.idx && keyword.length > best.len)) {
      best = { idx, len: keyword.length, category };
    }
  }
  return best ? best.category : DEFAULT_CATEGORY;
}
