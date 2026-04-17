import * as cheerio from 'cheerio';

export interface ChartPricePoint {
  date: string;
  price: number;
}

export function parseChartData(html: string): ChartPricePoint[] {
  if (!html) return [];

  const $ = cheerio.load(html);
  const scriptBlocks: string[] = [];
  $('script').each((_i, el) => {
    const text = $(el).html();
    if (text) scriptBlocks.push(text);
  });

  const candidate = scriptBlocks.find((s) => s.includes('FonFiyatGrafik') || s.includes('chartMainContent_PriceMain'));
  if (!candidate) return [];

  const tuplePoints = extractTuplePairs(candidate);
  if (tuplePoints.length > 0) return tuplePoints;

  return extractParallelArrays(candidate);
}

function extractTuplePairs(script: string): ChartPricePoint[] {
  const dataArrayStart = /data\s*:\s*\[/g;
  let match: RegExpExecArray | null;
  const points: ChartPricePoint[] = [];

  while ((match = dataArrayStart.exec(script)) !== null) {
    const startIdx = match.index + match[0].length;
    const arrayBody = readBalancedArray(script, startIdx - 1);
    if (!arrayBody) continue;

    const tupleRe = /\[\s*(\d{10,13})\s*,\s*(-?\d+(?:\.\d+)?)\s*\]/g;
    let tupleMatch: RegExpExecArray | null;
    while ((tupleMatch = tupleRe.exec(arrayBody)) !== null) {
      const ts = Number(tupleMatch[1]);
      const price = Number(tupleMatch[2]);
      if (Number.isFinite(ts) && Number.isFinite(price)) {
        points.push({ date: msToIsoDate(ts), price });
      }
    }
    if (points.length > 0) return dedupeByDate(points);
  }

  return points;
}

function extractParallelArrays(script: string): ChartPricePoint[] {
  const categoriesMatch = /categories\s*:\s*\[([^\]]*)\]/m.exec(script);
  const dataMatch = /data\s*:\s*\[([^\]]*?\d[^\]]*?)\]/m.exec(script);
  if (!categoriesMatch || !dataMatch) return [];

  const dates = parseStringArray(categoriesMatch[1] ?? '');
  const prices = parseNumberArray(dataMatch[1] ?? '');
  if (dates.length === 0 || dates.length !== prices.length) return [];

  const points: ChartPricePoint[] = [];
  for (let i = 0; i < dates.length; i++) {
    const iso = normalizeChartDate(dates[i]!);
    const price = prices[i]!;
    if (iso && Number.isFinite(price)) {
      points.push({ date: iso, price });
    }
  }
  return dedupeByDate(points);
}

function readBalancedArray(src: string, openBracketIdx: number): string | null {
  if (src[openBracketIdx] !== '[') return null;
  let depth = 0;
  for (let i = openBracketIdx; i < src.length; i++) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return src.slice(openBracketIdx + 1, i);
    }
  }
  return null;
}

function parseStringArray(body: string): string[] {
  const re = /'([^']+)'|"([^"]+)"/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    out.push((m[1] ?? m[2]) as string);
  }
  return out;
}

function parseNumberArray(body: string): number[] {
  return body
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function normalizeChartDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const ddmm = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(trimmed);
  if (ddmm) {
    const [, d, m, y] = ddmm;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }
  return null;
}

function msToIsoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const mo = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function dedupeByDate(points: ChartPricePoint[]): ChartPricePoint[] {
  const map = new Map<string, ChartPricePoint>();
  for (const p of points) map.set(p.date, p);
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}
