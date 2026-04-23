import type { Metadata } from 'next';
import { AnalystReportsClient } from './client';
import { api } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Analist Raporları — Keşifler',
  description:
    'İş Yatırım, Yapı Kredi Yatırım, Ziraat Yatırım ve Garanti BBVA Yatırım\'ın güncel hisse tavsiyeleri ve hedef fiyat raporları.',
};

// ISR: 30 dakikada bir yenilenir (API cache ile uyumlu).
export const revalidate = 1800;

async function getBrokers() {
  try {
    return await api.brokerReports();
  } catch {
    return { items: [] };
  }
}

export default async function AnalystReportsPage() {
  const data = await getBrokers();
  return (
    <div className="container py-12">
      <div className="mb-8 max-w-3xl">
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Keşifler / Analist Raporları
        </div>
        <h1 className="display text-balance text-4xl leading-[1.05] md:text-6xl">
          Aracı Kurum <span className="display-italic text-brand-400">Tavsiyeleri</span>
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Türkiye'nin önde gelen aracı kurumlarının güncel model portföy ve analist hedef fiyat
          raporları — tek yerden. Fonoloji, her sabah kurumların resmi kaynaklarından en yeni
          raporu otomatik çeker ve burada yayınlar. Rapor içerikleri bilgi amaçlıdır.
        </p>
      </div>

      <AnalystReportsClient items={data.items} />
    </div>
  );
}
