'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Meteors({ number = 20, className }: { number?: number; className?: string }) {
  const [meteorStyles, setMeteorStyles] = React.useState<Array<{ top: string; left: string; delay: string; duration: string }>>([]);

  React.useEffect(() => {
    const styles = Array.from({ length: number }, () => ({
      top: '-5px',
      left: `${Math.floor(Math.random() * 100)}%`,
      delay: `${Math.random() * 0.6 + 0.2}s`,
      duration: `${Math.floor(Math.random() * 8 + 4)}s`,
    }));
    setMeteorStyles(styles);
  }, [number]);

  return (
    <>
      {meteorStyles.map((style, i) => (
        <span
          key={i}
          className={cn(
            'pointer-events-none absolute h-0.5 w-0.5 rotate-[215deg] animate-meteor rounded-full bg-slate-200 shadow-[0_0_0_1px_#ffffff10]',
            className,
          )}
          style={{
            top: style.top,
            left: style.left,
            animationDelay: style.delay,
            animationDuration: style.duration,
          }}
        >
          <div className="pointer-events-none absolute top-1/2 -z-10 h-px w-[50px] -translate-y-1/2 bg-gradient-to-r from-slate-200 to-transparent" />
        </span>
      ))}
    </>
  );
}
