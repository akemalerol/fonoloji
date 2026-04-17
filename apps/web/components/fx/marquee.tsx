import * as React from 'react';
import { cn } from '@/lib/utils';

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  reverse?: boolean;
  pauseOnHover?: boolean;
}

export function Marquee({ reverse, pauseOnHover, className, children, ...props }: MarqueeProps) {
  return (
    <div
      className={cn('group flex overflow-hidden', className)}
      {...props}
    >
      <div
        className={cn(
          'flex shrink-0 items-center gap-8 pr-8',
          reverse ? 'animate-marquee-reverse' : 'animate-marquee',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
      >
        {children}
      </div>
      <div
        aria-hidden
        className={cn(
          'flex shrink-0 items-center gap-8 pr-8',
          reverse ? 'animate-marquee-reverse' : 'animate-marquee',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
      >
        {children}
      </div>
    </div>
  );
}
