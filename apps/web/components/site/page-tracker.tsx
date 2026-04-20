'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Her sayfa değişikliğinde /api/track endpoint'ine beacon atar.
// Admin paneli "canlı ziyaretçiler" ve sayfa popülerliğini buradan besler.
// IP backend'de otomatik okunur; biz sadece path + referer + session gönderiyoruz.

function getOrCreateSessionId(): string {
  try {
    const KEY = 'fnlj_sid';
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    // admin/panel iç sayfalarını track'leme — kendi aktivitemizi kirletmesin
    if (pathname.startsWith('/admin') || pathname.startsWith('/panel')) return;

    const payload = JSON.stringify({
      path: pathname,
      referer: document.referrer || null,
      sessionId: getOrCreateSessionId(),
    });

    // fetch keepalive — sayfadan ayrılmada bile tamamlanır
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'same-origin',
    }).catch(() => {
      /* tracking sessiz fail */
    });
  }, [pathname]);

  return null;
}
