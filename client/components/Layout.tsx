import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Crown,
  ShieldCheck,
  LifeBuoy,
  Star,
  User,
  ShoppingCart,
  Coins,
  Home,
  BadgeCheck,
  LogOut,
  Menu,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
// removed profile dialog
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/context/AuthProvider";
import { DEFAULT_AVATAR_IMG } from "@/lib/images";
import { VERIFIED_IMG } from "@/components/RoleBadge";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, doc } from "firebase/firestore";
import TosModal from "@/components/TosModal";
import Notifications from "@/components/Notifications";
import CreditNotifier from "@/components/CreditNotifier";
import OnboardingTutorial from "@/components/OnboardingTutorial";

const nav = [
  { to: "/", label: "Accueil", icon: Home },
  { to: "/marketplace", label: "Marketplace", icon: ShoppingCart },
  { to: "/shop", label: "RotCoins", icon: Coins },
  { to: "/quests", label: "Quêtes", icon: BadgeCheck },
  { to: "/tickets", label: "Tickets", icon: LifeBuoy },
  { to: "/transactions", label: "Transactions", icon: Coins },
];

function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-background/60 bg-background/80 border-b border-border">
      <div className="container grid h-14 md:h-16 grid-cols-2 md:grid-cols-[auto,1fr,auto] items-center gap-2 md:gap-6">
        <Link to="/" className="flex items-center gap-2 group">
          <img
            src="https://cdn.builder.io/api/v1/image/assets%2Fec69bd5deeba4d6a81033567db96cbc0%2Fa179a2c715a64edaafe6df770c43ddf5?format=webp&width=800"
            alt="Brainrot Market logo"
            className="h-8 w-8 rounded-md object-cover"
          />
          <span className="font-display text-lg md:text-xl tracking-tight">
            Brainrot Market{" "}
            <span role="img" aria-label="France">
              🇫🇷
            </span>
          </span>
        </Link>
        <nav className="hidden">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `px-2.5 py-2 rounded-md text-[13px] md:text-sm transition-colors inline-flex items-center gap-2 ${
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-foreground/80 hover:text-foreground hover:bg-muted"
                }`
              }
            >
              <Icon className="h-3.5 w-3.5 md:h-4 md:w-4" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-3">
          <MobileMenu />
          {!user ? (
            <>
              <Button
                asChild
                variant="outline"
                className="h-8 md:h-9 px-2 md:px-3 text-xs md:text-sm"
              >
                <Link to="/login">Se connecter</Link>
              </Button>
              <Button
                asChild
                className="h-8 md:h-9 px-2 md:px-3 text-xs md:text-sm bg-gradient-to-r from-primary to-secondary shadow-[0_0_24px_rgba(107,61,245,0.35)] hover:from-primary/90 hover:to-secondary/90"
              >
                <Link to="/register">S'inscrire</Link>
              </Button>
            </>
          ) : (
            <UserInfo />
          )}
        </div>
      </div>
    </header>
  );
}

function MobileMenu() {
  const { user, logout } = useAuth();
  const { role } = useProfile();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          className="h-9 w-9 p-0 inline-flex items-center justify-center"
          aria-label="Menu"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] p-4">
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <div className="text-sm font-semibold">Menu</div>
        <div className="mt-3 grid gap-2">
          {(user ? nav.filter((n) => !["/quests", "/tickets", "/transactions"].includes(n.to)) : nav).map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
            >
              {label}
            </Link>
          ))}
          {!user ? (
            <>
              <Link
                to="/login"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
              >
                Se connecter
              </Link>
              <Link
                to="/register"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
              >
                S'inscrire
              </Link>
            </>
          ) : (
            <>
              {/** Account section moved here to avoid profile modal **/}
              {role !== "user" && (
                <Link
                  to="/admin"
                  className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
                >
                  Admin Panel
                </Link>
              )}
              <Link
                to="/profile"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
              >
                Profil
              </Link>
              <Link
                to="/transactions"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
              >
                Transactions
              </Link>
              <Link
                to="/quests"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
              >
                Quêtes
              </Link>
              <Link
                to="/tickets"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted"
              >
                Tickets
              </Link>
              <Link
                to="/messages"
                className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted inline-flex items-center justify-between"
              >
                <span>Messagerie</span>
                <UnreadBadge />
              </Link>
              <Button
                variant="outline"
                onClick={logout}
                className="justify-center"
              >
                Se déconnecter
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useProfile } from "@/context/ProfileProvider";
import { RoleBadge } from "@/components/RoleBadge";

function CompactRole({ role }: { role: string }) {
  if (role === "verified") {
    return (
      <img
        src={VERIFIED_IMG}
        alt="Certifié"
        title="Certifié"
        className="h-4 w-4 object-contain"
      />
    );
  }
  const labels: Record<string, string> = {
    founder: "Fondateur",
    moderator: "Mod",
    helper: "Helper",
    user: "User",
  };
  const label = labels[role] ?? labels.user;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-[2px] text-[10px] md:text-[11px] text-foreground/80">
      {label}
    </span>
  );
}

