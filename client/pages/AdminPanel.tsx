import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
  addDoc,
  deleteDoc,
  arrayUnion,
  Timestamp,
} from "firebase/firestore";
import { useProfile } from "@/context/ProfileProvider";
import { useAuth } from "@/context/AuthProvider";
import { Users, LifeBuoy, ShoppingBag } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { motion, useMotionValue, useSpring } from "framer-motion";

const ROLES = ["user", "verified", "helper", "moderator", "founder"] as const;

type Role = (typeof ROLES)[number];

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 140, damping: 18 });
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    mv.set(value || 0);
  }, [value]);
  useEffect(() => {
    const unsub = spring.on("change", (v) => setDisplay(Math.round(v)));
    return () => unsub();
  }, [spring]);
  return <span>{Number(display || 0).toLocaleString()}</span>;
}

function ChartTooltip({
  active,
  payload,
  label,
  title,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color?: string }>;
  label?: string | number;
  title?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter(Boolean);
  const formatName = (n?: string) => {
    if (!n) return "";
    if (n === "rcSpent") return "RC dépensés";
    if (n === "purchases") return "Achats";
    if (n === "sales") return "Ventes";
    return n;
  };
  return (
    <div className="rounded-md border border-border/60 bg-popover text-popover-foreground shadow px-3 py-2 text-xs">
      <div className="font-medium mb-1">
        {title ? `${title} ${label}` : label}
      </div>
      <div className="space-y-0.5">
        {items.map((p, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-sm"
              style={{ background: p.color || "hsl(var(--primary))" }}
            />
            <span className="text-foreground/70">{formatName(p.name)}</span>
            <span className="ml-auto font-medium">
              {Number(p.value || 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AdminLogin({ onOk }: { onOk: () => void }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  return (
    <div className="container max-w-sm py-16">
      <h1 className="font-display text-2xl font-bold">Admin Login</h1>
      <div className="mt-4 space-y-3">
        <Input
          placeholder="Identifiant"
          value={u}
          onChange={(e) => setU(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Mot de passe"
          value={p}
          onChange={(e) => setP(e.target.value)}
        />
        <Button
          onClick={() => {
            if (u === "Admin" && p === "Antoine80@") {
              localStorage.setItem("brm_admin", "1");
              onOk();
            }
          }}
        >
          Se connecter
        </Button>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [ok, setOk] = useState<boolean>(
    () => localStorage.getItem("brm_admin") === "1",
  );
  const { toast } = useToast();
  const { role } = useProfile();
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [tickets, setTickets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [stats, setStats] = useState<{
    users: number;
    tickets: number;
    products: number;
  }>({ users: 0, tickets: 0, products: 0 });
  const [filter, setFilter] = useState("");
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [ticketMsgs, setTicketMsgs] = useState<any[]>([]);
  const [reply, setReply] = useState("");
  const [promo, setPromo] = useState<number>(0);
  const [promoStart, setPromoStart] = useState<string>("");
  const [promoEnd, setPromoEnd] = useState<string>("");
  const [promoRole, setPromoRole] = useState<string>("all");
  const [announcement, setAnnouncement] = useState("");
  const [banDays, setBanDays] = useState<number>(0);
  const [banHours, setBanHours] = useState<number>(0);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [txData, setTxData] = useState<any[]>([]);
  const [sellerBars, setSellerBars] = useState<any[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [searching, setSearching] = useState(false);
  const rolePanelRef = useRef<HTMLDivElement | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);

  // Founder tools state
  const [questTitle, setQuestTitle] = useState("");
  const [questDesc, setQuestDesc] = useState("");
  const [questReward, setQuestReward] = useState<number>(50);
  const [questAction, setQuestAction] = useState<string>("discord_join");
  const [questTarget, setQuestTarget] = useState<string>(
    "https://discord.gg/kcHHJy7C4J",
  );
  const [questList, setQuestList] = useState<any[]>([]);

  const [gcAmount, setGcAmount] = useState<number>(100);
  const [gcCode, setGcCode] = useState<string>("");
  const [gcTarget, setGcTarget] = useState<"all" | "email">("all");
  const [gcEmail, setGcEmail] = useState<string>("");

  const genCode = (len = 12) =>
    Array.from(crypto.getRandomValues(new Uint8Array(len)))
      .map((x) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[x % 32])
      .join("");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
      setLoadingUsers(false);
      setStats((s) => ({ ...s, users: list.length }));
      const top = list
        .map((u: any) => ({
          name: u.displayName || u.email || u.id,
          sales: Number(u.sales || u.stats?.sales || 0),
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);
      setSellerBars(top);
    });
    return () => unsub();
  }, []);

  // Load transactions for charts (last 30 days)
  useEffect(() => {
    const since = Timestamp.fromMillis(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, "transactions"),
      where("createdAt", ">=", since),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      const byDay: Record<
        string,
        { day: string; rcSpent: number; purchases: number; rcPending: number }
      > = {};
      for (const t of rows) {
        const ts = t.createdAt?.toMillis?.() ?? Date.now();
        const dkey = new Date(ts).toISOString().slice(0, 10);
        if (!byDay[dkey])
          byDay[dkey] = {
            day: dkey.slice(5),
            rcSpent: 0,
            purchases: 0,
            rcPending: 0,
          };
        if (t.type === "purchase") {
          byDay[dkey].rcSpent += Math.abs(Number(t.credits || 0));
          byDay[dkey].purchases += 1;
        }
        if (t.type === "salePending") {
          byDay[dkey].rcPending += Math.abs(Number(t.credits || 0));
        }
      }
      const arr = Object.values(byDay);
      setTxData(arr);
    });
    return () => unsub();
  }, []);

  // load product count and maintenance flag for founder
  useEffect(() => {
    let unsubProducts: any = () => {};
    const maintRef = doc(db, "maintenance", "global");
    const unsubMeta = onSnapshot(maintRef, (d) => {
      const data = d.data() as any | undefined;
      const toggle = document.getElementById(
        "maintenance-toggle",
      ) as HTMLInputElement | null;
      const scope = document.getElementById(
        "maintenance-scope",
      ) as HTMLSelectElement | null;
      const msg = document.getElementById(
        "maintenance-message",
      ) as HTMLInputElement | null;
      if (toggle) toggle.checked = Boolean(data?.on);
      if (scope && data?.scope) scope.value = data.scope;
      if (msg && data?.message) msg.value = data.message;
    });

    (async () => {
      const snap = await getDocs(query(collection(db, "products")));
      const count = snap.size;
      setStats((s) => ({ ...s, products: count }));

      const q = query(collection(db, "products"));
      unsubProducts = onSnapshot(q, (s) => {
        const c = s.size;
        setStats((st) => ({ ...st, products: c }));
        const el2 = document.getElementById("product-count");
        if (el2) el2.textContent = `${c} produit(s) actifs`;
      });
    })();

    const scopeSelect = document.getElementById(
      "maintenance-scope",
    ) as HTMLSelectElement | null;
    const toggle = document.getElementById(
      "maintenance-toggle",
    ) as HTMLInputElement | null;
    const onChange = async () => {
      if (!toggle) return;
      try {
        const scope = scopeSelect?.value || "global";
        const message = toggle.checked
          ? (document.getElementById("maintenance-message") as HTMLInputElement)
              ?.value || ""
          : "";
        // write to maintenance/global for a clear global maintenance document
        const maintRef2 = doc(db, "maintenance", "global");
        await setDoc(
          maintRef2,
          { on: toggle.checked, scope, message },
          { merge: true },
        );
        toast({
          title: `Maintenance ${toggle.checked ? "activée" : "désactivée"}`,
        });
      } catch (e) {
        console.error("set maintenance failed", e);
      }
    };
    toggle?.addEventListener("change", onChange);
    scopeSelect?.addEventListener("change", onChange);

    return () => {
      unsubMeta();
      unsubProducts && unsubProducts();
      toggle?.removeEventListener("change", onChange);
      scopeSelect?.removeEventListener("change", onChange);
    };
  }, [toast]);

  // Users overview table for easier management

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "quests"), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setQuestList(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, "users", userId), (d) => {
      if (d.exists()) {
        const data = { id: d.id, ...d.data() } as any;
        setUserInfo(data);
        if (selectedRole == null)
          setSelectedRole((data.role ?? "user") as Role);
      }
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      where("status", "in", ["open", "pending"]),
    );
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTickets(rows);
      setStats((s) => ({ ...s, tickets: rows.length }));
      if (!activeTicket && rows.length) setActiveTicket(rows[0].id);
    });
    return () => unsub();
  }, [activeTicket]);

  useEffect(() => {
    if (!activeTicket) return;
    const unsub = onSnapshot(
      collection(db, "tickets", activeTicket, "messages"),
      (snap) => {
        setTicketMsgs(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
        );
      },
    );
    return () => unsub();
  }, [activeTicket]);

  const findUser = async () => {
    try {
      setSearching(true);
      const q = query(collection(db, "users"), where("email", "==", email));
      const res = await getDocs(q);
      if (!res.empty) {
        const d = res.docs[0];
        setUserId(d.id);
        setUserInfo(d.data());
        setSelectedRole(((d.data() as any).role ?? "user") as Role);
        toast({
          title: "Utilisateur trouvé",
          description: (d.data() as any).email,
        });
      } else {
        toast({ title: "Introuvable", description: email });
      }
    } finally {
      setSearching(false);
    }
  };

  const saveRole = async () => {
    if (!userId || !selectedRole) return;
    try {
      setSavingRole(true);
      await setDoc(
        doc(db, "users", userId),
        { role: selectedRole, updatedAt: serverTimestamp() },
        { merge: true },
      );

      // add a notification to the user about their new role
      try {
        await updateDoc(doc(db, "users", userId), {
          notifications: arrayUnion({
            type: "role",
            role: selectedRole,
            text: `Vous avez reçu le rôle ${selectedRole}`,
            createdAt: Timestamp.now(),
            read: false,
          }),
        });
      } catch (e) {
        console.error("notify role change failed", e);
      }

      toast({ title: "Rôle sauvegardé", description: `${selectedRole}` });
    } finally {
      setSavingRole(false);
    }
  };

  const { user: currentUser } = useAuth();

  const adjustCredits = async (amount: number) => {
    if (!userId) return;
    try {
      setAdjusting(true);

      // Atomically increment balances.available on user doc
      await updateDoc(doc(db, "users", userId), {
        "balances.available": increment(amount),
      } as any);

      // Create a transaction record to keep history and show admin as giver
      try {
        await addDoc(collection(db, "transactions"), {
          uid: userId,
          type: "admin_grant",
          credits: amount,
          adminId: currentUser?.uid || "admin",
          adminName: currentUser?.displayName || currentUser?.email || "admin",
          note: `Grant by admin ${currentUser?.displayName || currentUser?.email || "admin"}`,
          status: "completed",
          createdAt: serverTimestamp(),
        });
      } catch (e) {
        console.error("admin:create transaction failed", e);
      }

      toast({
        title: "Crédits modifiés",
        description: `${amount > 0 ? "+" : ""}${amount} RC`,
      });
    } finally {
      setAdjusting(false);
    }
  };

  const createTicket = async (title: string, body: string) => {
    const ref = doc(collection(db, "tickets"));
    await setDoc(ref, {
      title,
      body,
      status: "open",
      createdAt: serverTimestamp(),
    });
  };
  const sendReply = async () => {
    if (!activeTicket || !reply.trim()) return;
    try {
      await setDoc(doc(collection(db, "tickets", activeTicket, "messages")), {
        text: reply.trim(),
        senderId: currentUser?.uid || "admin",
        senderName: currentUser?.displayName || currentUser?.email || "admin",
        senderRole: role || "admin",
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "tickets", activeTicket), {
        updatedAt: serverTimestamp(),
        status: "pending",
      });
      setReply("");
    } catch (e) {
      console.error("ticket:reply failed", e);
    }
  };
  const closeTicket = async (id: string, reason = "Closed by staff") => {
    try {
      await updateDoc(doc(db, "tickets", id), {
        status: "closed",
        closeReason: reason,
        closedAt: serverTimestamp(),
      });
      toast({ title: "Ticket ferm��" });
    } catch (e) {
      console.error("ticket:close failed", e);
    }
  };

  const deleteTicket = async (id: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, "tickets", id));
      toast({ title: "Ticket supprimé" });
      if (activeTicket === id) setActiveTicket(null);
    } catch (e) {
      console.error("ticket:delete failed", e);
      toast({ title: "Erreur suppression" });
    }
  };

  if (!ok) return <AdminLogin onOk={() => setOk(true)} />;

  if (role === "user" || role === "verified") {
    return (
      <div className="container py-10">
        <h1 className="font-display text-2xl font-bold">Accès refus��</h1>
        <p className="text-sm text-foreground/70">
          Vous n'avez pas les permissions pour accéder à l'Admin Panel.
        </p>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <h1 className="font-display text-3xl font-extrabold">Admin Panel</h1>
      <p className="text-sm text-foreground/70">
        CTRL + F1 pour ouvrir rapidement cet écran.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/15 to-background p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/25 ring-1 ring-primary/30">
              <Users className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs uppercase text-foreground/60">
                Utilisateurs
              </div>
              <div className="text-xl font-extrabold">
                <AnimatedNumber value={stats.users} />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-secondary/15 to-background p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-secondary/25 ring-1 ring-secondary/30">
              <LifeBuoy className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs uppercase text-foreground/60">
                Tickets ouverts
              </div>
              <div className="text-xl font-extrabold">
                <AnimatedNumber value={stats.tickets} />
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-gradient-to-br from-accent/15 to-background p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/25 ring-1 ring-accent/30">
              <ShoppingBag className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs uppercase text-foreground/60">
                Produits
              </div>
              <div className="text-xl font-extrabold">
                <AnimatedNumber value={stats.products} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 lg:col-span-2">
          <h3 className="font-semibold">Ventes (RC) par jour</h3>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={txData}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="rcSpent" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0.6}
                    />
                    <stop
                      offset="95%"
                      stopColor="hsl(var(--primary))"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted))"
                />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  content={(props: any) => (
                    <ChartTooltip {...props} title="Jour" />
                  )}
                  cursor={{
                    stroke: "hsl(var(--primary))",
                    strokeWidth: 1,
                    opacity: 0.25,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="rcSpent"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  activeDot={{
                    r: 3,
                    stroke: "hsl(var(--primary))",
                    strokeWidth: 2,
                    fill: "hsl(var(--card))",
                  }}
                  fillOpacity={1}
                  fill="url(#rcSpent)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="font-semibold">Top vendeurs (30j)</h3>
          <div className="mt-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sellerBars}
                layout="vertical"
                margin={{ left: 16, right: 8, top: 8, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted))"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11 }}
                  allowDecimals={false}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={90}
                />
                <Tooltip
                  content={(props: any) => (
                    <ChartTooltip {...props} title="Vendeur" />
                  )}
                  cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                />
                <Bar dataKey="sales" fill="hsl(var(--secondary))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="font-semibold">Achats (nb/jour)</h3>
          <div className="mt-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={txData}
                margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--muted))"
                />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  content={(props: any) => (
                    <ChartTooltip {...props} title="Jour" />
                  )}
                  cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                />
                <Bar dataKey="purchases" fill="hsl(var(--accent))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Users overview - big table */}
      <div className="mt-6 rounded-xl border border-border/60 bg-card p-4">
        <h2 className="font-semibold mb-3">Utilisateurs (aperçu)</h2>
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-foreground/60">
                <th className="p-2">Email / Nom</th>
                <th className="p-2">Rôle</th>
                <th className="p-2">Crédits</th>
                <th className="p-2">Ventes</th>
                <th className="p-2">Achats</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border/50">
                  <td className="p-2">{u.displayName || u.email || u.id}</td>
                  <td className="p-2">{u.role}</td>
                  <td className="p-2">
                    {(u.balances?.available || 0).toLocaleString()} RC
                  </td>
                  <td className="p-2">
                    {Number(u.sales || u.stats?.sales || 0)}
                  </td>
                  <td className="p-2">
                    {Number(u.purchases || u.stats?.purchases || 0)}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setUserId(u.id);
                          setUserInfo(u);
                          setSelectedRole((u.role ?? "user") as any);
                          setEmail(u.email ?? "");
                          setFilter(u.email || u.displayName || "");
                          setTimeout(() => {
                            rolePanelRef.current?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                            emailInputRef.current?.focus();
                          }, 0);
                        }}
                      >
                        Gérer
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border/60 bg-card p-3 md:col-span-1">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Filtrer par email/nom"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              ref={filterInputRef}
            />
          </div>
          {loadingUsers ? (
            <div className="mt-3 text-sm text-foreground/70">Chargement…</div>
          ) : (
            <div className="mt-2 max-h-80 overflow-auto divide-y divide-border/50">
              {users
                .filter((u) => {
                  const q = filter.toLowerCase();
                  if (!q) return true;
                  return (
                    (u.email ?? "").toLowerCase().includes(q) ||
                    (u.displayName ?? "").toLowerCase().includes(q) ||
                    (u.role ?? "").toLowerCase().includes(q)
                  );
                })
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setUserId(u.id);
                      setUserInfo(u);
                      setSelectedRole((u.role ?? "user") as Role);
                      setEmail(u.email ?? "");
                      setFilter(u.email || u.displayName || "");
                      setTimeout(() => {
                        rolePanelRef.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                        emailInputRef.current?.focus();
                      }, 0);
                    }}
                    className={`w-full text-left px-2 py-2 hover:bg-muted transition-colors ${
                      userId === u.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="text-sm">
                      {u.displayName || u.email || u.id}
                    </div>
                    <div className="text-xs text-foreground/60">
                      {(u.role ?? "user").toString()} ·{" "}
                      {(u.credits ?? 0).toLocaleString()} RC
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
        <div
          ref={rolePanelRef}
          className="rounded-xl border border-border/60 bg-card p-4 md:col-span-2"
        >
          <div className="flex flex-wrap items-end gap-2">
            <Input
              placeholder="Email utilisateur"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-64"
              ref={emailInputRef}
            />
            <Button onClick={findUser} disabled={searching}>
              {searching ? "Recherche…" : "Rechercher"}
            </Button>
            {userInfo && (
              <div className="text-sm text-foreground/80">
                {userInfo.displayName || userInfo.email}
              </div>
            )}
          </div>
          {userId && (
            <div className="mt-4">
              {role === "moderator" || role === "founder" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-foreground/70">Rôle:</span>
                  {ROLES.map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={selectedRole === r ? "default" : "outline"}
                      onClick={() => setSelectedRole(r as Role)}
                    >
                      {r}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    className="ml-2"
                    onClick={saveRole}
                    disabled={savingRole}
                  >
                    {savingRole ? "Sauvegarde…" : "Sauvegarder"}
                  </Button>
                  <span className="ml-4 text-xs text-foreground/70">
                    Crédits:
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustCredits(100)}
                    disabled={adjusting}
                  >
                    {adjusting ? "…" : "+100"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustCredits(1000)}
                    disabled={adjusting}
                  >
                    {adjusting ? "…" : "+1000"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => adjustCredits(-100)}
                    disabled={adjusting}
                  >
                    {adjusting ? "…" : "-100"}
                  </Button>
                </div>
              ) : (
                <div className="mt-2 text-sm text-foreground/70">
                  Vous n'avez pas la permission de modifier les rôles ou
                  crédits.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Tabs
        defaultValue={
          role === "founder"
            ? "founder"
            : role === "moderator"
              ? "moderator"
              : "helper"
        }
        className="mt-8"
      >
        <TabsList>
          {(role === "helper" ||
            role === "moderator" ||
            role === "founder") && (
            <TabsTrigger value="helper">Helper</TabsTrigger>
          )}
          {(role === "moderator" || role === "founder") && (
            <TabsTrigger value="moderator">Modérateur</TabsTrigger>
          )}
          {role === "founder" && (
            <TabsTrigger value="founder">Fondateur</TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="helper">
          <div className="grid gap-3 md:grid-cols-[300px,1fr]">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="font-semibold">Tickets (ouverts)</h3>
              <div className="mt-3 max-h-[60vh] overflow-auto divide-y divide-border/60">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTicket(t.id)}
                    className={`w-full text-left px-2 py-2 hover:bg-muted ${activeTicket === t.id ? "bg-muted" : ""}`}
                  >
                    <div className="text-sm font-semibold">{t.title}</div>
                    <div className="text-xs text-foreground/70 capitalize">
                      {t.status}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <h3 className="font-semibold">Chat</h3>
              {role === "founder" && (
                <div className="mt-4">
                  <h4 className="font-medium">
                    Envoyer un message global (système)
                  </h4>
                  <div className="mt-2 grid gap-2">
                    <Input
                      placeholder="Titre (optionnel)"
                      id="broadcast-title"
                    />
                    <Input placeholder="Message système" id="broadcast-text" />
                    <div className="flex items-center gap-2">
                      <Button
                        id="broadcast-send"
                        onClick={async () => {
                          const titleEl = document.getElementById(
                            "broadcast-title",
                          ) as HTMLInputElement | null;
                          const textEl = document.getElementById(
                            "broadcast-text",
                          ) as HTMLInputElement | null;
                          const msg = textEl?.value?.trim();
                          const title =
                            titleEl?.value?.trim() || "Message système";
                          if (!msg) {
                            toast({
                              title: "Message vide",
                              description: "Entrez le texte du message",
                              variant: "destructive",
                            });
                            return;
                          }
                          try {
                            // fetch all users
                            const usersSnap = await getDocs(
                              query(collection(db, "users")),
                            );
                            for (const d of usersSnap.docs) {
                              const u = { id: d.id, ...(d.data() as any) };
                              const threadId = `system_${u.id}`;
                              // create or update thread doc
                              await setDoc(
                                doc(db, "threads", threadId),
                                {
                                  participants: [u.id],
                                  title,
                                  system: true,
                                  lastMessage: {
                                    text: msg,
                                    senderId: "system",
                                  },
                                  updatedAt: serverTimestamp(),
                                },
                                { merge: true },
                              );
                              // add the system message
                              await addDoc(
                                collection(db, "threads", threadId, "messages"),
                                {
                                  senderId: "system",
                                  text: msg,
                                  createdAt: serverTimestamp(),
                                },
                              );
                              // notify user
                              try {
                                await updateDoc(doc(db, "users", u.id), {
                                  notifications: arrayUnion({
                                    type: "thread",
                                    threadId,
                                    text: msg,
                                    createdAt: Timestamp.now(),
                                    system: true,
                                  }),
                                });
                              } catch (e) {}
                            }
                            toast({ title: "Message envoyé" });
                            if (textEl) textEl.value = "";
                            if (titleEl) titleEl.value = "";
                          } catch (e) {
                            console.error("broadcast failed", e);
                            toast({
                              title: "Erreur",
                              description:
                                "Impossible d'envoyer le message global",
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        Envoyer globalement
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              {activeTicket ? (
                <div className="flex h-[60vh] flex-col">
                  <div className="flex-1 space-y-2 overflow-auto">
                    {ticketMsgs.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[70%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.senderId === currentUser?.uid ? "ml-auto bg-secondary/20" : "bg-muted"}`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="text-xs text-foreground/60">
                            {m.senderName ||
                              (m.senderId === "admin"
                                ? "Admin"
                                : "Utilisateur")}
                          </div>
                          {m.senderRole && m.senderRole !== "user" && (
                            <div className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                              {m.senderRole}
                            </div>
                          )}
                        </div>
                        {m.text}
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Réponse…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") sendReply();
                      }}
                    />
                    <Button size="sm" onClick={sendReply}>
                      Envoyer
                    </Button>
                    {/* Close allowed for helpers+ */}
                    {(role === "helper" ||
                      role === "moderator" ||
                      role === "founder") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => closeTicket(activeTicket)}
                      >
                        Fermer
                      </Button>
                    )}
                    {/* Delete only for moderator/founder */}
                    {(role === "moderator" || role === "founder") && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteTicket(activeTicket)}
                      >
                        Supprimer
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-foreground/70">
                  Sélectionnez un ticket.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="moderator">
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <h3 className="font-semibold">Modération</h3>
            <p className="text-sm text-foreground/70">
              Bannir / avertir via mise à jour du document utilisateur.
            </p>
            {userId ? (
              <div className="mt-3 grid gap-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Jours"
                    value={banDays}
                    onChange={(e) => setBanDays(Number(e.target.value))}
                    className="w-24"
                  />
                  <Input
                    type="number"
                    placeholder="Heures"
                    value={banHours}
                    onChange={(e) => setBanHours(Number(e.target.value))}
                    className="w-24"
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={userId === currentUser?.uid}
                    onClick={async () => {
                      if (userId === currentUser?.uid) {
                        toast({
                          title: "Action interdite",
                          description: "Vous ne pouvez pas vous auto-bannir.",
                          variant: "destructive",
                        });
                        return;
                      }
                      const ms = (banDays * 24 + banHours) * 60 * 60 * 1000;
                      const until = new Date(Date.now() + ms);
                      await setDoc(
                        doc(db, "users", userId),
                        { bannedUntil: until },
                        { merge: true },
                      );
                      toast({ title: "Ban temporaire appliqué" });
                    }}
                  >
                    Ban temporaire
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={userId === currentUser?.uid}
                    onClick={async () => {
                      if (userId === currentUser?.uid) {
                        toast({
                          title: "Action interdite",
                          description: "Vous ne pouvez pas vous auto-bannir.",
                          variant: "destructive",
                        });
                        return;
                      }
                      await setDoc(
                        doc(db, "users", userId),
                        { banned: true, bannedAt: serverTimestamp() },
                        { merge: true },
                      );
                      toast({ title: "Ban permanent" });
                    }}
                  >
                    Ban permanent
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={userId === currentUser?.uid}
                    onClick={async () => {
                      if (userId === currentUser?.uid) {
                        toast({
                          title: "Action interdite",
                          description:
                            "Vous ne pouvez pas lever votre propre ban via cet écran.",
                          variant: "destructive",
                        });
                        return;
                      }
                      await setDoc(
                        doc(db, "users", userId),
                        { banned: false, bannedUntil: null },
                        { merge: true },
                      );
                      toast({ title: "Ban levé" });
                    }}
                  >
                    Lever
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await setDoc(
                        doc(db, "users", userId),
                        { warnings: increment(1) },
                        { merge: true },
                      );
                      toast({ title: "Avertissement envoyé" });
                    }}
                  >
                    Warn
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-foreground/70">
                Recherchez un utilisateur ci-dessus.
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="founder">
          <div className="rounded-xl border border-border/60 bg-card p-4 space-y-6">
            <h3 className="font-semibold">Fondateur</h3>
            <div>
              <div className="text-sm font-semibold">Etat Marketplace</div>
              <div className="mt-2 text-sm text-foreground/70">
                <span id="product-count">Chargement…</span>
              </div>
              <div className="mt-2">
                <div className="space-y-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      id="maintenance-toggle"
                      type="checkbox"
                      className="rounded"
                    />{" "}
                    Activer le mode maintenance
                  </label>
                  <div className="flex items-center gap-2">
                    <select
                      id="maintenance-scope"
                      className="rounded-md bg-background px-2 py-1 border border-border/60"
                    >
                      <option value="global">Global (tout le site)</option>
                      <option value="marketplace">Marketplace</option>
                      <option value="shop">Boutique</option>
                      <option value="tickets">Tickets</option>
                    </select>
                    <input
                      id="maintenance-message"
                      className="flex-1 rounded-md bg-background px-3 py-2 border border-border/60"
                      placeholder="Message affiché pendant la maintenance"
                    />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">Quêtes personnalisées</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <Input
                  placeholder="Titre de la quête"
                  value={questTitle}
                  onChange={(e) => setQuestTitle(e.target.value)}
                />
                <Input
                  placeholder="Description"
                  value={questDesc}
                  onChange={(e) => setQuestDesc(e.target.value)}
                />
                <select
                  className="rounded-md bg-background px-2 py-1 border border-border/60"
                  value={questAction}
                  onChange={(e) => setQuestAction(e.target.value)}
                >
                  <option value="discord_join">Rejoindre Discord</option>
                  <option value="youtube_subscribe">S'abonner YouTube</option>
                  <option value="like">Like</option>
                  <option value="visit_url">Visiter une URL</option>
                  <option value="custom">Custom</option>
                </select>
                <Input
                  placeholder="Lien / cible (URL, id chaîne, etc.)"
                  value={questTarget}
                  onChange={(e) => setQuestTarget(e.target.value)}
                />
                <Input
                  type="number"
                  className="w-32"
                  placeholder="RC"
                  value={questReward}
                  onChange={(e) => setQuestReward(Number(e.target.value))}
                />
                <Button
                  size="sm"
                  className="md:col-span-2 w-fit"
                  onClick={async () => {
                    if (!questTitle) return;
                    const ref = await addDoc(collection(db, "quests"), {
                      title: questTitle,
                      description: questDesc,
                      action: questAction,
                      target: questTarget,
                      reward: Number(questReward) || 0,
                      active: true,
                      createdAt: serverTimestamp(),
                    });
                    try {
                      const usersSnap = await getDocs(
                        query(collection(db, "users")),
                      );
                      for (const d of usersSnap.docs) {
                        await updateDoc(doc(db, "users", d.id), {
                          notifications: arrayUnion({
                            type: "quest",
                            title: "Nouvelle quête disponible",
                            text: questTitle,
                            link: "/quests",
                            createdAt: Timestamp.now(),
                            read: false,
                          }),
                        });
                      }
                    } catch (e) {}
                    setQuestTitle("");
                    setQuestDesc("");
                    toast({ title: "Quête créée" });
                  }}
                >
                  Créer la quête
                </Button>
              </div>
              <div className="mt-4">
                <div className="text-sm font-semibold">Quêtes existantes</div>
                <div className="mt-2 max-h-64 overflow-auto divide-y divide-border/50">
                  {questList.length === 0 ? (
                    <div className="text-xs text-foreground/60 px-2 py-2">
                      Aucune
                    </div>
                  ) : (
                    questList.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-2 px-2 py-2"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">{q.title}</div>
                          <div className="text-xs text-foreground/60">
                            Récompense: {Number(q.reward || 0)} RC
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            if (!window.confirm("Supprimer cette quête ?"))
                              return;
                            try {
                              await deleteDoc(doc(db, "quests", q.id));
                              toast({ title: "Quête supprimée" });
                            } catch (e) {
                              console.error("quest:delete failed", e);
                              toast({
                                title: "Erreur suppression",
                                variant: "destructive",
                              });
                            }
                          }}
                        >
                          Supprimer
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">Annonce globale</div>
              <Input
                placeholder="Message à afficher"
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
              />
              <Button
                className="mt-2"
                size="sm"
                onClick={async () => {
                  await setDoc(doc(collection(db, "announcements")), {
                    text: announcement,
                    createdAt: serverTimestamp(),
                  });
                  setAnnouncement("");
                  toast({ title: "Annonce publiée" });
                }}
              >
                Publier
              </Button>
            </div>
            <div>
              <div className="text-sm font-semibold">
                Cartes cadeaux (gift cards)
              </div>
              <div className="mt-2 grid gap-2 md:grid-cols-[160px,1fr] items-end">
                <Input
                  type="number"
                  placeholder="Montant RC"
                  value={gcAmount}
                  onChange={(e) => setGcAmount(Number(e.target.value))}
                />
                <Input
                  placeholder="Code (auto si vide)"
                  value={gcCode}
                  onChange={(e) => setGcCode(e.target.value.toUpperCase())}
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs inline-flex items-center gap-1">
                    <input
                      type="radio"
                      checked={gcTarget === "all"}
                      onChange={() => setGcTarget("all")}
                    />{" "}
                    Tous
                  </label>
                  <label className="text-xs inline-flex items-center gap-1">
                    <input
                      type="radio"
                      checked={gcTarget === "email"}
                      onChange={() => setGcTarget("email")}
                    />{" "}
                    Par email
                  </label>
                </div>
                {gcTarget === "email" && (
                  <Input
                    placeholder="Email utilisateur"
                    value={gcEmail}
                    onChange={(e) => setGcEmail(e.target.value)}
                  />
                )}
                <Button
                  size="sm"
                  className="md:col-span-2 w-fit"
                  onClick={async () => {
                    const code = (gcCode || genCode()).toUpperCase();
                    let target: any = { type: "all" };
                    let notifyUsers: string[] | "all" = "all";
                    if (gcTarget === "email") {
                      const res = await getDocs(
                        query(
                          collection(db, "users"),
                          where("email", "==", gcEmail),
                        ),
                      );
                      if (res.empty) {
                        toast({
                          title: "Utilisateur introuvable",
                          variant: "destructive",
                        });
                        return;
                      }
                      const u = res.docs[0];
                      target = { type: "uid", uid: u.id };
                      notifyUsers = [u.id];
                    }
                    await setDoc(doc(db, "giftcards", code), {
                      code,
                      amount: Number(gcAmount) || 0,
                      active: true,
                      target,
                      redemptions: {},
                      createdAt: serverTimestamp(),
                    });
                    try {
                      if (notifyUsers === "all") {
                        const usersSnap = await getDocs(
                          query(collection(db, "users")),
                        );
                        for (const d of usersSnap.docs) {
                          await updateDoc(doc(db, "users", d.id), {
                            notifications: arrayUnion({
                              type: "giftcard",
                              title: "Carte cadeau disponible",
                              text: `Vous avez gagné une carte cadeau de ${Number(gcAmount) || 0} RC`,
                              code,
                              link: `/gift-card?code=${code}`,
                              createdAt: Timestamp.now(),
                              read: false,
                            }),
                          });
                        }
                      } else {
                        for (const uid of notifyUsers) {
                          await updateDoc(doc(db, "users", uid), {
                            notifications: arrayUnion({
                              type: "giftcard",
                              title: "Carte cadeau disponible",
                              text: `Vous avez gagné une carte cadeau de ${Number(gcAmount) || 0} RC`,
                              code,
                              link: `/gift-card?code=${code}`,
                              createdAt: Timestamp.now(),
                              read: false,
                            }),
                          });
                        }
                      }
                    } catch (e) {}
                    setGcCode("");
                    setGcEmail("");
                    toast({ title: "Gift card créée" });
                  }}
                >
                  Créer & Notifier
                </Button>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold">Packs RotCoins</div>
              <AdminPacks />
            </div>
            <div>
              <div className="text-sm font-semibold">
                Promotions RotCoins (%)
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  placeholder="% global"
                  value={promo}
                  onChange={(e) => setPromo(Number(e.target.value))}
                  className="w-28"
                />
                <input
                  type="datetime-local"
                  value={promoStart}
                  onChange={(e) => setPromoStart(e.target.value)}
                  className="rounded-md bg-background px-2 py-1 border border-border/60"
                />
                <span className="text-xs text-foreground/60">→</span>
                <input
                  type="datetime-local"
                  value={promoEnd}
                  onChange={(e) => setPromoEnd(e.target.value)}
                  className="rounded-md bg-background px-2 py-1 border border-border/60"
                />
                <select
                  value={promoRole}
                  onChange={(e) => setPromoRole(e.target.value)}
                  className="rounded-md bg-background px-2 py-1 border border-border/60"
                >
                  <option value="all">Tous</option>
                  <option value="user">Utilisateurs</option>
                  <option value="verified">Certifiés</option>
                </select>
                <Button
                  className="ml-2"
                  size="sm"
                  onClick={async () => {
                    const start = promoStart ? new Date(promoStart) : null;
                    const end = promoEnd ? new Date(promoEnd) : null;
                    await setDoc(
                      doc(db, "promotions", "packs"),
                      {
                        percent: Number(promo) || 0,
                        startAt: start ? Timestamp.fromDate(start) : null,
                        endAt: end ? Timestamp.fromDate(end) : null,
                        roles: promoRole === "all" ? ["all"] : [promoRole],
                        // keep legacy field for backward compat
                        all: Number(promo) || 0,
                      },
                      { merge: true },
                    );
                    toast({ title: "Promo mise à jour" });
                  }}
                >
                  Appliquer
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AdminPacks() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    id: "",
    name: "",
    rc: 0,
    price_normal: 0,
    promo_percent: 0,
    bonus_percent: 0,
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "coin_packs"), (snap) => {
      setList(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    });
    return () => unsub();
  }, []);

  const save = async () => {
    const id = form.id || undefined;
    const data = {
      name: form.name.trim(),
      rc: Number(form.rc) || 0,
      price_normal: Number(form.price_normal) || 0,
      promo_percent: Number(form.promo_percent) || 0,
      bonus_percent: Number(form.bonus_percent) || 0,
    };
    try {
      if (id) await setDoc(doc(db, "coin_packs", id), data, { merge: true });
      else await addDoc(collection(db, "coin_packs"), data);
      setForm({
        id: "",
        name: "",
        rc: 0,
        price_normal: 0,
        promo_percent: 0,
        bonus_percent: 0,
      });
      toast({ title: "Pack enregistré" });
    } catch (e) {
      console.error("packs:save", e);
      toast({ title: "Erreur enregistrement", variant: "destructive" });
    }
  };

  return (
    <div className="mt-2 grid gap-3 md:grid-cols-[320px,1fr]">
      <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
        <Input
          placeholder="Nom"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="RC"
            value={form.rc}
            onChange={(e) => setForm({ ...form, rc: Number(e.target.value) })}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="Prix (€)"
            value={form.price_normal}
            onChange={(e) =>
              setForm({ ...form, price_normal: Number(e.target.value) })
            }
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Promo %"
            value={form.promo_percent}
            onChange={(e) =>
              setForm({ ...form, promo_percent: Number(e.target.value) })
            }
          />
          <Input
            type="number"
            placeholder="Bonus %"
            value={form.bonus_percent}
            onChange={(e) =>
              setForm({ ...form, bonus_percent: Number(e.target.value) })
            }
          />
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={save}>
            {form.id ? "Mettre à jour" : "Ajouter"}
          </Button>
          {form.id && (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setForm({
                  id: "",
                  name: "",
                  rc: 0,
                  price_normal: 0,
                  promo_percent: 0,
                  bonus_percent: 0,
                })
              }
            >
              Nouveau
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-3">
        {list.length === 0 ? (
          <div className="text-xs text-foreground/60">Aucun pack</div>
        ) : (
          <div className="divide-y divide-border/60">
            {list.map((p) => (
              <div key={p.id} className="flex items-center gap-3 py-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-xs text-foreground/60">
                    {Number(p.rc || 0)} RC •{" "}
                    {Number(p.price_normal || 0).toFixed(2)}€ • Promo{" "}
                    {Number(p.promo_percent || 0)}% • Bonus{" "}
                    {Number(p.bonus_percent || 0)}%
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      rc: Number(p.rc || 0),
                      price_normal: Number(p.price_normal || 0),
                      promo_percent: Number(p.promo_percent || 0),
                      bonus_percent: Number(p.bonus_percent || 0),
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    if (!window.confirm("Supprimer ce pack ?")) return;
                    await deleteDoc(doc(db, "coin_packs", p.id));
                    toast({ title: "Pack supprimé" });
                  }}
                >
                  Supprimer
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateTicket({
  onCreate,
}: {
  onCreate: (title: string, body: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  return (
    <div className="space-y-2">
      <Input
        placeholder="Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <Input
        placeholder="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button
        onClick={() => {
          if (title) {
            onCreate(title, body);
            setTitle("");
            setBody("");
          }
        }}
      >
        Créer
      </Button>
    </div>
  );
}
