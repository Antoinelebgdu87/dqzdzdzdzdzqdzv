import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function OnboardingTutorial() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      { title: "Bienvenue !", desc: "Voici comment fonctionne Brainrot Market.", action: null as any },
      { title: "Acheter des RotCoins", desc: "Rendez-vous dans Boutique pour acheter des crédits via Payhip.", action: null as any },
      { title: "Vendre un produit", desc: "Dans Marketplace, ajoutez un produit, il passera en vérification si nécessaire.", action: null as any },
      { title: "Support & Tickets", desc: "Ouvrez un ticket si besoin d'aide. Notifications en temps réel.", action: null as any },
    ],
    [],
  );

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        if (!user) return;
        const uref = doc(db, "users", user.uid);
        const snap = await getDoc(uref);
        const data = snap.data() as any | undefined;
        const done = Boolean(data?.tutorial?.done);
        // Only open if TOS accepted in session and tutorial not done
        const tos = (() => {
          try { return sessionStorage.getItem("tos_accepted") === "1"; } catch { return false; }
        })();
        if (!ignore && tos && !done) setOpen(true);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [user]);

  const finish = async (skip = false) => {
    try {
      if (!user) return setOpen(false);
      await setDoc(
        doc(db, "users", user.uid),
        { tutorial: { done: true, skipped: skip, completedAt: serverTimestamp() } },
        { merge: true },
      );
    } finally {
      setOpen(false);
    }
  };

  if (!user || loading) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <DialogContent>
        <DialogTitle>{steps[step]?.title}</DialogTitle>
        <DialogDescription>{steps[step]?.desc}</DialogDescription>
        <div className="mt-5 flex items-center justify-between">
          <Button variant="ghost" onClick={() => finish(true)}>Passer</Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))}>Retour</Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>Suivant</Button>
            ) : (
              <Button onClick={() => finish(false)}>Terminer</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