function UserInfo() {
  const { user, logout } = useAuth();
  const { credits, role } = useProfile();
  return (
    <div className="hidden md:flex items-center justify-end gap-4">
      <Notifications />
      <div className="flex items-center gap-2 min-w-0 px-2 py-1 rounded-md">
        <img
          src={DEFAULT_AVATAR_IMG}
          alt="avatar"
          className="h-8 w-8 rounded-full object-cover"
        />
        <span className="max-w-[160px] truncate text-sm text-foreground/90 text-left">
          {user?.displayName || user?.email}
        </span>
        <CompactRole role={role as any} />
      </div>
      <span
        className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-xs whitespace-nowrap"
        title="Crédits disponibles"
      >
        <img
          src="https://cdn.builder.io/api/v1/image/assets%2F7ca6692b844e492da4519bd1be30c27d%2F010980b0e1d0488b82cdd1e39f84e4d5?format=webp&width=800"
          alt="RC"
          className="h-3.5 w-3.5 object-contain"
        />
        {credits.toLocaleString()} RC
      </span>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              onClick={logout}
              className="h-9 w-9 p-0 inline-flex items-center justify-center"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Déconnexion
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function BanOverlay() {
  const { user } = useAuth();
  const [state, setState] = useState<{
    banned?: boolean;
    bannedUntil?: number;
  } | null>(null);
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, "users", user.uid), (d) => {
      const data = d.data() as any;
      if (data)
        setState({
          banned: data.banned,
          bannedUntil: data.bannedUntil?.toMillis?.() ?? undefined,
        });
    });
    return () => unsub();
  }, [user]);
  const now = Date.now();
  const active =
    Boolean(state?.banned) ||
    (state?.bannedUntil ? state.bannedUntil > now : false);
  if (!active) return null;
  const endTxt = state?.bannedUntil
    ? new Date(state.bannedUntil).toLocaleString()
    : "���";
  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center">
      <div className="rounded-xl border border-border/60 bg-card p-6 max-w-sm text-center">
        <h3 className="font-semibold text-lg">Compte restreint</h3>
        <p className="mt-2 text-sm text-foreground/70">
          Vous avez été temporairement banni.
          {state?.bannedUntil && (
            <>
              <br />
              Fin: {endTxt}
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Announcements() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const q = query(collection(db, "announcements"));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data() as any)
        .filter((a) => !a.startsAt || a.startsAt.toMillis?.() < Date.now());
      if (list.length) setMsg(list[0].text || null);
    });
    return () => unsub();
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-md border border-border/60 bg-card/90 px-4 py-2 text-sm shadow-lg">
      {msg}
    </div>
  );
}

