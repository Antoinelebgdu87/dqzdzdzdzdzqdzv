import React, { useState } from "react";
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useAuth } from "@/context/AuthProvider";
import { useProfile } from "@/context/ProfileProvider";
import { db } from "@/lib/firebase";
import { emailToUsername } from "@/lib/usernameAuth";
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  setDoc,
  arrayUnion,
  increment,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export interface Product {
  id: string;
  title: string;
  price: number;
  image?: string;
  seller: { id?: string; name: string; role: string };
  free?: boolean;
}

export function ProductDetailContent({
  product,
  onClose,
}: {
  product: Product;
  onClose?: () => void;
}) {
  const { user } = useAuth();
  const { credits } = useProfile();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // compute sellerId and isSeller for UI
  const sellerId =
    (product as any)?.seller?.id ?? (product as any)?.sellerId ?? null;
  const isSeller = Boolean(user && sellerId && user.uid === sellerId);

  const purchase = async (confirm = false) => {
    setIsPurchasing(true);
    if (!user) {
      toast({
        title: "Connectez-vous",
        description: "Veuillez vous connecter pour acheter.",
        variant: "destructive",
      });
      setIsPurchasing(false);
      return;
    }

    const price = product.price || 0;

    // Prevent seller from buying their own product
    if (isSeller) {
      toast({
        title: "Achat impossible",
        description: "Vous ne pouvez pas acheter votre propre produit.",
        variant: "destructive",
      });
      setIsPurchasing(false);
      return;
    }

    try {
      if (product.free) {
        // create thread
        const thRef = await addDoc(collection(db, "threads"), {
          participants: [user.uid, sellerId].filter(Boolean),
          title: product.title,
          productId: product.id,
          order: {
            productId: product.id,
            productTitle: product.title,
            buyerId: user.uid,
            sellerId: sellerId ?? null,
            price: 0,
            createdAt: serverTimestamp(),
          },
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, "threads", thRef.id, "messages"), {
          senderId: user.uid,
          text: `Produit acheté : ${product.title}`,
          createdAt: serverTimestamp(),
        });

        // add system message to the thread
        await addDoc(collection(db, "threads", thRef.id, "messages"), {
          senderId: "system",
          text: `Message Système: Le produit '${product.title}' a été acheté. Vous êtes désormais en relation entre le client et le vendeur.`,
          createdAt: serverTimestamp(),
        });

        // remove product for everyone (delete main doc and user mirror)
        try {
          await deleteDoc(doc(db, "products", product.id));
        } catch (e) {}
        try {
          if (sellerId) {
            await deleteDoc(
              doc(
                db,
                "DataProject",
                "data1",
                "users",
                sellerId,
                "products",
                product.id,
              ),
            );
          }
        } catch (e) {}

        if (sellerId) {
          await updateDoc(doc(db, "users", sellerId), {
            notifications: arrayUnion({
              type: "thread",
              threadId: thRef.id,
              text: `${user.displayName || user.email || "Un utilisateur"} a acheté votre produit`,
              createdAt: Timestamp.now(),
              read: false,
            }),
            "stats.sales": increment(1),
            sales: increment(1),
          }).catch(() => {});
        }
        // increment buyer purchases
        try {
          await updateDoc(doc(db, "users", user.uid), {
            "stats.purchases": increment(1),
            purchases: increment(1),
          });
        } catch {}

        toast({
          title: "Achat confirmé",
          description: "Le vendeur a été contacté.",
          variant: "default",
        });
        onClose?.();
        // redirect buyer to the created thread
        navigate(`/messages?thread=${thRef.id}`);
        return;
      }

      // Paid product
      if ((credits || 0) < price) {
        toast({
          title: "Crédits insuffisants",
          description: "Vous n'avez pas assez de RotCoins.",
          variant: "destructive",
        });
        return;
      }

      const ok = window.confirm(
        `Confirmer l'achat de ${product.title} pour ${price} RC ?`,
      );
      if (!ok) return;

      // Deduct buyer credits atomically
      await updateDoc(doc(db, "users", user.uid), {
        "balances.available": increment(-price),
      } as any);

      // Create buyer transaction (record purchase)
      await addDoc(collection(db, "transactions"), {
        uid: user.uid,
        type: "purchase",
        credits: -price,
        status: "completed",
        productId: product.id,
        sellerId: sellerId ?? null,
        createdAt: serverTimestamp(),
      });

      // Create seller pending transaction and increment pending balance
      await addDoc(collection(db, "transactions"), {
        uid: sellerId ?? null,
        type: "salePending",
        credits: price,
        status: "pending",
        productId: product.id,
        buyerId: user.uid,
        createdAt: serverTimestamp(),
      });
      if (sellerId) {
        await updateDoc(doc(db, "users", sellerId), {
          "balances.pending": increment(price),
        } as any);
      }

      // remove product for everyone (delete main doc and user mirror)
      try {
        await deleteDoc(doc(db, "products", product.id));
      } catch (e) {
        // ignore
      }
      try {
        if (sellerId) {
          await deleteDoc(
            doc(
              db,
              "DataProject",
              "data1",
              "users",
              sellerId,
              "products",
              product.id,
            ),
          );
        }
      } catch (e) {
        // ignore
      }

      // create a thread between buyer and seller
      const thRef = await addDoc(collection(db, "threads"), {
        participants: [user.uid, sellerId].filter(Boolean),
        title: product.title,
        productId: product.id,
        order: {
          productId: product.id,
          productTitle: product.title,
          buyerId: user.uid,
          sellerId: sellerId ?? null,
          price: price,
          createdAt: serverTimestamp(),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "threads", thRef.id, "messages"), {
        senderId: user.uid,
        text: `Achat confirmé : ${product.title}`,
        createdAt: serverTimestamp(),
      });

      // system message
      await addDoc(collection(db, "threads", thRef.id, "messages"), {
        senderId: "system",
        text: `Message Système: Le produit '${product.title}' a été acheté. Vous êtes désormais en relation entre le client et le vendeur.`,
        createdAt: serverTimestamp(),
      });

      // remove product for everyone (delete main doc and user mirror)
      try {
        await deleteDoc(doc(db, "products", product.id));
      } catch (e) {}
      try {
        if (sellerId) {
          await deleteDoc(
            doc(
              db,
              "DataProject",
              "data1",
              "users",
              sellerId,
              "products",
              product.id,
            ),
          );
        }
      } catch (e) {}

      if (sellerId) {
        await updateDoc(doc(db, "users", sellerId), {
          notifications: arrayUnion({
            type: "thread",
            threadId: thRef.id,
            text: `${user.displayName || user.email || "Un utilisateur"} a acheté votre produit`,
            createdAt: Timestamp.now(),
            read: false,
          }),
          "stats.sales": increment(1),
          sales: increment(1),
        }).catch(() => {});
      }

      // increment buyer purchases
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "stats.purchases": increment(1),
          purchases: increment(1),
        });
      } catch {}

      toast({
        title: "Achat confirmé",
        description: "Conversation ouverte avec le vendeur.",
        variant: "default",
      });
      onClose?.();
      // redirect to messages thread
      navigate(`/messages?thread=${thRef.id}`);
    } catch (e) {
      console.error("purchase failed", e);
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer l'achat.",
        variant: "destructive",
      });
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{product.title}</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <img
            src={product.image || "/placeholder.svg"}
            alt={product.title}
            className="w-full rounded-md object-cover"
          />
        </div>
        <div className="space-y-3">
          <div className="text-sm">
            Vendeur:{" "}
            {product.seller.name && product.seller.name.includes("@")
              ? emailToUsername(product.seller.name)
              : product.seller.name}
          </div>
          <div className="text-lg font-bold">
            {product.free ? "GRATUIT" : `${product.price} RC`}
          </div>
          <div className="text-sm text-foreground/70">
            Description non fournie.
          </div>
          <div className="pt-2">
            {isSeller ? (
              <div className="text-sm text-foreground/60">
                Vous êtes le vendeur — achat désactivé.
              </div>
            ) : !product.free ? (
              <>
                {!confirmOpen ? (
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    className="w-full"
                    disabled={isPurchasing}
                  >
                    {isPurchasing ? "Traitement…" : "Acheter"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setConfirmOpen(false);
                      }}
                      className="flex-1"
                      disabled={isPurchasing}
                    >
                      Refuser
                    </Button>
                    <Button
                      onClick={() => purchase(true)}
                      className="flex-1"
                      disabled={isPurchasing}
                    >
                      {isPurchasing ? "Traitement…" : "Accepter"}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <Button
                onClick={() => purchase(true)}
                className="w-full"
                disabled={isPurchasing}
              >
                {isPurchasing ? "Traitement…" : "Acheter"}
              </Button>
            )}
          </div>
        </div>
      </div>
      <DialogFooter />
    </>
  );
}
