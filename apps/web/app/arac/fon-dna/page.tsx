import { FonDnaClient } from './client';

export const metadata = {
  title: 'Fon DNA — iki fonun gerçek benzerliği',
  description:
    'İki TEFAS fonunun KAP portföy raporlarını karşılaştırır, ne kadar örtüştüklerini (%) söyler. Çeşitlenme yanılsamasını kırar.',
};

export default function FonDnaPage({ searchParams }: { searchParams: { a?: string; b?: string } }) {
  return <FonDnaClient initialA={searchParams.a?.toUpperCase()} initialB={searchParams.b?.toUpperCase()} />;
}
