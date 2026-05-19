# Phase 2A — Solicitor workflow upgrade (2026-05-19)

## What changed

Phase 2A adds practical solicitor and client workflow improvements without large refactors or Phase 3 scope.

1. **Matter at-a-glance** — Dashboard cards and matter detail show completion estimate, ID status, Testamentary Capacity status, outstanding count, and workflow badges.
2. **Outstanding badges** — Human-readable labels (ID missing, TC incomplete, BPR/property trust, PDF needs review, ready for review) via `matterWorkflowSummary.js`.
3. **Client pre-submit review** — Clients see a plain-English summary and must confirm before submit (not legal advice).
4. **PDF preflight** — Solicitor checklist before execution PDF download (conservative pass / needs review).
5. **Resume / reference email copy** — Matter detail copies email text to clipboard (no send). **Secure resume email** only when both `session_ref` and `session_secret` are available on the matter (full `?ref=&s=` URL). Otherwise **Copy client reference email** — no URL, explains the client must use their original secure link.
6. **Client intake PDF** — Separate download on matter detail (`isClientPDF: true`).
7. **Mark reviewed** — Quick action sets matter to `in_review`.

## Files changed

| Area | Files |
|------|--------|
| Lib | `src/lib/matterWorkflowSummary.js`, `clientSubmitReviewSummary.js`, `pdfPreflightChecklist.js`, `resumeLinkEmail.js` + tests |
| Client UI | `src/components/ClientSubmitReviewModal.jsx`, `FormRenderer.jsx` |
| Solicitor UI | `src/components/solicitor/MatterAtAGlanceStrip.jsx`, `PdfPreflightPanel.jsx`, `SolicitorDashboardPage.jsx`, `MatterDetailPage.jsx` |
| Tooling | `scripts/gen_phase2a_components.py` (generator only) |

## How to test

### Solicitor portal

1. Sign in at `/celista-login` → `/solicitor`.
2. **Dashboard** — Open a matter card; confirm completion %, ID, TC, outstanding badges.
3. **Matter detail** — Confirm at-a-glance strip, PDF preflight panel, **Copy client reference email** (or secure resume email if ever available), **Client intake PDF**, **Execution PDF**, **Mark reviewed**. Confirm copied reference email contains **no** `http` resume URL.

### Client intake

1. Complete questionnaire to the last client-visible step → **Next**.
2. **Review before you submit** modal appears; confirm checkbox → submit (or ID incomplete flow).

### Automated

```bash
npm run lint
npm test
npm run build
```

## Known limitations

- **Completion %** on matters uses `current_step` vs client-visible section count — not the same as in-form `formCompletionPercent` during live editing.
- **Resume link** — Matters store `session_ref` only; the client secret is **not** stored. The UI never copies a ref-only URL as a working resume link. Use **Copy client reference email** (no URL) unless a full secure URL is available from both ref and secret.
- **PDF preflight** — Heuristic checklist, not full `PDFGeneratorJSPDF` clause validation; “Needs review” is conservative.
- **Mark reviewed** — Sets status to `in_review` only; does not complete TC or ID automatically.

## Not legal advice

All summaries, preflight items, and client confirmation text are **UI helpers** for convenience. Mariyam / Aristone must still apply professional judgment before relying on any PDF or client submission.

## Follow-up (not Phase 2A)

- Session TTL / rate limits on resume links
- Store or rotate resume secrets for solicitor re-send
- Playwright E2E for submit + portal flows
- Align in-form completion % with `visibleSections` only (client mode)
