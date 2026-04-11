"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { LoaderCircle, MailCheck, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppSuspenseScreen } from "@/components/app-suspense-screen";
import { requestPasswordReset } from "@/lib/tts/api";

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const initialEmail = useMemo(
    () => searchParams.get("email") ?? "",
    [searchParams],
  );

  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setBusy(true);
    setError(null);

    try {
      await requestPasswordReset(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to request password reset",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grain-overlay relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-0 h-72 w-72 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -right-14 bottom-8 h-72 w-72 rounded-full bg-amber-glow/10 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-md animate-fade-up rounded-2xl border border-border/60 bg-card/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:rounded-3xl sm:p-7">
        <div className="mb-5 flex items-center justify-between">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Volume2 className="h-5 w-5 text-primary" />
          </div>
          <MailCheck className="h-5 w-5 text-primary" />
        </div>

        <h1 className="font-heading text-2xl text-foreground text-glow sm:text-3xl">
          Reset Password
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enter your account email and we will send a secure reset link.
        </p>

        {submitted ? (
          <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            If an account exists for this email, a password reset link has been
            sent.
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label
                htmlFor="forgot-email"
                className="text-xs uppercase tracking-wider text-muted-foreground"
              >
                Email
              </Label>
              <Input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="rounded-xl border-border/50 bg-muted/40 py-2.5"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}

            <Button className="w-full rounded-xl" type="submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Sending reset link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          <Link
            href="/"
            className="text-primary/90 transition-colors hover:text-primary"
          >
            Back to sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

function ForgotPasswordFallback() {
  return <AppSuspenseScreen message="Loading reset form..." />;
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordFallback />}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
