import './env.js';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { z, ZodError } from 'zod';
import {
  dayData,
  targets,
  audit,
  overviewData,
  listProducts,
  createProduct,
  productById,
  updateProduct,
  listMeals,
  createMeal,
  mealById,
  updateMeal,
  createVariant,
  variantById,
  updateVariant,
  setTargets,
  entryById,
  createEntry,
  updateEntry,
  deleteEntry,
  upsertSleep,
  listMeasurements,
  measurementById,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
  upsertCheckin,
  importHevyWorkouts,
  recentWorkouts,
} from './db.js';
import { parseHevyCsv } from './hevy.js';
import {
  dateSchema,
  macrosSchema,
  productSchema,
  mealSchema,
  variantSchema,
  entrySchema,
  measurementSchema,
} from './models.js';
import { constantEquals, InputError, logicalDay } from './utils.js';

const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
const password = process.env.FITNESS_APP_PASSWORD ?? '';
const secret = process.env.FITNESS_SESSION_SECRET ?? '';
const agentToken = process.env.FITNESS_AGENT_TOKEN ?? '';
const invalidSettings = [
  ['FITNESS_APP_PASSWORD', password, 16],
  ['FITNESS_SESSION_SECRET', secret, 32],
  ['FITNESS_AGENT_TOKEN', agentToken, 32],
] as const;
const invalidNames = invalidSettings
  .filter(([, value, minimum]) => value.length < minimum)
  .map(([name, , minimum]) => `${name} (${minimum}+ characters)`);
if (invalidNames.length) throw new Error(`Missing or too short: ${invalidNames.join(', ')}`);
if (process.env.NODE_ENV === 'production' && !process.env.FITNESS_PUBLIC_ORIGIN)
  throw new Error('Set FITNESS_PUBLIC_ORIGIN for production');
await app.register(cookie);
app.addContentTypeParser('text/csv', { parseAs: 'string' }, (_request, body, done) => {
  done(null, body);
});

const sign = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
const session = () => {
  const expiry = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payload = String(expiry);
  return `${payload}.${sign(payload)}`;
};
const validSession = (raw?: string) => {
  if (!raw) return false;
  const [expiry, mac] = raw.split('.');
  return !!expiry && !!mac && Number(expiry) > Date.now() && constantEquals(mac, sign(expiry));
};
function actor(request: {
  headers: Record<string, unknown>;
  cookies: Record<string, string | undefined>;
}) {
  const auth = String(request.headers.authorization ?? '');
  if (auth.startsWith('Bearer ') && constantEquals(auth.slice(7), agentToken)) return 'agent';
  if (validSession(request.cookies.fitness_session)) return 'user';
  return null;
}
app.addHook('onRequest', async (request, reply) => {
  if (
    !request.url.startsWith('/api/') ||
    request.url === '/api/health' ||
    request.url === '/api/auth/login'
  )
    return;
  const who = actor(request);
  if (!who) {
    reply.code(401).send({ error: 'Unauthorized' });
    return;
  }
  (request as typeof request & { actor: string }).actor = who;
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.origin;
    const allowed = process.env.FITNESS_PUBLIC_ORIGIN;
    if (origin && allowed && origin !== allowed) {
      reply.code(403).send({ error: 'Origin rejected' });
      return;
    }
  }
});
app.setErrorHandler((error, _request, reply) => {
  if (error instanceof ZodError)
    return reply.code(400).send({ error: 'Invalid input', details: error.issues });
  if (error instanceof InputError) return reply.code(400).send({ error: error.message });
  if ((error as { code?: string }).code?.startsWith('SQLITE_CONSTRAINT'))
    return reply.code(409).send({ error: 'Duplicate code or alias, or item still in use' });
  app.log.error(error);
  return reply.code(500).send({ error: 'Internal server error' });
});
const getActor = (request: unknown) => (request as { actor?: string }).actor ?? 'user';
const queryDate = (input: unknown) => dateSchema.parse(input);

