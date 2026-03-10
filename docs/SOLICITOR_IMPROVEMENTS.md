# Solicitor workspace – improvements done and suggested

Quick reference for what’s in place to keep lawyers stress-free and what could be added next.

---

## Done (in the app)

| Feature | Where | What it does |
|--------|--------|----------------|
| **Empty state** | Dashboard | When there are no matters, a clear message and 3-step “how to get started” plus link to the client Will Tool. |
| **Status tooltips** | Dashboard + Matter detail | Hover status badges to see what each status means and what to do next. |
| **Copy client link** | Dashboard + Matter detail | One click copies the Will Tool URL so solicitors can paste it into an email to the client. |
| **Copy reference** | Matter detail | One click copies the matter/client reference for emails and notes. |
| **Assign to me** | Matter detail | When a matter is unassigned, a clear “Assign to me” button assigns it to the logged-in solicitor. |
| **Unsaved notes warning** | Matter detail | If solicitor notes are changed but not saved, the browser warns on close/refresh, and an “Unsaved changes” hint appears. |
| **Received column** | Dashboard table | Shows when the matter was received (submitted), with full date/time on hover. |
| **Confirm before complete** | Matter detail | “Mark complete” asks for confirmation so status isn’t changed by mistake. |
| **Human-readable activity** | Matter detail | Activity history uses plain English (e.g. “Client submitted their form”, “Status set to In progress”). |
| **PDF blocked message** | Matter detail | If PDF can’t be generated, the toast shows which section/field is blocking so they know what to fix. |
| **Signing date not blocking** | PDF | Draft PDF can be downloaded without a signing date; date is filled at the execution appointment. |

---

## Suggested next (priority order)

| Priority | Idea | Status |
|----------|------|--------|
| **High** | **Document checklist** on matter detail | **Done** – Tick list: “ID received”, “Instructions complete”, “Testamentary Capacity complete”. (with link to form if incomplete). |
| **Medium** | **Sort by Received** | **Done** – Dashboard Sort by dropdown: Last activity (newest first). Optional toggle “Sort by received date” for turnaround focus. |
| **Medium** | **“What does this mean?” panel** | Expandable panel on dashboard listing all statuses and suggested actions. |
| **Low** | **Email client (template)** | **Done** – Email client button opens mail client with pre-filled “Dear [client], please complete…” subject and body (matter detail). |
| **Low** | **Deadline / due date** | **Done** – Reminder/due date on matter detail; run migration `20260308000000_matters_reminder_date.sql`. |

---

## Lawyer-friendly wording (already in use)

- **Your matters** (not “Dashboard”)
- **Client reference** (not “Reference”)
- **ID needed** (not “Verification pending”)
- **In progress** (not “In review”)
- **Received** (submitted date)
- **Open matter** (primary action)
- **Edit questionnaire** (not “Continue in solicitor mode”)
- **Copy client link** (to send the Will Tool to the client)

See also `docs/LAWYER_UX_PLAN.md` for the full plan and terminology table.
