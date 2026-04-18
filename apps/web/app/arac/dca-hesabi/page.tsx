import { DcaClient } from './client';

export const metadata = {
  title: 'DCA hesabı — düzenli aylık yatırım simülatörü',
  description:
    'Geçmişe dönüp "aylık düzenli TEFAS fonu alsaydım ne olurdu" sorusunu cevaplar. DCA vs. tek seferde yatırım karşılaştırması. Yatırım tavsiyesi değildir.',
};

export default function DcaPage() {
  return <DcaClient />;
}
