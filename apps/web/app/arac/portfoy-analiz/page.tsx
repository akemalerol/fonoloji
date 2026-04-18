import { PortfoyAnalizClient } from './client';

export const metadata = {
  title: 'Portföy X-Ray — gerçek exposure analizi',
  description:
    'Birden fazla fonun KAP portföy raporlarını birleştirip asıl maruz kaldığın hisse ve varlıkları bulur. Çeşitlenme yanılsamasını kırar.',
};

export default function PortfoyAnalizPage() {
  return <PortfoyAnalizClient />;
}
