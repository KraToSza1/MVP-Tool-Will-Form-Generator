/**
 * Administrative Provisions — guided section (April 2026). Maps to existing will field IDs.
 * No duplicate section title (FormRenderer card provides it).
 */
import React, { useCallback, useEffect, useId, useState } from 'react';
import { FileText, CircleHelp } from 'lucide-react';

const FIELD_ID = 'administrativeProvisionsGuided';

const STEP_VALUES = {
  allInclude: 'AllStandardSpecialInclude',
  byRef: 'AllStandardSpecial',
  standardOnly: 'AllStandardOnly',
  none: 'NoProvisions',
};

const stepConfirmText = {
  [STEP_VALUES.allInclude]:
    'All standard and special STEP provisions, written into the will. Your executors and trustees will have the full range of administrative powers. Your solicitor will include the complete provisions in the will document.',
  [STEP_VALUES.byRef]:
    'All standard and special STEP provisions, incorporated by reference. Your executors and trustees have identical powers to the option above — the will is simply shorter.',
  [STEP_VALUES.standardOnly]:
    'Standard STEP provisions only. Suitable for simpler estates. If your estate includes trusts or business interests, your solicitor may recommend upgrading to include special provisions.',
  [STEP_VALUES.none]:
    'No STEP provisions. Your solicitor will need to include individual administrative clauses in the will. This is not recommended without specific legal advice — your solicitor will flag this for review.',
};

/** @param {Record<string, unknown>|null|undefined} v */
export function isAdministrativeProvisionsGuidedComplete(v) {
  const x = v || {};
  if (x.includeReceiptByMinors !== 'Yes' && x.includeReceiptByMinors !== 'No') return false;
  if (x.includeCypresClause !== 'Yes' && x.includeCypresClause !== 'No') return false;
  if (x.bringLifetimeGiftsIntoAccount !== 'Yes' && x.bringLifetimeGiftsIntoAccount !== 'No') return false;
  if (x.specifyLifetimeLoansGifts !== 'Yes' && x.specifyLifetimeLoansGifts !== 'No') return false;
  if (x.specifyLifetimeLoansGifts === 'Yes') {
    if (!String(x.specifyLoansGiftsText || '').trim()) return false;
  }
  const st = x.stepProvisionsApply;
  if (
    st !== 'NoProvisions' &&
    st !== 'AllStandardSpecialInclude' &&
    st !== 'AllStandardSpecial' &&
    st !== 'AllStandardOnly'
  ) {
    return false;
  }
  if (st !== 'NoProvisions') {
    const ex = x.excludeSpecificStepProvisions;
    if (ex !== 'No' && ex !== 'YesOne' && ex !== 'YesMultiple') return false;
    if (ex === 'YesOne' && !String(x.stepProvisionToExcludeOne || '').trim()) return false;
    if (ex === 'YesMultiple' && !String(x.stepProvisionsToExcludeMultiple || '').trim()) return false;
  }
  return true;
}

