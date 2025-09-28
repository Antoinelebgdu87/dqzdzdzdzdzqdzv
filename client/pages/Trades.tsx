import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthProvider";
import { useNavigate, useSearchParams } from "react-router-dom";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

type Item = { id: string; title: string; image: string };

const CATALOG: Item[] = [
  {
    id: "it1",
    title: "Orcalitos",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F16bab7c767664419af40a866f155b85b?format=webp&width=800",
  },
  {
    id: "it2",
    title: "Lucky Block",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F326d3e85a4364ba9992e29e6a10eed37?format=webp&width=800",
  },
  {
    id: "it3",
    title: "Sharko",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F32aedddebdcd4936a9477aeeafebe29f?format=webp&width=800",
  },
  {
    id: "it4",
    title: "Squelettes",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2Fdd6de1a7138547caaadd56ba95ad92ac?format=webp&width=800",
  },
  {
    id: "it5",
    title: "Banane",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F145d1918e9d7499586d35ed1c056735d?format=webp&width=800",
  },
  {
    id: "it6",
    title: "Tortue",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F6f836c2cc37145fa801a8d7e6fac6138?format=webp&width=800",
  },
  {
    id: "it7",
    title: "Toilette",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F374e74471ed34276b0fe0237c88a5e1d?format=webp&width=800",
  },
  {
    id: "it8",
    title: "Dragon",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F2f0efad7c59f4ceeb2a07def114531b5?format=webp&width=800",
  },
  {
    id: "it9",
    title: "Tasse",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F953440e375c94db0857de93ecbe39f8c?format=webp&width=800",
  },
  {
    id: "it10",
    title: "Taupe",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F020ba7cc9d4441c59a2bd2883b854b90?format=webp&width=800",
  },
  {
    id: "it11",
    title: "Tim Cheese",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2Fe818f794e0754269a80253438dc8e4b6?format=webp&width=800",
  },
  {
    id: "it12",
    title: "Pot magique",
    image:
      "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2Fe4fdbcf327684efcbde336cd26ad102a?format=webp&width=800",
  },
];

function Gallery({ onPick }: { onPick: (it: Item) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {CATALOG.map((it) => (
        <button
          key={it.id}
          draggable
          onDragStart={(e) =>
            e.dataTransfer.setData("application/x-item-id", it.id)
          }
          onClick={() => onPick(it)}
          className="rounded-md border border-border/60 overflow-hidden bg-card hover:bg-muted"
          title="Glisser pour proposer l'objet"
        >
          <div
            className="aspect-square bg-center bg-cover"
            style={{ backgroundImage: `url(${it.image})` }}
          />
          <div className="px-2 py-1 text-xs text-foreground/80 line-clamp-1">
            {it.title}
          </div>
        </button>
      ))}
    </div>
  );
}

