import { AlertTriangle } from 'lucide-react';

/**
 * Tiny persistent notice at top of every page. Legal compliance signal.
 * Shown above the header so it's impossible to miss.
 */
export function DisclaimerBanner() {
  return (
    <div className="relative z-50 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10">
      <div className="container flex items-center justify-center gap-2 py-1.5 text-center text-[11px] text-amber-200/90">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span>
          <strong className="font-semibold">Yatırım tavsiyesi değildir.</strong>{' '}
          Tüm rakamlar TEFAS'ın halka açık verisinden üretilmiştir; kararların sorumluluğu sana aittir.
        </span>
      </div>
    </div>
  );
}
