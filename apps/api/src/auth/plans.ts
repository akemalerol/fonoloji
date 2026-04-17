export type PlanId = 'free' | 'hobi' | 'pro' | 'kurumsal';

export interface Plan {
  id: PlanId;
  name: string;
  priceTRY: number;
  monthlyQuota: number;
  rateLimitPerMinute: number;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Ücretsiz',
    priceTRY: 0,
    monthlyQuota: 500,
    rateLimitPerMinute: 10,
    features: ['Temel endpoint\'ler', 'Topluluk desteği', 'Kayıt gerektirir'],
  },
  hobi: {
    id: 'hobi',
    name: 'Hobi',
    priceTRY: 99,
    monthlyQuota: 10_000,
    rateLimitPerMinute: 60,
    features: ['Tüm endpoint\'ler', 'Email destek', 'Günlük özet feed'],
  },
  pro: {
    id: 'pro',
    name: 'Profesyonel',
    priceTRY: 349,
    monthlyQuota: 100_000,
    rateLimitPerMinute: 180,
    features: [
      'Tüm endpoint\'ler',
      'Öncelikli destek',
      'Webhook bildirimleri',
      'Analytics export',
    ],
    highlight: true,
  },
  kurumsal: {
    id: 'kurumsal',
    name: 'Kurumsal',
    priceTRY: 999,
    monthlyQuota: 500_000,
    rateLimitPerMinute: 600,
    features: [
      'Yüksek hacimli kullanım',
      'SLA + Slack desteği',
      'Özel veri istekleri',
      'Beyaz etiket imkanı',
    ],
  },
};

export function planFor(id: string | null | undefined): Plan {
  const key = (id ?? 'free') as PlanId;
  return PLANS[key] ?? PLANS.free;
}
