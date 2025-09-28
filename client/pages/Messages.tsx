import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSearchParams, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

export default function Messages() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "threads"),
      where("participants", "array-contains", user.uid),
      orderBy("updatedAt", "desc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => setThreads(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => {
        console.error("messages:onSnapshot error", err);
        const msg = String(err?.message || err);
        const match = msg.match(
          /https?:\/\/console\.firebase\.google\.com\/[\S]+/,
        );
        const indexUrl = match ? match[0] : undefined;
        try {
          // user-friendly toast with index URL if available
          toast({
            title: "Firestore: index requis",
            description: indexUrl
              ? `Cette requête nécessite un index. Ouvrez: ${indexUrl}`
              : "Cette requête Firestore nécessite un index composite. Créez-le dans la console Firebase.",
            variant: "destructive",
          });
        } catch {}
      },
    );
    return () => unsub();
  }, [user]);

  // sync active thread from URL ?thread=
  useEffect(() => {
    const param = searchParams.get("thread");
    if (param) setActive(param);
  }, [searchParams]);

  return (
    <div className="container py-10 grid gap-4 md:grid-cols-[260px,1fr]">
      <div className="rounded-xl border border-border/60 bg-card p-3">
        <div className="text-sm font-semibold">Messagerie</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link to="/trade">
            <Button variant="outline" size="sm">+ Trade</Button>
          </Link>
          <Link to="/marketplace">
            <Button variant="outline" size="sm">Marketplace</Button>
          </Link>
          <Link to="/marketplace">
            <Button size="sm">Vendre</Button>
          </Link>
        </div>
        <div className="mt-2 divide-y divide-border/60 max-h-[60vh] overflow-auto">
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => setSearchParams({ thread: t.id })}
              className={`w-full text-left px-2 py-2 hover:bg-muted ${active === t.id ? "bg-muted" : ""}`}
            >
              <div className="text-sm">{t.title || "Conversation"}</div>
              <div className="text-xs text-foreground/60 truncate">
                {t.lastMessage?.text || "���"}
              </div>
            </button>
          ))}
          {threads.length === 0 && (
            <div className="px-2 py-4 text-sm text-foreground/60">
              Aucun message
            </div>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-3 min-h-[50vh]">
        {active ? (
          <Thread id={active} />
        ) : (
          <div className="text-sm text-foreground/70">
            Sélectionnez une conversation
          </div>
        )}
      </div>
    </div>
  );
}

