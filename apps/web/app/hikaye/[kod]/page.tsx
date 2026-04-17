import { notFound } from 'next/navigation';
import { api } from '@/lib/api';
import { StoryClient } from './client';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { kod: string } }) {
  try {
    const detail = await api.getFund(params.kod.toUpperCase());
    return {
      title: `${detail.fund.code} hikayesi — Fonoloji`,
      description: `${detail.fund.name} fonunun görsel hikayesi. Yatırım tavsiyesi değildir.`,
    };
  } catch {
    return { title: params.kod };
  }
}

export default async function StoryPage({ params }: { params: { kod: string } }) {
  const code = params.kod.toUpperCase();
  let detail;
  try {
    detail = await api.getFund(code);
  } catch {
    notFound();
  }

  const [history, advanced, aiSummary] = await Promise.all([
    api.getHistory(code, 'all').catch(() => ({ code, period: 'all', points: [] })),
    api.advanced(code).catch(() => ({ code, stress_periods: [], seasonality: [], leakage: null, bench_alpha: { '3m': null, '1y': null } })),
    api.aiSummary(code).catch(() => ({ code, summary: null as string | null, cached: false, model: undefined as string | undefined })),
  ]);

  return (
    <StoryClient
      fund={detail.fund}
      history={history.points}
      advanced={advanced}
      aiSummary={aiSummary.summary}
    />
  );
}
