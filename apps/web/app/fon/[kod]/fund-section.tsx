'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Fon detay sayfası için accordion section'ı. Client component: açık/kapalı state
// taşır, URL hash'iyle eşleşince otomatik açılır, anchor link mümkün (id).
// SEO uyumlu: kapalı sectionlar DOM'da kalır (hidden attr), sadece görünmez.

interface FundSectionProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FundSection({
  id,
  title,
  icon,
  subtitle,
  defaultOpen = false,
  badge,
  headerRight,
  children,
  className,
}: FundSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  // URL hash section id'ye uyarsa otomatik aç + scroll
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const h = window.location.hash.slice(1);
    if (h === id) {
      setOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    const onHash = () => {
      if (window.location.hash.slice(1) === id) {
        setOpen(true);
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [id]);

  return (
    <section id={id} className={cn('mt-4 scroll-mt-24', className)}>
      <header
        className={cn(
          'flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 transition',
          open ? 'rounded-b-none border-b-0' : 'hover:bg-card/60',
        )}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`${id}-content`}
          className="flex flex-1 items-center gap-3 text-left"
        >
          {icon && (
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', open ? 'bg-brand-500/20 text-brand-200' : 'bg-muted/30 text-muted-foreground')}>
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold md:text-base">{title}</h2>
              {badge}
            </div>
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </header>
      <div
        id={`${id}-content`}
        hidden={!open}
        className={cn(
          'rounded-b-xl border border-t-0 border-border/60 bg-card/20 p-4 md:p-5',
        )}
      >
        {children}
      </div>
    </section>
  );
}

export interface SectionLink {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

// Hero altındaki section nav — tıklayınca scroll + ilgili sectionu açar
// (section kendi hashchange listener'ıyla açılır).
export function SectionNav({ items }: { items: SectionLink[] }) {
  const scrollTo = (id: string) => {
    if (typeof window === 'undefined') return;
    // Hash'i set et ki FundSection open state'ini tetiklesin
    history.replaceState(null, '', `#${id}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <nav
      aria-label="Fon detay menüsü"
      className="sticky top-[56px] z-30 -mx-4 mb-2 mt-4 overflow-x-auto border-y border-border/40 bg-background/85 px-4 py-2 backdrop-blur"
    >
      <ul className="flex items-center gap-1.5 text-xs">
        {items.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => scrollTo(s.id)}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border/50 bg-muted/20 px-3 py-1.5 text-muted-foreground transition hover:border-brand-500/40 hover:bg-brand-500/10 hover:text-brand-200"
            >
              {s.icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{s.icon}</span>}
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
