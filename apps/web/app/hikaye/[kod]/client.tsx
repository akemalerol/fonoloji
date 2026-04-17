'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { PriceChart } from '@/components/fx/price-chart';
import type { FundRow } from '@/lib/api';
import { cn, formatCompact, formatPercent, formatPrice } from '@/lib/utils';

interface Advanced {
  stress_periods: Array<{ start: string; end: string; drawdown: number; days: number }>;
  bench_alpha: {
    '3m': { alpha: number; percentile: number } | null;
    '1y': { alpha: number; percentile: number } | null;
  };
}

export function StoryClient({
  fund,
  history,
  advanced,
  aiSummary,
}: {
  fund: FundRow & { first_seen?: string; last_seen?: string };
  history: Array<{ date: string; price: number }>;
  advanced: Advanced;
  aiSummary: string | null;
}) {
  const { scrollYProgress } = useScroll();

  const firstPrice = history[0]?.price ?? 0;
  const lastPrice = history[history.length - 1]?.price ?? 0;
  const totalReturn = firstPrice > 0 ? (lastPrice - firstPrice) / firstPrice : 0;
  const daysTracked = history.length;

  return (
    <div className="relative">
      <motion.div
        className="fixed left-0 right-0 top-0 z-50 h-0.5 origin-left bg-gradient-to-r from-brand-500 via-verdigris-400 to-emerald-400"
        style={{ scaleX: scrollYProgress }}
      />

      <div className="fixed left-4 top-4 z-40">
        <Link
          href={`/fon/${fund.code}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs backdrop-blur-xl hover:bg-card"
        >
          <ArrowLeft className="h-3 w-3" /> Detaya dön
        </Link>
      </div>

      {/* Act 1: Opening */}
      <section className="relative min-h-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-0 aurora opacity-80" />
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.3),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(45,212,191,0.2),transparent_50%)]" />

        <div className="container relative flex min-h-screen flex-col items-center justify-center py-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
            className="text-xs uppercase tracking-[0.3em] text-muted-foreground"
          >
            — Bölüm 01 —
          </motion.div>
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="mt-6 inline-flex h-16 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-3xl font-bold text-background shadow-2xl shadow-brand-500/30"
          >
            {fund.code}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4 }}
            className="mx-auto mt-8 max-w-3xl display text-5xl leading-[1.05] md:text-7xl"
          >
            {fund.name}
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.8 }}
            className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground"
          >
            {fund.category && (
              <span className="rounded-full border border-border px-3 py-1">{fund.category}</span>
            )}
            {fund.management_company && (
              <span className="rounded-full border border-border px-3 py-1">{fund.management_company}</span>
            )}
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 1.4 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground"
          >
            <ArrowDown className="mx-auto h-4 w-4 animate-bounce" />
            <span className="mt-2 block">aşağı kaydır</span>
          </motion.div>
        </div>
      </section>

      <StorySection num="02" title="Rakamlar">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatBig label="Takip süresi" value={`${daysTracked}g`} />
          <StatBig
            label="Toplam getiri"
            value={formatPercent(totalReturn)}
            color={totalReturn > 0 ? 'text-gain' : 'text-loss'}
          />
          <StatBig label="Fon büyüklüğü" value={formatCompact(fund.aum)} />
          <StatBig label="Yatırımcı" value={fund.investor_count?.toLocaleString('tr-TR') ?? '—'} />
        </div>
      </StorySection>

      <StorySection num="03" title="Fiyat hikayesi">
        <p className="text-sm text-muted-foreground mb-6">
          İlk günden bugüne {history.length > 0 ? formatPrice(firstPrice, 4) : '—'} → {formatPrice(lastPrice, 4)}.
          Yol nasıl geçti?
        </p>
        <div className="panel p-6">
          <PriceChart data={history} positive={totalReturn >= 0} />
        </div>
      </StorySection>

      {advanced.bench_alpha['1y'] && (
        <StorySection num="04" title="Rakipleri karşısında">
          <p className="text-sm text-muted-foreground mb-6">
            Aynı kategorideki fonların içinde{' '}
            <span className="text-foreground font-semibold">%{advanced.bench_alpha['1y'].percentile}'lik dilime</span> ait.
            Bu, medyana göre{' '}
            <span className={cn('font-semibold', advanced.bench_alpha['1y'].alpha > 0 ? 'text-gain' : 'text-loss')}>
              {formatPercent(advanced.bench_alpha['1y'].alpha)}
            </span>{' '}
            fark.
          </p>
          <div className="relative h-4 overflow-hidden rounded-full bg-secondary/40">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${advanced.bench_alpha['1y'].percentile}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className={cn(
                'absolute inset-y-0 left-0 rounded-full',
                advanced.bench_alpha['1y'].alpha > 0 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-loss to-amber-500',
              )}
            />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>en kötü</span>
            <span>medyan</span>
            <span>en iyi</span>
          </div>
        </StorySection>
      )}

      {advanced.stress_periods.length > 0 && (
        <StorySection num="05" title="Zor dönemler">
          <p className="text-sm text-muted-foreground mb-6">
            Her fonun kırılma anları vardır. Bu fonun en sert{' '}
            {advanced.stress_periods.length} drawdown periyodu:
          </p>
          <div className="space-y-2">
            {advanced.stress_periods.slice(0, 5).map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="panel flex items-center justify-between p-4"
              >
                <div className="text-xs">
                  <span className="text-muted-foreground">{p.start}</span>{' '}
                  <span className="text-muted-foreground/60">→</span>{' '}
                  <span className="text-muted-foreground">{p.end}</span>
                  <span className="ml-2 text-muted-foreground/60">({p.days}g)</span>
                </div>
                <div className="font-mono text-sm text-loss">{formatPercent(p.drawdown)}</div>
              </motion.div>
            ))}
          </div>
        </StorySection>
      )}

      <StorySection num="06" title={aiSummary ? 'Son söz' : 'Kendi kararın'}>
        {aiSummary ? (
          <div className="panel-highlight p-8">
            <p className="serif text-xl leading-relaxed text-foreground/95">
              &ldquo;{aiSummary}&rdquo;
            </p>
            <p className="mt-4 text-[10px] text-muted-foreground">
              Fonoloji AI · bu yorum yatırım tavsiyesi değildir
            </p>
          </div>
        ) : (
          <div className="panel-highlight p-8 text-center">
            <p className="display text-3xl leading-tight">
              Bu <span className="display-italic gradient-text">hikayenin</span> devamı
              <br />senin elinde.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Başka fonla karşılaştır veya fiyat alarmı kur. Yatırım tavsiyesi değildir.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link
                href={`/karsilastir?kodlar=${fund.code}`}
                className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
              >
                Karşılaştır
              </Link>
              <Link
                href="/alarmlarim"
                className="rounded-full border border-border px-4 py-2 text-sm hover:bg-card"
              >
                Alarm kur
              </Link>
            </div>
          </div>
        )}
      </StorySection>

      <div className="container py-20 text-center text-xs text-muted-foreground">
        <Link href={`/fon/${fund.code}`} className="hover:text-foreground">
          ← Fon detayına dön
        </Link>
      </div>
    </div>
  );
}

function StorySection({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="container min-h-screen py-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.8 }}
        className="mx-auto max-w-3xl"
      >
        <div className="mb-2 text-xs uppercase tracking-[0.3em] text-muted-foreground">— Bölüm {num} —</div>
        <h2 className="display mb-8 text-4xl leading-tight md:text-5xl">{title}</h2>
        {children}
      </motion.div>
    </section>
  );
}

function StatBig({ label, value, color }: { label: string; value: string; color?: string }) {
  // Auto-scale: long strings get smaller so they never overflow the tile.
  const sizeClass = value.length > 14 ? 'text-xl' : value.length > 10 ? 'text-2xl' : 'text-3xl';
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="panel min-h-[108px] p-5"
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-2 font-mono tabular-nums leading-tight break-words', sizeClass, color)}>
        {value}
      </div>
    </motion.div>
  );
}
