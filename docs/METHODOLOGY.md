# How Ergo-AI works

This document explains what happens between the moment you add a photo and the moment you get an ergonomic risk score. It is written for people who want to understand and trust the method: safety managers, ergonomists, clients, and reviewers. You do not need to read code to follow it.

Ergo-AI looks at a photo or a short video of someone working, finds their body, measures the angles of their joints, and turns those angles into a standard ergonomic score (RULA, REBA, or OWAS). Everything runs inside your web browser. The photos never leave your device.

## The short version

1. You drop in a photo.
2. The browser decodes it and hands it to a pose-detection model that finds 33 points on the body.
3. Before trusting anything, the app checks that it actually found a whole, real person and not a stray guess.
4. It measures the joint angles that ergonomic scoring cares about: upper arm, forearm, neck, trunk, and knees. A second model measures the wrist.
5. It looks those angles up in the published RULA/REBA/OWAS tables and produces a grand score from 1 to 7, with a risk band.
6. It tells you plainly what it measured from the image and what it had to assume, and it lets you correct the assumptions.

The rest of this document walks through each step and is honest about where the method is reliable and where it is not.

## What the models are

Ergo-AI uses two machine-learning models from Google's MediaPipe library, both running locally.

The main one is the Pose Landmarker (the "heavy" variant, about 30.7 MB). Given an image, it returns 33 landmarks for a single person: shoulders, elbows, wrists, hips, knees, ankles, and points on the head. It returns each landmark twice. Once as a 2D position on the image, and once as a 3D position in real-world units (meters), with the origin at the center of the hips. The 3D version is what lets the app measure a joint angle correctly even when the camera is not perfectly side-on.

The second model is the Hand Landmarker (about 7.8 MB). The pose model has no fingers, so it cannot see wrist bend. When a wrist is visible, Ergo-AI runs the hand model on a small crop around that wrist to measure how far the hand is flexed or extended.

Both model files ship with the app. The first time you use it, they download and cache on your device. After that the app works offline.

## The journey of one photo

### Loading and decoding

When you add a photo, the browser first decodes it into pixels. Two things happen here that matter for accuracy. Phone photos usually store their rotation as a separate orientation tag rather than rotating the actual pixels, so the app reads that tag and rotates the image to match what you see. Very large photos are scaled down so the longest side is at most 2048 pixels, which keeps memory and speed sane without hurting detection.

### Where the analysis runs

Running a neural network on a full-resolution photo is heavy work. If it ran on the same thread that draws the page, the interface would freeze. So by default Ergo-AI does the detection on a background worker thread, and the page stays responsive while a batch of photos is processed one at a time. On browsers that do not support this, it falls back to running in the foreground. The math is identical either way.

### Finding the body

The pose model scans the image and returns its best estimate of one person's 33 landmarks. Each landmark also carries a visibility value: the model's own sense of how sure it is that the point is actually there and not occluded.

This is the step where things can go wrong, so it is also where the app is most careful. A pose model will always try to return a skeleton, even when the image does not really contain a full person. If someone is standing at the edge of the frame with only their legs showing, the model may still hallucinate a head and shoulders. Left unchecked, that produces a confident-looking score for a body that was never properly in the picture.

### Checking that the detection is real

Before Ergo-AI measures anything, it asks two questions about the detected pose.

First, is the whole upper body actually in frame? The score depends on the head, both shoulders, and both hips. If any of those anchor points fall outside the image or have low visibility, the detection is treated as partial and is not scored. This catches the common case of a person who is only half in the shot.

Second, does the skeleton make anatomical sense in 3D? When the model forces a full skeleton onto a partial body, the 3D result tends to collapse: the head ends up sitting on top of the shoulders with no neck between them. A real pose always keeps the head clearly above the shoulders along the line of the spine. Ergo-AI checks for that gap. If the head has collapsed onto the shoulders, the detection is rejected.

On top of these checks, the pose model itself is set to a fairly strict detection threshold, so it declines to return a pose it is only weakly sure about.

If a detection fails these checks, you do not get a wrong score. You get a message that says the photo needs a clearer, full-body side view. This is deliberate. For a safety tool, a confidently wrong number is worse than no number.

### Turning joints into angles

Once a pose passes the checks, the app measures the angles that ergonomic methods score. It prefers the 3D world coordinates, because a joint angle measured in true 3D does not distort when the camera is at a slight angle. It falls back to 2D only when 3D data is missing.

The angles it measures:

- Upper arm: how far the arm is raised away from the line of the trunk.
- Forearm: how much the elbow is bent.
- Neck: how far the head is tipped forward (flexion) or back (extension).
- Trunk: how far the back is bent forward from vertical.
- Knee: bend at the knee, when the legs are visible.

