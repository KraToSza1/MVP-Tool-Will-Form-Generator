# Will Tool flow logging

Structured logs are emitted across the client → submission → solicitor flow so you can verify sync and that lawyers have what they need.

## Console filter

In the browser DevTools Console, filter by:

```text
[WillTool Flow]
```

to see only these flow logs.

## Flow phases (in order)

### Client (form completion and PDF)

| Phase | When | What to check |
|-------|------|----------------|
| `client_create_start` | New client opens form (no ref in URL) | Session will be created |
| `client_start` | Session created (willSessions) | Ref + secret in URL |
| `client_load_start` / `client_resume` | Client returns with ref+s in URL | Session loaded from DB |
| `client_draft_save` | Draft saved to cloud (manual or autosave) | Payload persisted |
| `client_submit_start` | Client clicks through last step | About to call submit_will_matter |
| `client_submit` | RPC submit_will_matter called | Payload + snapshot sent |
| `client_submit_done` | Matter created in DB | matterId returned |
| `client_submit_success` | UI shows success | Matter is in `matters` table |
| `client_pdf_start` | PDF generation started | Before generatePDFWithJSPDF |
| `client_pdf_done` | PDF generation finished | Doc built |
| `client_pdf_download` | PDF download triggered | File saved by user |

### Solicitor (dashboard and matter actions)

| Phase | When | What to check |
|-------|------|----------------|
| `solicitor_list` | Dashboard loads matter list | List query params |
| `solicitor_list_done` | Matters returned | Count + refs + statuses |
| `solicitor_staff_list` | Staff profiles loaded (e.g. assign dropdown) | Profile count |
| `solicitor_matter_open_start` | Solicitor opens a matter | matterId |
| `solicitor_matter_open` | Matter detail + activity loaded (matters.js) | clientRef, status, activityCount |
| `solicitor_editor_open_start` | Solicitor opens “Edit questionnaire” | matterId |
| `solicitor_form_save` | Solicitor saves form progress (matters.js) | matterId, currentStep |
| `solicitor_status_change` | Status updated (matters.js) | matterId, status |
| `solicitor_assign` | Matter assigned (matters.js) | matterId, assignedSolicitorId |
| `solicitor_notes_save` | Notes saved (matters.js) | matterId |
| `solicitor_reminder_save` | Reminder date saved (matters.js) | matterId, reminderDate |
| `solicitor_pdf_start` | Solicitor clicks Download PDF | matterId |
| `solicitor_pdf_download` | Solicitor PDF download completed | matterId, filename |

## Files that emit flow logs

- **Client session:** `src/lib/willSessions.js` (create, load, save)
- **Matter API:** `src/lib/matters.js` (submit, list, get, status, assign, notes, reminder, solicitor save)
- **Client form:** `src/components/FormRenderer.jsx` (session load/create, draft save, submit, PDF)
- **PDF:** `src/components/PDFGeneratorJSPDF.js` (start/finish)
- **Solicitor pages:** `src/pages/MatterDetailPage.jsx`, `src/pages/MatterEditorPage.jsx` (open, status, assign, notes, reminder, PDF)

## Quick sync check

1. **Client submits** → Look for `client_submit_done` and `client_submit_success` with a `matterId`.
2. **Solicitor dashboard** → Look for `solicitor_list_done` with that matter’s `ref`/`id` in the list.
3. **Solicitor opens matter** → Look for `solicitor_matter_open` with same `clientRef` and expected `status`.
4. **Solicitor saves form** → Look for `solicitor_form_save` with that `matterId` and updated `currentStep`.

If any of these are missing or show errors, use the phase and `matterId`/`ref` to trace where the flow stopped.
