import './env.js';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import * as schema from './schema.js';
import type {
  EntryInput,
  Macros,
  MealInput,
  MeasurementInput,
  ProductInput,
  VariantInput,
} from './models.js';
import { addMacros, InputError, logicalDay, now, scaleMacros, zeroMacros } from './utils.js';
import type { HevyWorkout } from './hevy.js';

const cleanMealTitle = (code: string, title: string) =>
  title.replace(new RegExp(`^${code}(?:\\s*[·.:–-]\\s*|\\s+)`, 'i'), '').trim() || title;

const dbPath = process.env.FITNESS_DB_PATH ?? resolve('data/fitness.sqlite');
mkdirSync(dirname(dbPath), { recursive: true });
export const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.exec(`
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, alias TEXT NOT NULL UNIQUE, name TEXT NOT NULL, reference_amount REAL NOT NULL, unit TEXT NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL, kcal REAL NOT NULL, salt REAL, source TEXT, notes TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meals (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, title TEXT NOT NULL, categories TEXT NOT NULL DEFAULT '[]', ingredients_text TEXT NOT NULL DEFAULT '', description TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS meal_variants (id TEXT PRIMARY KEY, meal_id TEXT NOT NULL REFERENCES meals(id), name TEXT NOT NULL, ingredients TEXT NOT NULL DEFAULT '[]', macro_mode TEXT NOT NULL DEFAULT 'manual', protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL, kcal REAL NOT NULL, is_default INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS food_entries (id TEXT PRIMARY KEY, day TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT, variant_id TEXT, amount REAL NOT NULL, label TEXT NOT NULL, snapshot TEXT NOT NULL, snapshot_detail TEXT NOT NULL DEFAULT '{}', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS food_entries_day_idx ON food_entries(day);
CREATE TABLE IF NOT EXISTS sleep_records (day TEXT PRIMARY KEY, minutes INTEGER NOT NULL, source TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS measurements (id TEXT PRIMARY KEY, day TEXT NOT NULL, weight_kg REAL, waist_cm REAL, fat_kg REAL, muscle_kg REAL, bone_kg REAL, steps INTEGER, source TEXT NOT NULL, notes TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS measurements_day_idx ON measurements(day);
CREATE TABLE IF NOT EXISTS hevy_workouts (id TEXT PRIMARY KEY, title TEXT NOT NULL, start_time TEXT NOT NULL UNIQUE, end_time TEXT NOT NULL, day TEXT NOT NULL, description TEXT NOT NULL, content_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS hevy_workouts_day_idx ON hevy_workouts(day);
CREATE TABLE IF NOT EXISTS hevy_sets (id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id TEXT NOT NULL REFERENCES hevy_workouts(id) ON DELETE CASCADE, position INTEGER NOT NULL, exercise_title TEXT NOT NULL, superset_id TEXT, exercise_notes TEXT NOT NULL, set_index INTEGER NOT NULL, set_type TEXT NOT NULL, weight_kg REAL, reps INTEGER, distance_km REAL, duration_seconds REAL, rpe REAL);
CREATE INDEX IF NOT EXISTS hevy_sets_workout_idx ON hevy_sets(workout_id,position);
CREATE TABLE IF NOT EXISTS checkins (day TEXT PRIMARY KEY, text TEXT NOT NULL, input_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS target_history (effective_day TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT NOT NULL);
`);
if (
  !(sqlite.pragma('table_info(food_entries)') as Array<{ name: string }>).some(
    (column) => column.name === 'snapshot_detail',
  )
)
  sqlite.exec("ALTER TABLE food_entries ADD COLUMN snapshot_detail TEXT NOT NULL DEFAULT '{}'");