/** @returns {Array<{ fieldId: string, fieldLabel: string, message: string, type: string }>} */
export function getAdministrativeProvisionsGuidedValidationIssues(v) {
  const issues = [];
  if (v.includeReceiptByMinors !== 'Yes' && v.includeReceiptByMinors !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Administrative provisions — receipt by minors',
      message: 'Please choose whether to include a Receipt by Minors clause.',
      type: 'required',
    });
  }
  if (v.includeCypresClause !== 'Yes' && v.includeCypresClause !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Administrative provisions — Cy-près',
      message: 'Please choose whether to include a Cy-près clause.',
      type: 'required',
    });
  }
  if (v.bringLifetimeGiftsIntoAccount !== 'Yes' && v.bringLifetimeGiftsIntoAccount !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Administrative provisions — lifetime gifts',
      message: 'Please choose whether lifetime gifts to children should be taken into account.',
      type: 'required',
    });
  }
  if (v.specifyLifetimeLoansGifts !== 'Yes' && v.specifyLifetimeLoansGifts !== 'No') {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Administrative provisions — notes for executors',
      message: 'Please say whether you want to add a note for your executors about specific loans or gifts.',
      type: 'required',
    });
  } else if (v.specifyLifetimeLoansGifts === 'Yes' && !String(v.specifyLoansGiftsText || '').trim()) {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Administrative provisions — loan/gift details',
      message: 'Add a short note for your executors, or change your answer to “No”.',
      type: 'required',
    });
  }
  if (
    v.stepProvisionsApply !== 'NoProvisions' &&
    v.stepProvisionsApply !== 'AllStandardSpecialInclude' &&
    v.stepProvisionsApply !== 'AllStandardSpecial' &&
    v.stepProvisionsApply !== 'AllStandardOnly'
  ) {
    issues.push({
      fieldId: FIELD_ID,
      fieldLabel: 'Administrative provisions — STEP',
      message: 'Please choose which STEP provisions should apply (or that none should apply).',
      type: 'required',
    });
  } else if (v.stepProvisionsApply !== 'NoProvisions') {
    if (v.excludeSpecificStepProvisions !== 'No' && v.excludeSpecificStepProvisions !== 'YesOne' && v.excludeSpecificStepProvisions !== 'YesMultiple') {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Administrative provisions — STEP exclusions',
        message: 'Please say whether any STEP provisions should be excluded, or open “Optional: exclude…” below and choose “No”.',
        type: 'required',
      });
    } else if (v.excludeSpecificStepProvisions === 'YesOne' && !String(v.stepProvisionToExcludeOne || '').trim()) {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Administrative provisions — STEP exclusion',
        message: 'Enter which STEP provision number to exclude, or change the exclusion option.',
        type: 'required',
      });
    } else if (v.excludeSpecificStepProvisions === 'YesMultiple' && !String(v.stepProvisionsToExcludeMultiple || '').trim()) {
      issues.push({
        fieldId: FIELD_ID,
        fieldLabel: 'Administrative provisions — STEP exclusions (multiple)',
        message: 'Enter which STEP provision numbers to exclude, or change the exclusion option.',
        type: 'required',
      });
    }
  }
  return issues;
}

/**
 * @param {object} props
 * @param {object} props.field
 * @param {object} props.formValues
 * @param {function} props.setFormValues
 */
