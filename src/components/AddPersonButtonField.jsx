import React, { useState } from 'react';
import { Plus, CheckCircle2, Trash2, Pencil } from 'lucide-react';
import PersonRecordModal from './PersonRecordModal.jsx';
import { ADD_PERSON_FIELDS_HINT, formatPersonRecordForClause } from '../utils/personRecordSpecs.js';
import { upsertRegistryContact } from '../lib/personRegistry.js';

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

  const handleSave = (row) => {
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
        </div>
      )}
    </div>
  );
}
