'use client';

import { ArrowDownRight, ArrowUpRight, Trophy } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from './animated-number';

interface MoverRowProps {
  code: string;
  name: string;
  category?: string | null;
  change: number;
  rank: number;
  maxAbsChange: number;
  negative?: boolean;
}

/**
 * Rich, visual mover row used on the homepage.
 *
 * Visual language:
 * - Rank badge (#01 gradient for top, muted for rest)
 * - Fund code chip with gradient fill
 * - Fund name + category under it (two-line stack)
 * - Magnitude bar: width is |change| / maxAbsChange of the list → shows how the
 *   fund compares to its peers within this top-N card.
 * - Animated percentage on the right with directional arrow.
 */
export function MoverRow({ code, name, category, change, rank, maxAbsChange, negative }: MoverRowProps) {
  const abs = Math.abs(change);
  const barPct = maxAbsChange > 0 ? (abs / maxAbsChange) * 100 : 0;
  const isTop = rank === 1;

  return (
    <Link
      href={`/fon/${code}`}
      className={cn(
        'group relative block overflow-hidden rounded-xl border border-transparent px-3 py-3 transition-all',
        'hover:border-border hover:bg-background/40',
      )}
    >
      {/* Magnitude bar — absolutely positioned behind content */}
      <div
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 -z-10 transition-all duration-700',
          negative
            ? 'bg-gradient-to-r from-loss/15 via-loss/5 to-transparent'
            : 'bg-gradient-to-r from-gain/15 via-gain/5 to-transparent',
        )}
        style={{ width: `${Math.max(8, barPct)}%` }}
      />

      <div className="relative flex items-center gap-3">
        {/* Rank */}
        <div className="w-7 shrink-0 text-center">
          {isTop ? (
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-verdigris-400 shadow-lg shadow-brand-500/30">
              <Trophy className="h-3.5 w-3.5 text-background" />
            </div>
          ) : (
            <span className="serif text-xs text-muted-foreground/70">{String(rank).padStart(2, '0')}</span>
          )}
        </div>

        {/* Code badge */}
        <div
          className={cn(
            'inline-flex h-8 w-14 shrink-0 items-center justify-center rounded-md font-mono text-[11px] font-bold transition-transform group-hover:scale-105',
            negative
              ? 'bg-loss/15 text-loss ring-1 ring-loss/30'
              : 'bg-gradient-to-br from-brand-500/20 to-verdigris-400/20 text-foreground ring-1 ring-brand-500/30',
          )}
        >
          {code}
        </div>

        {/* Fund name + category */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground/90 group-hover:text-foreground">
            {name}
          </div>
          {category && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground/70">{category}</div>
          )}
        </div>

        {/* Animated % with direction arrow */}
        <div
          className={cn(
            'flex shrink-0 items-center gap-1 font-mono tabular-nums',
            negative ? 'text-loss' : 'text-gain',
          )}
        >
          {negative ? (
            <ArrowDownRight className="h-4 w-4" />
          ) : (
            <ArrowUpRight className="h-4 w-4" />
          )}
          <span className="text-base font-semibold">
            %<AnimatedNumber value={abs * 100} format={(n) => n.toFixed(2)} duration={0.9} />
          </span>
        </div>
      </div>
    </Link>
  );
}
