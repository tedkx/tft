import { z } from 'zod';

export type Macros = { protein: number; carbs: number; fat: number; kcal: number };

export const dateSchema = z.iso.date();
const nonNegative = z.number().finite().min(0);
export const macrosSchema = z.object({
  protein: nonNegative,
  carbs: nonNegative,
  fat: nonNegative,
  kcal: nonNegative,
});
export const productSchema = z.object({
  alias: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(200),
  referenceAmount: z.number().finite().positive(),
  unit: z.enum(['g', 'ml', 'serving']),
  protein: nonNegative,
  carbs: nonNegative,
  fat: nonNegative,
  kcal: nonNegative,
  salt: nonNegative.nullable().optional(),
  source: z.url().nullable().optional(),
  notes: z.string().max(3000).nullable().optional(),
  active: z.boolean().optional(),
});
export const mealSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[BLSD]\d{1,3}$/i),
  title: z.string().trim().min(1).max(200),
  category: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
  description: z.string().max(5000).nullable().optional(),
  active: z.boolean().optional(),
});
const ingredientSchema = z.object({
  productId: z.string().uuid(),
  amount: z.number().finite().positive(),
});
export const variantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  ingredients: z.array(ingredientSchema).default([]),
  macroMode: z.enum(['manual', 'computed']),
  macros: macrosSchema.optional(),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
});
export const entrySchema = z.object({
  day: dateSchema,
  kind: z.enum(['meal', 'product', 'custom']),
  refId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  amount: z.number().finite().positive().default(1),
  label: z.string().trim().min(1).max(200).optional(),
  macros: macrosSchema.optional(),
  notes: z.string().max(3000).nullable().optional(),
});
export const measurementSchema = z.object({
  day: dateSchema,
  weightKg: nonNegative.nullable().optional(),
  waistCm: nonNegative.nullable().optional(),
  fatKg: nonNegative.nullable().optional(),
  muscleKg: nonNegative.nullable().optional(),
  boneKg: nonNegative.nullable().optional(),
  steps: z.number().int().min(0).nullable().optional(),
  source: z.enum(['manual', 'withings', 'garmin']).default('manual'),
  notes: z.string().max(3000).nullable().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;
export type MealInput = z.infer<typeof mealSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type EntryInput = z.infer<typeof entrySchema>;
export type MeasurementInput = z.infer<typeof measurementSchema>;
