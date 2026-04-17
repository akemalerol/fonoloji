export type PlanId = 'free';

export interface Plan {
  id: PlanId;
  name: string;
  priceTRY: number;
  monthlyQuota: number;
  dailyQuota: number;
  rateLimitPerMinute: number;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Ücretsiz',
    priceTRY: 0,
    monthlyQuota: 30_000,
    dailyQuota: 3_000,
    rateLimitPerMinute: 60,
    features: [
      'Tüm public endpoint\'ler',
      '3.000 istek/gün · 30.000 istek/ay',
      '60 istek/dakika',
      'Topluluk desteği',
    ],
    highlight: true,
  },
};

export function planFor(id: string | null | undefined): Plan {
  const key = (id ?? 'free') as PlanId;
  return PLANS[key] ?? PLANS.free;
}
