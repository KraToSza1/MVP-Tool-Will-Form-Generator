/**
 * Property Trust — guided client intake (April 2026).
 * Solicitor completes: propertyTrustDetails, propertyTrustScheduleNumber, propertyTrustTerms.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Check, Home, Info, Plus, X } from 'lucide-react';
import { formatPropertyTrustClientSummaryFromState, getPropertyAddressCandidates } from '../utils/propertyTrustFormat.js';
import { normalizePtReason } from '../lib/propertyTrustGuidedComplete.js';

function uid() {
  return `pt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const TRUST_TYPES = [
  {
    value: 'life-interest',
    title: 'Life interest trust',
    desc: 'Someone can live in or use the property for the rest of their life. After they die, it passes to your chosen beneficiaries. Most common for couples.',
  },
  {
    value: 'discretionary',
    title: 'Discretionary trust',
    desc: 'Trustees manage the property for a group of potential beneficiaries and have discretion over who benefits. Flexible but more complex.',
  },
  {
    value: 'nil-rate-band',
    title: 'Nil-rate band trust',
    desc: "Designed to make use of each spouse's inheritance tax nil-rate band. Often used to shelter assets from care fees or IHT on second death.",
  },
  {
    value: 'not-sure',
    title: "I'm not sure — advise me",
    desc: 'My solicitor will recommend the most appropriate trust type based on my circumstances.',
  },
];

const TENURE_OPTS = [
  { value: '', label: "Not sure / don't know" },
  { value: 'freehold', label: 'Freehold' },
  { value: 'leasehold', label: 'Leasehold' },
  { value: 'commonhold', label: 'Commonhold' },
];

/** Maps guided trust-type card values to PDF-style pt_trust_type */
const PT_TRUST_TYPE_BY_LEGACY = {
  'life-interest': 'life_interest',
  discretionary: 'discretionary',
  'nil-rate-band': 'nrb',
  'not-sure': 'advise',
};

const PT_TENURE_PILLS = [
  { value: 'freehold', label: 'Freehold' },
  { value: 'leasehold', label: 'Leasehold' },
  { value: 'unsure', label: 'Not sure' },
];

const PT_OWNERSHIP_OPTS = [
  {
    value: 'sole_owner',
    title: 'I own it entirely — sole owner',
    hint: 'The whole property can be placed in the trust',
  },
  {
    value: 'tic_50',
    title: 'Tenants in common — 50% share',
    hint: 'Only your share goes into the trust',
  },
  {
    value: 'tic_other',
    title: 'Tenants in common — a different percentage',
    hint: 'You will confirm the exact split with your solicitor',
  },
  {
    value: 'joint_tenants',
    title: 'Joint tenants — I own it jointly',
    hint: 'Your solicitor may need to sever the joint tenancy first — they will advise',
  },
  { value: 'unsure', title: 'Not sure — I’ll check', hint: '' },
];

const PT_RIGHTS_OPTS = [
  {
    value: 'occupy_free',
    title: 'Right to live in the property rent-free for life',
    hint: 'They can live there but not charge rent to others',
  },
  {
    value: 'occupy_or_rent',
    title: 'Right to live there OR let it out and keep the income',
    hint: 'They can choose to rent it out if they prefer',
  },
  {
    value: 'income_only',
    title: 'Right to receive income from the property only',
    hint: 'They do not live there but receive rent or investment income',
  },
  { value: 'discuss', title: 'I’m not sure — discuss with my solicitor', hint: '' },
];

const PT_SALE_OPTS = [
  {
    value: 'trustees_consent_reinvest',
    title: 'Trustees can agree to sell — proceeds held for the life tenant',
    hint: 'They can downsize or move; trust money follows the life tenant',
  },
  {
    value: 'trustees_reinvest_new_property',
    title: 'Trustees can buy a replacement property for the life tenant',
    hint: 'The trust can purchase a new home if they need to move',
  },
  {
    value: 'no_sale_without_all',
    title: 'Property cannot be sold without consent of all trustees and remainder beneficiaries',
    hint: 'More protection for those who ultimately inherit',
  },
  { value: 'discuss', title: 'I’m not sure — my solicitor should advise', hint: '' },
];