const mealColumns = (sqlite.pragma('table_info(meals)') as Array<{ name: string }>).map(
  (c) => c.name,
);
if (mealColumns.includes('category')) {
  sqlite.transaction(() => {
    sqlite.exec('ALTER TABLE meals RENAME COLUMN category TO categories');
    sqlite.exec('UPDATE meals SET categories = json_array(categories)');
  })();
}
if (!mealColumns.includes('ingredients_text')) {
  sqlite.exec("ALTER TABLE meals ADD COLUMN ingredients_text TEXT NOT NULL DEFAULT ''");
  const updateIngredients = sqlite.prepare('UPDATE meals SET ingredients_text=? WHERE id=?');
  for (const meal of sqlite.prepare('SELECT id,title,description FROM meals').all() as Array<{
    id: string;
    title: string;
    description: string | null;
  }>) {
    const description = meal.description?.trim() ?? '';
    const prefix = `${meal.title}. `;
    updateIngredients.run(
      description.startsWith(prefix) ? description.slice(prefix.length) : description,
      meal.id,
    );
  }
}
for (const meal of sqlite.prepare('SELECT id,code,title FROM meals').all() as Array<{
  id: string;
  code: string;
  title: string;
}>) {
  const title = cleanMealTitle(meal.code, meal.title);
  if (title && title !== meal.title)
    sqlite.prepare('UPDATE meals SET title=? WHERE id=?').run(title, meal.id);
}
export const db = drizzle(sqlite, { schema });
export const defaults: Macros = { protein: 130, carbs: 225, fat: 65, kcal: 2005 };

// Keep the existing single target value as the baseline when upgrading older databases.
sqlite.transaction(() => {
  const count = sqlite.prepare('SELECT COUNT(*) AS count FROM target_history').get() as {
    count: number;
  };
  if (count.count) return;
  const legacy = sqlite.prepare("SELECT value FROM settings WHERE key = 'targets'").get() as
    { value: string } | undefined;
  sqlite
    .prepare('INSERT INTO target_history (effective_day,value,created_at) VALUES (?,?,?)')
    .run('0001-01-01', legacy?.value ?? JSON.stringify(defaults), now());
})();

export const row = (sql: string, ...params: unknown[]) =>
  sqlite.prepare(sql).get(...params) as Record<string, unknown> | undefined;
export const all = (sql: string, ...params: unknown[]) =>
  sqlite.prepare(sql).all(...params) as Array<Record<string, unknown>>;

function presentWorkout(workout: Record<string, unknown>) {
  return {
    ...workout,
    sets: all('SELECT * FROM hevy_sets WHERE workout_id=? ORDER BY position', workout.id),
  };
}
export const workoutsForDay = (day: string) =>
  all('SELECT * FROM hevy_workouts WHERE day=? ORDER BY start_time', day).map(presentWorkout);
export const recentWorkouts = (end: string, limit = 30) =>
  all('SELECT * FROM hevy_workouts WHERE day<=? ORDER BY start_time DESC LIMIT ?', end, limit).map(
    presentWorkout,
  );

