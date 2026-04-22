/**
 * Deliberate Exclusions — guided section (April 2026). Maps to existing will field IDs.
 * No duplicate section title (FormRenderer card provides it).
 */
import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Info, Plus, UserX, X } from 'lucide-react';
import { getContactCandidates, personDisplayNameForGift, upsertRegistryContact } from '../lib/personRegistry.js';
import { emptyPersonRecord } from '../utils/personRecordSpecs.js';

const FIELD_ID = 'deliberateExclusionsGuided';

function newRowId() {
  return `dex-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function splitName(full) {
  const s = String(full || '').trim();
  if (!s) return { firstName: '', lastName: '' };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export function isDeliberateExclusionsGuidedComplete(v) {
  const x = v || {};
  if (x.deliberatelyExcludingAnyone !== 'Yes' && x.deliberatelyExcludingAnyone !== 'No') return false;
  if (x.deliberatelyExcludingAnyone === 'Yes') {
    const list = x.excludedPersonData;
    const has = Array.isArray(list) && list.some((p) => String(p?.firstName || '').trim() || String(p?.lastName || '').trim());
    if (!has) return false;
  }
  if (x.spouseBenefitOnDivorce !== 'Yes' && x.spouseBenefitOnDivorce !== 'No') return false;
  if (x.stopGiftToChildrenOnFail !== 'Yes' && x.stopGiftToChildrenOnFail !== 'No') return false;
  return true;
}

/** @returns {Array<{ fieldId: string, fieldLabel: string, message: string, type: string }>} */
export function getDeliberateExclusionsGuidedValidationIssues(v) {
  const issues = [];
  if (v.deliberatelyExcludingAnyone !== 'Yes' && v.deliberatelyExcludingAnyone !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Deliberate exclusions',
      message: 'Please say whether you are deliberately leaving someone out of your will who might challenge it or make a claim.',
      type: 'required',
    });
  } else if (v.deliberatelyExcludingAnyone === 'Yes') {
    const list = v.excludedPersonData;
    const has = Array.isArray(list) && list.some((p) => String(p?.firstName || '').trim() || String(p?.lastName || '').trim());
    if (!has) {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Deliberate exclusions — excluded people',
        message: 'Add at least one excluded person, or change your answer to “No” if you are not deliberately excluding anyone.',
        type: 'required',
      });
    }
  }
  if (v.spouseBenefitOnDivorce !== 'Yes' && v.spouseBenefitOnDivorce !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Deliberate exclusions — divorce',
      message: 'Please choose whether a former spouse or civil partner should still benefit from this will if you divorce or your marriage is annulled.',
      type: 'required',
    });
  }
  if (v.stopGiftToChildrenOnFail !== 'Yes' && v.stopGiftToChildrenOnFail !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Deliberate exclusions — children’s shares',
      message: 'Please say whether a child’s share should still pass to their children (your grandchildren) if a child dies before you.',
      type: 'required',
    });
  }
  return issues;
}

function DexSamePersonOrNew({ formValues, pickValue, onPick, nameVal, relVal, reasonVal, onName, onRel, onReason, nameInputId, relInputId, reasonInputId }) {
  const options = React.useMemo(() => {
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
            value={pickValue}
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
          <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor={nameInputId}>
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id={nameInputId}
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            value={nameVal}
            onChange={(e) => onName(e.target.value)}
            placeholder="e.g. John Smith"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor={relInputId}>
            Relationship to you <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id={relInputId}
            className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
            value={relVal}
            onChange={(e) => onRel(e.target.value)}
            placeholder="e.g. estranged son, former partner"
          />
        </div>
      </div>
      <div className="mt-3">
        <label className="mb-1.5 block text-xs font-medium text-slate-800 dark:text-slate-200" htmlFor={reasonInputId}>
          Reason for exclusion <span className="text-slate-500">(optional but strongly recommended)</span>
        </label>
        <input
          id={reasonInputId}
          className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-800"
          value={reasonVal}
          onChange={(e) => onReason(e.target.value)}
          placeholder="e.g. We have had no contact for over 10 years"
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          This supports your file with your solicitor. It is not part of the will wording in the same way as name and address.
        </p>
      </div>
    </div>
  );
}

export default function DeliberateExclusionsGuided({ field: _field, formValues, setFormValues }) {
  const uid = useId();
  const [addOpen, setAddOpen] = useState(false);
  const [dPick, setDPick] = useState('');
  const [dName, setDName] = useState('');
  const [dRel, setDRel] = useState('');
  const [dReason, setDReason] = useState('');

  const q1 = formValues.deliberatelyExcludingAnyone;
  const list = Array.isArray(formValues.excludedPersonData) ? formValues.excludedPersonData : [];

  const applyPick = (id) => {
    setDPick(id || '');
    if (!id) {
      setDName('');
      setDRel('');
      return;
    }
    const c = getContactCandidates(formValues).find((x) => x.id === id);
    if (c?.data) {
      const d = c.data;
      const n = [d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ').trim() || personDisplayNameForGift(d);
      setDName(n);
      setDRel(String(d.relationship || '').trim() || (c.source === 'partner' ? 'Partner / spouse' : ''));
    }
  };

  const saveExcluded = () => {
    const name = String(dName).trim();
    if (!name) return;
    const { firstName, lastName } = splitName(name);
    if (!firstName && !lastName) return;
    const base = { ...emptyPersonRecord(), firstName, lastName, relationship: String(dRel).trim() };
    if (dReason) base.exclusionReason = String(dReason).trim();
    base._personRecordId = base._personRecordId || newRowId();
    setFormValues((prev) => {
      const prevList = Array.isArray(prev.excludedPersonData) ? prev.excludedPersonData : [];
      const nextList = [...prevList, base];
      let next = { ...prev, excludedPersonData: nextList };
      next = upsertRegistryContact(next, base);
      return next;
    });
    setDPick('');
    setDName('');
    setDRel('');
    setDReason('');
    setAddOpen(false);
  };

  const removeAt = (idx) => {
    setFormValues((p) => {
      const a = Array.isArray(p.excludedPersonData) ? p.excludedPersonData.filter((_, i) => i !== idx) : [];
      return { ...p, excludedPersonData: a };
    });
  };

  return (
    <div className="min-w-0 max-w-3xl space-y-0">
      {/* Q1 */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <UserX className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        </div>
        <h3 className="m-0 text-base font-bold leading-snug text-slate-900 dark:text-slate-100">
          Are you deliberately leaving someone out of your will who might challenge it or make a claim against your estate?
        </h3>
      </div>
      <p className="mb-3 flex gap-2 text-xs italic leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">
          Certain people can bring claims under the Inheritance (Provision for Family and Dependants) Act 1975. If you are deliberately excluding someone, your
          solicitor can advise on wording and a confidential side letter to your executors.
        </span>
      </p>
      <div className="mb-3 rounded-lg border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 dark:border-amber-500/30 dark:bg-amber-950/20">
        <p className="m-0 text-sm font-semibold text-amber-900 dark:text-amber-100">Important</p>
        <p className="m-0 mt-1 text-xs leading-relaxed text-amber-900/95 dark:text-amber-100/90">
          Some specialists believe a formal exclusion clause can invite a claim. If you proceed, a confidential side letter to your executors is often
          recommended.
        </p>
      </div>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Deliberate exclusion">
        {[
          { v: 'No', t: "No — I'm not deliberately excluding anyone", s: 'Your will reflects your wishes without naming someone as formally excluded here.' },
          {
            v: 'Yes',
            t: 'Yes — I am deliberately leaving someone out who may challenge the will',
            s: 'Name each person below. Your solicitor will advise on the final clause.',
          },
        ].map((o) => (
          <label
            key={o.v}
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2"
          >
            <input
              type="radio"
              className="mt-1 h-4 w-4 accent-indigo-600"
              name={`dex-q1-${uid}`}
              checked={q1 === o.v}
              onChange={() => {
                const patch = { deliberatelyExcludingAnyone: o.v };
                if (o.v !== 'Yes') patch.excludedPersonData = [];
                setFormValues((p) => ({ ...p, ...patch }));
              }}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>

      {q1 === 'Yes' ? (
        <div className="mb-6 space-y-3 rounded-lg border border-indigo-200/80 bg-slate-50/90 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/50 sm:px-4 sm:py-4">
          <p className="m-0 text-sm font-semibold text-indigo-800 dark:text-indigo-200">Who are you excluding?</p>
          <p className="m-0 text-xs text-slate-600 dark:text-slate-300">Add each person. Your solicitor can refine the clause and any side letter.</p>
          {list.length === 0 ? (
            <p className="m-0 text-sm text-slate-600 dark:text-slate-300">No excluded people added yet.</p>
          ) : (
            <ul className="m-0 list-none space-y-2 p-0">
              {list.map((row, i) => (
                <li
                  key={row._personRecordId || i}
                  className="flex items-start justify-between gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/40"
                >
                  <div className="min-w-0">
                    <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {[row.firstName, row.lastName].filter(Boolean).join(' ') || '—'}
                    </p>
                    {row.relationship ? <p className="m-0 text-xs text-slate-500 dark:text-slate-400">{row.relationship}</p> : null}
                    {row.exclusionReason ? (
                      <p className="m-0 text-xs italic text-slate-500 dark:text-slate-400">{row.exclusionReason}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setAddOpen(true);
              setDPick('');
              setDName('');
              setDRel('');
              setDReason('');
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 dark:hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Add excluded person
          </button>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/90 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-100">
            <strong>Next step:</strong> your solicitor can confirm whether a formal exclusion clause is right and can prepare a confidential side letter for your
            executors if needed.
          </div>
        </div>
      ) : null}

      <hr className="mb-5 border-slate-200 dark:border-slate-600" />

      {/* Q2 s.18A */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <Info className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
          If you and your spouse or civil partner later divorce or have your marriage annulled, should they still be able to benefit from this will?
        </h3>
      </div>
      <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
        Under section 18A of the Wills Act 1837, gifts to a former spouse or civil partner usually fail when the marriage or civil partnership ends. This question
        is only if you want to override that (unusual; take legal advice).
      </p>
      <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-800 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-200 sm:text-sm">
        <p className="m-0">
          <strong className="text-slate-900 dark:text-slate-100">No (standard):</strong> a former spouse or civil partner does not keep gifts or roles under this
          will after divorce or annulment.
        </p>
        <p className="m-0 mt-2">
          <strong className="text-slate-900 dark:text-slate-100">Yes (override):</strong> they would still benefit in line with this will. Only if you have agreed
          this with your solicitor.
        </p>
      </div>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Spouse after divorce">
        {[
          {
            v: 'No',
            t: 'No — if we divorce, they should no longer benefit from this will',
            s: 'The usual legal position: section 18A can remove their benefit when the marriage or civil partnership ends.',
          },
          {
            v: 'Yes',
            t: 'Yes — they should still benefit even if we later divorce or have the marriage annulled',
            s: 'Overrides section 18A. Unusual. Read the warning if you select this.',
          },
        ].map((o) => (
          <label
            key={o.v}
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2"
          >
            <input
              type="radio"
              className="mt-1 h-4 w-4 accent-indigo-600"
              name={`dex-spouse-${uid}`}
              checked={formValues.spouseBenefitOnDivorce === o.v}
              onChange={() => setFormValues((p) => ({ ...p, spouseBenefitOnDivorce: o.v }))}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>
      {formValues.spouseBenefitOnDivorce === 'Yes' ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50/90 px-3 py-2.5 text-sm text-red-900 dark:border-red-500/40 dark:bg-red-950/30 dark:text-red-100">
          <p className="m-0 font-bold">Legal warning</p>
          <p className="m-0 mt-1 text-xs leading-relaxed">
            You are asking to disapply section 18A. Your former spouse or civil partner could keep benefits and appointments (for example as executor) even after
            divorce or annulment. Not all separations stay amicable. Your solicitor will want to discuss this in detail.
          </p>
        </div>
      ) : (
        <div className="mb-6" />
      )}

      <hr className="mb-5 border-slate-200 dark:border-slate-600" />

      {/* Q3 s.33 — form field stopGiftToChildrenOnFail: No = s.33 applies, Yes = exclude s.33 */}
      <div className="mb-2 flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 dark:bg-indigo-900/40">
          <Info className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-slate-100">
          If one of your children dies before you, should their share pass automatically to their children (your grandchildren)?
        </h3>
      </div>
      <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">
        Section 33 of the Wills Act 1837 can let a child’s share pass to their children. This question is whether to keep that rule or not.
      </p>
      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-indigo-200/80 bg-slate-50/90 px-3 py-2.5 text-xs dark:border-slate-600 dark:bg-slate-800/60">
          <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">Keep the usual rule (most people)</p>
          <p className="m-0 mt-1 text-slate-600 dark:text-slate-300">A child’s share can pass to their children under section 33.</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs dark:border-slate-600 dark:bg-slate-800/60">
          <p className="m-0 font-semibold text-slate-900 dark:text-slate-100">Turn off the automatic pass</p>
          <p className="m-0 mt-1 text-slate-600 dark:text-slate-300">The share can fall into the residue instead. Your solicitor can align the residue with your aims.</p>
        </div>
      </div>
      <div className="mb-2 flex flex-col gap-1" role="radiogroup" aria-label="Section 33">
        {[
          {
            v: 'No',
            t: 'Yes — a child’s share should pass to their children (my grandchildren) where the law allows',
            s: 'Usually keeps section 33 in play for gifts to children—typical for families.',
          },
          {
            v: 'Yes',
            t: 'No — a child’s share should not pass automatically to my grandchildren under section 33',
            s: 'Excludes section 33 for gifts in this will. Your solicitor will check your residue wording.',
          },
        ].map((o) => (
          <label
            key={o.v}
            className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg px-1.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 sm:px-2"
          >
            <input
              type="radio"
              className="mt-1 h-4 w-4 accent-indigo-600"
              name={`dex-s33-${uid}`}
              checked={formValues.stopGiftToChildrenOnFail === o.v}
              onChange={() => setFormValues((p) => ({ ...p, stopGiftToChildrenOnFail: o.v }))}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{o.t}</span>
              <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">{o.s}</span>
            </span>
          </label>
        ))}
      </div>
      {formValues.stopGiftToChildrenOnFail === 'Yes' ? (
        <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
          <p className="m-0 text-xs leading-relaxed">
            You are excluding section 33. If a child dies before you, their share will not pass to their children under that rule. Your solicitor will make sure
            your will matches what you want for the rest of the estate.
          </p>
        </div>
      ) : null}

      {addOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/60 p-4"
              onClick={(e) => e.target === e.currentTarget && setAddOpen(false)}
              role="presentation"
            >
              <div
                className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900"
                role="dialog"
                aria-modal="true"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h4 className="m-0 text-lg font-bold text-slate-900 dark:text-slate-100">Add an excluded person</h4>
                  <button
                    type="button"
                    className="min-h-[44px] min-w-[44px] rounded p-1 text-slate-500"
                    aria-label="Close"
                    onClick={() => setAddOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <DexSamePersonOrNew
                  formValues={formValues}
                  pickValue={dPick}
                  onPick={applyPick}
                  nameVal={dName}
                  relVal={dRel}
                  reasonVal={dReason}
                  onName={(v) => {
                    setDPick('');
                    setDName(v);
                  }}
                  onRel={setDRel}
                  onReason={setDReason}
                  nameInputId={`dex-name-${uid}`}
                  relInputId={`dex-rel-${uid}`}
                  reasonInputId={`dex-reason-${uid}`}
                />
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveExcluded}
                    className="min-h-[44px] flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddOpen(false)}
                    className="min-h-[44px] rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-600 dark:border-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
