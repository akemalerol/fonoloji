'use client';

import { HelpCircle } from 'lucide-react';
import * as React from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface ExplainerProps {
  term: keyof typeof EXPLAINERS;
  children?: React.ReactNode;
  className?: string;
}

export const EXPLAINERS = {
  drawdown: {
    title: 'Drawdown nedir?',
    body: (
      <>
        <p>
          Fonun zirve fiyatından dip fiyata inişinin yüzdesel büyüklüğü.
          "En kötü düşüş" ölçüsü.
        </p>
        <p className="mt-2">
          <strong className="text-foreground">Örnek:</strong> Fon 100 TL'den 82 TL'ye düştüyse drawdown <span className="text-loss font-mono">-%18</span>.
        </p>
        <p className="mt-2 text-muted-foreground/80">
          Yüksek drawdown = geçmişte zor günler yaşamış. Yeniden olabilir.
        </p>
      </>
    ),
  },
  aum: {
    title: 'AUM — Yönetilen Varlık Büyüklüğü',
    body: (
      <>
        <p>
          <strong className="text-foreground">Assets Under Management</strong> — fonun cebinde tuttuğu toplam para.
        </p>
        <p className="mt-2">
          Fon fiyatı × tedavüldeki pay sayısı. Yatırımcı güveninin kaba ölçüsü.
        </p>
        <p className="mt-2 text-muted-foreground/80">
          Yüksek fon büyüklüğü = kurumsal güven ama yönetimi zor. Düşük fon büyüklüğü = çevik ama kapanma riski.
        </p>
      </>
    ),
  },
  sharpe: {
    title: 'Sharpe oranı',
    body: (
      <>
        <p>
          <strong className="text-foreground">Risk başına getiri</strong>. Formül:
          <span className="mt-1 block rounded bg-secondary/50 p-2 font-mono text-[11px]">
            (Yıllık getiri − Risksiz faiz) ÷ Volatilite
          </span>
        </p>
        <p className="mt-2">Dalgalanma başına fon ne kadar kazandırmış.</p>
        <ul className="mt-2 space-y-0.5 text-xs">
          <li><span className="text-gain font-semibold">&gt; 2:</span> Mükemmel</li>
          <li><span className="text-gain font-semibold">&gt; 1:</span> İyi</li>
          <li><span className="text-amber-400 font-semibold">0–1:</span> Vasat</li>
          <li><span className="text-loss font-semibold">&lt; 0:</span> Risksiz faizin altında kalmış</li>
        </ul>
      </>
    ),
  },
  sortino: {
    title: 'Sortino oranı',
    body: (
      <>
        <p>
          Sharpe'ın akıllı versiyonu. Sadece <strong className="text-loss">düşük yönlü</strong> volatiliteyi cezalandırır; yukarı dalgalanma (iyi şey) ceza görmez.
        </p>
        <p className="mt-2">
          Fon yukarı sıçrarken çok oynuyor ama aşağı inmiyorsa, Sortino Sharpe'tan yüksek olur.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">&gt; 1 iyi, &gt; 2 güçlü.</p>
      </>
    ),
  },
  calmar: {
    title: 'Calmar oranı',
    body: (
      <>
        <p>
          <span className="font-mono text-[11px]">Yıllık getiri ÷ Maks Drawdown</span>
        </p>
        <p className="mt-2">
          "Kazandığım her 1 birim için ne kadar acı çektim?" ölçüsü. Stres altında performans.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          &gt; 1 sağlam, &gt; 0.5 makul, &lt; 0.3 zayıf.
        </p>
      </>
    ),
  },
  beta: {
    title: 'Beta (BIST\'e göre)',
    body: (
      <>
        <p>Fon, BIST endeksine kıyasla ne kadar hareket ediyor?</p>
        <ul className="mt-2 space-y-0.5 text-xs">
          <li><strong className="text-foreground">β = 1:</strong> Piyasa ne kadar hareket ederse, fon da o kadar</li>
          <li><strong className="text-foreground">β &gt; 1:</strong> Piyasadan daha oynak (agresif)</li>
          <li><strong className="text-foreground">β &lt; 1:</strong> Piyasadan sakin</li>
          <li><strong className="text-foreground">β ≈ 0:</strong> BIST ile ilgisiz (tahvil, altın fonu gibi)</li>
          <li><strong className="text-foreground">β &lt; 0:</strong> Ters yönlü hareket</li>
        </ul>
      </>
    ),
  },
  real_return: {
    title: 'Reel getiri',
    body: (
      <>
        <p>
          Enflasyondan arındırılmış net getiri. Nominal getirinin TÜFE'yi ne kadar geçtiği.
        </p>
        <p className="mt-2 rounded bg-secondary/50 p-2 font-mono text-[11px]">
          (1 + Nominal) ÷ (1 + TÜFE) − 1
        </p>
        <p className="mt-2 text-muted-foreground/80">
          %50 getirdin, enflasyon %45 ise reel kazancın sadece yaklaşık %3.5. Gerçek satın alma gücü budur.
        </p>
      </>
    ),
  },
  volatility: {
    title: 'Volatilite',
    body: (
      <>
        <p>
          Fiyatın ortalamasından ne kadar saptığının yıllıklandırılmış standart sapması. Oynaklık.
        </p>
        <p className="mt-2">
          %10 volatilite = fiyat ortalamadan ±%10 dalgalanma aralığında.
        </p>
        <p className="mt-2 text-muted-foreground/80">
          Hisse fonlarında %20-40 normal, para piyasasında &lt;%5.
        </p>
      </>
    ),
  },
  risk_score: {
    title: 'TEFAS Risk Skoru (1-7)',
    body: (
      <>
        <p>
          TEFAS'ın her fon için belirlediği risk kategorisi. Avrupa UCITS standardı.
        </p>
        <ul className="mt-2 space-y-0.5 text-xs">
          <li><span className="font-mono text-emerald-400">1-2:</span> Düşük risk (para piyasası, kısa tahvil)</li>
          <li><span className="font-mono text-amber-400">3-4:</span> Orta risk (karma, uzun tahvil)</li>
          <li><span className="font-mono text-rose-400">5-7:</span> Yüksek risk (hisse, serbest, kaldıraçlı)</li>
        </ul>
      </>
    ),
  },
  sharpe_90: {
    title: 'Sharpe (90g)',
    body: (
      <>
        <p>
          <strong className="text-foreground">Risk başına getiri</strong>, son 90 günlük veriden hesaplanır.
        </p>
        <p className="mt-2">
          <span className="font-mono text-[11px]">(Yıllık getiri − Risksiz faiz) ÷ Volatilite</span>
        </p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          &gt;1 iyi, &gt;2 mükemmel, &lt;0 risksiz faizin altında.
        </p>
      </>
    ),
  },
  bench_alpha: {
    title: 'Kategori içi performans',
    body: (
      <>
        <p>
          Aynı kategorideki fonlar arasındaki konumlandırma. Fonun getirisinin kategori medyanına farkı = <strong className="text-foreground">alpha</strong>.
        </p>
        <p className="mt-2">
          <strong>Yüzdelik dilim:</strong> 100 en iyi, 50 ortalama, 0 en kötü.
        </p>
        <p className="mt-2 text-muted-foreground/80">
          Kategoriyi yeniyorsa yönetim ekibinin gerçek katkısı var demektir.
        </p>
      </>
    ),
  },
} as const;

export function Explainer({ term, children, className }: ExplainerProps) {
  const data = EXPLAINERS[term];
  if (!data) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-0.5 text-muted-foreground/70 transition-colors hover:text-foreground cursor-help',
            className,
          )}
          aria-label={`${data.title} açıklaması`}
        >
          {children}
          <HelpCircle className="ml-0.5 h-3 w-3 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" sideOffset={6}>
        <div className="mb-2 text-sm font-semibold text-foreground">{data.title}</div>
        <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
          {data.body}
        </div>
      </PopoverContent>
    </Popover>
  );
}