function DropZone({
  title,
  items,
  droppable,
  onDropItem,
  onRemove,
  offer,
  onOfferChange,
}: {
  title: string;
  items: Item[];
  droppable?: boolean;
  onDropItem: (it: Item) => void;
  onRemove: (id: string) => void;
  offer?: number;
  onOfferChange?: (n: number) => void;
}) {
  return (
    <div
      onDragOver={(e) => droppable && e.preventDefault()}
      onDrop={(e) => {
        if (!droppable) return;
        const id = e.dataTransfer.getData("application/x-item-id");
        const it = CATALOG.find((x) => x.id === id);
        if (it) onDropItem(it);
      }}
      className="rounded-xl border border-border/60 bg-card/80 p-4 min-h-[220px]"
    >
      <div className="text-sm font-semibold mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-xs text-foreground/60">Glissez des objets ici</div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((it) => (
            <li key={it.id} className="relative rounded-md overflow-hidden">
              <div
                className="aspect-square bg-center bg-cover"
                style={{ backgroundImage: `url(${it.image})` }}
                title={it.title}
              />
              {droppable && (
                <button
                  onClick={() => onRemove(it.id)}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs"
                  aria-label="Retirer"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {droppable && (
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            value={offer ?? 0}
            onChange={(e) =>
              onOfferChange?.(
                Math.max(0, Math.floor(Number(e.target.value) || 0)),
              )
            }
            placeholder="Offre (RC / Robux)"
            className="h-9 w-48"
          />
          <span className="text-xs text-foreground/60">Optionnel</span>
        </div>
      )}
    </div>
  );
}

export default function Trades() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const tradeId = sp.get("invite");
  const [trade, setTrade] = useState<any | null>(null);

  useEffect(() => {
    if (!tradeId) return;
    const ref = doc(db, "trades", tradeId);
    const unsub = onSnapshot(ref, (d) =>
      setTrade({ id: d.id, ...(d.data() as any) }),
    );
    return () => unsub();
  }, [tradeId]);

  // Join trade when opened via invite link
  useEffect(() => {
    if (!user || !tradeId) return;
    const ref = doc(db, "trades", tradeId);
    const p: string[] = trade?.participants || [];
    if (trade && !p.includes(user.uid) && p.length < 2) {
      updateDoc(ref, {
        participants: [...p, user.uid],
        updatedAt: serverTimestamp(),
        [`sides.${user.uid}`]: { items: [], offerRC: 0, accepted: false },
        status: "active",
      }).catch(() => {});
    }
  }, [user, tradeId, trade?.participants, trade?.id]);

  const me = user?.uid;
  const other =
    (trade?.participants || []).find((x: string) => x !== me) || null;
  const mySide = (trade?.sides || {})[me || ""] || {
    items: [],
    offerRC: 0,
    accepted: false,
  };
  const theirSide = (trade?.sides || {})[other || ""] || {
    items: [],
    offerRC: 0,
    accepted: false,
  };

  const mine: Item[] = (mySide.items || [])
    .map((id: string) => CATALOG.find((i) => i.id === id))
    .filter(Boolean) as Item[];
  const theirs: Item[] = (theirSide.items || [])
    .map((id: string) => CATALOG.find((i) => i.id === id))
    .filter(Boolean) as Item[];

  const createInvite = async () => {
    if (!user) return;
    const docRef = await addDoc(collection(db, "trades"), {
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      participants: [user.uid],
      status: "pending",
      sides: { [user.uid]: { items: [], offerRC: 0, accepted: false } },
    });
    setSp({ invite: docRef.id });
  };

  const copyInvite = async () => {
    const url = `${window.location.origin}/trades?invite=${trade?.id}`;
    try {
      await navigator.clipboard.writeText(url);
      alert("Lien d'invitation copié. Envoyez-le à l'autre utilisateur.");
    } catch {}
  };

  const updateMySide = async (next: {
    items?: string[];
    offerRC?: number;
    accepted?: boolean;
  }) => {
    if (!user || !trade) return;
    const ref = doc(db, "trades", trade.id);
    await setDoc(
      ref,
      {
        updatedAt: serverTimestamp(),
        [`sides.${user.uid}`]: {
          items: next.items ?? mySide.items ?? [],
          offerRC: next.offerRC ?? mySide.offerRC ?? 0,
          accepted: next.accepted ?? false,
        },
      },
      { merge: true },
    );
  };

  const canFinalize =
    Boolean(other) &&
    mySide.accepted &&
    theirSide.accepted &&
    trade?.status !== "finalized";

  const finalize = async () => {
    if (!user || !trade || !canFinalize) return;
    // Create a system thread message for both users
    const text = `ÉCHANGE FINALISÉ\nMoi: ${mine.map((i) => i.title).join(", ")} + ${mySide.offerRC || 0} RC\nToi: ${theirs.map((i) => i.title).join(", ")} + ${theirSide.offerRC || 0} RC`;
    const tRef = await addDoc(collection(db, "threads"), {
      participants: trade.participants,
      title: "Échange",
      updatedAt: serverTimestamp(),
      lastMessage: { text, senderId: "system" },
    });
    await addDoc(collection(db, "threads", tRef.id, "messages"), {
      senderId: "system",
      text,
      createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, "trades", trade.id), {
      status: "finalized",
      updatedAt: serverTimestamp(),
    });
    nav(`/messages?thread=${tRef.id}`);
  };

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold">Échanges</h1>
      {!tradeId ? (
        <>
          <p className="text-sm text-foreground/70">
            Invitez d'abord une personne pour commencer un échange.
          </p>
          <div className="mt-4 flex gap-3">
            <Button onClick={createInvite}>Créer une invitation</Button>
          </div>
        </>
      ) : !trade ? (
        <p className="text-sm text-foreground/70">Chargement…</p>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-foreground/70">
            <span>Invitation: {trade.id}</span>
            <Button size="sm" variant="outline" onClick={copyInvite}>
              Copier le lien
            </Button>
            <span className="opacity-70">•</span>
            <span>Participants: {(trade.participants || []).length}/2</span>
            {trade.status === "finalized" && (
              <span className="text-emerald-400 font-semibold">Finalisé</span>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <DropZone
              title="Vos objets"
              items={mine}
              droppable={true}
              onDropItem={(it) => {
                const ids = mySide.items || [];
                if (!ids.includes(it.id))
                  updateMySide({ items: [...ids, it.id], accepted: false });
              }}
              onRemove={(id) => {
                const ids = (mySide.items || []).filter(
                  (x: string) => x !== id,
                );
                updateMySide({ items: ids, accepted: false });
              }}
              offer={mySide.offerRC || 0}
              onOfferChange={(n) =>
                updateMySide({ offerRC: n, accepted: false })
              }
            />
            <DropZone
              title="Objets de l'autre utilisateur"
              items={theirs}
              droppable={false}
              onDropItem={() => {}}
              onRemove={() => {}}
            />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              onClick={() => updateMySide({ accepted: true })}
              disabled={mySide.accepted}
            >
              J'accepte ma partie
            </Button>
            <Button onClick={finalize} disabled={!canFinalize}>
              Finaliser l'échange
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                updateMySide({ items: [], offerRC: 0, accepted: false })
              }
            >
              Réinitialiser mes objets
            </Button>
          </div>

          <div className="mt-8">
            <h2 className="font-semibold mb-2">Galerie d'objets (démo)</h2>
            <Gallery
              onPick={(it) => {
                const ids = mySide.items || [];
                if (!ids.includes(it.id))
                  updateMySide({ items: [...ids, it.id], accepted: false });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
