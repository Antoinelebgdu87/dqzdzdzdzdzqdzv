import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import TopSellersCarousel from "@/components/TopSellersCarousel";
import { ProductCard, type Product } from "@/components/ProductCard";
import {
  ArrowRight,
  ShoppingBag,
  Trophy,
  ShieldCheck,
  Zap,
  Lock,
  Clock,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { createSmoothTiltHandlers } from "@/lib/tilt";
import { emailToUsername } from "@/lib/usernameAuth";

import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  onSnapshot,
  orderBy,
  limit,
  query,
} from "firebase/firestore";
import { packs } from "@/lib/packs";

export default function Index() {
  const { user, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sellers, setSellers] = useState<
    { id: string; name: string; sales: number }[]
  >([]);
  const [packPromo, setPackPromo] = useState<number>(0);

  useEffect(() => {
    const q = query(
      collection(db, "products"),
      orderBy("createdAt", "desc"),
      limit(4),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as any[];
      setProducts(
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          price: r.price ?? 0,
          seller: {
            id: (r.sellerId ?? (r.seller && r.seller.id)) || null,
            name: r.sellerName ?? "—",
            role: r.sellerRole ?? "user",
          },
          image: r.imageUrl || r.image || (null as any),
        })),
      );
    });
    return () => unsub();
  }, []);

  // fetch packs promotion so homepage shows promo prices
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "promotions", "packs"), (d) => {
      const data = d.data() as any;
      setPackPromo(Number(data?.all || 0));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "users"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((u) => (u.role ?? "user") === "verified")
        .map((u) => ({
          id: u.id,
          name:
            u.displayName ||
            (u.email && u.email.includes("@")
              ? emailToUsername(u.email)
              : u.email) ||
            "Utilisateur",
          sales: Number(u.sales ?? 0),
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
      setSellers(list);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="container py-24 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="relative min-h-[60vh]">
        <div className="absolute inset-0 bg-background/90 backdrop-blur-sm z-10 flex items-center justify-center">
          <div className="text-center max-w-md mx-auto rounded-xl border border-border/60 bg-card p-8 shadow-xl">
            <h1 className="font-display text-2xl font-bold">
              Inscription requise
            </h1>
            <p className="mt-2 text-sm text-foreground/70">
              Créez un compte ou connectez-vous pour accéder à Brainrot Market
              🇫🇷.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Button asChild variant="secondary">
                <Link to="/login">Se connecter</Link>
              </Button>
              <Button
                asChild
                className="bg-gradient-to-r from-primary to-secondary"
              >
                <Link to="/register">S'inscrire</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // Products now come from Firestore (latest 4)

  return (
    <div>
      <section className="relative border-b border-border/60">
        <div className="container grid gap-10 py-14 md:grid-cols-2">
          <div className="flex flex-col justify-center">
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-display text-4xl md:text-5xl font-extrabold tracking-tight"
            >
              Marketplace #1 for Steal a Brainrot
            </motion.h1>
            <div className="mt-5 max-w-xl">
              <Input
                placeholder="Search products, sellers…"
                className="h-12 rounded-xl bg-muted/60"
              />
            </div>
            <p className="mt-4 text-foreground/80 max-w-prose">
              Achetez et vendez des Brain Rots, gagnez des{" "}
              <strong>RotCoins</strong>. Paiements Stripe, vendeurs certifiés. ,
              Et Revente
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild variant="outline">
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-2"
                >
                  <ShoppingBag className="h-4 w-4" />
                  Browse Marketplace
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="border border-border/60"
              >
                <Link
                  to="/marketplace"
                  className="inline-flex items-center gap-2"
                >
                  <Trophy className="h-4 w-4" />
                  Start Selling
                </Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className="border border-border/60"
              >
                <a
                  href="https://discord.gg/kcHHJy7C4J"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Rejoindre Discord
                </a>
              </Button>
            </div>
            {sellers.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm uppercase tracking-wider text-foreground/60">
                  Vendeurs certifiés — Top 5
                </h3>
                <div className="mt-3">
                  <TopSellersCarousel sellers={sellers} />
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <div className="relative aspect-video rounded-2xl border border-border bg-gradient-to-br from-primary/20 via-secondary/10 to-background p-[2px]">
              {(() => {
                const handlers = createSmoothTiltHandlers(6, 1.02);
                return (
                  <a
                    href="https://cdn-www.bluestacks.com/bs-images/Screenshot-2025-07-10-112001.png"
                    className="h-full w-full rounded-2xl bg-cover bg-center opacity-90 cursor-pointer pointer-events-auto flex will-change-transform"
                    style={{
                      backgroundImage:
                        "url('https://cdn-www.bluestacks.com/bs-images/Screenshot-2025-07-10-112001.png')",
                    }}
                    {...handlers}
                  />
                );
              })()}
              <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/5" />
            </div>
          </div>
        </div>
      </section>

      <section className="container py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Packs RotCoins</h2>
          <Link
            to="/shop"
            className="text-sm text-primary inline-flex items-center gap-1 hover:underline"
          >
            Voir la boutique
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {packs.slice(0, 4).map((p) => {
            const promo = packPromo ?? 0;
            const hasPromo = promo > 0;
            const discounted = (p.price * (1 - promo / 100)).toFixed(2) + "€";
            const priceStr = hasPromo ? discounted : p.price.toFixed(2) + "€";
            return (
              <CreditPack
                key={p.id}
                name={p.name}
                amount={p.coins}
                bonus={`+${p.bonus}%`}
                price={priceStr}
                originalPrice={p.price}
                promo={promo}
              />
            );
          })}
        </div>
      </section>

      <section className="container py-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">En vedette</h2>
          <Link
            to="/marketplace"
            className="text-sm text-primary inline-flex items-center gap-1 hover:underline"
          >
            Tout voir
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      <section className="container py-14">
        <h2 className="font-display text-2xl font-bold">
          Pourquoi Brainrot Market 🇫🇷 ?
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <WhyItem
            icon={ShieldCheck}
            title="Safe Payments"
            desc="Protection acheteur & vendeur via Payhip"
          />
          <WhyItem
            icon={Zap}
            title="Instant Delivery"
            desc="Remises rapides avec notifications live"
          />
          <WhyItem
            icon={Lock}
            title="Secure"
            desc="Vendeurs certifiés & vérifiés manuellement"
          />
          <WhyItem
            icon={Clock}
            title="24/7 Support"
            desc="Tickets et support réactif en continu"
          />
        </div>
      </section>
    </div>
  );
}

function CreditPack({
  name,
  amount,
  bonus,
  price,
  originalPrice,
  promo,
}: {
  name: string;
  amount: number;
  bonus: string;
  price: string;
  originalPrice?: number;
  promo?: number;
}) {
  const hasPromo = Boolean(promo && promo > 0 && originalPrice);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 shadow-[0_10px_30px_rgba(0,0,0,0.25)]"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-foreground/60">
            {name}
          </div>
          <div className="mt-1 text-2xl font-extrabold">
            {amount.toLocaleString()} RC
          </div>
          <div className="text-xs text-emerald-400 font-semibold">
            Bonus {bonus}
          </div>
        </div>
        <GoldCoin />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-foreground/80">
          {hasPromo ? (
            <div className="flex items-center gap-2">
              <span className="text-sm line-through opacity-70">
                {originalPrice?.toFixed(2)}€
              </span>
              <span className="text-xl font-extrabold">{price}</span>
            </div>
          ) : (
            <span className="text-xl font-extrabold">{price}</span>
          )}
        </div>
        <Button size="sm" variant="secondary" asChild>
          <Link to="/shop">Acheter</Link>
        </Button>
      </div>
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
    </motion.div>
  );
}

function WhyItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: any;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
          <Icon className="h-5 w-5 text-white" />
        </span>
        <div className="font-semibold">{title}</div>
      </div>
      <p className="mt-2 text-sm text-foreground/70">{desc}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/90 px-4 py-3 shadow-lg">
      <div className="text-[11px] uppercase tracking-wider text-foreground/60">
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground/90">{value}</div>
    </div>
  );
}

function GoldCoin() {
  const src =
    "https://cdn.builder.io/api/v1/image/assets%2F7ca6692b844e492da4519bd1be30c27d%2F010980b0e1d0488b82cdd1e39f84e4d5?format=webp&width=800";
  return <img src={src} alt="RotCoin" className="h-12 w-12 object-contain" />;
}
