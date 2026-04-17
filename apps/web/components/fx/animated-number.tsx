'use client';

import { animate, useInView, useMotionValue, useTransform } from 'framer-motion';
import * as React from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({ value, duration = 1.2, format, className }: AnimatedNumberProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => (format ? format(latest) : Math.round(latest).toLocaleString('tr-TR')));
  const inView = useInView(ref, { once: true, margin: '0px 0px -30% 0px' });
  const [text, setText] = React.useState(format ? format(0) : '0');

  React.useEffect(() => {
    if (!inView) return;
    const controls = animate(motionValue, value, { duration, ease: [0.16, 1, 0.3, 1] });
    const unsub = rounded.on('change', (v) => setText(String(v)));
    return () => {
      controls.stop();
      unsub();
    };
  }, [inView, value, duration, motionValue, rounded]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
