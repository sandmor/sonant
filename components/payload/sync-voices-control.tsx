"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SyncVoicesControl() {
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error">("neutral");

  async function runSync() {
    setBusy(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/voices/sync", {
        method: "POST",
        credentials: "include",
      });

      const payload = (await response.json().catch(() => null)) as {
        message?: string;
        result?: {
          remote: number;
          created: number;
          updated: number;
          deactivated: number;
          skipped: boolean;
        };
      } | null;

      if (!response.ok) {
        throw new Error(payload?.message || "Voice sync failed");
      }

      if (!payload?.result) {
        setStatusTone("neutral");
        setStatusMessage("Voice sync completed.");
        return;
      }

      const { remote, created, updated, deactivated, skipped } = payload.result;

      if (skipped) {
        setStatusTone("neutral");
        setStatusMessage("No sync required: voices already seeded.");
        return;
      }

      setStatusTone("neutral");
      setStatusMessage(
        `Synced ${remote} voices (created ${created}, updated ${updated}, deactivated ${deactivated}).`,
      );
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Voice sync failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={runSync}
        disabled={busy}
      >
        <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
        {busy ? "Syncing Voices..." : "Sync Voices From Polly"}
      </Button>
      {statusMessage ? (
        <p
          className={
            statusTone === "error"
              ? "text-sm text-red-600"
              : "text-sm text-muted-foreground"
          }
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
