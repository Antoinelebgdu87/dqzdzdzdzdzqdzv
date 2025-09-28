import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthProvider";
import { useProfile } from "@/context/ProfileProvider";
import { ShieldCheck, Zap, BadgeDollarSign } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { packs as defaultPacks } from "@/lib/packs";

export default function Shop() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { role } = useProfile();
  const [promo, setPromo] = useState<number>(0);
  const [promoCfg, setPromoCfg] = useState<any>(null);
  const [packs, setPacks] = useState<
    {
      id: string;
      name: string;
      coins: number;
      price: number;
      bonus: number;
      popular?: boolean;
      best?: boolean;
      promoPercent?: number;
    }[]
  >([]);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "promotions", "packs"), (d) => {
      const data = d.data() as any;
      setPromo(Number(data?.all || 0));
      setPromoCfg(data || null);
    });
    return () => unsub();
  }, []);

  // Load packs from Firestore (fallback to static if empty handled below)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "coin_packs"), (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const mapped = rows.map((r) => ({
        id: r.id,
        name: r.name,
        coins: Number(r.rc || r.coins || 0),
        price: Number(r.price_normal || r.price || 0),
        bonus: Number(r.bonus_percent || r.bonus || 0),
        promoPercent: Number(r.promo_percent || 0),
        popular: Boolean(r.popular),
        best: Boolean(r.best),
      }));
      setPacks(mapped);
    });
    return () => unsub();
  }, []);

  const activePromo = useMemo(() => {
    if (!promoCfg) return promo;
    const percent = Number(promoCfg.percent ?? promoCfg.all ?? 0);
    if (!percent) return 0;
    const now = Date.now();
    const start = promoCfg.startAt?.toMillis?.() ?? null;
    const end = promoCfg.endAt?.toMillis?.() ?? null;
    if (start && now < start) return 0;
    if (end && now > end) return 0;
    const roles: string[] = Array.isArray(promoCfg.roles)
      ? promoCfg.roles
      : ["all"];
    if (!roles.includes("all") && role && !roles.includes(role)) return 0;
    return percent;
  }, [promoCfg, promo, role]);

  const displayPacks = useMemo(
    () => (packs.length ? packs : defaultPacks),
    [packs],
  );

  const discordHandle = "brainrot_market";

  const onBuy = async (id: string) => {
    const pack = (displayPacks || []).find((p) => p.id === id) as any;
    if (!user) {
      toast({
        title: "Connexion requise",
        description: "Veuillez vous connecter pour acheter des RotCoins.",
      });
      return;
    }

    // Try to copy Discord handle to clipboard, but guard against permission errors.
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === "function") {
      try {
        await navigator.clipboard.writeText(discordHandle);
        toast({
          title: "Contact Discord copié",
          description: `Le pseudo Discord ${discordHandle} a été copié. Envoyez-lui un message en précisant le pack "${pack?.name || id}" (${pack?.coins || "?"} RC) pour finaliser l'achat.`,
        });
        return;
      } catch (e) {
        // ignore and fallback to showing instructions
        // console.warn intentionally omitted from production logs
      }
    }

    // Fallback if clipboard unavailable or blocked
    toast({
      title: "Contact Discord",
      description: `${discordHandle} — envoyez un message en précisant le pack "${pack?.name || id}" (${pack?.coins || "?"} RC) pour finaliser l'achat.`,
    });
  };

  return (
    <div className="container py-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold">
            Boutique RotCoins
          </h1>
          <p className="text-sm text-foreground/70">
            Achetez des crédits — pour payer, contactez-nous sur Discord : <strong>brainrot_market</strong>.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-foreground/70">
          <Badge
            icon={<ShieldCheck className="h-4 w-4" />}
            text="Paiements sécurisés"
          />
          <Badge
            icon={<Zap className="h-4 w-4" />}
            text="Livraison instantanée"
          />
          <Badge
            icon={<BadgeDollarSign className="h-4 w-4" />}
            text="Meilleur prix"
          />
        </div>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayPacks.map((p: any) => (
          <div
            key={p.id}
            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] transform transition-transform duration-300 hover:scale-[1.03] hover:-translate-y-1 hover:shadow-2xl"
          >
            {p.popular && (
              <span className="absolute left-0 top-3 rounded-r-md bg-secondary px-2 py-1 text-[10px] font-semibold">
                Populaire
              </span>
            )}
            {p.best && (
              <span className="absolute left-0 top-3 rounded-r-md bg-primary px-2 py-1 text-[10px] font-semibold">
                Meilleur prix
              </span>
            )}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-foreground/60">
                  {p.name}
                </div>
                <div className="mt-1 text-2xl font-extrabold">
                  {p.coins.toLocaleString()} RC
                </div>
                <div className="text-xs text-emerald-400 font-semibold">
                  Bonus +{p.bonus}%
                </div>
              </div>
              <div className="transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <GoldCoin size={52} />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-foreground/80">
                {(() => {
                  const perPackPromo = Number(p.promoPercent || 0);
                  const finalPromo = Math.max(
                    0,
                    (activePromo || 0) + perPackPromo,
                  );
                  const discounted = p.price * (1 - finalPromo / 100);
                  if (finalPromo > 0) {
                    return (
                      <div className="flex items-center gap-2">
                        <span className="text-sm line-through opacity-70">
                          {p.price.toFixed(2)}€
                        </span>
                        <span className="text-xl font-extrabold">
                          {discounted.toFixed(2)}€
                        </span>
                      </div>
                    );
                  }
                  return (
                    <span className="text-xl font-extrabold">
                      {p.price.toFixed(2)}€
                    </span>
                  );
                })()}
              </div>
              <Button size="sm" onClick={() => onBuy(p.id)} variant="secondary">
                Acheter
              </Button>
            </div>
            <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold">Contact pour achat</h3>
        <div className="mt-3 flex items-center gap-3 text-foreground/70">
          <DiscordLogo />
          <div>
            Contactez <strong>brainrot_market</strong> sur Discord pour acheter des packs.
            Nous vous enverrons le lien de paiement et les instructions.
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1">
      {icon}
      {text}
    </span>
  );
}

