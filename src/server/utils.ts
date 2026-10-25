import { timingSafeEqual } from 'node:crypto';
import type { Macros } from './models.js';

export class InputError extends Error {}

export const now = () => new Date().toISOString();

export function logicalDay(when = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Athens',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(when)
      .map((part) => [part.type, part.value]),
  );
  const date = new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00Z`);
  if (Number(parts.hour) < 7) date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function constantEquals(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const zeroMacros = (): Macros => ({ protein: 0, carbs: 0, fat: 0, kcal: 0 });
export const round1 = (n: number) => Math.round(n * 10) / 10;
export function addMacros(a: Macros, b: Macros): Macros {
  return {
    protein: round1(a.protein + b.protein),
    carbs: round1(a.carbs + b.carbs),
    fat: round1(a.fat + b.fat),
    kcal: round1(a.kcal + b.kcal),
  };
}
export function scaleMacros(a: Macros, factor: number): Macros {
  return {
    protein: round1(a.protein * factor),
    carbs: round1(a.carbs * factor),
    fat: round1(a.fat * factor),
    kcal: round1(a.kcal * factor),
  };
}
