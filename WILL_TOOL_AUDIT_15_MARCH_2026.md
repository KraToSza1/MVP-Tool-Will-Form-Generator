# Will Tool – Senior Implementation Audit & Delivery Plan
**Target: Live on Aristone WordPress (Elementor) by 15 March 2026**

---

## PASS/FAIL Matrix

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **PHASE 1: Refinements** | | |
| 1) Logic hardening (validation, edge cases, stability) | **PARTIAL** | Validation exists; index-based solicitor logic is fragile; no scripted regression suite found |
| 2) PDF safeguards (no solicitor-only leakage, correct final PDF content) | **FAIL** | **LEAK PATH**: PDF clause builder uses ALL sections; client PDF can include Testamentary Capacity content |
| 3) Regression testing (practical scripted checks) | **PARTIAL** | Vitest + Puppeteer scripts exist; no documented regression checklist |
| **PHASE 2: Backend persistence** | | |
| 4) Secure save/load functionality | **FAIL** | No backend; localStorage only |
| 5) Reference-based save/load across devices | **FAIL** | Reference + share link exist; data not persisted server-side |
| 6) Data security (no public leakage; basic abuse controls) | **FAIL** | No server; no access control |
| **DEPLOYMENT** | | |
| 7) Fully functional on live WordPress site | **UNKNOWN** | No WP integration code in repo |
| 8) Compatible with Elementor | **UNKNOWN** | Not tested |
| 9) Stable on desktop + mobile | **PARTIAL** | Responsive UI; camera/upload need device testing |

---

## 1. REPO INVENTORY

### Framework & Build
- **Framework:** React 19.2 + Vite 7.1 (not Next.js)
- **Build:** `vite build` → outputs to `dist/`
- **Deployment target:** `vercel.json` present → SPA rewrites to `/index.html`
- **Env vars:** No `.env` files in repo; `import.meta.env.DEV` used for debug
- **Node:** `>=20.19.0 || >=22.12.0`

### Key Files Map

| File | Responsibility |
|------|----------------|
| `src/App.jsx` | Root layout, header, mounts FormRenderer |
| `src/main.jsx` | React entry, mounts App to `#root` |
| `src/components/FormRenderer.jsx` | Multi-step form orchestration, autosave, PDF trigger, reference/share, visibleSections filtering |
| `src/components/FieldRenderer.jsx` | Renders all field types (text, radio, date, signature, etc.); DOB modal + date picker |
| `src/components/IdentityVerification.jsx` | Take photo (getUserMedia) + Upload; 3MB limit; base64 in formValues |
| `src/components/PDFGeneratorJSPDF.js` | PDF generation via jsPDF; buildClauses; witness/execution page; isClientPDF for signing block |
| `src/components/Sidebar.jsx` | Step navigation; uses visibleSections |
| `src/constants/clientMode.js` | isSolicitorMode(), TESTAMENTARY_CAPACITY_SECTION_INDEX=18, SOLICITOR_ONLY_FIELD_IDS |
| `src/utils/buildClauses.js` | Shared clause builder; supports maxSectionIndex; used by FormRenderer (preview) and PDFGeneratorJSPDF |
| `src/utils/ukValidations.js` | ukDateToISO, validation helpers |
| `src/data/Complete-WillSuite-Form-Data.json` | Form schema (formSections, fields) |
| `vite.config.mjs` | Vite config; Vitest setup |
| `vercel.json` | SPA rewrites |

**Note:** `PDFDocument.jsx` does not exist. User may have meant `PDFGeneratorJSPDF.js`. `@react-pdf/renderer` is in package.json but **not imported** in src – dead dependency.

---

## 2. PHASE 1 VERIFICATION

### 2.1 Client/Solicitor Mode

**Where enforced:**
- `src/constants/clientMode.js` – `isSolicitorMode()` checks `?solicitor=1` (or `true`/`yes`)
- `src/components/FormRenderer.jsx` – `visibleSections` filters out section at index 18

**Exact code – section hiding:**

```javascript
// FormRenderer.jsx lines 169-176
const visibleSections = useMemo(() => {
  if (isSolicitorMode()) {
    return formData.formSections;
  }
  return formData.formSections.filter((_, idx) => idx !== TESTAMENTARY_CAPACITY_SECTION_INDEX);
}, []);
```