const PT_REMAINDER_OPTS = [
  { value: 'children_equally', title: 'My children — equally between them', hint: '' },
  {
    value: 'children_specified',
    title: 'My children — in proportions I’ll specify at my appointment',
    hint: '',
  },
  {
    value: 'named_others',
    title: 'Named individuals — I’ll confirm at my appointment',
    hint: '',
  },
  {
    value: 'residue',
    title: 'To fall into the rest of my estate (residue)',
    hint: 'Divided like the rest of my estate',
  },
  { value: 'discuss', title: 'I’m not sure — discuss at my appointment', hint: '' },
];

const PT_OVER_OPTS = [
  {
    value: 'yes_include',
    title: 'Yes — include overreaching protection so any future sale is straightforward',
    hint: 'Recommended — your solicitor will ensure at least two trustees are appointed',
  },
  { value: 'discuss', title: 'I’m not sure — my solicitor should advise', hint: '' },
];

const PT_REASON_OPTS = [
  {
    value: 'protect_children',
    title: 'Protect my children’s inheritance',
    hint: 'Ensure they receive their share even if my spouse remarries',
  },
  {
    value: 'care_fees',
    title: 'Protect against care home fees',
    hint: 'Shelter the property from local authority means-testing',
  },
  {
    value: 'iht',
    title: 'Reduce inheritance tax',
    hint: 'Use nil-rate band efficiently',
  },
  {
    value: 'family_home',
    title: 'Keep my spouse/partner in the family home',
    hint: 'They can stay while still protecting the children’s share',
  },
];

