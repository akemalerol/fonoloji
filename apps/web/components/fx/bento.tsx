import * as React from 'react';
import { cn } from '@/lib/utils';

export function BentoGrid({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-[minmax(200px,auto)]', className)}>
      {children}
    </div>
  );
}

interface BentoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  colSpan?: 2 | 3 | 4 | 6;
  rowSpan?: 1 | 2;
}

export function BentoCard({ colSpan = 2, rowSpan = 1, className, children, ...props }: BentoCardProps) {
  const col = { 2: 'md:col-span-2', 3: 'md:col-span-3', 4: 'md:col-span-4', 6: 'md:col-span-6' }[colSpan];
  const row = { 1: 'md:row-span-1', 2: 'md:row-span-2' }[rowSpan];
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card/60 p-5 transition-colors hover:bg-card/90',
        col,
        row,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