function Thread({ id }: { id: string }) {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [threadMeta, setThreadMeta] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [showOffer, setShowOffer] = useState(false);
  const [myProducts, setMyProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !showOffer) return;
    const q = query(
      collection(db, "products"),
      where("sellerId", "==", user.uid),
    );
    const unsub = onSnapshot(q, (snap) => {
      setMyProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user, showOffer]);

  useEffect(() => {
    const q = query(
      collection(db, "threads", id, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(q, (snap) =>
      setMsgs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
    return () => unsub();
  }, [id]);

  // subscribe to thread meta to know if it's a system thread
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "threads", id), (d) => {
      if (d.exists()) setThreadMeta(d.data());
      else setThreadMeta(null);
    });
    return () => unsub();
  }, [id]);

  // subscribe to the other participant for name/role/status
  useEffect(() => {
    const otherId = threadMeta?.participants?.find(
      (p: string) => p !== user?.uid,
    );
    if (!otherId) return;
    const unsub = onSnapshot(doc(db, "users", otherId), (d) => {
      setOtherUser(d.data());
    });
    return () => unsub();
  }, [threadMeta?.participants, user?.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  useEffect(() => {
    if (!user) return;
    // mark as read
    updateDoc(doc(db, "threads", id), {
      [`lastReadAt.${user.uid}`]: serverTimestamp(),
    }).catch(() => {});
  }, [id, user]);

  const { toast } = useToast();
  const roleLabel = (role?: string) => {
    if (!role) return "";
    if (role === "verified") return "Certifié";
    if (role === "helper") return "Helper";
    if (role === "moderator") return "Modérateur";
    if (role === "founder") return "Fondateur";
    return "User";
  };

  const send = async () => {
    if (!user || !text.trim()) return;
    // do not allow sending into system threads
    if (threadMeta?.system) {
      toast({
        title: "Impossible de répondre",
        description:
          "Ce message provient du système et n'accepte pas de réponses.",
        variant: "default",
      });
      setText("");
      return;
    }
    try {
      await addDoc(collection(db, "threads", id, "messages"), {
        senderId: user.uid,
        text: text.trim(),
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "threads", id),
        {
          lastMessage: { text: text.trim(), senderId: user.uid },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setText("");
    } catch (e) {
      console.error("thread:send failed", e);
    }
  };

  const sendProductOffer = async (p: any) => {
    if (!user || !p) return;
    if (threadMeta?.system) {
      toast({
        title: "Impossible de répondre",
        description:
          "Ce message provient du système et n'accepte pas de réponses.",
        variant: "default",
      });
      return;
    }
    try {
      await addDoc(collection(db, "threads", id, "messages"), {
        senderId: user.uid,
        type: "product_offer",
        product: {
          id: p.id,
          title: p.title,
          price: p.price ?? 0,
          image: p.imageUrl || p.image || null,
        },
        createdAt: serverTimestamp(),
      });
      await setDoc(
        doc(db, "threads", id),
        {
          lastMessage: {
            text: `Offre produit: ${p.title} (${p.price ?? 0} RC)`,
            senderId: user.uid,
          },
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setShowOffer(false);
    } catch (e) {
      console.error("thread:sendOffer failed", e);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mx-2 mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold truncate">
          {threadMeta?.title || "Conversation"}
        </div>
        {otherUser && <UserStatus otherUser={otherUser} />}
      </div>
      {threadMeta?.productId || threadMeta?.order ? (
        <div className="mx-2 mb-2 rounded-md border border-primary/40 bg-primary/10 p-2 text-xs">
          <div className="font-semibold">
            Commande: {threadMeta?.order?.productTitle || threadMeta?.title}
          </div>
          <div className="opacity-80">
            Prix: {threadMeta?.order?.price ?? "-"} RC • Acheteur:{" "}
            {threadMeta?.order?.buyerId
              ? threadMeta.order.buyerId === user?.uid
                ? "vous"
                : threadMeta.order.buyerId
              : ""}
          </div>
        </div>
      ) : null}
      <div className="flex-1 space-y-2 overflow-auto p-2">
        {msgs.map((m) => {
          if (m.type === "product_offer") {
            const mine = m.senderId === user?.uid;
            const p = m.product || {};
            return (
              <div key={m.id} className={`max-w-[75%] ${mine ? "ml-auto" : ""}`}>
                <div
                  className={`mb-1 text-[10px] text-foreground/60 ${mine ? "text-right" : ""}`}
                >
                  {mine ? "Vous" : otherUser?.username || otherUser?.email || "Utilisateur"}
                </div>
                <div className={`rounded-md border border-border/60 bg-card/70 p-2 text-sm ${mine ? "bg-secondary/10" : "bg-muted/70"}`}>
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt={p.title} className="h-12 w-12 rounded object-cover" />
                    ) : null}
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.title || "Produit"}</div>
                      <div className="text-xs text-foreground/70">{(p.price ?? 0).toLocaleString()} RC</div>
                      <div className="mt-2 flex gap-2">
                        <Link to="/marketplace">
                          <Button size="sm" variant="outline">Voir Marketplace</Button>
                        </Link>
                        <Button size="sm" variant="secondary" onClick={() => navigator?.clipboard?.writeText(String(p.id || ""))}>Copier ID</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          if (m.senderId === "system")
            return (
              <div
                key={m.id}
                className="text-center text-xs text-foreground/60"
              >
                {m.text}
              </div>
            );
          const mine = m.senderId === user?.uid;
          const name = mine
            ? "Vous"
            : otherUser?.username || otherUser?.email || "Utilisateur";
          const role = mine ? "" : roleLabel(otherUser?.role);
          return (
            <div key={m.id} className={`max-w-[75%] ${mine ? "ml-auto" : ""}`}>
              <div
                className={`mb-1 text-[10px] text-foreground/60 ${mine ? "text-right" : ""}`}
              >
                {name}
                {role ? ` (${role})` : ""}
              </div>
              <div
                className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words ${mine ? "bg-secondary/20" : "bg-muted"}`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {threadMeta?.system ? (
        <div className="mt-2 text-sm text-foreground/60">
          Message système — les réponses sont désactivées.
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" aria-label="Emoji" onClick={() => setText((t) => `${t} 😀`)}>
              <span className="text-base">😀</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowOffer((v) => !v)}>
              Proposer un produit
            </Button>
            <Link to="/marketplace">
              <Button variant="outline" size="sm">Marketplace</Button>
            </Link>
            <Link to="/trade">
              <Button variant="outline" size="sm">Trade</Button>
            </Link>
          </div>
          {showOffer && (
            <div className="mt-2 max-h-40 overflow-auto rounded-md border border-border/60 bg-muted/40 p-2 space-y-2">
              {myProducts.length === 0 ? (
                <div className="text-xs text-foreground/60">
                  Aucun produit. <Link to="/marketplace" className="underline">Mettre en vente</Link>
                </div>
              ) : (
                myProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0 text-sm truncate">
                      {p.title} — {(p.price ?? 0).toLocaleString()} RC
                    </div>
                    <Button size="sm" onClick={() => sendProductOffer(p)}>Envoyer</Button>
                  </div>
                ))
              )}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Votre message…"
              onKeyDown={(e) => {
                if (e.key === "Enter") send();
              }}
            />
            <Button onClick={send}>Envoyer</Button>
          </div>
        </>
      )}
    </div>
  );
}

function UserStatus({ otherUser }: { otherUser: any }) {
  const ts = otherUser?.lastSeen?.toMillis?.() ?? 0;
  let label = "hors ligne";
  let color = "bg-gray-400";
  if (ts) {
    const diff = Date.now() - ts;
    if (diff < 2 * 60 * 1000) {
      label = "en ligne";
      color = "bg-emerald-500";
    } else if (diff < 10 * 60 * 1000) {
      label = "inactif";
      color = "bg-amber-500";
    }
  }
  return (
    <div className="text-xs text-foreground/70 inline-flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      <span className="capitalize">{label}</span>
      <span className="opacity-60">•</span>
      <span className="truncate max-w-[160px]">
        {otherUser?.username || otherUser?.email || "Utilisateur"}
      </span>
    </div>
  );
}