**Exact code – field-level solicitor-only hiding:**

```javascript
// FormRenderer.jsx lines 3537-3539
if (!isSolicitorMode() && SOLICITOR_ONLY_FIELD_IDS.has(field.id)) {
  return null; // Don't render solicitor-only fields
}
```

**Fragility:** Uses fixed index `18`. If form JSON section order changes, Testamentary Capacity could be shown or wrong section hidden.

---

### 2.2 DOB Input Rules

**Location:** `src/components/FieldRenderer.jsx` (date field type)

- **Typing:** Modal with text input; DD/MM/YYYY; parsed via `ukDateToISO` from `src/utils/ukValidations.js`
- **Date picker:** `LazyDatePicker` (react-datepicker) in same modal; `maxDate={new Date()}` prevents future
- **Validation:** `field.id === 'dateOfBirth' && parsed > new Date()` → "Date of birth cannot be in the future." (lines 1412, 1442)

---

### 2.3 Identity Verification

**Location:** `src/components/IdentityVerification.jsx`

- **Take photo:** `getUserMedia` (line 166); `facingMode: 'user'` for selfie, `'environment'` for ID; canvas capture → blob → base64
- **Upload:** File input; `accept='application/pdf,image/*,.pdf,.png,.jpg,.jpeg,.heic'` (line 228)
- **File size:** `MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024`; `validateFileSize()` (line 82); toast on exceed
- **Storage:** Base64 in `formValues.identityVerification`; persisted via FormRenderer autosave to `localStorage.willForm`

---

### 2.4 PDF Generation Pipeline

**Where PDF is built:** `src/components/PDFGeneratorJSPDF.js` – `generatePDFWithJSPDF(formValues, signatures, { isClientPDF })`

**Clause building:**
- `buildClauses()` from `src/utils/buildClauses.js` – iterates `formData.formSections`, interpolates `{{field:...}}` placeholders
- **CRITICAL:** PDFGeneratorJSPDF calls buildClauses **without** `maxSectionIndex`:

```javascript
// PDFGeneratorJSPDF.js lines 1957-1961
const willClauses = buildClauses({
  formValues,
  formData: formSchema,
  interpolateText
}).map(...);
```

**Witness section in PDF:**
- Execution/signing page always included (lines 3568-3698)
- `isClientPDF === true`: "INTAKE ONLY" wording; testator signature box only; **no** attestation, **no** witness boxes
- `isClientPDF === false`: Full execution wording; attestation; witness 1 & 2 boxes with signatures

**Solicitor-only exclusion in PDF:**
- **Signing block:** Correctly gated by `isClientPDF` (no witnesses in client PDF)
- **Will clause content:** **NOT EXCLUDED**. buildClauses uses all formSections. Testamentary Capacity section (index 18) has `willClauseText` fields. If `formValues` contain data for those fields (e.g. from solicitor session in localStorage, or shared link opened in solicitor mode first), that content **will appear in client PDF**.

**LEAK PATH:** PDF clause builder does not receive `maxSectionIndex` or section filter. Client PDF can include Testamentary Capacity clause text.

---

## 3. PHASE 2 VERIFICATION (CURRENT STATE)

### Backend Persistence Search

| Search | Result |
|--------|--------|
| `supabase` | Not found |
| `firebase` | Not found |
| `fetch(` | Only for image loading in PDFGeneratorJSPDF |
| `api.` / REST / endpoint | Not found |
| WordPress REST | Not found |
| Serverless | Not found |

**Conclusion:** No backend. Persistence is **localStorage only**.

**Exact code – reference + storage:**

```javascript
// FormRenderer.jsx lines 68-88 (condensed)
// Reference from URL ?ref=xxx or generate new
const refFromUrl = params.get('ref');
if (refFromUrl) localStorage.setItem('willFormRef', refFromUrl);
const savedRef = localStorage.getItem('willFormRef');
const referenceNumber = refFromUrl || savedRef || generateRef(); // crypto.randomUUID-based
if (!savedRef) localStorage.setItem('willFormRef', referenceNumber);

// Form data - FormRenderer.jsx lines 135-150
const saved = localStorage.getItem('willForm');
// Parse and merge into formValues
```

