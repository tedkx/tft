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
  categories: Array<'breakfast' | 'lunch' | 'snack' | 'dinner'>;
  ingredients_text: string;
  description: string;
  active: number;
  variants: Variant[];
};
export type Entry = {
  id: string;
  day: string;
  kind: 'meal' | 'product' | 'custom' | 'freetext';
  ref_id: string | null;
  variant_id: string | null;
  label: string;
  amount: number;
  snapshot: Macros;
  snapshot_detail?: { unit?: string; assumptions?: string; description?: string };
  macro_status: 'pending' | 'ready';
  macro_source: 'manual' | 'agent' | null;
  promoted_meal_id: string | null;
  updated_at: string;
  revision: number;
  notes: string | null;
};
export type HevySet = {
  id: number;
  position: number;
  exercise_title: string;
  set_index: number;
  set_type: string;
  weight_kg: number | null;
  reps: number | null;
  distance_km: number | null;
  duration_seconds: number | null;
  rpe: number | null;
};
export type HevyWorkout = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  day: string;
  description: string;
  sets: HevySet[];
};
export type Day = {
  day: string;
  items: Entry[];
  pendingCount: number;
  total: Macros;
  targets: Macros;
  percentages: Macros;
  sleep: { minutes: number; source: string } | null;
  workouts: HevyWorkout[];
  checkin: { text: string; input_hash: string } | null;
  checkinStale: boolean;
};
export type Overview = {
  days: Day[];
  measurements: Array<Record<string, unknown>>;
  workouts: HevyWorkout[];
};
export type TargetPlan = { effectiveDay: string; targets: Macros };
export type Page = 'today' | 'overview' | 'settings-library' | 'settings-targets';
