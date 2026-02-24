# Implementation Reference – Exact Code and Locations

## 1) DOB

**Which file/component contains the DOB field?**  
`src/components/FieldRenderer.jsx`. The DOB is rendered when `field.type === 'date'`; the first such field in the form is `dateOfBirth` from `src/data/Complete-WillSuite-Form-Data.json` (id `"dateOfBirth"` in the "Personal Information" section).

**Exact DOB field JSX (trigger + modal with input and calendar):**

```jsx
// FieldRenderer.jsx lines 1324-1512 (condensed structure)
<p className="text-xs text-gray-500 mb-1.5">Click to open — then type the date (DD/MM/YYYY) or pick from the calendar.</p>
<div className="relative">
  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
    {FieldIcon}
  </div>
  <button
    type="button"
    onClick={() => {
      setDatePickerManualValue(prev => ({ ...prev, [field.id]: currentDisplayValue }));
      setDatePickerOpen(prev => ({ ...prev, [field.id]: true }));
    }}
    className={...}
    title="Click to type or pick a date"
    aria-label={`${field.label}, click to open date picker`}
  >
    <span className={currentDisplayValue ? 'text-gray-800' : 'text-gray-400'}>
      {currentDisplayValue || 'DD/MM/YYYY'}
    </span>
  </button>
  <div className="absolute right-3 ..."><Calendar size={18} /></div>
</div>

{/* Custom date modal */}
{datePickerOpen[field.id] && (
  <div className="fixed inset-0 z-[10000] ..." onClick={() => setDatePickerOpen(prev => ({ ...prev, [field.id]: false }))}>
    <div className="bg-white rounded-xl ..." onClick={(e) => e.stopPropagation()}>
      <h3>{field.label}</h3>
      {/* Manual type-in */}
      <label>Type date (DD/MM/YYYY)</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={datePickerManualValue[field.id] ?? ''}
          onChange={(e) => setDatePickerManualValue(prev => ({ ...prev, [field.id]: e.target.value }))}
          placeholder="e.g. 22/03/1975"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const raw = (datePickerManualValue[field.id] ?? '').trim();
              const iso = raw.match(/^\d{4}-\d{2}-\d{2}$/) ? raw : ukDateToISO(raw);
              // validate, then: setFormValues(..., isoDate), setDatePickerOpen(..., false)
            }
          }}
        />
        <button type="button" onClick={...}>Use this date</button>
      </div>
      <p className="text-xs text-gray-500">Enter date then press Enter or click "Use this date"</p>
      {/* Calendar */}
      <p>Or pick from calendar</p>
      <LazyDatePicker selected={...} onChange={(date) => { ... setFormValues(..., isoDate); setDatePickerOpen(..., false); }} inline dateFormat="dd/MM/yyyy" locale="en-GB" showYearDropdown showMonthDropdown maxDate={new Date()} />
      <button onClick={() => setDatePickerOpen(..., false)}>Cancel</button>
    </div>
  </div>
)}
```

**Confirm:**  
- **Manual typing:** Yes. User clicks the trigger → modal opens → types in the text input (DD/MM/YYYY) → Enter or “Use this date” → parsed with `ukDateToISO`, validated, then saved and modal closed.  
- **Date picker:** Yes. Same modal shows inline `LazyDatePicker`; selecting a date saves and closes.  
- **Validation/masking:**  
  - Validation: `ukDateToISO` for DD/MM/YYYY or already YYYY-MM-DD; invalid format shows “Use format DD/MM/YYYY (e.g. 22/03/1975).” or “Invalid date.”  
  - For `field.id === 'dateOfBirth'`, future dates show “Date of birth cannot be in the future.”  
  - No input masking; free text then parse/validate.

---

## 2) Testamentary Capacity (Solicitor-only)

**How access is restricted:**  
The “Testamentary Capacity” section is removed from the list of sections shown to clients. Clients never see it in the sidebar or in the step flow. Solicitors see it when the app is opened with `?solicitor=1` (or `true`/`yes`).

**a) Role/solicitor check (where it comes from):**

File: `src/constants/clientMode.js`

