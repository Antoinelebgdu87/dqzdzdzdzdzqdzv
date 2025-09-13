import type { RequestHandler } from "express";
import { getAdminDb } from "../firebaseAdmin";

const PAYPAL_API = "https://api-m.paypal.com";

async function verifyWebhook(headers: any, body: any) {
  const clientId =
    process.env.VITE_PAYPAL_CLIENT_ID || process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET || process.env.PAYPAL_SECRET;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!clientId || !secret || !webhookId) return false;

  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(
    `${PAYPAL_API}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transmission_id: headers["paypal-transmission-id"],
        transmission_time: headers["paypal-transmission-time"],
        cert_url: headers["paypal-cert-url"],
        auth_algo: headers["paypal-auth-algo"],
        transmission_sig: headers["paypal-transmission-sig"],
        webhook_id: webhookId,
        webhook_event: body,
      }),
    },
  );
  if (!res.ok) return false;
  const data = (await res.json()) as any;
  return data.verification_status === "SUCCESS";
}

export const paypalWebhook: RequestHandler = async (req, res) => {
  try {
    const ok = await verifyWebhook(req.headers, req.body);
    if (!ok) return res.status(400).json({ error: "invalid_signature" });

    const event = req.body;
    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED")
      return res.json({ ok: true });

    const resource = event.resource || {};
    const paymentId = resource.id;
    const amount = Number(resource.amount?.value || 0);
    const currency = resource.amount?.currency_code || "EUR";
    const purchaseUnit = Array.isArray(resource.purchase_units)
      ? resource.purchase_units[0]
      : undefined;
    const uid = purchaseUnit?.custom_id || null;

    const db = await getAdminDb();
    // Dynamically import FieldValue to avoid requiring firebase-admin at dev startup
    // @ts-ignore - optional dependency
    const { FieldValue } = await import("firebase-admin/firestore");
    const batch = db.batch();
    const payRef = db.collection("payments").doc(paymentId);
    batch.set(
      payRef,
      {
        id: paymentId,
        amount,
        currency,
        raw: event,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    if (uid) {
      const userRef = db.collection("users").doc(uid);
      batch.set(
        userRef,
        { "balances.available": FieldValue.increment(amount) },
        { merge: true },
      );
      // Optional: record transaction
      batch.set(db.collection("transactions").doc(), {
        uid,
        type: "credits_purchase",
        orderId: paymentId,
        amountEUR: amount,
        status: "completed",
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();
    res.json({ ok: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("paypal:webhook", e);
    res.status(500).json({ error: "server_error" });
  }
};
