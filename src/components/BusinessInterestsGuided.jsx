/**
 * Aristone Business Interests — guided intake (May 2026).
 * Persists biz_* fields for solicitor / PDF mapping; syncs legacy keys for clauses (hasBusinessInterests,
 * trusteePowerCarryOnBusiness, appointSeparateBusinessTrustee, separateTrusteeData, businessInterestType, etc.).
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Briefcase, Pencil, X } from 'lucide-react';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import { getFormPeopleEntries } from '../lib/formPeopleSummary.js';
import '../styles/aristone-business-interests.css';

/** Normalise tri-state for display (legacy saves may use odd casing) */
function normalizeYesNoUnsure(v) {
  if (v === true) return 'Yes';
  if (v === false) return 'No';
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  const l = s.toLowerCase();
  if (l === 'yes' || l === 'y') return 'Yes';
  if (l === 'no' || l === 'n') return 'No';
  if (l === 'unsure') return 'Unsure';
  if (s === 'Yes' || s === 'No' || s === 'Unsure') return s;
  return undefined;
}

const TRUSTEE_REL_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'Partner', label: 'Partner / spouse' },
  { value: 'Sibling', label: 'Sibling' },
  { value: 'Professional adviser', label: 'Professional adviser' },
  { value: 'Solicitor', label: 'Solicitor' },
  { value: 'Accountant', label: 'Accountant' },
  { value: 'Business partner', label: 'Business partner' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other', label: 'Other' },
];

function stripGuidedTrusteeRows(data) {
  if (!Array.isArray(data)) return [];
  return data.filter((x) => x && typeof x === 'object' && !x._businessGuidedCapture);
}

function buildGuidedTrusteeRow(v, recordId) {
  const firstName = String(v.businessSeparateTrusteeFirstName ?? '').trim();
  const lastName = String(v.businessSeparateTrusteeLastName ?? '').trim();
  const address1 = String(v.businessSeparateTrusteeAddress1 ?? '').trim();
  const town = String(v.businessSeparateTrusteeTown ?? '').trim();
  const postcode = String(v.businessSeparateTrusteePostcode ?? '').trim();
  if (!firstName || !lastName || !address1 || !town || !postcode) return null;
  const rid = String(recordId || v.businessSeparateTrusteeRecordId || '').trim() || 'biz-trustee-guided';
  return {
    title: '',
    firstName,
    middleName: '',
    lastName,
    email: String(v.businessSeparateTrusteeEmail ?? '').trim(),
    relationship: String(v.businessSeparateTrusteeRelationship ?? '').trim(),
    address1,
    address2: '',
    address3: town,
    postcode,
    gender: '',
    dateOfBirth: '',
    occupation: '',
    mobile: '',
    _businessGuidedCapture: true,
    _personRecordId: rid,
  };
}

function reconcileSeparateTrustees(prevList, appointYes, guidedRow) {
  const base = stripGuidedTrusteeRows(prevList);
  if (appointYes !== 'Yes') return base;
  if (guidedRow) return [...base, guidedRow];
  return base;
}

function trimVal(v) {
  if (v == null) return '';
  return String(v).trim();
}

