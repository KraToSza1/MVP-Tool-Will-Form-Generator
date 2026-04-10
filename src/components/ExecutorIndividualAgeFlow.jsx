import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import {
  executorDisplayName,
  getAgeYearsFromDob,
  isAristoneExecutorLine,
  isRichPersonExecutorRow,
} from '../utils/executorAgeUtils.js';

function executorFirstName(item) {
  if (item && typeof item === 'object' && item.firstName) return item.firstName;
  return executorDisplayName(item);
}

function emptyStateForTier(tier) {
  return {
    tier,
    laterChoice: null,
    actingAgePreset: null,
    actingAgeOther: '',
  };
}

function parseActingAgeNumber(preset, otherStr) {
  if (preset === 'Other') {
    const n = parseInt(String(otherStr || '').trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  if (preset == null || preset === '') return null;
  const n = parseInt(String(preset), 10);
  return Number.isFinite(n) ? n : null;
}

function tierForAge(age) {
  if (age == null) return null;
  if (age >= 25) return '25plus';
  if (age >= 18) return '1824';
  return 'under18';
}

function minimumActingAge(st, tier) {
  if (!st || tier === '25plus') return 18;
  if (st.laterChoice !== 'later') return 18;
  const n = parseActingAgeNumber(st.actingAgePreset, st.actingAgeOther);
  return n != null ? n : null;
}

function compileWillClause(executorData, entries) {
  const parts = [];
  (executorData || []).forEach((item, index) => {
    if (isAristoneExecutorLine(item)) return;
    if (!isRichPersonExecutorRow(item)) return;
    const name = executorDisplayName(item);
    const age = getAgeYearsFromDob(item.dateOfBirth);
    const tier = tierForAge(age);
    const st = entries[index];
    if (!st || tier === '25plus') return;
    if (st.laterChoice !== 'later') return;
    const minA = minimumActingAge(st, tier);
    if (minA != null && minA > 18) {
      parts.push(
        `In relation to my Executor ${name}, they shall not be eligible to act as an executor until they have attained the age of ${minA} years.`
      );
    }
  });
  return parts.length ? parts.join(' ') : '';
}

function validateCustomAge(enteredAge, currentAge, firstName) {
  if (enteredAge <= (currentAge ?? 0)) {
    return `The age you've entered is not higher than ${firstName}'s current age. Please enter an age they haven't reached yet.`;
  }
  if (enteredAge === 18 && currentAge != null && currentAge < 18) {
    return 'Age 18 is the default age at which an executor can act. If you\'d like them to act from 18, select "Act immediately" above instead.';
  }
  if (enteredAge > 99) {
    return `Please enter a valid age between ${(currentAge ?? 0) + 1} and 99.`;
  }
  return null;
}

function TooltipTrigger({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
      >
        <Info className="w-4 h-4 shrink-0" aria-hidden />
        What happens in the meantime?
      </button>
      {open && (
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {text}
        </p>
      )}
    </div>
  );
}

const ARISTONE_SUB_LINE =
  'Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG';

function UnderageWarningBox({ show, warningText, firstName, permittedAge, formValues, setFormValues }) {
  const [feesOpen, setFeesOpen] = useState(false);
  const [acked, setAcked] = useState(false);

  const aristoneAppointed =
    formValues.chooseAristoneSubstituteExecutor === 'Aristone' &&
    Array.isArray(formValues.substituteExecutorData) &&
    formValues.substituteExecutorData.some((d) => typeof d === 'string' && /aristone/i.test(d));

  const handleConfirm = useCallback(() => {
    setFormValues((prev) => ({
      ...prev,
      chooseAristoneSubstituteExecutor: 'Aristone',
      substituteExecutorData: [ARISTONE_SUB_LINE],
    }));
    setFeesOpen(false);
    setAcked(false);
  }, [setFormValues]);

  if (aristoneAppointed) {
    return (
      <div
        role="status"
        className="mt-4 rounded-xl border-2 border-green-500 bg-green-50 p-4 text-sm text-green-900 shadow-sm dark:border-green-400 dark:bg-slate-800 dark:text-green-100"
      >
        <div className="flex gap-2 items-start">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600 dark:text-green-400 mt-0.5" aria-hidden />
          <p className="leading-relaxed">
            ✅ Aristone Solicitors will act as your executor until {firstName} reaches age {permittedAge}. They will then hand over to {firstName} automatically. Your estate is fully covered in the meantime.
          </p>
        </div>
      </div>
    );
  }

  if (!show) return null;

  return (
    <>
      <div
        role="alert"
        className="mt-4 rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-sm text-slate-900 shadow-sm dark:border-amber-400 dark:bg-slate-800 dark:text-slate-50"
      >
        <div className="flex gap-2 items-start">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
          <p className="leading-relaxed">{warningText}</p>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => { setFeesOpen(true); setAcked(false); }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-md hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px] dark:bg-indigo-600 dark:hover:bg-indigo-700"
          >
            ✅ Appoint Aristone Solicitors to act in the meantime (Recommended)
          </button>
        </div>
      </div>

      {feesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Professional fees acknowledgement">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Professional Fees Notice</h3>
            <div className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-800 leading-relaxed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
              <p>
                If you appoint Aristone Solicitors, professional fees will apply. You can view our current pricing on our{' '}
                <a
                  href="https://aristonesolicitors.co.uk/about-aristone/our-prices/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 underline font-medium dark:text-indigo-400"
                >
                  website
                </a>.
              </p>
            </div>
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="checkbox"
                checked={acked}
                onChange={(e) => setAcked(e.target.checked)}
                className="mt-0.5 h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0"
              />
              <span>I understand and agree</span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setFeesOpen(false); setAcked(false); }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!acked}
                onClick={handleConfirm}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ExecutorIndividualAgeFlow({ formValues, setFormValues }) {
  const executorData = Array.isArray(formValues.executorData) ? formValues.executorData : [];
  const rawState = formValues.executorIndividualActingAgeState;
  const entries = typeof rawState === 'object' && rawState && !Array.isArray(rawState) ? rawState : {};

  const relevant = useMemo(() => {
    return executorData
      .map((item, index) => ({
        item,
        index,
        name: executorDisplayName(item),
        firstName: executorFirstName(item),
        age: isRichPersonExecutorRow(item) ? getAgeYearsFromDob(item.dateOfBirth) : null,
        skip: isAristoneExecutorLine(item),
      }))
      .filter((r) => !r.skip && isRichPersonExecutorRow(r.item));
  }, [executorData]);

  useEffect(() => {
    setFormValues((prev) => {
      const prevState =
        typeof prev.executorIndividualActingAgeState === 'object' && prev.executorIndividualActingAgeState
          ? { ...prev.executorIndividualActingAgeState }
          : {};
      let changed = false;
      relevant.forEach(({ index, age }) => {
        const tier = tierForAge(age);
        if (!tier) return;
        if (prevState[index]) return;
        prevState[index] = tier === '25plus' ? emptyStateForTier('25plus') : emptyStateForTier(tier);
        changed = true;
      });
      Object.keys(prevState).forEach((k) => {
        const i = Number(k);
        if (!relevant.some((r) => r.index === i)) {
          delete prevState[k];
          changed = true;
        }
      });
      if (!changed) return prev;
      return { ...prev, executorIndividualActingAgeState: prevState };
    });
  }, [relevant, setFormValues]);

  useEffect(() => {
    const clause = compileWillClause(executorData, entries);
    setFormValues((prev) => {
      if (prev.executorIndividualActingAgeClause === clause) return prev;
      return { ...prev, executorIndividualActingAgeClause: clause };
    });
  }, [executorData, entries, setFormValues]);

  const canThisExecutorActImmediately = (item, index) => {
    if (isAristoneExecutorLine(item)) return true;
    if (!isRichPersonExecutorRow(item)) return true;
    const age = getAgeYearsFromDob(item.dateOfBirth);
    if (age == null) return false;
    const tier = tierForAge(age);
    const st = entries[index];
    if (tier === '25plus') return true;
    if (age < 18) return false;
    if (tier === '1824') {
      if (!st || st.laterChoice == null) return false;
      if (st.laterChoice === 'from18') return true;
      const minA = minimumActingAge(st, tier);
      return minA != null && age >= minA;
    }
    return true;
  };

  const anyoneCanAct = useMemo(() => {
    if (!executorData.length) return true;
    return executorData.some((item, index) => canThisExecutorActImmediately(item, index));
  }, [executorData, entries]);

  const showNoImmediateWarning = useMemo(() => {
    if (!relevant.length) return false;
    return relevant.some((r) => {
      const tier = tierForAge(r.age);
      const st = entries[r.index];
      if (tier === '25plus') return false;
      if (r.age != null && r.age < 18) return true;
      if (!st || st.laterChoice == null) return false;
      if (st.laterChoice === 'later') {
        const minA = minimumActingAge(st, tier);
        if (minA != null) return !anyoneCanAct;
      }
      return false;
    }) && !anyoneCanAct;
  }, [relevant, entries, anyoneCanAct]);

  useEffect(() => {
    console.log('[EXECUTOR_AGE_DEBUG] ExecutorIndividualAgeFlow mounted');
  }, []);

  useEffect(() => {
    const rowLog = relevant.map((r) => ({
      displayName: r.name,
      dob: isRichPersonExecutorRow(r.item) ? r.item.dateOfBirth : null,
      parsedAge: r.age,
      tier: tierForAge(r.age) ?? 'invalid',
    }));
    console.log('[EXECUTOR_AGE_DEBUG] ExecutorIndividualAgeFlow snapshot', {
      rawExecutorData: executorData,
      relevantCount: relevant.length,
      rows: rowLog,
      showNoImmediateWarning,
      anyoneCanAct,
    });
  }, [executorData, relevant, entries, showNoImmediateWarning, anyoneCanAct]);

  useEffect(() => {
    if (showNoImmediateWarning) {
      console.log('[EXECUTOR_AGE_DEBUG] warning: no executor can act immediately (banner shown)');
    }
  }, [showNoImmediateWarning]);

  if (!relevant.length) {
    console.log('[EXECUTOR_AGE_DEBUG] ExecutorIndividualAgeFlow return null (relevant.length === 0)', {
      executorDataLength: executorData.length,
      rawExecutorData: executorData,
    });
    return null;
  }

  const setEntry = (index, partial) => {
    setFormValues((prev) => {
      const prevState =
        typeof prev.executorIndividualActingAgeState === 'object' && prev.executorIndividualActingAgeState
          ? { ...prev.executorIndividualActingAgeState }
          : {};
      const tier = tierForAge(getAgeYearsFromDob(executorData[index]?.dateOfBirth));
      const cur = prevState[index] || emptyStateForTier(tier || '1824');
      prevState[index] = { ...cur, ...partial };
      return { ...prev, executorIndividualActingAgeState: prevState };
    });
  };

  const allDeferred = executorData.length > 1 && executorData.every((item, idx) => !canThisExecutorActImmediately(item, idx));

  const renderExecutorBlock = (row) => {
    const { index, name, firstName, age } = row;
    const st = entries[index] || emptyStateForTier('1824');
    const tier = tierForAge(age);

    if (tier === '25plus') {
      console.log('[EXECUTOR_AGE_DEBUG] renderExecutorBlock return null (25plus)', { index, name, age });
      return null;
    }

    // CHANGE 1: Dynamic intro sentence
    let introText;
    if (age == null) {
      introText = `You can choose whether ${firstName} acts as executor straight away, or only once they reach a certain age.`;
    } else if (age < 18) {
      introText = `${firstName} is currently ${age} years old and cannot act as executor until they turn 18. You can choose whether they act from 18, or once they are older.`;
    } else {
      introText = `${firstName} is currently ${age} years old. Because they are under 25, you may want to consider when you would like them to be able to act.`;
    }

    // CHANGE 2: Dynamic radio labels
    const immediateLabel = age < 18
      ? `Act from age 18 — ${firstName} can step in as executor once they turn 18`
      : `Act immediately — ${firstName} can step in as executor as soon as they are needed`;
    const deferredLabel = `Wait until they are older — ${firstName} will only be able to act once they reach an age you choose`;

    // CHANGE 3: Filter age options dynamically
    const standardAges = [21, 23, 25].filter((a) => a > (age ?? 0));
    const ageOptions = [
      ...standardAges.map((a) => ({ value: String(a), label: String(a) })),
      { value: 'Other', label: 'Other' },
    ];

    const actingNum = parseActingAgeNumber(st.actingAgePreset, st.actingAgeOther);

    // CHANGE 4: Custom age validation
    const otherVal = parseInt(String(st.actingAgeOther || '').trim(), 10);
    const otherError =
      st.actingAgePreset === 'Other' && st.actingAgeOther !== '' && Number.isFinite(otherVal)
        ? validateCustomAge(otherVal, age, firstName)
        : null;
    const otherValid =
      st.actingAgePreset === 'Other' && Number.isFinite(otherVal) && !otherError;

    // CHANGE 6: Per-executor warning (shown below age selector)
    const thisExecutorDeferred = st.laterChoice === 'later' || age < 18;
    const showBlockWarning = thisExecutorDeferred && !anyoneCanAct && (
      st.laterChoice === 'later'
        ? actingNum != null
        : true
    );

    const permittedAge = actingNum ?? 18;
    const warningText = `⚠️ Heads up: ${firstName} is currently ${age} years old and cannot act as your executor straight away. Until they reach age ${permittedAge} your estate would have nobody legally able to carry out your wishes. You can scroll up to add another individual executor, or appoint Aristone Solicitors to act in the meantime.`;

    return (
      <div
        key={index}
        className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-600 dark:bg-slate-800/80"
      >
        {/* CHANGE 1: Intro sentence */}
        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed break-words">
          {introText}
        </p>

        {/* CHANGE 2: Radio options */}
        <div className="mt-3 space-y-2">
          {[
            { value: 'from18', label: immediateLabel },
            { value: 'later', label: deferredLabel },
          ].map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-2 hover:bg-white/80 dark:hover:bg-slate-700/50"
            >
              <input
                type="radio"
                name={`exec-age-${index}-later`}
                className="accent-indigo-600 mt-1 shrink-0"
                checked={st.laterChoice === opt.value}
                onChange={() => {
                  const defaultPreset = opt.value === 'later'
                    ? (ageOptions.length === 1 ? 'Other' : ageOptions[0].value)
                    : null;
                  setEntry(index, {
                    laterChoice: opt.value,
                    actingAgePreset: defaultPreset,
                    actingAgeOther: '',
                  });
                }}
              />
              <span className="text-sm text-slate-800 dark:text-slate-100">
                {opt.label}
              </span>
            </label>
          ))}
        </div>

        {/* CHANGE 3: Conditional age selector */}
        {st.laterChoice === 'later' && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
              At what age would you like {firstName} to be able to act as executor and administer your estate?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ageOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                >
                  <input
                    type="radio"
                    name={`exec-age-${index}-preset`}
                    className="accent-indigo-600 shrink-0"
                    checked={st.actingAgePreset === opt.value}
                    onChange={() => setEntry(index, { actingAgePreset: opt.value, actingAgeOther: '' })}
                  />
                  {opt.label}
                </label>
              ))}
            </div>

            {/* CHANGE 4: Custom age input */}
            {st.actingAgePreset === 'Other' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  At what age should {firstName} be able to act?
                </label>
                <input
                  type="number"
                  min={(age ?? 0) + 1}
                  max={99}
                  placeholder="Enter an age"
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={st.actingAgeOther || ''}
                  onChange={(e) => setEntry(index, { actingAgeOther: e.target.value })}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  This must be older than {firstName}&apos;s current age of {age}.
                </p>
                {otherError && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{otherError}</p>
                )}
                {otherValid && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 italic">
                    {firstName} will be able to act as your executor from age {otherVal}.
                  </p>
                )}
              </div>
            )}

            {/* CHANGE 5: Tooltip for interim explanation */}
            <TooltipTrigger text="Until they reach that age, they will not be able to act as executor. Any other executor who is able to act may deal with your estate in the meantime." />
          </div>
        )}

        {/* Warning banner / green confirmation for underage executor */}
        <UnderageWarningBox
          show={showBlockWarning}
          warningText={warningText}
          firstName={firstName}
          permittedAge={permittedAge}
          formValues={formValues}
          setFormValues={setFormValues}
        />
      </div>
    );
  };

  return (
    <div className="mb-6 space-y-4" data-field-id="executorIndividualAgeFlow">
      {relevant.map(renderExecutorBlock)}
    </div>
  );
}