```javascript
export const isSolicitorMode = () => {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const val = params.get('solicitor');
  if (val === '1' || val === 'true' || val === 'yes') return true;
  const search = (window.location.search || '').toLowerCase();
  return search.includes('solicitor=1') || search.includes('solicitor%3d1') || search.includes('solicitor=true');
};
```

**b) Section filtering logic:**

File: `src/components/FormRenderer.jsx`

```javascript
// Filter sections: hide Testamentary Capacity section from clients (solicitor-only)
const visibleSections = useMemo(() => {
  if (isSolicitorMode()) {
    return formData.formSections;
  }
  // Client mode: exclude Testamentary Capacity section (index 18)
  return formData.formSections.filter((_, idx) => idx !== TESTAMENTARY_CAPACITY_SECTION_INDEX);
}, []);

const actualSectionIndex = useMemo(() => {
  if (isSolicitorMode()) return currentIndex;
  return currentIndex >= TESTAMENTARY_CAPACITY_SECTION_INDEX ? currentIndex + 1 : currentIndex;
}, [currentIndex]);

const currentSection = visibleSections[currentIndex] || formData.formSections[actualSectionIndex];
```

`TESTAMENTARY_CAPACITY_SECTION_INDEX` is `18` (from `clientMode.js`).

**c) Route guard / server-side enforcement / PDF gating:**  
None. No server routes or route guards. PDF download is gated in the UI by `isSolicitorMode()` (e.g. download button only when `isSolicitorMode()`).

**If a client opens a direct URL for that step, can they see it?**  
**NO.**  
- There is no URL that encodes “step 18”. The app is a SPA; step is `currentIndex` in state, persisted only as `willFormStep` in localStorage.  
- All section content comes from `currentSection = visibleSections[currentIndex]`. In client mode `visibleSections` is `formData.formSections` with index 18 removed, so the 19th item in the client’s list is the section that follows Testamentary Capacity in the full list.  
- So no value of `currentIndex` (0 to 18 in client mode) ever shows Testamentary Capacity. The section is excluded by filtering, not by a route.

---

## 3) ID Upload Buttons

**IdentityVerification.jsx – JSX for both buttons:**

```jsx
// UploadSlot component, lines 33-68
<button
  type="button"
  onClick={() => onTakePhoto(id)}
  className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg ..."
>
  <Camera size={18} />
  <span>Take photo</span>
</button>
<button
  type="button"
  onClick={() => onUpload(id)}
  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded-lg ..."
>
  <Upload size={18} />
  <span>Upload</span>
</button>
```

**Code that triggers camera capture:**  
There is no `<input accept/capture>` for “Take photo”. Capture is done with the **getUserMedia** API and a modal:

- `handleTakePhoto(key)` calls `openCamera(key)` which sets `cameraOpen` and `cameraKey`.
- A modal renders with a `<video ref={videoRef}>` and a “Capture photo” button.
- In a `useEffect` when `cameraOpen && cameraKey`:

```javascript
// IdentityVerification.jsx lines 154-179
const constraints = {
  video: {
    facingMode: cameraKey === UPLOAD_IDS.selfieWithId ? 'user' : 'environment',
    width: { ideal: Math.min(1920, window.innerWidth) },
    height: { ideal: Math.min(1080, window.innerHeight) },
  },
  audio: false,
};
navigator.mediaDevices.getUserMedia(constraints)
  .then((stream) => {
    streamRef.current = stream;
    video.srcObject = stream;
    video.play().catch(() => {});
  })
  ...
```

- “Capture photo” calls `capturePhoto()` which draws the video frame to a canvas, then `canvas.toBlob(..., 'image/jpeg', 0.85)` and saves via `setValueFromBlob`.

**Upload** uses a programmatic file input (no capture):

```javascript
// lines 224-233
const input = document.createElement('input');
input.type = 'file';
input.accept = 'application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.heic';
input.onchange = (e) => { const file = e.target.files?.[0]; if (file) handleFile(key, file); };
input.click();
```

