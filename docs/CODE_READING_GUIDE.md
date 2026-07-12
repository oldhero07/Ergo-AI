# Reading the Ergo-AI codebase

This guide is for a developer who needs to read and review the code, not just use the app. It gives you an order to read the files in, tells you what each part does, and traces a photo and a video all the way through so you can see how the pieces connect. For the conceptual "how does the science work" side, read `docs/METHODOLOGY.md` first; this document is about the code.

## Big picture

Ergo-AI is two pieces:

- A **single-page app** (React 18, Vite, TypeScript) that owns everything the user sees: upload, angle derivation, scoring, adjustments, exports, session restore.
- A **stateless inference service** (`server/` — FastAPI + ONNX Runtime on CPU, in Docker) that does exactly one job: take image bytes, return 133 wholebody keypoints from a pinned RTMPose model behind a YOLOX person detector. It holds no state and stores nothing; models are SHA-256-pinned at build (`server/models.lock`).

The flow in one line: an image goes to the server, keypoints come back, a math layer turns keypoints into joint angles, a scoring layer looks those angles up in the RULA/REBA/OWAS/NERPA tables, and the UI shows the result and lets you adjust the parts a camera cannot see.

The design principle worth knowing up front: **flag, never suppress**. Low keypoint confidence never blocks or changes a score — it clears that angle's `measured` flag so the UI and PDF highlight it for expert review. The only hard failure is the person detector finding nobody. The flags travel in a parallel `AngleMeasuredFlags` object that the scoring engines never see.

## Reading order

Read in this order the first time. Each step builds on the last.

