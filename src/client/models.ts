export type Macros = { protein: number; carbs: number; fat: number; kcal: number };
export type Product = Macros & {
  id: string;
  alias: string;
  name: string;
  reference_amount: number;
  unit: string;
  salt: number | null;
  source: string | null;
  notes: string | null;
  active: number;
};
export type Ingredient = { productId: string; amount: number };
export type Variant = Macros & {
  id: string;
  meal_id: string;
  name: string;
  ingredients: Ingredient[] | Array<{ label: string }>;
  macro_mode: 'manual' | 'computed';
  is_default: number;
  active: number;
};
export type Meal = {
  id: string;
  code: string;
  title: string;
  category: string;
  description: string;
  active: number;
  variants: Variant[];
};
export type Entry = {
  id: string;
  day: string;
  kind: string;
  ref_id: string | null;
  variant_id: string | null;
  label: string;
  amount: number;
  snapshot: Macros;
  snapshot_detail?: { unit?: string };
  notes: string | null;
};
export type Day = {
  day: string;
  items: Entry[];
  total: Macros;
  targets: Macros;
  percentages: Macros;
  sleep: { minutes: number; source: string } | null;
  checkin: { text: string; input_hash: string } | null;
  checkinStale: boolean;
};
export type Overview = { days: Day[]; measurements: Array<Record<string, unknown>> };
export type TargetPlan = { effectiveDay: string; targets: Macros };
export type Page = 'today' | 'overview' | 'settings-library' | 'settings-targets';
