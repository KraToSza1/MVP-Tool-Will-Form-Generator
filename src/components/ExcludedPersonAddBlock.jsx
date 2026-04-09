import React, { useState } from 'react';
import { Plus, Trash2, CheckCircle2, Info, Pencil } from 'lucide-react';
import { ADD_PERSON_FIELDS_HINT, formatPersonRecordForClause } from '../utils/personRecordSpecs.js';
import PersonRecordModal from './PersonRecordModal.jsx';
import { upsertRegistryContact } from '../lib/personRegistry.js';

const TRACE = import.meta.env.VITE_DEBUG_FIELD_RENDERER === 'true';

const LOG =
  typeof import.meta !== 'undefined' &&
  (import.meta.env?.DEV || import.meta.env?.VITE_DEBUG_PERSON_FLOW === 'true');

function logPerson(...args) {
  if (LOG) console.log('[WillTool Person]', ...args);
}

/**
 * Excluded persons: same PersonRecordModal + contactRegistry as other add-person flows.
 */
export default function ExcludedPersonAddBlock({ field, formValues, setFormValues }) {
  const targetFieldId = 'excludedPersonData';
  const [modalOpen, setModalOpen] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  const existingItems = Array.isArray(formValues[targetFieldId])
    ? formValues[targetFieldId]
    : formValues[targetFieldId]
      ? [formValues[targetFieldId]]
      : [];

  const handleSave = (record) => {
    const hasAny = Object.keys(record).some((k) => !k.startsWith('_') && String(record[k] ?? '').trim() !== '');
    if (!hasAny) return;
    logPerson('excluded_person_add', { count: existingItems.length + 1 });
    if (TRACE) console.log('[ExcludedPersonAddBlock] add', { count: existingItems.length + 1 });
    setFormValues((prev) => {
      const prevItems = Array.isArray(prev[targetFieldId])
        ? prev[targetFieldId]
        : prev[targetFieldId]
          ? [prev[targetFieldId]]
          : [];
      const updatedItems = [...prevItems, record];
      let next = { ...prev, [targetFieldId]: updatedItems };
      next = upsertRegistryContact(next, record);
      return next;
    });
  };

  const handleRemove = (indexToRemove) => {
    const updatedItems = existingItems.filter((_, i) => i !== indexToRemove);
    logPerson('excluded_person_remove', { index: indexToRemove });
    setFormValues((prev) => ({ ...prev, [targetFieldId]: updatedItems.length ? updatedItems : [] }));
  };

  const handleEditSave = (row) => {
    logPerson('excluded_person_edit_save', { index: editIndex });
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
        aria-label={`${field.label} — ${ADD_PERSON_FIELDS_HINT}`}
        onClick={() => {
          logPerson('excluded_open_modal', { fieldId: field.id });
          setModalOpen(true);
        }}
        className="group bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-4 py-3 sm:px-6 rounded-xl shadow-lg transition-all duration-300 font-medium flex items-start gap-2 sm:gap-3 text-left min-h-[44px] w-full sm:w-auto"
      >
        <Plus className="w-5 h-5 shrink-0 mt-0.5 group-hover:rotate-90 transition-transform duration-300" aria-hidden />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="leading-snug">{field.label}</span>
          <span className="text-xs font-normal opacity-90 leading-tight wrap-break-word">
            {ADD_PERSON_FIELDS_HINT}
          </span>
        </span>
      </button>

      <PersonRecordModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        formValues={formValues}
        contextLabel={field.label || 'Excluded person'}
        targetFieldId={targetFieldId}
      />

      <PersonRecordModal
        open={editIndex != null}
        onClose={() => setEditIndex(null)}
        onSave={handleEditSave}
        formValues={formValues}
        contextLabel={`Edit — ${field.label || 'Excluded person'}`}
        targetFieldId={targetFieldId}
        initialData={editIndex != null ? existingItems[editIndex] : undefined}
      />

      {existingItems.length > 0 && (
        <div className="add-item-list mt-3 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span>Excluded ({existingItems.length}):</span>
          </p>
          {existingItems.map((item, index) => {
            const displayText = formatPersonRecordForClause(item) || '—';
            return (
              <div
                key={index}
                className="add-item-list-item flex items-center justify-between gap-2 bg-white border border-gray-300 rounded-xl px-4 py-3 shadow-sm"
              >
                <span className="text-gray-800 text-sm wrap-break-word flex-1">{displayText}</span>
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setEditIndex(index)}
                    className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 text-xs font-medium"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg transition-all duration-300 flex items-center gap-1.5 text-xs font-medium"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-600 flex items-start gap-2">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          If this person is already on the form, choose them under &quot;Same person or new&quot; in the add-person
          dialog to copy details.
        </span>
      </p>
    </div>
  );
}