1. `index.html`, `src/main.tsx` — entry point.
2. `src/state/AppStateContext.tsx` — the top-level state machine: which phase the app is in (landing, computing, results, video), the hash route, and session lifecycle. The per-domain logic lives in the hooks it composes: `usePhotoSession.ts`, `useVideoSession.ts`, `useComputeGate.ts`, `useExports.ts`.
3. `src/assessment/types.ts` and `src/lib/analysis.ts` — the shared data shapes. `PostureInput`, `AssessmentResult`, and `PoseAnalysis` are the three you will see everywhere.
4. `src/lib/poseClient.ts` — the typed HTTP client for the inference API. Note that it sends original file bytes, never a canvas re-encode: browser JPEG encoders differ per device, and the whole point of server inference is that the same photo produces identical keypoints everywhere.
5. `src/lib/angles2d.ts` — the heart of the app. Keypoints to joint angles in the sagittal plane, the worst-side choice, the signed neck angle, the `KP_SCORE_FLOOR` review flags, and the off-profile detection. Read this slowly. The `KP` table at the top is the single source of truth for COCO-WholeBody keypoint indices.
6. `src/assessment/rula/rula.ts` and `src/assessment/rula/rulaTables.ts` — how angles become a score. `buildAutoInput` (angles to a `PostureInput`) and `computeRula` live here. Then `reba/`, `owas/`, `nerpa/` (a RULA variant with ISO 11226-derived angle bands, reusing RULA's tables), and `registry.ts` for the other pose-driven methods, and `niosh/` for the form-driven calculator.
7. `src/lib/remoteAnalyze.ts` — the orchestrator that wires upload, keypoints, angles, annotation, and scoring together for one photo, and the batched video version below it.
8. `src/lib/video/assemble.ts` — everything video-specific: rolling-window smoothing, posture-cycle counting, sustained/repeated detection, and per-frame assembly. Pure DOM-free math, heavily tested.
9. UI: `src/components/Uploader.tsx`, `src/screens/PhotoResultsScreen.tsx`, `Scorecard.tsx`, `MeasurementSummary.tsx`, `AdjustmentsPanel.tsx`, `VideoResults.tsx`.
10. Output: `src/lib/annotate2d.ts` (keypoint overlay), `src/lib/pdf.ts` (report), `src/lib/exportData.ts` (CSV/JSON), `src/lib/sessionStore.ts` (restore).
11. `server/app.py` — the whole API surface: `/analyze`, `/analyze-batch`, `/health`, rate limiting, and the in-memory-only image handling.

If you only have twenty minutes, read `angles2d.ts`, `rula.ts`, and `video/assemble.ts`. That is where the real logic lives.

## Annotated file map

### `src/lib` — the engine

- `poseClient.ts` — typed client for the pose API: endpoints, size caps, error mapping, health probe.
- `remoteAnalyze.ts` — photo and video orchestration over the API: retry with backoff, keypoints → angles → score, annotation (presentational — never fails an analysis), video frame batching.
- `angles2d.ts` — the core math. COCO-WholeBody keypoint indices, joint angles from keypoints, worst-side selection, signed neck flexion/extension with its deadzone, per-angle `measured` flags (`KP_SCORE_FLOOR`), wrist flexion from the wholebody hand points, off-profile detection.
- `annotate2d.ts` — draws the detected keypoints over the original image for the results view and the report.
- `image.ts` — decodes a `File` into an `ImageBitmap`, honoring EXIF orientation, for local display and annotation (the server does its own canonical decode for measurement).
- `analysis.ts` — the `PoseAnalysis` / video result types: the contract between the pipeline and every consumer.
- `pipeline/index.ts` — the thin pipeline facade (`analyzePhoto`, `analyzeVideo`, `warmUp`), lazily loaded so the landing page never pays for it.
- `videoFile.ts`, `videoFrames.ts`, `videoConfig.ts` — validating a video file, seeking through it, and sampling frames under one fixed policy (2 fps, 640 px longest edge, caps and timeouts in `videoConfig.ts`).
- `video/assemble.ts` — smoothing (`SMOOTH_WINDOW_SEC`), Schmitt-trigger cycle counting, sustained/repeated detection, aggregated review flags, `assembleVideoAnalysis`.
- `pdf.ts` — builds the PDF report with jsPDF.
- `exportData.ts` — CSV and JSON exports, stamped with the model version.
- `sessionStore.ts` — compact IndexedDB snapshot of the last photo session (angles, inputs, scores, small thumbnails — never original photos), restored within 24 hours. Video sessions are not snapshotted.
- `risk.ts`, `utils.ts` — small shared helpers.

### `src/state` — application state

- `AppStateContext.tsx` — the app phase machine and session lifecycle; composes the hooks below and exposes one context to the UI.
- `usePhotoSession.ts` — the photo batch: queueing (up to 30), per-photo results, worst-first ordering, exclusions.
- `useVideoSession.ts` — the video analysis lifecycle: progress, cancellation, results.
- `useComputeGate.ts` — server health/warm-up gating so the first Analyze isn't also the cold start.
- `useExports.ts` — wires the current session into the PDF/CSV/JSON exporters.

### `src/assessment` — the scoring

- `rula/rula.ts`, `rula/rulaTables.ts` — RULA scoring and its published lookup tables; `buildAutoInput` and `computeRula` live here.
- `reba/`, `owas/` — the same shape for REBA and OWAS.
- `niosh/` — the separate NIOSH lifting calculator (form-driven, not pose-driven).
- `registry.ts` — the list of methods and how the UI switches between them.
- `scoreUtils.ts`, `recommendations.ts`, `thresholds.ts` — shared scoring helpers and turning a score into plain-language advice.
- `types.ts` — `PostureInput`, `AssessmentResult`, and friends.

### `src/components`, `src/screens` — the UI

- `Uploader.tsx` — drag-and-drop, paste, and the file list.
- `Landing.tsx` — the landing page.
- `screens/PhotoResultsScreen.tsx` — composes the photo results: scorecard, measurement summary, adjustments, recommendations, report details.
- `Scorecard.tsx` — the grand score and group breakdown.
- `MeasurementSummary.tsx` — measured vs estimated-review vs assumed, and the off-profile warning.
- `AdjustmentsPanel.tsx` — the controls for the factors a camera cannot see; editing these re-scores live, with review chips on flagged angles.
- `VideoResults.tsx` — the video timeline, peak/mean stats, and worst-frame view.
- `ServerHealthBanner.tsx`, `SessionRestoreBanner.tsx` — cold-start status and one-click session restore.
- `RecommendationsPanel.tsx`, `ReportDetails.tsx`, `NioshCalculator.tsx`, `VideoSettings.tsx`, `AppNav.tsx`, `AppFooter.tsx`, and `ui/` (shadcn-style primitives) — the rest of the surface.

### `src/hooks`

- `useHashRoute.ts` — hash routing (the app deploys under multiple base paths).
- `useTheme.ts` — light/dark/system theme.
- `useComputeTimeline.ts`, `useServerHealth.ts` — small view-model helpers.

### `server/` — the inference service

- `app.py` — FastAPI app: `/analyze`, `/analyze-batch`, `/health`, per-IP rate limiting, in-memory-only image handling.
- `inference.py` — YOLOX person detection + RTMW keypoint inference via ONNX Runtime (CPU).
- `models.lock` — SHA-256 pins for the model files; `scripts/download_models.py` fetches and verifies them.
- `tests/` — golden keypoint regression and run-to-run determinism gates (pytest).

## Trace 1: follow a photo

Start at a click and follow the calls.

1. `Uploader.tsx` hands files to the app state (`usePhotoSession` via `AppStateContext`), which moves to the computing phase.
2. The session calls `getPipeline()` (`pipeline/index.ts`) and then `analyzePhoto(file)`, which lazy-loads `remoteAnalyze.ts`.
3. `analyzePhotoRemote` posts the original file bytes to `/analyze` (`poseClient.ts`), retrying with backoff on transient failures.
4. The server responds with 133 keypoints (or `detected: false`, the one hard failure).
5. `computeAngles2D` (`angles2d.ts`) turns them into upper arm, forearm, wrist, neck, trunk, and knee angles, plus the per-angle `measured` flags and the off-profile check.
6. `buildAutoInput` (`rula.ts`) packs the angles into a `PostureInput`, and `computeRula` scores it against the tables.
7. `annotateSkeleton2D` (`annotate2d.ts`) draws the keypoint overlay for the results view — presentational, so a local decode failure never loses the score.
8. The result flows into `usePhotoSession`, and `PhotoResultsScreen` renders `Scorecard`, `MeasurementSummary`, and `AdjustmentsPanel`. Editing an adjustment re-scores live with the new input.

## Trace 2: follow a video

Video reuses the same per-frame detection, then adds a post-processing layer.

1. The video session calls `analyzeVideo` on the pipeline.
2. `sampleVideoFrames` (`videoFrames.ts`) seeks through the file and produces JPEG frames one at a time under the fixed policy (2 fps, 640 px).
3. Frames upload in batches to `/analyze-batch`; each detected frame's keypoints run through the same `computeAngles2D` as a photo. Frames with no detected person are skipped and counted, not guessed at.
4. Per-frame results collect into a `RawVideoFrame[]`, then `assembleVideoAnalysis` (`video/assemble.ts`) does the video-only work: it smooths each angle over a rolling 2.5 s window, detects whether a posture is held or repeated, aggregates the review flags, and scores each frame.
5. `VideoResults.tsx` recomputes the score for every frame and shows the peak (worst) frame, the mean, and a timeline.

### Why a video scores differently from a photo of the same task

This trips people up, so it is worth spelling out. Four reasons, all visible in the code above.

1. Peak versus one instant. The photo scores a single moment. The video's headline number is the worst frame in the whole clip. A clip almost always contains a worse instant than any one snapshot.

2. Video adds points a photo cannot. `assembleVideoAnalysis` sets the muscle-use and activity flags when a posture is held still or repeated. RULA and REBA add score for those. A photo leaves them neutral because it cannot see them, so video scores trend higher for the same posture.

3. Smoothing. Video averages each angle over a roughly 2.5 second window (`SMOOTH_WINDOW_SEC`, `smoothChannel`) before scoring. A photo uses the raw single-frame angle. Different input numbers, different score.

4. Different instants. Video samples many frames, none of which is exactly the photo's moment, and which side is scored can shift from frame to frame as the worse arm changes.

None of this is a bug. Video is meant to catch strain over time that a still cannot, so a higher and more variable number is expected.

## Key concepts

- **Flag, never suppress.** Keypoints below `KP_SCORE_FLOOR` still produce angles and scores; they just clear that angle's flag in `AngleMeasuredFlags`, which only the UI and PDF consume. The scoring engines never see confidence. The one hard failure is `detected: false`.
- **Original bytes to the server.** The client never re-encodes the photo before upload; the server does the single canonical decode. This is what keeps scores identical across devices.
- **Sagittal 2D angles.** All angles are measured in the image plane of a side-view photo — the methodologically standard approach. Off-profile shots get a foreshortening warning instead of a guessed correction.
- **Measured versus assumed.** The camera sees angles but not twist, load, or support. `buildAutoInput` fills the unseen factors with neutral defaults, `MeasurementSummary` lists which is which, and `AdjustmentsPanel` lets a person correct them.
- **Provenance.** Every analysis carries the server's `model_version`, and it is stamped into the PDF, CSV, and JSON exports and the session snapshot.

## How to run and test

- `npm run dev` starts the app on `http://localhost:5173`. By default it talks to the production inference service; set `VITE_POSE_API_URL` in `.env.local` to use a local one (see `README.md`).
- `npm test` runs the Vitest suite — fixture-driven, no live server needed. `npm run typecheck` type-checks; `npm run build` builds.
- `cd server && pytest` runs the server's golden keypoint regression and determinism gates.

The tests worth knowing:

- `src/test/baseline.test.ts` locks the RULA and REBA scores for the bundled sample photos. If a score here changes, scoring behavior changed, and that should be deliberate.
- `src/assessment/rula/rula.test.ts` (and `reba`, `owas`, `nerpa`, `niosh`) check the scoring tables directly.
- `src/lib/angles2d.test.ts` checks side selection, the signed neck angle, the review flags, and the off-profile detection.
- `src/lib/videoFile.test.ts`, `src/lib/exportData.test.ts`, `src/lib/pdf.test.ts` cover file validation and the export paths.

## Where to focus a review

Most of the risk is in a few files. Spend your attention there.

- `angles2d.ts` is the densest logic: keypoint index conventions, coordinate flips, the worst-side choice, the signed neck angle, and the flag floor. Small mistakes here move every score.
- `video/assemble.ts` owns everything video-specific. If a video result looks off, start here.
- `remoteAnalyze.ts` is the seam between server and client: pixel-space scaling for overlays, retry behavior, and the batching of video frames.
- `server/app.py` and `server/inference.py` decide what keypoints exist at all, and the pytest goldens are the tripwire for any change there.

The components and the export files are mostly presentational. Read them last, and lean on the tests for the parts that are covered.