function MaintenanceOverlay() {
  const [state, setState] = useState<{
    on: boolean;
    message?: string;
    scope?: string;
  } | null>(null);
  const location = useLocation();
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "maintenance", "global"), (d) => {
      const data = d.data() as any;
      if (data)
        setState({
          on: Boolean(data.on),
          message: data.message,
          scope: data.scope,
        });
      else setState({ on: false });
    });
    return () => unsub();
  }, []);
  if (!state?.on) return null;

  const path = location.pathname || "/";
  const pageKey = path.startsWith("/tickets")
    ? "tickets"
    : path.startsWith("/shop")
      ? "shop"
      : path === "/" || path.startsWith("/marketplace")
        ? "marketplace"
        : "other";

  // If maintenance is not for this page, render nothing
  if (state.scope !== "global" && state.scope !== pageKey) return null;

  // Global maintenance: full black screen
  if (state.scope === "global") {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center"
        style={{ background: "#000" }}
      >
        <div className="text-center">
          <div
            className="mx-auto mb-5 h-3 w-64 rounded"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #FFD54F, #FFD54F 12px, #000 12px, #000 24px)",
            }}
          />
          <h3 className="text-2xl font-extrabold text-white tracking-wide">
            Maintenance en cours
          </h3>
          <p className="mt-2 text-sm text-white/80">
            {state.message ||
              "Nous revenons très vite. Merci de votre patience."}
          </p>
          <div
            className="mx-auto mt-5 h-3 w-64 rounded"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, #FFD54F, #FFD54F 12px, #000 12px, #000 24px)",
            }}
          />
        </div>
      </div>
    );
  }

  // Scoped maintenance: show a non-blocking banner on the affected page only
  return (
    <div className="fixed top-16 left-0 right-0 z-[120] px-4">
      <div className="mx-auto max-w-6xl rounded-lg border border-yellow-500/40 bg-yellow-400/90 text-black px-4 py-3 shadow">
        <div className="flex items-center gap-2 text-sm">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-black/10 text-xs font-bold">
            🚧
          </span>
          <span>
            Maintenance en cours — Cette page est temporairement désactivée.
            {state.message ? ` ${state.message}` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

function UnreadBadge() {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "threads"),
      where("participants", "array-contains", user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      let c = 0;
      snap.forEach((d) => {
        const data = d.data() as any;
        const lastFrom = data.lastMessage?.senderId;
        const lastReadAt = data.lastReadAt?.[user.uid]?.toMillis?.() ?? 0;
        const updatedAt = data.updatedAt?.toMillis?.() ?? 0;
        if (lastFrom && lastFrom !== user.uid && updatedAt > lastReadAt) c++;
      });
      setCount(c);
    });
    return () => unsub();
  }, [user]);
  if (!user || count <= 0)
    return <span className="text-xs text-foreground/50">0</span>;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold">
      {count}
    </span>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border/60 bg-gradient-to-b from-background to-background/40">
      <div className="container py-10 grid gap-8 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <img
              src="https://cdn.builder.io/api/v1/image/assets%2Fec69bd5deeba4d6a81033567db96cbc0%2Fa179a2c715a64edaafe6df770c43ddf5?format=webp&width=800"
              alt="Brainrot Market logo"
              className="h-8 w-8 rounded-md object-cover"
            />
            <span className="font-display text-lg">
              Brainrot Market{" "}
              <span role="img" aria-label="France">
                🇫🇷
              </span>
            </span>
          </div>
          <p className="mt-3 text-sm text-foreground/70 max-w-sm">
            Marketplace pro & gaming pour Steal a Brainrot. Achetez, vendez et
            gagnez des RotCoins en toute sécurité.
          </p>
        </div>
        <div>
          <h4 className="font-semibold mb-3">À propos</h4>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <Link className="hover:text-foreground" to="/">
                Notre mission
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/profile">
                Compte & profil
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/transactions">
                Transactions
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/marketplace">
                Marketplace
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Support</h4>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <Link className="hover:text-foreground" to="/tickets">
                Centre d'aide
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/tickets">
                Ouvrir un ticket
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/">
                Politique de remboursement
              </Link>
            </li>
            <li>
              <Link className="hover:text-foreground" to="/">
                Conditions & légales
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold mb-3">Paiements</h4>
          <div className="flex items-center gap-3 text-foreground/70">
            <VisaLogo />
            <MastercardLogo />
          </div>
          <p className="mt-3 text-xs text-foreground/60">
            Paiements via Payhip. Redistribution 70% vendeur / 30% admins.
          </p>
        </div>
      </div>
      <div className="border-t border-border/60 py-4 text-center text-xs text-foreground/60">
        © {new Date().getFullYear()} Brainrot Market 🇫🇷 — Projet communautaire
        non affilié à Roblox.
      </div>
    </footer>
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

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === "F1" || e.code === "F1")) {
        e.preventDefault();
        window.location.assign("/admin-roles");
      }
    };
    window.addEventListener("keydown", onKey);

    // Trigger pending sales processor once on app load (best-effort)
    fetch("/api/process-pending", { method: "POST" }).catch(() => {});

    // Global error listeners to help debug 'Script error.' and uncaught rejections
    const onError = (event: ErrorEvent) => {
      // eslint-disable-next-line no-console
      console.error(
        "Global error captured:",
        event.message,
        event.filename,
        event.lineno,
        event.colno,
        event.error,
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      // eslint-disable-next-line no-console
      console.error("Unhandled promise rejection:", event.reason);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <BackgroundAura />
      <Header />
      <BanOverlay />
      <Announcements />
      <MaintenanceOverlay />
      <CreditNotifier />
      <main className="relative z-10">
        <TosModal />
        <OnboardingTutorial />
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function BackgroundAura() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <div className="absolute -top-40 -left-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute top-20 -right-32 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-10%,rgba(107,61,245,0.08),transparent)]" />
    </div>
  );
}
