# Will Tool – Lawyer UX Plan: Foolproof & Complete

**Goal:** Any lawyer can understand and use the solicitor workspace within minutes, without training.

---

## 1. Terminology (Lawyer-Friendly)

| Current | Suggested | Reason |
|---------|-----------|--------|
| Matter dashboard | **Your matters** or **Matter list** | "Dashboard" can sound technical; lawyers think in terms of matters |
| Reference | **Client reference** or **File ref** | Matches what lawyers call case IDs |
| Verification pending | **ID / verification needed** | Clear action implied |
| In review | **Under review** or **In progress** | Familiar legal phrase |
| Next step | **Action needed** | Direct call to action |
| Continue in solicitor mode | **Open form** or **Complete Testamentary Capacity** | Explains what actually happens |

---

## 2. First-Time Experience (Empty States)

**Problem:** When there are 0 matters, lawyers see a wall of zeros and an empty table with no guidance.

**Fix:**
- **Welcome banner** (when total matters = 0):  
  "No matters yet. Clients complete the questionnaire on the Will Tool homepage and submit. New matters will appear here automatically."
- **Client-facing step:**  
  "To get started: share the Will Tool link with your client. They fill in their instructions and submit. The matter then appears in your list."
- **Optional:** Short 3-step visual (1. Client fills form → 2. Client submits → 3. Matter appears here)

---

## 3. Status Explanations (In-Context Help)

Lawyers must immediately understand what each status means and what they should do.

| Status | Short label | Explanation (tooltip / helper) | Suggested action |
|--------|-------------|--------------------------------|------------------|
| Submitted | Submitted | Client has submitted; awaiting your review | Open matter and review |
| Verification pending | ID needed | Client ID / verification required | Chase client or verify documents |
| In review | In progress | You are reviewing; Testamentary Capacity pending | Open form and complete |
| Completed | Completed | Matter finished; ready for execution | Archive or export |

**Implementation:** Add `title` tooltips on status badges and a small "What does this mean?" link that expands a panel with all statuses and actions.

---

## 4. Clear CTAs (Call-to-Action)

- **Primary action** on each matter row: **Open matter** (or **Review**) – one click to the detail page
- **Secondary:** **Open form** (Continue in solicitor mode) from the detail page
- Avoid vague labels like "Next step"; use specific verbs: **Review**, **Complete TC**, **Mark complete**

---

## 5. Safety & Foolproofing

| Area | Change | Reason |
|------|--------|--------|
| Status changes | Confirm before moving to "Completed" | Prevents accidental closure |
| Notes | Auto-save or "Unsaved changes" warning | Avoid losing notes on navigation |
| Assignment | Show "Assign to me" button when unassigned | Reduces friction |
| Activity | Human-readable activity (e.g. "Marked complete by you") | Clear audit trail |

---

## 6. Missing Pieces (Completeness)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Client share link** | High | Copy link to send to client (e.g. Will Tool URL) from dashboard |
| **Search tips** | Medium | "Search by name, email, phone or reference" – always visible |
| **Date received** | Medium | "Received on [date]" – lawyers care about turnaround |
| **Sort by date** | Medium | Default: newest first |
| **Export / PDF from matter** | High | Download client PDF or full PDF from matter detail |
| **Document checklist** | Medium | Tick list: ID received, instructions complete, TC complete |
| **Email client** (later) | Low | "Email client" button (template) – out of scope for MVP |
| **Deadline / due date** | Low | Optional reminder – Phase 2 |

---

## 7. Quick Wins (Implement Now)

1. **Welcome / empty-state message** when no matters
2. **Status tooltips** on badges (title attribute)
3. **Clearer "Next step"** – change to "Action needed: Review" / "Open matter"
4. **Helper text** under Matter dashboard: "Clients submit via the Will Tool. New matters appear here."
5. **Sort matters** by `last_activity_at` descending (newest first)

---

## 8. Responsive Validation

- **375px:** Stats in 1 column; table horizontal scroll; filters stack
- **768px:** Stats 2–3 columns; filters in 2 columns
- **1280px+:** Full layout; all stats in one row
