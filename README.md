# Ergo AI
### Deterministic Ergonomic Assessment (RULA & REBA) from Photos and Video

Ergo AI is a computer-vision platform for ergonomics professionals, safety engineers, and occupational therapists. It automates **RULA (Rapid Upper Limb Assessment)** and **REBA (Rapid Entire Body Assessment)** workflows: upload a photo or short clip of a working posture, get a scored, reviewable, exportable assessment.

Live at **[rulaergo.com](https://rulaergo.com)**.

---

## Why Ergo AI

### 1. Same photo, same score — on every device, every time
Browser-side ML gives different results on different machines: GPU inference is not bit-identical across vendors and drivers, which shifts keypoints and can flip a risk band at a boundary. Ergo AI runs pose inference on a **single pinned model build on fixed CPU hardware** (a stateless inference service, see [`server/`](server/)). The same image bytes always produce identical keypoints — and identical scores — regardless of the phone, laptop, or browser used. Every report and export is stamped with the exact `model_version` for provenance.

### 2. Research-grade pose estimation
Detection uses **RTMPose wholebody (RTMW)** — 133 body + hand keypoints with per-point confidence — behind a YOLOX person detector that isolates the subject before measurement, so bystanders can't contaminate the result. The wholebody hand keypoints yield measured wrist flexion without a second model. Angles are derived in the sagittal plane, the standard method for photo-based RULA/REBA.

### 3. Best estimate + expert review — never silent guesses
When a joint is occluded or out of frame, the model still produces its best geometric estimate — and Ergo AI **flags it** instead of hiding it: the results card names the estimated angles, the measurement summary separates *measured* from *estimated — review*, the adjustment sliders carry review chips, and PDF exports print the same warnings. Angled/frontal photos get an explicit foreshortening warning. This mirrors professional assessment practice: best estimate plus assessor override, with nothing suppressed and nothing silently trusted.

### 4. Private by architecture
Photos are transmitted over HTTPS to the stateless inference service, processed **entirely in memory, and immediately discarded** — never written to disk, logged, stored, or used for training. Scores, adjustments, session restore, and every export are generated locally in the browser. No accounts, no tracking.

---

## Feature Highlights

*   **RULA & REBA scoring engines:** full tabular lookups implemented directly from McAtamney & Corlett (1993) and Hignett & McAtamney (2000), cross-checked cell-for-cell against the published worksheets, plus OWAS, NERPA (Sánchez-Lite et al. 2013), and a NIOSH lifting-equation calculator.
*   **Batch image processing:** queue and score up to 30 photos, automatically sorted worst-first with a batch summary.
*   **Temporal video analysis:** fixed-policy frame sampling with rolling-window smoothing and posture-cycle detection that flags repetitive or sustained static strain.
*   **Interactive adjustments panel:** tweak the factors a single camera cannot observe (wrist deviation, arm support, muscle use, load) with live re-scoring.
*   **Professional exports:** PDF reports (cover page, risk legend, measured angles, flagged estimates, documented assumptions), plus CSV and JSON with full model provenance.

## Technical Architecture

*   **Client:** React 18 + Vite + TypeScript SPA (GitHub Pages). Scoring engines, angle derivation, exports, and session restore all run in the browser.
*   **Inference service:** FastAPI + ONNX Runtime (CPU) in a Docker container ([`server/`](server/)) — stateless, in-memory only, model files SHA-256-pinned at build. Portable to any container host; currently on Google Cloud Run (scale-to-zero).
*   **Styling / animation:** Tailwind CSS + GSAP.
*   **Testing:** vitest (client, fixture-driven — no live server needed) and pytest (server, golden keypoint regression + run-to-run determinism gates).

## Getting Started (Local Development)

### Client
```bash
git clone https://github.com/oldhero07/Ergo-AI.git
cd Ergo-AI
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run typecheck
```

By default the client talks to the production inference service. To run against a local one, create `.env.local` with `VITE_POSE_API_URL=http://localhost:7860`.

### Inference server
```bash
cd server
pip install -r requirements.txt
python scripts/download_models.py   # fetches + verifies the pinned ONNX models
uvicorn app:app --port 7860
pytest
```

See [server/README.md](server/README.md) for the API contract and reproducibility guarantees.

---

*Scores are a lower-bound estimate from a single camera view and are not a substitute for a full observation by a trained assessor.*
