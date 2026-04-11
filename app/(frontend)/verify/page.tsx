"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AppSuspenseScreen } from "@/components/app-suspense-screen";
import { verifyEmailToken } from "@/lib/tts/api";

type VerifyState = "loading" | "success" | "error";

function VerifyContent() {
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>("loading");
  const [message, setMessage] = useState("Verifying your email token...");

  const token = useMemo(() => {
    const value = searchParams.get("token") ?? "";
    return value.trim();
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    const runVerification = async () => {
      if (!token) {
        setState("error");
        setMessage("Verification token is missing from this URL.");
        return;
      }

      setState("loading");
      setMessage("Verifying your email token...");

      try {
        await verifyEmailToken(token);
        if (!cancelled) {
          setState("success");
          setMessage("Email verified successfully. You can sign in now.");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Verification failed. Please request a new verification email.",
          );
        }
      }
    };

    void runVerification();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="grain-overlay relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8 sm:px-6 sm:py-12">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-18 top-8 h-64 w-64 rounded-full bg-primary/12 blur-3xl" />
        <div className="absolute -right-20 bottom-4 h-72 w-72 rounded-full bg-amber-glow/12 blur-3xl" />
      </div>

      <section className="relative z-10 w-full max-w-md animate-fade-up rounded-2xl border border-border/60 bg-card/80 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:rounded-3xl sm:p-7">
        <div className="mb-6 flex items-center justify-between">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <Volume2 className="h-5 w-5 text-primary" />
          </div>
          {state === "loading" ? (
            <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
          ) : state === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
        </div>

        <h1 className="font-heading text-2xl text-foreground text-glow sm:text-3xl">
          Email Verification
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>

        <div className="mt-7 flex gap-3">
          <Button asChild className="flex-1 rounded-xl">
            <Link href="/">Go To Studio</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}

function VerifyFallback() {
  return <AppSuspenseScreen message="Loading verification..." />;
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyContent />
    </Suspense>
  );
}
