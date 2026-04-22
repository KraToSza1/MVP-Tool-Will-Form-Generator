import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import {
  AlertCircle,
  Check,
  FileText,
  Info,
  Pencil,
  Plus,
  Wallet,
  X,
} from 'lucide-react';
import { formatMonetaryGiftsDetailsFromList } from '../utils/monetaryGiftsFormat.js';

function uid() {
  return `mg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function relationshipFromPick(source, data) {
  const fromData = data && typeof data === 'object' ? String(data.relationship || '').trim() : '';
  if (fromData) return fromData;
  if (source === 'partner') return 'Partner / spouse';
  return '';
}

/** @param {{ field: object, formValues: object, setFormValues: Function, validationErrors?: object, setValidationErrors?: Function, logFormChange?: Function }} props */
export function MonetaryGiftsLeaveQuestion({
  field,
  formValues,
  setFormValues,
  validationErrors = {},
  setValidationErrors,
  logFormChange,
}) {
  const FieldIcon = <Wallet className="w-4 h-4" aria-hidden="true" />;

  return (
    <div className="mb-4 sm:mb-5 group max-w-3xl" data-field-id={field.id}>
      <div className="flex items-start gap-2.5 mb-2">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5">
          {FieldIcon}
        </div>
        <div>
          <label className="block font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug">
            {field.label}
            {field.required && (
              <span className="text-red-500 ml-1" title="Required">
                *
              </span>
            )}
          </label>
        </div>
      </div>

      <div className="flex gap-2 mb-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="m-0">
          WHY WE ASK THIS: A cash gift (also called a pecuniary legacy) lets you leave a specific amount of
          money to someone — separate from the main distribution of your estate. This is useful for friends,
          family members, carers, or charities you want to remember.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {[
          ['To a person', 'e.g. £5,000 to a grandchild, friend, or carer'],
          ['To a charity', 'e.g. £1,000 to a named charity or cause'],
          ['With a condition', 'e.g. only if they survive you by 30 days'],
          ['Multiple gifts', 'You can add as many individual gifts as you like'],
        ].map(([title, sub]) => (
          <div
            key={title}
            className="rounded-lg bg-indigo-50/90 dark:bg-slate-800/90 border border-indigo-100 dark:border-slate-600 px-3 py-2.5"
          >
            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 m-0 mb-0.5">
              ✓ {title}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug">{sub}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-4">
        This is for fixed cash amounts only. Shares of your estate or specific items are handled in separate
        sections.
      </p>

      <div className="space-y-1 mt-2">
        {field.options.map((opt) => {
          const description = opt.description || opt.sublabel;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg px-2 py-2.5 cursor-pointer border transition-colors duration-200 ${
                formValues[field.id] === opt.value
                  ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/80 dark:bg-slate-800/90'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                className="accent-indigo-600 w-4 h-4 mt-1 flex-shrink-0"
                checked={formValues[field.id] === opt.value}
                onChange={(e) => {
                  const newValue = e.target.value;
                  if (typeof logFormChange === 'function') logFormChange(field.id, newValue);
                  if (setValidationErrors) {
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next[field.id];
                      return next;
                    });
                  }
                  setFormValues((prev) => {
                    const next = { ...prev, [field.id]: newValue };
                    if (newValue === 'No') {
                      next.monetaryGiftsList = undefined;
                      next.monetaryGiftsDetails = '';
                    }
                    return next;
                  });
                }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 leading-snug">
                  {opt.label}
                </span>
                {description ? (
                  <span className="block text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                    {description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {validationErrors[field.id] && (
        <p
          id={`${field.id}-error`}
          className="text-xs text-red-500 mt-2 flex items-center gap-2"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle size={14} aria-hidden="true" />
          <span>{validationErrors[field.id]}</span>
        </p>
      )}
    </div>
  );
}

/** @param {{ formValues: object, setFormValues: Function }} props */
export function MonetaryGiftsListPanel({ formValues, setFormValues }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [relationship, setRelationship] = useState('');
  const [amount, setAmount] = useState('');
  const [conditionKey, setConditionKey] = useState('');
  const [lapseKey, setLapseKey] = useState('residue');
  const [errors, setErrors] = useState({ recipient: false, amount: false });
  const [pickContactId, setPickContactId] = useState('');
  const modalTitleId = useId();
  const prevOverflow = useRef('');

  const list = Array.isArray(formValues.monetaryGiftsList) ? formValues.monetaryGiftsList : [];

  const contactPickOptions = useMemo(() => {
    const raw = getContactCandidates(formValues || {});
    return raw.filter((c) => personDisplayNameForGift(c.data) !== '');
  }, [formValues]);

  useEffect(() => {
    const raw = formValues.monetaryGiftsList;
    if (raw === undefined) return;
    const next = raw.length === 0 ? '' : formatMonetaryGiftsDetailsFromList(raw);
    setFormValues((prev) => (prev.monetaryGiftsDetails === next ? prev : { ...prev, monetaryGiftsDetails: next }));
  }, [formValues.monetaryGiftsList, setFormValues]);

  useEffect(() => {
    if (!modalOpen) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow.current;
    };
  }, [modalOpen]);

  const openModal = () => {
    setRecipient('');
    setRelationship('');
    setAmount('');
    setConditionKey('');
    setLapseKey('residue');
    setPickContactId('');
    setErrors({ recipient: false, amount: false });
    setModalOpen(true);
  };

  const applyPickedContact = (id) => {
    setPickContactId(id);
    if (!id) return;
    const c = contactPickOptions.find((x) => x.id === id);
    if (!c) return;
    setRecipient(personDisplayNameForGift(c.data));
    setRelationship(relationshipFromPick(c.source, c.data));
  };

  const closeModal = () => setModalOpen(false);

  const conditionOptions = [
    { value: '', label: 'No condition' },
    { value: 'survives-30', label: 'Only if they survive me by 30 days' },
    { value: 'survives-28', label: 'Only if they survive me by 28 days' },
    { value: 'age-18', label: 'Only when they reach the age of 18' },
    { value: 'age-21', label: 'Only when they reach the age of 21' },
    { value: 'age-25', label: 'Only when they reach the age of 25' },
    { value: 'other', label: 'Other — my solicitor will specify' },
  ];

  const lapseOptions = [
    { value: 'residue', label: 'Falls into the residue of my estate (default)' },
    { value: 'their-children', label: 'Passes to their children instead' },
    { value: 'named-person', label: 'Passes to another named person — I will tell my solicitor who' },
    { value: 'other', label: 'Other — my solicitor will advise' },
  ];

  const saveGift = () => {
    const r = recipient.trim();
    const amountRaw = amount.trim();
    const amountNum = parseFloat(amountRaw.replace(/[£,\s]/g, ''), 10);
    const nextErr = { recipient: !r, amount: !amountRaw || !Number.isFinite(amountNum) || amountNum <= 0 };
    setErrors(nextErr);
    if (nextErr.recipient || nextErr.amount) return;

    const condOpt = conditionOptions.find((o) => o.value === conditionKey) || conditionOptions[0];
    const lapseOpt = lapseOptions.find((o) => o.value === lapseKey) || lapseOptions[0];

    const entry = {
      id: uid(),
      recipientName: r,
      recipientRelationship: relationship.trim(),
      amount: amountNum,
      conditionKey: conditionKey || '',
      conditionLabel: conditionKey ? condOpt.label : 'None',
      lapseKey,
      lapseLabel: lapseOpt.label,
    };

    setFormValues((prev) => {
      const prevList = Array.isArray(prev.monetaryGiftsList) ? prev.monetaryGiftsList : [];
      return {
        ...prev,
        monetaryGiftsList: [...prevList, entry],
      };
    });
    closeModal();
  };

  const removeGift = (id) => {
    setFormValues((prev) => {
      const prevList = Array.isArray(prev.monetaryGiftsList) ? prev.monetaryGiftsList : [];
      return { ...prev, monetaryGiftsList: prevList.filter((g) => g.id !== id) };
    });
  };

  return (
    <div className="mb-4 rounded-xl border-l-4 border-indigo-600 dark:border-indigo-500 bg-indigo-50/95 dark:bg-slate-800/95 border border-indigo-100/80 dark:border-slate-600 p-4 sm:p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Wallet className="w-4 h-4" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300 m-0">Your cash gifts</h3>
      </div>
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic m-0 mb-4 leading-relaxed">
        Add each gift below. You can add as many as you like — each one will appear in your will separately.
      </p>

      <div className="space-y-2.5 mb-4">
        {list.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-4 py-3.5">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0 mb-0.5">No gifts added yet</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 m-0">
              Click &quot;Add Gift&quot; below to specify your first cash gift.
            </p>
          </div>
        ) : (
          list.map((g) => (
            <div
              key={g.id}
              className="flex gap-3 items-start rounded-xl border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-900/50 px-4 py-3.5"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                <Wallet className="w-[18px] h-[18px]" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 m-0 mb-0.5">
                  £{Number(g.amount).toLocaleString('en-GB', { maximumFractionDigits: 2 })}
                </p>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0 mb-0.5 break-words">
                  {g.recipientName}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug">
                  {[g.recipientRelationship, g.conditionLabel !== 'None' ? g.conditionLabel : null, g.lapseKey !== 'residue' ? g.lapseLabel : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 px-2 py-1 rounded-md flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
        className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-offset-slate-900"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
        Add Gift
      </button>

      {modalOpen && typeof document !== 'undefined'
        ? createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-2xl dark:bg-slate-900 dark:text-slate-100 dark:border-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-200 dark:border-white/10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/25 dark:text-indigo-300 flex items-center justify-center flex-shrink-0">
                  <Pencil className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p id={modalTitleId} className="text-lg font-bold text-slate-900 dark:text-slate-100 m-0">
                    Add a cash gift
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 m-0 mt-0.5">Specify the recipient and amount</p>
                </div>
              </div>
              <button
                type="button"
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 p-1 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close"
                onClick={closeModal}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 dark:border-slate-600/80 dark:bg-indigo-500/10">
                <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-xs text-slate-700 dark:text-slate-300 m-0 leading-relaxed">
                  Each gift should have a clear recipient name and a specific amount in pounds. Add one gift at
                  a time — you can add as many as you need.
                </p>
              </div>

              {contactPickOptions.length > 0 ? (
                <div>
                  <label htmlFor="mg-pick-contact" className="block text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                    Choose someone you&apos;ve already entered <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <select
                    id="mg-pick-contact"
                    className="w-full min-h-[44px] rounded-lg px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/40"
                    value={pickContactId}
                    onChange={(e) => applyPickedContact(e.target.value)}
                  >
                    <option value="">— Type name manually below —</option>
                    {contactPickOptions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-500 m-0 mt-1">
                    Fills recipient (and relationship when known) from your form — you can still edit before saving.
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor="mg-recipient" className="block text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                  Recipient&apos;s full name <span className="text-red-600 dark:text-red-400">*</span>
                </label>
                <input
                  id="mg-recipient"
                  type="text"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    if (pickContactId) setPickContactId('');
                  }}
                  placeholder="e.g. Richard Jones, Cancer Research UK"
                  className={`w-full min-h-[44px] rounded-lg px-3.5 py-2.5 text-sm bg-white border text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/40 ${
                    errors.recipient ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                  }`}
                />
                {errors.recipient && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 m-0">Recipient name is required</p>
                )}
              </div>

              <div>
                <label htmlFor="mg-relationship" className="block text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                  Their relationship to you{' '}
                  <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <input
                  id="mg-relationship"
                  type="text"
                  value={relationship}
                  onChange={(e) => {
                    setRelationship(e.target.value);
                    if (pickContactId) setPickContactId('');
                  }}
                  placeholder="e.g. nephew, friend, charity, carer"
                  className="w-full min-h-[44px] rounded-lg px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/40"
                />
                <p className="text-xs text-slate-500 dark:text-slate-500 m-0 mt-1">
                  Helps identify the correct person if there are others with the same name.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="mg-amount" className="block text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                    Amount (£) <span className="text-red-600 dark:text-red-400">*</span>
                  </label>
                  <input
                    id="mg-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className={`w-full min-h-[44px] rounded-lg px-3.5 py-2.5 text-sm bg-white border text-slate-900 placeholder:text-slate-500 dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/40 ${
                      errors.amount ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                  {errors.amount && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 m-0">Please enter a valid amount</p>
                  )}
                </div>
                <div>
                  <label htmlFor="mg-condition" className="block text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                    Any condition on this gift?{' '}
                    <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <select
                    id="mg-condition"
                    value={conditionKey}
                    onChange={(e) => setConditionKey(e.target.value)}
                    className="w-full min-h-[44px] rounded-lg px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/40"
                  >
                    {conditionOptions.map((o) => (
                      <option key={o.value || 'none'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="mg-lapse" className="block text-xs text-slate-700 dark:text-slate-300 mb-1.5">
                  If this recipient cannot receive the gift, what should happen to it?
                </label>
                <select
                  id="mg-lapse"
                  value={lapseKey}
                  onChange={(e) => setLapseKey(e.target.value)}
                  className="w-full min-h-[44px] rounded-lg px-3.5 py-2.5 text-sm bg-white border border-slate-300 text-slate-900 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:focus:ring-indigo-500/40"
                >
                  {lapseOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 dark:text-slate-500 m-0 mt-1">
                  This overrides the general fallback rule for this specific gift only.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={closeModal}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-300 text-slate-800 bg-white hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:bg-transparent dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveGift}
                className="inline-flex w-full sm:w-auto min-h-[44px] items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-600 dark:hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
              >
                <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
                Save gift
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

/** @param {{ field: object, formValues: object, setFormValues: Function, validationErrors?: object, setValidationErrors?: Function, logFormChange?: Function }} props */
export function MonetaryGiftsLapseQuestion({
  field,
  formValues,
  setFormValues,
  validationErrors = {},
  setValidationErrors,
  logFormChange,
}) {
  const FieldIcon = <FileText className="w-4 h-4" aria-hidden="true" />;

  return (
    <div className="mb-4 sm:mb-5 group max-w-3xl" data-field-id={field.id}>
      <div className="flex items-start gap-2.5 mb-2">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5">
          {FieldIcon}
        </div>
        <label className="block font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug">
          {field.label}
          {field.required && (
            <span className="text-red-500 ml-1" title="Required">
              *
            </span>
          )}
        </label>
      </div>

      <div className="flex gap-2 mb-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="m-0">
          WHY WE ASK THIS: If someone you&apos;ve left a gift to dies before you, that gift &quot;fails&quot; — the
          money has nowhere to go unless you say what should happen to it. This question decides the fallback rule
          for all your cash gifts.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
        <div className="rounded-lg border border-indigo-200 dark:border-slate-600 bg-indigo-50/80 dark:bg-slate-800/80 px-3 py-3">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 m-0 mb-1.5">If you say Yes</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 mb-1 leading-snug">
            The failed gift is shared out between your other beneficiaries in proportion to what they were already
            getting from your estate.
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug">
            E.g. if the remaining estate goes 50/50 to two people, the failed gift is also split 50/50 between them.
          </p>
        </div>
        <div className="rounded-lg border border-indigo-200 dark:border-slate-600 bg-indigo-50/80 dark:bg-slate-800/80 px-3 py-3">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 m-0 mb-1.5">If you say No</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 mb-1 leading-snug">
            The failed gift falls into the residue of your estate (the pot of everything left over after other gifts).
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug">
            This is the default position — often simpler unless you have a specific reason to distribute
            proportionately.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-3">
        Not sure? Most people choose &quot;No&quot; or speak to their solicitor — they can confirm the right approach
        for your estate.
      </p>

      <div className="space-y-1 mt-2">
        {field.options.map((opt) => {
          const description = opt.description || opt.sublabel;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg px-2 py-2.5 cursor-pointer border transition-colors duration-200 ${
                formValues[field.id] === opt.value
                  ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50/80 dark:bg-slate-800/90'
                  : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:border-slate-200 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                className="accent-indigo-600 w-4 h-4 mt-1 flex-shrink-0"
                checked={formValues[field.id] === opt.value}
                onChange={(e) => {
                  const newValue = e.target.value;
                  if (typeof logFormChange === 'function') logFormChange(field.id, newValue);
                  if (setValidationErrors) {
                    setValidationErrors((prev) => {
                      const next = { ...prev };
                      delete next[field.id];
                      return next;
                    });
                  }
                  setFormValues((prev) => ({ ...prev, [field.id]: newValue }));
                }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 leading-snug">
                  {opt.label}
                </span>
                {description ? (
                  <span className="block text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">
                    {description}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>

      {validationErrors[field.id] && (
        <p
          id={`${field.id}-error`}
          className="text-xs text-red-500 mt-2 flex items-center gap-2"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle size={14} aria-hidden="true" />
          <span>{validationErrors[field.id]}</span>
        </p>
      )}
    </div>
  );
}