export function importHevyWorkouts(workouts: HevyWorkout[]) {
  const insertWorkout = sqlite.prepare(
    'INSERT INTO hevy_workouts (id,title,start_time,end_time,day,description,content_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  const updateWorkout = sqlite.prepare(
    'UPDATE hevy_workouts SET title=?,end_time=?,day=?,description=?,content_hash=?,updated_at=? WHERE id=?',
  );
  const insertSet = sqlite.prepare(
    'INSERT INTO hevy_sets (workout_id,position,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  );
  const deleteSets = sqlite.prepare('DELETE FROM hevy_sets WHERE workout_id=?');
  return sqlite.transaction(() => {
    const result = {
      workoutsInFile: workouts.length,
      setsInFile: 0,
      added: 0,
      updated: 0,
      unchanged: 0,
    };
    for (const workout of workouts) {
      result.setsInFile += workout.sets.length;
      const hash = createHash('sha256').update(JSON.stringify(workout)).digest('hex');
      const existing = row(
        'SELECT id,content_hash FROM hevy_workouts WHERE start_time=?',
        workout.startTime,
      );
      if (existing?.content_hash === hash) {
        result.unchanged++;
        continue;
      }
      const id = existing ? String(existing.id) : randomUUID();
      const time = now();
      if (existing) {
        updateWorkout.run(
          workout.title,
          workout.endTime,
          workout.day,
          workout.description,
          hash,
          time,
          id,
        );
        deleteSets.run(id);
        result.updated++;
      } else {
        insertWorkout.run(
          id,
          workout.title,
          workout.startTime,
          workout.endTime,
          workout.day,
          workout.description,
          hash,
          time,
          time,
        );
        result.added++;
      }
      workout.sets.forEach((set, position) => {
        insertSet.run(
          id,
          position,
          set.exerciseTitle,
          set.supersetId,
          set.exerciseNotes,
          set.setIndex,
          set.setType,
          set.weightKg,
          set.reps,
          set.distanceKm,
          set.durationSeconds,
          set.rpe,
        );
      });
    }
    return result;
  })();
}

sqlite.exec(
  'CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)',
);
export function audit(actorName: string, action: string, entityId: string, value: unknown) {
  sqlite
    .prepare(
      'INSERT INTO audit_events (id,actor,action,entity_id,payload,created_at) VALUES (?,?,?,?,?,?)',
    )
    .run(randomUUID(), actorName, action, entityId, JSON.stringify(value), now());
}

export function variantMacros(input: VariantInput): Macros {
  if (input.macroMode === 'manual') {
    if (!input.macros) throw new InputError('Manual variant needs macros');
    return input.macros;
  }
  if (!input.ingredients.length) throw new InputError('Computed variant needs products');
  return input.ingredients.reduce((total, ingredient) => {
    const product = row('SELECT * FROM products WHERE id = ?', ingredient.productId);
    if (!product) throw new InputError('Ingredient product not found');
    return addMacros(
      total,
      scaleMacros(
        product as unknown as Macros,
        ingredient.amount / Number(product.reference_amount),
      ),
    );
  }, zeroMacros());
}
export function presentMeal(meal: Record<string, unknown>) {
  return {
    ...meal,
    categories: JSON.parse(String(meal.categories)) as string[],
    variants: all(
      'SELECT * FROM meal_variants WHERE meal_id = ? ORDER BY is_default DESC, created_at',
      meal.id,
    ).map((v) => ({ ...v, ingredients: JSON.parse(String(v.ingredients)) })),
  };
}
export function recalculateProductVariants(productId: string) {
  for (const variant of all("SELECT * FROM meal_variants WHERE macro_mode = 'computed'")) {
    const ingredients = JSON.parse(String(variant.ingredients)) as Array<{
      productId: string;
      amount: number;
    }>;
    if (!ingredients.some((i) => i.productId === productId)) continue;
    const macros = variantMacros({
      name: String(variant.name),
      ingredients,
      macroMode: 'computed',
    });
    sqlite
      .prepare('UPDATE meal_variants SET protein=?,carbs=?,fat=?,kcal=?,updated_at=? WHERE id=?')
      .run(macros.protein, macros.carbs, macros.fat, macros.kcal, now(), variant.id);
  }
}
export function snapshot(input: EntryInput) {
  if (input.kind === 'custom') {
    if (!input.macros || !input.label) throw new InputError('Custom entry needs label and macros');
    return {
      label: input.label,
      macros: scaleMacros(input.macros, input.amount),
      detail: { label: input.label, source: 'custom' },
      refId: null,
      variantId: null,
    };
  }
  if (input.kind === 'product') {
    const product = row('SELECT * FROM products WHERE id=? AND active=1', input.refId);
    if (!product) throw new InputError('Product not found');
    return {
      label: String(product.name),
      macros: scaleMacros(
        product as unknown as Macros,
        input.amount / Number(product.reference_amount),
      ),
      detail: {
        alias: product.alias,
        name: product.name,
        referenceAmount: product.reference_amount,
        unit: product.unit,
        amount: input.amount,
      },
      refId: product.id,
      variantId: null,
    };
  }
  const variant = row('SELECT * FROM meal_variants WHERE id=? AND active=1', input.variantId);
  if (!variant) throw new InputError('Variant not found');
  const meal = row('SELECT * FROM meals WHERE id=? AND active=1', variant.meal_id);
  if (!meal) throw new InputError('Meal not found');
  const ingredients = (
    JSON.parse(String(variant.ingredients)) as Array<Record<string, unknown>>
  ).map((ingredient) => {
    if (!ingredient.productId) return ingredient;
    const product = row('SELECT * FROM products WHERE id=?', ingredient.productId);
    return {
      ...ingredient,
      productName: product?.name ?? null,
      productAlias: product?.alias ?? null,
    };
  });
  return {
    label: `${meal.code} · ${meal.title}${variant.name === 'Βασική εκδοχή' ? '' : ` · ${variant.name}`}`,
    macros: scaleMacros(variant as unknown as Macros, input.amount),
    detail: { mealCode: meal.code, mealTitle: meal.title, variantName: variant.name, ingredients },
    refId: meal.id,
    variantId: variant.id,
  };
}

export function targets(day = logicalDay()): Macros {
  const record = sqlite
    .prepare(
      'SELECT value FROM target_history WHERE effective_day <= ? ORDER BY effective_day DESC LIMIT 1',
    )
    .get(day) as { value: string } | undefined;
  return record ? (JSON.parse(record.value) as Macros) : defaults;
}
export function dayData(day: string) {
  const rows = sqlite
    .prepare('SELECT * FROM food_entries WHERE day = ? ORDER BY created_at, id')
    .all(day) as Array<Record<string, unknown>>;
  const items = rows.map((row) => ({
    ...row,
    snapshot: JSON.parse(row.snapshot as string),
    snapshot_detail: JSON.parse(row.snapshot_detail as string),
  }));
  const total = items.reduce((sum, item) => addMacros(sum, item.snapshot as Macros), zeroMacros());
  const target = targets(day);
  const percentages = Object.fromEntries(
    (Object.keys(total) as Array<keyof Macros>).map((key) => [
      key,
      Math.round((total[key] / target[key]) * 100),
    ]),
  );
  const sleep = sqlite.prepare('SELECT * FROM sleep_records WHERE day = ?').get(day) ?? null;
  const workouts = workoutsForDay(day);
  const checkin = sqlite.prepare('SELECT * FROM checkins WHERE day = ?').get(day) ?? null;
  const currentHash = createHash('sha256')
    .update(JSON.stringify({ items, sleep, workouts, targets: target }))
    .digest('hex');
  const checkinStale = !!checkin && (checkin as { input_hash: string }).input_hash !== currentHash;
  return {
    day,
    items,
    total,
    targets: target,
    percentages,
    sleep,
    workouts,
    checkin,
    checkinStale,
    currentHash,
  };
}

export function overviewData(end: string) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${end}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 6 + i);
    return dayData(date.toISOString().slice(0, 10));
  });
  return {
    days,
    measurements: all('SELECT * FROM measurements WHERE day <= ? ORDER BY day DESC LIMIT 12', end),
    workouts: days.flatMap((day) => day.workouts),
  };
}