/** Map a contact-candidate record into the guided separate trustee text fields. */
function mapContactToBusinessTrusteeFields(c) {
  const d = c?.data;
  if (!d || typeof d !== 'object') return null;
  let firstName = trimVal(d.firstName);
  let lastName = trimVal(d.lastName);
  if (!firstName && !lastName) {
    const full = trimVal(d.fullName) || personDisplayNameForGift(d);
    if (full) {
      const parts = full.split(/\s+/).filter(Boolean);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }
  const townish =
    trimVal(d.address3) || trimVal(d.city) || trimVal(d.town) || trimVal(d.address2);

  return {
    businessSeparateTrusteeFirstName: firstName,
    businessSeparateTrusteeLastName: lastName,
    businessSeparateTrusteeEmail: trimVal(d.email),
    businessSeparateTrusteeAddress1: trimVal(d.address1),
    businessSeparateTrusteeTown: townish,
    businessSeparateTrusteePostcode: trimVal(d.postcode),
  };
}

/** Full snapshot for cancel / edit-entry in the separate business trustee modal */
function getTrusteeModalSnapshot(v) {
  if (!v || typeof v !== 'object') return null;
  const rows = v.separateTrusteeData;
  const separateTrusteeData = Array.isArray(rows) ? rows.map((row) => (row && typeof row === 'object' ? { ...row } : row)) : rows;
  return {
    appointSeparateBusinessTrustee: v.appointSeparateBusinessTrustee,
    businessSeparateTrusteeFirstName: v.businessSeparateTrusteeFirstName ?? '',
    businessSeparateTrusteeLastName: v.businessSeparateTrusteeLastName ?? '',
    businessSeparateTrusteeRelationship: v.businessSeparateTrusteeRelationship ?? '',
    businessSeparateTrusteeEmail: v.businessSeparateTrusteeEmail ?? '',
    businessSeparateTrusteeAddress1: v.businessSeparateTrusteeAddress1 ?? '',
    businessSeparateTrusteeTown: v.businessSeparateTrusteeTown ?? '',
    businessSeparateTrusteePostcode: v.businessSeparateTrusteePostcode ?? '',
    businessSeparateTrusteeRecordId: v.businessSeparateTrusteeRecordId ?? '',
    separateTrusteeData,
  };
}

function businessTrusteeSummary(v) {
  const fn = trimVal(v?.businessSeparateTrusteeFirstName);
  const ln = trimVal(v?.businessSeparateTrusteeLastName);
  const a1 = trimVal(v?.businessSeparateTrusteeAddress1);
  const town = trimVal(v?.businessSeparateTrusteeTown);
  const pc = trimVal(v?.businessSeparateTrusteePostcode);
  const name = [fn, ln].filter(Boolean).join(' ').trim() || '';
  const addr = [a1, town, pc].filter(Boolean).join(', ');
  const complete = !!(fn && ln && a1 && town && pc);
  return { name, addr, complete };
}

function mapRelationshipToTrusteeSelect(rel) {
  const r = (rel || '').toLowerCase();
  if (!r) return '';
  for (const o of TRUSTEE_REL_OPTIONS) {
    if (!o.value) continue;
    if (r.includes(o.value.toLowerCase())) return o.value;
  }
  if (r.includes('spouse') || r.includes('partner') || r.includes('wife') || r.includes('husband')) return 'Partner';
  if (r.includes('sibling') || r.includes('brother') || r.includes('sister')) return 'Sibling';
  if (r.includes('solicitor')) return 'Solicitor';
  if (r.includes('accountant')) return 'Accountant';
  if (r.includes('friend')) return 'Friend';
  if (r.includes('professional')) return 'Professional adviser';
  if (r.includes('business') && r.includes('partner')) return 'Business partner';
  return 'Other';
}

function mapBizTypeToLegacy(bizType) {
  const t = String(bizType || '').trim();
  if (!t) return '';
  if (t === 'director_only') return 'directorship';
  if (t === 'sole_trader') return 'sole-trader';
  if (t === 'partnership' || t === 'llp') return 'partnership';
  if (t === 'shares_majority' || t === 'shares_minority' || t === 'aim' || t === 'family_company') return 'ltd-shares';
  return 'unsure';
}

function mapBizValueToLegacy(bizValue) {
  const v = String(bizValue || '').trim();
  const m = {
    under100k: 'under-50k',
    '100to250k': '50k-250k',
    '250to500k': '250k-1m',
    '500kto1m': '250k-1m',
    over1m: 'over-1m',
    unsure: 'unknown',
  };
  return m[v] || '';
}

/** Seed biz_* from legacy intake fields when upgrading older saves */
function mapLegacyInterestTypeToBizType(lt) {
  switch (String(lt || '').trim()) {
    case 'ltd-shares':
      return 'shares_minority';
    case 'directorship':
      return 'director_only';
    case 'sole-trader':
      return 'sole_trader';
    case 'partnership':
      return 'partnership';
    case 'multiple':
      return 'other';
    case 'unsure':
      return 'other';
    default:
      return '';
  }
}

function mapLegacyValueRangeToBizValue(lv) {
  switch (String(lv || '').trim()) {
    case 'under-50k':
      return 'under100k';
    case '50k-250k':
      return '100to250k';
    case '250k-1m':
      return '250to500k';
    case 'over-1m':
      return 'over1m';
    case 'unknown':
      return 'unsure';
    default:
      return '';
  }
}

function syncBusinessInterestLegacy(prev) {
  const next = { ...prev };
  const gw = next.biz_has_interests;
  if (gw === 'no') {
    next.hasBusinessInterests = 'No';
  } else if (gw === 'yes' || gw === 'unsure') {
    next.hasBusinessInterests = 'Yes';
  }

  const btc = next.biz_trustees_continue;
  if (btc === 'yes') next.trusteePowerCarryOnBusiness = 'Yes';
  else if (btc === 'no') next.trusteePowerCarryOnBusiness = 'No';
  else if (btc === 'discuss') next.trusteePowerCarryOnBusiness = 'Unsure';

  const st = next.biz_separate_trustee;
  if (st === 'yes') next.appointSeparateBusinessTrustee = 'Yes';
  else if (st === 'no') next.appointSeparateBusinessTrustee = 'No';
  else if (st === 'discuss') next.appointSeparateBusinessTrustee = 'Unsure';

  const ag = next.biz_agreement;
  if (ag === 'yes') next.shareholderAgreementInPlace = 'Yes';
  else if (ag === 'no') next.shareholderAgreementInPlace = 'No';
  else if (ag === 'unsure') next.shareholderAgreementInPlace = 'Unsure';

  if (next.biz_type != null && String(next.biz_type).trim() !== '') {
    next.businessInterestType = mapBizTypeToLegacy(next.biz_type);
  }
  if (next.biz_value != null && String(next.biz_value).trim() !== '') {
    next.businessInterestValueRange = mapBizValueToLegacy(next.biz_value);
  }

  return next;
}

const CLEAR_CLIENT_BIZ = {
  biz_type: '',
  biz_ownership_pct: '',
  biz_ownership_sole: '',
  biz_duration: '',
  biz_value: '',
  biz_agreement: '',
  biz_nature: '',
  biz_trustees_continue: '',
  biz_beneficiaries: '',
  biz_separate_trustee: '',
  biz_fallback: '',
  biz_notes: '',
  businessInterestType: '',
  businessInterestValueRange: '',
  shareholderAgreementInPlace: '',
  trusteePowerCarryOnBusiness: '',
  appointSeparateBusinessTrustee: '',
  businessSeparateTrusteeFirstName: '',
  businessSeparateTrusteeLastName: '',
  businessSeparateTrusteeRelationship: '',
  businessSeparateTrusteeEmail: '',
  businessSeparateTrusteeAddress1: '',
  businessSeparateTrusteeTown: '',
  businessSeparateTrusteePostcode: '',
  businessSeparateTrusteeRecordId: '',
  bprTrustClientIntent: '',
};

const DEFAULT_BIZ_OPEN = {
  biz_ownership_pct: '100',
  biz_ownership_sole: 'sole',
  biz_duration: 'over2',
  biz_agreement: 'yes',
  biz_nature: 'trading',
  biz_trustees_continue: 'yes',
  biz_beneficiaries: 'children',
  biz_separate_trustee: 'no',
  biz_fallback: 'residue',
};

const trusteeOnlyClears = {
  businessSeparateTrusteeFirstName: '',
  businessSeparateTrusteeLastName: '',
  businessSeparateTrusteeRelationship: '',
  businessSeparateTrusteeEmail: '',
  businessSeparateTrusteeAddress1: '',
  businessSeparateTrusteeTown: '',
  businessSeparateTrusteePostcode: '',
  businessSeparateTrusteeRecordId: '',
};

const DURATION_FEEDBACK = {
  over2: {
    box: 'rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100',
    text: 'Good — 2+ years owned meets the Business Property Relief minimum period.',
  },
  '1to2': {
    box: 'rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100',
    text: 'Note: approaching the 2-year minimum. Your solicitor will flag this for monitoring.',
  },
  under1: {
    box: 'rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100',
    text: 'Note: less than 1 year owned — BPR may not apply yet. Your solicitor will advise on alternatives.',
  },
  unsure: {
    box: 'rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100',
    text: 'Your solicitor will check the ownership date and advise.',
  },
};

/** @param {{ field?: object, formValues: object, setFormValues: Function }} props */
export default function BusinessInterestsGuided({ field: _field, formValues, setFormValues }) {
  const uid = useId();
  const modalTitleId = useId();
  const recordIdRef = useRef(formValues.businessSeparateTrusteeRecordId || null);
  const preTrusteeModalRef = useRef(null);
  const bizDetailsRef = useRef(null);
  const migratedBizGatewayRef = useRef(false);
  const [businessTrusteePickId, setBusinessTrusteePickId] = useState('');
  const [trusteeModalOpen, setTrusteeModalOpen] = useState(false);
  const [trusteeModalError, setTrusteeModalError] = useState('');

  const idFirst = `ari-trustee-firstname-${uid}`;
  const idLast = `ari-trustee-lastname-${uid}`;
  const idEmail = `ari-trustee-email-${uid}`;
  const idAddr = `ari-trustee-addr-${uid}`;
  const idTown = `ari-trustee-town-${uid}`;
  const idPc = `ari-trustee-pc-${uid}`;

  const gwStored = formValues.biz_has_interests;
  const legacyH = normalizeYesNoUnsure(formValues.hasBusinessInterests);
  const effectiveGw =
    gwStored === 'yes' || gwStored === 'no' || gwStored === 'unsure'
      ? gwStored
      : legacyH === 'Yes'
        ? 'yes'
        : legacyH === 'No'
          ? 'no'
          : legacyH === 'Unsure'
            ? 'unsure'
            : '';

  const showDetails = effectiveGw === 'yes' || effectiveGw === 'unsure';
  const showTrusteeForm = showDetails && formValues.appointSeparateBusinessTrustee === 'Yes';

  const peopleEntriesCount = useMemo(() => getFormPeopleEntries(formValues || {}).length, [formValues]);

  const businessTrusteeContactOptions = useMemo(
    () => getContactCandidates(formValues || {}),
    [formValues]
  );

  const syncTrusteeIntoState = (base) => {
    const appoint = base.appointSeparateBusinessTrustee;
    if (appoint !== 'Yes') {
      return {
        ...base,
        separateTrusteeData: stripGuidedTrusteeRows(base.separateTrusteeData),
      };
    }
    if (!recordIdRef.current) {
      recordIdRef.current = `biz-trustee-${Math.random().toString(36).slice(2, 11)}`;
    }
    const rid = recordIdRef.current;
    const row = buildGuidedTrusteeRow({ ...base, businessSeparateTrusteeRecordId: rid }, rid);
    return {
      ...base,
      businessSeparateTrusteeRecordId: rid,
      separateTrusteeData: reconcileSeparateTrustees(base.separateTrusteeData, 'Yes', row),
    };
  };

  const applyPatch = useCallback(
    (updater) => {
      setFormValues((prev) => {
        const draft = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater };
        const mapped = syncBusinessInterestLegacy(draft);
        return syncTrusteeIntoState(mapped);
      });
    },
    [setFormValues]
  );

  useLayoutEffect(() => {
    if (migratedBizGatewayRef.current) return;
    const hasBiz = gwStored === 'yes' || gwStored === 'no' || gwStored === 'unsure';
    if (hasBiz) {
      migratedBizGatewayRef.current = true;
      return;
    }
    const h = normalizeYesNoUnsure(formValues.hasBusinessInterests);
    if (!h) return;
    migratedBizGatewayRef.current = true;
    const gw = h === 'Yes' ? 'yes' : h === 'No' ? 'no' : 'unsure';
    const patch = { biz_has_interests: gw };
    if (gw === 'yes' || gw === 'unsure') {
      Object.assign(patch, DEFAULT_BIZ_OPEN);
      const lt = formValues.businessInterestType;
      if (lt && !formValues.biz_type) {
        const mappedType = mapLegacyInterestTypeToBizType(lt);
        if (mappedType) patch.biz_type = mappedType;
      }
      const lr = formValues.businessInterestValueRange;
      if (lr && !formValues.biz_value) {
        const mappedVal = mapLegacyValueRangeToBizValue(lr);
        if (mappedVal) patch.biz_value = mappedVal;
      }
      const sha = formValues.shareholderAgreementInPlace;
      if ((sha === 'Yes' || sha === 'No' || sha === 'Unsure') && !formValues.biz_agreement) {
        patch.biz_agreement = sha === 'Yes' ? 'yes' : sha === 'No' ? 'no' : 'unsure';
      }
      const tcp = formValues.trusteePowerCarryOnBusiness;
      if ((tcp === 'Yes' || tcp === 'No' || tcp === 'Unsure') && !formValues.biz_trustees_continue) {
        patch.biz_trustees_continue = tcp === 'Yes' ? 'yes' : tcp === 'No' ? 'no' : 'discuss';
      }
      const asp = formValues.appointSeparateBusinessTrustee;
      if ((asp === 'Yes' || asp === 'No' || asp === 'Unsure') && !formValues.biz_separate_trustee) {
        patch.biz_separate_trustee = asp === 'Yes' ? 'yes' : asp === 'No' ? 'no' : 'discuss';
      }
    }
    applyPatch(patch);
  }, [applyPatch, formValues.hasBusinessInterests, gwStored]);

  const setGateway = (val) => {
    recordIdRef.current = null;
    setBusinessTrusteePickId('');
    if (val === 'no') {
      setTrusteeModalOpen(false);
      setTrusteeModalError('');
      applyPatch((prev) => {
        const next = {
          ...prev,
          biz_has_interests: 'no',
          ...CLEAR_CLIENT_BIZ,
          separateTrusteeData: stripGuidedTrusteeRows(prev.separateTrusteeData),
        };
        delete next.includeBPRTrust;
        return next;
      });
      return;
    }
    applyPatch((prev) => {
      const wasClosed =
        prev.biz_has_interests === 'no' ||
        prev.biz_has_interests == null ||
        prev.biz_has_interests === '' ||
        normalizeYesNoUnsure(prev.hasBusinessInterests) === 'No';
      let next = { ...prev, biz_has_interests: val };
      delete next.includeBPRTrust;
      if (wasClosed) {
        next = { ...next, ...CLEAR_CLIENT_BIZ, ...DEFAULT_BIZ_OPEN };
      }
      return next;
    });
  };

  const setSeparateTrusteeChoice = (raw) => {
    const mapped = raw === 'yes' ? 'yes' : raw === 'no' ? 'no' : 'discuss';
    if (mapped !== 'yes') {
      setBusinessTrusteePickId('');
      setTrusteeModalOpen(false);
      setTrusteeModalError('');
      preTrusteeModalRef.current = null;
      recordIdRef.current = null;
      applyPatch((prev) => ({
        ...prev,
        biz_separate_trustee: mapped,
        ...trusteeOnlyClears,
        separateTrusteeData: stripGuidedTrusteeRows(prev.separateTrusteeData),
      }));
      return;
    }
    applyPatch((prev) => {
      preTrusteeModalRef.current = getTrusteeModalSnapshot(prev);
      return { ...prev, biz_separate_trustee: 'yes' };
    });
    setTrusteeModalError('');
    setBusinessTrusteePickId('');
    setTrusteeModalOpen(true);
  };

  const openTrusteeModalForEdit = useCallback(() => {
    preTrusteeModalRef.current = getTrusteeModalSnapshot(formValues);
    setTrusteeModalError('');
    setTrusteeModalOpen(true);
  }, [formValues]);

  const cancelTrusteeModal = useCallback(() => {
    const snap = preTrusteeModalRef.current;
    if (snap) {
      applyPatch((prev) => ({
        ...prev,
        ...snap,
        separateTrusteeData: snap.separateTrusteeData,
      }));
      recordIdRef.current = snap.businessSeparateTrusteeRecordId || null;
    }
    preTrusteeModalRef.current = null;
    setTrusteeModalError('');
    setBusinessTrusteePickId('');
    setTrusteeModalOpen(false);
  }, [applyPatch]);

  const saveTrusteeModal = useCallback(() => {
    const rid = formValues.businessSeparateTrusteeRecordId || recordIdRef.current;
    const row = buildGuidedTrusteeRow({ ...formValues, businessSeparateTrusteeRecordId: rid }, rid);
    if (!row) {
      setTrusteeModalError('Please enter first name, last name, address line 1, town and postcode.');
      return;
    }
    applyPatch((prev) => ({ ...prev }));
    preTrusteeModalRef.current = null;
    setTrusteeModalError('');
    setTrusteeModalOpen(false);
  }, [applyPatch, formValues]);

  useEffect(() => {
    if (formValues.appointSeparateBusinessTrustee !== 'Yes') {
      setTrusteeModalOpen(false);
      setTrusteeModalError('');
    }
  }, [formValues.appointSeparateBusinessTrustee]);

  useEffect(() => {
    if (!trusteeModalOpen || typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [trusteeModalOpen]);

  const wasShowingBizDetails = useRef(false);
  useEffect(() => {
    if (showDetails && !wasShowingBizDetails.current) {
      requestAnimationFrame(() => {
        bizDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    wasShowingBizDetails.current = showDetails;
  }, [showDetails]);

  const onDetailChange = (key, value) => {
    applyPatch({ [key]: value });
  };

  const applyBusinessTrusteeFromContact = (id) => {
    setBusinessTrusteePickId(id);
    if (!id) return;
    const c = businessTrusteeContactOptions.find((x) => x.id === id);
    if (!c) return;
    const mapped = mapContactToBusinessTrusteeFields(c);
    if (!mapped) return;
    const rel = mapRelationshipToTrusteeSelect(c.data?.relationship);
    applyPatch((prev) => {
      const next = {
        ...prev,
        ...mapped,
        businessSeparateTrusteeRelationship: rel || prev.businessSeparateTrusteeRelationship,
      };
      if (next.appointSeparateBusinessTrustee !== 'Yes') return next;
      return syncTrusteeIntoState(next);
    });
  };

  const onTrusteeFieldChange = (key, value) => {
    setBusinessTrusteePickId('');
    applyPatch((prev) => {
      const draft = { ...prev, [key]: value };
      if (draft.appointSeparateBusinessTrustee !== 'Yes') return draft;
      return syncTrusteeIntoState(draft);
    });
  };

  const trusteeSummary = useMemo(() => businessTrusteeSummary(formValues), [formValues]);

  const radioGateway = {
    no: effectiveGw === 'no',
    yes: effectiveGw === 'yes',
    unsure: effectiveGw === 'unsure',
  };

  const dur = formValues.biz_duration || 'over2';
  const durFb = DURATION_FEEDBACK[dur] || DURATION_FEEDBACK.over2;

  const showDirectorNote = formValues.biz_type === 'director_only';
  const showAgreementFlag = formValues.biz_agreement === 'yes';

  const pillBase =
    'inline-flex min-h-[44px] items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-900';
  const pillOff =
    'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-indigo-500';
  const pillOn =
    'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/50 dark:text-indigo-100';

  return (
    <div className="ari-wrap min-w-0">
      <div className="ari-q-header">
        <div className="ari-badge-sm" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <h3>Do you have any ownership or involvement in a business?</h3>
      </div>

      <div className="ari-why">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>
          WHY WE ASK: If you own part of a business, it can be one of the most valuable things you leave behind — and one of
          the most complicated to handle without proper planning. Telling us now means your solicitor can make sure your will
          protects it correctly.
        </p>
      </div>

      <p className="ari-helper break-words">
        Answer yes if any of the following apply — even if the business is small, dormant, or you&apos;re no longer actively
        involved:
      </p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/80">
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">Shares in a limited company</p>
          <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">Even a small percentage counts</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/80">
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">Sole trader or self-employed</p>
          <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">Any self-employed income or trading</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/80">
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">Business partnership</p>
          <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">LLP or traditional partnership</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/80">
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">Director of a company</p>
          <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">Including family or dormant companies</p>
        </div>
      </div>

      <p className="ari-hint">
        Not sure? Select &quot;I&apos;m not sure&quot; and your solicitor will help you work it out.
      </p>

      <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Business interests gateway">
        <label className="ari-radio-opt" htmlFor={`ari-biz-no-${uid}`}>
          <input id={`ari-biz-no-${uid}`} type="radio" name={`ari-biz-gw-${uid}`} checked={radioGateway.no} onChange={() => setGateway('no')} />
          <div>
            <div className="ari-opt-label">No, I don&apos;t have any business interests</div>
            <div className="ari-opt-sub">I&apos;m not a business owner, shareholder, partner, or company director</div>
          </div>
        </label>
        <label className="ari-radio-opt" htmlFor={`ari-biz-yes-${uid}`}>
          <input id={`ari-biz-yes-${uid}`} type="radio" name={`ari-biz-gw-${uid}`} checked={radioGateway.yes} onChange={() => setGateway('yes')} />
          <div>
            <div className="ari-opt-label">Yes, I own or have an interest in a business</div>
            <div className="ari-opt-sub">I&apos;ll provide a few details so my solicitor can advise properly</div>
          </div>
        </label>
        <label className="ari-radio-opt" htmlFor={`ari-biz-unsure-${uid}`}>
          <input id={`ari-biz-unsure-${uid}`} type="radio" name={`ari-biz-gw-${uid}`} checked={radioGateway.unsure} onChange={() => setGateway('unsure')} />
          <div>
            <div className="ari-opt-label">I&apos;m not sure</div>
            <div className="ari-opt-sub">My solicitor will check this with me before the will is drafted</div>
          </div>
        </label>
      </div>

      {showDetails ? (
        <div id="ari-biz-details" ref={bizDetailsRef} className="min-w-0 space-y-6 pt-2">
          <div className="ari-callout">
            <p>
              <strong>A few quick details about your business.</strong> Don&apos;t worry about being exact — your solicitor will
              go through this with you. These answers help them prepare before your appointment.
            </p>
          </div>

          <p className="ari-hint break-words text-sm" role="status">
            People you have already added elsewhere on this will (for example executors and beneficiaries) are listed in the
            summary <strong>at the top of the page</strong>
            {peopleEntriesCount > 0 ? ` — we can see ${peopleEntriesCount} on your form.` : '.'}{' '}
            If you choose a <strong>separate business trustee</strong> below, you can pick someone from that list using
            &quot;choose from contacts you&apos;ve already entered&quot; in the form that opens.
          </p>

          {/* Q2 type */}
          <div className="ari-field">
            <label className="ari-label" htmlFor={`ari-biz-type-${uid}`}>
              What type of business interest is it?
            </label>
            <select
              id={`ari-biz-type-${uid}`}
              className="ari-select"
              value={formValues.biz_type || ''}
              onChange={(e) => onDetailChange('biz_type', e.target.value)}
            >
              <option value="">Select the closest option...</option>
              <option value="shares_majority">Shares in a limited company — majority owner (over 50%)</option>
              <option value="shares_minority">Shares in a limited company — minority stake (under 50%)</option>
              <option value="director_only">Directorship only — no share ownership</option>
              <option value="sole_trader">Sole trader or self-employed</option>
              <option value="partnership">Business partnership (traditional)</option>
              <option value="llp">LLP interest</option>
              <option value="aim">AIM-listed shares or EIS investments</option>
              <option value="family_company">Family company (including dormant)</option>
              <option value="other">Other — I&apos;ll explain to my solicitor</option>
            </select>
            {showDirectorNote ? (
              <div
                className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100"
                role="status"
              >
                A directorship without share ownership cannot benefit from Business Property Relief. Your solicitor will advise
                on how to handle this in your will.
              </div>
            ) : null}
          </div>

          <hr className="ari-sep" />

          {/* Q3 ownership */}
          <div className="space-y-3">
            <div>
              <span className="ari-label">
                Roughly what percentage of the business do you own?{' '}
                <span className="ml-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                  New
                </span>
              </span>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                Your best estimate is fine — this helps your solicitor check whether full or partial tax relief applies.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: '100', label: '100% — I own it entirely' },
                { id: 'majority', label: 'More than 50%' },
                { id: '25to50', label: '25% to 50%' },
                { id: 'under25', label: 'Under 25%' },
                { id: 'unsure', label: 'Not sure' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${pillBase} ${(formValues.biz_ownership_pct || '100') === p.id ? pillOn : pillOff}`}
                  onClick={() => onDetailChange('biz_ownership_pct', p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <span className="ari-label">Is the ownership in your name alone, or jointly with someone?</span>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'sole', label: 'In my name alone' },
                { id: 'spouse', label: 'Jointly with my spouse or partner' },
                { id: 'partners', label: 'Jointly with business partners' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${pillBase} ${(formValues.biz_ownership_sole || 'sole') === p.id ? pillOn : pillOff}`}
                  onClick={() => onDetailChange('biz_ownership_sole', p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="ari-sep" />

          {/* Q4 duration */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="ari-label m-0">
                How long have you owned this business interest?{' '}
                <span className="ml-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                  New
                </span>
              </span>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 dark:border-indigo-500/30 dark:bg-slate-800">
              <p className="m-0 text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                Why this matters
              </p>
              <p className="m-0 mt-1 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                Business Property Relief generally requires the asset to have been owned for at least 2 years. Your solicitor
                needs to know this so they can plan accordingly.
              </p>
            </div>
            <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="How long owned">
              {[
                { id: 'over2', title: 'More than 2 years', sub: 'Comfortably meets the minimum ownership period' },
                { id: '1to2', title: 'Between 1 and 2 years', sub: 'Approaching the minimum — your solicitor will monitor this' },
                { id: 'under1', title: 'Less than 1 year — recently acquired', sub: 'Relief may not apply yet — your solicitor will advise' },
                { id: 'unsure', title: 'Not sure — I\'ll check', sub: '' },
              ].map((o) => (
                <label key={o.id} className="ari-radio-opt" htmlFor={`ari-dur-${o.id}-${uid}`}>
                  <input
                    id={`ari-dur-${o.id}-${uid}`}
                    type="radio"
                    name={`ari-dur-${uid}`}
                    checked={(formValues.biz_duration || 'over2') === o.id}
                    onChange={() => onDetailChange('biz_duration', o.id)}
                  />
                  <div>
                    <div className="ari-opt-label">{o.title}</div>
                    {o.sub ? <div className="ari-opt-sub">{o.sub}</div> : null}
                  </div>
                </label>
              ))}
            </div>
            <div className={durFb.box} role="status">
              {durFb.text}
            </div>
          </div>

          <hr className="ari-sep" />

          {/* Q5 value */}
          <div className="ari-field">
            <label className="ari-label" htmlFor={`ari-biz-value-${uid}`}>
              Roughly what is your share worth?
            </label>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Helps your solicitor check whether Business Property Relief could reduce inheritance tax. An estimate is fine.
            </p>
            <select
              id={`ari-biz-value-${uid}`}
              className="ari-select"
              value={formValues.biz_value || ''}
              onChange={(e) => onDetailChange('biz_value', e.target.value)}
            >
              <option value="">Select approximate value...</option>
              <option value="under100k">Under £100,000</option>
              <option value="100to250k">£100,000 to £250,000</option>
              <option value="250to500k">£250,000 to £500,000</option>
              <option value="500kto1m">£500,000 to £1 million</option>
              <option value="over1m">Over £1 million</option>
              <option value="unsure">Not sure — I&apos;d need a formal valuation</option>
            </select>
          </div>

          <hr className="ari-sep" />

          {/* Q6 agreement */}
          <div className="space-y-2">
            <span className="ari-label">Is there a shareholder or partnership agreement in place?</span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              These agreements sometimes restrict who you can leave your shares to — your solicitor needs to review them.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'yes', label: 'Yes' },
                { id: 'no', label: 'No' },
                { id: 'unsure', label: 'Not sure' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${pillBase} ${(formValues.biz_agreement || 'yes') === p.id ? pillOn : pillOff}`}
                  onClick={() => onDetailChange('biz_agreement', p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {showAgreementFlag ? (
              <div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
                <span className="shrink-0 font-bold">!</span>
                <span>
                  Solicitor flag: Agreement exists — review for pre-emption rights or restrictions on transfer before drafting.
                </span>
              </div>
            ) : null}
          </div>

          <hr className="ari-sep" />

          {/* Q7 nature */}
          <div className="space-y-3">
            <div className="ari-q-header">
              <div className="ari-badge-sm" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <h3 className="m-0 text-base font-bold sm:text-lg">
                  What does the business mainly do?{' '}
                  <span className="align-middle text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    New
                  </span>
                </h3>
                <p className="ari-why m-0 mt-1 border-0 p-0 text-sm leading-relaxed">
                  WHY WE ASK: This is one of the most important tests for whether Business Property Relief applies. A business
                  that mainly sells products or services usually qualifies. One that mainly holds property or investments may
                  not. Your best understanding is enough — your solicitor will verify.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/80">
                <p className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">Say &quot;mainly trading&quot; if...</p>
                <p className="m-0 mt-2 text-xs text-slate-700 dark:text-slate-300">✓ It sells products or services to customers</p>
                <p className="m-0 mt-1 text-xs text-slate-700 dark:text-slate-300">✓ It employs staff or has active contracts</p>
                <p className="m-0 mt-1 text-xs text-slate-700 dark:text-slate-300">✓ You or others actively work in it</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/80">
                <p className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">Say &quot;mainly investment&quot; if...</p>
                <p className="m-0 mt-2 text-xs text-slate-700 dark:text-slate-300">✗ It mainly holds property it lets out to others</p>
                <p className="m-0 mt-1 text-xs text-slate-700 dark:text-slate-300">✗ It mainly holds stocks, shares, or cash</p>
                <p className="m-0 mt-1 text-xs text-slate-700 dark:text-slate-300">✗ It doesn&apos;t actively trade — it just holds assets</p>
              </div>
            </div>
            <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Trading or investment nature">
              {[
                { id: 'trading', title: 'Mainly trading — sells products or services', sub: 'Most likely to qualify for Business Property Relief' },
                { id: 'mixed', title: 'Mixed — trading but also holds some property or investments', sub: 'Partial relief may apply — your solicitor will check the split' },
                { id: 'investment', title: 'Mainly investment or property holding', sub: 'Relief may not apply — your solicitor will advise on alternatives' },
                { id: 'unsure', title: 'Not sure', sub: 'Your solicitor will review the business structure and advise' },
              ].map((o) => (
                <label key={o.id} className="ari-radio-opt" htmlFor={`ari-nat-${o.id}-${uid}`}>
                  <input
                    id={`ari-nat-${o.id}-${uid}`}
                    type="radio"
                    name={`ari-nat-${uid}`}
                    checked={(formValues.biz_nature || 'trading') === o.id}
                    onChange={() => onDetailChange('biz_nature', o.id)}
                  />
                  <div>
                    <div className="ari-opt-label">{o.title}</div>
                    <div className="ari-opt-sub">{o.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <hr className="ari-sep" />

          {/* Q8 trustees continue */}
          <div className="ari-q-header">
            <div className="ari-badge-sm" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h3>Should your trustees be allowed to keep running your business after you die?</h3>
          </div>
          <div className="ari-why">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>
              WHY WE ASK: By default, trustees must wind down a business as quickly as possible after someone dies. If you&apos;d
              like them to have the option to continue running it — to protect its value, find a buyer, or keep it going for your
              family — you need to say so here.
            </p>
          </div>
          <div className="ari-guidance">
            <div className="ari-guidance-box">
              <p className="ari-g-title">Say yes if...</p>
              <p className="ari-g-item">✓ You own a trading business with staff or contracts</p>
              <p className="ari-g-item">✓ Your family depends on the income it generates</p>
              <p className="ari-g-item">✓ A forced quick sale would significantly reduce its value</p>
            </div>
            <div className="ari-guidance-box">
              <p className="ari-g-title">Say no if...</p>
              <p className="ari-g-item">✗ You hold shares passively as an investor</p>
              <p className="ari-g-item">✗ The business would naturally end when you&apos;re gone (e.g. sole trader, no staff)</p>
            </div>
          </div>
          <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Trustees carry on business">
            {[
              { id: 'no', title: 'No — wind it down as usual', sub: 'My trustees should close or sell the business in the normal way' },
              { id: 'yes', title: 'Yes — give my trustees the power to keep it running', sub: 'They can continue operating the business while deciding the best course of action' },
              { id: 'discuss', title: 'I\'m not sure — I\'d like to discuss this with my solicitor', sub: 'We\'ll flag this for review before your will is drafted' },
            ].map((o) => (
              <label key={o.id} className="ari-radio-opt" htmlFor={`ari-carry-${o.id}-${uid}`}>
                <input
                  id={`ari-carry-${o.id}-${uid}`}
                  type="radio"
                  name={`ari-carry-${uid}`}
                  checked={(formValues.biz_trustees_continue || 'yes') === o.id}
                  onChange={() => onDetailChange('biz_trustees_continue', o.id)}
                />
                <div>
                  <div className="ari-opt-label">{o.title}</div>
                  <div className="ari-opt-sub">{o.sub}</div>
                </div>
              </label>
            ))}
          </div>

          <hr className="ari-sep" />

          {/* Q9 beneficiaries */}
          <div className="space-y-2">
            <span className="ari-label">
              Who should ultimately benefit from your business interest after you die?{' '}
              <span className="ml-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                New
              </span>
            </span>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This tells your solicitor who the beneficiaries of any trust or clause should be. You can specify exact shares at
              your appointment.
            </p>
            <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Business beneficiaries">
              {[
                { id: 'children', title: 'My children', sub: 'Equally between them, or in proportions I\'ll specify at my appointment' },
                { id: 'spouse_children', title: 'My spouse or partner first, then my children', sub: 'Spouse has use during their lifetime, children inherit on second death' },
                { id: 'named', title: 'Specific named people — I\'ll confirm at my appointment', sub: '' },
                { id: 'discuss', title: 'I\'m not sure yet — I\'d like to discuss this', sub: '' },
              ].map((o) => (
                <label key={o.id} className="ari-radio-opt" htmlFor={`ari-ben-${o.id}-${uid}`}>
                  <input
                    id={`ari-ben-${o.id}-${uid}`}
                    type="radio"
                    name={`ari-ben-${uid}`}
                    checked={(formValues.biz_beneficiaries || 'children') === o.id}
                    onChange={() => onDetailChange('biz_beneficiaries', o.id)}
                  />
                  <div>
                    <div className="ari-opt-label">{o.title}</div>
                    {o.sub ? <div className="ari-opt-sub">{o.sub}</div> : null}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <hr className="ari-sep" />

          {/* Q10 separate trustee */}
          <div className="ari-q-header">
            <div className="ari-badge-sm" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3>Do you want a separate trustee dedicated to your business?</h3>
          </div>
          <div className="ari-why">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>
              WHY WE ASK: Usually your executors handle everything in your estate, including your business. But if your business
              is complex or valuable, you can appoint a separate person — such as an accountant, solicitor, or business partner —
              to manage only the business side.
            </p>
          </div>
          <div className="ari-guidance ari-guidance-full">
            <div className="ari-guidance-box">
              <p className="ari-g-title">A separate business trustee might make sense if...</p>
              <p className="ari-g-item">✓ Your executors are family members with no business experience</p>
              <p className="ari-g-item">✓ The business has co-owners who need to be involved in decisions</p>
              <p className="ari-g-item">✓ You want a professional (e.g. accountant or solicitor) to manage it</p>
              <p className="ari-g-item">✓ The business is worth significantly more than the rest of your estate</p>
            </div>
          </div>
          <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Separate business trustee">
            {[
              { id: 'no', title: 'No — my executors can handle everything', sub: 'The same people managing my estate will look after the business too' },
              { id: 'yes', title: 'Yes — I want a dedicated trustee for the business', sub: 'A form opens to add their name and address — like your executors' },
              { id: 'discuss', title: 'I\'m not sure — I\'d like my solicitor\'s advice on this', sub: 'We\'ll discuss this before your will is finalised' },
            ].map((o) => (
              <label key={o.id} className="ari-radio-opt" htmlFor={`ari-sep-${o.id}-${uid}`}>
                <input
                  id={`ari-sep-${o.id}-${uid}`}
                  type="radio"
                  name={`ari-sep-${uid}`}
                  checked={(formValues.biz_separate_trustee || 'no') === o.id}
                  onChange={() => setSeparateTrusteeChoice(o.id)}
                />
                <div>
                  <div className="ari-opt-label">{o.title}</div>
                  <div className="ari-opt-sub">{o.sub}</div>
                </div>
              </label>
            ))}
          </div>

          {showTrusteeForm && !trusteeModalOpen ? (
            <div
              id="ari-trustee-summary"
              className="mb-4 flex min-w-0 flex-col gap-3 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-600 dark:bg-slate-900/50"
            >
              <div className="flex min-w-0 flex-1 gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                  <Briefcase className="h-4 w-4 sm:h-[18px] sm:w-[18px]" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="m-0 text-sm font-bold text-indigo-600 dark:text-indigo-400">Separate business trustee</p>
                  {trusteeSummary.complete ? (
                    <>
                      <p className="m-0 mt-0.5 break-words text-base font-semibold text-slate-900 dark:text-slate-100">
                        {trusteeSummary.name}
                      </p>
                      {trusteeSummary.addr ? (
                        <p className="m-0 mt-0.5 break-words text-xs leading-snug text-slate-600 dark:text-slate-300">
                          {trusteeSummary.addr}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="m-0 mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Add their name and address in the form so your will can name them correctly. You can refine this with your
                      solicitor later.
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={openTrusteeModalForEdit}
                className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-auto dark:border-indigo-500/50 dark:bg-indigo-600/30 dark:text-indigo-100 dark:shadow-none dark:hover:bg-indigo-600/50 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-900"
              >
                {trusteeSummary.complete ? (
                  <>
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    Edit
                  </>
                ) : (
                  <>
                    <Briefcase className="h-4 w-4" aria-hidden="true" />
                    Add details
                  </>
                )}
              </button>
            </div>
          ) : null}

          {trusteeModalOpen && typeof document !== 'undefined'
            ? createPortal(
                <div
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
                  role="presentation"
                  onClick={(e) => {
                    if (e.target === e.currentTarget) cancelTrusteeModal();
                  }}
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={modalTitleId}
                    id="ari-trustee-form"
                    className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 pt-5 pb-4 dark:border-white/10">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-300">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p id={modalTitleId} className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">
                            Separate business trustee
                          </p>
                          <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                            Name and address for your will (required fields below)
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-slate-100"
                        aria-label="Close"
                        onClick={cancelTrusteeModal}
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="space-y-4 px-5 py-4">
                      {trusteeModalError ? (
                        <p
                          className="m-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-200"
                          role="alert"
                        >
                          {trusteeModalError}
                        </p>
                      ) : null}

                      <div className="min-w-0">
                        <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={`ari-biz-trustee-pick-${uid}`}>
                          Choose someone you&apos;ve already entered <span className="font-normal text-slate-500 dark:text-slate-500">(optional)</span>
                        </label>
                        <select
                          id={`ari-biz-trustee-pick-${uid}`}
                          className="min-h-[44px] w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                          value={businessTrusteePickId}
                          onChange={(e) => applyBusinessTrusteeFromContact(e.target.value)}
                        >
                          <option value="">— Type details manually below —</option>
                          {businessTrusteeContactOptions.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1.5 m-0 text-xs leading-snug text-slate-500 dark:text-slate-500">
                          {businessTrusteeContactOptions.length > 0
                            ? 'Copies name, email and address when we have them from your form — edit before saving.'
                            : 'Add people elsewhere in the form to pick them here, or type manually below.'}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={idFirst}>
                            First name <span className="text-red-600 dark:text-red-400">*</span>
                          </label>
                          <input
                            id={idFirst}
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                            value={formValues.businessSeparateTrusteeFirstName || ''}
                            onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeFirstName', e.target.value)}
                            autoComplete="given-name"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={idLast}>
                            Last name <span className="text-red-600 dark:text-red-400">*</span>
                          </label>
                          <input
                            id={idLast}
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                            value={formValues.businessSeparateTrusteeLastName || ''}
                            onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeLastName', e.target.value)}
                            autoComplete="family-name"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={`ari-trustee-rel-${uid}`}>
                          Relationship to you
                        </label>
                        <select
                          id={`ari-trustee-rel-${uid}`}
                          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                          value={formValues.businessSeparateTrusteeRelationship || ''}
                          onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeRelationship', e.target.value)}
                        >
                          {TRUSTEE_REL_OPTIONS.map((o) => (
                            <option key={o.value || 'empty'} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={idEmail}>
                          Email <span className="text-slate-500">(optional)</span>
                        </label>
                        <input
                          id={idEmail}
                          type="email"
                          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                          value={formValues.businessSeparateTrusteeEmail || ''}
                          onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeEmail', e.target.value)}
                          autoComplete="email"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={idAddr}>
                          Address line 1 <span className="text-red-600 dark:text-red-400">*</span>
                        </label>
                        <input
                          id={idAddr}
                          className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                          value={formValues.businessSeparateTrusteeAddress1 || ''}
                          onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeAddress1', e.target.value)}
                          autoComplete="street-address"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={idTown}>
                            Town / city <span className="text-red-600 dark:text-red-400">*</span>
                          </label>
                          <input
                            id={idTown}
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                            value={formValues.businessSeparateTrusteeTown || ''}
                            onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeTown', e.target.value)}
                            autoComplete="address-level2"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor={idPc}>
                            Postcode <span className="text-red-600 dark:text-red-400">*</span>
                          </label>
                          <input
                            id={idPc}
                            className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                            value={formValues.businessSeparateTrusteePostcode || ''}
                            onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteePostcode', e.target.value)}
                            autoComplete="postal-code"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={cancelTrusteeModal}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveTrusteeModal}
                        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:hover:bg-indigo-500 dark:focus-visible:ring-offset-slate-900 sm:w-auto"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>,
                document.body
              )
            : null}

          <hr className="ari-sep" />

          {/* Q11 fallback */}
          <div className="space-y-3">
            <div className="ari-q-header">
              <div className="ari-badge-sm" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 14 4 9 9 4" />
                  <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                </svg>
              </div>
              <div>
                <h3 className="m-0 text-base font-bold sm:text-lg">
                  If the business tax relief cannot apply, what should happen to your business interest?{' '}
                  <span className="align-middle text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                    New
                  </span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  WHY WE ASK: Business tax relief is not guaranteed — for example if the business is sold before you die, or its
                  nature changes. Your solicitor needs a backup plan so your will works in every situation.
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <strong className="text-slate-900 dark:text-slate-100">Example.</strong> If you choose &quot;Fall into my residuary
              estate&quot; and the relief doesn&apos;t apply, the business joins the rest of your estate and is divided the same
              way as everything else. If you choose &quot;Still go to the same people,&quot; they inherit it directly — just
              without any trust structure.
            </div>
            <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Fallback if relief cannot apply">
              {[
                {
                  id: 'residue',
                  title: 'Fall into my residuary estate — distribute the same as everything else',
                  sub: 'Simplest option. The business joins the rest of your estate.',
                },
                {
                  id: 'same_people',
                  title: 'Still go to the same people — just without a trust wrapper',
                  sub: 'The beneficiaries I named above receive it directly',
                },
                {
                  id: 'discretionary',
                  title: 'Go into a discretionary trust regardless',
                  sub: 'My solicitor can draft this — I want flexibility whatever happens',
                },
                { id: 'discuss', title: 'I\'m not sure — discuss at my appointment', sub: '' },
              ].map((o) => (
                <label key={o.id} className="ari-radio-opt" htmlFor={`ari-fb-${o.id}-${uid}`}>
                  <input
                    id={`ari-fb-${o.id}-${uid}`}
                    type="radio"
                    name={`ari-fb-${uid}`}
                    checked={(formValues.biz_fallback || 'residue') === o.id}
                    onChange={() => onDetailChange('biz_fallback', o.id)}
                  />
                  <div>
                    <div className="ari-opt-label">{o.title}</div>
                    {o.sub ? <div className="ari-opt-sub">{o.sub}</div> : null}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <hr className="ari-sep" />

          {/* Q12 notes */}
          <div className="ari-field">
            <label className="ari-label" htmlFor={`ari-biz-notes-${uid}`}>
              Anything else your solicitor should know about your business?{' '}
              <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span>
            </label>
            <textarea
              id={`ari-biz-notes-${uid}`}
              className="ari-select min-h-[88px] w-full resize-y py-3 leading-relaxed"
              placeholder="For example: co-owners, buy/sell agreement, sale planned, family members working in the business, or multiple interests..."
              value={formValues.biz_notes || ''}
              onChange={(e) => onDetailChange('biz_notes', e.target.value)}
              rows={4}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