export default function AdministrativeProvisionsGuided({ field, formValues, setFormValues }) {
  const uid = useId();
  const apply = useCallback((patch) => setFormValues((p) => ({ ...p, ...patch })), [setFormValues]);
  const [stepAdvancedOpen, setStepAdvancedOpen] = useState(false);

  const step = formValues.stepProvisionsApply;
  const showStepConfirm =
    step === STEP_VALUES.allInclude || step === STEP_VALUES.byRef || step === STEP_VALUES.standardOnly || step === STEP_VALUES.none;

  useEffect(() => {
    setFormValues((p) => {
      const st = p.stepProvisionsApply;
      if (st === 'NoProvisions') {
        if (
          p.excludeSpecificStepProvisions === 'No' &&
          !String(p.stepProvisionToExcludeOne || '').trim() &&
          !String(p.stepProvisionsToExcludeMultiple || '').trim()
        ) {
          return p;
        }
        return { ...p, excludeSpecificStepProvisions: 'No', stepProvisionToExcludeOne: '', stepProvisionsToExcludeMultiple: '' };
      }
      if (st && st !== 'NoProvisions') {
        if (p.excludeSpecificStepProvisions === undefined || p.excludeSpecificStepProvisions === null || p.excludeSpecificStepProvisions === '') {
          return { ...p, excludeSpecificStepProvisions: 'No' };
        }
      }
      return p;
    });
  }, [formValues.stepProvisionsApply, setFormValues]);

  const setStep = (val) => {
    apply({
      stepProvisionsApply: val,
      excludeSpecificStepProvisions: 'No',
      stepProvisionToExcludeOne: '',
      stepProvisionsToExcludeMultiple: '',
    });
  };

  const setQ4 = (v) => {
    if (v === 'no') {
      apply({ specifyLifetimeLoansGifts: 'No', specifyLoansGiftsText: '' });
    } else {
      apply({ specifyLifetimeLoansGifts: 'Yes' });
    }
  };

  return (
    <div className="min-w-0 max-w-3xl space-y-0" data-field-id={field.id}>
      <p className="mb-4 flex min-h-0 flex-col gap-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-100 sm:flex-row sm:items-start sm:gap-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" aria-hidden="true" />
        <span className="min-w-0 break-words leading-relaxed">
          <span className="block font-bold">A note on this section</span>
          <span className="mt-0.5 block text-xs sm:text-sm">
            These questions cover legal clauses that your solicitor routinely includes in a well-drafted will. Each one is explained in plain English
            below. If you are unsure, the recommended answer is shown for each question — your solicitor will review your choices before finalising the
            will.
          </span>
        </span>
      </p>

      {/* Q1 */}
      <QHead icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />} title="Should a parent or guardian be allowed to give a valid receipt for gifts left to a child under 18?" />
      <WhyBlock
        text='WHY WE ASK THIS: This is called a "Receipt by Minors" clause. Without it, if you leave a gift to a child under 18, your executors cannot hand it over until the child turns 18 — because a minor cannot legally give a valid receipt. Including this clause allows the child’s parent or guardian to accept the gift on the child’s behalf straight away.'
      />
      <Explainer title="What does this mean in practice?">
        <p>Imagine you leave £5,000 to your 10-year-old niece. Without this clause, your executors would have to hold that money in trust until she turns 18. With this clause, her parents can accept the money on her behalf immediately — and use it for her benefit right away.</p>
        <p className="mt-2">
          <strong>Most people include this clause.</strong> It makes things simpler and more practical for families with young children.
        </p>
      </Explainer>
      <div className="mb-5 flex flex-col gap-1" role="radiogroup" aria-label="Receipt by minors">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-minors-${uid}`}
            checked={formValues.includeReceiptByMinors === 'Yes'}
            onChange={() => apply({ includeReceiptByMinors: 'Yes' })}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Yes — include the Receipt by Minors clause{' '}
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">(recommended)</span>
            </span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
              A parent or guardian can give a valid receipt for gifts to children under 18
            </span>
          </span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-minors-${uid}`}
            checked={formValues.includeReceiptByMinors === 'No'}
            onChange={() => apply({ includeReceiptByMinors: 'No' })}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">No — don’t include this clause</span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
              Gifts to children under 18 will be held until they reach adulthood
            </span>
          </span>
        </label>
      </div>

      <SectionRule />

      {/* Q2 */}
      <QHead icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />} title="If you leave a gift to a charity and that charity no longer exists when you die, should the gift go to a similar charity instead?" />
      <WhyBlock text='WHY WE ASK THIS: This is called a "Cy-près clause" (from the Norman French meaning "as near as possible"). Charities can merge, change their name, or cease to exist. Without this clause, if a charity you’ve left a gift to no longer exists at the date of your death, that gift simply fails — the money stays in your estate rather than going to a good cause.' />
      <Explainer title="What does this mean in practice?">
        <p>
          You leave £2,000 to a cancer charity. By the time you die, that charity has merged with another organisation under a different name. Without a
          Cy-près clause, the gift fails. With it, the gift is redirected to the nearest equivalent charity carrying out similar work.
        </p>
        <p className="mt-2">
          <strong>Recommended if you are leaving any gifts to charities.</strong> It costs nothing to include and ensures your charitable intentions are
          honoured even if circumstances change.
        </p>
      </Explainer>
      <div className="mb-5 flex flex-col gap-1" role="radiogroup" aria-label="Cy-près">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-cy-${uid}`}
            checked={formValues.includeCypresClause === 'Yes'}
            onChange={() => apply({ includeCypresClause: 'Yes' })}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">
              Yes — include the Cy-près clause{' '}
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">(recommended if leaving gifts to charity)</span>
            </span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
              If a named charity no longer exists, the gift passes to the nearest equivalent charity
            </span>
          </span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-cy-${uid}`}
            checked={formValues.includeCypresClause === 'No'}
            onChange={() => apply({ includeCypresClause: 'No' })}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">No — don’t include this clause</span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
              If a named charity no longer exists, the gift will fail and remain in my estate
            </span>
          </span>
        </label>
      </div>

      <SectionRule />

      {/* Q3 hotchpot */}
      <QHead
        icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
        title="Should significant gifts or loans you’ve already made to your children during your lifetime be taken into account when dividing your estate between them?"
      />
      <WhyBlock text='WHY WE ASK THIS: This is called the "hotchpot" rule or "bringing into account". If you’ve given one child a large sum during your lifetime — a deposit for a house, for example — this clause ensures that gift is taken into account when your estate is divided, so the other children don’t end up receiving less overall. It promotes fairness between children.' />
      <div className="mb-3 grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div className="rounded-lg border border-violet-300/60 bg-slate-50/90 px-3 py-3 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 sm:px-4">
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">Yes — bring lifetime gifts into account</p>
          <p className="mt-1.5 m-0 leading-relaxed">Any significant gift or loan already made to a child is deducted from their share of the estate</p>
          <p className="mt-1 m-0 leading-relaxed">Promotes fairness — a child who already received more gets correspondingly less from the estate</p>
        </div>
        <div className="rounded-lg border border-violet-300/60 bg-slate-50/90 px-3 py-3 text-xs text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-100 sm:px-4">
          <p className="m-0 text-sm font-semibold text-slate-900 dark:text-slate-100">No — each child gets their full share</p>
          <p className="mt-1.5 m-0 leading-relaxed">Lifetime gifts are treated as separate — the estate is divided equally regardless of what was given before</p>
          <p className="mt-1 m-0 leading-relaxed">Simpler — avoids disputes about what counts as a gift to be brought into account</p>
        </div>
      </div>
      <Explainer title="A simple example">
        <p>
          You have two children, Tom and Sarah. You gave Tom £50,000 towards a house deposit during your lifetime. Your estate is now worth £200,000, to
          be split equally. <strong>With this clause:</strong> Tom receives £50,000 (his half minus the £50k already received) and Sarah receives £150,000.{' '}
          <strong>Without it:</strong> both receive £100,000 — meaning Tom has effectively received £150,000 in total to Sarah’s £100,000.
        </p>
      </Explainer>
      <div className="mb-5 flex flex-col gap-1" role="radiogroup" aria-label="Hotchpot">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-hot-${uid}`}
            checked={formValues.bringLifetimeGiftsIntoAccount === 'Yes'}
            onChange={() => apply({ bringLifetimeGiftsIntoAccount: 'Yes' })}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Yes — take lifetime gifts into account to ensure fairness between children</span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
              Significant gifts or loans already made are deducted from that child’s share of the estate
            </span>
          </span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-hot-${uid}`}
            checked={formValues.bringLifetimeGiftsIntoAccount === 'No'}
            onChange={() => apply({ bringLifetimeGiftsIntoAccount: 'No' })}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">No — each child receives their full share regardless of lifetime gifts</span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">
              The estate is divided equally without reference to any previous financial help given to any child
            </span>
          </span>
        </label>
      </div>

      <SectionRule />

      {/* Q4 */}
      <QHead
        icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
        title="Are there any specific loans or gifts you’d like to draw to your executors’ attention in the will?"
      />
      <WhyBlock text="WHY WE ASK THIS: If you have made a significant loan or gift to someone that you want your executors to be aware of — whether to collect it, consider it in the distribution of your estate, or simply note it for context — you can record that information here. It appears as a note in the will for your executors." />
      <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
        This is optional. Most people choose “no note”. Use “yes” if there is a specific financial arrangement your executors need to know about.
      </p>
      <div className="mb-1 flex flex-col gap-1" role="radiogroup" aria-label="Executor loan note">
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-loans-${uid}`}
            checked={formValues.specifyLifetimeLoansGifts === 'No'}
            onChange={() => setQ4('no')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">No — nothing specific to note</span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">No loans or gifts need to be drawn to my executors’ attention in the will</span>
          </span>
        </label>
        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border border-transparent px-1.5 py-2.5 hover:bg-slate-50 sm:px-2 dark:hover:bg-slate-800/60">
          <input
            type="radio"
            className="mt-1 h-4 w-4 accent-indigo-600"
            name={`apg-loans-${uid}`}
            checked={formValues.specifyLifetimeLoansGifts === 'Yes'}
            onChange={() => setQ4('yes')}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">Yes — I’d like to note something for my executors</span>
            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-300">I’ll describe the loan or gift briefly below</span>
          </span>
        </label>
      </div>
      {formValues.specifyLifetimeLoansGifts === 'Yes' ? (
        <div className="mb-5 min-w-0">
          <label htmlFor={`apg-loan-ta-${uid}`} className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">
            Notes for your executors
          </label>
          <textarea
            id={`apg-loan-ta-${uid}`}
            value={formValues.specifyLoansGiftsText ?? ''}
            onChange={(e) => apply({ specifyLoansGiftsText: e.target.value })}
            rows={5}
            placeholder="e.g. I wish to make my executors aware that I lent £20,000 to my son James Smith in 2021 towards a house deposit. This amount has not been repaid and I wish it to be brought into account when dividing my estate."
            className="w-full min-h-[120px] rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">Write in plain English — your solicitor will review this and include appropriate wording in the will.</p>
        </div>
      ) : null}

      <SectionRule />

      {/* Q5 STEP */}
      <QHead icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />} title="Which standard administrative clauses should be included in your will?" />
      <WhyBlock text="WHY WE ASK THIS: STEP (Society of Trust and Estate Practitioners) produces a set of industry-standard clauses that govern how trustees and executors manage an estate. Including them avoids having to spell out every administrative rule in the will itself — they are tried, tested, and widely understood by banks, solicitors, and courts." />
      <Explainer title="What are STEP provisions?">
        <p>
          Think of them as a standard rulebook for your executors. They cover practical matters like: how your executors are paid, how they make investment
          decisions, how they deal with jointly-owned assets, how they handle tax, and how they manage property in a trust. Without them, the will would
          need to spell all of this out in full — making it much longer and more complex.
        </p>
        <p className="mt-2">
          <strong>Standard provisions</strong> cover the essentials — executor powers, investment, and administration.
        </p>
        <p className="mt-1">
          <strong>Special provisions</strong> add more sophisticated powers for managing trusts, including powers relevant to settled property and
          trustee delegation. Relevant where your estate includes trusts, property trusts, or business interests.
        </p>
        <div className="mt-2 rounded-md border border-indigo-200/80 bg-white px-3 py-2.5 text-xs text-slate-600 dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
          <p className="m-0">
            <strong className="text-slate-900 dark:text-slate-100">Not sure which to choose?</strong> Your solicitor will recommend the right level
            based on the complexity of your estate. &quot;All standard and special provisions&quot; is the most comprehensive and is right for most estates
            with any trust or property element.
          </p>
        </div>
      </Explainer>
      <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">Select the option your solicitor has discussed with you, or choose the most comprehensive default below.</p>

      <div className="mb-3 grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="STEP provisions">
        {[
          {
            v: STEP_VALUES.allInclude,
            t: 'All standard and special provisions — included in the will',
            d: 'The full STEP provisions are written into the body of your will. Most comprehensive — anyone reading the will can see exactly what powers apply without referring to a separate document.',
          },
          {
            v: STEP_VALUES.byRef,
            t: 'All standard and special provisions — by reference',
            d: 'The full STEP provisions apply, but are incorporated by reference rather than written out in full. Keeps the will shorter. Both options give executors identical powers.',
          },
          {
            v: STEP_VALUES.standardOnly,
            t: 'Standard provisions only',
            d: 'Only the core STEP provisions apply. Suitable for simpler estates without trusts, business interests, or complex property arrangements.',
          },
          { v: STEP_VALUES.none, t: 'No STEP provisions', d: 'STEP provisions are not incorporated. All executor and trustee powers must be spelled out individually in the will. Not recommended without specific legal advice.' },
        ].map((opt) => {
          const selected = formValues.stepProvisionsApply === opt.v;
          return (
            <label
              key={opt.v}
              className={`min-w-0 cursor-pointer rounded-xl border-2 p-3.5 transition ${
                selected
                  ? 'border-indigo-500 bg-indigo-50/90 dark:border-indigo-400 dark:bg-indigo-950/30'
                  : 'border-slate-200 bg-white hover:border-indigo-200 dark:border-slate-600 dark:bg-slate-800/50 dark:hover:border-slate-500'
              }`}
            >
              <input type="radio" className="sr-only" name={`apg-step-${uid}`} value={opt.v} checked={selected} onChange={() => setStep(opt.v)} />
              <p className={`m-0 text-sm font-bold leading-snug ${selected ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-900 dark:text-slate-100'}`}>
                {opt.t}
              </p>
              <p className="mt-1.5 m-0 break-words text-xs leading-relaxed text-slate-600 dark:text-slate-300">{opt.d}</p>
            </label>
          );
        })}
      </div>

      {showStepConfirm ? (
        <div
          className="mb-3 rounded-lg border border-emerald-200/90 bg-emerald-50/95 px-3 py-3 text-sm text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-950/25 dark:text-emerald-100"
          role="status"
        >
          <p className="m-0 leading-relaxed">
            <span className="font-semibold">Selected: </span>
            <span className="font-normal">{stepConfirmText[step]}</span>
          </p>
        </div>
      ) : null}

      <details
        className="mb-1 rounded-lg border border-slate-200 bg-slate-50/50 open:bg-slate-50 dark:border-slate-600 dark:bg-slate-800/30 dark:open:bg-slate-800/40"
        open={stepAdvancedOpen}
        onToggle={(e) => setStepAdvancedOpen(e.currentTarget.open)}
      >
        <summary className="flex min-h-[44px] cursor-pointer select-none items-center px-3 py-3 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:text-slate-100">
          Optional: exclude specific STEP provision numbers
        </summary>
        <div className="border-t border-slate-200 px-3 py-3 text-sm dark:border-slate-600">
          {formValues.stepProvisionsApply && formValues.stepProvisionsApply !== 'NoProvisions' ? (
            <div className="space-y-3">
              <p className="m-0 text-xs text-slate-600 dark:text-slate-300">
                Only use this if your solicitor has said certain STEP numbers should be excluded. Most clients leave this on &quot;No&quot;.
              </p>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Exclude STEP provisions">
                {[
                  { v: 'No', l: 'No — do not exclude any' },
                  { v: 'YesOne', l: 'Yes — one provision' },
                  { v: 'YesMultiple', l: 'Yes — multiple provisions' },
                ].map((o) => (
                  <label
                    key={o.v}
                    className="flex min-h-[44px] cursor-pointer items-start gap-2 rounded-md border border-transparent px-1 py-1 hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
                  >
                    <input
                      type="radio"
                      className="mt-0.5 h-4 w-4 accent-indigo-600"
                      name={`apg-step-excl-${uid}`}
                      checked={formValues.excludeSpecificStepProvisions === o.v}
                      onChange={() => {
                        if (o.v === 'No') {
                          apply({ excludeSpecificStepProvisions: 'No', stepProvisionToExcludeOne: '', stepProvisionsToExcludeMultiple: '' });
                        } else if (o.v === 'YesOne') {
                          apply({ excludeSpecificStepProvisions: 'YesOne', stepProvisionsToExcludeMultiple: '' });
                        } else {
                          apply({ excludeSpecificStepProvisions: 'YesMultiple', stepProvisionToExcludeOne: '' });
                        }
                      }}
                    />
                    <span className="min-w-0 text-sm text-slate-800 dark:text-slate-100">{o.l}</span>
                  </label>
                ))}
              </div>
              {formValues.excludeSpecificStepProvisions === 'YesOne' ? (
                <div>
                  <label htmlFor={`apg-se1-${uid}`} className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Which provision number?
                  </label>
                  <input
                    id={`apg-se1-${uid}`}
                    type="text"
                    value={formValues.stepProvisionToExcludeOne ?? ''}
                    onChange={(e) => apply({ stepProvisionToExcludeOne: e.target.value })}
                    className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
                    placeholder="e.g. 1"
                    autoComplete="off"
                  />
                </div>
              ) : null}
              {formValues.excludeSpecificStepProvisions === 'YesMultiple' ? (
                <div>
                  <label htmlFor={`apg-sem-${uid}`} className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Which provision numbers?
                  </label>
                  <input
                    id={`apg-sem-${uid}`}
                    type="text"
                    value={formValues.stepProvisionsToExcludeMultiple ?? ''}
                    onChange={(e) => apply({ stepProvisionsToExcludeMultiple: e.target.value })}
                    className="mt-1 w-full min-h-[44px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-100"
                    placeholder="e.g. 1, 2, & 3"
                    autoComplete="off"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="m-0 text-xs text-slate-600 dark:text-slate-400">Choose a STEP option above to use exclusions, or select &quot;No STEP provisions&quot;.</p>
          )}
        </div>
      </details>
    </div>
  );
}

function QHead({ icon, title }) {
  return (
    <div className="mb-2 flex min-w-0 items-start gap-2.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300">
        {icon}
      </div>
      <h3 className="m-0 min-w-0 break-words text-base font-bold leading-snug text-slate-900 dark:text-slate-100">{title}</h3>
    </div>
  );
}

function WhyBlock({ text }) {
  return (
    <p className="mb-3 flex gap-2 text-xs italic leading-relaxed text-slate-600 sm:text-sm dark:text-slate-300">
      <CircleHelp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{text}</span>
    </p>
  );
}

function Explainer({ title, children }) {
  return (
    <div className="mb-3 rounded-xl border border-indigo-200/60 bg-violet-50/40 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/50 sm:px-4">
      <h4 className="m-0 text-[0.7rem] font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">{title}</h4>
      <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-slate-800 dark:text-slate-100 [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-slate-900 dark:[&_strong]:text-slate-100">
        {children}
      </div>
    </div>
  );
}

function SectionRule() {
  return <div className="my-6 h-px w-full min-w-0 bg-slate-200 dark:bg-slate-600" role="separator" aria-hidden="true" />;
}
