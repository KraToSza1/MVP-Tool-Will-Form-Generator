import React, { useState, useRef } from 'react';
import { Plus, X, Check, Trash2, CheckCircle2, Info, User } from 'lucide-react';
import {
  EXCLUDED_PERSON_FIELD_SPECS,
  emptyExcludedPersonRecord,
  formatExcludedPersonForClause,
} from '../utils/excludedPersonFormat.js';

const TRACE = import.meta.env.VITE_DEBUG_FIELD_RENDERER === 'true';

/**
 * Rich "Add excluded person" UI: stores an object per row in excludedPersonData.
 */
export default function ExcludedPersonAddBlock({ field, formValues, setFormValues }) {
  const targetFieldId = 'excludedPersonData';
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(() => emptyExcludedPersonRecord());
  const firstInputRef = useRef(null);

  const existingItems = Array.isArray(formValues[targetFieldId])
    ? formValues[targetFieldId]
    : formValues[targetFieldId]
      ? [formValues[targetFieldId]]
      : [];

  const handleAdd = () => {
    const hasAny = Object.values(draft).some((v) => String(v || '').trim() !== '');
    if (!hasAny) return;
    const record = {};
    EXCLUDED_PERSON_FIELD_SPECS.forEach(({ key }) => {
      const t = String(draft[key] ?? '').trim();
      if (t) record[key] = t;
    });
    if (!record.firstName && !record.lastName && !record.knownAs) {
      return;
    }
    const updatedItems = [...existingItems, record];
    if (TRACE) console.log('[ExcludedPersonAddBlock] add', { count: updatedItems.length });
    setFormValues((prev) => ({ ...prev, [targetFieldId]: updatedItems }));
    setDraft(emptyExcludedPersonRecord());
    setShowForm(false);
  };

  const handleRemove = (indexToRemove) => {
    const updatedItems = existingItems.filter((_, i) => i !== indexToRemove);
    setFormValues((prev) => ({ ...prev, [targetFieldId]: updatedItems.length ? updatedItems : [] }));
  };

  return (
    <div className="mb-4 animate-slideIn" data-field-id={field.id}>
      <button
        type="button"
        data-field-id={field.id}
        onClick={() => {
          setShowForm(true);
          setTimeout(() => firstInputRef.current?.focus(), 100);
        }}
        className="group bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 font-medium flex items-center gap-2"
      >
        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
        <span>{field.label}</span>
      </button>

      {showForm && (
        <div className="add-item-form mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            <User size={16} />
            Person details
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {EXCLUDED_PERSON_FIELD_SPECS.map((spec, i) => (
              <label key={spec.key} className="block text-sm">
                <span className="text-gray-700">{spec.label}</span>
                <input
                  ref={i === 0 ? firstInputRef : undefined}
                  type="text"
                  value={draft[spec.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [spec.key]: e.target.value }))}
                  placeholder={spec.placeholder || ''}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-600 flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0" />
            Enter at least first name, last name, or &quot;known as&quot;. All saved fields appear in the will text where exclusions apply.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Check size={16} />
              Add person
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setDraft(emptyExcludedPersonRecord());
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        </div>
      )}

      {existingItems.length > 0 && (
        <div className="add-item-list mt-3 space-y-2">
          <p className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-green-500" />
            <span>Excluded ({existingItems.length}):</span>
          </p>
          {existingItems.map((item, index) => {
            const displayText = formatExcludedPersonForClause(item) || '—';
            return (
              <div
                key={index}
                className="add-item-list-item flex items-center justify-between gap-2 bg-white border border-gray-300 rounded-xl px-4 py-3 shadow-sm"
              >
                <span className="text-gray-800 text-sm break-words flex-1">{displayText}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-lg"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
