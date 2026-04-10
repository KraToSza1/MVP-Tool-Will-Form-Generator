import React, { useState, useMemo } from 'react';
import { Plus, CheckCircle2, Trash2, Pencil, Info, ShieldCheck } from 'lucide-react';
import PersonRecordModal from './PersonRecordModal.jsx';
import { ADD_PERSON_FIELDS_HINT, formatPersonRecordForClause } from '../utils/personRecordSpecs.js';
import { upsertRegistryContact } from '../lib/personRegistry.js';
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';
import { toast } from 'sonner';

const LOG =
  typeof import.meta !== 'undefined' &&
  (import.meta.env?.DEV || import.meta.env?.VITE_DEBUG_PERSON_FLOW === 'true');

function logPerson(...args) {
  if (LOG) console.log('[WillTool Person]', ...args);
}

/**
 * Replaces legacy single-line add field: opens PersonRecordModal for rich rows + registry sync.
 */
export default function AddPersonButtonField({ field, formValues, setFormValues }) {
  const rawTarget = field.id.replace(/^add/i, '').replace(/Button$/i, 'Data');
  const targetFieldId = rawTarget.charAt(0).toLowerCase() + rawTarget.slice(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  const existingItems = Array.isArray(formValues[targetFieldId])
    ? formValues[targetFieldId]
    : formValues[targetFieldId]
      ? [formValues[targetFieldId]]
      : [];

  const displayLine = (item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      return formatPersonRecordForClause(item) || '—';
    }
    return String(item ?? '');
  };

  const isDuplicateEntry = (row, items) => {
    const fp = [row.firstName, row.lastName, row.dateOfBirth].map((v) => (v || '').toString().trim().toLowerCase()).join('|');
    if (!fp.replace(/\|/g, '')) return false;
    return items.some((item) => {
      if (!item || typeof item !== 'object') return false;
      const efp = [item.firstName, item.lastName, item.dateOfBirth].map((v) => (v || '').toString().trim().toLowerCase()).join('|');
      return efp === fp;
    });
  };

  const handleSave = (row) => {
    if (isDuplicateEntry(row, existingItems)) {
      toast.error('This person has already been added', { description: 'You can edit the existing entry instead.' });
      return;
    }
    logPerson('add_button_save', { targetFieldId, label: field.label, newIndex: existingItems.length });
    setFormValues((prev) => {
      const prevItems = Array.isArray(prev[targetFieldId])
        ? prev[targetFieldId]
        : prev[targetFieldId]
          ? [prev[targetFieldId]]
          : [];
      const updatedItems = [...prevItems, row];
      let next = { ...prev, [targetFieldId]: updatedItems };
      next = upsertRegistryContact(next, row);
      return next;
    });
  };

  const handleRemoveItem = (indexToRemove) => {
    logPerson('add_button_remove', { targetFieldId, index: indexToRemove });
    const updatedItems = existingItems.filter((_, index) => index !== indexToRemove);
    setFormValues((prev) => ({
      ...prev,
      [targetFieldId]: updatedItems.length > 0 ? updatedItems : [],
    }));
  };

  const handleEditItem = (index) => {
    logPerson('add_button_edit_open', { targetFieldId, index });
    setEditIndex(index);
  };

  const handleEditSave = (row) => {
    logPerson('add_button_edit_save', { targetFieldId, index: editIndex });
    setFormValues((prev) => {
      const prevItems = Array.isArray(prev[targetFieldId])
        ? [...prev[targetFieldId]]
        : prev[targetFieldId]
          ? [prev[targetFieldId]]
          : [];
      if (editIndex != null && editIndex < prevItems.length) {
        prevItems[editIndex] = row;
      }
      let next = { ...prev, [targetFieldId]: prevItems };
      next = upsertRegistryContact(next, row);
      return next;
    });
    setEditIndex(null);
  };

  return (
    <div className="mb-4 animate-slideIn" data-field-id={field.id}>
      <button
        type="button"
        data-field-id={field.id}
        aria-label={ADD_PERSON_FIELDS_HINT ? `${field.label} — ${ADD_PERSON_FIELDS_HINT}` : field.label}
        onClick={() => {
          logPerson('add_button_open_modal', { targetFieldId, fieldId: field.id });
          setModalOpen(true);
        }}
        className="group bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-4 py-3 sm:px-6 rounded-xl shadow-lg transition-all duration-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-start gap-2 sm:gap-3 text-left min-h-[44px] transform hover:scale-[1.02] active:scale-95 w-full sm:w-auto"
      >
        <Plus
          className="w-5 h-5 shrink-0 mt-0.5 group-hover:rotate-90 transition-transform duration-300"
          aria-hidden
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="leading-snug">{field.label}</span>
          {ADD_PERSON_FIELDS_HINT ? (
            <span className="text-xs font-normal opacity-90 leading-tight wrap-break-word">
              {ADD_PERSON_FIELDS_HINT}
            </span>
          ) : null}
        </span>
      </button>

      <PersonRecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        formValues={formValues}
        contextLabel={field.label}
        targetFieldId={targetFieldId}
      />

      <PersonRecordModal
        open={editIndex != null}
        onClose={() => setEditIndex(null)}
        onSave={handleEditSave}
        formValues={formValues}
        contextLabel={`Edit — ${field.label}`}
        targetFieldId={targetFieldId}
        initialData={editIndex != null ? existingItems[editIndex] : undefined}
      />

      {existingItems.length > 0 && (
        <div className="add-item-list mt-3 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span>Added ({existingItems.length}):</span>
          </p>
          {existingItems.map((item, index) => (
            <div
              key={index}
              className="add-item-list-item flex items-center justify-between bg-white border border-gray-300 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-[1.02] group"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <span className="text-gray-800 flex-1 flex items-start gap-2 text-sm">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                  {index + 1}
                </div>
                <span className="wrap-break-word min-w-0">{displayLine(item)}</span>
              </span>
              <div className="ml-3 flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleEditItem(index)}
                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 transform hover:scale-110 active:scale-95 text-xs font-medium"
                  title="Edit"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(index)}
                  className="add-item-list-remove text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 transform hover:scale-110 active:scale-95 text-xs font-medium"
                  title="Remove"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </div>
            </div>
          ))}
          {targetFieldId === 'executorData' && (
            <InlineSubstituteExecutor formValues={formValues} setFormValues={setFormValues} />
          )}
        </div>
      )}
    </div>
  );
}

