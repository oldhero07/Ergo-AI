# Reading the Ergo-AI codebase

This guide is for a developer who needs to read and review the code, not just use the app. It gives you an order to read the files in, tells you what each part does, and traces a photo and a video all the way through so you can see how the pieces connect. For the conceptual "how does the science work" side, read `docs/METHODOLOGY.md` first; this document is about the code.

## Big picture

Ergo-AI is a single-page app: React 18, Vite, TypeScript. There is no backend. Everything happens in the browser, including the two MediaPipe machine-learning models (Pose and Hand). Nothing is uploaded.

The flow in one line: an image comes in, a pose model finds the body, a math layer turns landmarks into joint angles, a scoring layer looks those angles up in the RULA/REBA/OWAS tables, and the UI shows the result and lets you adjust the parts a camera cannot see.

The one design split worth knowing up front: heavy work (model inference, drawing, encoding) runs on a background Web Worker so the page does not freeze. The exact same functions also run inline on the main thread as a fallback. So most core files are written to be DOM-free and callable from either place.

## Reading order

Read in this order the first time. Each step builds on the last.

1. `index.html`, `src/main.tsx` — entry point and service-worker registration.
2. `src/App.tsx` — the top-level state machine. Big file, but skim it: it holds the upload list, the results map, and the phase (landing, computing, results, video). Come back to it after you understand the lower layers.
3. `src/assessment/types.ts` and `src/types.ts` — the shared data shapes. Read these before anything that produces or consumes them. `PostureInput` and `AssessmentResult` are the two you will see everywhere.
4. `src/lib/poseLandmarker.ts`, `src/lib/handLandmarker.ts` — how the two models load, cache, and run. Note the local-first model source and the deterministic-mode switch.
5. `src/lib/image.ts` — decoding an uploaded file into pixels (orientation, downscale).
6. `src/lib/angles.ts` — the heart of the app. Landmarks to joint angles, the worst-side choice, the confidence and validity gates. Read this slowly.
7. `src/assessment/rula/rula.ts` and `src/assessment/rula/rulaTables.ts` — how angles become a score. Then `reba/`, `owas/`, and `registry.ts` for the other two methods.
8. `src/lib/analyze.ts` — the orchestrator that wires decode, detect, angles, wrist, and scoring together for one photo, and the video version below it.
9. `src/lib/pipeline/index.ts`, `workerPipeline.ts`, `shared.ts` and `src/workers/analysis.worker.ts` — how that orchestration is split between the worker and the main thread.
10. UI: `src/components/Uploader.tsx`, `Scorecard.tsx`, `MeasurementSummary.tsx`, `AdjustmentsPanel.tsx`, `VideoResults.tsx`.
11. Output: `src/lib/annotate.ts` (skeleton overlay), `src/lib/pdf.ts` (report), `src/lib/exportData.ts` (CSV/JSON).

If you only have twenty minutes, read `angles.ts`, `rula.ts`, and `pipeline/shared.ts`. That is where the real logic lives.

## Annotated file map

### `src/lib` — the engine

- `poseLandmarker.ts` — loads and runs the MediaPipe Pose model (33 body landmarks, 2D and 3D). Handles local-first model download, caching, GPU-with-CPU fallback, and deterministic mode.
- `handLandmarker.ts` — same idea for the Hand model, used only for the wrist.
- `handRoi.ts` — crops a square around the wrist and runs the hand model on just that region, then maps the result back to full-image coordinates. Falls back to a full-frame scan if the crop finds nothing.
- `image.ts` — decodes a `File` into an `ImageBitmap`, honoring EXIF orientation and downscaling large photos.
- `angles.ts` — the core math. Joint angles from landmarks, worst-side selection, signed neck flexion/extension, the detection-confidence figure, and the pose-validity check that rejects partial or collapsed detections.
- `analyze.ts` — glues everything together for one photo (`analyzePhoto`) and for a video (`analyzeVideo`).
- `annotate.ts` — draws the detected skeleton over the original image for the report.
- `pdf.ts` — builds the PDF report with jsPDF.
- `exportData.ts` — CSV and JSON exports.
- `videoFrames.ts`, `videoFile.ts`, `videoConfig.ts` — sampling frames out of a video file.
- `prepare.ts`, `prepareCore.ts` — off-thread image preparation for large batches.
- `sessionStore.ts` — saves and restores a session so a refresh does not lose work.
- `assetBase.ts` — resolves where model and wasm files live, and holds the deterministic-mode flag shared with the worker.
- `risk.ts`, `utils.ts` — small shared helpers.

