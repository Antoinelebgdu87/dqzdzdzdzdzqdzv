import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: any;
  }
}

export default function PayPalCheckout({
  amount,
  currency = "EUR",
  onSuccess,
  userId,
}: {
  amount: string;
  currency?: string;
  onSuccess: (orderId: string) => void;
  userId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId) return;
    const qs = new URLSearchParams({
      "client-id": clientId,
      currency,
    }).toString();
    const src = `https://www.paypal.com/sdk/js?${qs}`;

    let existing = document.querySelector(
      `script[src^="https://www.paypal.com/sdk/js"]`,
    ) as HTMLScriptElement | null;

    // If an existing PayPal script points to a different client or params, remove it
    if (existing && existing.src !== src) {
      try {
        existing.remove();
      } catch {}
      existing = null;
    }

    const script =
      existing ??
      Object.assign(document.createElement("script"), {
        src,
        async: true,
      });

    // Attach metadata for easier debugging
    try {
      script.setAttribute("data-paypal-client-id", clientId);
    } catch {}
    script.crossOrigin = "anonymous";

    if (!existing) document.body.appendChild(script);

    const onLoad = () => {
      // ensure SDK available
      if ((window as any).paypal) setReady(true);
      else {
        console.error("PayPal script loaded but window.paypal is missing", {
          src,
          clientId,
        });
        setReady(false);
      }
    };

    const onError = (ev: Event) => {
      // Provide richer info in logs
      console.error("PayPal script failed to load", {
        src: script.src,
        event: ev,
        clientId,
      });
      setReady(false);
    };

    // Timeout fallback
    const timeout = setTimeout(() => {
      if (!(window as any).paypal) {
        console.error("PayPal SDK load timed out", { src, clientId });
        setReady(false);
      }
    }, 12000);

    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);

    return () => {
      clearTimeout(timeout);
      try {
        script.removeEventListener("load", onLoad);
      } catch {}
      try {
        script.removeEventListener("error", onError);
      } catch {}
    };
  }, [clientId, currency]);

  useEffect(() => {
    if (!ready || !window.paypal || !ref.current) return;
    const buttons = window.paypal.Buttons({
      style: {
        layout: "horizontal",
        color: "blue",
        shape: "pill",
        label: "pay",
      },
      createOrder: (_: any, actions: any) =>
        actions.order.create({
          intent: "CAPTURE",
          application_context: {
            brand_name:
              (import.meta.env.VITE_PAYPAL_APP_NAME as string) ||
              "BrainrotMarket",
          },
          purchase_units: [
            {
              amount: { value: amount },
              custom_id: userId || undefined,
            },
          ],
        }),
      onApprove: async (_: any, actions: any) => {
        try {
          const details = await actions.order.capture();
          onSuccess(details.id);
        } catch (err) {
          console.error("PayPal onApprove error", err);
        }
      },
    });
    try {
      buttons.render(ref.current);
    } catch (err) {
      console.error("PayPal render failed", err);
      setReady(false);
    }
    return () => {
      try {
        buttons.close();
      } catch {}
    };
  }, [ready, amount, currency, onSuccess]);

  if (!clientId) {
    return (
      <div className="rounded-md border border-border/60 bg-card p-3 text-sm text-foreground/80">
        PayPal non configuré. Ajoutez VITE_PAYPAL_CLIENT_ID dans les variables
        d'environnement puis rechargez.
      </div>
    );
  }

  return <div ref={ref} />;
}
