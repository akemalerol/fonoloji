import { BacktestClient } from './client';

export const metadata = {
  title: 'Portföy geri-testi — Fonoloji',
  description:
    '2-10 fonlu bir portföyü geçmiş fiyatlara karşı test et. Yıllık getiri, Sharpe, max drawdown ve rebalancing etkisi. Yatırım tavsiyesi değildir.',
};

export default function BacktestPage() { return <BacktestClient />; }
