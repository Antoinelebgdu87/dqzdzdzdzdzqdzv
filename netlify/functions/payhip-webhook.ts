import crypto from "crypto";
import type { Handler } from "@netlify/functions";
import { getAdminDb } from "../../server/firebaseAdmin";

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function parseBody(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {}
  try {
    const params = new URLSearchParams(raw);
    const obj: any = {};
    params.forEach((v, k) => {
      obj[k] = v;
    });
    return obj;
  } catch {}
  return {};
}

function pickAmount(body: any): number | null {
  const candidates = [
    body?.amount,
    body?.total,
    body?.price,
    body?.paid,
    body?.charged,
    body?.data?.amount,
    body?.order?.amount,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (!isNaN(n) && isFinite(n) && n > 0) return n;
  }
  // last resort: scan numbers in body
  try {
    const s = JSON.stringify(body);
    const m = s.match(/"(amount|total|price)"\s*:\s*(\d+(?:\.\d+)?)/i);
    if (m) return Number(m[2]);
  } catch {}
  return null;
}

function getBuyer(body: any): { uid: string | null; email: string | null } {
  const uid =
    body?.buyer ||
    body?.metadata?.buyer ||
    body?.custom_fields?.buyer ||
    body?.custom?.buyer ||
    body?.order?.buyer ||
    null;
  const email =
    body?.email ||
    body?.customer_email ||
    body?.order?.email ||
    body?.customer?.email ||
    null;
  return { uid, email };
}

export const handler: Handler = async (event) => {
  try {
    const secret = process.env.PAYHIP_WEBHOOK_SECRET;
    if (!secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "missing_secret" }),
      };
    }

    const sig = (event.headers["x-payhip-signature"] ||
      event.headers["X-Payhip-Signature"]) as string | undefined;
    if (!sig)
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "missing_signature" }),
      };

    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : String(event.body || "");

    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    if (!timingSafeEqual(expected, sig)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "invalid_signature" }),
      };
    }

    const payload = parseBody(rawBody);
    const paidAmount = pickAmount(payload);
    const { uid: buyerUidFromPayload, email: buyerEmail } = getBuyer(payload);

    const db = await getAdminDb();
    // @ts-ignore
    const { FieldValue, Timestamp } = await import("firebase-admin/firestore");

    // Resolve user
    let uid: string | null = buyerUidFromPayload || null;
    if (!uid && buyerEmail) {
      const uSnap = await db
        .collection("users")
        .where("email", "==", buyerEmail)
        .limit(1)
        .get();
      if (!uSnap.empty) uid = uSnap.docs[0].id;
    }
    if (!uid) {
      // Cannot proceed without user
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, note: "user_not_found" }),
      };
    }

    // Load packs and promo config
    const packsSnap = await db.collection("coin_packs").get();
    const packs = packsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));
    const promoDoc = await db.collection("promotions").doc("packs").get();
    const promoCfg = promoDoc.exists ? (promoDoc.data() as any) : null;

    // Fetch user role if promos are role-based
    const usrDoc = await db.collection("users").doc(uid).get();
    const userRole =
      (usrDoc.exists ? (usrDoc.data() as any)?.role : null) || null;

    const now = Date.now();
    const promoActive = (() => {
      if (!promoCfg) return 0;
      const percent = Number(promoCfg.percent ?? promoCfg.all ?? 0) || 0;
      if (!percent) return 0;
      const start = promoCfg.startAt?.toMillis?.() ?? null;
      const end = promoCfg.endAt?.toMillis?.() ?? null;
      if (start && now < start) return 0;
      if (end && now > end) return 0;
      const roles: string[] = Array.isArray(promoCfg.roles)
        ? promoCfg.roles
        : ["all"];
      if (!roles.includes("all") && userRole && !roles.includes(userRole))
        return 0;
      return percent;
    })();

    // Find matching pack by amount (within 1 cent)
    let chosen: any = null;
    let chosenFinalPrice = 0;
    if (Array.isArray(packs) && packs.length && paidAmount != null) {
      for (const p of packs) {
        const base = Number(p.price_normal || p.price || 0);
        const perPackPromo = Number(p.promo_percent || 0);
        const finalPromo = Math.max(0, (promoActive || 0) + perPackPromo);
        const finalPrice = Number((base * (1 - finalPromo / 100)).toFixed(2));
        if (Math.abs(finalPrice - Number(paidAmount)) < 0.01) {
          chosen = p;
          chosenFinalPrice = finalPrice;
          break;
        }
      }
      // If no exact match, pick closest by delta
      if (!chosen) {
        let best = {
          p: null as any,
          delta: Number.POSITIVE_INFINITY,
          price: 0,
        };
        for (const p of packs) {
          const base = Number(p.price_normal || p.price || 0);
          const perPackPromo = Number(p.promo_percent || 0);
          const finalPromo = Math.max(0, (promoActive || 0) + perPackPromo);
          const finalPrice = Number((base * (1 - finalPromo / 100)).toFixed(2));
          const delta = Math.abs(finalPrice - Number(paidAmount || 0));
          if (delta < best.delta) best = { p, delta, price: finalPrice };
        }
        if (best.p && best.delta <= 0.05) {
          chosen = best.p;
          chosenFinalPrice = best.price;
        }
      }
    }

    if (!chosen) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, note: "pack_not_matched" }),
      };
    }

    const rc = Number(chosen.rc || chosen.coins || 0) || 0;
    const bonusPercent = Number(chosen.bonus_percent || chosen.bonus || 0) || 0;
    const credits = rc + Math.round((rc * bonusPercent) / 100);

    const orderId =
      payload?.order_id ||
      payload?.id ||
      payload?.order?.id ||
      crypto.randomUUID();

    await db.runTransaction(async (tr) => {
      const userRef = db.collection("users").doc(uid!);
      tr.set(
        userRef,
        { balances: { available: FieldValue.increment(credits) } },
        { merge: true },
      );

      const txRef = db.collection("transactions").doc();
      tr.set(txRef, {
        uid,
        email: buyerEmail || usrDoc.data()?.email || null,
        type: "credits_purchase",
        source: "payhip",
        orderId,
        amountEUR: Number(paidAmount || chosenFinalPrice || 0),
        credits,
        status: "completed",
        createdAt: FieldValue.serverTimestamp(),
      });

      // Create salePending for seller (for revenue distribution)
      const sellerCfg = (process.env.PAYHIP_SELLER_UID || "").trim();
      let sellerId: string | null =
        sellerCfg && sellerCfg !== "auto" && sellerCfg !== "founder"
          ? sellerCfg
          : null;
      if (!sellerId) {
        const foundersSnap = await db
          .collection("users")
          .where("role", "==", "founder")
          .limit(1)
          .get();
        sellerId = foundersSnap.empty ? null : foundersSnap.docs[0].id;
      }
      if (sellerId) {
        tr.set(
          db.collection("users").doc(sellerId),
          { balances: { pending: FieldValue.increment(credits) } },
          { merge: true },
        );
        tr.set(db.collection("transactions").doc(), {
          uid: sellerId,
          type: "salePending",
          credits,
          status: "pending",
          createdAt: FieldValue.serverTimestamp(),
          note: `RotCoins top-up via Payhip for ${uid}`,
        });
      }
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e: any) {
    console.error("payhip-webhook:error", e?.message || e);
    return { statusCode: 500, body: JSON.stringify({ error: "server_error" }) };
  }
};
