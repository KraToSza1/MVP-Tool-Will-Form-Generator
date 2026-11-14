# Phase 2B — Mariyam Solicitor Review Pack (2026-05-19)

## What changed

Phase 2B helps solicitors review submitted matters without digging through the full questionnaire:

1. **Review summary panel** — Read-only cards on Matter Detail (client, executors, guardians, beneficiaries, residue, property/BPR trust, exclusions, funeral, ID, TC, PDF preflight, outstanding checklist).
2. **Structured solicitor notes** — Internal notes, risk notes, follow-up questions, and review decision stored on `solicitor_payload` (plus legacy `solicitor_notes` synced on save).
3. **Copy follow-up email** — Clipboard-only Aristone-worded email from follow-up questions (no auto-send, no ID images, no resume secrets unless separately copied).
4. **Print review pack** — Printable HTML in a new window (summary, preflight, notes, timestamp; no ID images).
5. **Dashboard pipeline status** — One primary workflow badge per matter card (New, In review, Awaiting client info, Awaiting ID, Awaiting TC, Ready for PDF review, Ready for signing, Completed) alongside existing DB status badges.

## Files changed

| Area | Files |
|------|--------|
| Core logic | `src/lib/matterReviewPack.js`, `src/lib/matterReviewPack.test.js` |
| UI | `src/components/solicitor/MatterReviewSummaryPanel.jsx`, `src/components/solicitor/MatterSolicitorReviewPanel.jsx`, `src/components/solicitor/MatterPipelineStatusBadge.jsx` |
| Pages | `src/pages/MatterDetailPage.jsx`, `src/pages/SolicitorDashboardPage.jsx` |

## Database / migration

**No migration required.** Review metadata uses existing `solicitor_payload` JSON and `solicitor_notes` text column.

Payload keys (solicitor-only):

- `solicitorReviewInternalNotes`
- `solicitorReviewRiskNotes`
- `solicitorFollowUpQuestions`
- `solicitorReviewDecision`

## How to test

```bash
npm run lint
npm test
npm run build
```

### Manual QA checklist

1. Open a submitted matter → **Review summary** shows real data or “Not recorded”.
2. Enter internal / risk / follow-up notes → **Save review notes** → refresh → values persist.
3. **Copy follow-up email** → paste into Outlook; questions appear numbered; no ID blobs.
4. **Print review pack** → new tab opens; print preview shows summary + notes; no ID images.
5. Dashboard card shows **pipeline badge** (e.g. Awaiting ID) plus existing category badges.
6. Generate **Client intake PDF** and **Execution PDF** → confirm solicitor review fields do **not** appear.
7. Completed matter → pipeline shows **Completed**.

## Known limitations

- Review pack is **print HTML**, not a generated PDF file (by design for MVP).
- Pipeline status is **derived** from outstanding checklist + optional review decision; it does not replace `matters.status` in Supabase.
- Beneficiary summary lists specific/property gifts when list fields exist; free-text-only gifts may show “Not recorded”.
- Follow-up email does not attach secure resume links (use existing resume email actions when ref + secret exist).

## Legal review note

Solicitor notes and review pack are **internal handover tools** only. They do not change will clause wording or client-facing PDF content. Mariyam should still apply professional judgment before execution.
