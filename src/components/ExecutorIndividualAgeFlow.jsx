import React, { useEffect, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  executorDisplayName,
  getAgeYearsFromDob,
  isAristoneExecutorLine,
  isRichPersonExecutorRow,
} from '../utils/executorAgeUtils.js';

const LATER_OPTIONS_1824 = [
  { value: '21', label: '21' },
  { value: '23', label: '23' },
  { value: '25', label: '25' },
  { value: 'Other', label: 'Other' },
];

const LATER_OPTIONS_UNDER18 = [
  { value: '18', label: '18' },
  ...LATER_OPTIONS_1824,
];

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

/** Minimum age at which this executor may act (per user choices). */
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
    const allAnswered = relevant.every((r) => {
      const st = entries[r.index];
      const tier = tierForAge(r.age);
      if (tier === '25plus') return true;
      if (r.age == null) return false;
      if (!st) return false;
      if (st.laterChoice == null) return false;
      if (st.laterChoice === 'later') {
        const minA = minimumActingAge(st, tier);
        return minA != null;
      }
      return true;
    });
    return allAnswered && !anyoneCanAct;
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

  const renderExecutorBlock = (row) => {
    const { index, name, age } = row;
    const st = entries[index] || emptyStateForTier('1824');
    const tier = tierForAge(age);

    if (tier === '25plus') {
      console.log('[EXECUTOR_AGE_DEBUG] renderExecutorBlock return null (25plus)', { index, name, age });
      return null;
    }

    if (age == null) {
      return (
        <div
          key={index}
          className="rounded-lg border border-amber-400/60 bg-amber-50/90 p-4 text-sm text-slate-900 dark:border-amber-500/50 dark:bg-slate-800/90 dark:text-slate-100"
        >
          <p className="font-medium break-words">{name}</p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">
            Add a date of birth for this executor so we can confirm when they may act.
          </p>
        </div>
      );
    }

    const intro1824 = `${name} is currently ${age} years old. By default, they can act as executor from age 18. Would you like them to act from age 18, or only once they reach a later age?`;
    const introU18 = `${name} is currently ${age} years old. By default, an executor can act from age 18. Would you like them to act from age 18, or only once they reach a later age?`;

    const laterOptions = tier === 'under18' ? LATER_OPTIONS_UNDER18 : LATER_OPTIONS_1824;

    const actingNum = parseActingAgeNumber(st.actingAgePreset, st.actingAgeOther);
    const showExplainUnder =
      st.laterChoice === 'later' && actingNum != null && age != null && age < actingNum;

    return (
      <div
        key={index}
        className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5 dark:border-slate-600 dark:bg-slate-800/80"
      >
        <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed break-words">
          {tier === 'under18' ? introU18 : intro1824}
        </p>
        <div className="mt-3 space-y-2">
          {['from18', 'later'].map((v) => (
            <label
              key={v}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-2 hover:bg-white/80 dark:hover:bg-slate-700/50"
            >
              <input
                type="radio"
                name={`exec-age-${index}-later`}
                className="accent-indigo-600 mt-1 shrink-0"
                checked={st.laterChoice === v}
                onChange={() =>
                  setEntry(index, {
                    laterChoice: v,
                    actingAgePreset: v === 'later' ? (tier === 'under18' ? '18' : '21') : null,
                    actingAgeOther: '',
                  })
                }
              />
              <span className="text-sm text-slate-800 dark:text-slate-100">
                {v === 'from18'
                  ? 'They can act from age 18'
                  : 'They should act only once they reach a later age'}
              </span>
            </label>
          ))}
        </div>

        {st.laterChoice === 'later' && (
          <div className="mt-4">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words">
              At what age would you like {name} to be able to act as executor and administer your estate?
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {laterOptions.map((opt) => (
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
            {st.actingAgePreset === 'Other' && (
              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Age (years)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={st.actingAgeOther || ''}
                  onChange={(e) => setEntry(index, { actingAgeOther: e.target.value })}
                />
              </div>
            )}
            {showExplainUnder && (
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Until they reach that age, they will not be able to act as executor. Any other executor who is able to
                act may deal with your estate in the meantime.
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6 space-y-4" data-field-id="executorIndividualAgeFlow">
      {relevant.map(renderExecutorBlock)}

      {showNoImmediateWarning && (
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 text-sm text-slate-900 shadow-sm dark:border-amber-400 dark:bg-slate-800 dark:text-slate-50"
        >
          <div className="flex gap-2 font-semibold">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <span>
              None of the executors you have chosen would be able to act immediately. You should appoint at least one
              executor who will be able to act if needed before that time.
            </span>
          </div>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-800 dark:text-slate-200">
            <li>Add another individual executor</li>
            <li>Appoint Aristone Solicitors to act</li>
          </ul>
        </div>
      )}
    </div>
  );
}
