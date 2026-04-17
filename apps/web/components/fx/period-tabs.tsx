'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: '1w', label: '1H' },
  { value: '1m', label: '1A' },
  { value: '3m', label: '3A' },
  { value: '6m', label: '6A' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
  { value: 'all', label: 'Tümü' },
];

export function PeriodTabs({ paramKey = 'period', defaultValue = '1y' }: { paramKey?: string; defaultValue?: string }) {
  const sp = useSearchParams();
  const current = sp.get(paramKey) ?? defaultValue;
  return (
    <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-1">
      {PERIODS.map((p) => {
        const params = new URLSearchParams(sp);
        params.set(paramKey, p.value);
        return (
          <Link
            key={p.value}
            href={`?${params.toString()}`}
            className={cn(
              'rounded-md px-3 py-1 text-xs font-medium transition-colors',
              current === p.value ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