export const listProducts = () => all('SELECT * FROM products ORDER BY active DESC, alias');
export function createProduct(p: ProductInput) {
  const id = randomUUID();
  const time = now();
  sqlite
    .prepare(
      'INSERT INTO products (id,alias,name,reference_amount,unit,protein,carbs,fat,kcal,salt,source,notes,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      id,
      p.alias,
      p.name,
      p.referenceAmount,
      p.unit,
      p.protein,
      p.carbs,
      p.fat,
      p.kcal,
      p.salt ?? null,
      p.source ?? null,
      p.notes ?? null,
      p.active === false ? 0 : 1,
      time,
      time,
    );
  return row('SELECT * FROM products WHERE id=?', id);
}
export const productById = (id: string) => row('SELECT * FROM products WHERE id=?', id);
export function updateProduct(id: string, p: ProductInput) {
  sqlite.transaction(() => {
    sqlite
      .prepare(
        'UPDATE products SET alias=?,name=?,reference_amount=?,unit=?,protein=?,carbs=?,fat=?,kcal=?,salt=?,source=?,notes=?,active=?,updated_at=? WHERE id=?',
      )
      .run(
        p.alias,
        p.name,
        p.referenceAmount,
        p.unit,
        p.protein,
        p.carbs,
        p.fat,
        p.kcal,
        p.salt ?? null,
        p.source ?? null,
        p.notes ?? null,
        p.active === false ? 0 : 1,
        now(),
        id,
      );
    recalculateProductVariants(id);
  })();
  return productById(id);
}

