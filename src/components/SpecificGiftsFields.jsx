import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import {
  AlertCircle,
  Check,
  FileText,
  Gift,
  Info,
  Plus,
  X,
} from 'lucide-react';
import { formatSpecificGiftsDetailsFromList } from '../utils/specificGiftsFormat.js';

function uid() {
  return `sg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function relationshipFromPick(source, data) {
  const fromData = data && typeof data === 'object' ? String(data.relationship || '').trim() : '';
  if (fromData) return fromData;
  if (source === 'partner') return 'Partner / spouse';
  return '';
}

const ITEM_TYPE_OPTIONS = [
  { value: '', label: 'Select a category…' },
  { value: 'jewellery', label: 'Jewellery or watches' },
  { value: 'property', label: 'Property or land' },
  { value: 'vehicle', label: 'Vehicle (car, motorcycle, boat)' },
  { value: 'artwork', label: 'Artwork or antiques' },
  { value: 'furniture', label: 'Furniture or household items' },
  { value: 'financial', label: 'Financial account or investment' },
  { value: 'business', label: 'Business interest or shares' },
  { value: 'digital', label: 'Digital assets (accounts, crypto)' },
  { value: 'other', label: 'Other' },
];

/** @param {{ field: object, formValues: object, setFormValues: Function, validationErrors?: object, setValidationErrors?: Function, logFormChange?: Function }} props */
export function SpecificGiftsLeaveQuestion({
  field,
  formValues,
  setFormValues,
  validationErrors = {},
  setValidationErrors,
  logFormChange,
}) {
  const FieldIcon = <Gift className="w-4 h-4" aria-hidden="true" />;

  return (
    <div className="mb-4 sm:mb-5 group max-w-3xl min-w-0" data-field-id={field.id}>
      <div className="flex items-start gap-2.5 mb-2">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5">
          {FieldIcon}
        </div>
        <div className="min-w-0">
          <label className="block font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug break-words">
            {field.label}
            {field.required && (
              <span className="text-red-500 ml-1" title="Required">
                *
              </span>
            )}
          </label>
        </div>
      </div>

      <div className="flex gap-2 mb-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed">
        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400 dark:text-slate-500" aria-hidden="true" />
        <p className="m-0">
          WHY WE ASK THIS: A specific gift (also called a specific legacy) lets you leave a named item directly to a
          named person or organisation. This is separate from cash gifts and from the general distribution of your
          estate.
        </p>
      </div>

      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 m-0 mb-3 leading-relaxed">
        A specific gift is any identifiable item you own that you want to go to a specific person. Common examples:
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        {[
          ['Jewellery', 'e.g. My diamond engagement ring to my daughter Jane'],
          ['Property', 'e.g. My holiday cottage in Cornwall to my son'],
          ['Vehicles', 'e.g. My 1967 Jaguar E-Type to my nephew'],
          ['Artwork & collectibles', 'e.g. My oil painting by [artist] to a named person'],
          ['Furniture & heirlooms', "e.g. My grandmother's grandfather clock to my sister"],
          ['Financial accounts', 'e.g. My ISA at Barclays to my partner'],
        ].map(([title, sub]) => (
          <div
            key={title}
            className="rounded-lg bg-indigo-50/90 dark:bg-slate-800/90 border border-indigo-100 dark:border-slate-600 px-3 py-2.5 min-w-0"
          >
            <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 m-0 mb-0.5 break-words">
              ✓ {title}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug break-words">{sub}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-4 break-words">
        Be as specific as possible when describing the item — this avoids disputes. If you&apos;re not sure how to
        describe it, your solicitor can help.
      </p>

      <div className="space-y-1 mt-2">
        {field.options.map((opt) => {
          const description = opt.description || opt.sublabel;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg px-2 py-2.5 cursor-pointer border transition-colors duration-200 min-h-[44px] ${
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
                      next.specificGiftsList = undefined;
                      next.specificGiftsDetails = '';
                      next.failedSpecificGiftPassProportionately = null;
                    }
                    return next;
                  });
                }}
              />
              <span className="flex-1 min-w-0">
                <span className="block text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 leading-snug break-words">
                  {opt.label}
                </span>
                {description ? (
                  <span className="block text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-snug break-words">
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
export function SpecificGiftsListPanel({ formValues, setFormValues }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [itemType, setItemType] = useState('');
  const [itemLocation, setItemLocation] = useState('');
  const [recipient, setRecipient] = useState('');
  const [relationship, setRelationship] = useState('');
  const [conditionKey, setConditionKey] = useState('');
  const [lapseKey, setLapseKey] = useState('residue');
  const [errors, setErrors] = useState({ description: false, itemType: false, recipient: false });
  const [pickContactId, setPickContactId] = useState('');
  const modalTitleId = useId();
  const prevOverflow = useRef('');

  const list = Array.isArray(formValues.specificGiftsList) ? formValues.specificGiftsList : [];

  const contactPickOptions = useMemo(() => getContactCandidates(formValues || {}), [formValues]);

  useEffect(() => {
    const raw = formValues.specificGiftsList;
    if (raw === undefined) return;
    const next = raw.length === 0 ? '' : formatSpecificGiftsDetailsFromList(raw);
    setFormValues((prev) => (prev.specificGiftsDetails === next ? prev : { ...prev, specificGiftsDetails: next }));
  }, [formValues.specificGiftsList, setFormValues]);

  useEffect(() => {
    if (!modalOpen) return;
    prevOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow.current;
    };
  }, [modalOpen]);

  const openModal = () => {
    setDescription('');
    setItemType('');
    setItemLocation('');
    setRecipient('');
    setRelationship('');
    setConditionKey('');
    setLapseKey('residue');
    setPickContactId('');
    setErrors({ description: false, itemType: false, recipient: false });
    setModalOpen(true);
  };

  const applyPickedContact = (id) => {
    setPickContactId(id);
    if (!id) return;
    const c = contactPickOptions.find((x) => x.id === id);
    if (!c) return;
    const d = c.data;
    const fromParts = personDisplayNameForGift(d);
    const fromFull = d && String(d.fullName || '').trim();
    const fromLabel =
      !fromParts && !fromFull && c.label
        ? String(c.label)
            .replace(/^Specific gift —\s*/i, '')
            .replace(/^Cash gift —\s*/i, '')
            .replace(/^.+?#\d+\s*—\s*/i, '')
            .trim()
        : '';
    setRecipient(fromParts || fromFull || fromLabel);
    setRelationship(relationshipFromPick(c.source, d));
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
    const d = description.trim();
    const r = recipient.trim();
    const nextErr = {
      description: !d,
      itemType: !itemType,
      recipient: !r,
    };
    setErrors(nextErr);
    if (nextErr.description || nextErr.itemType || nextErr.recipient) return;

    const condOpt = conditionOptions.find((o) => o.value === conditionKey) || conditionOptions[0];
    const lapseOpt = lapseOptions.find((o) => o.value === lapseKey) || lapseOptions[0];
    const typeOpt = ITEM_TYPE_OPTIONS.find((o) => o.value === itemType) || ITEM_TYPE_OPTIONS[0];

    const entry = {
      id: uid(),
      itemDescription: d,
      itemType,
      itemTypeLabel: typeOpt.label,
      itemLocation: itemLocation.trim(),
      recipientName: r,
      recipientRelationship: relationship.trim(),
      conditionKey: conditionKey || '',
      conditionLabel: conditionKey ? condOpt.label : 'None',
      lapseKey,
      lapseLabel: lapseOpt.label,
    };

    setFormValues((prev) => {
      const prevList = Array.isArray(prev.specificGiftsList) ? prev.specificGiftsList : [];
      return {
        ...prev,
        specificGiftsList: [...prevList, entry],
      };
    });
    closeModal();
  };

  const removeGift = (id) => {
    setFormValues((prev) => {
      const prevList = Array.isArray(prev.specificGiftsList) ? prev.specificGiftsList : [];
      return { ...prev, specificGiftsList: prevList.filter((g) => g.id !== id) };
    });
  };

  return (
    <div className="mb-4 rounded-xl border-l-4 border-indigo-600 dark:border-indigo-500 bg-indigo-50/95 dark:bg-slate-800/95 border border-indigo-100/80 dark:border-slate-600 p-4 sm:p-5 max-w-3xl min-w-0">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Gift className="w-4 h-4" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-indigo-700 dark:text-indigo-300 m-0">Your specific gifts</h3>
      </div>
      <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 italic m-0 mb-4 leading-relaxed break-words">
        Add each item below. Each gift will appear separately in your will with the full description exactly as
        you&apos;ve entered it.
      </p>

      <div className="space-y-2.5 mb-4">
        {list.length === 0 ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-4 py-3.5 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 m-0 mb-0.5">No specific gifts added yet</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 m-0 break-words">
              Click &quot;Add specific gift&quot; below to describe your first item and who should receive it.
            </p>
          </div>
        ) : (
          list.map((g) => (
            <div
              key={g.id}
              className="flex gap-3 items-start rounded-xl border border-indigo-200 dark:border-slate-600 bg-white dark:bg-slate-900/50 px-4 py-3.5 min-w-0"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                <Gift className="w-[18px] h-[18px]" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 m-0 mb-0.5 break-words line-clamp-2">
                  {g.itemDescription}
                </p>
                <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 m-0 mb-0.5 break-words">
                  {g.recipientName}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug break-words">
                  {[
                    g.itemTypeLabel || g.itemType,
                    g.itemLocation,
                    g.recipientRelationship,
                    g.conditionLabel !== 'None' ? g.conditionLabel : null,
                    g.lapseKey !== 'residue' ? g.lapseLabel : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 px-2 py-1 rounded-md min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
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
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white text-sm font-semibold px-5 py-2.5 min-h-[44px] w-full sm:w-auto focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 dark:focus-visible:ring-offset-slate-900"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden="true" />
        Add specific gift
      </button>

      {modalOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 overflow-y-auto"
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
                      <Gift className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p id={modalTitleId} className="m-0 break-words text-lg font-bold text-slate-900 dark:text-slate-100">
                        Add a specific gift
                      </p>
                      <p className="m-0 mt-0.5 text-xs text-slate-600 dark:text-slate-400">Describe the item and who should receive it</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-slate-100"
                    aria-label="Close"
                    onClick={closeModal}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                  <div className="flex gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5 dark:border-slate-600/80 dark:bg-indigo-500/10">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
                    <p className="m-0 break-words text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                      Choose who receives this gift (you can copy someone already on your form), then describe the item.
                      Add one gift at a time.
                    </p>
                  </div>

                  <p className="m-0 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-500">
                    Who receives this item
                  </p>

                  <div>
                    <label htmlFor="sg-pick-contact" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                      Choose someone you&apos;ve already entered <span className="font-normal text-slate-500">(optional)</span>
                    </label>
                    <select
                      id="sg-pick-contact"
                      className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
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
                    <p className="mt-1 m-0 break-words text-xs text-slate-500 dark:text-slate-500">
                      {contactPickOptions.length > 0
                        ? 'Fills recipient and relationship when known — you can still edit. Includes executors, guardians, gift recipients, and saved contacts.'
                        : 'Add people elsewhere in the form (or save another gift) and they will appear here. You can always type a new name below.'}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="sg-recipient" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                      Recipient&apos;s full name <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="sg-recipient"
                      type="text"
                      value={recipient}
                      onChange={(e) => {
                        setRecipient(e.target.value);
                        if (pickContactId) setPickContactId('');
                      }}
                      placeholder="e.g. Jane Elizabeth Smith, Cancer Research UK"
                      className={`w-full min-h-[44px] rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40 ${
                        errors.recipient ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    />
                    {errors.recipient && (
                      <p className="mt-1 m-0 text-xs text-red-600 dark:text-red-400">Recipient name is required</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="sg-relationship" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                      Their relationship to you{' '}
                      <span className="font-normal text-slate-500">(optional but recommended)</span>
                    </label>
                    <input
                      id="sg-relationship"
                      type="text"
                      value={relationship}
                      onChange={(e) => {
                        setRelationship(e.target.value);
                        if (pickContactId) setPickContactId('');
                      }}
                      placeholder="e.g. my daughter, my nephew, my closest friend"
                      className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                    />
                  </div>

                  <p className="m-0 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-500">
                    About the item
                  </p>

                  <p className="-mt-2 m-0 break-words text-xs text-slate-500 dark:text-slate-500">
                    Describe the item clearly enough that it could be identified without any doubt. The more specific you
                    are, the less room for dispute.
                  </p>

                  <div>
                    <label htmlFor="sg-description" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                      Description of the item <span className="text-red-600 dark:text-red-400">*</span>
                    </label>
                    <input
                      id="sg-description"
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. My diamond engagement ring, my 1967 Jaguar E-Type registration ABC 123"
                      className={`w-full min-h-[44px] break-words rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40 ${
                        errors.description ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    />
                    {errors.description && <p className="mt-1 m-0 text-xs text-red-600 dark:text-red-400">Please describe the item</p>}
                    <p className="mt-1 m-0 break-words text-xs text-slate-500 dark:text-slate-500">
                      Be as specific as possible — include make, model, registration, stone type, or any identifying marks.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="sg-type" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                        Type of item <span className="text-red-600 dark:text-red-400">*</span>
                      </label>
                      <select
                        id="sg-type"
                        value={itemType}
                        onChange={(e) => setItemType(e.target.value)}
                        className={`min-h-[44px] w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40 ${
                          errors.itemType ? 'border-red-500 dark:border-red-400' : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {ITEM_TYPE_OPTIONS.map((o) => (
                          <option key={o.value || 'empty'} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {errors.itemType && <p className="mt-1 m-0 text-xs text-red-600 dark:text-red-400">Please select a type</p>}
                    </div>
                    <div>
                      <label htmlFor="sg-location" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                        Where is it kept? <span className="font-normal text-slate-500">(optional)</span>
                      </label>
                      <input
                        id="sg-location"
                        type="text"
                        value={itemLocation}
                        onChange={(e) => setItemLocation(e.target.value)}
                        placeholder="e.g. At my home, in a safe at the bank"
                        className="w-full min-h-[44px] rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                      />
                    </div>
                  </div>

                  <p className="m-0 border-b border-slate-200 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:border-white/10 dark:text-slate-500">
                    Conditions (optional)
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="sg-condition" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                        Any condition on this gift?
                      </label>
                      <select
                        id="sg-condition"
                        value={conditionKey}
                        onChange={(e) => setConditionKey(e.target.value)}
                        className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                      >
                        {conditionOptions.map((o) => (
                          <option key={o.value || 'none'} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="sg-lapse" className="mb-1.5 block text-xs text-slate-700 dark:text-slate-300">
                        If this recipient cannot receive it, what should happen?
                      </label>
                      <select
                        id="sg-lapse"
                        value={lapseKey}
                        onChange={(e) => setLapseKey(e.target.value)}
                        className="min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-indigo-500/40"
                      >
                        {lapseOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 m-0 break-words text-xs text-slate-500 dark:text-slate-500">
                        This overrides the general fallback rule for this specific item only.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse flex-wrap gap-2 border-t border-slate-200 px-5 py-4 dark:border-white/10 sm:flex-row sm:flex-nowrap sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-600 dark:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800 sm:w-auto"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveGift}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:hover:bg-indigo-500 dark:focus-visible:ring-offset-slate-900 sm:w-auto"
                  >
                    <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
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
export function SpecificGiftsLapseQuestion({
  field,
  formValues,
  setFormValues,
  validationErrors = {},
  setValidationErrors,
  logFormChange,
}) {
  const FieldIcon = <FileText className="w-4 h-4" aria-hidden="true" />;

  return (
    <div className="mb-4 sm:mb-5 group max-w-3xl min-w-0" data-field-id={field.id}>
      <div className="flex items-start gap-2.5 mb-2">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5">
          {FieldIcon}
        </div>
        <label className="block font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base leading-snug break-words">
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
        <p className="m-0 break-words">
          WHY WE ASK THIS: If someone you&apos;ve left a specific item to dies before you, that gift &quot;fails&quot; and
          needs a fallback rule. This question sets the default for all your specific gifts — you can also set a
          per-item rule when you add each gift.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
        <div className="rounded-lg border border-indigo-200 dark:border-slate-600 bg-indigo-50/80 dark:bg-slate-800/80 px-3 py-3 min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 m-0 mb-1.5">If you say Yes</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 mb-1 leading-snug break-words">
            The failed gift is shared proportionately among your other beneficiaries according to their existing shares
            of the estate.
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug break-words">
            E.g. if two people each get 50% of the residue, they split the failed gift equally.
          </p>
        </div>
        <div className="rounded-lg border border-indigo-200 dark:border-slate-600 bg-indigo-50/80 dark:bg-slate-800/80 px-3 py-3 min-w-0">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 m-0 mb-1.5">If you say No</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 mb-1 leading-snug break-words">
            The failed gift falls into the residue of your estate — the general pot distributed under the rest of your
            will.
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 m-0 leading-snug break-words">
            This is the standard default and is simpler for most estates.
          </p>
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 m-0 mb-3 break-words">
        Not sure? Most people choose &quot;No&quot; or ask their solicitor — it rarely makes a practical difference
        unless your estate is distributed in shares.
      </p>

      <div className="space-y-1 mt-2">
        {field.options.map((opt) => {
          const description = opt.description || opt.sublabel;
          return (
            <label
              key={opt.value}
              className={`flex items-start gap-3 rounded-lg px-2 py-2.5 cursor-pointer border transition-colors duration-200 min-h-[44px] ${
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
                <span className="block text-sm sm:text-[15px] text-slate-900 dark:text-slate-100 leading-snug break-words">
                  {opt.label}
                </span>
                {description ? (
                  <span className="block text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5 leading-snug break-words">
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
