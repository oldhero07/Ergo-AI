# How Ergo-AI works

This document explains what happens between the moment you add a photo and the moment you get an ergonomic risk score. It is written for people who want to understand and trust the method: safety managers, ergonomists, clients, and reviewers. You do not need to read code to follow it.

Ergo-AI looks at a photo or a short video of someone working, finds their body, measures the angles of their joints, and turns those angles into a standard ergonomic score (RULA, REBA, or OWAS). Pose detection runs on a dedicated inference server; everything else — angle math, scoring, adjustments, reports — runs in your browser. Photos are processed in memory on the server and immediately discarded, never stored.

## The short version

1. You drop in a photo.
2. The browser sends the original image bytes over HTTPS to the inference service.
3. On the server, a person detector isolates the subject, and a wholebody pose model locates 133 keypoints — body, head, and both hands — each with its own confidence value. The image is then discarded from memory.
4. Back in the browser, the app derives the joint angles that ergonomic scoring cares about: upper arm, forearm, wrist, neck, trunk, and knees.
5. It looks those angles up in the published RULA/REBA/OWAS tables and produces a grand score with a risk band.
6. It tells you plainly which angles were measured from confidently-seen joints and which need your review, and it lets you correct anything a camera cannot see.

The rest of this document walks through each step and is honest about where the method is reliable and where it is not.

## What the models are

Two models run on the inference server, one after the other.

The first is **YOLOX**, a person detector. It finds the people in the frame and isolates the main subject, so bystanders and background structures cannot contaminate the measurement. If it finds nobody, the photo is not scored — that is the one hard failure in the pipeline.

The second is **RTMPose-wholebody (RTMW)**, a research-grade pose estimation model. Given the detected person, it returns 133 keypoints: the standard 17 body points, plus feet, face, and 21 points per hand. Each keypoint carries a confidence score. The hand keypoints matter for ergonomics: they let the app measure wrist flexion directly, without a separate hand model.

Both model files are pinned by cryptographic hash at build time, and inference runs on fixed CPU hardware. That is what makes the scores reproducible: the same image bytes always produce the same keypoints, and therefore the same score, no matter which phone, laptop, or browser submitted them. Every report and export is stamped with the exact model version for provenance.

## The journey of one photo

### Upload — original bytes, no re-encoding

The browser sends your original file, not a re-compressed copy. Browser image encoders differ from device to device; re-encoding would quietly reintroduce the cross-device variation the server exists to eliminate. The server performs the single canonical decode and downscale. Photos over 12 MB are rejected with a friendly message before upload.

### Finding the body

The person detector locates the subject, and the pose model returns its 133 keypoints with per-point confidence. Unlike some pose models, RTMW's keypoints are real geometric estimates even at low confidence — it does not hallucinate a guessed skeleton for joints it cannot see. That property shapes the app's whole philosophy about uncertainty, described next.

### Flag, never suppress

A single rule governs how Ergo-AI treats uncertainty: **a low-confidence keypoint never silently blocks or changes a score — it flags the affected angle for review.**

Every angle is computed from the best available geometry. Alongside it, the app records whether each angle came from confidently-seen joints (keypoint confidence at or above a fixed floor). Angles below the floor are still computed and still scored, but they are marked "estimated — review" everywhere: in the results panel, in the measurement summary, on the adjustment controls, and in the PDF.

This mirrors professional assessment practice: a best estimate plus assessor override, with nothing suppressed and nothing silently trusted. For a safety tool, hiding an uncertain measurement would be worse than showing it with a warning — the unseen factors can only raise the score, so the automatic number is a lower bound.

The one exception is total failure: if the person detector finds nobody, you get a message asking for a clearer photo, not a number.

### Turning keypoints into angles

Angles are measured in the sagittal (side-view) plane — the standard method for photo-based RULA/REBA, which were themselves designed around observing a worker from the side. The capture guidance asks for a profile shot; when the photo looks angled or frontal instead, the app warns about foreshortening rather than guessing (more on that below).

The angles it measures:

- Upper arm: how far the arm is raised away from the line of the trunk.
- Forearm: how much the elbow is bent.
- Wrist: flexion or extension of the hand relative to the forearm, measured from the wholebody hand keypoints.
- Neck: how far the head is tipped forward (flexion) or back (extension).
- Trunk: how far the back is bent forward from vertical.
- Knee: bend at the knee, when the legs are visible.

Both arms are measured, and the app scores the worse of the two, since that is what a cautious assessor would flag. Neck and trunk are measured from the midline of the body.

The neck deserves a note. Bending the head forward and tipping it back are different risks in RULA, so the app works out which one it is seeing rather than reporting a bare angle. It only calls something "extension" when the head is genuinely tipped back by a realistic amount, so a small wobble near upright is not mistaken for a backward lean.

### The off-profile warning

