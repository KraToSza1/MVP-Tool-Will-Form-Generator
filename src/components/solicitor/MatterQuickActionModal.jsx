import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Loader2, ShieldCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { patchMatterSolicitorPayload } from '../../lib/matters.js';
import { mergeMatterPayloads } from '../../lib/formPayload.js';
import {
  OUTSTANDING_CATEGORY,
  TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS,
  TESTAMENTARY_CAPACITY_FIELD_LABELS,
} from '../../lib/matterOutstanding.js';
import { buildPropertyTrustDetailsDraftFromClient } from '../../utils/propertyTrustFormat.js';
import {
  formatBusinessInterestsIntakeRows,
  formatPropertyTrustIntakeRows,
} from '../../utils/solicitorClientSummaries.js';

/**
 * Field-set definition per outstanding category. Each entry is the minimum
 * the solicitor needs to clear the badge from the dashboard. Anything more
 * detailed lives in the full matter editor (the modal exposes a deep-link).
 */
const TC_YES_NO_FIELDS = [
  'hasTestamentaryCapacity',
  'satisfiedUnderstandsInstructions',
  'satisfiedAwareOfClaims',
  'satisfiedNotUndulyInfluenced',
  'hasDisabilityImpactingSignRead',
  'otherPeoplePresent',
];
const TC_TEXTAREA_FIELDS = ['physicalHealthDescription', 'capacityConcerns'];

const CATEGORY_TITLES = {
  [OUTSTANDING_CATEGORY.ID_VERIFICATION]: 'Mark ID verification complete',
  [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]: 'Complete Testamentary Capacity',
  [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]: 'Complete BPR Trust details',
  [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]: 'BPR Trust — confirm decision',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]: 'Complete Property Trust details',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]: 'Property Trust — confirm decision',
};

const CATEGORY_DEEP_LINKS = {
  [OUTSTANDING_CATEGORY.ID_VERIFICATION]: (matterId) => ({
    to: `/solicitor/matters/${matterId}`,
    state: { scrollToIdDocs: true },
    label: 'Open matter detail',
  }),
  [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]: (matterId) => ({
    to: `/solicitor/matters/${matterId}/form`,
    state: { openAtSectionTitle: 'Testamentary Capacity' },
    label: 'Open Testamentary Capacity in full editor',
  }),
  [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]: (matterId) => ({
    to: `/solicitor/matters/${matterId}/form`,
    state: { openAtSectionTitle: 'Business Interests' },
    label: 'Open Business Interests in full editor',
  }),
  [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]: (matterId) => ({
    to: `/solicitor/matters/${matterId}/form`,
    state: { openAtSectionTitle: 'Business Interests' },
    label: 'Open Business Interests in full editor',
  }),
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]: (matterId) => ({
    to: `/solicitor/matters/${matterId}/form`,
    state: { openAtSectionTitle: 'Property Trust' },
    label: 'Open Property Trust in full editor',
  }),
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]: (matterId) => ({
    to: `/solicitor/matters/${matterId}/form`,
    state: { openAtSectionTitle: 'Property Trust' },
    label: 'Open Property Trust in full editor',
  }),
};

function YesNoSelect({ id, label, value, onChange, includeNotApplicable = false }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <select
        id={id}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">Select…</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        {includeNotApplicable ? <option value="N/A">Not applicable</option> : null}
      </select>
    </label>
  );
}

function TextField({ id, label, value, onChange, placeholder = '' }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <input
        id={id}
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </label>
  );
}

function TextareaField({ id, label, value, onChange, placeholder = '', rows = 3 }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <textarea
        id={id}
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
      />
    </label>
  );
}

/**
 * In-place completion modal launched from outstanding badges on the dashboard.
 * Renders a focused field-set per category and writes back via
 * `patchMatterSolicitorPayload` so the rest of `solicitor_payload` is preserved.
 */