**Storage keys:** `willForm` (form data), `willFormRef` (reference), `willFormStep` (current step). Data is **not** keyed by reference in storage; ref is for share URL only. Opening shared link on another device does **not** restore data.

---

## 4. CRITICAL QUESTIONS (CHECKLIST)

Please answer before finalising implementation:

1. **Do we have access to Aristone WordPress admin and Elementor edit access?**
2. **Do we have a staging domain, or must we deploy directly to live?**
3. **Where will the app be hosted?** (Vercel/Netlify/custom subdomain) if embedded in iframe or script tag
4. **Are we allowed to install a WordPress plugin?** (affects Option B for backend)
5. **Do we need SSO/auth, or is "reference link" the only access control?**
6. **What is the expected privacy/security level (POPIA concerns) and what minimum controls are acceptable?**
7. **Will any uploaded ID documents need to be emailed/stored, and where?** (WP media library vs cloud storage vs not stored)

---

## 5. BACKEND SAVE/LOAD DESIGN

### Option A: Supabase (RECOMMENDED for speed)

| Aspect | Design |
|--------|--------|
| **Table schema** | `will_sessions (id, ref TEXT UNIQUE, payload JSONB, created_at, updated_at, expires_at?)` |
| **RLS** | No auth: use `ref` as secret; RLS allows insert/select only when `ref` matches (or use service role for API) |
| **Reference format** | `crypto.randomUUID()` or nanoid 21-char; unguessable |
| **Encryption** | Supabase at-rest encryption; optional: encrypt `payload` client-side before save (AES-GCM + key derived from ref) |
| **TTL** | Optional: `expires_at` 90 days; cron to purge |
| **Rate limiting** | Supabase Edge Function or DB trigger; max N saves per ref per hour |

**Pros:** Fast setup; no WP plugin; scales; free tier.  
**Cons:** External dependency; data outside WP.

### Option B: WordPress REST + DB Table (Plugin)

| Aspect | Design |
|--------|--------|
| **Endpoint** | `POST /wp-json/will-tool/v1/save` (ref, payload); `GET /wp-json/will-tool/v1/load?ref=xxx` |
| **Protection** | Nonce for WP; rate limit via plugin; optional signed token |
| **DB table** | `wp_will_sessions` (ref, payload LONGTEXT, created, updated) |
| **Elementor** | Embed via iframe or script; same as Option A |

**Pros:** All data in WP; no external service.  
**Cons:** Plugin dev; WP hosting must support; more moving parts.

### Chosen Option: **A (Supabase)** for fastest path to 15 March.

**Data flow:**
1. **Create session:** On first save, generate ref; `INSERT` row with payload.
2. **Save updates:** `UPDATE` row by ref; debounced (e.g. 2s after change).
3. **Load by reference:** On load with `?ref=xxx`, `SELECT` by ref; merge into formValues.
4. **Share link:** `https://domain.com/?ref=xxxxx` (unchanged).

**Code locations to add:**
- `src/api/willSession.js` – `saveSession(ref, payload)`, `loadSession(ref)`
- `FormRenderer.jsx` – call `loadSession(ref)` when `ref` in URL; call `saveSession` in autosave path; keep localStorage as fallback cache (write-through)
- `vite` env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or service key in serverless if using Edge Function)

**Migration steps:**
1. Create Supabase project; table + RLS.
2. Add API client; wire into FormRenderer.
3. Test: create on device A, open link on device B, verify data loads.

---

## 6. WORDPRESS + ELEMENTOR INTEGRATION

### Approach 1: iframe (hosted app)
- Build → deploy to Vercel/Netlify → embed `<iframe src="https://will-tool.vercel.app/?ref=xxx" />`
- **CSP/CORS:** App must allow `X-Frame-Options: SAMEORIGIN` or `frame-ancestors` for WP domain
- **Solicitor mode:** `?solicitor=1` in iframe URL
- **Pros:** Isolated; easy rollback. **Cons:** Height/scroll; postMessage if needed for parent communication.

