import type { Payload } from "payload";

import { getTTSRetentionDays } from "@/lib/server/env";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

let cleanupInFlight = false;
let nextCleanupAt = 0;

function getCutoffDate(now = new Date()) {
  const retentionDays = getTTSRetentionDays();
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff;
}

export async function runTTSSoftRetentionCleanup(payload: Payload) {
  const cutoff = getCutoffDate();
  const cutoffISO = cutoff.toISOString();

  let deletedGenerations = 0;

  // Soft retention policy by design:
  // keep roughly the last N days of TTS artifacts to cap long-term storage growth.
  // We intentionally do not enforce exact cut-off precision.
  while (true) {
    const staleGenerations = await payload.find({
      collection: "tts-generations",
      where: {
        createdAt: {
          less_than: cutoffISO,
        },
      },
      sort: "createdAt",
      limit: CLEANUP_BATCH_SIZE,
      depth: 0,
      overrideAccess: true,
    });

    if (staleGenerations.docs.length === 0) {
      break;
    }

    for (const generation of staleGenerations.docs) {
      await payload.delete({
        collection: "tts-generations",
        id: generation.id,
        overrideAccess: true,
      });
      deletedGenerations += 1;
    }
  }

  return {
    cutoffISO,
    deletedGenerations,
  };
}

export async function runTTSSoftRetentionCleanupIfDue(payload: Payload) {
  const now = Date.now();

  if (cleanupInFlight || now < nextCleanupAt) {
    return null;
  }

  cleanupInFlight = true;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;

  try {
    return await runTTSSoftRetentionCleanup(payload);
  } finally {
    cleanupInFlight = false;
  }
}
