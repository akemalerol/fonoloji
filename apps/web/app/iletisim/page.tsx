import { Building2, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { ContactForm } from './form';

export const metadata = { title: 'İletişim · Fonoloji' };

export default function ContactPage() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.12),transparent_50%),radial-gradient(circle_at_85%_80%,rgba(45,212,191,0.1),transparent_50%)]" />

      <div className="container max-w-3xl py-16 md:py-20">
        <div className="mb-12 text-center">
          <div className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">iletişim</div>
          <h1 className="display text-5xl leading-[1.02] md:text-6xl">
            <span className="display-italic gradient-text">Merhaba</span> deme zamanı
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground md:text-base">
            Özel entegrasyon, yüksek-hacim kullanım, teknik destek, geri bildirim — ne olursa. Genelde 24 saat içinde dönüyoruz.
          </p>
        </div>

        <div className="mb-10 grid grid-cols-1 gap-3 md:grid-cols-3">
          <InfoCard
            icon={MessageCircle}
            title="Genel soru"
            desc="Platform, veri kaynağı, API"
            from="from-brand-500/15"
            to="to-verdigris-500/10"
          />
          <InfoCard
            icon={Building2}
            title="Özel kullanım"
            desc="Yüksek hacim, özel entegrasyon"
            from="from-amber-500/15"
            to="to-rose-500/10"
          />
          <InfoCard
            icon={Sparkles}
            title="Geri bildirim"
            desc="Yeni özellik, hata bildirimi, öneri"
            from="from-emerald-500/15"
            to="to-verdigris-500/10"
          />
        </div>

        <ContactForm />

        <div className="mt-10 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <a
            href="mailto:hello@fonoloji.com"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <Mail className="h-3.5 w-3.5" /> hello@fonoloji.com
          </a>
          <span className="text-muted-foreground/40">·</span>
          <span>Fonoloji · Türkiye</span>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  desc,
  from,
  to,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  from: string;
  to: string;
}) {
  return (
    <div className="panel group relative overflow-hidden p-5 transition-all hover:-translate-y-0.5">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${from} ${to} opacity-70 transition-opacity group-hover:opacity-100`}
      />
      <div className="relative">
        <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-background/60 ring-1 ring-border">
          <Icon className="h-4 w-4 text-brand-400" />
        </div>
        <div className="serif text-lg leading-tight">{title}</div>
        <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}