### `src/lib/pipeline` — where work runs

- `index.ts` — picks the backend: the worker pipeline on capable browsers, the inline path otherwise, with automatic downgrade if the worker fails.
- `workerPipeline.ts` — talks to the analysis worker: sends bitmaps, receives results.
- `shared.ts` — the DOM-free post-processing shared by both backends and the tests. Smoothing, the temporal (held/repeated) detection, and `assembleVideoAnalysis`. Read this to understand video.
- `budget.ts` — memory budgeting for large batches.

### `src/workers` — background threads

- `analysis.worker.ts` — runs pose detection, angles, wrist, and annotation off the main thread. Calls the same `lib` modules as the inline path.
- `prepare.worker.ts` — off-thread image decode/downscale.
- `protocol.ts`, `prepareProtocol.ts` — the message contracts between the page and the workers.

### `src/assessment` — the scoring

- `rula/rula.ts`, `rula/rulaTables.ts` — RULA scoring and its published lookup tables. `buildAutoInput` (angles to a `PostureInput`) and `computeRula` live here.
- `reba/`, `owas/` — the same shape for REBA and OWAS.
- `niosh/` — the separate NIOSH lifting calculator (form-driven, not pose-driven).
- `registry.ts` — the list of methods and how the UI switches between them.
- `recommendations.ts`, `thresholds.ts` — turning a score into plain-language advice.
- `types.ts` — `PostureInput`, `AssessmentResult`, and friends.

### `src/components` — the UI

- `Uploader.tsx` — drag-and-drop, paste, and the file list.
- `Landing.tsx` — the landing page.
- `Scorecard.tsx` — the grand score and group breakdown.
- `MeasurementSummary.tsx` — the measured-versus-assumed panel and the confidence badge.
- `AdjustmentsPanel.tsx` — the controls for the factors a camera cannot see; editing these re-scores live.
- `VideoResults.tsx` — the video timeline, peak/mean stats, and worst-frame view.
- `RecommendationsPanel.tsx`, `NioshCalculator.tsx`, `VideoSettings.tsx`, and the smaller presentational pieces.

### `src/three` — the 3D viewer

- `PoseViewer3D.tsx`, `skeleton.ts`, `riskColors.ts`, `usePalette.ts`, `HeroScene.tsx` — the React-Three-Fiber view of the detected 3D pose. This is where you can literally see a bad detection collapse.

### `src/hooks`

- `useTheme.ts`, `useComputeTimeline.ts` — small view-model helpers.

## Trace 1: follow a photo

Start at a click and follow the calls.

1. `Uploader.tsx` hands files to `App.tsx`, which stores them and moves to the computing phase.
2. `App.tsx` calls `getPipeline()` (`pipeline/index.ts`) and then `analyzePhoto(file)` on it.
3. On the worker backend, `workerPipeline.ts` decodes the file with `loadBitmap` (`image.ts`) and sends the bitmap to `analysis.worker.ts`. On the inline backend, `analyze.ts` `analyzePhoto` does the same work directly. Same functions, different thread.
4. `detectPose` (`poseLandmarker.ts`) returns 33 landmarks, in 2D and 3D.
5. `computeAngles` (`angles.ts`) turns them into upper arm, forearm, neck, trunk, and knee angles, and computes a detection confidence.
6. The gate: if `computePoseValidity` and the confidence fall below the occlusion floor, the photo is marked not-scorable and you get the "full-body side view" message instead of a number.
7. If it passes, `detectHandsCropped` (`handRoi.ts`) plus `measureWristFlexion` (`angles.ts`) measure the wrist.
8. `buildAutoInput` (`rula.ts`) packs the angles into a `PostureInput`, and `computeRula` scores it against the tables.
9. The result flows back to `App.tsx`, which renders `Scorecard`, `MeasurementSummary`, and `AdjustmentsPanel`. Editing an adjustment calls `computeRula` again with the new input.

## Trace 2: follow a video

Video reuses the same per-frame detection, then adds a post-processing layer.

