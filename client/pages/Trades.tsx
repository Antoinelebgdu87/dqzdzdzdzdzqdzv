import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type Item = { id: string; title: string; image: string };

const CATALOG: Item[] = [
  { id: "it1", title: "Shark", image: "/placeholder.svg" },
  { id: "it2", title: "Banane", image: "/placeholder.svg" },
  { id: "it3", title: "Lucky Block", image: "/placeholder.svg" },
  { id: "it4", title: "Squelette", image: "/placeholder.svg" },
  { id: "it5", title: "Dragon", image: "/placeholder.svg" },
  { id: "it6", title: "Café", image: "/placeholder.svg" },
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
  const [mine, setMine] = useState<Item[]>([]);
  const [theirs, setTheirs] = useState<Item[]>([]);
  const canAccept = mine.length > 0 && theirs.length > 0;
  const shareText = useMemo(
    () =>
      `Proposition d'échange — Moi: ${mine.map((i) => i.title).join(", ")} ⇄ Toi: ${theirs
        .map((i) => i.title)
        .join(", ")}`,
    [mine, theirs],
  );

  return (
    <div className="container py-10">
      <h1 className="font-display text-2xl font-bold">Échanges</h1>
      <p className="text-sm text-foreground/70">
        Proposez un échange en glissant des objets de la galerie vers chaque
        colonne, puis partagez ou acceptez.
      </p>

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
              alert("Lien copié dans le presse-papiers (texte de l'offre). Partagez-le à votre partenaire.");
            } catch {}
          }}
        >
          Partager l'offre
        </Button>
        <Button disabled={!canAccept} onClick={() => alert("Échange accepté (prototype)")}>Accepter l'échange</Button>
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