**Confirm behaviour:**  
- **iPhone/Android:** “Take photo” opens the camera modal and requests camera (getUserMedia); on grant, shows live preview and “Capture photo” captures. “Upload” opens the file picker (no `capture` attribute).  
- **Mac/Windows:** Same: “Take photo” uses getUserMedia (webcam), “Upload” opens file picker.  
- **Browsers tested:** Not specified in code; implementation is standard getUserMedia + file input. No browser-specific tests documented in the repo.

---

## 4) File size limits

**Validation code enforcing 3MB:**

File: `src/components/IdentityVerification.jsx`

```javascript
const MAX_FILE_SIZE_MB = 3;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const validateFileSize = (file) => {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    return `File size (${sizeMB}MB) exceeds the maximum limit of ${MAX_FILE_SIZE_MB}MB per file. Please choose a smaller file.`;
  }
  return null;
};
// Used in handleFile(key, file):
const sizeError = validateFileSize(file);
if (sizeError) {
  setErrors(prev => ({ ...prev, [key]: sizeError }));
  toast.error('File too large', { description: sizeError });
  return;
}
```

For camera capture, blob size is checked in `setValueFromBlob`:

```javascript
const sizeError = blob.size > MAX_FILE_SIZE_BYTES
  ? `Photo is too large (${(blob.size / (1024 * 1024)).toFixed(2)}MB). Max ${MAX_FILE_SIZE_MB}MB.`
  : null;
```

**Where enforced:** Client only. There is no server/API in this repo; no server-side check.

**Exact user-facing messages:**  
- File upload: `"File size (X.XXmb) exceeds the maximum limit of 3MB per file. Please choose a smaller file."` (toast + inline error).  
- Photo capture: `"Photo is too large (X.XXmb). Max 3MB."` (toast + inline error).

---

## 5) Reference number / cross-device editing

**Where is form data persisted?**  
Only in the browser: **localStorage** under the key `willForm`. There is no backend DB or storage in this project.

**Code that SAVES form state:**  
State is not keyed by ref. Autosave and manual save write the same key:

```javascript
// FormRenderer.jsx – initial load
const [formValues, setFormValues] = useState(() => {
  const saved = localStorage.getItem('willForm');
  ...
});

// Autosave (around 2544):
localStorage.setItem('willForm', testStr);

// Manual save (around 245):
localStorage.setItem('willForm', testStr);
```

**Code that LOADS form state when visiting ?ref=XXXX:**  
There is no load by ref. On load, form state is only:

```javascript
const saved = localStorage.getItem('willForm');
// parse and set formValues
```

Ref is only used to:

- Generate or read from URL: `getOrCreateReferenceNumber()` reads `ref` from URL or `localStorage.getItem('willFormRef')`, and may set `willFormRef` and update the URL.
- It does **not** key or load `willForm` by ref.

So: **Cross-device editing does NOT work.** Data is only in each device’s localStorage. Opening the shared link on another device gives that device’s (empty) `willForm`; the ref in the URL does not restore form data from anywhere.

---

## 6) Share link

**Share button code:**

File: `src/components/FormRenderer.jsx` (in the header area)

```jsx
<button
  type="button"
  onClick={() => {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set('ref', referenceNumber);
    const urlToShare = shareUrl.toString();
    if (navigator.share) {
      navigator.share({
        title: 'Will Form - Continue Editing',
        text: 'Use this link to continue editing your Will form from any device.',
        url: urlToShare,
      }).catch(() => {
        navigator.clipboard.writeText(urlToShare);
        toast.success('Link copied', { description: 'Share link copied to clipboard. ...' });
      });
    } else {
      navigator.clipboard.writeText(urlToShare);
      toast.success('Link copied', { description: 'Share link copied to clipboard. ...' });
    }
  }}
  className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded ..."
  title="Share link to continue editing from any device"
>
  Share
</button>
```

**Function that builds the share URL:**  
Inline in the button: `const shareUrl = new URL(window.location.href); shareUrl.searchParams.set('ref', referenceNumber); const urlToShare = shareUrl.toString();`

**Confirm: opening the shared link restores data from backend?**  
**NO.** There is no backend. Opening the shared link only adds/restores the `ref` in the URL and in `localStorage` (`willFormRef`). Form data (`willForm`) is not restored from any server; it remains whatever is in that device’s localStorage.