1. `App.tsx` calls `analyzeVideo` on the pipeline.
2. `sampleVideoFrames` (`videoFrames.ts`) seeks through the file and produces frames one at a time.
3. Each frame runs the same `detectPose` and `computeAngles` as a photo. Frames with no reliable pose, or below the occlusion floor, are skipped rather than guessed at.
4. Per-frame results collect into a `RawVideoFrame[]`, then `assembleVideoAnalysis` (`pipeline/shared.ts`) does the video-only work: it smooths each angle over a rolling window, detects whether a posture is held or repeated, and scores each frame.
5. `VideoResults.tsx` recomputes the score for every frame and shows the peak (worst) frame, the mean, and a timeline.

### Why a video scores differently from a photo of the same task

This trips people up, so it is worth spelling out. Four reasons, all visible in the code above.

1. Peak versus one instant. The photo scores a single moment. The video's headline number is the worst frame in the whole clip (`stats.peak` in `VideoResults.tsx`). A clip almost always contains a worse instant than any one snapshot.

2. Video adds points a photo cannot. `detectTemporal` and `assembleVideoAnalysis` (`pipeline/shared.ts`) set the muscle-use and activity flags when a posture is held still or repeated. RULA and REBA add score for those. A photo leaves them neutral because it cannot see them, so video scores trend higher for the same posture.

3. Smoothing. Video averages each angle over a roughly 2.5 second window (`SMOOTH_WINDOW_SEC`, `smoothChannel`) before scoring. A photo uses the raw single-frame angle. Different input numbers, different score.

4. Different instants and per-frame gating. Video samples many frames, none of which is exactly the photo's moment, and the occlusion and wrist-visibility gates include or drop different frames. So the wrist measurement and even which side is scored can shift from frame to frame.

None of this is a bug. Video is meant to catch strain over time that a still cannot, so a higher and more variable number is expected.

## Key concepts

- World versus image landmarks. Every pose landmark comes in two forms: a 2D position on the image and a 3D position in meters with the origin at the hips. `angles.ts` prefers the 3D form because a joint angle measured in true 3D does not distort when the camera is off to the side.
- The confidence and validity gate. Detection confidence is coverage times quality times validity (`computeDetectionConfidence`, `computePoseValidity` in `angles.ts`). Validity checks that the whole upper body is in frame and that the head sits above the shoulders in 3D, which is how the app rejects a skeleton hallucinated onto a partial body. Below the occlusion floor, nothing is scored.
- Measured versus assumed. The camera sees angles but not twist, load, or support. `buildAutoInput` fills the unseen factors with neutral defaults, `MeasurementSummary` lists which is which, and `AdjustmentsPanel` lets a person correct them.
- Worker versus inline. `pipeline/index.ts` runs everything on a worker by default and falls back to the main thread. The scoring math is identical either way, which is why the core modules avoid the DOM.
- Determinism. The same photo can vary slightly across machines because model inference can run on the graphics hardware. Setting `ergo-deterministic` to `1` in local storage forces the reproducible CPU path.

## How to run and test

- `npm run dev` starts the app on `http://localhost:5173`.
- `npm test` runs the Vitest suite. `npm run build` type-checks and builds.

The tests worth knowing:

- `src/test/baseline.test.ts` locks the RULA and REBA scores for the bundled sample photos. If a score here changes, scoring behavior changed, and that should be deliberate.
- `src/assessment/rula/rula.test.ts` (and `reba`, `owas`) check the scoring tables directly.
- `src/lib/angles.test.ts` checks side selection, the signed neck angle, the confidence figure, and the pose-validity rejection.

## Where to focus a review

Most of the risk is in a few files. Spend your attention there.

- `angles.ts` is the densest logic: coordinate conventions, the worst-side choice, the signed neck angle, and the validity gate. Small mistakes here move every score.
- `pipeline/shared.ts` owns everything video-specific. If a video result looks off, start here.
- `poseLandmarker.ts` and `handLandmarker.ts` control model loading and the GPU-versus-CPU path, which is where cross-machine differences come from.
- The gates in `analyze.ts` and `analysis.worker.ts` decide what gets scored at all. These two paths must agree; a past bug was the worker path skipping a gate the inline path applied.

The components, the `three` viewer, and the export files are mostly presentational. Read them last, and lean on the tests for the parts that are covered.
