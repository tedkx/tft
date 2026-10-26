import type { Macros } from './models.js';

export const categories: Record<string, string> = {
  breakfast: 'Πρωινό',
  lunch: 'Μεσημεριανό',
  snack: 'Σνακ',
  dinner: 'Βραδινό',
};
export const keys: (keyof Macros)[] = ['protein', 'carbs', 'fat', 'kcal'];
export const labels: Record<keyof Macros, string> = {
  protein: 'Πρωτεΐνη',
  carbs: 'Υδατάνθρακες',
  fat: 'Λιπαρά',
  kcal: 'Θερμίδες',
};
export const initialMacros: Macros = { protein: 0, carbs: 0, fat: 0, kcal: 0 };
export const macroColors: Record<keyof Macros, string> = {
  protein: 'var(--color-protein)',
  carbs: 'var(--color-carbs)',
  fat: 'var(--color-fat)',
  kcal: 'var(--color-kcal)',
};
