'use client';

import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion';
import * as React from 'react';
import { cn } from '@/lib/utils';

interface WordRotateProps {
  words: string[];
  duration?: number;
  motionProps?: HTMLMotionProps<'h1'>;
  className?: string;
}

export function WordRotate({
  words,
  duration = 2500,
  motionProps = {
    initial: { opacity: 0, y: -30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 30 },
    transition: { duration: 0.35, ease: 'easeOut' },
  },
  className,
}: WordRotateProps) {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => setIndex((v) => (v + 1) % words.length), duration);
    return () => clearInterval(interval);
  }, [words, duration]);

  return (
    <span className="inline-block overflow-hidden py-1">
      <AnimatePresence mode="wait">
        <motion.span key={words[index]} className={cn('inline-block', className)} {...motionProps}>
          {words[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
