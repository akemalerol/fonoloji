import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySchema } from './schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DB_PATH =
  process.env.FONOLOJI_DB_PATH ?? `${__dirname}/../../../../tefas.db`;

let instance: Database.Database | null = null;

/**
 * Fold Turkish + diacritic characters to ASCII lowercase so searches like
 * "is portfoy" match "İŞ PORTFÖY" etc. Registered as a SQLite user function.
 */
function asciiFold(s: string | null): string {
  if (!s) return '';
  return s
    .toLocaleLowerCase('tr-TR')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // combining diacritics
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
}

export function getDb(path: string = DEFAULT_DB_PATH): Database.Database {
  if (instance) return instance;
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  instance = new Database(path);
  applySchema(instance);
  // Register Turkish-friendly search helper
  instance.function('ascii_fold', { deterministic: true }, (s: unknown) =>
    asciiFold(typeof s === 'string' ? s : null),
  );
  return instance;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
