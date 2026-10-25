import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Docker Compose injects these variables; local npm commands read the project .env.
const envPath = resolve('.env');
if (existsSync(envPath)) process.loadEnvFile(envPath);