export default function MatterQuickActionModal({
  open,
  onClose,
  matter,
  category,
  onSaved,
}) {
  const merged = useMemo(
    () => mergeMatterPayloads(matter?.client_payload, matter?.solicitor_payload),
    [matter],
  );

  const isWideTrustModal =
    category === OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED
    || category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED;

  const businessIntakeRows = useMemo(() => formatBusinessInterestsIntakeRows(merged || {}), [merged]);
  const propertyTrustIntakeRows = useMemo(() => formatPropertyTrustIntakeRows(merged || {}), [merged]);
  const [fields, setFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const closeBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setErrorMessage('');
    const sp =
      matter?.solicitor_payload && typeof matter.solicitor_payload === 'object'
        ? matter.solicitor_payload
        : {};
    if (category === OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY) {
      const initial = {};
      TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.forEach((id) => {
        initial[id] = sp[id] ?? '';
      });
      setFields(initial);
    } else if (category === OUTSTANDING_CATEGORY.ID_VERIFICATION) {
      setFields({ identityVerificationNotes: sp.identityVerificationNotes ?? '' });
    } else if (category === OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED) {
      setFields({
        bprTrustDetails: sp.bprTrustDetails ?? merged?.bprTrustDetails ?? '',
        bprTrustScheduleNumber: sp.bprTrustScheduleNumber ?? merged?.bprTrustScheduleNumber ?? '',
        bprTrustTerms: sp.bprTrustTerms ?? merged?.bprTrustTerms ?? '',
      });
    } else if (category === OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW) {
      setFields({ bprTrustClientIntent: sp.bprTrustClientIntent ?? '' });
    } else if (category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED) {
      const existingDetails = String(sp.propertyTrustDetails ?? merged?.propertyTrustDetails ?? '').trim();
      const draftFromClient = existingDetails ? '' : buildPropertyTrustDetailsDraftFromClient(merged || {});
      setFields({
        propertyTrustDetails: existingDetails || draftFromClient,
        propertyTrustScheduleNumber: sp.propertyTrustScheduleNumber ?? merged?.propertyTrustScheduleNumber ?? '',
        propertyTrustTerms: sp.propertyTrustTerms ?? merged?.propertyTrustTerms ?? '',
      });
    } else if (category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW) {
      setFields({ includePropertyTrust: sp.includePropertyTrust ?? '' });
    } else {
      setFields({});
    }
  }, [open, category, matter, merged]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    if (typeof document === 'undefined') return undefined;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus?.();
  }, [open]);

  if (!open || !matter || !category) return null;

  const setField = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));
  const deepLink = CATEGORY_DEEP_LINKS[category]?.(matter.id);
  const title = CATEGORY_TITLES[category] || 'Quick action';

  const buildPatch = () => {
    if (category === OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY) {
      const out = {};
      TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.forEach((id) => {
        if (fields[id] !== undefined) out[id] = String(fields[id] ?? '').trim();
      });
      return { partial: out, extra: {} };
    }
    if (category === OUTSTANDING_CATEGORY.ID_VERIFICATION) {
      return {
        partial: {
          identityVerificationCompletedAt: new Date().toISOString(),
          identityVerificationNotes: String(fields.identityVerificationNotes || '').trim(),
        },
        extra: { outstanding_verification: false, verification_completed_at: new Date().toISOString() },
      };
    }
    if (category === OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED) {
      return {
        partial: {
          bprTrustClientIntent: 'Yes',
          bprTrustDetails: String(fields.bprTrustDetails || '').trim(),
          bprTrustScheduleNumber: String(fields.bprTrustScheduleNumber || '').trim(),
          bprTrustTerms: String(fields.bprTrustTerms || '').trim(),
        },
        extra: {},
      };
    }
    if (category === OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW) {
      return {
        partial: { bprTrustClientIntent: fields.bprTrustClientIntent || '' },
        extra: {},
      };
    }
    if (category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED) {
      return {
        partial: {
          includePropertyTrust: 'Yes',
          propertyTrustDetails: String(fields.propertyTrustDetails || '').trim(),
          propertyTrustScheduleNumber: String(fields.propertyTrustScheduleNumber || '').trim(),
          propertyTrustTerms: String(fields.propertyTrustTerms || '').trim(),
        },
        extra: {},
      };
    }
    if (category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW) {
      return {
        partial: { includePropertyTrust: fields.includePropertyTrust || '' },
        extra: {},
      };
    }
    return { partial: {}, extra: {} };
  };

  const validate = () => {
    if (category === OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY) {
      const missing = TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.filter(
        (id) => !String(fields[id] ?? '').trim(),
      );
      if (missing.length > 0) {
        const labels = missing
          .slice(0, 3)
          .map((id) => TESTAMENTARY_CAPACITY_FIELD_LABELS[id] || id)
          .join(', ');
        return `Please answer all questions${missing.length > 3 ? ` (e.g. ${labels} and ${missing.length - 3} more)` : ` (${labels})`}.`;
      }
    }
    if (category === OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED) {
      if (!fields.bprTrustDetails?.trim() || !fields.bprTrustScheduleNumber?.trim() || !fields.bprTrustTerms?.trim()) {
        return 'Please complete all three fields (Details, Schedule number, and Terms).';
      }
    }
    if (category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED) {
      if (
        !fields.propertyTrustDetails?.trim()
        || !fields.propertyTrustScheduleNumber?.trim()
        || !fields.propertyTrustTerms?.trim()
      ) {
        return 'Please complete all three fields (Details, Schedule number, and Terms).';
      }
    }
    if (category === OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW && !fields.bprTrustClientIntent) {
      return 'Choose Yes (include trust), No (skip), or Unsure (still discussing).';
    }
    if (category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW && !fields.includePropertyTrust) {
      return 'Choose Yes (include trust), No (skip), or Unsure (still discussing).';
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }
    setErrorMessage('');
    setSaving(true);
    const { partial, extra } = buildPatch();
    const result = await patchMatterSolicitorPayload(matter.id, partial, extra);
    setSaving(false);
    if (result.error) {
      setErrorMessage(result.error);
      toast.error('Could not save', { description: result.error });
      return;
    }
    toast.success('Saved', { description: 'Matter updated from the dashboard.' });
    onSaved?.(result.data);
    onClose?.();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm px-3 py-3 sm:items-center sm:px-6 sm:py-6 dark:bg-black/70 animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-action-title"
        className={`flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200 animate-slideIn dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] ${
          isWideTrustModal ? 'max-w-6xl' : 'max-w-2xl'
        }`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 id="quick-action-title" className="text-lg font-semibold leading-tight sm:text-xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 break-words">
              {matter.client_reference} · {matter.client_name || matter.client_snapshot?.fullName || 'Unknown client'}
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="-m-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {errorMessage ? (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100">
              {errorMessage}
            </div>
          ) : null}

          {category === OUTSTANDING_CATEGORY.ID_VERIFICATION ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-600/15 dark:text-emerald-100">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="text-sm">
                  <p className="font-semibold">Confirm ID and proof-of-address received</p>
                  <p className="mt-1">
                    Saving this marks <span className="font-mono text-xs">outstanding_verification</span> as
                    cleared and stamps <span className="font-mono text-xs">verification_completed_at</span> with
                    the current time. The badge will disappear from the dashboard.
                  </p>
                </div>
              </div>
              <TextareaField
                id="qa-id-notes"
                label="Notes (optional)"
                value={fields.identityVerificationNotes}
                onChange={(v) => setField('identityVerificationNotes', v)}
                placeholder="e.g. Passport + utility bill received in person on 29 Apr 2026"
                rows={3}
              />
            </div>
          ) : null}

          {category === OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY ? (
            <div className="space-y-3">
              {TC_TEXTAREA_FIELDS.map((id) => (
                <TextareaField
                  key={id}
                  id={`qa-tc-${id}`}
                  label={TESTAMENTARY_CAPACITY_FIELD_LABELS[id] || id}
                  value={fields[id]}
                  onChange={(v) => setField(id, v)}
                  rows={2}
                />
              ))}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TC_YES_NO_FIELDS.map((id) => (
                  <YesNoSelect
                    key={id}
                    id={`qa-tc-${id}`}
                    label={TESTAMENTARY_CAPACITY_FIELD_LABELS[id] || id}
                    value={fields[id]}
                    onChange={(v) => setField(id, v)}
                    includeNotApplicable={id === 'hasDisabilityImpactingSignRead' || id === 'otherPeoplePresent'}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {category === OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="min-w-0 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Client answers
                </p>
                <div className="max-h-[min(52vh,480px)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800">
                  {businessIntakeRows.length === 0 ? (
                    <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
                      No structured business intake captured.
                    </p>
                  ) : (
                    <dl className="space-y-3">
                      {businessIntakeRows.map((row) => (
                        <div key={row.label} className="min-w-0">
                          <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">{row.label}</dt>
                          <dd className="mt-0.5 break-words text-sm text-slate-900 dark:text-slate-100">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
              <div className="min-w-0 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Saving these three fields clears the BPR Trust completion outstanding.
                </p>
                <TextField
                  id="qa-bpr-schedule"
                  label="Schedule number"
                  value={fields.bprTrustScheduleNumber}
                  onChange={(v) => setField('bprTrustScheduleNumber', v)}
                  placeholder="e.g. 1"
                />
                <TextareaField
                  id="qa-bpr-details"
                  label="Business property details"
                  value={fields.bprTrustDetails}
                  onChange={(v) => setField('bprTrustDetails', v)}
                  placeholder="Describe the qualifying business interests."
                  rows={3}
                />
                <TextareaField
                  id="qa-bpr-terms"
                  label="BPR Trust terms"
                  value={fields.bprTrustTerms}
                  onChange={(v) => setField('bprTrustTerms', v)}
                  placeholder="Trust terms agreed with the client."
                  rows={4}
                />
              </div>
            </div>
          ) : null}


          {category === OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The client was unsure about a BPR Trust at intake. After your discussion, confirm whether the trust should be included.
              </p>
              <YesNoSelect
                id="qa-bpr-intent"
                label="Include a BPR Trust?"
                value={fields.bprTrustClientIntent}
                onChange={(v) => setField('bprTrustClientIntent', v)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose <strong>Yes</strong> to include (you will then need to fill in details / schedule / terms — open the full editor or use the BPR (required) badge), or <strong>No</strong> to skip.
              </p>
            </div>
          ) : null}

          {category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
              <div className="min-w-0 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Client answers
                  </p>
                  <p className="m-0 text-xs leading-snug text-slate-600 dark:text-slate-300">
                    Each block is the intake question with the client’s answer — use for drafting the clause.
                  </p>
                </div>
                <div className="max-h-[min(52vh,480px)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800">
                  {propertyTrustIntakeRows.length === 0 ? (
                    <p className="m-0 text-sm text-slate-600 dark:text-slate-300">
                      No property trust intake captured.
                    </p>
                  ) : (
                    <dl className="space-y-3 sm:space-y-4">
                      {propertyTrustIntakeRows.map((row, idx) => (
                        <div
                          key={`pt-qa-${idx}-${row.label}`}
                          className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/80"
                        >
                          <dt className="text-sm font-semibold text-slate-800 dark:text-slate-100">{row.label}</dt>
                          <dd className="mt-1.5 border-l-2 border-indigo-400/70 pl-3 text-sm leading-relaxed wrap-break-word whitespace-pre-wrap text-slate-700 dark:border-indigo-400/50 dark:text-slate-200">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </div>
              <div className="min-w-0 space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Saving these three fields clears the Property Trust completion outstanding.
                </p>
                <TextField
                  id="qa-pt-schedule"
                  label="Schedule number"
                  value={fields.propertyTrustScheduleNumber}
                  onChange={(v) => setField('propertyTrustScheduleNumber', v)}
                  placeholder="e.g. 2"
                />
                <TextareaField
                  id="qa-pt-details"
                  label="Property details"
                  value={fields.propertyTrustDetails}
                  onChange={(v) => setField('propertyTrustDetails', v)}
                  placeholder="Address and tenure details for the trust property."
                  rows={3}
                />
                <TextareaField
                  id="qa-pt-terms"
                  label="Property Trust terms"
                  value={fields.propertyTrustTerms}
                  onChange={(v) => setField('propertyTrustTerms', v)}
                  placeholder="Trust terms agreed with the client."
                  rows={4}
                />
              </div>
            </div>
          ) : null}

          {category === OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                The client was unsure about a Property Trust at intake. After your discussion, confirm whether the trust should be included.
              </p>
              <YesNoSelect
                id="qa-pt-intent"
                label="Include a Property Trust?"
                value={fields.includePropertyTrust}
                onChange={(v) => setField('includePropertyTrust', v)}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose <strong>Yes</strong> to include (then fill in details / schedule / terms via the full editor), or <strong>No</strong> to skip.
              </p>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {deepLink ? (
            <Link
              to={deepLink.to}
              state={deepLink.state}
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title={deepLink.label}
            >
              <ExternalLink className="h-4 w-4" />
              <span className="truncate">Open in full editor</span>
            </Link>
          ) : <span />}
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-offset-slate-900"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save & close'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
