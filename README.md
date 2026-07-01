# Ergo-AI
### State-of-the-Art On-Device Ergonomic Assessment (RULA & REBA)

Ergo-AI is a high-precision, privacy-first computer vision platform designed for ergonomics professionals, safety engineers, and occupational therapists. It automates **RULA (Rapid Upper Limb Assessment)** and **REBA (Rapid Entire Body Assessment)** workflows directly in-browser using advanced machine learning.

---

## 🌟 Why Ergo-AI Leads the Field

Traditional ergonomic tools force a compromise between **scientific accuracy**, **data privacy**, and **processing speed**. Ergo-AI eliminates these tradeoffs:

### 1. True 3D Kinematic Math (Perspective-Invariant)
*   **The Problem in Competitors:** Most 2D posture calculators analyze raw image pixels. If the camera is tilted or the subject is standing at a slight angle (e.g., 45° instead of a flat 90° profile), the estimated joint angles distort, shifting results by up to 2 full risk bands.
*   **The Ergo-AI Solution:** We use Google MediaPipe's **3D Metric World Landmarks** (hip-centered coordinates in meters). Joint angles for the upper arm, lower arm, neck, trunk, and knees are computed in true 3D space, resolving camera-angle distortion and providing clinical-grade consistency.

### 2. Dual-Model Precision (Automatic Wrist Flexion)
*   **The Problem in Competitors:** Standard pose estimation models (33 body landmarks) cannot track fingers or hands, meaning wrist flexion/extension is ignored or left to optimistic defaults.
*   **The Ergo-AI Solution:** When a wrist is visible, Ergo-AI automatically launches a secondary **Hand Landmarker model** in parallel. It calculates the exact angle of wrist flexion/extension relative to the forearm axis, eliminating manual estimation.

### 3. High-Speed Cropped Video Tracking (ROI Optimization)
*   **The Problem in Competitors:** Running two neural networks simultaneously on high-resolution video frames (e.g. 720p or 1080p) causes intense browser lag and memory crashes.
*   **The Ergo-AI Solution:** Ergo-AI tracks the wrist coordinate via the Pose model, **crops a 35% square bounding region (Region of Interest)** around the hand, runs the hand landmarker *only* on that small sub-image, and scales the coordinates back. This is **5x to 10x faster** than full-frame analysis while maintaining a quality fallback to full-frame detection if the hand is extended.

### 4. Privacy-First & Fully Offline (Local-Execution)
*   **The Problem in Competitors:** Cloud-based ML tools upload video clips of employees to external servers, creating major legal, security, and union issues.
*   **The Ergo-AI Solution:** Everything runs entirely client-side on the user's device using WebGL-accelerated WebAssembly. 
*   **Service Worker Integration (`sw.js`):** Large neural net model tasks (30.7 MB Pose model and 5.7 MB Hand model) are bundled and cached locally. After the first load, the app opens instantly and runs **100% offline** without transferring a single byte of data.

---

## 📊 Feature Highlights

*   **RULA & REBA Scoring Engines:** Full tabular lookup tables implemented directly from McAtamney & Corlett (1993) and Hignett & McAtamney (2000).
*   **Batch Image Processing:** Queue and score up to 30 images simultaneously, automatically sorted from worst to best posture with visual risk indicators.
*   **Temporal Video Analysis:** Seeking, sampling, and smoothing of frame-by-frame angles over time, complete with posture cycle detection to automatically flag repetitive or static task strain.
*   **Interactive Adjustments Panel:** Tweak factors that a single camera cannot observe (e.g., wrist deviation/twist, arm support, muscle use, external load force) with live RULA/REBA re-scoring.
*   **Professional PDF Audits:** Export formatted reports including cover pages, color-coded risk legends, measured joint angles, and documented task assumptions.

---

## 🛠️ Technical Architecture

*   **Framework:** React 18 + Vite + TypeScript (Single Page Application)
*   **Styling:** Tailwind CSS + shadcn/ui + custom Glassmorphic HUD elements
*   **Animations:** GSAP (GreenSock) for high-performance timeline rendering
*   **ML Runtimes:** `@mediapipe/tasks-vision` (WebAssembly & WebGL)
*   **Service Worker:** Custom caching middleware with Cache-First & Stale-While-Revalidate configurations

---

## 🚀 Getting Started (Local Development)

### Prerequisites
*   Node.js (v18 or higher)
*   npm or yarn

### Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/oldhero07/Ergo-AI.git
    cd Ergo-AI
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch the local development server:
    ```bash
    npm run dev
    ```
4.  Open your browser to the local URL (typically `http://localhost:5173/`).
