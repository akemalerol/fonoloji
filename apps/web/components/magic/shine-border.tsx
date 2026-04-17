'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: string | string[];
  className?: string;
  children: React.ReactNode;
}

export function ShineBorder({
  borderRadius = 16,
  borderWidth = 1,
  duration = 14,
  color = ['#F59E0B', '#22D3EE', '#F59E0B'],
  className,
  children,
}: ShineBorderProps) {
  return (
    <div
      style={
        {
          '--border-radius': `${borderRadius}px`,
          '--border-width': `${borderWidth}px`,
          '--duration': `${duration}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${Array.isArray(color) ? color.join(',') : color}, transparent, transparent)`,
          backgroundSize: '300% 300%',
          backgroundPosition: '0 0',
          padding: 'var(--border-width)',
          borderRadius: 'var(--border-radius)',
        } as React.CSSProperties
      }
      className={cn('relative animate-shine overflow-hidden', className)}
    >
      <div
        className="relative"
        style={{
          background: 'hsl(var(--card))',
          borderRadius: `calc(var(--border-radius) - var(--border-width))`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
