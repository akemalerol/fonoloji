'use client';

import { Compass, Home, Search, User as UserIcon, Wrench } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';

// Mobil alt tab bar — ekran <md'de görünür. 5 kısa yol: anasayfa, fonlar,
// keşifler, araçlar, panel. Safe-area padding ile iOS dahil.
const TABS = [
  { href: '/', label: 'Ana', icon: Home, match: (p: string) => p === '/' },
  { href: '/fonlar', label: 'Fonlar', icon: Search, match: (p: string) => p.startsWith('/fonlar') || p.startsWith('/fon/') || p.startsWith('/kategori') },
  { href: '/kesifler', label: 'Keşif', icon: Compass, match: (p: string) => p.startsWith('/kesifler') },
  { href: '/arac', label: 'Araçlar', icon: Wrench, match: (p: string) => p.startsWith('/arac') || p.startsWith('/hesapla') },
  { href: '/panel', label: 'Hesap', icon: UserIcon, match: (p: string) => p.startsWith('/panel') || p.startsWith('/giris') },
];

export function MobileBottomTabs() {
  const pathname = usePathname() ?? '/';

  // Admin paneli, modaller gibi full-screen sayfalarda gizle
  if (pathname.startsWith('/admin') || pathname.startsWith('/embed')) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Mobil navigasyon"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map((t) => {
          const active = t.match(pathname);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 px-1 py-2 transition',
                active ? 'text-brand-400' : 'text-muted-foreground hover:text-foreground',
              )}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand-400" aria-hidden />
              )}
              <Icon className={cn('h-5 w-5', active && 'scale-110')} />
              <span className="text-[10px] font-medium">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
