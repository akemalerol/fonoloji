import { Calculator } from 'lucide-react';
import { CalculatorClient } from './client';

export const metadata = { title: 'Yatırım Hesaplayıcı' };

export default function CalculatorPage() {
  return (
    <div className="container py-10">
      <div className="mb-8 border-b border-border/50 pb-6">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          <Calculator className="h-3 w-3 text-brand-400" />
          araç
        </div>
        <h1 className="display mt-2 text-5xl leading-none md:text-6xl">
          Yatırım <span className="display-italic text-brand-400">hesaplayıcı</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Belirli bir tarihte belirli bir tutarla bir fonu satın alsaydın bugün ne olurdu?
          Geriye dönük gerçek fiyat verisi üzerinden net hesap.
        </p>
      </div>
      <CalculatorClient />
    </div>
  );
}
