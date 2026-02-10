# Identity Verification – Storage

## Where files go

- Stored in **form state** as base64 data URLs under `formValues.identityVerification`:
  - `identityVerificationPhotoId`
  - `identityVerificationProofOfAddress1`
  - `identityVerificationProofOfAddress2`
  - `identityVerificationSelfieWithId`
- Persisted with the form draft in `localStorage` (key: `willForm`) when the user saves.
- Sent with the rest of the submission payload when the form is submitted.

## How it’s linked to the submission

`identityVerification` is part of `formValues`, so it is:

1. Included in the JSON used for `localStorage.setItem('willForm', ...)` on save.
2. Included in the payload passed to `generatePDFWithJSPDF` and any submit handler.
3. Available for backend APIs that consume the full form data.

## Camera / upload behaviour

- **Mobile:** `capture="environment"` triggers the device camera for direct capture.
- **Desktop:** The same file input behaves as a standard file picker.
- Accepted formats: `image/*` (JPEG, PNG, etc.).