function InlineSubstituteExecutor({ formValues, setFormValues }) {
  const { formData } = useFormDefinition();
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);
  const subTargetId = 'substituteExecutorData';

  const promptField = useMemo(() => {
    if (!formData?.formSections) return null;
    for (const sec of formData.formSections) {
      for (const f of sec.fields || []) {
        if (f.id === 'inlineSubstituteExecutorPrompt') return f;
        if (f.subFields) {
          const sf = f.subFields.find((s) => s.id === 'inlineSubstituteExecutorPrompt');
          if (sf) return sf;
        }
      }
    }
    return null;
  }, [formData]);

  const promptTitle = promptField?.label || 'Substitute Executor';
  const promptText = promptField?.text || 'If your chosen executor is unable or unwilling to act, a substitute ensures your estate is still handled by someone you trust.';

  const items = Array.isArray(formValues[subTargetId])
    ? formValues[subTargetId]
    : formValues[subTargetId] ? [formValues[subTargetId]] : [];

  const isDupSub = (row) => {
    const fp = [row.firstName, row.lastName, row.dateOfBirth].map((v) => (v || '').toString().trim().toLowerCase()).join('|');
    if (!fp.replace(/\|/g, '')) return false;
    return items.some((item) => {
      if (!item || typeof item !== 'object') return false;
      return [item.firstName, item.lastName, item.dateOfBirth].map((v) => (v || '').toString().trim().toLowerCase()).join('|') === fp;
    });
  };

  const handleSave = (row) => {
    if (isDupSub(row)) {
      toast.error('This person has already been added', { description: 'You can edit the existing entry instead.' });
      return;
    }
    setFormValues((prev) => {
      const prevItems = Array.isArray(prev[subTargetId]) ? prev[subTargetId] : prev[subTargetId] ? [prev[subTargetId]] : [];
      let next = { ...prev, [subTargetId]: [...prevItems, row] };
      next = upsertRegistryContact(next, row);
      return next;
    });
  };

  const handleRemove = (idx) => {
    const updated = items.filter((_, i) => i !== idx);
    setFormValues((prev) => ({ ...prev, [subTargetId]: updated.length ? updated : [] }));
  };

  const handleEditSave = (row) => {
    setFormValues((prev) => {
      const prevItems = Array.isArray(prev[subTargetId]) ? [...prev[subTargetId]] : prev[subTargetId] ? [prev[subTargetId]] : [];
      if (editIndex != null && editIndex < prevItems.length) prevItems[editIndex] = row;
      let next = { ...prev, [subTargetId]: prevItems };
      next = upsertRegistryContact(next, row);
      return next;
    });
    setEditIndex(null);
  };

  const displayLine = (item) => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') return formatPersonRecordForClause(item) || '—';
    return String(item ?? '');
  };

  return (
    <div className="mt-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/60 p-3 sm:p-4 dark:border-indigo-500/40 dark:bg-slate-800/80">
      <div className="flex items-start gap-2 mb-2">
        <ShieldCheck className="w-5 h-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" aria-hidden />
        <div>
          <p className="font-semibold text-sm text-indigo-700 dark:text-indigo-300">{promptTitle}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{promptText}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="group bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl shadow transition-all duration-300 font-medium flex items-center gap-2 text-sm min-h-[44px] w-full sm:w-auto"
      >
        <Plus className="w-4 h-4 shrink-0 group-hover:rotate-90 transition-transform duration-300" aria-hidden />
        Add Substitute Executor
      </button>

      <PersonRecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        formValues={formValues}
        contextLabel="Substitute Executor"
        targetFieldId={subTargetId}
      />

      <PersonRecordModal
        open={editIndex != null}
        onClose={() => setEditIndex(null)}
        onSave={handleEditSave}
        formValues={formValues}
        contextLabel="Edit — Substitute Executor"
        targetFieldId={subTargetId}
        initialData={editIndex != null ? items[editIndex] : undefined}
      />

      {items.length > 0 && (
        <div className="mt-2 space-y-1.5">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <CheckCircle2 size={14} className="text-green-500" />
            Substitute ({items.length}):
          </p>
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm text-sm dark:bg-slate-900 dark:border-slate-600">
              <span className="text-gray-800 dark:text-slate-200 flex-1 flex items-start gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-violet-700 dark:text-violet-300 text-[10px] font-bold shrink-0">{idx + 1}</span>
                <span className="wrap-break-word min-w-0">{displayLine(item)}</span>
              </span>
              <div className="ml-2 flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => setEditIndex(idx)} className="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" title="Edit">
                  <Pencil className="w-3 h-3" />
                  <span className="hidden sm:inline">Edit</span>
                </button>
                <button type="button" onClick={() => handleRemove(idx)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded-lg text-xs font-medium flex items-center gap-1" title="Remove">
                  <Trash2 className="w-3 h-3" />
                  <span className="hidden sm:inline">Remove</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
