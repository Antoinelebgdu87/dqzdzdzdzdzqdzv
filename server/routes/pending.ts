import type { RequestHandler } from "express";
import { getAdminDb } from "../firebaseAdmin";

export async function runPendingSalesProcessing() {
  const db = await getAdminDb();
  // @ts-ignore
  const { FieldValue, Timestamp } = await import("firebase-admin/firestore");

  const delayMs = 60 * 1000;
  const cutoff = new Date(Date.now() - delayMs);

  const snap = await db
    .collection("transactions")
    .where("type", "==", "salePending")
    .where("status", "==", "pending")
    .where("createdAt", "<=", Timestamp.fromDate(cutoff))
    .limit(50)
    .get();

  let processed = 0;
  for (const docSnap of snap.docs) {
    const txRef = docSnap.ref;
    const data = docSnap.data() as any;
    const credits = Number(data.credits || 0);
    const sellerId = data.uid || data.sellerId || null;
    if (!sellerId || credits <= 0) continue;

    await db.runTransaction(async (tr) => {
      const fresh = await tr.get(txRef);
      if (!fresh.exists) return;
      const cur = fresh.data() as any;
      if (cur.status !== "pending") return; // idempotent

      const sellerShare = Math.floor((credits * 70) / 100);
      const founderShare = credits - sellerShare;

      // Move seller balances
      const sellerRef = db.collection("users").doc(sellerId);
      tr.set(
        sellerRef,
        {
          balances: {
            pending: FieldValue.increment(-credits),
            available: FieldValue.increment(sellerShare),
          },
        },
        { merge: true },
      );

      // Credit a founder
      const foundersSnap = await db
        .collection("users")
        .where("role", "==", "founder")
        .limit(1)
        .get();
      if (!foundersSnap.empty) {
        const founderId = foundersSnap.docs[0].id;
        tr.set(
          db.collection("users").doc(founderId),
          { balances: { available: FieldValue.increment(founderShare) } },
          { merge: true },
        );
        tr.create(db.collection("transactions").doc(), {
          uid: founderId,
          type: "saleReleased",
          credits: founderShare,
          status: "completed",
          createdAt: FieldValue.serverTimestamp(),
          note: `Commission from sale ${docSnap.id}`,
        });
      }

      // Update original transaction and create seller released record
      tr.update(txRef, {
        status: "completed",
        releasedAt: FieldValue.serverTimestamp(),
      });
      tr.create(db.collection("transactions").doc(), {
        uid: sellerId,
        type: "saleReleased",
        credits: sellerShare,
        status: "completed",
        createdAt: FieldValue.serverTimestamp(),
        note: `Sale distribution for ${docSnap.id}`,
      });
    });
    processed++;
  }

  return { ok: true, processed };
}

export const processPendingSales: RequestHandler = async (_req, res) => {
  try {
    const result = await runPendingSalesProcessing();
    res.json(result);
  } catch (e: any) {
    // eslint-disable-next-line no-console
    console.error("processPendingSales:error", e?.message || e);
    res.status(500).json({ error: "server_error" });
  }
};
