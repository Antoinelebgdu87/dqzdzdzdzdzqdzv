import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard, type Product } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthProvider";
import { useProfile } from "@/context/ProfileProvider";
import { db, getStorageClient } from "@/lib/firebase";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  doc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { canPublish, normalizePrice } from "@/lib/marketplace";
import { useToast } from "@/hooks/use-toast";
import ModerationWarning from "@/components/ModerationWarning";

export default function Marketplace() {
  const [queryStr, setQueryStr] = useState("");
  const [sort, setSort] = useState("recent");
  const [items, setItems] = useState<Product[]>([]);
  const { user } = useAuth();
  const { role, credits, addCredits } = useProfile();
  const { toast } = useToast();
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    const maintRef = doc(db, "maintenance", "global");
    const unsubMeta = onSnapshot(
      maintRef,
      (d) => {
        const data = d.data() as any | undefined;
        const isOn = Boolean(data?.on);
        const scope = data?.scope || "global";
        if (!isOn) return setMaintenance(false);
        setMaintenance(scope === "global" || scope === "marketplace");
      },
      () => {},
    );

    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((r) => r.status === "active");
      setItems(rows as any);
    });

    return () => {
      unsub();
      unsubMeta();
    };
  }, []);

  const products = items
    .filter((p) => p.title.toLowerCase().includes(queryStr.toLowerCase()))
    .sort((a, b) =>
      sort === "price" ? (a.price as number) - (b.price as number) : 0,
    );

  return (
    <div className="container py-10">
      <div className="sticky top-16 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-4 px-4 py-3 rounded-xl border border-border/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-bold">Marketplace</h1>
          <div className="flex flex-1 items-center gap-3 sm:justify-end">
            <Input
              value={queryStr}
              onChange={(e) => setQueryStr(e.target.value)}
              placeholder="Search products, sellers…"
              className="w-full max-w-xl h-11 rounded-xl"
            />
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Trier par" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Récents</SelectItem>
                <SelectItem value="price">Prix</SelectItem>
              </SelectContent>
            </Select>
            {user && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary">+ Ajouter</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md p-4">
                  <DialogTitle className="text-sm">Nouveau produit</DialogTitle>
                  <AddProduct
                    onCreated={async () => {}}
                    userId={user.uid}
                    sellerRole={role as any}
                    sellerName={user.displayName || user.email || "Utilisateur"}
                    onCharge={addCredits}
                    userCredits={credits}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </div>

      {maintenance ? (
        <div className="mt-6 rounded-xl border border-yellow-500/40 bg-yellow-400/90 text-black p-6 text-center">
          <div className="text-xl font-semibold">Maintenance en cours</div>
          <div className="mt-2 text-sm">
            Le marketplace est temporairement désactivé. Merci de revenir plus
            tard.
          </div>
        </div>
      ) : products.length === 0 ? (
        <div className="mt-6 rounded-xl border border-border/60 bg-card p-6 text-center">
          <div className="text-xl font-semibold">Aucun produit</div>
          <div className="mt-2 text-sm text-foreground/70">
            Aucun produit n'est disponible à la vente pour le moment.
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.map((p: any) => (
            <ProductCard
              key={p.id}
              product={{
                id: p.id,
                title: p.title,
                price: p.price ?? 0,
                image: p.imageUrl || p.image,
                free: (p.price ?? 0) === 0,
                seller: {
                  id: p.sellerId,
                  name: p.sellerName,
                  role: p.sellerRole,
                },
                rating: p.rating || 4.5,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AddProduct({
  onCreated,
  userId,
  sellerRole,
  sellerName,
  onCharge,
  userCredits,
}: {
  onCreated: () => void;
  userId: string;
  sellerRole: string;
  sellerName: string;
  onCharge: (n: number) => Promise<void>;
  userCredits: number;
}) {
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [free, setFree] = useState(false);
  const [price, setPrice] = useState<number>(3);
  const [saving, setSaving] = useState(false);
  const [moderationOpen, setModerationOpen] = useState(false);
  const [moderationReasons, setModerationReasons] = useState<string[]>([]);
  const [moderationAccepted, setModerationAccepted] = useState(false);
  const { toast } = useToast();
  const cost = sellerRole === "verified" ? 2 : 5;
  const validPrice = normalizePrice(price, free);
  // require an actual URL (imageUrl) to consider image present; files are converted on pick to imageUrl
  const imgOk = Boolean(imageUrl);
  const can = canPublish({
    title,
    hasImage: imgOk,
    price,
    free,
    balance: userCredits,
    cost,
  });

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    try {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            setFile(f);
            return;
          }
        }
        if (it.kind === "string") {
          it.getAsString((s) => {
            const trimmed = s.trim();
            if (
              trimmed.startsWith("data:image/") ||
              /(https?:\/\/.+\.(png|jpe?g|webp|gif))/i.test(trimmed)
            ) {
              setImageUrl(trimmed);
            }
          });
        }
      }
    } catch (err) {
      console.warn("paste handling failed", err);
    }
  };

  const [imageUploading, setImageUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    try {
      const dt = e.dataTransfer;
      // 1) File drop
      const file = dt.files && dt.files[0];
      if (file) {
        try {
          const p = URL.createObjectURL(file);
          setPreviewUrl(p);
        } catch {}
        const fake = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
        await onPick(fake);
        return;
      }
      // 2) URL drop (from browser)
      const uri = dt.getData("text/uri-list") || dt.getData("text/plain") || "";
      const trimmed = uri.trim();
      if (trimmed) {
        // try to extract src from dropped HTML if needed
        let val = trimmed;
        if (!/^data:image\//i.test(val) && !/^https?:\/\//i.test(val)) {
          const html = dt.getData("text/html");
          if (html) {
            const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (m?.[1]) val = m[1];
          }
        }
        if (
          /^data:image\//i.test(val) ||
          /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(val)
        ) {
          setImageUrl(val);
          setPreviewUrl(null);
          return;
        }
      }
      // 3) Items API
      const items = dt.items;
      if (items && items.length) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (it.kind === "string") {
            it.getAsString((s) => {
              const v = s.trim();
              if (
                v.startsWith("data:image/") ||
                /^https?:\/\/.+\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(v)
              ) {
                setImageUrl(v);
                setPreviewUrl(null);
              }
            });
            return;
          }
        }
      }
    } catch (err) {
      console.warn("drop handling failed", err);
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setImageUploading(true);
    let timedOut = false;
    // start a timeout: if upload doesn't finish in 20s, fallback to data URL
    const timer = window.setTimeout(() => {
      timedOut = true;
      setImageUploading(false);
      toast({
        title: "Upload lent",
        description: "Upload trop long, utilisation d'un fallback local.",
        variant: "default",
      });
      try {
        const reader = new FileReader();
        reader.onload = () => {
          setImageUrl(String(reader.result || ""));
          setFile(null);
          setPreviewUrl(null);
        };
        reader.readAsDataURL(f);
      } catch (e) {
        console.warn("fallback conversion failed after timeout", e);
      }
    }, 8000);

    try {
      // show immediate preview while uploading
      try {
        const p = URL.createObjectURL(f);
        setPreviewUrl(p);
      } catch {}

      // Try to upload immediately to storage and set imageUrl to the returned link
      const storage = await getStorageClient();
      if (storage) {
        try {
          const tmpRef = ref(
            storage,
            `products/${userId}/${Date.now()}_${f.name}`,
          );
          await uploadBytes(tmpRef, f);
          // if timed out already, don't override fallback
          if (timedOut) {
            clearTimeout(timer);
            return;
          }
          const dl = await getDownloadURL(tmpRef);
          clearTimeout(timer);
          setImageUrl(dl);
          setFile(null);
          setPreviewUrl(null);
          setImageUploading(false);
          return;
        } catch (uploadErr) {
          console.warn("upload immediate failed", uploadErr);
          // continue to fallback to data URL
        }
      }

      // Fallback: convert to data URL and set it as imageUrl
      try {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(f);
        });
        clearTimeout(timer);
        setImageUrl(data);
        setFile(null);
        setPreviewUrl(null);
        setImageUploading(false);
        return;
      } catch (err) {
        console.warn("file to dataURL failed", err);
        setFile(f);
      }
    } catch (err) {
      console.error("onPick error", err);
      toast({
        title: "Erreur image",
        description: "Impossible de traiter l'image.",
        variant: "destructive",
      });
    } finally {
      clearTimeout(timer);
      if (!timedOut) setImageUploading(false);
    }
  };

  // actual creation logic extracted so it can be called after moderation acceptance
  const doCreate = async () => {
    setSaving(true);
    try {
      let finalUrl = imageUrl;
      if (!finalUrl && file) {
        const storage = await getStorageClient();
        if (storage) {
          const tmpRef = ref(
            storage,
            `products/${userId}/${Date.now()}_${file.name}`,
          );
          await uploadBytes(tmpRef, file);
          finalUrl = await getDownloadURL(tmpRef);
        } else {
          // Fallback: convert file to data URL and store in Firestore so it can be displayed
          try {
            finalUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ""));
              reader.onerror = (err) => reject(err);
              reader.readAsDataURL(file);
            });
          } catch (err) {
            toast({
              title: "Upload image indisponible",
              description:
                "Veuillez saisir une URL d'image ou réessayer plus tard.",
              variant: "destructive",
            });
            setSaving(false);
            return;
          }
        }
      }

      // If still no image URL, use default placeholder image hosted on CDN
      const placeholder =
        "https://cdn.prod.website-files.com/643149de01d4474ba64c7cdc/65428da5c4c1a2b9740cc088_20231101-ImageNonDisponible-v1.jpg";
      if (!finalUrl) finalUrl = placeholder;

      // If flagged (any reasons), always create as pending — do not publish active even after acceptance
      const flagged = moderationReasons.length > 0;
      const status = flagged ? "pending" : "active";

      const refDoc = await addDoc(collection(db, "products"), {
        title: title.trim(),
        imageUrl: finalUrl,
        price: validPrice,
        sellerId: userId,
        sellerName,
        sellerRole,
        status,
        moderation: {
          flagged: moderationReasons.length > 0,
          reasons: moderationReasons,
          accepted: moderationAccepted,
        },
        createdAt: serverTimestamp(),
      });

      // Mirror to namespaced per-user collection for instant access
      await setDoc(
        doc(db, "DataProject", "data1", "users", userId, "products", refDoc.id),
        {
          title: title.trim(),
          imageUrl: finalUrl,
          price: validPrice,
          sellerId: userId,
          sellerName,
          sellerRole,
          status,
          moderation: {
            flagged: moderationReasons.length > 0,
            reasons: moderationReasons,
            accepted: moderationAccepted,
          },
          createdAt: serverTimestamp(),
        },
      );

      // charge only when active
      if (!flagged) await onCharge(-cost);
      onCreated();
      setTitle("");
      setImageUrl("");
      setFile(null);
      setPrice(3);
      setFree(false);
      // reset moderation state after creation
      setModerationReasons([]);
      setModerationAccepted(false);
    } catch (e) {
      console.error("product:create failed", e);
      toast({
        title: "Erreur",
        description: "Impossible de publier le produit.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    // validate and show reasons if cannot publish
    const reasons: string[] = [];
    if (!title.trim()) reasons.push("Titre requis");
    if (!imageUrl)
      reasons.push("Image requise (collez une URL ou choisissez un fichier)");
    if (userCredits < cost)
      reasons.push(`Solde insuffisant (il vous faut ${cost} RC)`);
    if (!free && (Number(price) || 0) < 3)
      reasons.push("Prix minimum 3 RC sauf si Gratuit");

    if (reasons.length > 0) {
      toast({
        title: "Impossible de publier",
        description: reasons.join(" — "),
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // call moderation endpoint
      const mod = await (
        await fetch("/api/moderate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: title }),
        })
      ).json();
      if (mod?.flagged) {
        setModerationReasons(Array.isArray(mod.reasons) ? mod.reasons : []);
        setModerationOpen(true);
        setSaving(false);
        return;
      }

      await doCreate();
    } catch (e) {
      console.error("product:create failed", e);
      toast({
        title: "Erreur",
        description: "Impossible de publier le produit.",
        variant: "destructive",
      });
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-3">
      <Input
        placeholder="Titre"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div
        className="rounded-md border border-dashed border-border/60 p-3 text-center text-sm"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        <div className="flex items-center justify-center gap-2">
          <input
            id="file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById("file")?.click()}
          >
            Choisir une image (sera convertie en lien)
          </Button>
          <span className="text-foreground/60">ou collez/glissez une URL</span>
        </div>
        {(imageUrl || previewUrl) && (
          <div className="mt-2">
            <img
              src={imageUrl || previewUrl || ""}
              alt="aperçu"
              className="mx-auto h-28 w-48 object-cover rounded-md"
            />
          </div>
        )}
        {imageUploading && (
          <div className="mt-2 text-sm text-foreground/60">
            Upload image en cours…
          </div>
        )}
      </div>
      <Input
        placeholder="URL de l'image (requis)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={free}
          onChange={(e) => setFree(e.target.checked)}
        />{" "}
        Gratuit
      </label>
      {!free && (
        <Input
          placeholder="Prix (RC) — min 3"
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
        />
      )}
      <div className="text-xs text-foreground/70">
        Frais de publication: {cost} RC (Certifié: 2 RC, sinon 5 RC)
      </div>
      <Button onClick={create} disabled={saving}>
        {saving ? "Publication…" : "Publier"}
      </Button>

      <ModerationWarning
        open={moderationOpen}
        reasons={moderationReasons}
        text={title}
        onCancel={() => setModerationOpen(false)}
        onAccept={async () => {
          // Accepting acknowledges the warning but product will remain pending review (not published)
          setModerationOpen(false);
          await doCreate();
        }}
      />
    </div>
  );
}
