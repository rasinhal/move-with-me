# Move With Me

A browser app that watches your body through the camera and guides you through a gentle,
low-impact tai chi session toward a planned calorie goal. No jumping: slow, controlled
movements that build up gradually. It is aimed at adults up to about 60, with gentler
tracks planned for seniors and for people carrying extra weight.

## Status

**Step 1 of 4 is done: camera and body tracking.**

- Opens the front camera and draws a live skeleton over your body (mirrored, like a mirror).
- Tells you in plain words how to stand so the whole body is in view (step back, come closer,
  move left or right).
- Shows live angles for shoulders, elbows, hips and knees. Step 2 will use these to check each move.
- Video is processed in the browser and is never uploaded or recorded.

Planned next: a library of beginner tai chi moves with standard, chair-supported and
reduced-range versions (step 2), a guided session with on-screen and voice cues and a calorie
estimate (step 3), and a profile with safety limits (step 4).

## Running it

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173) and press **Start camera**.
Browsers only allow the camera on `https://` pages or on `localhost`.

Other commands:

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit tests |
| `npm run typecheck` | Checks the TypeScript types |
| `npm run build` | Builds a static site into `dist/` |
| `npm run preview` | Serves the built site locally |

## How it works

- Body tracking uses Google's [MediaPipe Pose Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js)
  (`@mediapipe/tasks-vision`), which finds 33 points on the body in each video frame.
- The WebAssembly runtime is copied from `node_modules` into `public/mediapipe/` by
  `scripts/copy-wasm.mjs` and served by the app itself. The pose model file is downloaded from
  Google's model storage the first time you start the camera, so the first start needs an
  internet connection.
- It runs on the graphics card when it can and falls back to the processor otherwise.
- Joint angles are measured from MediaPipe's 3D "world" landmarks, so they do not change with
  how far you stand from the camera.

| File | Purpose |
| --- | --- |
| `src/main.ts` | Page wiring: start/stop, the tracking loop, the on-screen panels |
| `src/camera.ts` | Starting and stopping the camera, friendly error messages |
| `src/pose.ts` | Loading the pose model |
| `src/framing.ts` | Deciding whether you are well placed in the picture |
| `src/geometry.ts` | Joint angle maths |
| `src/smoothing.ts` | Steadying jumpy readings, frame-rate counter |
| `src/skeleton.ts` | Drawing the skeleton |

## Safety

This is a prototype and not medical advice. Move within a comfortable range and stop if you
feel pain, dizziness or shortness of breath.