function GoldCoin({ size = 48 }: { size?: number }) {
  const src =
    "https://cdn.builder.io/api/v1/image/assets%2F7ca6692b844e492da4519bd1be30c27d%2F010980b0e1d0488b82cdd1e39f84e4d5?format=webp&width=800";
  return (
    <img
      src={src}
      alt="RotCoin"
      style={{ width: size, height: size }}
      className="object-contain"
    />
  );
}

function VisaLogo() {
  return (
    <svg
      width="44"
      height="20"
      viewBox="0 0 44 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="44" height="20" rx="4" fill="hsl(var(--muted))" />
      <text
        x="22"
        y="13"
        textAnchor="middle"
        fontSize="9"
        fontWeight="800"
        fill="hsl(var(--primary))"
      >
        VISA
      </text>
    </svg>
  );
}
function MastercardLogo() {
  return (
    <svg
      width="44"
      height="20"
      viewBox="0 0 44 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="44" height="20" rx="4" fill="hsl(var(--muted))" />
      <circle cx="18" cy="10" r="5" fill="#EB001B" />
      <circle cx="26" cy="10" r="5" fill="#F79E1B" />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg width="44" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="20" rx="4" fill="hsl(var(--muted))" />
      <path d="M7.5 8.5c.75 0 1.35.65 1.35 1.45 0 .8-.6 1.45-1.35 1.45-.75 0-1.35-.65-1.35-1.45 0-.8.6-1.45 1.35-1.45zm9 0c.75 0 1.35.65 1.35 1.45 0 .8-.6 1.45-1.35 1.45-.75 0-1.35-.65-1.35-1.45 0-.8.6-1.45 1.35-1.45z" fill="hsl(var(--primary))" />
      <path d="M4 18s1.5-2 4.5-2c0 0 .5 1.5 2.5 1.5s2.5-1.5 2.5-1.5C18.5 16 20 18 20 18s-1.25 2.5-6 2.5S4 18 4 18z" fill="hsl(var(--primary))" opacity="0.15" />
    </svg>
  );
}
