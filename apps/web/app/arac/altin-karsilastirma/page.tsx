import type { Metadata } from 'next';
import { GoldCompareClient } from './client';

export const metadata: Metadata = {
  title: 'Fiziki Altın vs Altın Fonu — Altın Karşılaştırma | Fonoloji',
  description:
    'TL tutarını bugün fiziki altın (çeyrek, yarım, tam, cumhuriyet, bilezik, 22/18/14 ayar) ile altın fonu arasında kıyasla. Alış-satış spread maliyeti görünür.',
};

export const revalidate = 300;

export default function AltinKarsilastirmaPage() {
  return (
    <div className="container py-10">
      <div className="mb-8 max-w-3xl">
        <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Araçlar / Altın Karşılaştırma
        </div>
        <h1 className="display text-balance text-4xl leading-[1.05] md:text-6xl">
          Fiziki Altın <span className="display-italic text-amber-400">vs</span> Altın Fonu
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          Elindeki TL ile bugün hangi altın ürününden kaç gram/adet alabilirsin? Altın fonuna
          yatırsan kaç pay alır, 1 ay sonra fark ne olur? Altınkaynak anlık fiyatı + TEFAS fon
          verisi ile hesaplar. Bilgi amaçlıdır.
        </p>
      </div>

      <GoldCompareClient />
    </div>
  );
}
