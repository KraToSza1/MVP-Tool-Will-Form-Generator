/**
 * Other Provisions — guided section (April 2026). Maps to existing will field IDs.
 * No duplicate section title (FormRenderer card provides it).
 */
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Info, Plus, StickyNote, X } from 'lucide-react';
import { getContactCandidates, personDisplayNameForGift, upsertRegistryContact } from '../lib/personRegistry.js';
import { emptyPersonRecord } from '../utils/personRecordSpecs.js';

const FIELD_ID = 'otherProvisionsGuided';

function newRowId() {
  return `opg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function splitName(full) {
  const s = String(full || '').trim();
  if (!s) return { firstName: '', lastName: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

function initialsFromRow(p) {
  const fn = String(p?.firstName || '').trim();
  const ln = String(p?.lastName || '').trim();
  const a = (fn[0] || ln[0] || '?').toUpperCase();
  const b = (ln[0] && fn[0] ? ln[0] : '').toUpperCase();
  return (a + b).slice(0, 2);
}

function personLabel(p) {
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim() || '—';
}

/** @param {Record<string, unknown>|null|undefined} v */
export function isOtherProvisionsGuidedComplete(v) {
  const x = v || {};
  if (x.provisionsForPets !== 'Yes' && x.provisionsForPets !== 'No') return false;

  if (x.provisionsForPets === 'Yes') {
    const list = x.petCarerData;
    const hasCarer =
      Array.isArray(list) &&
      list.some((p) => p && (String(p.firstName || '').trim() || String(p.lastName || '').trim()));
    if (!hasCarer) return false;

    if (x.substitutePetCarer !== 'Yes' && x.substitutePetCarer !== 'No') return false;
    if (x.substitutePetCarer === 'Yes') {
      const sub = x.substitutePetCarerData;
      const okSub =
        Array.isArray(sub) &&
        sub.some((p) => p && (String(p.firstName || '').trim() || String(p.lastName || '').trim()));
      if (!okSub) return false;
    }

    if (x.leavePetCareFund !== 'Yes' && x.leavePetCareFund !== 'No') return false;
    if (x.leavePetCareFund === 'Yes') {
      const raw = String(x.amountToLeaveForPetCare ?? x.petCarerGift ?? '').replace(/[£,\s]/g, '').trim();
      if (!raw || raw === '0' || Number(raw) === 0) return false;
    }

    if (x.personalGiftToPetCarer !== 'Yes' && x.personalGiftToPetCarer !== 'No') return false;
    if (x.personalGiftToPetCarer === 'Yes') {
      const g = String(x.petCarerPersonalGift ?? '').replace(/[£,\s]/g, '').trim();
      if (!g || g === '0' || Number(g) === 0) return false;
    }
  }

  if (x.relieveDebts !== 'Yes' && x.relieveDebts !== 'No') return false;
  if (x.relieveDebts === 'Yes') {
    const debtors = x.debtorData;
    const has =
      Array.isArray(debtors) &&
      debtors.some((d) => String(d?.firstName || '').trim() || String(d?.lastName || '').trim());
    if (!has) return false;
  }
  return true;
}

/** @returns {Array<{ fieldId: string, fieldLabel: string, message: string, type: string }>} */
export function getOtherProvisionsGuidedValidationIssues(v) {
  const issues = [];
  if (v.provisionsForPets !== 'Yes' && v.provisionsForPets !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Other provisions — pets',
      message: 'Please say whether you want to make provision for pets in your will.',
      type: 'required',
    });
  } else if (v.provisionsForPets === 'Yes') {
    const list = v.petCarerData;
    const hasCarer =
      Array.isArray(list) &&
      list.some((p) => p && (String(p.firstName || '').trim() || String(p.lastName || '').trim()));
    if (!hasCarer) {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Other provisions — pet carer',
        message: 'Add a pet carer, or change your answer to “No” if you do not need pet provisions.',
        type: 'required',
      });
    }
    if (v.substitutePetCarer !== 'Yes' && v.substitutePetCarer !== 'No') {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Other provisions — substitute carer',
        message: 'Please say whether you want to name a substitute pet carer.',
        type: 'required',
      });
    } else if (v.substitutePetCarer === 'Yes') {
      const sub = v.substitutePetCarerData;
      const okSub =
        Array.isArray(sub) &&
        sub.some((p) => p && (String(p.firstName || '').trim() || String(p.lastName || '').trim()));
      if (!okSub) {
        issues.push({
          fieldId: FIELD_ID,
          fieldLabel: 'Other provisions — substitute pet carer',
          message: 'Add a substitute pet carer, or change your answer to “No”.',
          type: 'required',
        });
      }
    }
    if (v.leavePetCareFund !== 'Yes' && v.leavePetCareFund !== 'No') {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Other provisions — pet care fund',
        message: 'Please say whether you want to leave a sum for your pets’ ongoing care.',
        type: 'required',
      });
    } else if (v.leavePetCareFund === 'Yes') {
      const raw = String(v.amountToLeaveForPetCare ?? v.petCarerGift ?? '').replace(/[£,\s]/g, '').trim();
      if (!raw || raw === '0' || Number(raw) === 0) {
        issues.push({
          fieldId: FIELD_ID,
          fieldLabel: 'Other provisions — pet care amount',
          message: 'Enter an amount for the pet care fund, or choose “No” if you do not want a care fund.',
          type: 'required',
        });
      }
    }
    if (v.personalGiftToPetCarer !== 'Yes' && v.personalGiftToPetCarer !== 'No') {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Other provisions — gift to carer',
        message: 'Please say whether you want to leave a personal gift to whoever cares for your pets.',
        type: 'required',
      });
    } else if (v.personalGiftToPetCarer === 'Yes') {
      const g = String(v.petCarerPersonalGift ?? '').replace(/[£,\s]/g, '').trim();
      if (!g || g === '0' || Number(g) === 0) {
        issues.push({
          fieldId: FIELD_ID,
          fieldLabel: 'Other provisions — gift amount',
          message: 'Enter a gift amount for the carer, or choose “No” if you do not want a personal gift.',
          type: 'required',
        });
      }
    }
  }

  if (v.relieveDebts !== 'Yes' && v.relieveDebts !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Other provisions — debts',
      message: 'Please say whether you want to release anyone from debts they owe you when you die.',
      type: 'required',
    });
  } else if (v.relieveDebts === 'Yes') {
    const debtors = v.debtorData;
    const has =
      Array.isArray(debtors) &&
      debtors.some((d) => String(d?.firstName || '').trim() || String(d?.lastName || '').trim());
    if (!has) {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Other provisions — people to release from debt',
        message: 'Add at least one person, or change your answer to “No” if you do not want to release any debts in your will.',
        type: 'required',
      });
    }
  }
  return issues;
}

function SamePersonOrNew({ formValues, value, onPick, onClearPick }) {
  const options = useMemo(() => {
    const raw = getContactCandidates(formValues || {});
    return raw.filter((c) => personDisplayNameForGift(c.data) !== '');
  }, [formValues]);
  if (options.length === 0) return null;
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Same person or new</label>
      <select
        className="w-full min-h-[44px] rounded-lg border-2 border-indigo-500 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
        value={value}
        onChange={(e) => (e.target.value ? onPick(e.target.value) : onClearPick())}
      >
        <option value="">Enter a new person</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">Select someone already in this form, or type new details below.</p>
    </div>
  );
}

/** @param {{ field: object, formValues: object, setFormValues: Function }} props */
export default function OtherProvisionsGuided({ field, formValues, setFormValues }) {
  const uid = useId();
  const apply = useCallback((patch) => setFormValues((p) => ({ ...p, ...patch })), [setFormValues]);

  const [carerOpen, setCarerOpen] = useState(false);
  const [cPick, setCPick] = useState('');
  const [cName, setCName] = useState('');
  const [cRel, setCRel] = useState('');

  const [subOpen, setSubOpen] = useState(false);
  const [sPick, setSPick] = useState('');
  const [sName, setSName] = useState('');
  const [sRel, setSRel] = useState('');

  const [debtOpen, setDebtOpen] = useState(false);
  const [dPick, setDPick] = useState('');
  const [dName, setDName] = useState('');
  const [dRel, setDRel] = useState('');
  const [dAmount, setDAmount] = useState('');
  const [dNotes, setDNotes] = useState('');

  const petYes = formValues.provisionsForPets === 'Yes';
  const petCarerList = Array.isArray(formValues.petCarerData) ? formValues.petCarerData : [];
  const subList = Array.isArray(formValues.substitutePetCarerData) ? formValues.substitutePetCarerData : [];
  const debtList = Array.isArray(formValues.debtorData) ? formValues.debtorData : [];

  // One-time migration: old petCarerOptions + petCarerGift → new fields
  useEffect(() => {
    setFormValues((p) => {
      let next = p;
      if (p.petCarerGift && !p.amountToLeaveForPetCare) {
        next = { ...next, amountToLeaveForPetCare: String(p.petCarerGift) };
      }
      if (p.petCarerOptions === 'Yes' && p.leavePetCareFund == null) {
        next = { ...next, leavePetCareFund: 'Yes' };
      }
      return next === p ? p : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- import legacy keys once on first mount
  }, [setFormValues]);

  useEffect(() => {
    if (!petYes) return;
    if (formValues.petsCaredForByRSPCA === 'Yes' || formValues.petsCaredForByRSPCA === 'No') return;
    apply({ petsCaredForByRSPCA: 'No' });
  }, [petYes, formValues.petsCaredForByRSPCA, apply]);

  useEffect(() => {
    const r = String(formValues.relieveDebts || '');
    if (r === 'Yes' || r === 'No') {
      setFormValues((p) => (p.forgiveDebt === r ? p : { ...p, forgiveDebt: r }));
    }
  }, [formValues.relieveDebts, setFormValues]);

  useEffect(() => {
    const f = String(formValues.forgiveDebt || '');
    if (f === 'Yes' || f === 'No') {
      setFormValues((p) => (p.relieveDebts === f ? p : { ...p, relieveDebts: f }));
    }
  }, [formValues.forgiveDebt, setFormValues]);

  const applyCarerPick = (id) => {
    setCPick(id || '');
    if (!id) {
      setCName('');
      setCRel('');
      return;
    }
    const c = getContactCandidates(formValues).find((x) => x.id === id);
    if (c?.data) {
      const d = c.data;
      const n = [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ').trim() || personDisplayNameForGift(d);
      setCName(n);
      setCRel(String(d.relationship || '').trim() || (c.source === 'partner' ? 'Partner / spouse' : ''));
    }
  };

  const applySubPick = (id) => {
    setSPick(id || '');
    if (!id) {
      setSName('');
      setSRel('');
      return;
    }
    const c = getContactCandidates(formValues).find((x) => x.id === id);
    if (c?.data) {
      const d = c.data;
      const n = [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ').trim() || personDisplayNameForGift(d);
      setSName(n);
      setSRel(String(d.relationship || '').trim() || (c.source === 'partner' ? 'Partner / spouse' : ''));
    }
  };

  const saveCarer = () => {
    const name = String(cName).trim();
    if (!name) return;
    const { firstName, lastName } = splitName(name);
    const base = { ...emptyPersonRecord(), firstName, lastName, relationship: String(cRel).trim() };
    base._personRecordId = base._personRecordId || newRowId();
    setFormValues((prev) => {
      const next = { ...prev, petCarerData: [base] };
      return upsertRegistryContact(next, base);
    });
    setCPick('');
    setCName('');
    setCRel('');
    setCarerOpen(false);
  };

  const saveSubstitute = () => {
    const name = String(sName).trim();
    if (!name) return;
    const { firstName, lastName } = splitName(name);
    const base = { ...emptyPersonRecord(), firstName, lastName, relationship: String(sRel).trim() };
    base._personRecordId = base._personRecordId || newRowId();
    setFormValues((prev) => {
      const next = { ...prev, substitutePetCarerData: [base] };
      return upsertRegistryContact(next, base);
    });
    setSPick('');
    setSName('');
    setSRel('');
    setSubOpen(false);
  };

  const setPets = (v) => {
    if (v === 'No') {
      apply({
        provisionsForPets: 'No',
        petCarerData: [],
        substitutePetCarer: 'No',
        substitutePetCarerData: [],
        leavePetCareFund: 'No',
        amountToLeaveForPetCare: '',
        petCarerGift: '',
        personalGiftToPetCarer: 'No',
        petCarerPersonalGift: '',
        petsCaredForByRSPCA: 'No',
      });
      return;
    }
    setFormValues((p) => ({
      ...p,
      provisionsForPets: 'Yes',
      leavePetCareFund: p.leavePetCareFund ?? 'No',
      personalGiftToPetCarer: p.personalGiftToPetCarer ?? 'No',
    }));
  };

  const setSubstitute = (v) => {
    if (v === 'No') {
      apply({ substitutePetCarer: 'No', substitutePetCarerData: [] });
      return;
    }
    apply({ substitutePetCarer: 'Yes' });
  };

  const setCareFund = (v) => {
    if (v === 'No') {
      apply({ leavePetCareFund: 'No', amountToLeaveForPetCare: '', petCarerGift: '' });
      return;
    }
    apply({ leavePetCareFund: 'Yes' });
  };

  const setPersonalGift = (v) => {
    if (v === 'No') {
      apply({ personalGiftToPetCarer: 'No', petCarerPersonalGift: '' });
      return;
    }
    apply({ personalGiftToPetCarer: 'Yes' });
  };

  const setRelieve = (v) => {
    if (v === 'No') {
      apply({ relieveDebts: 'No', forgiveDebt: 'No', debtorData: [] });
      return;
    }
    apply({ relieveDebts: 'Yes', forgiveDebt: 'Yes' });
  };

  const addDebt = () => {
    const name = String(dName).trim();
    if (!name) return;
    const { firstName, lastName } = splitName(name);
    const row = {
      ...emptyPersonRecord(),
      firstName: firstName || name,
      lastName,
      relationship: String(dRel).trim(),
      _debtId: newRowId(),
      debtAmount: String(dAmount).trim(),
      debtNotes: String(dNotes).trim(),
    };
    if (dPick) {
      const c = getContactCandidates(formValues).find((x) => x.id === dPick);
      if (c?.data) {
        const d = c.data;
        if (d.firstName || d.lastName) {
          Object.assign(row, { firstName: d.firstName || row.firstName, lastName: d.lastName || row.lastName });
        }
      }
    }
    setFormValues((p) => {
      const list = Array.isArray(p.debtorData) ? [...p.debtorData, row] : [row];
      return { ...p, debtorData: list, relieveDebts: 'Yes', forgiveDebt: 'Yes' };
    });
    setDName('');
    setDRel('');
    setDAmount('');
    setDNotes('');
    setDPick('');
    setDebtOpen(false);
  };

  const removeDebt = (idx) => {
    setFormValues((p) => {
      const list = Array.isArray(p.debtorData) ? p.debtorData.filter((_, i) => i !== idx) : [];
      const next = { ...p, debtorData: list };
      if (list.length === 0) {
        next.relieveDebts = 'No';
        next.forgiveDebt = 'No';
      }
      return next;
    });
  };

  return (
    <div className="min-w-0 max-w-3xl space-y-0">
      {/* Q1 pets */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <StickyNote className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="m-0 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
          Would you like to make provision for your pets in your will?
        </h3>
      </div>
      <p className="mb-3 flex gap-2 text-xs italic leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">
          Pets cannot inherit money directly, but you can name someone to care for them, leave a care fund, and (separately) a
          personal thank-you gift to the carer.
        </span>
      </p>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Pet provisions">
        {[
          { v: 'No', t: "No — I don't need to make provision for pets", s: 'Or you are happy for your executors to decide what happens to them.' },
          { v: 'Yes', t: 'Yes — I would like to make provision for my pets', s: 'Name a carer, optional substitute, and any sums you wish to leave.' },
        ].map((o) => (
          <label
            key={o.v}
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2"
          >
            <input
              type="radio"
              className="mt-1 h-4 w-4 accent-indigo-600"
              name={`opg-pets-${uid}`}
              checked={formValues.provisionsForPets === o.v}
              onChange={() => setPets(o.v)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>

      {petYes ? (
        <div className="mb-6 space-y-5 rounded-lg border border-indigo-200/80 bg-slate-50/90 px-3 py-4 dark:border-slate-600 dark:bg-slate-800/60 sm:px-4">
          <div>
            <h4 className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">Who should care for your pets?</h4>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Name the person you would like to look after your pets. They are not obliged to accept, but this records your
              wishes.
            </p>
            {petCarerList.length === 0 ? (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">No pet carer added yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {petCarerList.map((p, i) => (
                  <li
                    key={p._personRecordId || i}
                    className="flex min-h-[44px] items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900/50"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
                        {initialsFromRow(p)}
                      </span>
                      <div className="min-w-0">
                        <p className="m-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {personLabel(p)}
                        </p>
                        {p.relationship ? (
                          <p className="m-0 truncate text-xs text-slate-500 dark:text-slate-400">{p.relationship}</p>
                        ) : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCarerOpen(true);
                        setCName('');
                        setCRel('');
                        setCPick('');
                      }}
                      className="shrink-0 text-xs text-slate-500 underline hover:text-red-500 dark:hover:text-red-400"
                    >
                      Replace
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {!carerOpen && petCarerList.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setCarerOpen(true);
                  setCName('');
                  setCRel('');
                  setCPick('');
                }}
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 dark:hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" />
                Add pet carer
              </button>
            ) : null}

            {carerOpen ? (
              <div className="mt-3 space-y-3 rounded-lg border border-dashed border-indigo-300 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-900/40">
                <p className="m-0 text-sm font-semibold text-indigo-800 dark:text-indigo-200">Name a pet carer</p>
                <SamePersonOrNew
                  formValues={formValues}
                  value={cPick}
                  onPick={applyCarerPick}
                  onClearPick={() => applyCarerPick('')}
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor={`opg-cn-${uid}`}>
                      Full name <span className="text-red-500">*</span>
                    </label>
                    <input
                      id={`opg-cn-${uid}`}
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      value={cName}
                      onChange={(e) => {
                        setCName(e.target.value);
                        setCPick('');
                      }}
                      placeholder="e.g. Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor={`opg-cr-${uid}`}>
                      Relationship <span className="text-slate-500">(optional)</span>
                    </label>
                    <input
                      id={`opg-cr-${uid}`}
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                      value={cRel}
                      onChange={(e) => setCRel(e.target.value)}
                      placeholder="e.g. my sister"
                    />
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"
                    onClick={() => {
                      setCarerOpen(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
                    onClick={saveCarer}
                  >
                    <Check className="h-4 w-4" />
                    Save
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border-t border-indigo-200/80 pt-4 dark:border-slate-600">
            <h4 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">Would you like a substitute pet carer?</h4>
            <p className="mb-2 mt-1 text-xs text-slate-600 dark:text-slate-300">If your first choice cannot help, who should be asked next?</p>
            <div className="flex flex-col gap-1" role="radiogroup" aria-label="Substitute pet carer">
              {[
                { v: 'No', t: 'No substitute carer' },
                { v: 'Yes', t: 'Yes — name a substitute carer' },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                >
                  <input
                    type="radio"
                    className="mt-1 h-4 w-4 accent-indigo-600"
                    name={`opg-subq-${uid}`}
                    checked={formValues.substitutePetCarer === o.v}
                    onChange={() => setSubstitute(o.v)}
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
                </label>
              ))}
            </div>
            {formValues.substitutePetCarer === 'Yes' ? (
              <div className="mt-3">
                {subList.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">No substitute carer yet.</p>
                ) : (
                  <ul className="mb-2 space-y-2">
                    {subList.map((p, i) => (
                      <li
                        key={p._personRecordId || i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 dark:border-slate-600 dark:bg-slate-900/50"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200">
                            {initialsFromRow(p)}
                          </span>
                          <div className="min-w-0">
                            <p className="m-0 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {personLabel(p)}
                            </p>
                            {p.relationship ? (
                              <p className="m-0 truncate text-xs text-slate-500 dark:text-slate-400">{p.relationship}</p>
                            ) : null}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSubOpen(true);
                            setSName('');
                            setSRel('');
                            setSPick('');
                          }}
                          className="shrink-0 text-xs text-slate-500 underline hover:text-red-500"
                        >
                          Replace
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSubOpen(true);
                    setSName('');
                    setSRel('');
                    setSPick('');
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" />
                  {subList.length ? 'Add or change substitute' : 'Add substitute pet carer'}
                </button>
                {subOpen ? (
                  <div className="mt-3 space-y-3 rounded-lg border border-dashed border-indigo-300 bg-white px-3 py-3 dark:border-slate-600 dark:bg-slate-900/40">
                    <p className="m-0 text-sm font-semibold text-indigo-800 dark:text-indigo-200">Name a substitute pet carer</p>
                    <SamePersonOrNew
                      formValues={formValues}
                      value={sPick}
                      onPick={applySubPick}
                      onClearPick={() => applySubPick('')}
                    />
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label
                          className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200"
                          htmlFor={`opg-sn-${uid}`}
                        >
                          Full name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id={`opg-sn-${uid}`}
                          className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                          value={sName}
                          onChange={(e) => {
                            setSName(e.target.value);
                            setSPick('');
                          }}
                          placeholder="e.g. Robert Jones"
                        />
                      </div>
                      <div>
                        <label
                          className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200"
                          htmlFor={`opg-sr-${uid}`}
                        >
                          Relationship <span className="text-slate-500">(optional)</span>
                        </label>
                        <input
                          id={`opg-sr-${uid}`}
                          className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
                          value={sRel}
                          onChange={(e) => setSRel(e.target.value)}
                          placeholder="e.g. my brother"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"
                        onClick={() => setSubOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
                        onClick={saveSubstitute}
                      >
                        <Check className="h-4 w-4" />
                        Save
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Care fund Q3 */}
          <div>
            <h4 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">Leave a sum for your pets’ ongoing care?</h4>
            <p className="mb-2 mt-1 text-xs text-slate-600 dark:text-slate-300">
              Ring-fenced for vet bills, food, and welfare — not a personal gift to the carer (the next question covers that).
            </p>
            <div className="flex flex-col gap-1" role="radiogroup" aria-label="Pet care fund">
              {[
                { v: 'No', t: 'No care fund' },
                { v: 'Yes', t: 'Yes — leave a care fund' },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                >
                  <input
                    type="radio"
                    className="mt-1 h-4 w-4 accent-indigo-600"
                    name={`opg-care-${uid}`}
                    checked={formValues.leavePetCareFund === o.v}
                    onChange={() => setCareFund(o.v)}
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
                </label>
              ))}
            </div>
            {formValues.leavePetCareFund === 'Yes' ? (
              <div className="mt-2 max-w-xs">
                <label className="mb-1 block text-xs text-slate-700 dark:text-slate-200" htmlFor={`opg-care-amt-${uid}`}>
                  Amount (£)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">£</span>
                  <input
                    id={`opg-care-amt-${uid}`}
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white py-2.5 pl-7 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={formValues.amountToLeaveForPetCare ?? formValues.petCarerGift ?? ''}
                    onChange={(e) =>
                      apply({ amountToLeaveForPetCare: e.target.value, petCarerGift: e.target.value })
                    }
                    placeholder="e.g. 3000"
                    inputMode="decimal"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Personal gift Q4 */}
          <div>
            <h4 className="m-0 text-sm font-bold text-slate-900 dark:text-slate-100">Personal gift of money to the carer?</h4>
            <p className="mb-2 mt-1 text-xs text-slate-600 dark:text-slate-300">Separate from any care fund — a thank-you they may keep.</p>
            <div className="flex flex-col gap-1" role="radiogroup" aria-label="Gift to pet carer">
              {[
                { v: 'No', t: 'No personal gift' },
                { v: 'Yes', t: 'Yes — a personal gift to the carer' },
              ].map((o) => (
                <label
                  key={o.v}
                  className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-100/80 dark:hover:bg-slate-800/60"
                >
                  <input
                    type="radio"
                    className="mt-1 h-4 w-4 accent-indigo-600"
                    name={`opg-pg-${uid}`}
                    checked={formValues.personalGiftToPetCarer === o.v}
                    onChange={() => setPersonalGift(o.v)}
                  />
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
                </label>
              ))}
            </div>
            {formValues.personalGiftToPetCarer === 'Yes' ? (
              <div className="mt-2 max-w-xs">
                <label className="mb-1 block text-xs text-slate-700 dark:text-slate-200" htmlFor={`opg-pgift-${uid}`}>
                  Gift amount (£)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">£</span>
                  <input
                    id={`opg-pgift-${uid}`}
                    className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white py-2.5 pl-7 pr-3 text-sm dark:border-slate-600 dark:bg-slate-800"
                    value={formValues.petCarerPersonalGift ?? ''}
                    onChange={(e) => apply({ petCarerPersonalGift: e.target.value })}
                    placeholder="e.g. 500"
                    inputMode="decimal"
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* RSPCA — compact */}
          <div className="rounded-lg border border-slate-200 bg-white/60 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/30">
            <h4 className="m-0 text-xs font-bold text-slate-800 dark:text-slate-200">RSPCA Home for Life (optional)</h4>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">If no carer can help, should your pets be offered to the RSPCA scheme?</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="RSPCA">
              {['No', 'Yes'].map((o) => (
                <label
                  key={o}
                  className="inline-flex min-h-[44px] min-w-[100px] cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-600"
                >
                  <input
                    type="radio"
                    className="h-4 w-4 accent-indigo-600"
                    name={`opg-rspca-${uid}`}
                    checked={formValues.petsCaredForByRSPCA === o}
                    onChange={() => apply({ petsCaredForByRSPCA: o })}
                  />
                  {o}
                </label>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <hr className="mb-5 border-slate-200 dark:border-slate-600" />

      {/* Q5 debt */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <StickyNote className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">Release anyone from a debt they owe you?</h3>
      </div>
      <p className="mb-2 text-xs text-slate-600 dark:text-slate-300">
        This matches the “debts to forgive” step in Personal Chattels: it uses the same list for your will file and PDF.
      </p>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Release debts">
        {[
          { v: 'No', t: "No — don't release debts in this will", s: 'Amounts owed to you stay as part of your estate.' },
          { v: 'Yes', t: 'Yes — release one or more debts', s: 'Name each person and, if you can, the amount and a short note.' },
        ].map((o) => (
          <label
            key={o.v}
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2"
          >
            <input
              type="radio"
              className="mt-1 h-4 w-4 accent-indigo-600"
              name={`opg-debt-${uid}`}
              checked={formValues.relieveDebts === o.v}
              onChange={() => setRelieve(o.v)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>
      {formValues.relieveDebts === 'Yes' ? (
        <div className="mb-2 space-y-2">
          {debtList.length === 0 ? (
            <p className="m-0 text-sm text-slate-600 dark:text-slate-300">No one added yet.</p>
          ) : (
            debtList.map((d, i) => (
              <div
                key={d._debtId || i}
                className="flex min-h-[44px] items-start justify-between gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/50"
              >
                <div className="min-w-0">
                  <p className="m-0 break-words text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {[d.firstName, d.lastName].filter(Boolean).join(' ') || '—'}
                  </p>
                  {d.debtAmount ? (
                    <p className="m-0 text-sm font-medium text-indigo-600 dark:text-indigo-300">{d.debtAmount}</p>
                  ) : null}
                  {d.debtNotes ? (
                    <p className="m-0 break-words text-xs text-slate-500 dark:text-slate-400">{d.debtNotes}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeDebt(i)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-red-500"
                >
                  Remove
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              setDebtOpen(true);
              setDName('');
              setDRel('');
              setDAmount('');
              setDNotes('');
              setDPick('');
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Add debtor
          </button>
        </div>
      ) : null}

      {debtOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="opg-debt-modal fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4 dark:bg-black/60"
              onClick={(e) => e.target === e.currentTarget && setDebtOpen(false)}
              role="presentation"
            >
              <div
                className="questionnaire-modal-panel my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h4 className="m-0 min-w-0 pr-2 text-lg font-bold text-slate-900 dark:text-slate-100">Add a person to release from debt</h4>
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                    aria-label="Close"
                    onClick={() => setDebtOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {getContactCandidates(formValues).length > 0 ? (
                  <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Same person or new</label>
                    <select
                      className="w-full min-h-[44px] rounded-lg border-2 border-indigo-500 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-500 dark:bg-slate-800 dark:text-slate-100"
                      value={dPick}
                      onChange={(e) => {
                        const id = e.target.value;
                        setDPick(id);
                        if (id) {
                          const c = getContactCandidates(formValues).find((x) => x.id === id);
                          if (c?.data) {
                            const d = c.data;
                            const n = [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ').trim() || personDisplayNameForGift(c.data);
                            setDName(n);
                          }
                        }
                      }}
                    >
                      <option value="">Enter a new name</option>
                      {getContactCandidates(formValues).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300" htmlFor="opg-dname">
                  Full name <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="opg-dname"
                  className="mb-3 w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                  value={dName}
                  onChange={(e) => {
                    setDName(e.target.value);
                    setDPick('');
                  }}
                  placeholder="e.g. James Smith"
                />
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400" htmlFor="opg-drel">
                  Relationship (optional)
                </label>
                <input
                  id="opg-drel"
                  className="mb-3 w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={dRel}
                  onChange={(e) => setDRel(e.target.value)}
                  placeholder="e.g. my son"
                />
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300" htmlFor="opg-damt">
                  Amount owed (optional)
                </label>
                <input
                  id="opg-damt"
                  className="mb-3 w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={dAmount}
                  onChange={(e) => setDAmount(e.target.value)}
                  placeholder="e.g. 10000"
                />
                <label className="mb-1 block text-xs text-slate-600 dark:text-slate-400" htmlFor="opg-dnotes">
                  Notes (optional)
                </label>
                <input
                  id="opg-dnotes"
                  className="mb-4 w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={dNotes}
                  onChange={(e) => setDNotes(e.target.value)}
                  placeholder="e.g. House deposit loan, 2019"
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                    onClick={() => setDebtOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    onClick={addDebt}
                  >
                    <Check className="h-4 w-4" />
                    Save
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
