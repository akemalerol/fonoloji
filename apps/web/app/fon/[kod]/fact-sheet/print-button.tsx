'use client';

import { Download, Printer } from 'lucide-react';

export function PrintButton({ fundCode, fundName }: { fundCode: string; fundName: string }) {
  return (
    <div className="mb-6 flex items-center justify-between print:hidden">
      <a
        href={`/fon/${fundCode}`}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← {fundCode} sayfasına dön
      </a>
      <button
        type="button"
        onClick={() => {
          document.title = `${fundCode} fact sheet - ${fundName}`;
          window.print();
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-4 py-1.5 text-xs font-semibold text-background shadow-lg shadow-brand-500/20"
      >
        <Printer className="h-3 w-3" /> Yazdır / PDF indir
      </button>
    </div>
  );
}
