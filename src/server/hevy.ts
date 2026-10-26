import { parse } from 'csv-parse/sync';
import { InputError } from './utils.js';

const headers = [
  'title',
  'start_time',
  'end_time',
  'description',
  'exercise_title',
  'superset_id',
  'exercise_notes',
  'set_index',
  'set_type',
  'weight_kg',
  'reps',
  'distance_km',
  'duration_seconds',
  'rpe',
] as const;

const months: Record<string, number> = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

export type HevySet = {
  exerciseTitle: string;
  supersetId: string | null;
  exerciseNotes: string;
  setIndex: number;
  setType: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSeconds: number | null;
  rpe: number | null;
};

export type HevyWorkout = {
  title: string;
  startTime: string;
  endTime: string;
  day: string;
  description: string;
  sets: HevySet[];
};

function timestamp(value: string, line: number): string {
  const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4}), (\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new InputError(`Invalid Hevy date on row ${line}`);
  const month = months[match[2]];
  const day = Number(match[1]);
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    !month ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute
  )
    throw new InputError(`Invalid Hevy date on row ${line}`);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${match[4]}:${match[5]}`;
}

function optionalNumber(value: string, name: string, line: number): number | null {
  if (value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new InputError(`Invalid ${name} on row ${line}`);
  return number;
}

export function parseHevyCsv(csv: string): HevyWorkout[] {
  if (!csv.trim()) throw new InputError('The Hevy CSV is empty');
  let records: Array<Record<string, string>>;
  try {
    records = parse(csv, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      max_record_size: 64 * 1024,
      columns: (found: string[]) => {
        if (
          new Set(found).size !== found.length ||
          headers.some((header) => !found.includes(header))
        )
          throw new InputError('The file does not have the expected Hevy CSV columns');
        return found;
      },
    });
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError('Could not read the Hevy CSV');
  }
  if (!records.length) throw new InputError('The Hevy CSV has no sets');
  if (records.length > 10000) throw new InputError('The Hevy CSV has too many sets');

  const workouts = new Map<string, HevyWorkout>();
  records.forEach((record, index) => {
    const line = index + 2;
    const title = record.title?.trim();
    const exerciseTitle = record.exercise_title?.trim();
    const setType = record.set_type?.trim();
    if (!title || !exerciseTitle || !setType)
      throw new InputError(`Missing workout or exercise on row ${line}`);
    const startTime = timestamp(record.start_time, line);
    const endTime = timestamp(record.end_time, line);
    if (endTime < startTime) throw new InputError(`End before start on row ${line}`);
    const setIndex = optionalNumber(record.set_index, 'set_index', line);
    if (setIndex === null || !Number.isInteger(setIndex) || setIndex < 0)
      throw new InputError(`Invalid set_index on row ${line}`);
    const reps = optionalNumber(record.reps, 'reps', line);
    const durationSeconds = optionalNumber(record.duration_seconds, 'duration_seconds', line);
    if (
      (reps !== null && (!Number.isInteger(reps) || reps < 0)) ||
      (durationSeconds !== null && durationSeconds < 0)
    )
      throw new InputError(`Invalid set values on row ${line}`);
    const set: HevySet = {
      exerciseTitle,
      supersetId: record.superset_id || null,
      exerciseNotes: record.exercise_notes ?? '',
      setIndex,
      setType,
      weightKg: optionalNumber(record.weight_kg, 'weight_kg', line),
      reps,
      distanceKm: optionalNumber(record.distance_km, 'distance_km', line),
      durationSeconds,
      rpe: optionalNumber(record.rpe, 'rpe', line),
    };
    const existing = workouts.get(startTime);
    if (existing) {
      if (
        existing.title !== title ||
        existing.endTime !== endTime ||
        existing.description !== record.description
      )
        throw new InputError(`Conflicting workouts with the same start time on row ${line}`);
      existing.sets.push(set);
    } else {
      workouts.set(startTime, {
        title,
        startTime,
        endTime,
        day: startTime.slice(0, 10),
        description: record.description ?? '',
        sets: [set],
      });
    }
  });
  return [...workouts.values()];
}