Both the left and right arms are measured, and the app scores the worse of the two, since that is what a cautious assessor would flag. Neck and trunk are measured from the midline of the body, so they do not depend on which side you are looking at.

The neck deserves a note. Bending the head forward and tipping it back are different risks in RULA, so the app works out which one it is seeing rather than reporting a bare angle. It only calls something "extension" when the head is genuinely tipped back by a realistic amount, so a small wobble near upright is not mistaken for a backward lean.

### The wrist

If the scored wrist is visible, Ergo-AI crops a small square around it and runs the hand model on that crop. Working on a small region is much faster than scanning the whole frame, and it finds smaller or more distant hands that a full-frame pass would miss. From the hand landmarks it measures the flexion angle of the wrist relative to the forearm. If no hand is found, or the hand model cannot load, the wrist is left at an assumed neutral position and the report says so.

### Scoring

With the angles in hand, the app applies the published scoring method. RULA is the default. It works in two groups.

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

REBA (for whole-body tasks) and OWAS (posture categories) work on the same measured angles with their own tables, and you can switch between them without re-analyzing the photo.

### Measured versus assumed

A single camera cannot see everything a trained assessor checks in person. It cannot tell whether the trunk is twisted, whether the arm is supported, or how heavy the load is. Ergo-AI is upfront about this. Every result lists what it measured directly from the image and what it assumed to be neutral. Because the unseen factors can only raise the score, the initial number is a lower bound.

You can then open the adjustments panel and set those factors yourself: trunk twist, arm support, load weight, muscle use, and so on. The score updates live as you do. This keeps the automatic part honest while letting a human close the gap.

## The confidence number

Older versions of the app reported a confidence figure that was really just landmark visibility, which sits near 99% for anyone who is in the shot. That number looked reassuring and meant almost nothing.

The confidence you see now is built from three things multiplied together:

- Coverage: how many of the joints the score depends on were actually seen.
- Quality: how visible those joints were on average.
- Validity: whether the detection passed the whole-body and anatomy checks described earlier.

Because validity can drop the whole figure toward zero, a partial or collapsed detection now reads as low confidence rather than high. A detection below 0.4 is not scored at all. The result is a number that moves with the real quality of the detection instead of sitting pinned near the top.

## Video

Video is analyzed as a series of sampled frames. Each frame runs through the same pose detection, checks, and angle measurement as a photo. Frames where no reliable pose is found are skipped rather than guessed at.

Two things video adds that a photo cannot. First, the per-frame angles are smoothed over a rolling window of a couple of seconds, so the risk-over-time view reflects sustained posture rather than single-frame jitter. Second, the app looks across the clip for patterns a still image cannot show: a posture held almost motionless, or a motion repeated many times a minute. Both are recognized ergonomic risk factors, and when detected they feed into the score.

## The report

Every analyzed photo comes with an annotated version showing the detected skeleton drawn over the original, so you can check the detection with your own eyes. You also get the measured joint angles, an interactive 3D view of the detected pose, and a PDF export with a cover page, the risk legend, per-photo scores, and the assumptions that went into each one. A batch of photos is sorted worst posture first.

If a photo slips through with a detection you do not trust, you can exclude it from the report by hand, and it drops out of the batch average and the exports.

## Privacy and consistency

Nothing is uploaded. The models and all processing run in your browser, and after the first load the app works with no network at all. For workplaces where photos of employees carry legal and privacy weight, this matters: no clip of anyone ever leaves the device.

One honest caveat about consistency. The same photo can produce slightly different numbers on different machines, because the underlying model can run on the graphics hardware, and graphics hardware is not identical across a Mac and a Windows PC. The differences are small, but at the boundary between two risk bands a small difference can flip the score.

Ergo-AI reduces this in two ways. The model files are pinned and served locally, so every device runs the exact same weights rather than whatever a content network happens to serve that day. And there is a deterministic mode that forces the slower but fully reproducible processor path, which you can turn on when you need two machines to agree exactly. You enable it by setting `ergo-deterministic` to `1` in the browser's local storage.

## Where it is reliable, and where it is not

Ergo-AI is at its best with a clear, full-body, side-on view of one person doing a task. That is the situation the underlying pose model and the ergonomic methods were both built for.

It struggles, and will often refuse to score, when:

- Only part of the body is in frame.
- The shot is taken from directly overhead or at a steep angle.
- More than one person is in the picture and the wrong one is picked up.
- The person is heavily occluded by equipment.

In those cases the right outcome is a rejection or a manual exclusion, not a number, and the app is tuned to err that way.

It is also worth being clear about scope. This is a screening aid. It measures the joint angles a camera can see and applies the published tables faithfully, but it cannot see load, twist, or support, and it does not replace a full assessment by a trained ergonomist. Used for what it is, it is a fast way to flag the postures most worth a closer look.