### Approach 2: Script tag (mount React into div)
- Build with `base: '/will-tool/'` or deploy to subpath; enqueue script in WP
- Elementor HTML widget: `<div id="will-tool-root"></div><script src="https://cdn.../assets/index-xxx.js"></script>`
- **Pros:** Same-origin feel. **Cons:** Path/base config; script loading order.

### Approach 3: WordPress plugin (enqueue bundled assets)
- Plugin registers shortcode `[will_tool]`; enqueues built JS/CSS; renders `<div id="root">`
- **Pros:** Native WP integration. **Cons:** Plugin maintenance; more dev time.

### Chosen Approach: **1 (iframe)** – fastest, lowest risk.

**Exact steps:**
1. **Build:** `npm run build` → `dist/` output
2. **Host:** Deploy `dist/` to Vercel (or Netlify); configure custom domain if needed
3. **Headers:** Ensure `X-Frame-Options` allows embedding from `aristonesolicitors.co.uk` (or use `frame-ancestors` in CSP)
4. **Elementor:** Add HTML widget or Embed element:  
   `<iframe src="https://will-tool.vercel.app/" width="100%" height="800" style="min-height:80vh; border:none;"></iframe>`
5. **Solicitor link:** Staff use `https://will-tool.vercel.app/?solicitor=1`

---

## 7. TEST PLAN (REGRESSION)

| # | Test | Pass criteria |
|---|------|---------------|
| 1 | Client mode: complete will, generate PDF | No Testamentary Capacity text; no witness blocks; "INTAKE ONLY" wording |
| 2 | Cross-device (after Phase 2) | Start on device A; share link; open on B; data restored |
| 3 | Upload limits | Reject >3MB; clear error message |
| 4 | Camera vs upload | Take photo works; Upload works; both stored |
| 5 | Mobile layout | 375px, 768px; no overflow; buttons accessible |
| 6 | Elementor embedded | iframe loads; scrolls; no overflow |
| 7 | DOB | Type DD/MM/YYYY; pick from calendar; future date rejected |
| 8 | Failure modes | Refresh mid-step → data persists (localStorage/backend); network drop → graceful message |
| 9 | Mac/Windows | Safari, Chrome, Edge |
| 10 | iPhone/Android | Camera capture; file upload |

---

## 8. MISSING WORK (PRIORITY ORDER)

1. **PDF safeguard (CRITICAL):** Pass `maxSectionIndex: TESTAMENTARY_CAPACITY_SECTION_INDEX - 1` (or filter by section ID) to `buildClauses` in PDFGeneratorJSPDF when `isClientPDF === true`, so Testamentary Capacity clauses are never included in client PDF.
2. **Solicitor-only hardening:** Refactor from index-based to section-ID-based filtering (e.g. `formSection === 'Testamentary Capacity'`).
3. **Backend persistence (Phase 2):** Implement Supabase save/load; wire into FormRenderer; keep localStorage as cache.
4. **Share-link wording:** Already corrected (localStorage-only disclaimer).
5. **Regression test script:** Document and run Vitest + Puppeteer checks before 15 March.
6. **WordPress/Elementor deployment:** Deploy built app; embed via iframe; verify headers.
7. **Device testing:** Mac, Windows, iPhone, Android for camera/upload.
8. **Remove dead dependency:** `@react-pdf/renderer` if not used (optional cleanup).

---

## 9. EVIDENCE SNIPPETS

### Client mode filtering
```javascript
// src/components/FormRenderer.jsx:169-176
return formData.formSections.filter((_, idx) => idx !== TESTAMENTARY_CAPACITY_SECTION_INDEX);
```

### PDF leak – buildClauses uses all sections
```javascript
// src/components/PDFGeneratorJSPDF.js:1957-1961
const willClauses = buildClauses({
  formValues,
  formData: formSchema,
  interpolateText
}).map(...);
// No maxSectionIndex passed!
```

### localStorage persistence
```javascript
// src/components/FormRenderer.jsx:135, 245
const saved = localStorage.getItem('willForm');
localStorage.setItem('willForm', testStr);
```

### Reference generation (no server)
```javascript
// src/components/FormRenderer.jsx:88
const newRef = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
```

---

*Audit completed. Reply to the Critical Questions checklist so implementation can proceed.*