export const listMeals = () =>
  all('SELECT * FROM meals ORDER BY active DESC, code').map(presentMeal);
export const mealById = (id: string) => row('SELECT * FROM meals WHERE id=?', id);
export function createMeal(m: MealInput) {
  const id = randomUUID();
  const time = now();
  sqlite
    .prepare(
      'INSERT INTO meals (id,code,title,categories,ingredients_text,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
    )
    .run(
      id,
      m.code.toUpperCase(),
      cleanMealTitle(m.code, m.title),
      JSON.stringify(m.categories),
      m.ingredientsText,
      m.description ?? null,
      m.active === false ? 0 : 1,
      time,
      time,
    );
  return { ...presentMeal(mealById(id)!), id };
}
export function updateMeal(id: string, m: MealInput) {
  sqlite
    .prepare(
      'UPDATE meals SET code=?,title=?,categories=?,ingredients_text=?,description=?,active=?,updated_at=? WHERE id=?',
    )
    .run(
      m.code.toUpperCase(),
      cleanMealTitle(m.code, m.title),
      JSON.stringify(m.categories),
      m.ingredientsText,
      m.description ?? null,
      m.active === false ? 0 : 1,
      now(),
      id,
    );
  return presentMeal(mealById(id)!);
}
export const variantById = (id: string) => row('SELECT * FROM meal_variants WHERE id=?', id);
export function createVariant(mealId: string, v: VariantInput) {
  const macros = variantMacros(v);
  const id = randomUUID();
  const time = now();
  sqlite.transaction(() => {
    const count = Number(
      (row('SELECT COUNT(*) AS n FROM meal_variants WHERE meal_id=?', mealId) as { n: number }).n,
    );
    if (v.isDefault || !count)
      sqlite.prepare('UPDATE meal_variants SET is_default=0 WHERE meal_id=?').run(mealId);
    sqlite
      .prepare(
        'INSERT INTO meal_variants (id,meal_id,name,ingredients,macro_mode,protein,carbs,fat,kcal,is_default,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      )
      .run(
        id,
        mealId,
        v.name,
        JSON.stringify(v.ingredients),
        v.macroMode,
        macros.protein,
        macros.carbs,
        macros.fat,
        macros.kcal,
        v.isDefault || !count ? 1 : 0,
        v.active === false ? 0 : 1,
        time,
        time,
      );
  })();
  return variantById(id);
}
export function updateVariant(id: string, mealId: string, v: VariantInput) {
  const macros = variantMacros(v);
  sqlite.transaction(() => {
    if (v.isDefault)
      sqlite.prepare('UPDATE meal_variants SET is_default=0 WHERE meal_id=?').run(mealId);
    sqlite
      .prepare(
        'UPDATE meal_variants SET name=?,ingredients=?,macro_mode=?,protein=?,carbs=?,fat=?,kcal=?,is_default=?,active=?,updated_at=? WHERE id=?',
      )
      .run(
        v.name,
        JSON.stringify(v.ingredients),
        v.macroMode,
        macros.protein,
        macros.carbs,
        macros.fat,
        macros.kcal,
        v.isDefault ? 1 : 0,
        v.active === false ? 0 : 1,
        now(),
        id,
      );
  })();
  return variantById(id);
}

export function setTargets(value: Macros) {
  const effectiveDay = logicalDay();
  sqlite
    .prepare(
      'INSERT INTO target_history (effective_day,value,created_at) VALUES (?,?,?) ON CONFLICT(effective_day) DO UPDATE SET value=excluded.value,created_at=excluded.created_at',
    )
    .run(effectiveDay, JSON.stringify(value), now());
  return effectiveDay;
}
export const entryById = (id: string) => row('SELECT * FROM food_entries WHERE id=?', id);
export function createEntry(input: EntryInput) {
  const value = snapshot(input);
  const id = randomUUID();
  const time = now();
  sqlite
    .prepare(
      'INSERT INTO food_entries (id,day,kind,ref_id,variant_id,amount,label,snapshot,snapshot_detail,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      id,
      input.day,
      input.kind,
      value.refId,
      value.variantId,
      input.amount,
      value.label,
      JSON.stringify(value.macros),
      JSON.stringify(value.detail),
      input.notes ?? null,
      time,
      time,
    );
  return entryById(id);
}
export function updateEntry(
  id: string,
  input: EntryInput,
  previous: Record<string, unknown>,
  recalculate: boolean,
) {
  const value = recalculate
    ? snapshot(input)
    : {
        label: String(previous.label),
        macros: JSON.parse(String(previous.snapshot)) as Macros,
        detail: JSON.parse(String(previous.snapshot_detail)),
        refId: previous.ref_id,
        variantId: previous.variant_id,
      };
  sqlite
    .prepare(
      'UPDATE food_entries SET day=?,kind=?,ref_id=?,variant_id=?,amount=?,label=?,snapshot=?,snapshot_detail=?,notes=?,updated_at=? WHERE id=?',
    )
    .run(
      input.day,
      input.kind,
      value.refId,
      value.variantId,
      input.amount,
      value.label,
      JSON.stringify(value.macros),
      JSON.stringify(value.detail),
      input.notes ?? null,
      now(),
      id,
    );
  return entryById(id);
}
export function deleteEntry(id: string) {
  sqlite.prepare('DELETE FROM food_entries WHERE id=?').run(id);
}
export function upsertSleep(day: string, minutes: number, source: string) {
  sqlite
    .prepare(
      'INSERT INTO sleep_records (day,minutes,source,updated_at) VALUES (?,?,?,?) ON CONFLICT(day) DO UPDATE SET minutes=excluded.minutes,source=excluded.source,updated_at=excluded.updated_at',
    )
    .run(day, minutes, source, now());
  return row('SELECT * FROM sleep_records WHERE day=?', day);
}

export const listMeasurements = () =>
  all('SELECT * FROM measurements ORDER BY day DESC, created_at DESC LIMIT 100');
export const measurementById = (id: string) => row('SELECT * FROM measurements WHERE id=?', id);
export function createMeasurement(m: MeasurementInput) {
  const id = randomUUID();
  sqlite
    .prepare(
      'INSERT INTO measurements (id,day,weight_kg,waist_cm,fat_kg,muscle_kg,bone_kg,steps,source,notes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
    .run(
      id,
      m.day,
      m.weightKg ?? null,
      m.waistCm ?? null,
      m.fatKg ?? null,
      m.muscleKg ?? null,
      m.boneKg ?? null,
      m.steps ?? null,
      m.source,
      m.notes ?? null,
      now(),
    );
  return measurementById(id);
}
export function updateMeasurement(id: string, m: MeasurementInput) {
  sqlite
    .prepare(
      'UPDATE measurements SET day=?,weight_kg=?,waist_cm=?,fat_kg=?,muscle_kg=?,bone_kg=?,steps=?,source=?,notes=? WHERE id=?',
    )
    .run(
      m.day,
      m.weightKg ?? null,
      m.waistCm ?? null,
      m.fatKg ?? null,
      m.muscleKg ?? null,
      m.boneKg ?? null,
      m.steps ?? null,
      m.source,
      m.notes ?? null,
      id,
    );
  return measurementById(id);
}
export function deleteMeasurement(id: string) {
  sqlite.prepare('DELETE FROM measurements WHERE id=?').run(id);
}
export function upsertCheckin(day: string, text: string) {
  const hash = dayData(day).currentHash;
  sqlite
    .prepare(
      'INSERT INTO checkins (day,text,input_hash,created_at) VALUES (?,?,?,?) ON CONFLICT(day) DO UPDATE SET text=excluded.text,input_hash=excluded.input_hash,created_at=excluded.created_at',
    )
    .run(day, text, hash, now());
  return row('SELECT * FROM checkins WHERE day=?', day);
}

type SeedVariant = {
  name: string;
  description: string;
  protein: number;
  carbs: number;
  fat: number;
  kcal: number;
};
type LegacySeed = {
  products: Array<{
    alias: string;
    name: string;
    referenceAmount: number;
    unit: string;
    protein: number;
    carbs: number;
    fat: number;
    kcal: number;
    salt: number | null;
    notes: string;
    source: string | null;
  }>;
  meals: Array<{
    code: string;
    title: string;
    category: string;
    ingredientsText?: string;
    description: string;
    protein: number;
    carbs: number;
    fat: number;
    kcal: number;
    variants?: SeedVariant[];
  }>;
};
export function seedIfEmpty() {
  const path = resolve('seed/legacy.json');
  if (!existsSync(path)) return;
  const seed = JSON.parse(readFileSync(path, 'utf8')) as LegacySeed;
  const now = new Date().toISOString();
  sqlite.transaction(() => {
    if ((sqlite.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n === 0) {
      const insert = sqlite.prepare(
        'INSERT INTO products (id,alias,name,reference_amount,unit,protein,carbs,fat,kcal,salt,source,notes,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,?)',
      );
      for (const p of seed.products)
        insert.run(
          randomUUID(),
          p.alias,
          p.name,
          p.referenceAmount,
          p.unit,
          p.protein,
          p.carbs,
          p.fat,
          p.kcal,
          p.salt,
          p.source,
          p.notes,
          now,
          now,
        );
    }
    if ((sqlite.prepare('SELECT COUNT(*) AS n FROM meals').get() as { n: number }).n === 0) {
      const insertMeal = sqlite.prepare(
        'INSERT INTO meals (id,code,title,categories,ingredients_text,description,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)',
      );
      const insertVariant = sqlite.prepare(
        'INSERT INTO meal_variants (id,meal_id,name,ingredients,macro_mode,protein,carbs,fat,kcal,is_default,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)',
      );
      for (const m of seed.meals) {
        const id = randomUUID();
        const prefix = `${m.title}. `;
        const ingredientsText =
          m.ingredientsText ??
          (m.description.startsWith(prefix) ? m.description.slice(prefix.length) : m.description);
        insertMeal.run(
          id,
          m.code,
          m.title,
          JSON.stringify([m.category]),
          ingredientsText,
          m.description,
          now,
          now,
        );
        const options = m.variants?.length
          ? m.variants
          : [
              {
                name: 'Βασική εκδοχή',
                description: m.description,
                protein: m.protein,
                carbs: m.carbs,
                fat: m.fat,
                kcal: m.kcal,
              },
            ];
        options.forEach((v, index) =>
          insertVariant.run(
            randomUUID(),
            id,
            v.name,
            JSON.stringify([{ label: v.description }]),
            'manual',
            v.protein,
            v.carbs,
            v.fat,
            v.kcal,
            index === 0 ? 1 : 0,
            now,
            now,
          ),
        );
      }
    }
  })();
}
seedIfEmpty();
