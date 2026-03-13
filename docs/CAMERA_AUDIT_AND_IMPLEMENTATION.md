# Camera feature – audit and implementation

## Phase 1: Audit summary

### 1. Project type

| Question | Answer |
|----------|--------|
| Expo managed? | **No** – no `expo` in package.json, no `app.json` / `app.config.*`. |
| Bare React Native? | **No** – no `react-native` dependency. |
| React Native Web? | **No** – no React Native at all. |
| Vite/React web app? | **Yes** – `package.json` has `vite`, `react`, `react-dom`; scripts are `vite`, `vite build`, `vite preview`. |
| Embedded in iframe? | **Yes** – designed to be embedded in WordPress (Elementor) via iframe; see `docs/WORDPRESS_ELEMENTOR_EMBED.md` and `wordpress-plugin/will-tool-embed/`. |

**Conclusion:** This is a **Vite + React web application** that can be embedded in an iframe. It is **not** React Native or Expo.

---

### 2. Relevant packages (package.json)

| Package | Present? | Purpose |
|---------|----------|---------|
| expo | No | N/A |
| react-native | No | N/A |
| expo-camera | No | N/A |
| react-native-vision-camera | No | N/A |
| react-webcam | No | N/A |
| Custom getUserMedia | **Yes** – in code only | Camera implemented with `navigator.mediaDevices.getUserMedia()` in `src/components/IdentityVerification.jsx`. |

No camera-related npm packages are installed. Camera is implemented with the **browser MediaDevices API** (getUserMedia) only.

---

### 3. Codebase search results

| Search term | Location | Notes |
|-------------|----------|--------|
| CameraView | None | Not used. |
| Expo Camera | None | Not used. |
| VisionCamera | None | Not used. |
| getUserMedia | `IdentityVerification.jsx` (lines 170, 237) | Single implementation. |
| enumerateDevices | None | Not used (no device listing or switch UI before this implementation). |
| Permission requests | `IdentityVerification.jsx` | Via getUserMedia; errors show “denied” / “no camera” messages. |
| iframe/embed | `docs/`, `wordpress-plugin/will-tool-embed/` | App is embedded via iframe; plugin outputs iframe **without** `allow="camera"`. |

---

### 4. Current camera approach and gaps

**Approach:** Browser `navigator.mediaDevices.getUserMedia()` with:

- `facingMode: 'user'` for selfie, `'environment'` for ID/docs.
- Video shown in a modal with `<video autoPlay playsInline muted>`, canvas capture to JPEG blob, then base64 via FileReader into form state.
- Compression via `compressIdImages.js`; file upload fallback via file input.

**What works:**

- Single, non-duplicated implementation.
- Permission denied and NotFoundError messages.
- “Take photo” and “Upload” flows; no conflicting camera stacks.

**Gaps fixed in this implementation:**

1. **No loading state** – While the stream is requested, the video area is shown but empty (black); no “Loading camera…”.
2. **OverconstrainedError** – Using `facingMode: 'environment'` on devices without a rear camera (e.g. desktop) can throw; no fallback to `user` or unconstrained.
3. **No camera switch** – No UI to choose front/back when multiple cameras exist.
4. **No capture preview/retake** – After capture the image is saved immediately; no “Use this” / “Retake” step.
5. **Secure context** – getUserMedia requires a secure context (HTTPS or localhost); no check or message when not secure.
6. **iframe Permissions Policy** – Docs and WordPress plugin iframe do not include `allow="camera"`, so camera in iframe can be blocked by the browser.

**HTTPS:** getUserMedia **requires a secure context** (HTTPS or `localhost`). On HTTP (except localhost), the API may be undefined or reject.

**Iframe:** For camera to work inside the iframe, the **embedder** must grant it via the iframe `allow` attribute (e.g. `allow="camera"`). Otherwise the browser can block camera access (NotAllowedError).

---

## Phase 2: Chosen implementation

**Strategy: browser getUserMedia only (no new packages).**

| Option | Reason not used |
|--------|------------------|
| Expo Camera | Project is not Expo/React Native. |
| react-native-vision-camera | No React Native; web-only. |
| react-webcam | Unnecessary; current getUserMedia implementation is in one place; adding a dependency would not fix the gaps (loading, OverconstrainedError, iframe allow). |

**Why browser getUserMedia:**

- Project is **web-only** (Vite + React).
- Single code path for all platforms (iPhone, Android, iPad, desktop Chrome/Safari/Edge, Mac/Windows).
- Works in iframe **if** the iframe has `allow="camera"`.
- No native builds; no iOS/Android permission config files (Info.plist/AndroidManifest) in this repo.
- Aligns with “do not guess”: audit shows only this implementation exists and it is the correct one for this stack.

---

## Phase 3 & 4: Implementation and hardening

Implemented in code and docs:

