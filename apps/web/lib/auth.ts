export interface Plan {
  id: 'free';
  name: string;
  priceTRY: number;
  monthlyQuota: number;
  dailyQuota: number;
  rateLimitPerMinute: number;
  features: string[];
  highlight?: boolean;
}

export interface Me {
  user: {
    id: number;
    email: string;
    name: string | null;
    plan: Plan['id'];
    role: string;
    createdAt: number;
  };
  plan: Plan;
  keys: Array<{
    id: number;
    prefix: string;
    name: string | null;
    createdAt: number;
    lastUsedAt: number | null;
  }>;
  usage: { period: string; count: number };
}

const API_BASE = process.env.FONOLOJI_API_URL ?? 'http://localhost:4000';

export async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch(`${API_BASE}/plans`, { next: { revalidate: 3600 } });
  if (!res.ok) return [];
  const data = (await res.json()) as { items: Plan[] };
  return data.items;
}
