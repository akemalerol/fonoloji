'use client';

import { motion, useMotionValue, useTransform } from 'framer-motion';
import type React from 'react';

export function GlassCard({ children }: { children: React.ReactNode }) {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [6, -6]);
  const rotateY = useTransform(mouseX, [-300, 300], [-6, 6]);

  function handleMouseMove(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  }
  function handleMouseLeave() {
    mouseX.set(0);
    mouseY.set(0);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      style={{ perspective: 1500 }}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-3xl overflow-hidden pointer-events-none">
            <motion.div
              className="absolute top-0 left-0 h-[2px] w-[55%] bg-gradient-to-r from-transparent via-brand-400 to-transparent opacity-80"
              animate={{ left: ['-55%', '100%'] }}
              transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6 }}
            />
            <motion.div
              className="absolute top-0 right-0 h-[55%] w-[2px] bg-gradient-to-b from-transparent via-brand-400 to-transparent opacity-80"
              animate={{ top: ['-55%', '100%'] }}
              transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6, delay: 0.65 }}
            />
            <motion.div
              className="absolute bottom-0 right-0 h-[2px] w-[55%] bg-gradient-to-r from-transparent via-verdigris-400 to-transparent opacity-80"
              animate={{ right: ['-55%', '100%'] }}
              transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6, delay: 1.3 }}
            />
            <motion.div
              className="absolute bottom-0 left-0 h-[55%] w-[2px] bg-gradient-to-b from-transparent via-verdigris-400 to-transparent opacity-80"
              animate={{ bottom: ['-55%', '100%'] }}
              transition={{ duration: 2.6, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.6, delay: 1.95 }}
            />
          </div>

          <div className="absolute -inset-8 rounded-3xl bg-gradient-to-br from-brand-500/20 via-transparent to-verdigris-500/20 opacity-40 blur-2xl pointer-events-none" />

          <div className="relative rounded-3xl border border-white/[0.07] bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-7 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden">
            <div
              className="absolute inset-0 opacity-[0.025] pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)',
                backgroundSize: '30px 30px',
              }}
            />
            <div className="relative">{children}</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AuthHeader({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="relative mb-7 text-center">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.8 }}
        className="mx-auto mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 via-brand-400 to-verdigris-400 shadow-lg shadow-brand-500/30"
      >
        <span className="serif text-2xl italic text-background">f</span>
      </motion.div>
      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="display text-3xl leading-tight text-foreground"
      >
        {title}
      </motion.h1>
      {subtitle && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-2 text-xs text-muted-foreground"
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

export function GlassInput({
  icon: Icon,
  right,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ElementType;
  right?: React.ReactNode;
}) {
  return (
    <motion.div whileHover={{ scale: 1.005 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
      <div className="group/field relative flex items-center overflow-hidden rounded-xl">
        <Icon className="absolute left-3.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within/field:text-brand-400" />
        <input
          {...props}
          className="h-11 w-full rounded-xl border border-white/[0.06] bg-white/[0.03] pl-10 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-muted-foreground/60 focus:border-brand-500/40 focus:bg-white/[0.06]"
        />
        {right && <div className="absolute right-3">{right}</div>}
      </div>
    </motion.div>
  );
}
