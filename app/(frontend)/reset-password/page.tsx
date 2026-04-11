"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { CheckCircle2, LoaderCircle, LockKeyhole, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSuspenseScreen } from "@/components/app-suspense-screen";
import { resetPassword } from "@/lib/tts/api";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = useMemo(
    () => (searchParams.get("token") ?? "").trim(),
    [searchParams],
  );

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("Reset token is missing from this URL.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await resetPassword({ token, password });
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grain-overlay relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -right-16 bottom-2 h-72 w-72 rounded-full bg-amber-glow/10 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-md animate-fade-up rounded-3xl border border-border/60 bg-card/80 p-7 shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Volume2 className="h-5 w-5 text-primary" />
          </div>
          {success ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <LockKeyhole className="h-5 w-5 text-primary" />
          )}
        </div>

        <h1 className="font-heading text-3xl text-foreground text-glow">
          Create New Password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Choose a new password for your Sonant account.
        </p>

        {!token ? (
          <div className="mt-6 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Reset token is missing from this URL.
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            Password updated successfully. You can now continue to the studio.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label
                htmlFor="reset-password"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                New password
              </Label>
              <Input
                id="reset-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                className="rounded-xl border-border/50 bg-muted/40 py-2.5"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="reset-confirm-password"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Confirm password
              </Label>
              <Input
                id="reset-confirm-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Repeat your new password"
                className="rounded-xl border-border/50 bg-muted/40 py-2.5"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button
              className="w-full rounded-xl"
              type="submit"
              disabled={busy || !token}
            >
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update password"
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link
            href="/"
            className="text-primary/90 transition-colors hover:text-primary"
          >
            Return to studio
          </Link>
        </div>
      </section>
    </main>
  );
}

function ResetPasswordFallback() {
  return <AppSuspenseScreen message="Loading password reset..." />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordContent />
    </Suspense>
  );
}
