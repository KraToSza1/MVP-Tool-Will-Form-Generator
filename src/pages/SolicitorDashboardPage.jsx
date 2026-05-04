import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldAlert, ClipboardCheck, BriefcaseBusiness, FileClock, Inbox, ExternalLink, Copy, ChevronDown, ChevronRight, HelpCircle, FilterX, Trash2, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { listMatters, deleteMatter, MATTER_STATUS } from '../lib/matters.js';
import { mergeMatterPayloads } from '../lib/formPayload.js';
import { getPartnerShortLabel } from '../lib/partnerIntakeSummary.js';
import {
  OUTSTANDING_CATEGORY,
  getMatterOutstandingCategories,
  isMatterIdVerificationOutstanding,
  isMatterBprTrustRequiredOutstanding,
  isMatterBprTrustReviewOutstanding,
  isMatterPropertyTrustRequiredOutstanding,
  isMatterPropertyTrustReviewOutstanding,
  isMatterTestamentaryCapacityOutstanding,
} from '../lib/matterOutstanding.js';
import MatterStatusBadge from '../components/solicitor/MatterStatusBadge.jsx';
import MatterQuickActionModal from '../components/solicitor/MatterQuickActionModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { mattersLoadTrace } from '../lib/mattersLoadTrace.js';

/**
 * Status filter options. The `outstanding:<category>` values are dashboard-only
 * filters that re-use the existing matter list and pinpoint a single
 * outstanding category, so the user can deal with one type of work at a time.
 */
const STATUS_OPTIONS = [
  { value: 'all', label: 'All matters' },
  { value: 'outstanding_only', label: 'Outstanding only (any)' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.ID_VERIFICATION}`, label: 'Outstanding · ID verification' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY}`, label: 'Outstanding · Testamentary Capacity' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED}`, label: 'Outstanding · BPR (required)' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW}`, label: 'Outstanding · BPR (review)' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED}`, label: 'Outstanding · Property trust (required)' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW}`, label: 'Outstanding · Property trust (review)' },
  { value: MATTER_STATUS.SUBMITTED, label: 'Submitted' },
  { value: MATTER_STATUS.IN_REVIEW, label: 'In progress' },
  { value: MATTER_STATUS.COMPLETED, label: 'Completed' },
];

/**
 * Sort options. Anything with the `outstanding:<category>` prefix is a
 * client-side priority sort: matters where that category is outstanding bubble
 * to the top, then ties are broken by last activity (newest first).
 */