1. **Secure context** – Check `window.isSecureContext`; if false, show a clear message and rely on “Upload” only.
2. **Loading state** – “Loading camera…” until the stream is attached and video is ready (e.g. `loadedmetadata` or first frame).
3. **Permission denied / no camera / other errors** – Keep and refine messages; “Try again” and “Close”.
4. **OverconstrainedError** – Prefer `ideal` for facingMode; on failure try the other facingMode, then unconstrained.
5. **Camera list and switch** – Use `enumerateDevices()` to list video inputs; allow switching front/back (or first available) where supported.
6. **Capture → preview → confirm** – After capture, show preview with “Use this” and “Retake”; on “Use this” persist and close.
7. **Fallback** – “Upload” remains the fallback when camera is unavailable or denied.
8. **iframe** – Docs and WordPress plugin updated to use `allow="camera"` on the iframe; Permissions-Policy and testing notes documented.
9. **Black preview / autoplay** – Video kept as `autoPlay playsInline muted`; preview only shown when stream is set and (optionally) video has received data to avoid blank flash.
10. **Platform checklist** – See “Testing checklist” below and platform notes in this doc.

---

## Phase 5: Files changed and config

### Files modified

- `src/components/IdentityVerification.jsx` – Camera flow: secure context, loading, error handling, OverconstrainedError fallback, device list and switch, capture → preview → confirm/retake.
- `docs/WORDPRESS_ELEMENTOR_EMBED.md` – iframe examples updated with `allow="camera"`; note on HTTPS and camera in iframe.
- `wordpress-plugin/will-tool-embed/will-tool-embed.php` – iframe output updated to include `allow="camera"`.
- `docs/CAMERA_AUDIT_AND_IMPLEMENTATION.md` – This file (audit, strategy, testing checklist, platform notes).

### Config / env

- **vercel.json** – No change. Existing `frame-ancestors *` is for embedding; camera is granted by the **embedder’s** iframe `allow` attribute.
- **index.html / vite** – No change for camera.
- **app.json / Info.plist / AndroidManifest** – Not applicable (web-only; no native app in this repo).

### Iframe embed (for camera)

Parent page must embed with camera allowed, e.g.:

```html
<iframe
  src="https://YOUR-WILL-TOOL-URL.com/"
  width="100%"
  height="800"
  style="min-height: 80vh; border: none;"
  title="Will Form Generator"
  allow="camera"
></iframe>
```

- `allow="camera"` is required for getUserMedia to work inside the iframe.
- Microphone is not used by the app; adding `microphone` is optional and harmless if you plan to use it later.
- App must be served over **HTTPS** (or localhost) for camera to work.

---

## Testing checklist

Use this to verify camera and fallback across environments.

### Before testing

- [ ] App is served over **HTTPS** (or `http://localhost`).
- [ ] If embedded: iframe has `allow="camera"`.
- [ ] Browser has granted (or can be prompted for) camera permission for this origin.

### Take photo flow

- [ ] “Take photo” opens modal.
- [ ] “Loading camera…” appears briefly (or camera preview appears).
- [ ] Live preview shows (no persistent black screen).
- [ ] “Capture photo” captures; preview of image appears with “Use this” / “Retake”.
- [ ] “Retake” returns to live preview; “Use this” saves and closes.
- [ ] Saved image appears as “Uploaded” and persists in form/draft.

### Fallback and errors

- [ ] When camera is denied: clear message and “Try again” / “Close”; “Upload” still works.
- [ ] When no camera: “No camera found” (or similar); “Upload” works.
- [ ] On HTTP (non-localhost): secure-context message and “Upload” only (if implemented).
- [ ] In iframe without `allow="camera"`: permission error; “Upload” works.

### Upload fallback

- [ ] “Upload” opens file picker; image (and allowed types) can be selected and appear as “Uploaded”.

### Responsive

- [ ] Modal and preview usable at 375px (mobile), 768px (tablet), 1280px+ (desktop).
- [ ] No overflow or broken layout; buttons and labels visible.

### Platform-specific (manual)

- [ ] **iPhone Safari** – Camera opens; front/back switch if multiple cameras; capture and retake work.
- [ ] **Android Chrome** – Same.
- [ ] **iPad Safari** – Same.
- [ ] **Desktop Chrome** – Webcam works; “environment” may fall back to default camera.
- [ ] **Desktop Safari** – Same.
- [ ] **Desktop Edge** – Same.
- [ ] **Mac/Windows laptops** – Single camera; no OverconstrainedError; capture works.

---

## Platform limitations (reference)

| Platform | Notes |
|----------|--------|
| iPhone Safari | Requires user gesture to start media; our “Take photo” click is sufficient. iOS may ask “Allow camera” per site. |
| Android Chrome | Same; may need HTTPS. |
| iPad Safari | Same as iPhone. |
| Desktop Chrome/Safari/Edge | Usually one camera; “environment” falls back to “user” or default in our implementation. |
| Iframe (any) | Parent must set `allow="camera"`; otherwise NotAllowedError. |
| HTTP (non-localhost) | getUserMedia not available; secure-context message and upload-only. |

---

## Blocker / incomplete items

- **None** for the scope above. If camera still fails in a specific embed (e.g. WordPress + specific host), verify: (1) iframe `allow="camera"`, (2) HTTPS, (3) no parent CSP or Permissions-Policy blocking camera for the iframe origin.
