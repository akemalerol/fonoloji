'use client';

import * as React from 'react';

// Server Component AdSlot'tan alınan slot_id ile <ins> render edip
// hydration sonrası adsbygoogle push eder. Kullanıcı bloklamış ise (adblock)
// sessizce boş kalır.
export function AdSlotClient({ slotId, format }: { slotId: string; format: string }) {
  React.useEffect(() => {
    try {
      // @ts-expect-error global
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* noop — adblock ya da yüklenmemiş */
    }
  }, [slotId]);

  return (
    <ins
      className="adsbygoogle block"
      style={{ display: 'block' }}
      data-ad-client="ca-pub-9557533039186947"
      data-ad-slot={slotId}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}