/** @param {{ field: object, formValues: object, setFormValues: Function }} props */
export default function PropertyTrustGuided({ field: _field, formValues, setFormValues }) {
  const uidStr = useId();
  const modalTitleId = useId();
  const [modalOpen, setModalOpen] = useState(false);
  const [pickPropertyId, setPickPropertyId] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [town, setTown] = useState('');
  const [postcode, setPostcode] = useState('');
  const [tenure, setTenure] = useState('');
  const [errors, setErrors] = useState({});
  const prevOverflow = useRef('');

  const include = formValues.includePropertyTrust;
  const showDetailPanel = include === 'Yes' || include === 'Unsure';
  const list = Array.isArray(formValues.propertyTrustPropertiesList) ? formValues.propertyTrustPropertiesList : [];
  const trustType = formValues.propertyTrustType || '';
  const fn = formValues.propertyTrustLifeTenantFirstName || '';
  const ln = formValues.propertyTrustLifeTenantLastName || '';
  const rel = formValues.propertyTrustLifeTenantRelationship || '';
  const ptTenure = formValues.pt_tenure || '';
  const ptReasonSelected = normalizePtReason(formValues.pt_reason);

  const addressCandidates = useMemo(() => getPropertyAddressCandidates(formValues || {}), [formValues]);

  useEffect(() => {
    const next = formatPropertyTrustClientSummaryFromState(formValues);
    setFormValues((prev) => (prev.propertyTrustClientSummary === next ? prev : { ...prev, propertyTrustClientSummary: next }));
  }, [formValues, setFormValues]);

  const syncLifeTenantName = useCallback(
    (patch) => {
      setFormValues((prev) => {
        const next = { ...prev, ...patch };
        const a = String(next.propertyTrustLifeTenantFirstName || '').trim();
        const b = String(next.propertyTrustLifeTenantLastName || '').trim();
        const full = [a, b].filter(Boolean).join(' ');
        return {
          ...next,
          propertyTrustLifeTenantName: full || next.propertyTrustLifeTenantName || '',
          pt_life_tenant_first: a,
          pt_life_tenant_last: b,
        };
      });
    },
    [setFormValues]
  );

  useEffect(() => {
    if (!modalOpen) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow.current;
    };
  }, [modalOpen]);

  const applyPatch = useCallback(
    (updater) => {
      setFormValues((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
    },
    [setFormValues]
  );

  useEffect(() => {
    const legacy = String(formValues.propertyTrustType || '').trim();
    const pt = String(formValues.pt_trust_type || '').trim();
    if (!legacy || pt) return;
    const mapped = PT_TRUST_TYPE_BY_LEGACY[legacy];
    if (mapped) applyPatch({ pt_trust_type: mapped });
  }, [formValues.propertyTrustType, formValues.pt_trust_type, applyPatch]);

  useEffect(() => {
    const inc = formValues.includePropertyTrust;
    const w = String(formValues.pt_wants_trust || '').trim();
    if (inc === 'Yes' && !w) applyPatch({ pt_wants_trust: 'yes' });
    else if (inc === 'Unsure' && !w) applyPatch({ pt_wants_trust: 'advise' });
    else if (inc === 'No' && w !== 'no') applyPatch({ pt_wants_trust: 'no' });
  }, [formValues.includePropertyTrust, formValues.pt_wants_trust, applyPatch]);

  const clearPropertyTrustWhenOptOut = () => ({
    propertyTrustType: '',
    propertyTrustLifeTenantFirstName: '',
    propertyTrustLifeTenantLastName: '',
    propertyTrustLifeTenantName: '',
    propertyTrustLifeTenantRelationship: '',
    propertyTrustPropertiesList: undefined,
    propertyTrustClientSummary: '',
    pt_wants_trust: 'no',
    pt_trust_type: '',
    pt_life_tenant_first: '',
    pt_life_tenant_last: '',
    pt_life_tenant_rel: '',
    pt_tenure: '',
    pt_ownership_share: '',
    pt_life_tenant_rights: '',
    pt_sale_instruction: '',
    pt_remainder_beneficiaries: '',
    pt_overreaching: '',
    pt_reason: [],
    pt_notes: '',
  });

  const setInclude = (key) => {
    if (key === 'no') {
      applyPatch({ includePropertyTrust: 'No', ...clearPropertyTrustWhenOptOut() });
      return;
    }
    if (key === 'unsure') {
      applyPatch({ includePropertyTrust: 'Unsure', pt_wants_trust: 'advise' });
      return;
    }
    if (key === 'yes') {
      applyPatch({ includePropertyTrust: 'Yes', pt_wants_trust: 'yes' });
    }
  };

  const setTrustType = (legacyVal) => {
    const ptVal = PT_TRUST_TYPE_BY_LEGACY[legacyVal] || '';
    applyPatch({ propertyTrustType: legacyVal, pt_trust_type: ptVal });
  };

  const togglePtReason = (value) => {
    applyPatch((prev) => {
      const cur = normalizePtReason(prev.pt_reason);
      const has = cur.includes(value);
      const nextList = has ? cur.filter((x) => x !== value) : [...cur, value];
      return { ...prev, pt_reason: nextList };
    });
  };

  const openModal = () => {
    setPickPropertyId('');
    setAddr1('');
    setAddr2('');
    setTown('');
    setPostcode('');
    setTenure('');
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const onPickExistingProperty = (id) => {
    setPickPropertyId(id);
    if (!id) return;
    const c = addressCandidates.find((x) => x.id === id);
    if (c) {
      setAddr1(c.addressLine1);
      setAddr2(c.addressLine2);
      setTown(c.town);
      setPostcode(c.postcode);
      setTenure(c.tenure);
    }
  };

  const saveProperty = () => {
    const e = {};
    if (!String(addr1).trim()) e.addr1 = true;
    if (!String(town).trim()) e.town = true;
    if (!String(postcode).trim()) e.postcode = true;
    setErrors(e);
    if (Object.keys(e).length) return;

    const entry = {
      id: uid(),
      addressLine1: String(addr1).trim(),
      addressLine2: String(addr2).trim(),
      town: String(town).trim(),
      postcode: String(postcode).trim(),
      tenure: String(tenure).trim(),
    };
    applyPatch((prev) => {
      const prevList = Array.isArray(prev.propertyTrustPropertiesList) ? prev.propertyTrustPropertiesList : [];
      return { ...prev, propertyTrustPropertiesList: [...prevList, entry] };
    });
    const addressLine = [entry.addressLine1, entry.town, entry.postcode].filter(Boolean).join(', ');
    toast.success('Trust property saved', {
      description: addressLine || 'Property added to this trust',
    });
    closeModal();
  };

  const removeProperty = (id) => {
    applyPatch((prev) => {
      const prevList = Array.isArray(prev.propertyTrustPropertiesList) ? prev.propertyTrustPropertiesList : [];
      return { ...prev, propertyTrustPropertiesList: prevList.filter((p) => p.id !== id) };
    });
  };

  return (
    <div className="min-w-0 max-w-3xl">
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <Home className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="m-0 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
          Would you like to place a property into a trust in your will?
        </h3>
      </div>

      <div className="mb-4 flex gap-2 text-xs italic leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="m-0 min-w-0 break-words">
          WHY WE ASK THIS: A property trust allows you to leave a property in a structured way — for example, allowing
          someone to live in it for the rest of their life before it passes to your children. It can help protect a
          family home and manage inheritance tax. Your solicitor will draft the trust terms.
        </p>
      </div>

      <div className="mb-4 rounded-lg border border-indigo-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/80 sm:px-4 sm:py-3.5">
        <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">What is a property trust?</p>
        <p className="m-0 mb-2 text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          Instead of leaving a property outright, a property trust sets rules for how it is used after your death. A
          common type is a <span className="font-semibold">life interest trust</span> — trustees hold the property for
          someone (the &quot;life tenant&quot;) who can live there or receive its income for their lifetime, then it passes
          to your chosen beneficiaries.
        </p>
        <div className="rounded-md border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/50">
          <p className="m-0 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-200">Common example: </span>
            A husband leaves his share of the family home in trust for his wife. She can live there for life. When she
            dies, his share passes to his children — not necessarily to whoever she leaves her own estate to.
          </p>
        </div>
      </div>

      <p className="mb-1 text-sm text-slate-700 dark:text-slate-300">
        A property trust is not right for everyone. Your solicitor will confirm whether it makes sense for you.
      </p>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Not sure? &quot;I&apos;d like my solicitor to advise me&quot; is a common choice.</p>

      <div className="mb-4 flex flex-col gap-1" role="radiogroup" aria-label="Property trust">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2">
          <input
            type="radio"
            name={`pt-inc-${uidStr}`}
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
            checked={include === 'No'}
            onChange={() => setInclude('no')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">No — I don&apos;t want to include a property trust</span>
            <span className="mt-0.5 block text-xs sm:text-sm text-slate-600 dark:text-slate-300">Any property I leave will pass outright, not via a trust structure</span>
          </span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2">
          <input
            type="radio"
            name={`pt-inc-${uidStr}`}
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
            checked={include === 'Yes'}
            onChange={() => setInclude('yes')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Yes — please include a property trust in my will</span>
            <span className="mt-0.5 block text-xs sm:text-sm text-slate-600 dark:text-slate-300">I&apos;ll provide details; my solicitor will draft the trust terms</span>
          </span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2">
          <input
            type="radio"
            name={`pt-inc-${uidStr}`}
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
            checked={include === 'Unsure'}
            onChange={() => setInclude('unsure')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">I&apos;d like my solicitor to advise me on this</span>
            <span className="mt-0.5 block text-xs sm:text-sm text-slate-600 dark:text-slate-300">I&apos;m not sure — please discuss before drafting</span>
          </span>
        </label>
      </div>

      {include === 'Yes' ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-500/50 dark:bg-amber-950/40">
          <p className="m-0 text-xs font-bold text-amber-900 dark:text-amber-100 sm:text-sm">Solicitor to complete</p>
          <p className="m-0 mt-1 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
            You have asked for a property trust. Your solicitor will complete the formal Property Trust wording,
            schedule number, and terms before a final will PDF can be generated.
          </p>
        </div>
      ) : null}

      {include === 'Unsure' ? (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-500/50 dark:bg-amber-950/40">
          <p className="m-0 text-xs font-bold text-amber-900 dark:text-amber-100 sm:text-sm">Needs review</p>
          <p className="m-0 mt-1 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
            We&apos;ll discuss property trusts in your onboarding call. Your will can be drafted once you and your
            solicitor have agreed the approach. You can still add details below if you already know them.
          </p>
        </div>
      ) : null}

      {showDetailPanel ? (
        <div className="space-y-6">
          <div>
            <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">What type of property trust would you like?</h3>
            <p className="m-0 mb-3 text-xs text-slate-500 dark:text-slate-400">Choose the closest option — your solicitor will confirm.</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Trust type">
              {TRUST_TYPES.map((t) => {
                const selected = trustType === t.value;
                return (
                  <label
                    key={t.value}
                    className={`block cursor-pointer rounded-[10px] border p-3.5 transition-colors min-h-[44px] ${
                      selected
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`pt-type-${uidStr}`}
                      value={t.value}
                      checked={selected}
                      onChange={() => setTrustType(t.value)}
                    />
                    <span className="m-0 block text-sm font-bold text-slate-900 dark:text-slate-100">{t.title}</span>
                    <span className="m-0 mt-1 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">{t.desc}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div>
            <h3 className="m-0 mb-2 text-base font-bold text-slate-900 dark:text-slate-100">Who is the life tenant?</h3>
            <p className="m-0 mb-3 flex gap-2 text-xs italic text-slate-600 sm:text-sm dark:text-slate-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              The person who can live in or benefit from the property during their lifetime — often a spouse or partner.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/60 sm:px-4">
              <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-400">
                Enter the life tenant in full, or the same details you used in About you / your partner. There is no
                separate &quot;contact&quot; list here — use the name fields.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="pt-fn">
                    First name
                  </label>
                  <input
                    id="pt-fn"
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={fn}
                    onChange={(e) => {
                      syncLifeTenantName({ propertyTrustLifeTenantFirstName: e.target.value });
                    }}
                    placeholder="First name"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="pt-ln">
                    Last name
                  </label>
                  <input
                    id="pt-ln"
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                    value={ln}
                    onChange={(e) => {
                      syncLifeTenantName({ propertyTrustLifeTenantLastName: e.target.value });
                    }}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor="pt-rel">
                  Their relationship to you <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="pt-rel"
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={rel}
                  onChange={(e) => {
                    const v = e.target.value;
                    applyPatch({ propertyTrustLifeTenantRelationship: v, pt_life_tenant_rel: v });
                  }}
                  placeholder="e.g. my spouse, my partner"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="rounded-[10px] border-l-4 border-indigo-600 bg-indigo-50 px-4 py-4 dark:border-indigo-500 dark:bg-slate-800 sm:px-5 sm:py-5">
            <p className="m-0 mb-1.5 text-base font-bold text-indigo-800 dark:text-indigo-200">Properties in the trust</p>
            <p className="m-0 mb-4 text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">
              Add the full address of each property. Your solicitor will use this when drafting the trust and dealing with
              the title.
            </p>
            <div className="mb-4 space-y-2.5">
              {list.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-600 dark:bg-slate-900/50">
                  <p className="m-0 mb-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">No properties added yet</p>
                  <p className="m-0 text-sm text-slate-600 dark:text-slate-300">Use &quot;Add property&quot; to enter the first address.</p>
                </div>
              ) : (
                list.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 rounded-[10px] border border-indigo-200 bg-white px-3 py-3.5 sm:px-4 dark:border-slate-600 dark:bg-slate-900/50"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                      <Home className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 break-words text-sm font-bold text-slate-900 dark:text-slate-100">
                        {[p.addressLine1, p.town, p.postcode].filter(Boolean).join(', ')}
                      </p>
                      {p.tenure ? <p className="m-0 mt-0.5 text-xs text-slate-500 dark:text-slate-400">{p.tenure}</p> : null}
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                      onClick={() => removeProperty(p.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={openModal}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 sm:w-auto dark:bg-indigo-600 dark:hover:bg-indigo-500"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add property
            </button>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">
              Is the property freehold or leasehold?{' '}
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                New
              </span>
            </h3>
            <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-400">
              Your solicitor needs this when dealing with the title. If you add several properties, answer for the main one.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Tenure of main trust property">
              {PT_TENURE_PILLS.map((p) => {
                const sel = ptTenure === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    aria-pressed={sel}
                    onClick={() => applyPatch({ pt_tenure: p.value })}
                    className={`min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      sel
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-900 dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-100'
                        : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">
              What share of the property do you own?{' '}
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                New
              </span>
            </h3>
            <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-400">
              This affects what goes into the trust. If you own jointly, typically only your share passes through your will.
            </p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Ownership share">
              {PT_OWNERSHIP_OPTS.map((o) => {
                const sel = formValues.pt_ownership_share === o.value;
                return (
                  <label
                    key={o.value}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors dark:border-slate-600 ${
                      sel
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                      name={`pt-own-${uidStr}`}
                      checked={sel}
                      onChange={() => applyPatch({ pt_ownership_share: o.value })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.title}</span>
                      {o.hint ? (
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{o.hint}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
                <Info className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
                  What rights should the life tenant have over the property?{' '}
                  <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                    New
                  </span>
                </h3>
                <p className="m-0 mt-1 text-xs italic leading-relaxed text-slate-600 dark:text-slate-300">
                  WHY WE ASK: This tells your solicitor what to include in the trust clause — what the life tenant can and cannot do.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Life tenant rights">
              {PT_RIGHTS_OPTS.map((o) => {
                const sel = formValues.pt_life_tenant_rights === o.value;
                return (
                  <label
                    key={o.value}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors dark:border-slate-600 ${
                      sel
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                      name={`pt-rights-${uidStr}`}
                      checked={sel}
                      onChange={() => applyPatch({ pt_life_tenant_rights: o.value })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.title}</span>
                      {o.hint ? (
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{o.hint}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">
              What should happen if the life tenant wants to sell the property?{' '}
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                New
              </span>
            </h3>
            <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-400">
              Important for the trust wording — what trustees may do if the life tenant moves or wants to sell.
            </p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Sale instructions">
              {PT_SALE_OPTS.map((o) => {
                const sel = formValues.pt_sale_instruction === o.value;
                return (
                  <label
                    key={o.value}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors dark:border-slate-600 ${
                      sel
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                      name={`pt-sale-${uidStr}`}
                      checked={sel}
                      onChange={() => applyPatch({ pt_sale_instruction: o.value })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.title}</span>
                      {o.hint ? (
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{o.hint}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">
              After the life tenant dies, who should inherit the property?{' '}
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                New
              </span>
            </h3>
            <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-400">
              Remainder beneficiaries ultimately receive the property or its value when the trust ends.
            </p>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Remainder beneficiaries">
              {PT_REMAINDER_OPTS.map((o) => {
                const sel = formValues.pt_remainder_beneficiaries === o.value;
                return (
                  <label
                    key={o.value}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors dark:border-slate-600 ${
                      sel
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                      name={`pt-rem-${uidStr}`}
                      checked={sel}
                      onChange={() => applyPatch({ pt_remainder_beneficiaries: o.value })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.title}</span>
                      {o.hint ? (
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{o.hint}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">
              Do you want a future buyer to get a clean title?{' '}
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                New
              </span>
            </h3>
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800">
              <p className="m-0 text-[10px] font-extrabold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
                Plain English
              </p>
              <p className="m-0 mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                When trust property is sold, buyers usually need two trustees to give a clean receipt — overreaching. Most
                property-trust wills include this automatically.
              </p>
            </div>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label="Overreaching protection">
              {PT_OVER_OPTS.map((o) => {
                const sel = formValues.pt_overreaching === o.value;
                return (
                  <label
                    key={o.value}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors dark:border-slate-600 ${
                      sel
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                    }`}
                  >
                    <input
                      type="radio"
                      className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
                      name={`pt-over-${uidStr}`}
                      checked={sel}
                      onChange={() => applyPatch({ pt_overreaching: o.value })}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.title}</span>
                      {o.hint ? (
                        <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{o.hint}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <h3 className="m-0 mb-1 text-base font-bold text-slate-900 dark:text-slate-100">
              What is your main reason for wanting a property trust?{' '}
              <span className="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
                New
              </span>
            </h3>
            <p className="m-0 mb-3 text-xs text-slate-600 dark:text-slate-400">Select all that apply.</p>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
              {PT_REASON_OPTS.map((o) => {
                const sel = ptReasonSelected.includes(o.value);
                return (
                  <label
                    key={o.value}
                    className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors dark:border-slate-600 ${
                      sel
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-indigo-600 dark:border-slate-600"
                      checked={sel}
                      onChange={() => togglePtReason(o.value)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.title}</span>
                      <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{o.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="min-w-0">
            <label className="m-0 mb-2 block text-base font-bold text-slate-900 dark:text-slate-100" htmlFor="pt-notes-area">
              Anything else your solicitor should know?{' '}
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(optional)</span>
            </label>
            <textarea
              id="pt-notes-area"
              rows={4}
              value={formValues.pt_notes || ''}
              onChange={(e) => applyPatch({ pt_notes: e.target.value })}
              placeholder="For example: mortgage, joint owners who must agree, fragile health, second property..."
              className="w-full min-h-[88px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-3 dark:border-emerald-500/40 dark:bg-emerald-950/35">
            <p className="m-0 text-sm font-bold text-emerald-900 dark:text-emerald-100">What happens next</p>
            <p className="m-0 mt-1 text-sm leading-relaxed text-emerald-900 dark:text-emerald-100">
              Your solicitor will draft the full trust terms, schedule, and conditions. You do not need to provide legal
              wording here.
            </p>
          </div>
        </div>
      ) : null}

      {modalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeModal();
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                className="my-auto w-full max-w-lg max-h-[min(92vh,900px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 pt-5 pb-4 dark:border-white/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-300">
                      <Home className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p id={modalTitleId} className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">
                        Add a property to the trust
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">Enter the full address</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                    aria-label="Close"
                    onClick={closeModal}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="flex gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 dark:border-indigo-500/40 dark:bg-indigo-950/40">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                    <p className="m-0 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      Your solicitor will use the address to identify the property on the title register. Prefill from a
                      saved address already used on this will (your home, partner, other gifts, or this trust), or type
                      the full address manually.
                    </p>
                  </div>

                  <div>
                    <label
                      className="m-0 mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500"
                      htmlFor="pt-same-prop"
                    >
                      Select a saved address
                    </label>
                    <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                      Your home, your partner, property gifts, or properties already in this trust (same list as
                      elsewhere in the questionnaire).
                    </p>
                    <select
                      id="pt-same-prop"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value={pickPropertyId}
                      onChange={(e) => onPickExistingProperty(e.target.value)}
                    >
                      <option value="">Enter a new address</option>
                      {addressCandidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {addressCandidates.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        No saved addresses on this will yet. Add your address in About you (and partner if relevant), or
                        type the full address below.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pt-a1">
                      Address line 1 <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="pt-a1"
                      className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800 dark:text-slate-100 ${
                        errors.addr1 ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                      }`}
                      value={addr1}
                      onChange={(e) => {
                        setAddr1(e.target.value);
                        setPickPropertyId('');
                      }}
                      placeholder="House number and street"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pt-a2">
                      Address line 2 <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      id="pt-a2"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                      value={addr2}
                      onChange={(e) => {
                        setAddr2(e.target.value);
                        setPickPropertyId('');
                      }}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pt-town">
                        Town / city <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pt-town"
                        className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm dark:bg-slate-800 ${
                          errors.town ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        value={town}
                        onChange={(e) => {
                          setTown(e.target.value);
                          setPickPropertyId('');
                        }}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pt-pc">
                        Postcode <span className="text-red-600">*</span>
                      </label>
                      <input
                        id="pt-pc"
                        className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm dark:bg-slate-800 ${
                          errors.postcode ? 'border-red-500' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        value={postcode}
                        onChange={(e) => {
                          setPostcode(e.target.value);
                          setPickPropertyId('');
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pt-ten">
                      Tenure
                    </label>
                    <select
                      id="pt-ten"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                      value={tenure}
                      onChange={(e) => {
                        setTenure(e.target.value);
                        setPickPropertyId('');
                      }}
                    >
                      {TENURE_OPTS.map((o) => (
                        <option key={o.value || 'u'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveProperty}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 sm:w-auto dark:hover:bg-indigo-500"
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Save property
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
