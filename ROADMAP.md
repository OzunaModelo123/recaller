# Recaller — Product Roadmap

> Target market: Small to medium businesses (10–200 employees).
> Core insight: SMBs have training content scattered across Google Drive, Loom,
> internal recordings, and local files. Nobody actually learns from it.
> Recaller turns that content into structured, actionable plans.

---

## 🚀 Pre-Launch Checklist

> **These are things to do before releasing the app to real users.**

- [ ] **Upgrade Supabase to Pro plan ($25/mo)** — Required for large file uploads (>50MB). Free plan caps uploads at 50MB which blocks MP4 training videos. After upgrading:
  - Go to Storage → `content-files` bucket → Settings → set file size limit to **2GB** (`2147483648`)
  - Go to Project Settings → Storage → set upload file size limit to **2GB**
- [ ] **Re-enable subscription checks** — Currently bypassed in dev mode (`src/lib/api-guards.ts`). Before launch, either:
  - Remove the `DEV BYPASS` blocks in `checkSubscriptionStatus` and `checkSeatLimit`, OR
  - Set `ENABLE_SUBSCRIPTION_CHECKS=true` in your production environment variables
- [ ] **Upgrade Inngest plan** — Free plan has 5-min step timeouts. Paid plan removes limits.
- [ ] **Set up Stripe billing** — Wire up the subscription flow so users can actually subscribe
- [ ] **Set production environment variables** — `OPENAI_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, Stripe keys, etc.

---

## 🔴 High Priority — Fix / Add Soon

### 1. Google Drive Link Support
**Why**: This is how SMBs actually share training content. "Here's the doc" is
almost always a `docs.google.com` or `drive.google.com` URL. Currently the app
rejects these links entirely.

**What to build**:
- Detect `drive.google.com` and `docs.google.com` URLs in the URL input
- Use Google Drive API (or public export URL trick) to download the file
- Route to existing pipeline: PDF → `extractPdfText()`, video → Whisper
- Handle both public-shared links and (later) OAuth-authenticated Drive

**Files to touch**: `detectUrlSource.ts`, `contentTranscriptService.ts`, new `googleDriveExtractor.ts`

---

### 2. Loom Without Requiring an Existing Transcript
**Why**: Loom is the #1 tool SMBs use for internal "how-to" recordings.
Current `loomExtractor.ts` only works if the Loom video already has
a transcript — many internal Looms don't.

**What to build**:
- Fall back to downloading the Loom video file if no transcript exists
- Pass the video through the existing Whisper transcription pipeline
- Loom has a public video download URL pattern that works for shared videos

**Files to touch**: `loomExtractor.ts`, `contentTranscriptService.ts`

---

### 3. Fix Inngest Single-File Timeout (Server FFmpeg Path)
**Why**: When a browser has no WebCodecs and no MediaRecorder, the raw
video file is uploaded and sent to Inngest. The entire process
(download 400MB + FFmpeg + Whisper) runs in **one step**, which will
time out on the Inngest free plan's 5-minute limit.

**What to build**:
Break `transcribeSingleFile` into separate Inngest steps:
- `step 1`: Download file from Supabase + run FFmpeg → produce audio chunks → re-upload chunks
- `step 2-N`: Fan-out — transcribe each chunk in parallel (same as segmented path)
- `step finalize`: Merge + save + purge

**Files to touch**: `transcribeContent.ts`, `transcribeUploadedMedia.ts`

---

## 🟡 Medium Priority — Add When Growing

### 4. PPTX File Support
**Why**: Many SMB SOPs and onboarding decks are PowerPoint files,
not PDFs. Currently `.pptx` is rejected.

**What to build**:
- Add `.pptx` to accepted file types in upload form
- Use `officeparser` or `pptx-parser` npm package to extract slide text
- Route through existing transcript pipeline (text only, no slide images)

**Files to touch**: `upload-form.tsx`, `actions.ts`, `contentTranscriptService.ts`, new `pptxExtractor.ts`

---

### 5. Notion Page URL Support
**Why**: Many SMBs use Notion as their internal wiki/knowledge base.
An admin should be able to paste a Notion page URL and have it ingested.

**What to build**:
- Detect `notion.so` URLs in the URL input
- Use Notion public API or web scraper to extract page text
- Route through existing article text pipeline

**Files to touch**: `detectUrlSource.ts`, `contentTranscriptService.ts`, new `notionExtractor.ts`

---

### 6. Vimeo Without Captions (Download + Whisper)
**Why**: Some internal training is on private Vimeo. Current extractor fails
if no captions exist. Should fall back to downloading + Whisper like Loom.

**Files to touch**: `vimeoExtractor.ts`

---

## 🔵 Future / Scale

### 7. Microsoft SharePoint / OneDrive Integration
**Why**: Larger SMBs (50–200 employees) often use Microsoft 365 and store
everything in SharePoint. A link import or OAuth sync would be high-value.

---

### 8. Zapier / Make.com Webhook Trigger
**Why**: Let admins auto-ingest content when something lands in a folder
(e.g., "whenever a new file is added to this Google Drive folder, create a plan").
No manual upload needed.

---

### 9. Slack Integration
**Why**: "Send this training to the team" as a Slack command.
Also: post plan completion nudges to a Slack channel (Slack bolt is already a dependency).

---

### 10. Upgrade Inngest Plan Before Launch
**Why**: Free plan has 5-minute step timeouts and limited concurrency.
Paid plan removes these limits. The existing fan-out/fan-in architecture
is already built for scale — just needs the plan upgrade.

---

## ✅ Already Done (Phases 1–4)

- [x] WebCodecs audio extraction (10–50× faster than real-time in browser)
- [x] MediaRecorder 4× playback fallback
- [x] Small MP4 bypass (< 25 MB goes direct to Whisper)
- [x] TUS resumable uploads for all file sizes
- [x] Inngest fan-out/fan-in for parallel chunk transcription
- [x] **Fixed**: Inngest is now actually triggered (was never firing before)
- [x] **Added**: Server-side FFmpeg fallback detection (`needsServerSideFfmpeg()`)
- [x] **Rebuilt**: Upload UI with real progress bars, step indicators, time estimates
- [x] YouTube, Vimeo (with captions), Loom (with transcripts), web articles
- [x] PDF and DOCX instant extraction
- [x] MP3 direct-to-Whisper upload
- [x] Storage purge after transcription (only transcript text stays in DB)
- [x] **Fixed**: Large MP4s (>100MB) now route to server-side FFmpeg instead of unreliable browser extraction
- [x] **Added**: Progress logging in FFmpeg → Whisper pipeline (`[transcribe]` logs)
- [x] **Added**: Local Inngest dev server support in dev mode (`npm run dev:all`)
- [x] **Bypassed**: Subscription/seat checks in dev mode for testing all features
