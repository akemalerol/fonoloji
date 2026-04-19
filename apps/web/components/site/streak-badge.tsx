'use client';

import { Flame } from 'lucide-react';
import * as React from 'react';

const KEY = 'fonoloji-streak';

interface Streak { days: number; lastVisit: string }

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function updateStreak(): Streak {
  try {
    const raw = localStorage.getItem(KEY);
    const prev: Streak | null = raw ? JSON.parse(raw) : null;
    const today = todayKey();
    if (prev?.lastVisit === today) return prev;

    let next: Streak;
    if (!prev) {
      next = { days: 1, lastVisit: today };
    } else {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      if (prev.lastVisit === yKey) {
        next = { days: prev.days + 1, lastVisit: today };
      } else {
        next = { days: 1, lastVisit: today };
      }
    }
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  } catch {
    return { days: 1, lastVisit: todayKey() };
  }
}

export function StreakBadge() {
  const [streak, setStreak] = React.useState<Streak | null>(null);

  React.useEffect(() => {
    setStreak(updateStreak());
  }, []);

  if (!streak || streak.days < 2) return null;

  const flameClass = streak.days >= 30 ? 'text-rose-400' : streak.days >= 14 ? 'text-amber-400' : streak.days >= 7 ? 'text-brand-400' : 'text-brand-300/70';

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/40 px-2 py-0.5 text-[10px] text-muted-foreground ${flameClass}`}
      title={`${streak.days} gündür üst üste ziyaret ediyorsun`}
    >
      <Flame className="h-3 w-3" />
      <span className="font-mono tabular-nums">{streak.days}</span>
    </div>
  );
}
