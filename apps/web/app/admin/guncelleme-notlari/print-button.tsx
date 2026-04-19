'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <div className="mb-6 flex items-center justify-end print:hidden">
      <button
        type="button"
        onClick={() => {
          document.title = `Fonoloji Günlük Rapor - ${new Date().toLocaleDateString('tr-TR')}`;
          window.print();
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-500 to-verdigris-400 px-5 py-2 text-sm font-semibold text-background shadow-lg shadow-brand-500/20"
      >
        <Printer className="h-4 w-4" /> PDF olarak indir
      </button>
    </div>
  );
}
