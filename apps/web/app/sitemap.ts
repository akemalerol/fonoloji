import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';

const BASE = 'https://fonoloji.com';

const STATIC_PAGES = [
  '/',
  '/fonlar',
  '/kesifler',
  '/kesifler/risk-getiri',
  '/kesifler/korelasyon',
  '/kesifler/isi-haritasi',
  '/kesifler/para-akisi',
  '/kesifler/trend',
  '/kesifler/reel-getiri',
  '/kesifler/risk-skoru',
  '/karsilastir',
  '/ekonomi',
  '/hesapla',
  '/yonetici',
  '/api-docs',
  '/iletisim',
  '/haftalik',
  '/hakkinda',
  '/alarmlarim',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries = STATIC_PAGES.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
  }));

  try {
    const { items } = await api.listFunds({ limit: 1000 });
    const fundEntries = items.map((f) => ({
      url: `${BASE}/fon/${f.code}`,
      lastModified: now,
    }));
    const categories = Array.from(new Set(items.map((f) => f.category).filter(Boolean))) as string[];
    const categoryEntries = categories.map((c) => ({
      url: `${BASE}/kategori/${encodeURIComponent(c)}`,
      lastModified: now,
    }));
    return [...staticEntries, ...fundEntries, ...categoryEntries];
  } catch {
    return staticEntries;
  }
}