const SORT_OPTIONS = [
  { value: 'last_activity_at', label: 'Last activity (newest first)' },
  { value: 'submitted_at', label: 'Received date (newest first)' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.ID_VERIFICATION}`, label: 'ID verification first' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY}`, label: 'Testamentary Capacity first' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED}`, label: 'BPR (required) first' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW}`, label: 'BPR (review) first' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED}`, label: 'Property trust (required) first' },
  { value: `outstanding:${OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW}`, label: 'Property trust (review) first' },
];

const SUPABASE_SORT_VALUES = new Set(['last_activity_at', 'submitted_at']);

function parseOutstandingCategoryFromValue(value) {
  if (typeof value !== 'string' || !value.startsWith('outstanding:')) return null;
  return value.slice('outstanding:'.length) || null;
}

const STATUS_HELP = [
  { status: 'Submitted', explanation: 'Client submitted. Awaiting your review.', action: 'Open matter and review.' },
  { status: 'Verification pending', explanation: 'Client ID or verification documents are still required.', action: 'Request photo ID and proof of address from client.' },
  { status: 'In progress', explanation: 'You are reviewing. Testamentary Capacity can be completed.', action: 'Open form and complete Testamentary Capacity.' },
  { status: 'Completed', explanation: 'Matter finished. Ready for execution.', action: 'Archive or prepare for execution.' },
];

const OUTSTANDING_CATEGORY_META = {
  [OUTSTANDING_CATEGORY.ID_VERIFICATION]: {
    title: 'ID Verification Outstanding',
    shortLabel: 'ID verification',
    tableChipLabel: 'ID',
    description: 'Files still missing client ID or verification documents. Click to view the affected files.',
    icon: ShieldAlert,
    badgeClasses: 'border-rose-200 bg-rose-100 text-rose-900',
    iconClasses: 'bg-rose-100 text-rose-700',
    activeClasses: 'border-rose-300 bg-rose-100 shadow-sm',
    inactiveClasses: 'border-rose-200 bg-white/90 hover:border-rose-300 hover:bg-rose-50',
    actionTextClasses: 'text-rose-800',
  },
  [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]: {
    title: 'BPR Trust — solicitor completion required',
    shortLabel: 'BPR (required)',
    tableChipLabel: 'BPR req',
    description:
      'Client requested a Business Property Relief Trust. Complete Business Property Details, Schedule Number, and BPR Trust Terms on the matter before generating the PDF.',
    icon: BriefcaseBusiness,
    badgeClasses: 'border-rose-200 bg-rose-100 text-rose-900',
    iconClasses: 'bg-rose-100 text-rose-700',
    activeClasses: 'border-rose-300 bg-rose-100 shadow-sm',
    inactiveClasses: 'border-rose-200 bg-white/90 hover:border-rose-300 hover:bg-rose-50',
    actionTextClasses: 'text-rose-800',
  },
  [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]: {
    title: 'BPR Trust — needs review',
    shortLabel: 'BPR (review)',
    tableChipLabel: 'BPR rev',
    description:
      'Client was unsure about a BPR Trust — discuss on onboarding. PDF can still be generated; complete or clear the BPR fields when advice is finalised.',
    icon: BriefcaseBusiness,
    badgeClasses: 'border-amber-200 bg-amber-100 text-amber-900',
    iconClasses: 'bg-amber-100 text-amber-700',
    activeClasses: 'border-amber-300 bg-amber-100 shadow-sm',
    inactiveClasses: 'border-amber-200 bg-white/90 hover:border-amber-300 hover:bg-amber-50',
    actionTextClasses: 'text-amber-800',
  },
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]: {
    title: 'Property Trust — solicitor completion required',
    shortLabel: 'Property trust (required)',
    tableChipLabel: 'PT req',
    description:
      'Client requested a property trust. Complete Property Details, Schedule Number, and Property Trust Terms on the matter before generating the final PDF.',
    icon: Landmark,
    badgeClasses: 'border-rose-200 bg-rose-100 text-rose-900',
    iconClasses: 'bg-rose-100 text-rose-700',
    activeClasses: 'border-rose-300 bg-rose-100 shadow-sm',
    inactiveClasses: 'border-rose-200 bg-white/90 hover:border-rose-300 hover:bg-rose-50',
    actionTextClasses: 'text-rose-800',
  },
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]: {
    title: 'Property Trust — needs review',
    shortLabel: 'Property trust (review)',
    tableChipLabel: 'PT rev',
    description:
      'Client was unsure about a property trust — discuss on onboarding. PDF can still be generated; complete or clear the trust fields when advice is finalised.',
    icon: Landmark,
    badgeClasses: 'border-amber-200 bg-amber-100 text-amber-900',
    iconClasses: 'bg-amber-100 text-amber-700',
    activeClasses: 'border-amber-300 bg-amber-100 shadow-sm',
    inactiveClasses: 'border-amber-200 bg-white/90 hover:border-amber-300 hover:bg-amber-50',
    actionTextClasses: 'text-amber-800',
  },
  [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]: {
    title: 'Testamentary Capacity Outstanding',
    shortLabel: 'Testamentary Capacity',
    tableChipLabel: 'TC',
    description: 'Files where the solicitor has not yet completed the Testamentary Capacity review. Click to view the affected files.',
    icon: ClipboardCheck,
    badgeClasses: 'border-amber-200 bg-amber-100 text-amber-900',
    iconClasses: 'bg-amber-100 text-amber-700',
    activeClasses: 'border-amber-300 bg-amber-100 shadow-sm',
    inactiveClasses: 'border-amber-200 bg-white/90 hover:border-amber-300 hover:bg-amber-50',
    actionTextClasses: 'text-amber-800',
  },
};

function formatDate(value) {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString();
}

function formatLocaleDateOnly(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function formatActivityParts(value) {
  if (!value) return { date: 'Not yet', time: null };
  const d = new Date(value);
  return { date: d.toLocaleDateString(), time: d.toLocaleTimeString() };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstNameFromDisplay(display) {
  if (!display || typeof display !== 'string') return 'there';
  const part = display.trim().split(/\s+/)[0];
  return part || 'there';
}

/**
 * One presentational unit for the dashboard stats grid. Renders a coloured
 * card that, on click, applies a status filter to the matters list and
 * scrolls to it. Includes a tiny "what to do" hint line so a solicitor can
 * see at a glance which pile each card represents and the suggested action.
 */
function StatCard({
  tone, // 'slate' | 'blue' | 'amber' | 'indigo' | 'emerald' | 'rose'
  icon: Icon,
  label,
  count,
  hint,
  isActive,
  onClick,
  ariaLabel,
}) {
  const TONE_STYLES = {
    slate: {
      base: 'border-slate-200 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100',
      hover: 'hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-500 dark:hover:bg-slate-800/60',
      active: 'border-slate-400 ring-2 ring-slate-400/50 shadow dark:border-slate-300 dark:ring-slate-300/30',
      iconRow: 'text-slate-600 dark:text-slate-300',
      count: 'text-slate-900 dark:text-slate-100',
      hint: 'text-slate-500 dark:text-slate-400',
    },
    blue: {
      base: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/25 dark:text-blue-100',
      hover: 'hover:border-blue-300 hover:bg-blue-100 dark:hover:border-blue-400/50 dark:hover:bg-blue-900/40',
      active: 'border-blue-500 ring-2 ring-blue-400/60 shadow dark:border-blue-300 dark:ring-blue-300/40',
      iconRow: 'text-blue-800 dark:text-blue-200',
      count: 'text-blue-900 dark:text-blue-100',
      hint: 'text-blue-800/85 dark:text-blue-200/85',
    },
    amber: {
      base: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-100',
      hover: 'hover:border-amber-300 hover:bg-amber-100 dark:hover:border-amber-400/50 dark:hover:bg-amber-900/40',
      active: 'border-amber-500 ring-2 ring-amber-400/60 shadow dark:border-amber-300 dark:ring-amber-300/40',
      iconRow: 'text-amber-800 dark:text-amber-200',
      count: 'text-amber-900 dark:text-amber-100',
      hint: 'text-amber-800/90 dark:text-amber-200/85',
    },
    indigo: {
      base: 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-950/25 dark:text-indigo-100',
      hover: 'hover:border-indigo-300 hover:bg-indigo-100 dark:hover:border-indigo-400/50 dark:hover:bg-indigo-900/40',
      active: 'border-indigo-500 ring-2 ring-indigo-400/60 shadow dark:border-indigo-300 dark:ring-indigo-300/40',
      iconRow: 'text-indigo-800 dark:text-indigo-200',
      count: 'text-indigo-900 dark:text-indigo-100',
      hint: 'text-indigo-800/85 dark:text-indigo-200/85',
    },
    emerald: {
      base: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-100',
      hover: 'hover:border-emerald-300 hover:bg-emerald-100 dark:hover:border-emerald-400/50 dark:hover:bg-emerald-900/40',
      active: 'border-emerald-500 ring-2 ring-emerald-400/60 shadow dark:border-emerald-300 dark:ring-emerald-300/40',
      iconRow: 'text-emerald-800 dark:text-emerald-200',
      count: 'text-emerald-900 dark:text-emerald-100',
      hint: 'text-emerald-800/85 dark:text-emerald-200/85',
    },
    rose: {
      base: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/35 dark:bg-rose-950/25 dark:text-rose-100',
      hover: 'hover:border-rose-300 hover:bg-rose-100 dark:hover:border-rose-400/50 dark:hover:bg-rose-900/40',
      active: 'border-rose-500 ring-2 ring-rose-400/60 shadow dark:border-rose-300 dark:ring-rose-300/40',
      iconRow: 'text-rose-800 dark:text-rose-200',
      count: 'text-rose-900 dark:text-rose-100',
      hint: 'text-rose-800/90 dark:text-rose-200/85',
    },
  };
  const tones = TONE_STYLES[tone] || TONE_STYLES.slate;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={ariaLabel || label}
      title={hint ? `${label} — ${hint}` : label}
      className={`text-left rounded-2xl border p-5 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-slate-900 min-h-[44px] ${tones.base} ${tones.hover} ${isActive ? tones.active : ''}`}
    >
      <div className={`flex items-center gap-3 ${tones.iconRow}`}>
        <Icon size={18} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className={`mt-4 text-3xl font-bold ${tones.count}`}>{count}</p>
      {hint ? <p className={`mt-1 text-xs ${tones.hint}`}>{hint}</p> : null}
      <p className={`mt-2 text-xs font-semibold ${tones.iconRow} opacity-80`}>{isActive ? 'Filter on · tap to clear' : 'Tap to filter list'}</p>
    </button>
  );
}

function getMatterDisplayData(matter) {
  const outstandingCategories = getMatterOutstandingCategories(matter);
  const hasOutstandingCategories = outstandingCategories.length > 0;
  const mergedPayload = mergeMatterPayloads(matter.client_payload, matter.solicitor_payload);
  const displayPhone =
    mergedPayload?.phoneNumber ||
    mergedPayload?.mobile ||
    mergedPayload?.mobileNumber ||
    mergedPayload?.telephoneNumber ||
    matter.client_phone ||
    matter.client_snapshot?.phoneNumber ||
    matter.client_snapshot?.mobile ||
    matter.client_snapshot?.raw?.mobile ||
    matter.client_snapshot?.mobileNumber ||
    'No phone captured';
  const partnerLabel = getPartnerShortLabel(mergedPayload);
  return { outstandingCategories, hasOutstandingCategories, mergedPayload, displayPhone, partnerLabel };
}

export default function SolicitorDashboardPage() {
  const { user, loading: authLoading, profile } = useAuth();
  const mattersLoadRunRef = useRef(0);
  const pageMountT0 = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const [matters, setMatters] = useState([]);
  const [allMattersForStats, setAllMattersForStats] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [sortBy, setSortBy] = useState('last_activity_at');
  const [statusHelpOpen, setStatusHelpOpen] = useState(false);
  const [activeOutstandingCategory, setActiveOutstandingCategory] = useState(null);
  const [matterListOutstandingCategory, setMatterListOutstandingCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [matterToDelete, setMatterToDelete] = useState(null);
  const [quickAction, setQuickAction] = useState(null); // { matter, category }
  const mattersListRef = useRef(null);

  /**
   * Supabase ordering only understands real columns. For the new
   * `outstanding:<category>` sorts, send `last_activity_at` to the server and
   * apply the priority ordering client-side in `visibleMatters`.
   */
  const supabaseSortBy = SUPABASE_SORT_VALUES.has(sortBy) ? sortBy : 'last_activity_at';

  const filterOutstandingCategory = useMemo(
    () => parseOutstandingCategoryFromValue(status),
    [status],
  );
  const sortPriorityCategory = useMemo(
    () => parseOutstandingCategoryFromValue(sortBy),
    [sortBy],
  );

  useEffect(() => {
    mattersLoadTrace('SolicitorDashboardPage mounted', {
      sinceNavigationMs:
        pageMountT0.current && typeof performance !== 'undefined'
          ? Math.round(performance.now() - pageMountT0.current)
          : 0,
    });
  }, []);

  useEffect(() => {
    mattersLoadTrace('Dashboard "Loading matters…" visibility', {
      authLoading,
      mattersRowLoading: loading,
      showsLoadingMattersBanner: loading,
      meaning: authLoading
        ? 'Unusual: auth still loading on dashboard (ProtectedRoute normally blocks until auth is ready).'
        : loading
          ? 'Normal: waiting for both listMatters requests (filtered + stats_all) or StrictMode double-fetch.'
          : 'Table can render — Supabase listMatters finished.',
    });
  }, [authLoading, loading]);

  const handleConfirmDelete = async () => {
    if (!matterToDelete) return;
    const matter = matterToDelete;
    const ref = matter.client_reference || matter.id;
    setMatterToDelete(null);
    setDeletingId(matter.id);
    const result = await deleteMatter(matter.id);
    setDeletingId(null);
    if (result.error) {
      toast.error('Could not delete matter', { description: result.error });
      return;
    }
    setMatters((prev) => prev.filter((m) => m.id !== matter.id));
    setAllMattersForStats((prev) => prev.filter((m) => m.id !== matter.id));
    toast.success('Matter deleted', { description: `"${ref}" has been removed.` });
  };

  useEffect(() => {
    // Wait for auth session (Safari/Chrome): avoid querying before Supabase session is ready (was showing 0 matters).
    if (authLoading) {
      mattersLoadTrace('matters load effect: SKIP (auth still loading)', {
        note: 'listMatters will not run until authLoading is false.',
      });
      return;
    }

    const run = ++mattersLoadRunRef.current;
    const effectStarted = typeof performance !== 'undefined' ? performance.now() : 0;
    mattersLoadTrace('matters load effect: START — scheduling two parallel listMatters', {
      run,
      strictModeNote: import.meta.env.DEV
        ? 'React StrictMode may run this effect twice in dev — duplicate logs and timings are expected.'
        : null,
      filters: { search, status, assignedOnly, sortBy },
      userId: user?.id ? `${String(user.id).slice(0, 8)}…` : null,
    });

    let active = true;
    queueMicrotask(() => {
      if (active) setLoading(true);
    });

    const tFiltered = typeof performance !== 'undefined' ? performance.now() : 0;
    // Status values that aren't real DB statuses (outstanding_only / outstanding:<category>)
    // get widened to 'all' on the server; the client-side filter in `visibleMatters`
    // performs the actual narrowing using outstanding-category logic.
    const isClientSideStatus =
      status === 'outstanding_only' || (typeof status === 'string' && status.startsWith('outstanding:'));
    const pFiltered = listMatters(
      {
        search,
        status: isClientSideStatus ? 'all' : status,
        assignedOnly,
        userId: user?.id,
        sortBy: supabaseSortBy,
      },
      'dashboard_filtered',
    ).then((r) => {
      if (typeof performance !== 'undefined') {
        mattersLoadTrace('listMatters returned (first of two)', {
          run,
          label: 'dashboard_filtered',
          elapsedMs: Math.round(performance.now() - tFiltered),
          error: r.error || null,
          rowCount: r.data?.length ?? 0,
        });
      }
      return r;
    });

    const tAll = typeof performance !== 'undefined' ? performance.now() : 0;
    const pAll = listMatters(
      { search: '', status: 'all', assignedOnly: false, userId: user?.id, sortBy: 'last_activity_at' },
      'dashboard_stats_all',
    ).then((r) => {
      if (typeof performance !== 'undefined') {
        mattersLoadTrace('listMatters returned (second of two)', {
          run,
          label: 'dashboard_stats_all',
          elapsedMs: Math.round(performance.now() - tAll),
          error: r.error || null,
          rowCount: r.data?.length ?? 0,
        });
      }
      return r;
    });

    Promise.all([pFiltered, pAll])
      .then(([filteredResult, allResult]) => {
        if (!active) {
          mattersLoadTrace('matters load effect: IGNORED (stale run — cleanup ran)', { run });
          return;
        }
        const totalMs =
          effectStarted && typeof performance !== 'undefined'
            ? Math.round(performance.now() - effectStarted)
            : 0;
        mattersLoadTrace('matters load effect: BOTH requests settled — setLoading(false) next', {
          run,
          wallClockSinceEffectMs: totalMs,
          filteredError: filteredResult.error || null,
          allError: allResult.error || null,
          filteredCount: filteredResult.data?.length ?? 0,
          allCount: allResult.data?.length ?? 0,
        });
        if (filteredResult.error) {
          toast.error('Could not load matters', { description: filteredResult.error });
          setMatters([]);
        } else {
          setMatters(filteredResult.data || []);
        }
        if (!allResult.error) {
          setAllMattersForStats(allResult.data || []);
        }
        setLoading(false);
        mattersLoadTrace('Dashboard UI: loading hidden — matters table should render', { run });
      })
      .catch((err) => {
        console.error('[WillTool Matters Load] matters effect: unexpected rejection', { run, err });
        if (active) {
          setLoading(false);
          toast.error('Could not load matters', { description: err?.message || 'Unexpected error' });
        }
      });

    return () => {
      active = false;
      mattersLoadTrace('matters load effect: CLEANUP (deps changed or unmount)', { run });
    };
  }, [assignedOnly, authLoading, search, sortBy, status, user?.id]);

  const stats = useMemo(() => {
    const list = allMattersForStats;
    return list.reduce((acc, matter) => {
      acc.total += 1;
      acc[matter.status] = (acc[matter.status] || 0) + 1;
      if (matter.outstanding_verification) acc.idNeeded += 1;
      return acc;
    }, {
      total: 0,
      submitted: 0,
      verification_pending: 0,
      in_review: 0,
      completed: 0,
      idNeeded: 0,
    });
  }, [allMattersForStats]);

  const outstandingGroups = useMemo(() => ({
    [OUTSTANDING_CATEGORY.ID_VERIFICATION]: allMattersForStats.filter((matter) => isMatterIdVerificationOutstanding(matter)),
    [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]: allMattersForStats.filter((matter) => isMatterBprTrustRequiredOutstanding(matter)),
    [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]: allMattersForStats.filter((matter) => isMatterBprTrustReviewOutstanding(matter)),
    [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]: allMattersForStats.filter((matter) => isMatterPropertyTrustRequiredOutstanding(matter)),
    [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]: allMattersForStats.filter((matter) => isMatterPropertyTrustReviewOutstanding(matter)),
    [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]: allMattersForStats.filter((matter) => isMatterTestamentaryCapacityOutstanding(matter)),
  }), [allMattersForStats]);

  const outstandingSummary = useMemo(() => (
    Object.entries(OUTSTANDING_CATEGORY_META).map(([key, meta]) => ({
      key,
      ...meta,
      count: outstandingGroups[key]?.length || 0,
    }))
  ), [outstandingGroups]);

  const selectedOutstandingCategory = activeOutstandingCategory
    || outstandingSummary.find((item) => item.count > 0)?.key
    || OUTSTANDING_CATEGORY.ID_VERIFICATION;
  const hasOutstandingItems = outstandingSummary.some((item) => item.count > 0);
  const outstandingFileCount = useMemo(() => {
    const ids = new Set();
    Object.values(outstandingGroups).forEach((group) => {
      group.forEach((matter) => ids.add(matter.id));
    });
    return ids.size;
  }, [outstandingGroups]);

  const visibleMatters = useMemo(() => {
    let next = matters;
    if (status === 'outstanding_only') {
      next = next.filter((matter) => (getMatterOutstandingCategories(matter) || []).length > 0);
    }
    if (filterOutstandingCategory) {
      next = next.filter((matter) =>
        (getMatterOutstandingCategories(matter) || []).includes(filterOutstandingCategory),
      );
    }
    if (matterListOutstandingCategory) {
      next = next.filter((matter) =>
        (getMatterOutstandingCategories(matter) || []).includes(matterListOutstandingCategory),
      );
    }
    if (sortPriorityCategory) {
      // Stable priority sort: matters with the chosen outstanding category first,
      // then preserve the existing order (Supabase already sorted by last_activity_at).
      const decorated = next.map((matter, index) => ({
        matter,
        index,
        priority: (getMatterOutstandingCategories(matter) || []).includes(sortPriorityCategory) ? 0 : 1,
      }));
      decorated.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.index - b.index;
      });
      next = decorated.map((entry) => entry.matter);
    }
    return next;
  }, [filterOutstandingCategory, matters, matterListOutstandingCategory, sortPriorityCategory, status]);

  const showEmptyState = !loading && matters.length === 0 && !search && status === 'all' && !assignedOnly;
  const tcDueCount = outstandingGroups[OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]?.length ?? 0;
  const filtersActive =
    status !== 'all'
    || search.trim() !== ''
    || assignedOnly
    || !!matterListOutstandingCategory
    || !!filterOutstandingCategory;
  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setAssignedOnly(false);
    setMatterListOutstandingCategory(null);
  };

  const handleOutstandingCardClick = (categoryKey) => {
    setActiveOutstandingCategory(categoryKey);
    setMatterListOutstandingCategory(categoryKey);
    setStatus('outstanding_only');
    window.setTimeout(() => {
      mattersListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  /**
   * Apply a status-style filter from the stat-card grid. If the same filter is
   * already active, clicking the card clears it (toggle behaviour, with a
   * little hint in the card's footer line). Search and per-category outstanding
   * narrows are reset so the user gets the full sub-list every time.
   */
  const handleStatCardClick = (targetStatus) => {
    setMatterListOutstandingCategory(null);
    setActiveOutstandingCategory(null);
    setSearch('');
    setStatus((prev) => (prev === targetStatus ? 'all' : targetStatus));
    window.setTimeout(() => {
      mattersListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // Stat-card definitions. Order matches the existing grid so visually nothing moves;
  // this just centralises labels, hints and target filters in one place.
  const statCards = [
    {
      key: 'total',
      tone: 'slate',
      icon: BriefcaseBusiness,
      label: 'Total matters',
      count: stats.total,
      hint: 'Every matter on file',
      filter: 'all',
      ariaLabel: 'Show all matters',
    },
    {
      key: 'submitted',
      tone: 'blue',
      icon: FileClock,
      label: 'Submitted',
      count: stats.submitted,
      hint: 'Awaiting your first review',
      filter: MATTER_STATUS.SUBMITTED,
      ariaLabel: 'Filter to submitted matters',
    },
    {
      key: 'idNeeded',
      tone: 'amber',
      icon: ShieldAlert,
      label: 'Verification pending',
      count: stats.idNeeded,
      hint: 'Chase or verify client ID',
      filter: `outstanding:${OUTSTANDING_CATEGORY.ID_VERIFICATION}`,
      ariaLabel: 'Filter to matters with ID outstanding',
    },
    {
      key: 'in_review',
      tone: 'indigo',
      icon: ClipboardCheck,
      label: 'In progress',
      count: stats.in_review,
      hint: 'Continue review · finish TC',
      filter: MATTER_STATUS.IN_REVIEW,
      ariaLabel: 'Filter to in-progress matters',
    },
    {
      key: 'completed',
      tone: 'emerald',
      icon: ClipboardCheck,
      label: 'Completed',
      count: stats.completed,
      hint: 'Ready for execution / archive',
      filter: MATTER_STATUS.COMPLETED,
      ariaLabel: 'Filter to completed matters',
    },
    {
      key: 'tcDue',
      tone: 'rose',
      icon: ClipboardCheck,
      label: 'TC due',
      count: tcDueCount,
      hint: 'Before final PDF',
      filter: `outstanding:${OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY}`,
      ariaLabel: 'Filter to matters needing Testamentary Capacity',
    },
  ];

  const clientWillToolUrl = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
  const handleCopyClientLink = async () => {
    if (!clientWillToolUrl) return;
    try {
      await navigator.clipboard.writeText(clientWillToolUrl);
      toast.success('Link copied', { description: 'Will Tool client link copied. Paste into an email to send to clients.' });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy to clipboard.' });
    }
  };

  return (
    <div className="space-y-6 min-w-0 w-full max-w-full">
      {!showEmptyState && !loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5 dark:border-slate-600 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-xl">
            {getGreeting()}, {firstNameFromDisplay(profile?.display_name || profile?.email)}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' '}
            · {outstandingFileCount} matter{outstandingFileCount === 1 ? '' : 's'} with at least one outstanding action
            {tcDueCount > 0 ? (
              <>
                {' '}
                · <span className="font-medium text-amber-800 dark:text-amber-200">{tcDueCount} TC assessment(s) incomplete</span>
              </>
            ) : null}
          </p>
        </div>
      )}

      {showEmptyState && (
        <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 shadow-sm">
          <div className="flex gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
              <Inbox size={24} className="text-indigo-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-indigo-900">No matters yet</h2>
              <p className="mt-2 text-sm text-indigo-800">
                Clients complete the questionnaire on the Will Tool homepage and submit. New matters will appear here automatically.
              </p>
              <p className="mt-3 text-sm font-medium text-indigo-900">To get started:</p>
              <ol className="mt-1 list-inside list-decimal space-y-1 text-sm text-indigo-800">
                <li>Share the Will Tool link with your client</li>
                <li>They fill in their instructions and submit</li>
                <li>The matter appears in your list below</li>
              </ol>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <ExternalLink size={16} />
                Open Will Tool (client link)
              </a>
            </div>
          </div>
        </section>
      )}

      {!showEmptyState && (
        <section className={`outstanding-items-section rounded-2xl sm:rounded-3xl border-2 p-4 sm:p-6 shadow-sm ${hasOutstandingItems ? 'border-rose-200 bg-gradient-to-br from-rose-50 via-amber-50 to-white' : 'border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-slate-50'}`}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Outstanding items</p>
              <h2 className="mt-2 text-lg sm:text-2xl font-bold tracking-tight text-slate-950 break-words leading-snug">ID verification, BPR Trust follow-up, and Testamentary Capacity stay pinned here.</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-700">
                These categories are shown above the main matter list so they cannot be missed. Click a category to see the files that still need action.
              </p>
            </div>
            <div className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${hasOutstandingItems ? 'border-rose-200 bg-white text-rose-900' : 'border-emerald-200 bg-white text-emerald-900'}`}>
              {hasOutstandingItems
                ? `${outstandingFileCount} outstanding file${outstandingFileCount === 1 ? '' : 's'}`
                : 'No outstanding files right now'}
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {outstandingSummary.map((item) => {
              const Icon = item.icon;
              const isActive = selectedOutstandingCategory === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleOutstandingCardClick(item.key)}
                  className={`rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isActive ? item.activeClasses : item.inactiveClasses}`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.iconClasses}`}>
                      <Icon size={22} />
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.badgeClasses}`}>
                      {item.count} file{item.count === 1 ? '' : 's'}
                    </span>
                  </div>
                  <p className="mt-4 text-lg font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-2 text-sm text-slate-700">{item.description}</p>
                  <p className={`mt-4 text-sm font-semibold ${item.actionTextClasses}`}>
                    {item.count > 0 ? 'Click to view files' : 'No files currently outstanding'}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-200">
            Showing one matter list only. Click a category above to filter the
            main list below.
            {matterListOutstandingCategory ? (
              <span className="ml-2 inline-flex items-center rounded-full border border-indigo-300 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-800 dark:border-indigo-500/60 dark:bg-indigo-600/20 dark:text-indigo-100">
                Filter: {OUTSTANDING_CATEGORY_META[matterListOutstandingCategory]?.shortLabel || 'Outstanding'}
              </span>
            ) : null}
          </div>
        </section>
      )}

      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6"
        aria-label="Matter status summary — tap a card to filter the list below"
      >
        {statCards.map((card) => (
          <StatCard
            key={card.key}
            tone={card.tone}
            icon={card.icon}
            label={card.label}
            count={card.count}
            hint={card.hint}
            isActive={status === card.filter}
            ariaLabel={card.ariaLabel}
            onClick={() => handleStatCardClick(card.filter)}
          />
        ))}
      </section>

      <section
        id="solicitor-matters-list"
        ref={mattersListRef}
        className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden solicitor-dashboard-section dark:border-slate-600 dark:bg-slate-900/30"
      >
        {/* Header: title + actions — solicitor-dashboard-header for dark theme */}
        <div className="solicitor-dashboard-header border-b border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 break-words">Your matters</h1>
              <p className="mt-1.5 text-sm text-slate-500 max-w-xl">
                Clients submit via the Will Tool. Search by reference, name, email or phone. Hover status badges for explanations.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleCopyClientLink}
                className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 solicitor-dashboard-btn min-h-[44px]"
                title="Copy Will Tool link to send to clients"
              >
                <Copy size={16} className="text-slate-500" />
                Copy client link
              </button>
              <button
                type="button"
                onClick={() => setStatusHelpOpen((o) => !o)}
                className={`inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 solicitor-dashboard-btn min-h-[44px] ${statusHelpOpen ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400'}`}
                aria-expanded={statusHelpOpen}
              >
                <HelpCircle size={16} className="text-slate-500" />
                What does this mean?
                {statusHelpOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            </div>
          </div>

          {/* Filters row */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Search</span>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Reference, name, email, phone"
                  className="solicitor-dashboard-input w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="solicitor-dashboard-input w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Sort by</span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="solicitor-dashboard-input w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="solicitor-dashboard-input flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-2.5 min-h-[42px] cursor-pointer hover:bg-slate-50 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-0 focus-within:border-indigo-500">
              <input
                type="checkbox"
                checked={assignedOnly}
                onChange={(event) => setAssignedOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-medium text-slate-700">Assigned to me</span>
            </label>
            {filtersActive && (
              <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-2">
                <span className="text-xs text-slate-500">Filters are hiding some matters.</span>
                {matterListOutstandingCategory ? (
                  <span className="text-xs font-semibold text-indigo-700">
                    Category: {OUTSTANDING_CATEGORY_META[matterListOutstandingCategory]?.shortLabel || 'Outstanding'}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={clearFilters}
                  className="solicitor-dashboard-btn inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <FilterX size={14} />
                  Show all
                </button>
              </div>
            )}
          </div>

          {/* Status help panel - full width below filters */}
          {statusHelpOpen && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-inner solicitor-dashboard-help-panel">
              <p className="text-sm font-semibold text-slate-900 mb-4">Status meanings and suggested actions</p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200">
                      <th className="pb-3 pr-6">Status</th>
                      <th className="pb-3 pr-6">Meaning</th>
                      <th className="pb-3">Suggested action</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-700 divide-y divide-slate-100">
                    {STATUS_HELP.map((row) => (
                      <tr key={row.status}>
                        <td className="py-3 pr-6 font-medium text-slate-900">{row.status}</td>
                        <td className="py-3 pr-6">{row.explanation}</td>
                        <td className="py-3">{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Mobile / tablet: stacked cards (no horizontal scroll). Desktop: full table. */}
        {loading ? (
          <div className="px-4 py-8 sm:px-6 text-sm text-slate-600">Loading matters…</div>
        ) : visibleMatters.length === 0 ? (
          <div className="px-4 py-10 sm:px-6 text-center">
            <p className="text-sm font-medium text-slate-700">No matters match the current filters.</p>
            <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
              {filtersActive ? 'Click Show all matters below or Show all above to clear filters. If it still doesn’t appear,' : 'If you expect to see a matter,'} check in Supabase that your account has role <code className="bg-slate-100 px-1 rounded">solicitor</code> or <code className="bg-slate-100 px-1 rounded">admin</code> in the <code className="bg-slate-100 px-1 rounded">profiles</code> table.
            </p>
            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
              >
                <FilterX size={16} />
                Show all matters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="lg:hidden space-y-3 px-4 pb-4 sm:px-6">
              {visibleMatters.map((matter) => {
                const { outstandingCategories, hasOutstandingCategories, displayPhone, partnerLabel } = getMatterDisplayData(matter);
                return (
                  <div
                    key={matter.id}
                    className={`solicitor-matter-card rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${hasOutstandingCategories ? 'bg-amber-50/40' : ''}`}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <Link to={`/solicitor/matters/${matter.id}`} className="text-base font-semibold text-indigo-700 hover:text-indigo-900 break-all">
                        {matter.client_reference}
                      </Link>
                      <p className="font-medium text-slate-900">{matter.client_name || matter.client_snapshot?.fullName || 'Unknown client'}</p>
                      <p className="text-sm text-slate-600 break-all">{matter.client_email || matter.client_snapshot?.email || 'No email captured'}</p>
                      <p className="text-sm text-slate-600 break-all">{displayPhone}</p>
                      <p className="text-sm text-slate-700">
                        <span className="text-slate-500">Partner / spouse: </span>
                        <span className="line-clamp-3">{partnerLabel || '—'}</span>
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 items-center">
                      <MatterStatusBadge status={matter.status} />
                      <span className="text-xs font-medium text-slate-600">
                        {matter.outstanding_verification ? 'Verification pending' : 'Verification complete'}
                      </span>
                    </div>
                    {hasOutstandingCategories && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {outstandingCategories.map((category) => {
                          const meta = OUTSTANDING_CATEGORY_META[category];
                          return (
                            <button
                              key={category}
                              type="button"
                              onClick={() => setQuickAction({ matter, category })}
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${meta.badgeClasses}`}
                              title={`Complete ${meta.shortLabel} from the dashboard`}
                            >
                              {meta.shortLabel}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <dl className="mt-3 grid grid-cols-1 gap-1 text-xs text-slate-600 sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Received</dt>
                        <dd>{matter.submitted_at ? new Date(matter.submitted_at).toLocaleDateString() : '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Last activity</dt>
                        <dd className="break-words">{formatDate(matter.last_activity_at)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Link
                        to={`/solicitor/matters/${matter.id}`}
                        className="inline-flex flex-1 min-w-0 justify-center items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                      >
                        Open matter
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMatterToDelete(matter);
                        }}
                        disabled={deletingId === matter.id}
                        className="solicitor-matter-delete-btn inline-flex flex-1 min-w-0 justify-center items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 min-h-[44px]"
                        title="Delete this matter (cannot be undone)"
                      >
                        {deletingId === matter.id ? (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" aria-hidden />
                        ) : (
                          <Trash2 size={14} />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:block overflow-x-auto rounded-b-2xl">
              <table className="solicitor-matters-table table-fixed min-w-[1000px] w-full border-collapse divide-y divide-slate-200">
                <colgroup>
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '9%' }} />
                  <col style={{ width: '11%' }} />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">Reference</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-left">Client</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">Partner</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">Status</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">ID check</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">Outstanding</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">Received</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">Activity</th>
                    <th className="align-middle px-3 xl:px-4 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {visibleMatters.map((matter) => {
                    const { outstandingCategories, hasOutstandingCategories, displayPhone, partnerLabel } = getMatterDisplayData(matter);
                    const clientLabel = matter.client_name || matter.client_snapshot?.fullName || 'Unknown client';
                    const emailLine = matter.client_email || matter.client_snapshot?.email || 'No email captured';
                    const activityParts = formatActivityParts(matter.last_activity_at);
                    return (
                      <tr
                        key={matter.id}
                        className={
                          hasOutstandingCategories
                            ? 'border-l-[3px] border-l-amber-400 bg-amber-50/40 hover:bg-amber-50 solicitor-matter-row-outstanding'
                            : 'hover:bg-slate-50'
                        }
                      >
                        <td className="align-middle px-3 xl:px-4 py-2 text-center">
                          <Link
                            to={`/solicitor/matters/${matter.id}`}
                            className="solicitor-matter-ref-link mx-auto inline-block max-w-full rounded-lg bg-slate-100 px-2 py-1 text-center font-mono text-[11px] font-semibold leading-none text-indigo-700 break-all ring-1 ring-inset ring-slate-200/80 hover:bg-indigo-50 hover:text-indigo-900 hover:ring-indigo-200"
                            title="Open matter"
                          >
                            {matter.client_reference}
                          </Link>
                        </td>
                        <td className="align-middle min-w-0 px-3 xl:px-4 py-2 text-left">
                          <div className="min-w-0 space-y-0.5 leading-snug">
                            <p className="text-sm font-semibold text-slate-900 line-clamp-2" title={clientLabel}>
                              {clientLabel}
                            </p>
                            <p className="break-all text-xs text-slate-500">{emailLine}</p>
                            <p className="tabular-nums text-xs text-slate-600">{displayPhone}</p>
                          </div>
                        </td>
                        <td className="align-middle min-w-0 px-3 xl:px-4 py-2 text-center text-sm text-slate-700" title={partnerLabel || undefined}>
                          <span className="line-clamp-2 inline-block max-w-full text-center">{partnerLabel || '—'}</span>
                        </td>
                        <td className="align-middle whitespace-nowrap px-3 xl:px-4 py-2 text-center">
                          <MatterStatusBadge status={matter.status} compact />
                        </td>
                        <td className="align-middle px-3 xl:px-4 py-2 text-center">
                          {matter.outstanding_verification ? (
                            <span className="matter-verification-pill matter-verification-pill-pending inline-flex rounded border border-amber-300 bg-amber-50 px-1.5 py-px text-[10px] font-semibold leading-none text-amber-950">
                              Pending
                            </span>
                          ) : (
                            <span className="matter-verification-pill matter-verification-pill-complete inline-flex rounded border border-emerald-300 bg-emerald-50 px-1.5 py-px text-[10px] font-semibold leading-none text-emerald-900">
                              Verified
                            </span>
                          )}
                        </td>
                        <td className="align-middle min-w-0 px-3 xl:px-4 py-2 text-center">
                          {hasOutstandingCategories ? (
                            <div className="flex min-h-0 flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
                              {outstandingCategories.map((category) => {
                                const meta = OUTSTANDING_CATEGORY_META[category];
                                return (
                                  <button
                                    key={category}
                                    type="button"
                                    onClick={() => setQuickAction({ matter, category })}
                                    className={`solicitor-outstanding-chip inline-flex max-w-full shrink-0 cursor-pointer items-center rounded border px-1 py-px text-[10px] font-semibold leading-none tracking-tight transition hover:brightness-110 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-0 ${meta.badgeClasses}`}
                                    title={`${meta.title} — tap to complete (${meta.shortLabel})`}
                                  >
                                    {meta.tableChipLabel}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="inline-block text-xs text-slate-400">None</span>
                          )}
                        </td>
                        <td
                          className="align-middle px-3 xl:px-4 py-2 text-center text-xs tabular-nums text-slate-700"
                          title={matter.submitted_at ? formatDate(matter.submitted_at) : undefined}
                        >
                          {formatLocaleDateOnly(matter.submitted_at)}
                        </td>
                        <td
                          className="align-middle min-w-0 px-3 xl:px-4 py-2 text-center text-xs tabular-nums text-slate-700"
                          title={formatDate(matter.last_activity_at)}
                        >
                          <span className="block leading-tight">{activityParts.date}</span>
                          {activityParts.time ? (
                            <span className="matter-activity-time mt-0.5 block text-[11px] text-slate-500">{activityParts.time}</span>
                          ) : null}
                        </td>
                        <td className="align-middle px-3 xl:px-4 py-2 text-center">
                          <div className="flex flex-nowrap items-center justify-center gap-1.5 whitespace-nowrap">
                            <Link
                              to={`/solicitor/matters/${matter.id}`}
                              className="inline-flex min-h-[36px] min-w-[36px] shrink-0 items-center justify-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 whitespace-nowrap"
                            >
                              Open matter
                            </Link>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setMatterToDelete(matter);
                              }}
                              disabled={deletingId === matter.id}
                              className="solicitor-matter-delete-btn inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
                              title="Delete this matter (cannot be undone)"
                              aria-label={
                                deletingId === matter.id
                                  ? 'Removing matter…'
                                  : 'Delete this matter (cannot be undone)'
                              }
                            >
                              {deletingId === matter.id ? (
                                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" aria-hidden />
                              ) : (
                                <Trash2 size={14} className="shrink-0" aria-hidden />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <MatterQuickActionModal
        open={!!quickAction}
        matter={quickAction?.matter || null}
        category={quickAction?.category || null}
        onClose={() => setQuickAction(null)}
        onSaved={(updated) => {
          if (!updated || !updated.id) return;
          // Replace the row in both the filtered list and the stats list so badges
          // disappear immediately without waiting for a full re-fetch.
          setMatters((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
          setAllMattersForStats((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        }}
      />

      <ConfirmModal
        open={!!matterToDelete}
        onClose={() => setMatterToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Permanently remove this matter?"
        confirmLabel="Remove matter"
        cancelLabel="Cancel"
        variant="danger"
      >
        {matterToDelete && (
          <>
            <p className="font-medium text-slate-900">Reference: {matterToDelete.client_reference || matterToDelete.id}</p>
            <p className="mt-2 text-slate-700">
              All client data, solicitor notes, and activity for this matter will be deleted. This cannot be undone.
            </p>
          </>
        )}
      </ConfirmModal>
    </div>
  );
}
