import React, { useMemo } from 'react';
import { Info, AlertTriangle, HeartHandshake } from 'lucide-react';

/** @param {{ response: string }} props */
function ConfirmLine({ response }) {
  let text =
    response === 'interested'
      ? 'Added to your appointment — your solicitor will discuss LPA options with you.'
      : response === 'has_one'
        ? 'Noted — your solicitor will check your existing LPA at your appointment.'
        : response === 'declined'
          ? 'Noted. Your solicitor may still raise this at your appointment.'
          : '';
  if (!text) return null;
  return (
    <div
      role="status"
      className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100"
    >
      <span aria-hidden>✓</span>
      <span>{text}</span>
    </div>
  );
}

/** @param {{
 *   disabled: boolean,
 *   clientResponse: string | null,
 *   onRespond: (r: 'interested' | 'has_one' | 'declined') => void,
 *   variant?: 'urgent' | 'default',
 * }} props */
export function LpaCtaRow({ disabled, clientResponse, onRespond, variant = 'default' }) {
  if (clientResponse) return <ConfirmLine response={clientResponse} />;
  const primaryClass =
    variant === 'urgent'
      ? 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500'
      : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500';
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRespond('interested')}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-2.5 text-sm font-bold shadow-sm transition disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-slate-900 ${primaryClass}`}
      >
        Add LPA to my appointment
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRespond('has_one')}
        className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        I already have a valid LPA
      </button>
    </div>
  );
}

/** @param {{ className?: string, children: React.ReactNode }} props */
function TooltipShell({ className = '', children }) {
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2.5 text-xs leading-snug text-indigo-950 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-100 ${className}`}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** @param {{ text: string }} props */
export function LpaSeedTooltip({ text }) {
  return <TooltipShell>{text}</TooltipShell>;
}

/** @param {{ text: string, why?: string }} props */
export function LpaSeedSoft({ text, why }) {
  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-600 dark:bg-slate-800/80">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Good to know
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-800 dark:text-slate-100">{text}</p>
      {why ? (
        <p className="mt-2 text-xs italic leading-relaxed text-slate-600 dark:text-slate-400">{why}</p>
      ) : null}
    </div>
  );
}

/** @param {{ title: string, text: string }} props */
export function LpaSeedMedium({ title, text }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-indigo-300/80 bg-indigo-50/90 dark:border-indigo-500/40 dark:bg-indigo-500/10">
      <div className="flex items-center gap-2 border-b border-indigo-200/80 bg-indigo-100/80 px-3 py-2 text-sm font-bold text-indigo-950 dark:border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-100">
        <HeartHandshake className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
        {title}
      </div>
      <p className="px-3 pt-3 text-sm leading-relaxed text-slate-800 dark:text-slate-100">{text}</p>
      <p className="px-3 pb-3 pt-2 text-xs italic leading-relaxed text-slate-600 dark:text-slate-400">
        Your solicitor will advise you at your appointment — no decisions needed now.
      </p>
    </div>
  );
}

/** @param {{ title: string, body: string, clientResponse: string | null, disabled: boolean, onRespond: Function }} props */
export function LpaSeedUrgent({ title, body, clientResponse, disabled, onRespond }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-rose-400/60 bg-white dark:border-rose-500/50 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50 px-3 py-2 dark:border-rose-500/30 dark:bg-rose-950/40">
        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
        <span className="text-[11px] font-bold uppercase tracking-wide text-rose-900 dark:text-rose-100">
          Important
        </span>
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{body}</p>
        <LpaCtaRow
          variant="urgent"
          disabled={disabled}
          clientResponse={clientResponse}
          onRespond={onRespond}
        />
      </div>
    </div>
  );
}

const FINAL_THEMES = {
  urgent: {
    wrap: 'border-rose-400/70 bg-rose-50/95 dark:border-rose-500/45 dark:bg-rose-950/30',
    tag: 'bg-rose-100 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100',
    title: 'text-rose-950 dark:text-rose-50',
    body: 'text-rose-900/95 dark:text-rose-100/95',
  },
  high: {
    wrap: 'border-amber-300/90 bg-amber-50/95 dark:border-amber-500/40 dark:bg-amber-950/25',
    tag: 'bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-100',
    title: 'text-amber-950 dark:text-amber-50',
    body: 'text-amber-950/90 dark:text-amber-100/90',
  },
  standard: {
    wrap: 'border-emerald-300/90 bg-emerald-50/90 dark:border-emerald-500/40 dark:bg-emerald-950/25',
    tag: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
    title: 'text-emerald-950 dark:text-emerald-50',
    body: 'text-emerald-900/90 dark:text-emerald-100/90',
  },
};

