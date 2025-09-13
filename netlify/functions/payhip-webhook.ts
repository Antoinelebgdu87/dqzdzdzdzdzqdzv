import type { Handler } from "@netlify/functions";
import crypto from "crypto";
import { getAdminDb } from "../../server/firebaseAdmin";

// Mapping of Payhip product permalink (or short code) to pack id and coins
const PRODUCT_MAP: { [key: string]: { packId: string; coins: number; bonus: number } } = {
  // map by the short code part (b/<code>) and full permalink
  "https://payhip.com/b/lI6ti": { packId: "starter", coins: 25, bonus: 0 },
  "https://payhip.com/b/HIQqr": { packId: "gamer", coins: 50, bonus: 1 },
  "https://payhip.com/b/SFihg": { packId: "elite", coins: 200, bonus: 3 },
  "https://payhip.com/b/KwS4N": { packId: "pro", coins: 500, bonus: 6 },
  "https://payhip.com/b/ruMHK": { packId: "legend", coins: 1000, bonus: 10 },
};

function timingSafeEqual(a: string, b: string) {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch (e) {
    return false;
  }
}

export const handler: Handler = async (event) => {
  const secret = process.env.PAYHIP_WEBHOOK_SECRET;
  if (!secret) {
    return { statusCode: 500, body: JSON.stringify({ error: "payhip_secret_not_configured" }) };
  }

  const rawBody = event.body ?? "";

  // Try header signature first (x-payhip-signature)
  const headerSig = (event.headers["x-payhip-signature"] || event.headers["X-Payhip-Signature"] || "") as string;
  let verified = false;

  try {
    if (headerSig) {
      const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      verified = timingSafeEqual(computed, headerSig);
    }
  } catch (e) {
    // ignore
  }

  let payload: any = null;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "invalid_json" }) };
  }

  // Some Payhip integrations include a signature field in the JSON body
  if (!verified && payload && payload.signature && secret) {
    try {
      const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      verified = timingSafeEqual(computed, payload.signature);
    } catch (e) {}
  }

  if (!verified) {
    return { statusCode: 401, body: JSON.stringify({ error: "invalid_signature" }) };
  }

  // Build credit total and determine buyer
  const items: any[] = Array.isArray(payload.items) ? payload.items : [];
  let totalCredits = 0;
  const matchedProducts: string[] = [];

  for (const it of items) {
    const permalink = it.product_permalink || it.product_permalink_full || it.product_permalink_url || it.product_permalink || "";
    const permalinkNormalized = permalink.split("?")[0];
    const mapping = PRODUCT_MAP[permalinkNormalized] || PRODUCT_MAP[it.product_permalink];
    if (mapping) {
      const credits = mapping.coins + Math.round((mapping.coins * (mapping.bonus || 0)) / 100);
      totalCredits += credits * (Number(it.quantity || 1));
      matchedProducts.push(mapping.packId);
    } else {
      // try to match by permalink short code
      if (permalinkNormalized) {
        for (const k of Object.keys(PRODUCT_MAP)) {
          if (k.includes(permalinkNormalized) || permalinkNormalized.includes(k)) {
            const m = PRODUCT_MAP[k];
            const credits = m.coins + Math.round((m.coins * (m.bonus || 0)) / 100);
            totalCredits += credits * (Number(it.quantity || 1));
            matchedProducts.push(m.packId);
            break;
          }
        }
      }
    }
  }

  if (totalCredits <= 0) {
    // nothing to do
    return { statusCode: 200, body: JSON.stringify({ ok: true, processed: 0 }) };
  }

  const db = await getAdminDb();
  // @ts-ignore
  const { FieldValue } = await import("firebase-admin/firestore");

  // Determine buyer UID: try payload.buyer (if Payhip preserved query param), else payload.email -> lookup
  let buyerUid: string | null = null;
  if (payload.buyer) buyerUid = String(payload.buyer);

  if (!buyerUid && payload.items && payload.items.length) {
    // Sometimes product_permalink may contain ?buyer=UID
    for (const it of payload.items) {
      const perm = it.product_permalink || "";
      if (perm && perm.includes("?")) {
        try {
          const url = new URL(perm);
          const b = url.searchParams.get("buyer");
          if (b) {
            buyerUid = b;
            break;
          }
        } catch (e) {}
      }
    }
  }

  if (!buyerUid && payload.email) {
    // find user by email
    try {
      const usersSnap = await db.collection("users").where("email", "==", String(payload.email)).limit(1).get();
      if (!usersSnap.empty) buyerUid = usersSnap.docs[0].id;
    } catch (e) {}
  }

  // Create credits_purchase (credit buyer immediately if possible)
  const txs: any[] = [];
  try {
    if (buyerUid) {
      // increment buyer available balance
      await db.collection("users").doc(buyerUid).set({ balances: { available: FieldValue.increment(totalCredits) } }, { merge: true });
      // create transaction record for buyer
      await db.collection("transactions").add({
        uid: buyerUid,
        type: "credits_purchase",
        credits: totalCredits,
        amountEUR: payload.price || undefined,
        status: "completed",
        orderId: payload.id || payload.order_id || undefined,
        createdAt: FieldValue.serverTimestamp(),
        note: `Payhip purchase: ${matchedProducts.join(",")}`,
        email: payload.email || undefined,
      });
    } else {
      // create a record without uid
      await db.collection("transactions").add({
        uid: null,
        email: payload.email || undefined,
        type: "credits_purchase",
        credits: totalCredits,
        amountEUR: payload.price || undefined,
        status: "completed",
        orderId: payload.id || payload.order_id || undefined,
        createdAt: FieldValue.serverTimestamp(),
        note: `Payhip purchase (unknown user): ${matchedProducts.join(",")}`,
      });
    }

    // Create salePending transaction so server processor redistributes to seller/founder
    // Seller uid for Payhip sales should be provided via env PAYHIP_SELLER_UID; fall back to first founder
    let sellerUid = process.env.PAYHIP_SELLER_UID || null;
    if (!sellerUid) {
      const foundersSnap = await db.collection("users").where("role", "==", "founder").limit(1).get();
      if (!foundersSnap.empty) sellerUid = foundersSnap.docs[0].id;
    }

    if (sellerUid) {
      await db.collection("transactions").add({
        uid: sellerUid,
        type: "salePending",
        credits: totalCredits,
        status: "pending",
        productId: "payhip-pack",
        buyerId: buyerUid || null,
        createdAt: FieldValue.serverTimestamp(),
        note: `Payhip sale: ${matchedProducts.join(",")}`,
      });
    } else {
      // no seller to attribute — still create a transaction without uid so it can be investigated
      await db.collection("transactions").add({
        uid: null,
        type: "salePending",
        credits: totalCredits,
        status: "pending",
        productId: "payhip-pack",
        buyerId: buyerUid || null,
        createdAt: FieldValue.serverTimestamp(),
        note: `Payhip sale (no seller found): ${matchedProducts.join(",")}`,
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, credits: totalCredits }) };
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("payhip-webhook:error", e?.message || e);
    return { statusCode: 500, body: JSON.stringify({ error: "server_error" }) };
  }
};
