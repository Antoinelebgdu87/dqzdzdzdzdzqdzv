import type { RequestHandler } from "express";
import { getAdminDb } from "../firebaseAdmin";

function computeCredits(amountEUR: number) {
  // 100 RC = 1.99€ => RC per € = 100/1.99
  const rcPerEur = 100 / 1.99;
  return Math.max(0, Math.floor(amountEUR * rcPerEur));
}

function extractUid(payload: any): string | null {
  // Try several common places where a custom field might be stored
  if (!payload) return null;
  const p = payload as any;
  if (typeof p.uid === "string") return p.uid;
  if (typeof p.userId === "string") return p.userId;
  if (p.custom_fields && typeof p.custom_fields.uid === "string")
    return p.custom_fields.uid;
  if (p.data?.order?.custom_fields?.uid)
    return String(p.data.order.custom_fields.uid);
  if (p.metadata?.uid) return String(p.metadata.uid);
  return null;
}

function extractAmountEUR(payload: any): number {
  const p = payload || {};
  const candidates = [
    p.amount,
    p.total,
    p.price,
    p.data?.order?.total,
    p.data?.order?.amount,
  ]
    .map((v: any) => (v != null ? Number(v) : NaN))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  return candidates.length ? candidates[0] : 0;
}

function isAuthorized(req: any): boolean {
  const secret = process.env.PAYHIP_WEBHOOK_SECRET || process.env.PAYHIP_SECRET;
  if (!secret) return false;
  const hdr =
    req.headers["x-payhip-secret"] ||
    req.headers["x-payhip-webhook-secret"] ||
    req.headers["x-webhook-secret"];
  if (hdr && String(hdr) === secret) return true;
  if (req.query && String(req.query.secret || "") === secret) return true;
  // As a fallback, accept a field in the body (not ideal but pragmatic if Payhip allows it)
  if (req.body && String(req.body.secret || "") === secret) return true;
  return false;
}

export const payhipWebhookExpress: RequestHandler = async (req, res) => {
  try {
    if (!isAuthorized(req)) return res.status(401).json({ error: "unauthorized" });

    const payload = req.body || {};
    const event = String(payload.event || payload.type || "");

    // Only act on successful sale events
    const okEvents = [
      "sale.completed",
      "order.completed",
      "payment.succeeded",
      "purchase.completed",
    ];
    if (!okEvents.includes(event)) return res.json({ ok: true, skipped: true });

    const amountEUR = extractAmountEUR(payload);
    const uid = extractUid(payload);
    if (!uid || !amountEUR) return res.json({ ok: true, missing: true });

    const credits = computeCredits(amountEUR);
    if (credits <= 0) return res.json({ ok: true, zero: true });

    const db = await getAdminDb();
    // @ts-ignore
    const { FieldValue } = await import("firebase-admin/firestore");

    const batch = db.batch();
    const userRef = db.collection("users").doc(uid);
    batch.set(
      userRef,
      { "balances.available": FieldValue.increment(credits) },
      { merge: true },
    );
    batch.set(db.collection("transactions").doc(), {
      uid,
      type: "credits_purchase",
      amountEUR,
      credits,
      status: "completed",
      createdAt: FieldValue.serverTimestamp(),
      provider: "payhip",
    });
    await batch.commit();

    res.json({ ok: true, credited: credits });
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("payhip:webhook", e?.message || e);
    res.status(500).json({ error: "server_error" });
  }
}
