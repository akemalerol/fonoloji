'use client';

import { Bell, LayoutDashboard, LogOut, Search, Shield, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { CommandMenu } from './command-menu';

const NAV = [
  { href: '/fonlar', label: 'Fonlar' },
  { href: '/kesifler', label: 'Keşifler' },
  { href: '/ekonomi', label: 'Ekonomi' },
  { href: '/karsilastir', label: 'Karşılaştır' },
  { href: '/api-docs', label: 'API' },
  { href: '/iletisim', label: 'İletişim' },
];

interface Me {
  user: { email: string; name: string | null; role: string };
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [me, setMe] = React.useState<Me | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [loadingAuth, setLoadingAuth] = React.useState(true);

  // Load session on mount + whenever pathname changes (covers login/logout navigation).
  React.useEffect(() => {
    let cancelled = false;
    setLoadingAuth(true);
    fetch('/auth/me', { credentials: 'include' })
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : null))
      .then((data) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingAuth(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    setMe(null);
    setMenuOpen(false);
    router.push('/');
    router.refresh();
  }

  const isAuthed = Boolean(me);
  const isAdmin = me?.user.role === 'admin';
  const initial = (me?.user.name?.[0] ?? me?.user.email[0] ?? 'U').toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40">
        <div className="container flex h-14 items-center gap-6">
          <Link href="/" className="group flex items-center gap-2">
            <div className="relative h-7 w-7 overflow-hidden rounded-full border border-border bg-gradient-to-br from-brand-500 via-brand-400 to-verdigris-400">
              <div className="absolute inset-[1.5px] rounded-full bg-background" />
              <span className="absolute inset-0 flex items-center justify-center serif text-[13px] italic text-foreground">
                f
              </span>
            </div>
            <span className="serif text-lg leading-none tracking-tight">Fonoloji</span>
            <span className="hidden rounded-full border border-border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground md:inline">
              beta
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  pathname?.startsWith(item.href) && 'bg-accent text-foreground',
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary"
            >
              <Search className="h-4 w-4" />
              <span className="hidden md:inline">Fon ara…</span>
              <kbd className="ml-2 hidden rounded bg-background px-1.5 py-0.5 font-mono text-[10px] md:inline">
                ⌘K
              </kbd>
            </button>

            {loadingAuth ? (
              <div className="hidden h-8 w-20 animate-pulse rounded-md bg-secondary/50 md:block" />
            ) : isAuthed ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setMenuOpen(false), 120)}
                  className="flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-1 py-0.5 transition-colors hover:bg-secondary"
                  aria-label="Hesap menüsü"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-verdigris-400 font-mono text-xs font-bold text-background">
                    {initial}
                  </span>
                  <span className="hidden pr-2 text-xs text-muted-foreground md:inline">
                    {me!.user.name ?? me!.user.email.split('@')[0]}
                  </span>
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
                    <div className="border-b border-border px-3 py-2">
                      <div className="truncate text-xs font-medium">
                        {me!.user.name ?? 'Hesap'}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">{me!.user.email}</div>
                      {isAdmin && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] text-brand-400">
                          <Shield className="h-2.5 w-2.5" />
                          admin
                        </div>
                      )}
                    </div>
                    <MenuItem href="/alarmlarim" icon={Bell}>
                      Alarmlarım
                    </MenuItem>
                    <MenuItem href="/panel" icon={LayoutDashboard}>
                      Panel
                    </MenuItem>
                    {isAdmin && (
                      <MenuItem href="/admin" icon={Shield}>
                        Admin
                      </MenuItem>
                    )}
                    <MenuItem href="/api-docs" icon={UserIcon}>
                      API Dokümanı
                    </MenuItem>
                    <button
                      onMouseDown={logout}
                      className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Çıkış
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/giris"
                  className="hidden rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary md:inline-flex"
                >
                  Giriş
                </Link>
                <Link
                  href="/kayit"
                  className="hidden rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background md:inline-flex"
                >
                  Başla
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <CommandMenu open={open} onOpenChange={setOpen} />
    </>
  );
}

function MenuItem({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </Link>
  );
}
