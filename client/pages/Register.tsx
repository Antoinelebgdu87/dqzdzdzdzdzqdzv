import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const schema = z.object({
  username: z.string().min(3, "Minimum 3 caractères"),
  password: z.string().min(6, "Minimum 6 caractères"),
});

export default function Register() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  async function onSubmit(values: z.infer<typeof schema>) {
    const { createUserWithEmailAndPassword, updateProfile } = await import(
      "firebase/auth"
    );
    const { doc, setDoc, serverTimestamp, getDoc, addDoc, collection } =
      await import("firebase/firestore");
    const { usernameToEmail, normalizeUsername } = await import(
      "@/lib/usernameAuth"
    );
    const { db } = await import("@/lib/firebase");
    const mod = await import("@/lib/firebase");
    const auth = mod.auth;

    if (typeof window !== "undefined" && !navigator.onLine) {
      toast({
        title: "Hors-ligne",
        description: "Vous êtes hors-ligne. Vérifiez votre connexion et réessayez.",
        variant: "destructive",
      });
      return;
    }

    if (!auth) {
      toast({
        title: "Auth indisponible",
        description: "Réessayez dans le navigateur (client).",
      });
      return;
    }

    try {
      const uname = normalizeUsername(values.username);
      // Check username availability
      const unameDoc = await getDoc(doc(db, "usernames", uname));
      if (unameDoc.exists()) {
        toast({
          title: "Pseudo indisponible",
          description: "Choisissez un autre pseudo.",
          variant: "destructive",
        });
        return;
      }

      const pseudoEmail = usernameToEmail(uname);
      // retry on network errors
      let cred: any = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          cred = await createUserWithEmailAndPassword(
            auth,
            pseudoEmail,
            values.password,
          );
          break;
        } catch (e: any) {
          const code = String(e?.code || e?.message || e);
          // firebase uses 'auth/network-request-failed' code for network issues
          const isNetwork = code.includes("network") || code.includes("auth/network-request-failed");
          if (isNetwork && attempt < 2) {
            // wait then retry
            await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            continue;
          }
          throw e;
        }
      }
      if (!cred) throw new Error("createUser failed");

      try {
        if (auth.currentUser)
          await updateProfile(auth.currentUser, {
            displayName: uname,
          });
      } catch (e) {
        console.warn("updateProfile failed", e);
      }

      try {
        await setDoc(
          doc(db, "users", cred.user.uid),
          {
            email: pseudoEmail,
            username: uname,
            role: "user",
            balances: { available: 5, pending: 0 },
            quests: { completed: [], progress: {} },
            stats: { sales: 0, purchases: 0, joinedAt: serverTimestamp() },
            lastSeen: serverTimestamp(),
          },
          { merge: true },
        );
        await setDoc(
          doc(db, "usernames", uname),
          { uid: cred.user.uid, createdAt: serverTimestamp() },
          { merge: false },
        );
        try {
          await addDoc(collection(db, "transactions"), {
            uid: cred.user.uid,
            type: "signup_bonus",
            credits: 5,
            status: "completed",
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error("register:bonus tx failed", e);
        }
      } catch (e) {
        console.error("register:setUser failed", e);
        toast({
          title: "Erreur enregistreur",
          description: "Impossible de créer le profil. Réessayez.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: `Bienvenue ${uname} 🎉` });
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("createUser failed", err);
      const code = err?.code || err?.message || "";
      if (
        String(code).includes("network") ||
        String(code).includes("auth/network-request-failed")
      ) {
        toast({
          title: "Erreur réseau",
          description: "Vérifiez votre connexion internet et réessayez.",
          variant: "destructive",
        });
      } else if (String(code).includes("auth/email-already-in-use")) {
        toast({
          title: "Email déjà utilisé",
          description: "Utilisez un autre email ou connectez-vous.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: "Impossible de créer le compte. Réessayez plus tard.",
          variant: "destructive",
        });
      }
    }
  }

  return (
    <div className="container max-w-md py-12">
      <h1 className="font-display text-2xl font-bold">Créer un compte</h1>
      <p className="text-sm text-foreground/70">
        Rejoignez Brainrot Market 🇫🇷 en quelques secondes.
      </p>
      <div className="mt-6 rounded-xl border border-border/60 bg-card p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pseudo</FormLabel>
                  <FormControl>
                    <Input placeholder="Votre pseudo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mot de passe</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary"
            >
              Créer mon compte
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
