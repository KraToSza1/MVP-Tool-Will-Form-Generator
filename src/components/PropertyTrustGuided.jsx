/**
 * Property Trust — guided client intake (April 2026).
 * Solicitor completes: propertyTrustDetails, propertyTrustScheduleNumber, propertyTrustTerms.
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Check, Home, Info, Plus, X } from 'lucide-react';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import { formatPropertyTrustClientSummaryFromState, getPropertyAddressCandidates } from '../utils/propertyTrustFormat.js';

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

/** @param {{ field: object, formValues: object, setFormValues: Function }} props */
export default function PropertyTrustGuided({ field: _field, formValues, setFormValues }) {
  const uidStr = useId();
  const modalTitleId = useId();
  const [modalOpen, setModalOpen] = useState(false);
  const [pickPropertyId, setPickPropertyId] = useState('');
  const [pickAddressContactId, setPickAddressContactId] = useState('');
  const [pickContactId, setPickContactId] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [town, setTown] = useState('');
  const [postcode, setPostcode] = useState('');
  const [tenure, setTenure] = useState('');
  const [errors, setErrors] = useState({});
  const prevOverflow = useRef('');

  const include = formValues.includePropertyTrust;
  const showYesPanel = include === 'Yes';
  const list = Array.isArray(formValues.propertyTrustPropertiesList) ? formValues.propertyTrustPropertiesList : [];
  const trustType = formValues.propertyTrustType || '';
  const fn = formValues.propertyTrustLifeTenantFirstName || '';
  const ln = formValues.propertyTrustLifeTenantLastName || '';
  const rel = formValues.propertyTrustLifeTenantRelationship || '';

  const contactOptions = useMemo(() => {
    const raw = getContactCandidates(formValues || {});
    return raw.filter((c) => personDisplayNameForGift(c.data) !== '');
  }, [formValues]);

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
        return { ...next, propertyTrustLifeTenantName: full || next.propertyTrustLifeTenantName || '' };
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

  const clearYesOnlyClientFields = () => ({
    propertyTrustType: '',
    propertyTrustLifeTenantFirstName: '',
    propertyTrustLifeTenantLastName: '',
    propertyTrustLifeTenantName: '',
    propertyTrustLifeTenantRelationship: '',
    propertyTrustPropertiesList: undefined,
    propertyTrustClientSummary: '',
  });

  const setInclude = (key) => {
    if (key === 'no') {
      applyPatch({ includePropertyTrust: 'No', ...clearYesOnlyClientFields() });
      return;
    }
    if (key === 'unsure') {
      applyPatch({ includePropertyTrust: 'Unsure', ...clearYesOnlyClientFields() });
      return;
    }
    if (key === 'yes') {
      applyPatch({ includePropertyTrust: 'Yes' });
    }
  };

  const setTrustType = (val) => {
    applyPatch({ propertyTrustType: val });
  };

  const openModal = () => {
    setPickPropertyId('');
    setPickAddressContactId('');
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
    setPickAddressContactId('');
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

  const onPickAddressFromContact = (id) => {
    setPickAddressContactId(id);
    if (!id) {
      return;
    }
    const c = contactOptions.find((x) => x.id === id);
    if (!c) return;
    setPickPropertyId('');
    const d = c.data && typeof c.data === 'object' ? c.data : {};
    const a1 = String(d.address1 || '').trim();
    const a2 = String(d.address2 || '').trim();
    const a3 = String(d.address3 || '').trim();
    const pc = String(d.postcode || '').trim();
    setAddr1(a1);
    setAddr2(a2);
    setTown(a3);
    setPostcode(pc);
    setTenure('');
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

  const onLifeTenantContactChange = (id) => {
    setPickContactId(id);
    if (!id) {
      return;
    }
    const c = contactOptions.find((x) => x.id === id);
    if (!c || !c.data) return;
    const d = c.data;
    const first = String(d.firstName || '').trim();
    const last = String(d.lastName || '').trim();
    const r = String(d.relationship || d.rel || '').trim();
    let description = '';
    if (first || last || r) {
      syncLifeTenantName({
        propertyTrustLifeTenantFirstName: first,
        propertyTrustLifeTenantLastName: last,
        propertyTrustLifeTenantRelationship: r,
      });
      const full = [first, last].filter(Boolean).join(' ').trim();
      description = full ? (r ? `${full} — ${r}` : full) : r;
    } else {
      const name = personDisplayNameForGift(d);
      if (name) {
        const parts = name.split(/\s+/).filter(Boolean);
        const lastPart = parts.length > 1 ? parts.pop() : '';
        const firstPart = parts.join(' ') || name;
        syncLifeTenantName({
          propertyTrustLifeTenantFirstName: firstPart,
          propertyTrustLifeTenantLastName: lastPart,
          propertyTrustLifeTenantRelationship: r,
        });
        description = r ? `${name} — ${r}` : name;
      }
    }
    if (description) {
      toast.success('Life tenant set', { description });
    }
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
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2.5 dark:border-amber-500/50 dark:bg-amber-950/30">
          <p className="m-0 text-xs font-bold text-amber-900 dark:text-amber-100 sm:text-sm">Solicitor to complete</p>
          <p className="m-0 mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90">
            You have asked for a property trust. Your solicitor will complete the formal Property Trust wording,
            schedule number, and terms before a final will PDF can be generated.
          </p>
        </div>
      ) : null}

      {include === 'Unsure' ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2.5 dark:border-amber-500/50 dark:bg-amber-950/30">
          <p className="m-0 text-xs font-bold text-amber-900 dark:text-amber-100 sm:text-sm">Needs review</p>
          <p className="m-0 mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-100/90">
            We&apos;ll discuss property trusts in your onboarding call. Your will can be drafted once you and your
            solicitor have agreed the approach.
          </p>
        </div>
      ) : null}

      {showYesPanel ? (
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
                        ? 'border-indigo-600 bg-indigo-50/90 dark:border-indigo-500 dark:bg-indigo-950/30'
                        : 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-600 dark:bg-slate-900/50 dark:hover:border-indigo-500/50'
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
              <div className="mb-3">
                <label className="mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200" htmlFor="pt-pick-life">
                  Select from people already in this form
                </label>
                <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                  Includes you, your partner, saved contacts, and people from gift lists. You can still edit the fields
                  below.
                </p>
                <select
                  id="pt-pick-life"
                  className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={pickContactId}
                  onChange={(e) => onLifeTenantContactChange(e.target.value)}
                >
                  <option value="">Type manually (no selection)</option>
                  {contactOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {contactOptions.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    No saved people yet. Complete About you and other sections first, or type the life tenant below.
                  </p>
                ) : null}
              </div>
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
                      setPickContactId('');
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
                      setPickContactId('');
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
                    setPickContactId('');
                    applyPatch({ propertyTrustLifeTenantRelationship: e.target.value });
                  }}
                  placeholder="e.g. my spouse, my partner"
                />
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="rounded-[10px] border-l-4 border-indigo-600 bg-indigo-50/90 px-4 py-4 dark:border-indigo-500 dark:bg-slate-800/80 sm:px-5 sm:py-5">
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

          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/90 px-3 py-3 dark:border-emerald-500/40 dark:bg-emerald-950/25">
            <p className="m-0 text-sm font-bold text-emerald-900 dark:text-emerald-100">What happens next</p>
            <p className="m-0 mt-1 text-sm leading-relaxed text-emerald-900/95 dark:text-emerald-100/90">
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
                  <div className="flex gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 dark:border-slate-600/80 dark:bg-indigo-500/10">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                    <p className="m-0 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      Your solicitor will use the address to identify the property on the title register. You can
                      prefill from someone you already added, or reuse an address already used elsewhere on this
                      will, then adjust the lines if needed.
                    </p>
                  </div>

                  <div>
                    <label
                      className="m-0 mb-1.5 block text-sm font-semibold text-slate-800 dark:text-slate-200"
                      htmlFor="pt-addr-person"
                    >
                      Select an address from people already in this form
                    </label>
                    <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                      Uses saved contact addresses (e.g. your home or your partner&apos;s). Add details in About you
                      first if empty.
                    </p>
                    <select
                      id="pt-addr-person"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value={pickAddressContactId}
                      onChange={(e) => onPickAddressFromContact(e.target.value)}
                    >
                      <option value="">None — use options below or type manually</option>
                      {contactOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    {contactOptions.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        No saved people yet. Complete About you, your partner, or other people sections first, or type
                        the full address below.
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      className="m-0 mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-500"
                      htmlFor="pt-same-prop"
                    >
                      Reuse a property address from this will
                    </label>
                    <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
                      Your address, property gifts, or properties already added to this trust.
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
                        No other property addresses on this will yet. Type the address below, or use &quot;people
                        already in this form&quot; above.
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
                        setPickAddressContactId('');
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
                        setPickAddressContactId('');
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
                          setPickAddressContactId('');
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
                          setPickAddressContactId('');
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
                        setPickAddressContactId('');
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