Sagittal angles are only exact when the camera is truly side-on. When the shot is angled or frontal, angles measured in the image plane are foreshortened — they read smaller than reality. Ergo-AI detects when a photo looks off-profile and says so explicitly, in the results and in the report. Consistent with the flag-never-suppress rule, it still scores the photo; the warning tells you the score may under-read and a proper side view would be better.

### Scoring

With the angles in hand, the app applies the published scoring method, entirely in the browser. RULA is the default. It works in two groups.

Group A covers the arm and wrist: upper arm, forearm, wrist bend, and wrist twist. Each angle maps to a small score, and those combine through the standard RULA table into a single Group A number.

Group B covers the neck, trunk, and legs, and combines the same way into a Group B number.

The two group numbers are then combined through the final RULA table into a grand score from 1 to 7. Muscle use and force or load feed in as well, though on a single photo those are assumptions you can adjust.

The grand score maps to an action level:

| Grand score | Risk band | What it means |
|---|---|---|
| 1 to 2 | Acceptable | Fine unless held or repeated for long periods |
| 3 to 4 | Investigate | Look closer; changes may be needed |
| 5 to 6 | Change soon | Investigate and change the task soon |
| 7 | Change now | Investigate and change immediately |

REBA (for whole-body tasks, scored 1 to 15 with load, coupling, and activity factors) and OWAS (posture categories) work on the same measured angles with their own tables, and you can switch between them without re-analyzing the photo. A separate NIOSH lifting-equation calculator handles lifting tasks from task parameters rather than a photo.

The scoring tables are implemented directly from the published papers — McAtamney & Corlett (1993) for RULA, Hignett & McAtamney (2000) for REBA — and cross-checked cell-for-cell against the published worksheets.

### Measured versus assumed

A single camera cannot see everything a trained assessor checks in person. It cannot tell whether the trunk is twisted, whether the arm is supported, or how heavy the load is. Ergo-AI is upfront about this. Every result separates three kinds of input: angles **measured** from confidently-seen joints, angles **estimated and flagged for review**, and factors **assumed** neutral because no camera can see them.

You can then open the adjustments panel and set the unseen factors yourself: trunk twist, arm support, load weight, muscle use, and so on. The score updates live as you do. This keeps the automatic part honest while letting a human close the gap.

## Video

Video is analyzed as a series of sampled frames — a fixed policy of 2 frames per second, downscaled to 640 pixels on the longest edge, for up to 60 seconds of clip. The frames upload in small batches to the same inference service, and each runs through the same keypoint detection and angle measurement as a photo. Frames where no person is found are skipped and counted, not guessed at.

Two things video adds that a photo cannot. First, the per-frame angles are smoothed over a rolling 2.5-second window, so the risk-over-time view reflects sustained posture rather than single-frame jitter. Second, the app looks across the clip for patterns a still image cannot show: a posture held almost motionless, or a motion repeated many times a minute. Both are recognized ergonomic risk factors, and when detected they feed into every frame's score.

A video's headline number is the worst (peak) frame in the clip, alongside the mean — a clip almost always contains a worse instant than any single snapshot, which is why video scores tend to read higher than a photo of the same task. The review flags and the off-profile warning aggregate across the clip the same way they work for a photo.

## The report

Every analyzed photo comes with an annotated version showing the detected keypoints drawn over the original, so you can check the detection with your own eyes. You also get the measured joint angles and a PDF export with a cover page, the risk legend, per-photo scores, the flagged estimates, and the assumptions that went into each one. CSV and JSON exports carry the same data, including the model version. A batch of photos (up to 30) is sorted worst posture first with a batch summary.

## Privacy and consistency

Photos travel over HTTPS to a stateless inference service, are processed entirely in memory, and are immediately discarded — never written to disk, logged, stored, or used for training. Everything after keypoint detection happens locally in your browser: angles, scores, adjustments, session restore, and every export. There are no accounts and no tracking.

Consistency is the reason the server exists at all. Pose models running in the browser use whatever graphics hardware the device has, and GPU inference is not bit-identical across vendors and drivers — the same photo could land in different risk bands on different machines. Ergo-AI instead runs one pinned model build on fixed CPU hardware, so the same photo produces the same keypoints and the same score everywhere, every time, with the model version stamped on every export.

## Where it is reliable, and where it is not

Ergo-AI is at its best with a clear, full-body, side-on view of one person doing a task. That is the situation the pose model and the ergonomic methods were both built for.

Its results deserve extra scrutiny — and the app will say so — when:

- Joints are occluded or out of frame (those angles are flagged for review).
- The shot is angled or frontal rather than side-on (the off-profile warning).
- The person is partially hidden by equipment.

It is also worth being clear about scope. This is a screening aid. It measures the joint angles a camera can see and applies the published tables faithfully, but it cannot see load, twist, or support, and it does not replace a full assessment by a trained ergonomist. The automatic score is a lower-bound estimate; used for what it is, it is a fast way to flag the postures most worth a closer look.
