import * as React from 'react';
import { cn } from '@/lib/utils';

export function AnimatedGradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex animate-gradient-x bg-gradient-to-r from-brand-400 via-verdigris-300 to-brand-400 bg-[length:200%_auto] bg-clip-text text-transparent',
        className,
      )}
    >
      {children}
    </span>
  );
}
