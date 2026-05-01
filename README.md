# Sonant

A Payload + Next.js application for authenticated text-to-speech generation with:

- AWS Polly synthesis
- S3-compatible audio storage with signed playback URLs
- Per-user weekly character limits
- Voice catalog sync from Polly
- Generation history and playback UI

## Stack

- Next.js App Router
- Payload CMS
- AWS Polly (voice synthesis)
- S3-compatible object storage (audio files)
- Bun (package manager / runtime)

## Prerequisites

- Bun
- PostgreSQL
- S3-compatible bucket
- AWS Polly access (AWS credentials or equivalent provider credentials)

## Environment Variables

Set these in `.env`.

### Core App

- `DATABASE_URL` (Postgres connection string)
- `PAYLOAD_SECRET` (long random secret)

### S3 Storage (required)

- `S3_ENDPOINT`
- `S3_REGION`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_FORCE_PATH_STYLE` (optional, defaults to `true` unless set to `false`)

### Polly / AWS

- `AWS_REGION` (optional, defaults to `us-east-1`)
- `AWS_ACCESS_KEY_ID` (optional when using default AWS credential chain)
- `AWS_SECRET_ACCESS_KEY` (optional when using default AWS credential chain)
- `DEFAULT_POLLY_VOICE_ID` (optional, default: `Joanna`)

### Email Verification (optional)

- `RESEND_API_KEY` (optional) - Resend API key for sending verification emails
- `RESEND_FROM_EMAIL` (optional, default: `noreply@example.com`) - From address for verification emails
- `REQUIRE_VERIFICATION` (optional) - Set to `true` to require email verification for new users

When `RESEND_API_KEY` is configured, users can optionally enable email verification via `REQUIRE_VERIFICATION`.

### TTS Retention (optional)

- `TTS_RETENTION_DAYS` (optional, default: `90`)

This is a soft cleanup policy to avoid unbounded growth in history and storage.

## Install

```bash
bun install
```

## Run

Development:

```bash
bun run dev
```

Production:

```bash
bun run build
bun run start
```

`dev` and `start` run `check:env` first and fail fast if required S3 variables are missing.

## Scripts

- `bun run dev` - start Next.js dev server (with env preflight)
- `bun run build` - build production artifacts
- `bun run start` - start production server (with env preflight)
- `bun run lint` - run ESLint
- `bun run check:env` - validate required runtime env vars

## First-Time Setup

1. Configure `.env` with all required variables.
2. Start the app with `bun run dev`.
3. Open the admin UI and create your first `admins` account.
4. End-user accounts continue to register through the public `users` auth API.

## Data Model Overview

### admins

- Auth collection used only for Payload admin access
- Any authenticated `admins` document can access the admin panel

### users

- Auth collection used for product/customer accounts
- `tier`: relationship to the user's plan/limits

### voices

- Synced/stored voice catalog
- Provider metadata (`source`, `sourceVoiceId`, locale, engines)
- `isActive`, `isDefault`

### tts-generations

- Per-generation immutable metadata
- Input text, selected voice snapshot, audio storage key, char count
- Access model: owner-or-admin for read/delete
