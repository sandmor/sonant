# Sonant

A Payload + Next.js application for authenticated text-to-speech generation with:

- AWS Polly, Qwen3-TTS, and Chatterbox Multilingual synthesis
- Modal-backed GPU engines behind a single CPU gateway endpoint
- S3-compatible audio storage with signed playback URLs
- Per-user weekly character limits
- Voice catalog sync from providers
- Generation history and playback UI

## Stack

- Next.js App Router
- Payload CMS
- AWS Polly (cloud voices)
- Modal (CPU gateway + GPU workers for Qwen and Chatterbox)
- S3-compatible object storage (audio files)
- Bun (package manager / runtime)

## Prerequisites

- Bun
- PostgreSQL
- S3-compatible bucket
- AWS Polly access (AWS credentials or equivalent provider credentials)
- Modal account and token (if using Qwen or Chatterbox backends)

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

### Modal TTS (optional)

- `MODAL_TTS_URL` — deployed Modal gateway base URL (for example `https://...modal.run`)
- `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` (obtained after running `modal token new`)

Deploy the Modal stack:

```bash
bun run deploy:modal
```

Set `MODAL_TTS_URL` to the gateway URL printed by Modal. The gateway exposes:

- `GET /health`
- `POST /synthesize` with `{ engine, text, voice_id, language }`
- `POST /synthesize-srt` — async SRT job (worker uploads finished WAV to S3)
- `GET /srt-status?call_id=` — poll job progress and storage metadata
- `POST /synthesize-cue` — single-cue preview

Supported engines: `qwen`, `chatterbox`.

#### Modal S3 secret (required for SRT jobs)

SRT jobs upload finished audio directly to your S3-compatible bucket from the GPU worker. Create a Modal secret with the same storage variables as the app (works with AWS S3, Cloudflare R2, MinIO, etc.):

```bash
cd modal
modal secret create sonant-s3 \
  S3_ENDPOINT="https://..." \
  S3_REGION="auto" \
  S3_BUCKET="your-bucket" \
  S3_ACCESS_KEY_ID="..." \
  S3_SECRET_ACCESS_KEY="..." \
  S3_FORCE_PATH_STYLE="true"
```

For R2, use your account endpoint, set `S3_REGION=auto`, and keep `S3_FORCE_PATH_STYLE=true`.

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
- `bun run deploy:modal` - deploy the Modal CPU gateway and GPU engine workers

## First-Time Setup

1. Configure `.env` with all required variables.
2. Start the app with `bun run dev`.
3. Open the admin UI and create your first `admins` account.
4. End-user accounts continue to register through the public `users` auth API.
5. For Modal engines, deploy with `bun run deploy:modal`, set `MODAL_TTS_URL`, and configure voices (see below).

## Modal Voice Setup

Modal workers resolve voices in this order:

1. Engine override: `modal/voices/{engine}/registry.json`
2. Shared fallback: `modal/voices/shared/registry.json`

Both Qwen and Chatterbox images bundle `voices/shared/` plus their engine folder.

### Directory layout

```
modal/voices/
  shared/
    registry.json
    *.wav
  qwen/
    registry.json    # optional overrides only
  chatterbox/
    registry.json    # optional overrides only
```

Shared registry example:

```json
{
  "narrator": {
    "file": "narrator.wav",
    "ref_text": "Transcript required for Qwen; ignored by Chatterbox"
  }
}
```

Engine overrides replace the entire entry for a `voice_id` and may reference audio in the engine folder.

### Payload admin

1. Create a `modal-voices` record with matching `voiceId`, one or more `engines` (`qwen`, `chatterbox`), and metadata.
2. Link it from the unified `voices` catalog.

One persona can span multiple engines. The studio lists the same `voiceId` under each supported engine tab.

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
