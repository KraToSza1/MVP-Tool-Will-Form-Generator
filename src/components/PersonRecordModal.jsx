import React, { useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, X, Check, Info } from 'lucide-react';
import { PERSON_RECORD_SPECS, emptyPersonRecord, pickPersonFieldsForModal, getMergedPersonSpecs } from '../utils/personRecordSpecs.js';
import {
  getContactCandidates,
  finalizePersonRecordForSave,
  validatePersonRecordMin,
} from '../lib/personRegistry.js';
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';

const LOG =
  typeof import.meta !== 'undefined' &&
  (import.meta.env?.DEV || import.meta.env?.VITE_DEBUG_PERSON_FLOW === 'true');

function logPerson(...args) {
  if (LOG) console.log('[WillTool Person]', ...args);
}

/**
 * Full person capture + "same person" prefill from testator, partner, registry, or existing *Data rows.
 */
export default function PersonRecordModal({
  open,
  onClose,
  onSave,
  formValues,
  contextLabel,
  targetFieldId,
  initialData,
}) {
  const { formData } = useFormDefinition();
  const personSpecs = useMemo(() => getMergedPersonSpecs(formData?._personFieldOverrides), [formData?._personFieldOverrides]);
  const candidates = useMemo(() => getContactCandidates(formValues || {}), [formValues]);
  const [sourceId, setSourceId] = useState('__new__');
  const [draft, setDraft] = useState(() => emptyPersonRecord());
  const firstInputRef = useRef(null);
  const wasOpenRef = useRef(false);

  const isEditMode = initialData != null && typeof initialData === 'object';

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;
    logPerson('modal_open', {
      contextLabel,
      targetFieldId,
      candidateCount: candidates.length,
      isEdit: isEditMode,
    });
    if (isEditMode) {
      setSourceId('__new__');
      setDraft({ ...emptyPersonRecord(), ...pickPersonFieldsForModal(initialData) });
    } else {
      setSourceId('__new__');
      setDraft(emptyPersonRecord());
    }
  }, [open, contextLabel, targetFieldId, candidates, isEditMode, initialData]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [open, sourceId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const applySource = (id) => {
    setSourceId(id);
    if (id === '__new__') {
      logPerson('prefill_cleared', { targetFieldId });
      setDraft(emptyPersonRecord());
      return;
    }
    const c = candidates.find((x) => x.id === id);
    if (c?.data) {
      logPerson('prefill_applied', { targetFieldId, source: c.source, id: c.id });
      setDraft({ ...emptyPersonRecord(), ...pickPersonFieldsForModal(c.data) });
    }
  };

  const handleSave = () => {
    if (!validatePersonRecordMin(draft)) {
      logPerson('save_blocked_validation', { targetFieldId });
      return;
    }
    const row = finalizePersonRecordForSave(draft, sourceId !== '__new__' ? sourceId : null);
    logPerson('modal_save_ok', { targetFieldId, contextLabel, fieldKeys: Object.keys(draft).filter((k) => draft[k]) });
    onSave(row);
    onClose();
  };

  if (!open) return null;

  const node = (
    <div
      className="person-record-modal fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-record-modal-title"
        className="max-h-[min(90dvh,900px)] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-700 bg-slate-950/95 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p id="person-record-modal-title" className="flex items-center gap-2 text-base font-semibold text-slate-100">
              <User className="h-5 w-5 shrink-0 text-indigo-400" aria-hidden />
              <span>{isEditMode ? 'Edit person' : 'Add person'}</span>
            </p>
            {contextLabel ? (
              <p className="mt-0.5 text-xs text-slate-400">For: {contextLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4 sm:px-5">
          {!isEditMode && (
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Same person or new</span>
              <select
                value={sourceId}
                onChange={(e) => applySource(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="__new__">Enter a new person</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          <p className="flex gap-2 text-xs text-slate-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
            <span>
              {isEditMode
                ? 'Update the details below and save. First name, last name, and at least address line 1 or postcode are required.'
                : 'You can copy from someone you already entered, then edit. First name, last name, and at least address line 1 or postcode are required.'}
            </span>
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {personSpecs.map((spec, i) => (
              <label key={spec.key} className="block text-sm">
                <span className="text-slate-400">{spec.label}</span>
                {spec.type === 'select' ? (
                  <select
                    ref={i === 0 ? firstInputRef : undefined}
                    value={draft[spec.key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [spec.key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                  >
                    {(spec.options || []).map((opt) => (
                      <option key={opt.value || 'empty'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    ref={i === 0 ? firstInputRef : undefined}
                    type="text"
                    value={draft[spec.key] ?? ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [spec.key]: e.target.value }))}
                    placeholder={spec.placeholder || ''}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                  />
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-700 bg-slate-950/90 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <Check className="h-4 w-4" aria-hidden />
            {isEditMode ? 'Save changes' : 'Add person'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
