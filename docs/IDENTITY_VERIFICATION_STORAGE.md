# Identity Verification – Storage

## What clients upload

Four images are collected under `formValues.identityVerification`:

- `identityVerificationPhotoId`
- `identityVerificationProofOfAddress1`
- `identityVerificationProofOfAddress2`
- `identityVerificationSelfieWithId`

## Where data is stored

| Stage | Storage | Notes |
|-------|---------|--------|
| **While completing the form** | Browser `localStorage` (`willForm` draft) | Images are compressed in the browser before save where possible. |
| **Cloud draft autosave** | Supabase `will_sessions` via RPC | **`identityVerification` is excluded** from cloud draft payloads (`buildCloudPayload` in `src/lib/formPayload.js`). |
| **After client submit** | Supabase `matters.client_payload` | **Compressed** ID images are included so Aristone staff can review them on the matter (`submitMatterFromDraft` in `src/lib/matters.js`). |
| **PDF** | Not embedded | ID images are not written into the generated Will PDF. |

## Client-facing meaning

ID documents are submitted **securely for solicitor review only** (anti-money laundering / file opening). They are not shared in the client PDF download.

**Manual confirmation required:** Mariyam / Aristone must approve this storage approach, retention period, and privacy notice wording shown to clients.

## Future improvement (not Phase 1)

- Store ID files in a **dedicated Supabase Storage bucket** with encryption, access logging, and automatic retention/deletion.
- Avoid long-term retention of base64 blobs inside `client_payload` JSONB.

## Camera / upload behaviour

- **Mobile:** file picker / camera via `capture` where supported.
- **Desktop:** file picker; optional webcam for selfie on wide screens with fine pointer.
- **Embedded (WordPress iframe):** parent page iframe needs `allow="camera"` and HTTPS.

See also `docs/CAMERA_AUDIT_AND_IMPLEMENTATION.md` and `docs/WORDPRESS_ELEMENTOR_EMBED.md`.
