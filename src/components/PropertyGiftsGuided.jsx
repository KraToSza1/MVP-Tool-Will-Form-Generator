/**
 * Property Gifts — guided section (April 2026).
 * Persists: leavePropertyGifts, propertyGiftsList, propertyGiftsDetails, failedPropertyGiftPassProportionately
 */
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Home, Info, Plus, X } from 'lucide-react';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import { formatPropertyGiftsDetailsFromList } from '../utils/propertyGiftsFormat.js';

function uid() {
  return `pg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function relationshipFromPick(source, data) {
  const fromData = data && typeof data === 'object' ? String(data.relationship || '').trim() : '';
  if (fromData) return fromData;
  if (source === 'partner') return 'Partner / spouse';
  return '';
}

const CONDITION_OPTIONS = [
  { value: '', label: 'No condition' },
  { value: 'survives-30', label: 'Only if they survive me by 30 days' },
  { value: 'survives-28', label: 'Only if they survive me by 28 days' },
  { value: 'age-18', label: 'Only when they reach the age of 18' },
  { value: 'age-21', label: 'Only when they reach the age of 21' },
  { value: 'age-25', label: 'Only when they reach the age of 25' },
  { value: 'other', label: 'Other — my solicitor will specify' },
];

const LAPSE_OPTIONS = [
  { value: 'residue', label: 'Falls into the residue of my estate (default)' },
  { value: 'their-children', label: 'Passes to their children instead' },
  { value: 'named-person', label: 'Passes to another named person — I will tell my solicitor who' },
  { value: 'other', label: 'Other — my solicitor will advise' },
];

/** @param {{ field: object, formValues: object, setFormValues: Function }} props */
export default function PropertyGiftsGuided({ field: _field, formValues, setFormValues }) {
  const uidStr = useId();
  const modalTitleId = useId();
  const [modalOpen, setModalOpen] = useState(false);
  const [pickContactId, setPickContactId] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [town, setTown] = useState('');
  const [postcode, setPostcode] = useState('');
  const [tenure, setTenure] = useState('');
  const [hasMortgage, setHasMortgage] = useState('no');
  const [mortgageInstruction, setMortgageInstruction] = useState('recipient-takes-over');
  const [recipient, setRecipient] = useState('');
  const [relationship, setRelationship] = useState('');
  const [conditionKey, setConditionKey] = useState('');
  const [lapseKey, setLapseKey] = useState('residue');
  const [errors, setErrors] = useState({});
  const prevOverflow = useRef('');

  const list = Array.isArray(formValues.propertyGiftsList) ? formValues.propertyGiftsList : [];

  const q1 = formValues.leavePropertyGifts;
  const showPanel = q1 === 'Yes';

  const contactPickOptions = useMemo(() => {
    const raw = getContactCandidates(formValues || {});
    return raw.filter((c) => personDisplayNameForGift(c.data) !== '');
  }, [formValues]);

  useEffect(() => {
    const raw = formValues.propertyGiftsList;
    if (raw === undefined) return;
    const next = raw.length === 0 ? '' : formatPropertyGiftsDetailsFromList(raw);
    setFormValues((prev) => (prev.propertyGiftsDetails === next ? prev : { ...prev, propertyGiftsDetails: next }));
  }, [formValues.propertyGiftsList, setFormValues]);

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

  const setQ1 = (val) => {
    const mapped = val === 'yes' ? 'Yes' : 'No';
    if (mapped === 'No') {
      applyPatch({
        leavePropertyGifts: 'No',
        propertyGiftsList: undefined,
        propertyGiftsDetails: '',
        failedPropertyGiftPassProportionately: null,
      });
      return;
    }
    applyPatch({ leavePropertyGifts: 'Yes' });
  };

  const setLapse = (val) => {
    const mapped = val === 'yes' ? 'Yes' : val === 'unsure' ? 'Unsure' : 'No';
    applyPatch({ failedPropertyGiftPassProportionately: mapped });
  };

  const openModal = () => {
    setPickContactId('');
    setAddr1('');
    setAddr2('');
    setTown('');
    setPostcode('');
    setTenure('');
    setHasMortgage('no');
    setMortgageInstruction('recipient-takes-over');
    setRecipient('');
    setRelationship('');
    setConditionKey('');
    setLapseKey('residue');
    setErrors({});
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const applyPickedContact = (id) => {
    setPickContactId(id);
    if (!id) return;
    const c = contactPickOptions.find((x) => x.id === id);
    if (!c) return;
    setRecipient(personDisplayNameForGift(c.data));
    setRelationship(relationshipFromPick(c.source, c.data));
  };

  const saveGift = () => {
    const e = {};
    if (!addr1.trim()) e.addr1 = true;
    if (!town.trim()) e.town = true;
    if (!postcode.trim()) e.postcode = true;
    if (!recipient.trim()) e.recipient = true;
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    const condOpt = CONDITION_OPTIONS.find((o) => o.value === conditionKey) || CONDITION_OPTIONS[0];
    const lapseOpt = LAPSE_OPTIONS.find((o) => o.value === lapseKey) || LAPSE_OPTIONS[0];

    const entry = {
      id: uid(),
      addressLine1: addr1.trim(),
      addressLine2: addr2.trim(),
      town: town.trim(),
      postcode: postcode.trim(),
      tenure: tenure.trim(),
      hasMortgage,
      mortgageInstruction: hasMortgage === 'yes' ? mortgageInstruction : '',
      recipientName: recipient.trim(),
      recipientRelationship: relationship.trim(),
      conditionKey: conditionKey || '',
      conditionLabel: conditionKey ? condOpt.label : 'None',
      lapseKey,
      lapseLabel: lapseOpt.label,
    };

    applyPatch((prev) => {
      const prevList = Array.isArray(prev.propertyGiftsList) ? prev.propertyGiftsList : [];
      return { ...prev, propertyGiftsList: [...prevList, entry] };
    });
    closeModal();
  };

  const removeGift = (id) => {
    applyPatch((prev) => {
      const prevList = Array.isArray(prev.propertyGiftsList) ? prev.propertyGiftsList : [];
      return { ...prev, propertyGiftsList: prevList.filter((g) => g.id !== id) };
    });
  };

  const lapseVal = formValues.failedPropertyGiftPassProportionately;
  const radioLapse = {
    no: lapseVal === 'No',
    yes: lapseVal === 'Yes',
    unsure: lapseVal === 'Unsure',
  };

  return (
    <div className="min-w-0 max-w-3xl">
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <svg className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <h3 className="m-0 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
          Would you like to leave a property — such as a house, flat, or land — directly to a named person?
        </h3>
      </div>

      <div className="mb-4 flex gap-2 text-xs italic leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="m-0 min-w-0 break-words">
          WHY WE ASK THIS: A property gift (also called a specific devise) lets you leave a named property directly to a
          specific person, outside of the general distribution of your estate. This section is for properties left
          outright — not held in a property trust (that is a separate section).
        </p>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ['Your main home', 'e.g. Leave your house at 12 Oak Lane to your daughter'],
          ['A second home or flat', 'Holiday cottage, buy-to-let flat, or investment property'],
          ['Land', 'A plot of land, allotment, or agricultural land'],
          ['Commercial property', 'A shop, office, or business premises you own'],
        ].map(([title, sub]) => (
          <div
            key={title}
            className="rounded-lg border border-indigo-100 bg-indigo-50/90 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/90"
          >
            <p className="m-0 mb-0.5 text-xs font-semibold text-slate-900 sm:text-sm dark:text-slate-100">✓ {title}</p>
            <p className="m-0 text-xs text-slate-600 dark:text-slate-300">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2.5 dark:border-amber-500/50 dark:bg-amber-950/30">
        <p className="m-0 mb-1 text-xs font-bold text-amber-900 dark:text-amber-100 sm:text-sm">Not sure if your property should go here?</p>
        <p className="m-0 text-xs leading-relaxed text-amber-900/95 dark:text-amber-100/90">
          If you want to leave a property in a trust (e.g. a life interest trust or nil-rate band trust) rather than
          outright, use the Property Trust section instead. If you&apos;re unsure, select &quot;Yes&quot; here and your
          solicitor will advise on the best structure.
        </p>
      </div>

      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">You can add more than one property — each one is entered separately.</p>

      <div className="mb-4 flex flex-col gap-1" role="radiogroup" aria-label="Property gifts">
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 min-h-[44px] sm:px-2">
          <input
            type="radio"
            name={`pg-q1-${uidStr}`}
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
            checked={q1 === 'No'}
            onChange={() => setQ1('no')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">No — I don&apos;t want to leave any property as a direct gift</span>
            <span className="mt-0.5 block text-xs sm:text-sm text-slate-600 dark:text-slate-300">Any property I own will pass through the general distribution of my estate</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60 min-h-[44px] sm:px-2">
          <input
            type="radio"
            name={`pg-q1-${uidStr}`}
            className="mt-1 h-4 w-4 shrink-0 accent-indigo-600"
            checked={q1 === 'Yes'}
            onChange={() => setQ1('yes')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Yes — I want to leave one or more properties to named people</span>
            <span className="mt-0.5 block text-xs sm:text-sm text-slate-600 dark:text-slate-300">I&apos;ll specify each property and recipient below</span>
          </span>
        </label>
      </div>

      {showPanel ? (
        <div className="space-y-6">
          <div className="rounded-[10px] border-l-4 border-indigo-600 bg-indigo-50/95 px-4 py-4 dark:border-indigo-500 dark:bg-slate-800/80 sm:px-5 sm:py-5">
            <p className="m-0 mb-1.5 text-base font-bold text-indigo-700 dark:text-indigo-300">Your property gifts</p>
            <p className="m-0 mb-4 text-sm italic leading-relaxed text-slate-600 dark:text-slate-300">
              Add each property below. Each one will appear separately in your will with the full address and recipient details.
            </p>

            <div className="mb-4 space-y-2.5">
              {list.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-600 dark:bg-slate-900/50">
                  <p className="m-0 mb-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">No property gifts added yet</p>
                  <p className="m-0 text-sm text-slate-600 dark:text-slate-300">Click &quot;Add property gift&quot; below to enter the first property and its recipient.</p>
                </div>
              ) : (
                list.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-start gap-3 rounded-[10px] border border-indigo-200 bg-white px-3 py-3.5 sm:gap-3.5 sm:px-4 dark:border-slate-600 dark:bg-slate-900/50"
                  >
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/40">
                      <Home className="h-5 w-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="m-0 mb-0.5 break-words text-[15px] font-bold text-slate-900 dark:text-slate-100">
                        {[g.addressLine1, g.town, g.postcode].filter(Boolean).join(', ')}
                      </p>
                      <p className="m-0 mb-0.5 break-words text-sm font-semibold text-indigo-600 dark:text-indigo-400">{g.recipientName}</p>
                      <p className="m-0 text-xs leading-relaxed text-slate-600 break-words dark:text-slate-300">
                        {[g.recipientRelationship, g.conditionLabel && g.conditionLabel !== 'None' ? g.conditionLabel : null, g.lapseKey !== 'residue' ? g.lapseLabel : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                      onClick={() => removeGift(g.id)}
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
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Add property gift
            </button>
          </div>

          <hr className="border-slate-200 dark:border-slate-600" />

          <div className="mb-2 flex min-w-0 items-start gap-2.5">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
              <svg className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <h3 className="m-0 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
              What should happen if the person you&apos;ve left a property to dies before you?
            </h3>
          </div>

          <div className="mb-3 flex gap-2 text-xs italic leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <p className="m-0 min-w-0 break-words">
              WHY WE ASK THIS: If your intended recipient dies before you, the property gift &quot;fails&quot; and the property
              needs a fallback rule. This sets the default for all your property gifts — you can also set a
              per-property rule in the add form above.
            </p>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/80">
              <p className="m-0 mb-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">If you say Yes</p>
              <p className="m-0 text-xs leading-snug text-slate-600 dark:text-slate-300">
                The failed property passes proportionately to your other beneficiaries in line with their existing
                shares of the residuary estate. Less common — usually only appropriate where the estate is distributed
                in defined shares.
              </p>
            </div>
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/80">
              <p className="m-0 mb-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100">If you say No</p>
              <p className="m-0 text-xs leading-snug text-slate-600 dark:text-slate-300">
                The failed property falls into the residue of your estate and is distributed under the general terms
                of your will. This is the standard position and is right for most estates.
              </p>
            </div>
          </div>

          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Not sure? Most clients choose &quot;No&quot; or ask their solicitor. The per-property options in the add
            form are often more useful.
          </p>

          <div className="flex flex-col gap-1" role="radiogroup" aria-label="Property gift lapse default">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 min-h-[44px] sm:px-2">
              <input
                type="radio"
                name={`pg-lapse-${uidStr}`}
                className="mt-1 h-4 w-4 accent-indigo-600"
                checked={radioLapse.no}
                onChange={() => setLapse('no')}
              />
              <span className="min-w-0">
                <span className="block text-sm text-slate-900 dark:text-slate-100">No — a failed property gift should fall into the residue of my estate</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">Standard approach — the property is distributed under the general terms of my will</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 min-h-[44px] sm:px-2">
              <input
                type="radio"
                name={`pg-lapse-${uidStr}`}
                className="mt-1 h-4 w-4 accent-indigo-600"
                checked={radioLapse.yes}
                onChange={() => setLapse('yes')}
              />
              <span className="min-w-0">
                <span className="block text-sm text-slate-900 dark:text-slate-100">Yes — a failed property gift should pass proportionately to my other beneficiaries</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">The value is redistributed in proportion to each beneficiary&apos;s existing share</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 min-h-[44px] sm:px-2">
              <input
                type="radio"
                name={`pg-lapse-${uidStr}`}
                className="mt-1 h-4 w-4 accent-indigo-600"
                checked={radioLapse.unsure}
                onChange={() => setLapse('unsure')}
              />
              <span className="min-w-0">
                <span className="block text-sm text-slate-900 dark:text-slate-100">I&apos;d like my solicitor to advise me on this</span>
                <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">We&apos;ll discuss the right approach before your will is finalised</span>
              </span>
            </label>
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
                      <Home className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p id={modalTitleId} className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">
                        Add a property gift
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">Enter the property details and recipient</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                    aria-label="Close"
                    onClick={closeModal}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="flex gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 dark:border-slate-600/80 dark:bg-indigo-500/10">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                    <p className="m-0 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      Enter the full address and the name of the person who should receive it. Add one property at a time.
                    </p>
                  </div>

                  <p className="m-0 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-500">
                    The property
                  </p>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-addr1">
                      Address line 1 <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="pg-addr1"
                      className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40 ${
                        errors.addr1 ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                      }`}
                      value={addr1}
                      onChange={(e) => setAddr1(e.target.value)}
                      placeholder="House number and street"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-addr2">
                      Address line 2 <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      id="pg-addr2"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value={addr2}
                      onChange={(e) => setAddr2(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-town">
                        Town / city <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="pg-town"
                        className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100 ${
                          errors.town ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        value={town}
                        onChange={(e) => setTown(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-pc">
                        Postcode <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <input
                        id="pg-pc"
                        className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100 ${
                          errors.postcode ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        value={postcode}
                        onChange={(e) => setPostcode(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-tenure">
                        Tenure
                      </label>
                      <select
                        id="pg-tenure"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        value={tenure}
                        onChange={(e) => setTenure(e.target.value)}
                      >
                        <option value="">Not sure / don&apos;t know</option>
                        <option value="freehold">Freehold</option>
                        <option value="leasehold">Leasehold</option>
                        <option value="commonhold">Commonhold</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-mort">
                        Mortgage on this property?
                      </label>
                      <select
                        id="pg-mort"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        value={hasMortgage}
                        onChange={(e) => setHasMortgage(e.target.value)}
                      >
                        <option value="no">No — owned outright</option>
                        <option value="yes">Yes — there is a mortgage</option>
                        <option value="unknown">Not sure</option>
                      </select>
                    </div>
                  </div>
                  {hasMortgage === 'yes' ? (
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-mi">
                        What should happen to the mortgage?
                      </label>
                      <select
                        id="pg-mi"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        value={mortgageInstruction}
                        onChange={(e) => setMortgageInstruction(e.target.value)}
                      >
                        <option value="recipient-takes-over">The recipient takes over the mortgage payments</option>
                        <option value="paid-from-estate">The mortgage should be paid off from my estate before transfer</option>
                        <option value="solicitor-advise">My solicitor will advise on the best approach</option>
                      </select>
                    </div>
                  ) : null}

                  <p className="m-0 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-500">
                    Who receives this property
                  </p>
                  {contactPickOptions.length > 0 ? (
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-pick">
                        Same person or new <span className="text-slate-500">(optional)</span>
                      </label>
                      <select
                        id="pg-pick"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        value={pickContactId}
                        onChange={(e) => applyPickedContact(e.target.value)}
                      >
                        <option value="">Enter a new person</option>
                        {contactPickOptions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-rec">
                      Recipient&apos;s full name <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="pg-rec"
                      className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm dark:bg-slate-800 dark:text-slate-100 ${
                        errors.recipient ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                      }`}
                      value={recipient}
                      onChange={(e) => {
                        setRecipient(e.target.value);
                        if (pickContactId) setPickContactId('');
                      }}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-rel">
                      Their relationship to you <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      id="pg-rel"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value={relationship}
                      onChange={(e) => {
                        setRelationship(e.target.value);
                        if (pickContactId) setPickContactId('');
                      }}
                    />
                  </div>

                  <p className="m-0 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-500">
                    Conditions (optional)
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-cond">
                        Any condition on this gift?
                      </label>
                      <select
                        id="pg-cond"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        value={conditionKey}
                        onChange={(e) => setConditionKey(e.target.value)}
                      >
                        {CONDITION_OPTIONS.map((o) => (
                          <option key={o.value || 'x'} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300" htmlFor="pg-lapse-one">
                        If this recipient cannot receive it, what should happen?
                      </label>
                      <select
                        id="pg-lapse-one"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        value={lapseKey}
                        onChange={(e) => setLapseKey(e.target.value)}
                      >
                        {LAPSE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
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
                    onClick={saveGift}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 sm:w-auto dark:hover:bg-indigo-500"
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                    Save property gift
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
