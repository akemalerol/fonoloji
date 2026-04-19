'use client';

import { Check, Copy, Share2 } from 'lucide-react';
import * as React from 'react';

interface Props {
  url?: string;
  text: string;
  label?: string;
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.76.46 3.42 1.27 4.85L2 22l5.25-1.24A9.96 9.96 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.43 14.28c-.2.58-1.22 1.14-1.7 1.21-.47.07-.99.17-3.34-.74-2.84-1.1-4.66-4.04-4.8-4.22-.14-.18-1.15-1.55-1.15-2.96s.74-2.1 1-2.39c.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.17.01.41-.07.64.48.24.56.83 2.05.9 2.2.07.15.12.31.02.5-.1.19-.15.31-.3.47-.15.16-.33.36-.47.48-.15.13-.31.27-.15.55.16.29.74 1.26 1.59 2.04 1.09 1 2.02 1.31 2.31 1.46.29.15.46.13.63-.08.17-.21.72-.86.92-1.16.2-.29.4-.25.67-.14.26.1 1.67.79 1.95.93.29.15.48.22.55.35.07.14.07.81-.13 1.39z" />
    </svg>
  );
}

export function ShareButton({ url, text, label = 'Paylaş' }: Props) {
  const [copied, setCopied] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  const actualUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');

  async function copy() {
    try {
      await navigator.clipboard.writeText(actualUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  async function nativeShare() {
    if (!navigator.share) { setOpen(true); return; }
    try {
      await navigator.share({ title: text, url: actualUrl });
    } catch {
      // user cancelled — fallback to menu
      setOpen(true);
    }
  }

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(actualUrl)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(`${text} ${actualUrl}`)}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          // Önce native share, sonra menü
          if (typeof navigator !== 'undefined' && 'share' in navigator) {
            nativeShare();
          } else {
            setOpen((o) => !o);
          }
        }}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/50 bg-background/40 px-2.5 py-1 text-[11px] text-muted-foreground transition hover:border-brand-500/40 hover:text-foreground"
      >
        <Share2 className="h-3 w-3" />
        {label}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
          <button
            type="button"
            onClick={copy}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Kopyalandı!' : 'Bağlantıyı kopyala'}
          </button>
          <a href={tweetHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted">
            <XIcon className="h-3.5 w-3.5" /> X'te paylaş
          </a>
          <a href={waHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted">
            <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp'ta paylaş
          </a>
        </div>
      )}
    </div>
  );
}
