import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";
import { addDoc, collection, doc, getDocs, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

type Item = { id: string; title: string; image: string };

const CATALOG: Item[] = [
  { id: "it1", title: "Orcalitos", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F16bab7c767664419af40a866f155b85b?format=webp&width=800" },
  { id: "it2", title: "Lucky Block", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F326d3e85a4364ba9992e29e6a10eed37?format=webp&width=800" },
  { id: "it3", title: "Sharko", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F32aedddebdcd4936a9477aeeafebe29f?format=webp&width=800" },
  { id: "it4", title: "Squelettes", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2Fdd6de1a7138547caaadd56ba95ad92ac?format=webp&width=800" },
  { id: "it5", title: "Banane", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F145d1918e9d7499586d35ed1c056735d?format=webp&width=800" },
  { id: "it6", title: "Tortue", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F6f836c2cc37145fa801a8d7e6fac6138?format=webp&width=800" },
  { id: "it7", title: "Toilette", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F374e74471ed34276b0fe0237c88a5e1d?format=webp&width=800" },
  { id: "it8", title: "Dragon", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F2f0efad7c59f4ceeb2a07def114531b5?format=webp&width=800" },
  { id: "it9", title: "Tasse", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F953440e375c94db0857de93ecbe39f8c?format=webp&width=800" },
  { id: "it10", title: "Taupe", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2F020ba7cc9d4441c59a2bd2883b854b90?format=webp&width=800" },
  { id: "it11", title: "Tim Cheese", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2Fe818f794e0754269a80253438dc8e4b6?format=webp&width=800" },
  { id: "it12", title: "Pot magique", image: "https://cdn.builder.io/api/v1/image/assets%2F5bddff4c4a064b01841a4121d6db322c%2Fe4fdbcf327684efcbde336cd26ad102a?format=webp&width=800" },
];

function Gallery({ onPick }: { onPick: (it: Item) => void }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
      {CATALOG.map((it) => (
        <button
          key={it.id}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("application/x-item-id", it.id);
          }}
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
  onDropItem,
  onRemove,
}: {
  title: string;
  items: Item[];
  onDropItem: (it: Item) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData("application/x-item-id");
        const it = CATALOG.find((x) => x.id === id);
        if (it) onDropItem(it);
      }}
      className="rounded-xl border border-border/60 bg-card/80 p-4 min-h-[200px]"
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
              <button
                onClick={() => onRemove(it.id)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white text-xs"
                aria-label="Retirer"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Trades() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [mine, setMine] = useState<Item[]>([]);
  const [theirs, setTheirs] = useState<Item[]>([]);
  const [partnerEmail, setPartnerEmail] = useState("");
  const canAccept = mine.length > 0 && theirs.length > 0 && Boolean(partnerEmail.trim());
  const shareText = useMemo(
    () =>
      `Proposition d'échange — Moi: ${mine.map((i) => i.title).join(", ")} ⇄ Toi: ${theirs
        .map((i) => i.title)
        .join(", ")}`,
    [mine, theirs],
  );

  const openThread = async (accepted: boolean) => {
    if (!user || !partnerEmail.trim()) return;
    const res = await getDocs(query(collection(db, "users"), where("email", "==", partnerEmail.trim())));
    if (res.empty) {
      alert("Utilisateur introuvable (email).");
      return;
    }
    const other = { id: res.docs[0].id, ...(res.docs[0].data() as any) };
    const docRef = await addDoc(collection(db, "threads"), {
      participants: [user.uid, other.id],
      title: "Échange proposé",
      updatedAt: serverTimestamp(),
      lastMessage: { text: accepted ? "Échange accepté" : "Nouvelle proposition", senderId: "system" },
    });
    const text = `${accepted ? "ÉCHANGE ACCEPTÉ" : "PROPOSITION D'ÉCHANGE"}\nMoi: ${mine
      .map((i) => i.title)
      .join(", ")}\nToi: ${theirs.map((i) => i.title).join(", ")}\nImages: ${[...mine, ...theirs]
      .map((i) => i.image)
      .slice(0, 6)
      .join(" ")}`;
    await addDoc(collection(db, "threads", docRef.id, "messages"), {
      senderId: "system",
      text,
      createdAt: serverTimestamp(),
    });
    await setDoc(
      doc(db, "threads", docRef.id),
      { lastMessage: { text, senderId: "system" }, updatedAt: serverTimestamp() },
      { merge: true },
    );
    nav(`/messages?thread=${docRef.id}`);
  };

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold">Échanges</h1>
      <p className="text-sm text-foreground/70">
        Proposez un échange en glissant des objets de la galerie vers chaque
        colonne, puis partagez ou acceptez.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <Input
          placeholder="Email de l'autre utilisateur"
          value={partnerEmail}
          onChange={(e) => setPartnerEmail(e.target.value)}
          className="w-72"
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <DropZone
          title="Vos objets"
          items={mine}
          onDropItem={(it) =>
            setMine((arr) => (arr.find((x) => x.id === it.id) ? arr : [...arr, it]))
          }
          onRemove={(id) => setMine((arr) => arr.filter((x) => x.id !== id))}
        />
        <DropZone
          title="Objets de l'autre utilisateur"
          items={theirs}
          onDropItem={(it) =>
            setTheirs((arr) => (arr.find((x) => x.id === it.id) ? arr : [...arr, it]))
          }
          onRemove={(id) => setTheirs((arr) => arr.filter((x) => x.id !== id))}
        />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <Button
          variant="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareText);
            } catch {}
            await openThread(false);
          }}
        >
          Partager l'offre
        </Button>
        <Button disabled={!canAccept} onClick={() => openThread(true)}>Accepter l'échange</Button>
        <Button variant="outline" onClick={() => { setMine([]); setTheirs([]); }}>
          Réinitialiser
        </Button>
      </div>

      <div className="mt-8">
        <h2 className="font-semibold mb-2">Galerie d'objets (démo)</h2>
        <Gallery onPick={(it) => setMine((a) => (a.find((x) => x.id === it.id) ? a : [...a, it]))} />
      </div>
    </div>
  );
}
