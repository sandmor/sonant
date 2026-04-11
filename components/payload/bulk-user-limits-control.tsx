"use client";

import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BulkUserLimitsControl() {
  const [characterLimit, setCharacterLimit] = useState("");
  const [includeAdmins, setIncludeAdmins] = useState(false);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"neutral" | "error">("neutral");

  const hasInput = useMemo(
    () => characterLimit.trim() !== "",
    [characterLimit],
  );

  async function applyBulkLimits() {
    if (!hasInput) {
      setStatusTone("error");
      setStatusMessage("Enter at least one limit before applying.");
      return;
    }

    const payload: {
      weeklyCharacterLimit?: number;
      includeAdmins: boolean;
    } = {
      includeAdmins,
    };

    if (characterLimit.trim() !== "") {
      payload.weeklyCharacterLimit = Number(characterLimit);
    }

    setBusy(true);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/users/bulk-limits", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseBody = (await response.json().catch(() => null)) as {
        message?: string;
        summary?: {
          scanned: number;
          updated: number;
          skippedAdmins: number;
        };
      } | null;

      if (!response.ok) {
        throw new Error(responseBody?.message || "Failed to update limits");
      }

      setStatusTone("neutral");
      setStatusMessage(
        `Updated ${responseBody?.summary?.updated ?? 0} users (scanned ${responseBody?.summary?.scanned ?? 0}, skipped admins ${responseBody?.summary?.skippedAdmins ?? 0}).`,
      );
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to update limits",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        <p className="text-sm font-medium">Bulk Weekly Limits</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-weekly-characters">Character Limit</Label>
          <Input
            id="bulk-weekly-characters"
            inputMode="numeric"
            type="number"
            min={0}
            placeholder="Leave empty to keep"
            value={characterLimit}
            onChange={(event) => setCharacterLimit(event.target.value)}
          />
        </div>

        <div className="flex items-end gap-2">
          <Button
            type="button"
            variant="default"
            className="w-full"
            disabled={busy || !hasInput}
            onClick={applyBulkLimits}
          >
            {busy ? "Applying..." : "Apply To All Users"}
          </Button>
        </div>
      </div>

      <label className="mt-3 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={includeAdmins}
          onChange={(event) => setIncludeAdmins(event.target.checked)}
        />
        Include admin users
      </label>

      {statusMessage ? (
        <p
          className={
            statusTone === "error"
              ? "mt-3 text-sm text-red-600"
              : "mt-3 text-sm text-muted-foreground"
          }
        >
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
