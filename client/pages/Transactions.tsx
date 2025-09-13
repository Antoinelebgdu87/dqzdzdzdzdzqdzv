import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  doc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/context/ProfileProvider";

export default function Transactions() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [balances, setBalances] = useState<{
    available: number;
    pending: number;
  } | null>(null);
  const { toast } = useToast();
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!user) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    const q = query(
      collection(db, "transactions"),
      where("uid", "==", user.uid),
      orderBy("createdAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("transactions:onSnapshot error", err);
        const msg = String(err?.message || err);
        toast({
          title: "Erreur de données",
          description: msg,
          variant: "destructive",
        });
      },
    );

    // subscribe to user balances to show pending amount
    const userRef = doc(db, "users", user.uid);
    const unsubUser = onSnapshot(userRef, (d) => {
      const data = d.data() as any | undefined;
      if (!data) return setBalances(null);
      const available = Number((data.balances && data.balances.available) || 0);
      const pending = Number((data.balances && data.balances.pending) || 0);
      setBalances({ available, pending });
    });

    return () => {
      unsub();
      unsubUser();
      window.clearInterval(id);
    };
  }, [user, toast]);

  function labelForType(t: string) {
    if (t === "salePending") return "En attente";
    if (t === "saleReleased") return "Validé";
    if (t === "admin_revoke") return "Retiré par admin";
    if (t === "quest") return "Reçu via quête";
    if (t === "giftcard") return "Carte cadeau";
    if (t === "credits_purchase") return "Achat boutique";
    if (t === "purchase") return "Achat";
    return t;
  }

  function eta(createdAt: any) {
    const ts = createdAt?.toMillis?.() ?? 0;
    if (!ts) return "";
    const total = 60; // seconds
    const elapsed = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    const left = Math.max(0, total - elapsed);
    return left > 0 ? `${left}s` : "bientôt";
  }
  if (!user) return <div className="container py-10">Connectez-vous.</div>;
  return (
    <div className="container py-10">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-2xl font-bold">Transactions</h1>
        {balances && (
          <div className="text-sm text-foreground/70">
            Solde disponible:{" "}
            <strong className="ml-2">{balances.available} RC</strong>
            {balances.pending > 0 && (
              <span className="ml-4 text-amber-400">
                En attente: {balances.pending} RC
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border/60 bg-card">
        <div className="grid grid-cols-4 px-4 py-2 text-xs text-foreground/60 border-b border-border/60">
          <div>Date</div>
          <div>Type</div>
          <div>Détails</div>
          <div>Montant</div>
        </div>
        <div className="h-[60vh] overflow-auto">
          {rows.length === 0 ? (
            <div className="p-4 text-sm text-foreground/70">
              Aucune transaction.
            </div>
          ) : (
            rows.map((t) => (
              <div
                key={t.id}
                className="grid grid-cols-4 px-4 py-2 border-t border-border/50 text-sm"
              >
                <div>
                  {t.createdAt?.toDate
                    ? new Date(t.createdAt.toDate()).toLocaleString()
                    : ""}
                </div>
                <div>
                  <div className="capitalize">{labelForType(t.type)}</div>
                  {t.adminName && (
                    <div className="text-xs text-foreground/60">
                      par {t.adminName}
                    </div>
                  )}
                  {t.status === "pending" && (
                    <div className="text-xs text-amber-400 font-semibold">
                      En attente{" "}
                      {t.type === "salePending" ? `• ${eta(t.createdAt)}` : ""}
                    </div>
                  )}
                </div>
                <div>{t.orderId || t.note || "—"}</div>
                <div>
                  {t.credits
                    ? `${t.credits} RC`
                    : t.amountEUR
                      ? `${t.amountEUR}€`
                      : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