/**
 * @param {{
 *   priority: 'urgent' | 'high' | 'standard',
 *   title: string,
 *   body: string,
 *   note: string,
 *   clientResponse: string | null,
 *   onRespond: (r: 'interested' | 'has_one' | 'declined') => void,
 * }} props
 */
export function LpaFinalBanner({ priority, title, body, note, clientResponse, onRespond }) {
  const th = FINAL_THEMES[priority] || FINAL_THEMES.standard;
  const tag =
    priority === 'urgent' ? 'Important' : priority === 'high' ? 'Worth considering' : 'While you’re here';

  const disabled = !!clientResponse;

  return (
    <div
      className={`mb-6 overflow-hidden rounded-2xl border shadow-sm ${th.wrap}`}
      role="region"
      aria-label="Lasting Power of Attorney"
    >
      <div className="border-b border-black/5 px-4 py-3 dark:border-white/10">
        <span
          className={`inline-block rounded-full px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${th.tag}`}
        >
          {tag}
        </span>
        <p className={`mt-2 text-base font-bold leading-snug ${th.title}`}>{title}</p>
      </div>
      <div className="bg-white/80 px-4 py-4 dark:bg-slate-900/50">
        <p className={`text-sm leading-relaxed ${th.body}`}>{body}</p>
        <p className="mt-2 text-xs italic leading-relaxed text-slate-600 dark:text-slate-400">{note}</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRespond('interested')}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          >
            Yes — add LPA to my appointment
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRespond('has_one')}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            I already have a valid LPA
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRespond('declined')}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            No thanks
          </button>
        </div>
        {clientResponse ? <ConfirmLine response={clientResponse} /> : null}
      </div>
    </div>
  );
}

/**
 * @param {{ triggers: Record<string, unknown> }} props
 */
export function useLpaFinalBannerCopy({ triggers }) {
  return useMemo(() => {
    const t = triggers || {};
    if (t.capacityConcern) {
      return {
        priority: /** @type {const} */ ('urgent'),
        title: 'Action needed — please discuss LPA with your solicitor before this appointment',
        body:
          'Your will requires a capacity assessment. This is also the most important time to make a Lasting Power of Attorney — it can only be made while you have mental capacity. Once lost, it is too late. Please raise this with your solicitor at your appointment.',
        note: 'This is time-sensitive. Please do not delay.',
      };
    }
    if (t.businessInterests) {
      return {
        priority: /** @type {const} */ ('urgent'),
        title: 'Your business needs an LPA as much as it needs a will',
        body:
          'Your will protects your business when you die. Without a Property & Financial Affairs LPA, if you lost capacity — through illness or an accident — nobody has legal authority to run it, sign contracts, or access accounts. Not a spouse. Not a co-director. Your business could fail within weeks.',
        note:
          'An LPA takes 20 weeks to register after signing. It needs to be done while you’re well. Your solicitor can advise and prepare both documents together.',
      };
    }
    if (t.propertyTrust || (t.minorChild && t.singleNoPartner)) {
      return {
        priority: /** @type {const} */ ('high'),
        title: 'Your will covers death — a Lasting Power of Attorney covers incapacity',
        body:
          'You’ve made careful decisions about your property and your family’s future. Your will only takes effect when you die. Without an LPA, if you were in an accident tomorrow, your family would have no legal authority to manage your affairs — even for simple things like paying bills. They’d need to apply to the Court of Protection, a process taking 6–12 months and costing £3,000–£5,000.',
        note:
          'Your solicitor can advise at your appointment. No commitment needed now — just let us know if you’d like to discuss it.',
      };
    }
    if (t.minorChild) {
      return {
        priority: /** @type {const} */ ('high'),
        title: 'You’ve protected your children’s future in your will — have you covered incapacity too?',
        body:
          'Your will names a guardian for your children if you die. But if you were alive and unable to make decisions, nobody has automatic legal authority to make welfare or medical decisions on your behalf. A Health & Welfare LPA fills that gap — it appoints a trusted person to make those decisions for you.',
        note:
          'This is especially important for parents of young children. Your solicitor can advise at your appointment.',
      };
    }
    return {
      priority: /** @type {const} */ ('standard'),
      title: 'Have you considered a Lasting Power of Attorney?',
      body:
        'You’ve sorted your will — great. Your will protects the people you love when you die. A Lasting Power of Attorney protects them if you can’t make decisions yourself — through illness, an accident, or dementia. Anyone over 18 can make one, and the will appointment is the easiest time to do both together.',
      note:
        'Without an LPA, your family has no legal authority to act for you — even for simple things like speaking to your bank or paying bills. Your solicitor can advise at your appointment.',
    };
  }, [triggers]);
}
