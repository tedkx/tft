import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [nutritionPath, productsPath] = process.argv.slice(2);
if (!nutritionPath || !productsPath) {
  console.error('Usage: npm run seed:legacy -- <Nutrition.md> <Food Products.md>');
  process.exit(1);
}

const nutrition = readFileSync(nutritionPath, 'utf8');
const foodProducts = readFileSync(productsPath, 'utf8');
const strip = text => text.replace(/\*\*/g, '').replace(/<[^>]*>/g, '').trim();
const num = text => {
  const matches = [...text.replace(/,/g, '.').matchAll(/\d+(?:\.\d+)?/g)].map(m => Number(m[0]));
  if (!matches.length) return 0;
  return /[–-]/.test(text) && matches.length > 1 ? Math.round((matches[0] + matches[1]) * 5) / 10 : matches[0];
};
const splitRow = line => line.trim().split('|').slice(1, -1).map(cell => cell.trim());
const category = { B: 'breakfast', L: 'lunch', S: 'snack', D: 'dinner' };
const titleOverrides = {
  S1:'Τόνος ή σαρδέλες με ρυζογκοφρέτες',
  S2:'Γιαούρτι με μέλι',
  S4:'Ανθότυρο με αγγούρι και πιπεριά',
  S5:'Κοτόπουλο με φουντούκια',
  S6:'Αυγό, αβοκάντο και cottage',
};

const meals = [];
for (const line of nutrition.split(/\r?\n/)) {
  if (!/^\|\s*\*\*[BLSD]\d+\*\*\s*\|/.test(line)) continue;
  const cells = splitRow(line);
  const code = strip(cells[0]);
  if (code === 'S7') continue; // This packaged pudding belongs to products.
  if (cells.length < 6) continue; // skip the introductory table
  const macroCells = cells.slice(-4);
  const title = titleOverrides[code] ?? (cells[1].startsWith('**') ? cells[1].match(/^\*\*(.*?)\*\*/)?.[1] : undefined) ?? strip(cells[1]).split('.')[0];
  meals.push({ code, title: title.replace(/[.。]$/, ''), category: category[code[0]], description: strip(cells[1]),
    protein: num(macroCells[0]), carbs: num(macroCells[1]), fat: num(macroCells[2]), kcal: num(macroCells[3]) });
}

const products = [];
for (const line of foodProducts.split(/\r?\n/)) {
  if (!line.trimStart().startsWith('|')) continue;
  const cells = splitRow(line);
  const productCells = cells.length >= 10 ? cells.slice(1) : cells;
  if (productCells.length < 9 || !/\d/.test(productCells[1])) continue;
  const grams = [...productCells[1].matchAll(/(\d+(?:[.,]\d+)?)\s*g/gi)];
  const referenceAmount = grams.length ? Number(grams[grams.length - 1][1].replace(',', '.')) : 1;
  const source = productCells[8].match(/\]\((https?:\/\/[^)]+)\)/)?.[1] ?? null;
  products.push({ name: strip(productCells[0]), referenceAmount, unit: grams.length ? 'g' : 'serving',
    protein: num(productCells[2]), carbs: num(productCells[3]), fat: num(productCells[4]), kcal: num(productCells[5]),
    salt: num(productCells[7]), source, notes: strip(productCells[8]) });
}

// Explicit alternatives in the source text become editable variants. Except for
// S1, the Markdown gives only a shared estimate/range, so both start with it.
const alternatives = {
  B6: ['Lurpak + μέλι', 'ΟΛΥΜΠΟΣ άλειμμα φιστίκι'],
  S1: ['Τόνος', 'Σαρδέλες'],
  D7: ['75 g cottage', '60 g ανθότυρο'],
};
for (const meal of meals) {
  if (!alternatives[meal.code]) continue;
  meal.variants = alternatives[meal.code].map((name, index) => ({
    name, description: meal.description,
    protein: meal.code === 'S1' ? 24 : meal.protein,
    carbs: meal.code === 'S1' ? 21 : meal.carbs,
    fat: meal.code === 'S1' ? (index === 0 ? 2 : 12) : meal.fat,
    kcal: meal.code === 'S1' ? (index === 0 ? 200 : 290) : meal.kcal,
  }));
}

const seed = { importedAt: new Date().toISOString(), meals, products };
mkdirSync(resolve('seed'), { recursive: true });
writeFileSync(resolve('seed/legacy.json'), JSON.stringify(seed, null, 2) + '\n');
console.log(`Wrote seed/legacy.json: ${meals.length} meals, ${products.length} products`);
