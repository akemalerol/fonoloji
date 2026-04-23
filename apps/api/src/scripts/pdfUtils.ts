/**
 * PDF yardımcıları — pdftotext (poppler-utils) etrafında ince sarmalayıcı.
 *
 * Prod'da `apt install poppler-utils` ile /usr/bin/pdftotext kurulu olmalı.
 * Lokal geliştirmede: macOS → `brew install poppler`.
 */

import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

/** Bir PDF URL'sinden buffer indir. 30sn timeout. */
export async function downloadPdf(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/pdf, */*',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`PDF indirme ${res.status}: ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    // Magic number kontrolü — "%PDF"
    if (buf.length < 4 || buf.subarray(0, 4).toString() !== '%PDF') {
      throw new Error(`İçerik PDF değil (magic bytes: ${buf.subarray(0, 8).toString('hex')}): ${url}`);
    }
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

/** PDF buffer'ını pdftotext -layout ile text'e çevirir. */
export async function pdfToText(buf: Buffer, options?: { firstPage?: number; lastPage?: number }): Promise<string> {
  const tmpDir = join(tmpdir(), `fonoloji-pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(tmpDir, { recursive: true });
  const pdfPath = join(tmpDir, 'in.pdf');
  writeFileSync(pdfPath, buf);
  try {
    const args = ['-layout'];
    if (options?.firstPage) args.push('-f', String(options.firstPage));
    if (options?.lastPage) args.push('-l', String(options.lastPage));
    args.push(pdfPath, '-'); // stdout'a yaz
    const { stdout } = await execFileAsync('pdftotext', args, {
      maxBuffer: 50 * 1024 * 1024, // 50MB — büyük PDF'ler için
      timeout: 30_000,
    });
    return stdout;
  } finally {
    if (existsSync(pdfPath)) unlinkSync(pdfPath);
  }
}

/** Türkçe sayıyı normalize et: "58,35" → 58.35, "1.234,56" → 1234.56, "394.160" → 394160 */
export function parseTurkishNumber(s: string | null | undefined): number | null {
  if (s === null || s === undefined) return null;
  const trimmed = String(s).trim();
  if (!trimmed || trimmed === '-') return null;
  // "TL", "mn" gibi suffixleri at
  const cleaned = trimmed.replace(/[^\d.,+\-]/g, '');
  if (!cleaned) return null;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let norm: string;
  if (hasComma && hasDot) {
    // "1.234,56" → "1234.56" (TR format: . = binlik, , = ondalık)
    norm = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    // "58,35" → "58.35"
    norm = cleaned.replace(',', '.');
  } else if (hasDot) {
    // Nokta var ama virgül yok — binlik olabilir ("394.160") veya ondalık ("58.35")
    // Heuristic: nokta sonrası tam 3 rakam varsa binlik say
    const parts = cleaned.split('.');
    const last = parts[parts.length - 1]!;
    if (parts.length === 2 && last.length === 3 && cleaned.length >= 5) {
      norm = cleaned.replace(/\./g, '');
    } else {
      norm = cleaned;
    }
  } else {
    norm = cleaned;
  }
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

/** "18.03.2026" veya "9.07.2024" → "2026-03-18" / "2024-07-09" */
export function parseTurkishDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(s);
  if (!m) return null;
  return `${m[3]}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
