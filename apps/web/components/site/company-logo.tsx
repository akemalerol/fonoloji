'use client';

import * as React from 'react';
import { companyDomain, faviconUrl } from '@/lib/management-companies';
import { cn } from '@/lib/utils';

// Portföy yönetim şirketi / emeklilik şirketi logosu.
// - Mapping'de varsa Google Favicon'dan çeker (CDN cached, hızlı).
// - Yoksa baş harften üretilmiş renkli yuvarlak rozet.
// - Logo 404/error verirse baş harfe fallback yapar.

interface Props {
  company: string | null | undefined;
  size?: number;
  className?: string;
}

function initials(name: string): string {
  const cleaned = name
    .replace(/\b(portföy|portfoy|yönetimi|yonetimi|emeklilik|hayat|ve|a\.?s\.?\.?)\b/gi, '')
    .trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `hsl(${h}, 55%, 55%)`;
}

export function CompanyLogo({ company, size = 20, className }: Props) {
  const [errored, setErrored] = React.useState(false);
  const domain = company ? companyDomain(company) : null;

  if (!company) return null;

  if (domain && !errored) {
    return (
      <img
        src={faviconUrl(domain, 64)}
        alt={company}
        width={size}
        height={size}
        className={cn('inline-block shrink-0 rounded-sm bg-white/80 p-[1px]', className)}
        style={{ width: size, height: size }}
        onError={() => setErrored(true)}
        loading="lazy"
      />
    );
  }

  // Fallback: harf rozeti
  const letters = initials(company);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm font-semibold',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, Math.floor(size * 0.5)),
        background: hashColor(company),
        color: '#fff',
      }}
      aria-label={company}
      title={company}
    >
      {letters}
    </span>
  );
}
