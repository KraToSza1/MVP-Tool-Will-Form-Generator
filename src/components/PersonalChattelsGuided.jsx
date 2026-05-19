/**
 * Personal Chattels — guided section (April 2026). Maps to existing will field IDs.
 * No duplicate section title (FormRenderer card provides it).
 */
import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, FileText, Info, Plus, ScrollText, StickyNote, Wallet, X } from 'lucide-react';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import { emptyPersonRecord } from '../utils/personRecordSpecs.js';

function newId() {
  return `pch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function splitName(full) {
  const s = String(full || '').trim();
  if (!s) return { firstName: '', lastName: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

/** Used by FormRenderer validation / completion checks. */
export function isPersonalChattelsGuidedComplete(values) {
  const v = values || {};
  const a = v.unspecifiedChattelsAction;
  if (a !== 'SameAsResidue' && a !== 'SpecificRecipient' && a !== 'DistributedByExecutors') return false;
  if (a === 'SpecificRecipient') {
    const guided = String(v.chattelGuidedRecipientName || '').trim();
    const data = v.chattelRecipientData;
    const hasRow =
      Array.isArray(data) &&
      data.length > 0 &&
      (String(data[0]?.firstName || '').trim() || String(data[0]?.lastName || '').trim());
    if (!guided && !hasRow) return false;
  }
  const iht = v.chattelsInheritanceTax;
  if (iht !== 'PaidByEstate' && iht !== 'PaidByRecipient') return false;
  const mem = v.produceMemorandum;
  if (mem !== 'Yes' && mem !== 'No') return false;
  const gift = v.personalChattelsGift;
  if (gift !== 'No' && gift !== 'ResidueIncluded' && gift !== 'Beneficiary') return false;
  if (gift === 'Beneficiary' && !String(v.chattelsGiftBeneficiaryName || '').trim()) return false;
  const fd = v.forgiveDebt;
  if (fd !== 'Yes' && fd !== 'No') return false;
  if (fd === 'Yes') {
    const list = v.debtorData;
    const has = Array.isArray(list) && list.some((d) => String(d?.firstName || '').trim() || String(d?.lastName || '').trim());
    if (!has) return false;
  }
  return true;
}

const PCH_FIELD_ID = 'personalChattelsGuided';

/** @returns {Array<{ fieldId: string, fieldLabel: string, message: string, type: string }>} */
export function getPersonalChattelsGuidedValidationIssues(v) {
  const issues = [];
  const a = v.unspecifiedChattelsAction;
  if (a !== 'SameAsResidue' && a !== 'SpecificRecipient' && a !== 'DistributedByExecutors') {
    issues.push({
      fieldId: PCH_FIELD_ID,
      fieldLabel: 'Personal chattels — general possessions',
      message: 'Please choose what should happen to your personal possessions that are not specifically named in your will.',
      type: 'required',
    });
  } else if (a === 'SpecificRecipient') {
    const guided = String(v.chattelGuidedRecipientName || '').trim();
    const data = v.chattelRecipientData;
    const hasRow =
      Array.isArray(data) &&
      data.length > 0 &&
      (String(data[0]?.firstName || '').trim() || String(data[0]?.lastName || '').trim());
    if (!guided && !hasRow) {
      issues.push({
        fieldId: PCH_FIELD_ID,
        fieldLabel: 'Personal chattels — recipient for general possessions',
        message: 'Please name who should receive your remaining personal possessions, or pick someone you have already added on this form.',
        type: 'required',
      });
    }
  }
  const iht = v.chattelsInheritanceTax;
  if (iht !== 'PaidByEstate' && iht !== 'PaidByRecipient') {
    issues.push({
      fieldId: PCH_FIELD_ID,
      fieldLabel: 'Personal chattels — tax on gifts',
      message: 'Please choose whether inheritance tax on gifts of personal possessions should be paid from your estate or by the recipient.',
      type: 'required',
    });
  }
  const mem = v.produceMemorandum;
  if (mem !== 'Yes' && mem !== 'No') {
    issues.push({
      fieldId: PCH_FIELD_ID,
      fieldLabel: 'Personal chattels — memorandum of wishes',
      message: 'Please say whether you would like a separate memorandum of wishes for small, everyday items.',
      type: 'required',
    });
  }
  const gift = v.personalChattelsGift;
  if (gift !== 'No' && gift !== 'ResidueIncluded' && gift !== 'Beneficiary') {
    issues.push({
      fieldId: PCH_FIELD_ID,
      fieldLabel: 'Personal chattels — how belongings are given',
      message: 'Please choose how your personal chattels should be dealt with in your will.',
      type: 'required',
    });
  } else if (gift === 'Beneficiary' && !String(v.chattelsGiftBeneficiaryName || '').trim()) {
    issues.push({
      fieldId: PCH_FIELD_ID,
      fieldLabel: 'Personal chattels — beneficiary for chattels',
      message: 'Please enter the full name of the person who should receive your personal chattels, or select someone you have already added.',
      type: 'required',
    });
  }
  const fd = v.forgiveDebt;
  if (fd !== 'Yes' && fd !== 'No') {
    issues.push({
      fieldId: PCH_FIELD_ID,
      fieldLabel: 'Personal chattels — debts',
      message: 'Please say whether you want to forgive any debts owed to you in your will.',
      type: 'required',
    });
  } else if (fd === 'Yes') {
    const list = v.debtorData;
    const has = Array.isArray(list) && list.some((d) => String(d?.firstName || '').trim() || String(d?.lastName || '').trim());
    if (!has) {
      issues.push({
        fieldId: PCH_FIELD_ID,
        fieldLabel: 'Personal chattels — debts to forgive',
        message: 'Add at least one debt you want to forgive, or change your answer to “No” if you do not want to release any debts in your will.',
        type: 'required',
      });
    }
  }
  return issues;
}

/** @param {{ formValues: object, setFormValues: Function, pickKey: string, nameKey: string, relKey: string, onPick: (id: string) => void }} p */
function SamePersonOrNewBlock({ formValues, setFormValues, pickKey, nameKey, relKey, onPick }) {
  const options = useMemo(() => {
    const raw = getContactCandidates(formValues || {});
    return raw.filter((c) => personDisplayNameForGift(c.data) !== '');
  }, [formValues]);
  return (
    <div>
      {options.length > 0 ? (
        <>
          <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200">Same person or new</label>
          <select
            className="w-full min-h-[44px] rounded-lg border-2 border-indigo-500 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-indigo-500 dark:bg-slate-900 dark:text-slate-100"
            value={formValues[pickKey] || ''}
            onChange={(e) => onPick(e.target.value)}
          >
            <option value="">Enter a new person</option>
            {options.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="mb-3 mt-1 text-xs text-slate-500 dark:text-slate-400">Select someone already in this form, or type new details below.</p>
        </>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor={`${nameKey}-i`}>
            Full name
          </label>
          <input
            id={`${nameKey}-i`}
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={formValues[nameKey] || ''}
            onChange={(e) => {
              setFormValues((prev) => ({ ...prev, [pickKey]: '', [nameKey]: e.target.value }));
            }}
            placeholder="Full name"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor={`${relKey}-i`}>
            Relationship <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id={`${relKey}-i`}
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={formValues[relKey] || ''}
            onChange={(e) => setFormValues((prev) => ({ ...prev, [relKey]: e.target.value }))}
            placeholder="e.g. my spouse, my daughter"
          />
        </div>
      </div>
    </div>
  );
}

/** @param {{ field: object, formValues: object, setFormValues: Function }} props */
export default function PersonalChattelsGuided({ formValues, setFormValues }) {
  const uid = useId();
  const [debtOpen, setDebtOpen] = useState(false);
  const [dPick, setDPick] = useState('');
  const [dName, setDName] = useState('');
  const [dAmount, setDAmount] = useState('');
  const [dNotes, setDNotes] = useState('');

  const apply = useCallback((patch) => setFormValues((p) => ({ ...p, ...patch })), [setFormValues]);

  const q1 = formValues.unspecifiedChattelsAction;
  const q4 = formValues.personalChattelsGift;
  const q5 = formValues.forgiveDebt;
  const debtorList = Array.isArray(formValues.debtorData) ? formValues.debtorData : [];

  useEffect(() => {
    if (formValues.unspecifiedChattelsAction !== 'SpecificRecipient') {
      setFormValues((p) => (p.chattelRecipientData === undefined ? p : { ...p, chattelRecipientData: undefined }));
      return;
    }
    const name = String(formValues.chattelGuidedRecipientName || '').trim();
    const rel = String(formValues.chattelGuidedRecipientRelationship || '').trim();
    const { firstName, lastName } = splitName(name);
    if (!firstName && !lastName) {
      setFormValues((p) => (p.chattelRecipientData?.length ? { ...p, chattelRecipientData: [] } : p));
      return;
    }
    const row = { ...emptyPersonRecord(), firstName, lastName, relationship: rel };
    setFormValues((p) => {
      const cur = Array.isArray(p.chattelRecipientData) ? p.chattelRecipientData[0] : null;
      if (
        cur &&
        cur.firstName === row.firstName &&
        cur.lastName === row.lastName &&
        (cur.relationship || '') === (row.relationship || '')
      ) {
        return p;
      }
      return { ...p, chattelRecipientData: [row] };
    });
  }, [
    formValues.unspecifiedChattelsAction,
    formValues.chattelGuidedRecipientName,
    formValues.chattelGuidedRecipientRelationship,
    setFormValues,
  ]);

  useEffect(() => {
    if (formValues.personalChattelsGift === 'Beneficiary') return;
    setFormValues((p) => {
      if (!p.chattelsGiftBeneficiaryName && !p.chattelsGiftBeneficiaryRelationship && !p.chattelGiftPick) return p;
      return {
        ...p,
        chattelsGiftBeneficiaryName: '',
        chattelsGiftBeneficiaryRelationship: '',
        chattelGiftPick: '',
      };
    });
  }, [formValues.personalChattelsGift, setFormValues]);

  useEffect(() => {
    const fd = String(formValues.forgiveDebt || '');
    if (fd === 'Yes' || fd === 'No') {
      setFormValues((p) => (p.relieveDebts === fd ? p : { ...p, relieveDebts: fd }));
    }
  }, [formValues.forgiveDebt, setFormValues]);

  const addDebt = () => {
    const name = String(dName).trim();
    if (!name) return;
    const { firstName, lastName } = splitName(name);
    const row = {
      ...emptyPersonRecord(),
      firstName: firstName || name,
      lastName,
      _debtId: newId(),
      debtAmount: String(dAmount).trim(),
      debtNotes: String(dNotes).trim(),
    };
    if (dPick) {
      const c = getContactCandidates(formValues || {}).find((x) => x.id === dPick);
      if (c?.data) {
        const d = c.data;
        if (d.firstName || d.lastName) {
          Object.assign(row, { firstName: d.firstName || row.firstName, lastName: d.lastName || row.lastName });
        }
      }
    }
    setFormValues((p) => {
      const list = Array.isArray(p.debtorData) ? [...p.debtorData, row] : [row];
      return { ...p, debtorData: list, forgiveDebt: 'Yes', relieveDebts: 'Yes' };
    });
    setDName('');
    setDAmount('');
    setDNotes('');
    setDPick('');
    setDebtOpen(false);
  };

  const removeDebt = (idx) => {
    setFormValues((p) => {
      const list = Array.isArray(p.debtorData) ? p.debtorData.filter((_, i) => i !== idx) : [];
      const next = { ...p, debtorData: list };
      if (list.length === 0 && p.forgiveDebt === 'Yes') {
        next.forgiveDebt = 'No';
        next.relieveDebts = 'No';
      }
      return next;
    });
  };

  return (
    <div className="min-w-0 max-w-3xl space-y-0">
      {/* Q1 */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="m-0 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
          What should happen to your personal possessions that aren&apos;t specifically named in your will?
        </h3>
      </div>
      <p className="mb-3 flex gap-2 text-xs italic leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">
          WHY WE ASK THIS: Your will may name specific items. Everything else (furniture, clothing, books, and so on) needs
          a fallback rule.
        </span>
      </p>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ['Same terms as my estate', 'Belongings follow the same split as the rest of your estate — a common, simple choice.'],
          ['To a named person', 'All remaining possessions go to one person you name — often a spouse.'],
          ['Left to my executors', 'Executors share things fairly at their discretion, guided by any wishes you leave.'],
        ].map(([t, s]) => (
          <div key={t} className="rounded-lg border border-indigo-200 bg-slate-50/90 px-3 py-2.5 dark:border-slate-600 dark:bg-slate-800/80">
            <p className="m-0 mb-1 text-xs font-semibold text-slate-900 dark:text-slate-100">{t}</p>
            <p className="m-0 text-xs text-slate-600 dark:text-slate-300">{s}</p>
          </div>
        ))}
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 dark:border-amber-500/40 dark:bg-amber-950/25 sm:col-span-2">
          <p className="m-0 text-xs font-semibold text-amber-900 dark:text-amber-100">Not sure?</p>
          <p className="m-0 text-xs text-amber-900/90 dark:text-amber-100/90">
            Most people choose the same terms as the residue — it is the simplest and avoids arguments.
          </p>
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Unspecified possessions">
        {[
          { v: 'SameAsResidue', t: 'Distribute them on the same terms as the rest of my estate', s: 'Belongings pass in the same proportions as the residue.' },
          { v: 'SpecificRecipient', t: 'Leave them all to a specific person I will name', s: 'One person receives all remaining personal possessions.' },
          { v: 'DistributedByExecutors', t: 'Leave it to my executors to distribute fairly', s: 'Executors divide belongings among the family, at their discretion.' },
        ].map((o) => (
          <label
            key={o.v}
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2"
          >
            <input
              type="radio"
              className="mt-1 h-4 w-4 accent-indigo-600"
              name={`pch-q1-${uid}`}
              checked={q1 === o.v}
              onChange={() => {
                const patch = { unspecifiedChattelsAction: o.v };
                if (o.v !== 'SpecificRecipient') {
                  patch.chattelGuidedRecipientName = '';
                  patch.chattelGuidedRecipientRelationship = '';
                  patch.chattelGuidedPick = '';
                  patch.chattelRecipientData = undefined;
                }
                apply(patch);
              }}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>
      {q1 === 'SpecificRecipient' ? (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/60 sm:px-4 sm:py-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Who should receive your remaining possessions?</h4>
          <SamePersonOrNewBlock
            formValues={formValues}
            setFormValues={setFormValues}
            pickKey="chattelGuidedPick"
            nameKey="chattelGuidedRecipientName"
            relKey="chattelGuidedRecipientRelationship"
            onPick={(id) => {
              setFormValues((p) => ({ ...p, chattelGuidedPick: id }));
              if (id) {
                const c = getContactCandidates(formValues).find((x) => x.id === id);
                if (c?.data) {
                  const d = c.data;
                  const n = [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ').trim() || personDisplayNameForGift(d);
                  const r = String(d.relationship || '').trim() || (c.source === 'partner' ? 'Partner / spouse' : '');
                  setFormValues((p) => ({ ...p, chattelGuidedRecipientName: n, chattelGuidedRecipientRelationship: r, chattelGuidedPick: id }));
                }
              }
            }}
          />
        </div>
      ) : (
        <div className="mb-6" />
      )}

      <hr className="mb-5 border-slate-200 dark:border-slate-600" />

      {/* Q2 IHT */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <Wallet className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="m-0 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
          If any of your gifts are subject to inheritance tax, who should pay it?
        </h3>
      </div>
      <p className="mb-3 flex gap-2 text-xs italic text-slate-600 sm:text-sm dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">This sets whether the estate pays the tax (so the gift is received in full) or the recipient pays.</span>
      </p>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Inheritance tax on gifts">
        {[
          { v: 'PaidByEstate', t: 'Paid from my estate — the recipient receives the full value', s: 'Tax is met from the residue / estate before or as part of distribution.' },
          { v: 'PaidByRecipient', t: 'Paid by the recipient — they receive the gift after tax', s: 'The person who receives the gift is responsible for any IHT due on it.' },
        ].map((o) => (
          <label key={o.v} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2">
            <input
              type="radio"
              name={`pch-iht-${uid}`}
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={formValues.chattelsInheritanceTax === o.v}
              onChange={() => apply({ chattelsInheritanceTax: o.v })}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>

      <hr className="mb-5 border-slate-200 dark:border-slate-600" />

      {/* Q3 memorandum */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <ScrollText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
          Would you like a separate memorandum of wishes for smaller, everyday items?
        </h3>
      </div>
      <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 dark:border-slate-600 dark:bg-indigo-950/20">
        <p className="m-0 text-xs font-bold uppercase tracking-wide text-indigo-800 dark:text-indigo-200">What is a memorandum of wishes?</p>
        <p className="m-0 mt-1 text-sm text-slate-800 dark:text-slate-200">
          An informal letter (not part of the will) listing who you would like to have specific low-value items. Executors
          can follow it, but it is not legally binding. It can be updated without re-signing the will.
        </p>
      </div>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Choosing Yes does not require you to write it today — your solicitor can help.</p>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Memorandum">
        {[
          { v: 'No', t: "No — I don't need a memorandum of wishes", s: 'Executors will use their judgment for everyday items.' },
          { v: 'Yes', t: 'Yes — I would like a memorandum of wishes', s: 'You can agree wording with your solicitor when finalising the will.' },
        ].map((o) => (
          <label key={o.v} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2">
            <input
              type="radio"
              name={`pch-mem-${uid}`}
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={formValues.produceMemorandum === o.v}
              onChange={() => apply({ produceMemorandum: o.v })}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>
      {formValues.produceMemorandum === 'Yes' ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 dark:border-emerald-500/40 dark:bg-emerald-950/20">
          <p className="m-0 text-sm text-emerald-900 dark:text-emerald-100">
            <strong>Noted.</strong> Your solicitor can help you prepare a memorandum alongside your will and update it later
            without re-executing the will.
          </p>
        </div>
      ) : null}

      <hr className="mb-5 border-slate-200 dark:border-slate-600" />

      {/* Q4 chattels gift */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">How should your personal chattels be dealt with in your will?</h3>
      </div>
      <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">“Personal chattels” means everyday belongings — not cash, property, or business assets.</p>
      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-600 dark:bg-slate-800/60">
          <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">Included</p>
          <p className="m-0 text-slate-600 dark:text-slate-300">Clothes, furniture, cars, jewellery, household contents</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-600 dark:bg-slate-800/60">
          <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">Not included here</p>
          <p className="m-0 text-slate-600 dark:text-slate-300">Cash, investments, business interests, land and buildings</p>
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Personal chattels gift">
        {[
          { v: 'No', t: 'No specific instruction — they form part of my general estate', s: 'Chattels are dealt with under the general terms of the will without a stand-alone gift clause.' },
          { v: 'ResidueIncluded', t: 'Include them with the residuary estate', s: 'Chattels are part of the residue — whoever takes the residue receives them in that share.' },
          { v: 'Beneficiary', t: 'Leave them to a specific person I will name', s: 'All personal chattels are given outright to that person.' },
        ].map((o) => (
          <label key={o.v} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2">
            <input
              type="radio"
              name={`pch-cg-${uid}`}
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={q4 === o.v}
              onChange={() => {
                const patch = { personalChattelsGift: o.v };
                if (o.v !== 'Beneficiary') {
                  patch.chattelsGiftBeneficiaryName = '';
                  patch.chattelsGiftBeneficiaryRelationship = '';
                  patch.chattelGiftPick = '';
                }
                apply(patch);
              }}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>
      {q4 === 'Beneficiary' ? (
        <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/60 sm:px-4">
          <h4 className="m-0 mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Who should receive your personal chattels?</h4>
          <SamePersonOrNewBlock
            formValues={formValues}
            setFormValues={setFormValues}
            pickKey="chattelGiftPick"
            nameKey="chattelsGiftBeneficiaryName"
            relKey="chattelsGiftBeneficiaryRelationship"
            onPick={(id) => {
              if (id) {
                const c = getContactCandidates(formValues).find((x) => x.id === id);
                if (c?.data) {
                  const d = c.data;
                  const n = [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ').trim() || personDisplayNameForGift(d);
                  apply({
                    chattelGiftPick: id,
                    chattelsGiftBeneficiaryName: n,
                    chattelsGiftBeneficiaryRelationship: String(d.relationship || '').trim() || (c.source === 'partner' ? 'Partner / spouse' : ''),
                  });
                  return;
                }
              }
              apply({ chattelGiftPick: id || '' });
            }}
          />
        </div>
      ) : null}

      <hr className="mb-5 border-slate-200 dark:border-slate-600" />

      {/* Q5 debts */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <StickyNote className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">Would you like to forgive any debts owed to you when you die?</h3>
      </div>
      <p className="mb-2 flex gap-2 text-xs text-slate-600 sm:text-sm dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0">You can release loans or IOUs so they are not collected from your estate after your death.</span>
      </p>
      <div className="mb-3 rounded-lg border border-indigo-200 bg-indigo-50/80 px-3 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-200">
        <p className="m-0 font-semibold text-indigo-900 dark:text-indigo-200">What counts as a debt?</p>
        <p className="m-0 mt-1 text-xs leading-relaxed">Money you lent that is still outstanding — for example a loan to a family member. Your solicitor can confirm the wording.</p>
      </div>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Forgive debts">
        {[
          { v: 'No', t: "No — I don't want to forgive any debts in my will", s: 'Money owed to you remains an asset of your estate unless dealt with elsewhere.' },
          { v: 'Yes', t: 'Yes — I want to forgive one or more debts', s: 'Add each debtor below. Names appear in the debt-release clause; amounts and notes are for your file.' },
        ].map((o) => (
          <label key={o.v} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2">
            <input
              type="radio"
              name={`pch-fd-${uid}`}
              className="mt-1 h-4 w-4 accent-indigo-600"
              checked={q5 === o.v}
              onChange={() => {
                if (o.v === 'No') {
                  apply({ forgiveDebt: 'No', relieveDebts: 'No', debtorData: [] });
                } else {
                  apply({ forgiveDebt: 'Yes', relieveDebts: 'Yes' });
                }
              }}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>
      {q5 === 'Yes' ? (
        <div className="mb-2 space-y-2">
          {debtorList.length === 0 ? (
            <p className="m-0 text-sm text-slate-600 dark:text-slate-300">No debts added yet. Use Add a debt to forgive.</p>
          ) : (
            debtorList.map((d, i) => (
              <div
                key={d._debtId || i}
                className="flex items-start justify-between gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/50"
              >
                <div className="min-w-0">
                  <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {[d.firstName, d.lastName].filter(Boolean).join(' ') || '—'}
                  </p>
                  {d.debtAmount ? <p className="m-0 text-sm font-medium text-indigo-600 dark:text-indigo-300">{d.debtAmount}</p> : null}
                  {d.debtNotes ? <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{d.debtNotes}</p> : null}
                </div>
                <button
                  type="button"
                  onClick={() => removeDebt(i)}
                  className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400"
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
              setDAmount('');
              setDNotes('');
              setDPick('');
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 dark:hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add a debt to forgive
          </button>
        </div>
      ) : null}

      {debtOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
              onClick={(e) => e.target === e.currentTarget && setDebtOpen(false)}
              role="presentation"
            >
              <div
                className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h4 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">Add a debt to forgive</h4>
                  <button type="button" className="rounded p-1 text-slate-500 min-h-[44px] min-w-[44px]" aria-label="Close" onClick={() => setDebtOpen(false)}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {getContactCandidates(formValues).length > 0 ? (
                  <div className="mb-3">
                    <label className="mb-1 block text-xs text-slate-700 dark:text-slate-300">Same person or new</label>
                    <select
                      className="w-full min-h-[44px] rounded-lg border-2 border-indigo-500 bg-white px-3 py-2 text-sm dark:border-indigo-500 dark:bg-slate-800"
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
                <label className="mb-1 block text-xs text-slate-700 dark:text-slate-300" htmlFor="d-name">
                  Name of person who owes you
                </label>
                <input
                  id="d-name"
                  className="mb-3 w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  value={dName}
                  onChange={(e) => {
                    setDName(e.target.value);
                    setDPick('');
                  }}
                />
                <label className="mb-1 block text-xs">Amount (optional)</label>
                <input
                  className="mb-3 w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  value={dAmount}
                  onChange={(e) => setDAmount(e.target.value)}
                  placeholder="e.g. £5,000"
                />
                <label className="mb-1 block text-xs">Notes (optional)</label>
                <textarea
                  className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                  rows={2}
                  value={dNotes}
                  onChange={(e) => setDNotes(e.target.value)}
                  placeholder="e.g. Loan for house deposit, March 2021"
                />
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="min-h-[44px] rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-600"
                    onClick={() => setDebtOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white"
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
