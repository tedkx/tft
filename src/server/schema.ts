import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  alias: text('alias').notNull().unique(),
  name: text('name').notNull(),
  referenceAmount: real('reference_amount').notNull(),
  unit: text('unit').notNull(),
  protein: real('protein').notNull(),
  carbs: real('carbs').notNull(),
  fat: real('fat').notNull(),
  kcal: real('kcal').notNull(),
  salt: real('salt'),
  source: text('source'),
  notes: text('notes'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const meals = sqliteTable('meals', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  categories: text('categories').notNull().default('[]'),
  ingredientsText: text('ingredients_text').notNull().default(''),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const variants = sqliteTable('meal_variants', {
  id: text('id').primaryKey(),
  mealId: text('meal_id')
    .notNull()
    .references(() => meals.id),
  name: text('name').notNull(),
  ingredients: text('ingredients').notNull().default('[]'),
  macroMode: text('macro_mode').notNull().default('manual'),
  protein: real('protein').notNull(),
  carbs: real('carbs').notNull(),
  fat: real('fat').notNull(),
  kcal: real('kcal').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const entries = sqliteTable('food_entries', {
  id: text('id').primaryKey(),
  day: text('day').notNull(),
  kind: text('kind').notNull(),
  refId: text('ref_id'),
  variantId: text('variant_id'),
  amount: real('amount').notNull(),
  label: text('label').notNull(),
  snapshot: text('snapshot').notNull(),
  snapshotDetail: text('snapshot_detail').notNull().default('{}'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const sleeps = sqliteTable('sleep_records', {
  day: text('day').primaryKey(),
  minutes: integer('minutes').notNull(),
  source: text('source').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const measurements = sqliteTable('measurements', {
  id: text('id').primaryKey(),
  day: text('day').notNull(),
  weightKg: real('weight_kg'),
  waistCm: real('waist_cm'),
  fatKg: real('fat_kg'),
  muscleKg: real('muscle_kg'),
  boneKg: real('bone_kg'),
  steps: integer('steps'),
  source: text('source').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});
export const checkins = sqliteTable('checkins', {
  day: text('day').primaryKey(),
  text: text('text').notNull(),
  inputHash: text('input_hash').notNull(),
  createdAt: text('created_at').notNull(),
});
export const targetHistory = sqliteTable('target_history', {
  effectiveDay: text('effective_day').primaryKey(),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull(),
});
