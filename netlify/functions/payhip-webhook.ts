import type { Handler } from "@netlify/functions";
import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// Lazy init firebase-admin
let inited = false;
function getDb() {
  if (!inited) {
    try {
      initializeApp();
    } catch {}
    inited = true;
  }
  return getFirestore();
}

function computeCredits(amountEUR: number) {
  const rcPerEur = 100 / 1.99;
  return Math.max(0, Math.floor(amountEUR * rcPerEur));
}

function extractUid(payload: any): string | null {
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

function isAuthorized(headers: Record<string, string | undefined>, body: any, query: URLSearchParams): boolean {
  const secret = process.env.PAYHIP_WEBHOOK_SECRET || process.env.PAYHIP_SECRET;
  if (!secret) return false;
  const hdr = headers["x-payhip-secret"] || headers["x-payhip-webhook-secret"] || headers["x-webhook-secret"];
  if (hdr && String(hdr) === secret) return true;
  if (String(query.get("secret") || "") === secret) return true;
  if (body && String((body as any).secret || "") === secret) return true;
  return false;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST")
    return { statusCode: 405, body: "Method Not Allowed" };
  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const headers = Object.fromEntries(
      Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])
    );
    const query = new URLSearchParams(event.rawQuery || "");

    if (!isAuthorized(headers as any, body, query))
      return { statusCode: 401, body: JSON.stringify({ error: "unauthorized" }) };

    const eventName = String(body.event || body.type || "");
    const okEvents = [
      "sale.completed",
      "order.completed",
      "payment.succeeded",
      "purchase.completed",
    ];
    if (!okEvents.includes(eventName))
      return { statusCode: 200, body: JSON.stringify({ ok: true, skipped: true }) };

    const amountEUR = extractAmountEUR(body);
    const uid = extractUid(body);
    if (!uid || !amountEUR)
      return { statusCode: 200, body: JSON.stringify({ ok: true, missing: true }) };

    const credits = computeCredits(amountEUR);
    if (credits <= 0)
      return { statusCode: 200, body: JSON.stringify({ ok: true, zero: true }) };

    const db = getDb();
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

    return { statusCode: 200, body: JSON.stringify({ ok: true, credited: credits }) };
  } catch (e: any) {
    console.error("payhip-webhook", e?.message || e);
    return { statusCode: 500, body: JSON.stringify({ error: "server_error" }) };
  }
};