---

## 7) Navigation changes (Sidebar + visibleSections)

**Sidebar.jsx changes using visibleSections:**

```jsx
// src/components/Sidebar.jsx
export default function Sidebar({ currentIndex, setCurrentIndex, visibleSections }) {
  const [isOpen, setIsOpen] = useState(false);
  const sections = useMemo(() => visibleSections || [], [visibleSections]);
  const currentLabel = useMemo(
    () => sections?.[currentIndex]?.formSection || 'Sections',
    [sections, currentIndex]
  );
  // ...
  // Mobile: {currentIndex + 1}/{sections.length}
  // Both mobile and desktop: sections.map((section, idx) => ...) for the list
}
```

**Exact index/ID of hidden section and mapping:**  
- Hidden section: **index 18** in `formData.formSections` (0-based).  
- Section title in JSON: `"formSection": "Testamentary Capacity"` (in `Complete-WillSuite-Form-Data.json`).  
- Defined in `src/constants/clientMode.js`: `export const TESTAMENTARY_CAPACITY_SECTION_INDEX = 18;`  
- Filtering: `formData.formSections.filter((_, idx) => idx !== TESTAMENTARY_CAPACITY_SECTION_INDEX)`.  
- So client sees 19 sections; solicitor sees 20. The 19th section in the full JSON (index 19) is not present in the JSON snippet you have; the one at index 18 is “Testamentary Capacity” and is the only one removed.  
- **Fragility:** Yes. If the form JSON is reordered or a section is added/removed before “Testamentary Capacity”, index 18 may no longer be that section. A robust approach would key off `formSection === 'Testamentary Capacity'` (or a stable section id) instead of a fixed index.

---

## Step-by-step test script

1. **DOB**  
   - Go to Personal Information.  
   - Click the date field → modal opens.  
   - Type `22/03/1975` and press Enter → value shows as 22/03/1975, modal closes.  
   - Click again → type invalid `99/99/9999` → “Use this date” → error.  
   - Click again → pick a date in the calendar → value updates, modal closes.  
   - For DOB, pick a future date in the modal → “Use this date” → “Date of birth cannot be in the future.”

2. **Testamentary Capacity (solicitor-only)**  
   - Open app without `?solicitor=1` → sidebar shows 19 sections; no “Testamentary Capacity”.  
   - Open `?solicitor=1` → sidebar shows 20 sections; “Testamentary Capacity” appears.  
   - Without solicitor param, set in console `localStorage.setItem('willFormStep', '18')` and reload → you should see the 19th client section (the one after Testamentary Capacity), not Testamentary Capacity.

3. **ID upload – Take photo**  
   - Complete form to the last section (Identity verification).  
   - Click “Take photo” for Photo ID → allow camera → modal with video and “Capture photo”.  
   - Click “Capture photo” → photo saved, modal closes, “Uploaded” appears.  
   - On a device without camera or with permission denied → error message; “Upload” still works.

4. **ID upload – Upload**  
   - Click “Upload” → file picker opens.  
   - Select a PDF or image → file saved if under 3MB.

5. **File size**  
   - “Upload” and choose a file > 3MB → toast “File too large” and inline error with message as in section 4.

6. **Reference number and share**  
   - Load app → header shows “Ref: XXXXXXXX” and URL gets `?ref=...`.  
   - Click “Share” → URL with `ref` copied or native share.  
   - Open that URL in an incognito window (or another device): same ref in URL; form is empty (no cross-device data).

7. **Navigation**  
   - As client, move through all steps → Step 1 of 19 … Step 19 of 19.  
   - As solicitor, Step 1 of 20 … Step 20 of 20.  
   - Sidebar list matches step count and section titles.

---

## TODOs not implemented

- **Backend persistence keyed by ref:** Form data is not saved or loaded by reference number; cross-device editing is not implemented.  
- **Server-side file size check:** 3MB is enforced only in the client.  
- **Stable section identification:** Testamentary Capacity is hidden by fixed index 18; not by section id or name in code.  
- **Browser/device matrix for camera and share:** No automated tests or documented compatibility matrix in the repo.