app.get('/api/health', async () => ({ ok: true }));
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
app.post('/api/auth/login', async (request, reply) => {
  const key = request.ip,
    previous = loginAttempts.get(key),
    time = Date.now();
  const attempt =
    previous && previous.resetAt > time ? previous : { count: 0, resetAt: time + 15 * 60 * 1000 };
  if (attempt.count >= 10) return reply.code(429).send({ error: 'Try again in 15 minutes' });
  const input = z.object({ password: z.string() }).parse(request.body);
  if (!constantEquals(input.password, password)) {
    attempt.count++;
    loginAttempts.set(key, attempt);
    return reply.code(401).send({ error: 'Wrong password' });
  }
  loginAttempts.delete(key);
  reply.setCookie('fitness_session', session(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return { ok: true };
});
app.post('/api/auth/logout', async (_request, reply) => {
  reply.clearCookie('fitness_session', { path: '/' });
  return { ok: true };
});
app.get('/api/auth/me', async (request) => ({ actor: getActor(request) }));

app.get('/api/products', async () => listProducts());
app.post('/api/products', async (request) => {
  const p = productSchema.parse(request.body);
  const result = createProduct(p)!;
  audit(getActor(request), 'product.create', String(result.id), p);
  return result;
});
app.patch('/api/products/:id', async (request) => {
  const id = String((request.params as { id: string }).id),
    previous = productById(id);
  if (!previous) return { error: 'Not found' };
  const p = productSchema.parse({
    ...previous,
    referenceAmount: previous.reference_amount,
    active: !!previous.active,
    ...(request.body as object),
  });
  const result = updateProduct(id, p);
  audit(getActor(request), 'product.update', id, p);
  return result;
});

app.get('/api/meals', async () => listMeals());
app.post('/api/meals', async (request) => {
  const m = mealSchema.parse(request.body);
  const result = createMeal(m);
  audit(getActor(request), 'meal.create', String(result.id), m);
  return result;
});
app.patch('/api/meals/:id', async (request) => {
  const id = String((request.params as { id: string }).id),
    previous = mealById(id);
  if (!previous) return { error: 'Not found' };
  const m = mealSchema.parse({
    ...previous,
    categories: JSON.parse(String(previous.categories)),
    ingredientsText: previous.ingredients_text,
    active: !!previous.active,
    ...(request.body as object),
  });
  const result = updateMeal(id, m);
  audit(getActor(request), 'meal.update', id, m);
  return result;
});
app.post('/api/meals/:id/variants', async (request) => {
  const mealId = String((request.params as { id: string }).id);
  if (!mealById(mealId)) return { error: 'Meal not found' };
  const v = variantSchema.parse(request.body);
  const result = createVariant(mealId, v)!;
  audit(getActor(request), 'variant.create', String(result.id), v);
  return result;
});
app.patch('/api/variants/:id', async (request) => {
  const id = String((request.params as { id: string }).id),
    previous = variantById(id);
  if (!previous) return { error: 'Not found' };
  const v = variantSchema.parse({
    name: previous.name,
    ingredients: JSON.parse(String(previous.ingredients)),
    macroMode: previous.macro_mode,
    macros: {
      protein: previous.protein,
      carbs: previous.carbs,
      fat: previous.fat,
      kcal: previous.kcal,
    },
    isDefault: !!previous.is_default,
    active: !!previous.active,
    ...(request.body as object),
  });
  const result = updateVariant(id, String(previous.meal_id), v);
  audit(getActor(request), 'variant.update', id, v);
  return result;
});

app.get('/api/settings/targets', async () => targets());
app.get('/api/settings/targets/current', async () => {
  const effectiveDay = logicalDay();
  return { effectiveDay, targets: targets(effectiveDay) };
});
app.put('/api/settings/targets', async (request) => {
  const value = macrosSchema
    .refine((m) => Object.values(m).every((n) => n > 0))
    .parse(request.body);
  const effectiveDay = setTargets(value);
  audit(getActor(request), 'targets.update', effectiveDay, value);
  return value;
});
app.get('/api/days/:day', async (request) =>
  dayData(queryDate((request.params as { day: string }).day)),
);
app.post('/api/entries', async (request) => {
  const input = entrySchema.parse(request.body);
  const result = createEntry(input)!;
  audit(getActor(request), 'entry.create', String(result.id), input);
  return result;
});
app.patch('/api/entries/:id', async (request) => {
  const id = String((request.params as { id: string }).id),
    previous = entryById(id);
  if (!previous) return { error: 'Not found' };
  const changes = request.body as Record<string, unknown>;
  const input = entrySchema.parse({
    day: previous.day,
    kind: previous.kind,
    refId: previous.ref_id ?? undefined,
    variantId: previous.variant_id ?? undefined,
    amount: previous.amount,
    label: previous.label,
    macros: JSON.parse(String(previous.snapshot)),
    notes: previous.notes,
    ...changes,
  });
  const recalculate = ['kind', 'refId', 'variantId', 'amount', 'macros', 'label'].some((key) =>
    Object.hasOwn(changes, key),
  );
  const result = updateEntry(id, input, previous, recalculate);
  audit(getActor(request), 'entry.update', id, input);
  return result;
});
app.delete('/api/entries/:id', async (request) => {
  const id = String((request.params as { id: string }).id);
  deleteEntry(id);
  audit(getActor(request), 'entry.delete', id, {});
  return { ok: true };
});
app.put('/api/days/:day/sleep', async (request) => {
  const day = queryDate((request.params as { day: string }).day),
    input = z
      .object({
        minutes: z.number().int().min(0).max(1440),
        source: z.enum(['manual', 'garmin']).default('manual'),
      })
      .parse(request.body);
  const result = upsertSleep(day, input.minutes, input.source);
  audit(getActor(request), 'sleep.upsert', day, input);
  return result;
});
app.get('/api/measurements', async () => listMeasurements());
app.post('/api/measurements', async (request) => {
  const m = measurementSchema.parse(request.body);
  const result = createMeasurement(m)!;
  audit(getActor(request), 'measurement.create', String(result.id), m);
  return result;
});
app.patch('/api/measurements/:id', async (request) => {
  const id = String((request.params as { id: string }).id),
    previous = measurementById(id);
  if (!previous) return { error: 'Not found' };
  const input = request.body as Record<string, unknown>;
  const m = measurementSchema.parse({
    day: previous.day,
    weightKg: previous.weight_kg,
    waistCm: previous.waist_cm,
    fatKg: previous.fat_kg,
    muscleKg: previous.muscle_kg,
    boneKg: previous.bone_kg,
    steps: previous.steps,
    source: previous.source,
    notes: previous.notes,
    ...input,
  });
  const result = updateMeasurement(id, m);
  audit(getActor(request), 'measurement.update', id, m);
  return result;
});
app.delete('/api/measurements/:id', async (request) => {
  const id = String((request.params as { id: string }).id);
  deleteMeasurement(id);
  audit(getActor(request), 'measurement.delete', id, {});
  return { ok: true };
});
app.get('/api/hevy/workouts', async (request) => {
  const end = queryDate((request.query as { end?: string }).end ?? logicalDay());
  return recentWorkouts(end);
});
app.post('/api/hevy/import', { bodyLimit: 5 * 1024 * 1024 }, async (request) => {
  if (typeof request.body !== 'string') throw new InputError('Upload a Hevy CSV file');
  const workouts = parseHevyCsv(request.body);
  const result = importHevyWorkouts(workouts);
  audit(getActor(request), 'hevy.import', 'csv', result);
  return result;
});
app.get('/api/overview', async (request) => {
  const end = queryDate(
    (request.query as { end?: string }).end ?? new Date().toISOString().slice(0, 10),
  );
  return overviewData(end);
});
app.get('/api/agent/context', async (request, reply) => {
  if (getActor(request) !== 'agent') return reply.code(403).send({ error: 'Agent token required' });
  const day = queryDate(
    (request.query as { day?: string }).day ?? new Date().toISOString().slice(0, 10),
  );
  return { day: dayData(day), recent: overviewData(day) };
});
app.put('/api/agent/checkins/:day', async (request, reply) => {
  if (getActor(request) !== 'agent') return reply.code(403).send({ error: 'Agent token required' });
  const day = queryDate((request.params as { day: string }).day),
    input = z.object({ text: z.string().trim().min(1).max(10000) }).parse(request.body);
  const result = upsertCheckin(day, input.text);
  audit('agent', 'checkin.upsert', day, input);
  return result;
});

const webRoot = resolve('dist/web');
if (existsSync(webRoot)) {
  const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
  };
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/') || !['GET', 'HEAD'].includes(request.method))
      return reply.code(404).send({ error: 'Not found' });
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      return reply.code(400).send({ error: 'Bad path' });
    }
    const candidate = resolve(webRoot, `.${pathname}`);
    const isAsset =
      candidate.startsWith(webRoot + sep) && existsSync(candidate) && statSync(candidate).isFile();
    if (!isAsset && extname(pathname)) return reply.code(404).send({ error: 'Not found' });
    const file = isAsset ? candidate : resolve(webRoot, 'index.html');
    const ext = extname(file);
    reply.type(types[ext] ?? 'application/octet-stream');
    reply.header(
      'Cache-Control',
      file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    return reply.send(readFileSync(file));
  });
}
await app.listen({ host: process.env.HOST ?? '0.0.0.0', port: Number(process.env.PORT ?? 3000) });
