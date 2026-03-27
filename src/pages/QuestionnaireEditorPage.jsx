import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  Save,
  FileText,
  History,
  Trash2,
  Plus,
  Undo2,
  Layers,
  GripVertical,
} from 'lucide-react';
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';
import {
  saveFormDefinition,
  getFactoryDefault,
  listFormDefinitionRevisions,
  restoreFormDefinitionRevision,
  deleteFormDefinitionRevision,
} from '../lib/formDefinition.js';
import { qLog } from '../lib/questionnaireLog.js';
import defaultFormData from '../data/Complete-WillSuite-Form-Data.json';
import {
  createCustomField,
  CUSTOM_FIELD_TYPES,
  mergeCustomFieldEdit,
  optionsToMultiline,
} from '../utils/customFieldBuilder.js';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function newCustomFieldId() {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    : String(Date.now());
  return `custom_${suffix}`;
}

/** Shared inputs for creating a custom_* field (add section / add field modals). */
function CustomFieldInputs({
  fieldType,
  onFieldTypeChange,
  label,
  onLabelChange,
  placeholder,
  onPlaceholderChange,
  required,
  onRequiredChange,
  optionsText,
  onOptionsTextChange,
  infoText,
  onInfoTextChange,
}) {
  const showPlaceholder = ['text', 'textarea', 'number', 'currency', 'date'].includes(fieldType);
  const showOptions = fieldType === 'radio' || fieldType === 'checkboxGroup';
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-slate-700">Question type</label>
        <select
          value={fieldType}
          onChange={(e) => onFieldTypeChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
        >
          {CUSTOM_FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700">Question / label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => onLabelChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="Wording shown to the client"
        />
      </div>
      {showPlaceholder && (
        <div>
          <label className="block text-sm font-medium text-slate-700">
            Placeholder {fieldType === 'date' ? '(date hint)' : '(optional)'}
          </label>
          <input
            type="text"
            value={placeholder}
            onChange={(e) => onPlaceholderChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder={fieldType === 'date' ? 'e.g. dd/mm/yyyy' : 'Text inside the empty field'}
          />
        </div>
      )}
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => onRequiredChange(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        Required answer
      </label>
      {showOptions && (
        <div>
          <label className="block text-sm font-medium text-slate-700">Answer options (one per line)</label>
          <p className="mt-0.5 text-xs text-slate-500">
            Optional: use <code className="rounded bg-slate-100 px-1">value|Label</code> to set a stable value for PDF logic; otherwise a value is generated from the label.
          </p>
          <textarea
            value={optionsText}
            onChange={(e) => onOptionsTextChange(e.target.value)}
            rows={5}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
            placeholder={'Yes\nNo\nMaybe'}
          />
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-slate-700">Help text (optional)</label>
        <textarea
          value={infoText}
          onChange={(e) => onInfoTextChange(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="Short guidance under the question"
        />
      </div>
    </>
  );
}

function FieldEditModal({ field, onClose, onSave }) {
  const isCustom = field.id?.startsWith?.('custom_');
  const [label, setLabel] = useState(field.label || '');
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? '');
  const [infoText, setInfoText] = useState(field.infoText ?? '');
  const [required, setRequired] = useState(!!field.required);
  const [rows, setRows] = useState(field.rows || 4);
  const [optionLabels, setOptionLabels] = useState(
    Array.isArray(field.options)
      ? field.options.map((o) => o.label ?? o.value ?? '')
      : []
  );
  const [optionsText, setOptionsText] = useState(() =>
    Array.isArray(field.options) ? optionsToMultiline(field.options) : ''
  );

  const handleSave = () => {
    if (isCustom && (field.type === 'radio' || field.type === 'checkboxGroup')) {
      try {
        const next = mergeCustomFieldEdit(field, { label, infoText, required, optionsText });
        onSave(next);
      } catch (e) {
        toast.error(e.message || 'Invalid options');
        return;
      }
      onClose();
      return;
    }
    if (isCustom) {
      try {
        const next = mergeCustomFieldEdit(field, {
          label,
          placeholder,
          infoText,
          required,
          rows: field.type === 'textarea' ? rows : undefined,
        });
        onSave(next);
      } catch (e) {
        toast.error(e.message || 'Could not update field');
        return;
      }
      onClose();
      return;
    }

    const next = { ...field, label, placeholder: placeholder || undefined, infoText: infoText || undefined };
    if (field.type === 'textarea' && typeof rows === 'number' && rows > 0) {
      next.rows = rows;
    }
    if (Array.isArray(field.options) && optionLabels.length === field.options.length) {
      next.options = field.options.map((o, i) => ({ ...o, label: optionLabels[i] ?? o.label ?? o.value }));
    }
    onSave(next);
    onClose();
  };

  const showPlaceholder =
    field.type === 'text' ||
    field.type === 'date' ||
    field.type === 'textarea' ||
    field.type === 'number' ||
    field.type === 'currency';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl questionnaire-modal-panel">
        <h3 className="text-lg font-semibold text-slate-900">Edit question</h3>
        <p className="mt-1 text-xs text-slate-500">ID: {field.id} · Type: {field.type}</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Question / label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="e.g. Who moved my cheese?"
            />
          </div>
          {isCustom && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                checked={required}
                onChange={(e) => setRequired(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Required answer
            </label>
          )}
          {showPlaceholder && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Placeholder</label>
              <input
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          )}
          {field.type === 'textarea' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Visible rows</label>
              <input
                type="number"
                min={2}
                max={20}
                value={rows}
                onChange={(e) => setRows(Number(e.target.value) || 4)}
                className="mt-1 w-28 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">Help text (optional)</label>
            <textarea
              value={infoText}
              onChange={(e) => setInfoText(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
          </div>
          {isCustom && (field.type === 'radio' || field.type === 'checkboxGroup') && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Answer options (one per line)</label>
              <p className="mt-0.5 text-xs text-slate-500">
                Use <code className="rounded bg-slate-100 px-1">value|Label</code> to keep stable values if you later add logic.
              </p>
              <textarea
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                rows={6}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900"
              />
            </div>
          )}
          {!isCustom && optionLabels.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Answer options (label shown to user)</label>
              <p className="mt-0.5 text-xs text-slate-500">Changing the value can break logic; change only the label if unsure.</p>
              <div className="mt-2 space-y-2">
                {field.options.map((opt, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={optionLabels[i] ?? ''}
                      onChange={(e) => {
                        const nextLabels = [...optionLabels];
                        nextLabels[i] = e.target.value;
                        setOptionLabels(nextLabels);
                      }}
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                      placeholder="Label"
                    />
                    <span className="self-center text-xs text-slate-400">value: {String(opt.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 questionnaire-modal-hint">
          This updates your draft on this page only. When you are done, click <strong className="font-semibold text-slate-800">Save questionnaire</strong> at the top (or the bar at the bottom) so clients see the changes.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <Save size={14} />
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionEditModal({ sectionName, onClose, onSave }) {
  const [name, setName] = useState(sectionName || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl questionnaire-modal-panel">
        <h3 className="text-lg font-semibold text-slate-900">Edit section title</h3>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Section name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder="e.g. Personal Information"
          />
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 questionnaire-modal-hint">
          This updates your draft on this page only. When you are done, click <strong className="font-semibold text-slate-800">Save questionnaire</strong> at the top (or the bar at the bottom) so clients see the changes.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(name);
              onClose();
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal: add a new section with solicitor-facing metadata (staff note is not shown on the client form). */
function AddSectionModal({ onClose, onConfirm }) {
  const [sectionTitle, setSectionTitle] = useState('');
  const [staffNote, setStaffNote] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [firstQuestionLabel, setFirstQuestionLabel] = useState('New question');
  const [placeholder, setPlaceholder] = useState('');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('Yes\nNo');
  const [infoText, setInfoText] = useState('');

  const handleSubmit = () => {
    const title = sectionTitle.trim();
    if (!title) {
      qLog('add_section_modal_validation_fail', { reason: 'empty_section_title' });
      toast.error('Enter a section title');
      return;
    }
    qLog('add_section_modal_apply', {
      sectionTitleLen: title.length,
      staffNoteLen: staffNote.trim().length,
      firstQuestionLabelLen: firstQuestionLabel.trim().length,
      fieldType,
      hasPlaceholder: !!placeholder.trim(),
      required,
    });
    onConfirm({
      sectionTitle: title,
      staffNote: staffNote.trim(),
      firstQuestionLabel: firstQuestionLabel.trim() || 'New question',
      fieldType,
      placeholder: placeholder.trim(),
      required,
      optionsText,
      infoText: infoText.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-section-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          qLog('add_section_modal_cancel', { reason: 'backdrop' });
          onClose();
        }
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl questionnaire-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-section-modal-title" className="text-lg font-semibold text-slate-900">
          Add new section
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          This adds a draft section. Clients only see it after you click Save questionnaire.
        </p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Section title (shown to clients)</label>
            <input
              type="text"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="e.g. Additional instructions"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Internal note (solicitors only)</label>
            <textarea
              value={staffNote}
              onChange={(e) => setStaffNote(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="Optional — e.g. why this block exists, matter type, compliance reminder (not shown on the client form)"
            />
          </div>
          <p className="text-sm font-medium text-slate-800">First question in this section</p>
          <CustomFieldInputs
            fieldType={fieldType}
            onFieldTypeChange={setFieldType}
            label={firstQuestionLabel}
            onLabelChange={setFirstQuestionLabel}
            placeholder={placeholder}
            onPlaceholderChange={setPlaceholder}
            required={required}
            onRequiredChange={setRequired}
            optionsText={optionsText}
            onOptionsTextChange={setOptionsText}
            infoText={infoText}
            onInfoTextChange={setInfoText}
          />
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 questionnaire-modal-hint">
          The first field uses a new ID starting with <strong className="text-slate-800">custom_</strong>. Use <strong className="text-slate-800">Add field in this section</strong> to add more questions with any type you need.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              qLog('add_section_modal_cancel', { reason: 'cancel_button' });
              onClose();
            }}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={14} />
            Add section
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal: add a field to an existing section (same field types as new section). */
function AddFieldModal({ onClose, onConfirm }) {
  const [fieldType, setFieldType] = useState('text');
  const [label, setLabel] = useState('New question');
  const [placeholder, setPlaceholder] = useState('');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('Yes\nNo');
  const [infoText, setInfoText] = useState('');

  const handleSubmit = () => {
    qLog('add_field_modal_apply', { fieldType, labelLen: label.trim().length, required });
    onConfirm({
      fieldType,
      label: label.trim() || 'New question',
      placeholder: placeholder.trim(),
      required,
      optionsText,
      infoText: infoText.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-field-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl questionnaire-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="add-field-modal-title" className="text-lg font-semibold text-slate-900">
          Add question to section
        </h3>
        <p className="mt-1 text-xs text-slate-500">Choose how clients answer: text, paragraph, date, money, or lists of options.</p>
        <div className="mt-4 space-y-4">
          <CustomFieldInputs
            fieldType={fieldType}
            onFieldTypeChange={setFieldType}
            label={label}
            onLabelChange={setLabel}
            placeholder={placeholder}
            onPlaceholderChange={setPlaceholder}
            required={required}
            onRequiredChange={setRequired}
            optionsText={optionsText}
            onOptionsTextChange={setOptionsText}
            infoText={infoText}
            onInfoTextChange={setInfoText}
          />
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 questionnaire-modal-hint">
          The new field uses an ID starting with <strong className="text-slate-800">custom_</strong>. You can reorder or remove it in Advanced mode.
        </p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Plus size={14} />
            Add question
          </button>
        </div>
      </div>
    </div>
  );
}

const LAST_SAVED_STORAGE_KEY = 'will-tool-questionnaire-last-saved';

function loadLastSavedFromSession() {
  try {
    const s = sessionStorage.getItem(LAST_SAVED_STORAGE_KEY);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function formatSavedTime(date) {
  if (!date) return null;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export default function QuestionnaireEditorPage() {
  const { formData, loading, refresh } = useFormDefinition();
  const [definition, setDefinition] = useState(() => deepClone(formData));
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(loadLastSavedFromSession);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState(() => new Set([0]));
  const [editingField, setEditingField] = useState(null);
  const [editingSectionIndex, setEditingSectionIndex] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [revisionsLoading, setRevisionsLoading] = useState(false);
  const [restoreBusyId, setRestoreBusyId] = useState(null);
  const [deleteBusyId, setDeleteBusyId] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [addSectionModalOpen, setAddSectionModalOpen] = useState(false);
  const [addFieldModalSectionIndex, setAddFieldModalSectionIndex] = useState(null);
  const [dragFromIndex, setDragFromIndex] = useState(null);

  useEffect(() => {
    if (!loading && !dirty) {
      setDefinition(deepClone(formData));
      qLog('draft_loaded_from_context', {
        sectionCount: formData?.formSections?.length,
        formTitle: formData?.formTitle,
      });
    }
  }, [loading, formData, dirty]);

  const loadRevisions = useCallback(async () => {
    setRevisionsLoading(true);
    try {
      const { data, error } = await listFormDefinitionRevisions(50);
      if (error) {
        qLog('revisions_ui_load_error', { message: error });
        return;
      }
      setRevisions(data || []);
    } finally {
      setRevisionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRevisions();
  }, [loadRevisions]);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const toggleSection = useCallback((index) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      const wasOpen = next.has(index);
      if (wasOpen) next.delete(index);
      else next.add(index);
      qLog('section_expand_toggle', { sectionIndex: index, expanded: !wasOpen });
      return next;
    });
  }, []);

  const updateSection = useCallback((sectionIndex, newName) => {
    qLog('section_title_edit', { sectionIndex, newName });
    setDefinition((d) => {
      const next = deepClone(d);
      if (next.formSections[sectionIndex]) next.formSections[sectionIndex].formSection = newName;
      return next;
    });
    setDirty(true);
    qLog('dirty_set', { reason: 'section_title_edit' });
    setEditingSectionIndex(null);
  }, []);

  const updateField = useCallback((sectionIndex, fieldIndex, updatedField) => {
    qLog('field_edit_apply', {
      sectionIndex,
      fieldIndex,
      fieldId: updatedField?.id,
    });
    setDefinition((d) => {
      const next = deepClone(d);
      if (next.formSections[sectionIndex]?.fields?.[fieldIndex]) {
        next.formSections[sectionIndex].fields[fieldIndex] = {
          ...next.formSections[sectionIndex].fields[fieldIndex],
          ...updatedField,
        };
      }
      return next;
    });
    setDirty(true);
    qLog('dirty_set', { reason: 'field_edit_apply' });
    setEditingField(null);
  }, []);

  const moveSection = useCallback((sectionIndex, direction) => {
    if (!window.confirm('Changing section order may affect step flow in the client form. Field IDs stay the same. Continue?')) {
      return;
    }
    setDefinition((d) => {
      const next = deepClone(d);
      const arr = next.formSections;
      const j = sectionIndex + direction;
      if (j < 0 || j >= arr.length) return d;
      [arr[sectionIndex], arr[j]] = [arr[j], arr[sectionIndex]];
      return next;
    });
    setDirty(true);
    qLog('section_reorder', { from: sectionIndex, to: sectionIndex + direction });
    qLog('dirty_set', { reason: 'section_reorder' });
    setExpandedSections((prev) => {
      const n = new Set();
      prev.forEach((idx) => {
        if (idx === sectionIndex) n.add(sectionIndex + direction);
        else if (idx === sectionIndex + direction) n.add(sectionIndex);
        else n.add(idx);
      });
      return n;
    });
  }, []);

  const moveSectionToIndex = useCallback((fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    setDefinition((d) => {
      const next = deepClone(d);
      const arr = next.formSections;
      if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return d;
      const [item] = arr.splice(fromIndex, 1);
      arr.splice(toIndex, 0, item);
      return next;
    });
    setDirty(true);
    qLog('section_reorder_drag', { from: fromIndex, to: toIndex });
    qLog('dirty_set', { reason: 'section_reorder' });
    setExpandedSections((prev) => {
      const n = new Set();
      prev.forEach((idx) => {
        if (idx === fromIndex) {
          n.add(toIndex);
        } else if (fromIndex < toIndex) {
          if (idx > fromIndex && idx <= toIndex) n.add(idx - 1);
          else n.add(idx);
        } else if (idx >= toIndex && idx < fromIndex) {
          n.add(idx + 1);
        } else {
          n.add(idx);
        }
      });
      return n;
    });
  }, []);

  const moveField = useCallback((sectionIndex, fieldIndex, direction) => {
    if (!window.confirm('Reordering fields can change visual order only; IDs are unchanged. Continue?')) return;
    setDefinition((d) => {
      const next = deepClone(d);
      const fields = next.formSections[sectionIndex]?.fields;
      if (!fields) return d;
      const j = fieldIndex + direction;
      if (j < 0 || j >= fields.length) return d;
      [fields[fieldIndex], fields[j]] = [fields[j], fields[fieldIndex]];
      return next;
    });
    setDirty(true);
    qLog('field_reorder', { sectionIndex, from: fieldIndex, to: fieldIndex + direction });
    qLog('dirty_set', { reason: 'field_reorder' });
  }, []);

  const openAddSectionModal = useCallback(() => {
    qLog('add_section_modal_open', {});
    setAddSectionModalOpen(true);
  }, []);

  const commitAddSectionFromModal = useCallback(
    (payload) => {
      const {
        sectionTitle,
        staffNote,
        firstQuestionLabel,
        fieldType,
        placeholder,
        required,
        optionsText,
        infoText,
      } = payload;
      const id = newCustomFieldId();
      const sectionIndex = definition.formSections?.length ?? 0;
      let firstField;
      try {
        firstField = createCustomField({
          id,
          type: fieldType,
          label: firstQuestionLabel,
          placeholder,
          required,
          optionsText,
          infoText,
        });
      } catch (e) {
        toast.error(e.message || 'Could not create the first question');
        return;
      }
      qLog('add_section_modal_confirm', {
        sectionIndex,
        sectionTitleLen: sectionTitle.length,
        hasStaffNote: !!staffNote,
        fieldId: id,
        fieldType,
      });
      setDefinition((d) => {
        const next = deepClone(d);
        next.formSections = next.formSections || [];
        const section = {
          formSection: sectionTitle,
          _editorAdded: true,
          fields: [firstField],
        };
        if (staffNote) section._editorStaffNote = staffNote;
        next.formSections.push(section);
        return next;
      });
      setDirty(true);
      qLog('structure_add_section', {
        sectionIndex,
        sectionTitleLen: sectionTitle.length,
        hasStaffNote: !!staffNote,
        fieldId: id,
      });
      qLog('dirty_set', { reason: 'add_section' });
      setAddSectionModalOpen(false);
      qLog('add_section_modal_closed', { reason: 'after_add' });
      setExpandedSections((prev) => {
        const next = new Set(prev);
        next.add(sectionIndex);
        return next;
      });
    },
    [definition]
  );

  const commitAddFieldFromModal = useCallback((sectionIndex, payload) => {
    const id = newCustomFieldId();
    let field;
    try {
      field = createCustomField({
        id,
        type: payload.fieldType,
        label: payload.label,
        placeholder: payload.placeholder,
        required: payload.required,
        optionsText: payload.optionsText,
        infoText: payload.infoText,
      });
    } catch (e) {
      toast.error(e.message || 'Could not create question');
      return;
    }
    setDefinition((d) => {
      const next = deepClone(d);
      const sec = next.formSections[sectionIndex];
      if (!sec) return d;
      sec.fields = sec.fields || [];
      sec.fields.push(field);
      return next;
    });
    setDirty(true);
    qLog('structure_add_field', { sectionIndex, fieldId: id, fieldType: payload.fieldType });
    qLog('dirty_set', { reason: 'add_field' });
    setAddFieldModalSectionIndex(null);
  }, []);

  const handleDiscardDraft = useCallback(() => {
    if (!dirty) return;
    qLog('discard_changes_clicked', { sectionCount: definition.formSections?.length });
    if (
      !window.confirm(
        'Discard all unpublished edits on this page? Your draft will match the last published questionnaire from the server.'
      )
    ) {
      qLog('discard_changes_cancelled');
      return;
    }
    setDefinition(deepClone(formData));
    setDirty(false);
    setExpandedSections(new Set([0]));
    qLog('draft_discarded', { restoredSectionCount: formData?.formSections?.length });
    toast.info('Draft discarded', { description: 'This page now matches the last published questionnaire.' });
  }, [dirty, definition.formSections?.length, formData]);

  const openAddFieldModal = useCallback((sectionIndex) => {
    qLog('add_field_modal_open', { sectionIndex });
    setAddFieldModalSectionIndex(sectionIndex);
  }, []);

  const removeSection = useCallback(
    (sectionIndex) => {
      const sec = definition.formSections[sectionIndex];
      if (!sec?._editorAdded) {
        toast.error('Only sections added in Advanced mode can be removed.');
        return;
      }
      if (!window.confirm('Remove this section and all its fields? This cannot be undone until you restore a saved version.')) {
        return;
      }
      qLog('structure_remove_section', { sectionIndex });
      setDefinition((d) => {
        const next = deepClone(d);
        next.formSections.splice(sectionIndex, 1);
        return next;
      });
      setDirty(true);
      qLog('dirty_set', { reason: 'remove_section' });
    },
    [definition.formSections]
  );

  const removeField = useCallback(
    (sectionIndex, fieldIndex) => {
      const field = definition.formSections[sectionIndex]?.fields?.[fieldIndex];
      if (!field?.id?.startsWith?.('custom_')) {
        toast.error('Only fields with IDs starting with custom_ (added in Advanced mode) can be removed.');
        return;
      }
      if (!window.confirm('Remove this question from the draft?')) return;
      qLog('structure_remove_field', { sectionIndex, fieldIndex });
      setDefinition((d) => {
        const next = deepClone(d);
        next.formSections[sectionIndex].fields.splice(fieldIndex, 1);
        return next;
      });
      setDirty(true);
      qLog('dirty_set', { reason: 'remove_field' });
    },
    [definition.formSections]
  );

  /** Post-save reload uses the same transport as reads; cap so "Saving…" never hangs if a client stalls. */
  const REFRESH_AFTER_SAVE_CAP_MS = 22_000;

  const handleSaveQuestionnaire = useCallback(async () => {
    qLog('save_clicked', { sectionCount: definition.formSections?.length });
    setSaving(true);
    try {
      const { error, revisionId, revisionError } = await saveFormDefinition(definition);
      if (error) {
        toast.error('Could not save questionnaire', { description: error });
        return;
      }
      if (revisionError) {
        qLog('save_revision_warning', { message: revisionError });
      }
      qLog('save_revision_ok', { revisionId: revisionId || null });
      qLog('refresh_after_save_begin', { capMs: REFRESH_AFTER_SAVE_CAP_MS });
      let refreshOk = false;
      try {
        await Promise.race([
          refresh({ silent: true }).then(() => {
            refreshOk = true;
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('refresh_after_save_timeout')), REFRESH_AFTER_SAVE_CAP_MS)
          ),
        ]);
        qLog('refresh_after_save_ok', {});
      } catch (err) {
        const msg = err?.message || String(err);
        if (msg === 'refresh_after_save_timeout') {
          qLog('refresh_after_save_capped', { capMs: REFRESH_AFTER_SAVE_CAP_MS });
          toast.warning('Questionnaire saved', {
            description: 'Reloading the editor took too long; your publish is already live. Refresh this page if the list looks old.',
          });
        } else {
          console.warn('[QuestionnaireEditor] refresh after save failed', err);
          qLog('refresh_after_save_failed', { message: msg });
          toast.error('Questionnaire saved', {
            description: 'Could not reload this page from the server. Your changes should already be live — refresh the browser if needed.',
          });
        }
      }
      const now = new Date();
      setLastSavedAt(now);
      try {
        sessionStorage.setItem(LAST_SAVED_STORAGE_KEY, now.toISOString());
      } catch {
        /* ignore */
      }
      setDirty(false);
      if (refreshOk) {
        toast.success('Questionnaire saved', { description: 'Clients and the form will see the updated questions.' });
      }
      void loadRevisions();
    } finally {
      setSaving(false);
    }
  }, [definition, refresh, loadRevisions]);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      e.preventDefault();
      if (dirty && !saving && !loading) {
        qLog('keyboard_save', {});
        void handleSaveQuestionnaire();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, loading, handleSaveQuestionnaire]);

  const handleResetToDefault = async () => {
    if (!window.confirm('Reload the factory default questionnaire? Unsaved edits on this page will be replaced (you can still cancel by not saving).')) return;
    qLog('reset_to_factory_clicked', {});
    const { data, source } = await getFactoryDefault();
    const payload = data || defaultFormData;
    setDefinition(deepClone(payload));
    setDirty(true);
    qLog('reset_to_factory_applied', { source, sectionCount: payload?.formSections?.length });
    toast.info('Draft reset to factory default', {
      description: `Source: ${source}. Click Save questionnaire to publish.`,
    });
  };

  const handleRestoreRevision = async (revisionId) => {
    if (!window.confirm('Restore this saved version as the live questionnaire? Current published form will be replaced.')) return;
    qLog('restore_revision_selected', { revisionId });
    setRestoreBusyId(revisionId);
    try {
      const { error } = await restoreFormDefinitionRevision(revisionId);
      if (error) {
        toast.error('Could not restore', { description: error });
        return;
      }
      toast.success('Questionnaire restored', { description: 'Reloading from server…' });
      await refresh({ silent: true });
      setDirty(false);
      void loadRevisions();
    } finally {
      setRestoreBusyId(null);
    }
  };

  const handleDeleteRevision = async (revisionId) => {
    if (
      !window.confirm(
        'Remove this snapshot from version history? This does not change the live questionnaire. This cannot be undone.'
      )
    ) {
      return;
    }
    qLog('revision_delete_clicked', { revisionId });
    setDeleteBusyId(revisionId);
    try {
      const { error } = await deleteFormDefinitionRevision(revisionId);
      if (error) {
        toast.error('Could not delete snapshot', { description: error });
        return;
      }
      toast.success('Snapshot removed from history');
      void loadRevisions();
    } finally {
      setDeleteBusyId(null);
    }
  };

  const sections = definition.formSections || [];
  const lastSavedLabel = formatSavedTime(lastSavedAt);
  const canSave = dirty && !loading && !saving;
  const canDiscard = dirty && !loading && !saving;

  return (
    <div className={`space-y-6 ${dirty ? 'pb-24 sm:pb-20' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/solicitor"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 questionnaire-back-link"
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>
      </div>

      {loading && (
        <div
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 questionnaire-loading-banner"
          role="status"
        >
          Loading the saved questionnaire…
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm questionnaire-editor-card">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Edit questionnaire</h1>
            <p className="mt-1 text-sm text-slate-600">
              Change question text, labels, placeholders, and answer options. Clients will see these when filling the form. Section names and field IDs affect PDF logic—edit labels only if unsure.
            </p>
            {lastSavedLabel && (
              <p className="mt-2 text-xs text-slate-500">Last published: {lastSavedLabel}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={loading || saving}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset to default
            </button>
            {dirty && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                disabled={!canDiscard}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Undo2 size={16} />
                Discard changes
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveQuestionnaire}
              disabled={!canSave}
              aria-busy={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Saving…' : 'Save questionnaire'}
            </button>
          </div>
        </div>

        <div className="questionnaire-quick-steps mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <p className="font-semibold text-slate-900">Quick steps</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-800">
            <li>
              Expand a section and use <strong className="font-semibold text-slate-900">Edit</strong> to change wording. In the pop-up, click{' '}
              <strong className="font-semibold text-slate-900">Apply changes</strong> (that only updates this page).
            </li>
            <li>
              When you are finished, click <strong className="font-semibold text-slate-900">Save questionnaire</strong> (here or in the bar at the bottom) so clients see your updates.
            </li>
            <li className="text-slate-800">
              Tip:{' '}
              <kbd className="questionnaire-kbd rounded border border-slate-400 bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-900 shadow-sm">Ctrl</kbd>{' '}
              +{' '}
              <kbd className="questionnaire-kbd rounded border border-slate-400 bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-900 shadow-sm">S</kbd>{' '}
              (or{' '}
              <kbd className="questionnaire-kbd rounded border border-slate-400 bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-900 shadow-sm">⌘</kbd>{' '}
              +{' '}
              <kbd className="questionnaire-kbd rounded border border-slate-400 bg-slate-200 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-900 shadow-sm">S</kbd> on Mac) saves when you have unsaved changes.
            </li>
          </ol>
        </div>

        <div className="questionnaire-version-history mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="questionnaire-version-history-header flex flex-wrap items-center gap-2 text-slate-900">
            <History size={18} className="shrink-0 text-indigo-600 questionnaire-version-history-icon" />
            <span className="font-semibold">Version history (Supabase)</span>
            {revisionsLoading && <span className="text-xs text-slate-500">Loading…</span>}
          </div>
          <p className="questionnaire-version-history-desc mt-1 text-xs text-slate-600">
            Last 50 published snapshots (oldest are trimmed automatically when you save). Restoring replaces the live questionnaire for all clients. Delete removes a snapshot from history only—it does not change the current published form.
          </p>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
            {revisions.length === 0 && !revisionsLoading && (
              <li className="questionnaire-version-history-empty text-slate-600">
                No history yet — history is recorded when you save (after migrations are applied).
              </li>
            )}
            {revisions.map((r) => (
              <li
                key={r.id}
                className="questionnaire-revision-row flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className="min-w-0 flex-1 text-slate-700">
                  {formatSavedTime(new Date(r.created_at)) || r.created_at} · {r.source}
                  {typeof r.payloadBytes === 'number' ? ` · ~${r.payloadBytes} bytes` : ''}
                </span>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    disabled={loading || restoreBusyId === r.id || deleteBusyId === r.id}
                    onClick={() => handleRestoreRevision(r.id)}
                    className="questionnaire-revision-restore rounded-lg border border-indigo-300 bg-white px-2 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {restoreBusyId === r.id ? 'Restoring…' : 'Restore'}
                  </button>
                  <button
                    type="button"
                    disabled={loading || deleteBusyId === r.id || restoreBusyId === r.id}
                    onClick={() => handleDeleteRevision(r.id)}
                    className="questionnaire-revision-delete inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    aria-label="Delete snapshot from history"
                  >
                    <Trash2 size={12} aria-hidden />
                    {deleteBusyId === r.id ? 'Removing…' : 'Delete'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700">Form title</label>
          <input
            type="text"
            value={definition.formTitle || ''}
            onChange={(e) => {
              const v = e.target.value;
              qLog('form_title_change', { length: v.length });
              setDefinition((d) => ({ ...d, formTitle: v }));
              setDirty(true);
              qLog('dirty_set', { reason: 'form_title_change' });
            }}
            disabled={loading || saving}
            className="mt-1 max-w-md rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-50"
            placeholder="Legacy Last Will & Testament Questionnaire"
          />
        </div>

        <div className="questionnaire-advanced-panel mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          <button
            type="button"
            id="questionnaire-advanced-trigger"
            aria-expanded={showAdvanced}
            aria-controls="questionnaire-advanced-toolbar"
            onClick={() => setShowAdvanced((s) => !s)}
            className="questionnaire-advanced-toggle-btn group relative flex w-full items-center gap-3 rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50 px-4 py-3.5 text-left shadow-sm ring-1 ring-slate-900/[0.04] transition hover:border-indigo-300/90 hover:shadow-md hover:ring-indigo-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50"
          >
            <span
              className="questionnaire-advanced-toggle-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-900/25 ring-1 ring-white/10"
              aria-hidden
            >
              <Layers size={20} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="questionnaire-advanced-toggle-title block text-sm font-semibold tracking-tight text-slate-900">
                Advanced editing
              </span>
              <span className="questionnaire-advanced-toggle-sub mt-0.5 block text-xs font-medium text-slate-500">
                {showAdvanced
                  ? 'Open — reorder, add sections, or remove fields'
                  : 'Reorder sections · add sections · Remove on rows you added'}
              </span>
            </span>
            <ChevronDown
              size={22}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ease-out group-hover:text-indigo-500 ${showAdvanced ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          <p className="questionnaire-advanced-hint mt-3 text-xs leading-relaxed text-slate-600">
            Drag the grip icon to reorder sections, use ↑↓, or pick a position number. Reordering changes client step order only; field IDs stay the same. New fields use IDs starting with{' '}
            <code className="questionnaire-advanced-code rounded-md bg-slate-200/90 px-1.5 py-0.5 font-mono text-[0.8rem] text-slate-800">custom_</code>. For sections and fields you added, use{' '}
            <strong className="font-semibold text-slate-800">Remove section</strong> / <strong className="font-semibold text-slate-800">Remove</strong> on each row (visible without opening this panel). Built-in questionnaire sections cannot be deleted here—edit wording only.
          </p>
          {showAdvanced && (
            <div
              id="questionnaire-advanced-toolbar"
              className="questionnaire-advanced-toolbar mt-4 flex flex-wrap gap-2 border-t border-slate-200/80 pt-4"
            >
              <button
                type="button"
                onClick={openAddSectionModal}
                disabled={loading || saving}
                className="questionnaire-advanced-add inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus size={14} strokeWidth={2.5} /> Add section
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-2 questionnaire-editor-sections">
          {sections.map((section, sIdx) => (
            <div
              key={sIdx}
              className={`questionnaire-editor-section rounded-xl border border-amber-200/80 bg-amber-50/40 ${showAdvanced && dragFromIndex != null ? 'transition-colors' : ''} ${showAdvanced && dragFromIndex === sIdx ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}`}
              onDragOver={(e) => {
                if (!showAdvanced || dragFromIndex == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (!showAdvanced || dragFromIndex == null) return;
                moveSectionToIndex(dragFromIndex, sIdx);
                setDragFromIndex(null);
              }}
            >
              <div className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSection(sIdx)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium text-stone-900 questionnaire-section-title"
                >
                  {expandedSections.has(sIdx) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <FileText size={16} className="questionnaire-section-icon shrink-0 text-amber-700" />
                  <span className="min-w-0 break-words">{section.formSection || `Section ${sIdx + 1}`}</span>
                </button>
                <div className="flex flex-wrap items-center gap-1">
                  {showAdvanced && (
                    <>
                      <button
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          setDragFromIndex(sIdx);
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', String(sIdx));
                        }}
                        onDragEnd={() => setDragFromIndex(null)}
                        title="Drag to reorder section"
                        aria-label="Drag to reorder section"
                        className="cursor-grab rounded-lg p-1.5 text-amber-900 hover:bg-amber-100 active:cursor-grabbing touch-manipulation"
                      >
                        <GripVertical size={18} />
                      </button>
                      <label className="flex items-center gap-1 rounded-lg border border-amber-200/80 bg-white/80 px-2 py-1 text-[11px] font-medium text-amber-900">
                        <span className="hidden sm:inline">#</span>
                        <select
                          value={sIdx + 1}
                          onChange={(e) => {
                            const to = parseInt(e.target.value, 10) - 1;
                            if (!Number.isNaN(to) && to !== sIdx) moveSectionToIndex(sIdx, to);
                          }}
                          disabled={loading || saving}
                          className="max-w-[4rem] cursor-pointer rounded border-0 bg-transparent py-0 text-xs font-semibold text-amber-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          aria-label={`Move section to position 1–${sections.length}`}
                        >
                          {sections.map((_, i) => (
                            <option key={i} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        title="Move section up"
                        onClick={() => moveSection(sIdx, -1)}
                        disabled={sIdx === 0 || loading || saving}
                        className="rounded-lg p-1.5 text-amber-900 hover:bg-amber-100 disabled:opacity-30"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        title="Move section down"
                        onClick={() => moveSection(sIdx, 1)}
                        disabled={sIdx >= sections.length - 1 || loading || saving}
                        className="rounded-lg p-1.5 text-amber-900 hover:bg-amber-100 disabled:opacity-30"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </>
                  )}
                  {section._editorAdded && (
                    <button
                      type="button"
                      title="Remove this section (added in Advanced mode)"
                      onClick={() => removeSection(sIdx)}
                      disabled={loading || saving}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Remove section"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">Remove section</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingSectionIndex(sIdx)}
                    disabled={loading || saving}
                    className="questionnaire-edit-section-btn shrink-0 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Edit3 size={12} />
                    Edit section
                  </button>
                </div>
              </div>
              {expandedSections.has(sIdx) && (
                <div className="questionnaire-editor-section-content border-t border-amber-200/80 bg-white/70 px-4 pb-3 pt-2">
                  {showAdvanced && (
                    <button
                      type="button"
                      onClick={() => openAddFieldModal(sIdx)}
                      disabled={loading || saving}
                      className="mb-2 inline-flex items-center gap-1 rounded-lg border border-dashed border-amber-300 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-50 disabled:opacity-50"
                    >
                      <Plus size={12} /> Add field in this section
                    </button>
                  )}
                  <ul className="space-y-1">
                    {(section.fields || []).map((field, fIdx) => (
                      <li
                        key={field.id || fIdx}
                        className="questionnaire-field-item flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-100 bg-white px-3 py-2 text-sm shadow-sm"
                      >
                        <span className="min-w-0 text-stone-700 questionnaire-field-text">
                          <span className="font-mono text-stone-500">{field.id}</span>
                          <span className="mx-2">·</span>
                          {field.label || '(no label)'}
                        </span>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {showAdvanced && (
                            <>
                              <button
                                type="button"
                                title="Move field up"
                                onClick={() => moveField(sIdx, fIdx, -1)}
                                disabled={fIdx === 0 || loading || saving}
                                className="rounded p-1 text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                title="Move field down"
                                onClick={() => moveField(sIdx, fIdx, 1)}
                                disabled={fIdx >= (section.fields || []).length - 1 || loading || saving}
                                className="rounded p-1 text-stone-600 hover:bg-stone-100 disabled:opacity-30"
                              >
                                <ChevronDown size={14} />
                              </button>
                            </>
                          )}
                          {field.id?.startsWith?.('custom_') && (
                            <button
                              type="button"
                              title="Remove this question"
                              onClick={() => removeField(sIdx, fIdx)}
                              disabled={loading || saving}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                              aria-label="Remove question"
                            >
                              <Trash2 size={12} />
                              <span className="hidden sm:inline">Remove</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingField({ sectionIndex: sIdx, fieldIndex: fIdx, field })}
                            disabled={loading || saving}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Edit3 size={12} />
                            Edit
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {editingField && (
        <FieldEditModal
          key={`${editingField.sectionIndex}-${editingField.fieldIndex}-${editingField.field.id}`}
          field={editingField.field}
          onClose={() => setEditingField(null)}
          onSave={(updated) => updateField(editingField.sectionIndex, editingField.fieldIndex, updated)}
        />
      )}
      {editingSectionIndex !== null && (
        <SectionEditModal
          sectionName={sections[editingSectionIndex]?.formSection}
          onClose={() => setEditingSectionIndex(null)}
          onSave={(name) => updateSection(editingSectionIndex, name)}
        />
      )}
      {addSectionModalOpen && (
        <AddSectionModal
          onClose={() => {
            qLog('add_section_modal_closed', { reason: 'user_cancel' });
            setAddSectionModalOpen(false);
          }}
          onConfirm={commitAddSectionFromModal}
        />
      )}
      {addFieldModalSectionIndex != null && (
        <AddFieldModal
          onClose={() => setAddFieldModalSectionIndex(null)}
          onConfirm={(payload) => commitAddFieldFromModal(addFieldModalSectionIndex, payload)}
        />
      )}

      {dirty && (
        <div
          className="questionnaire-sticky-save fixed inset-x-0 bottom-0 z-40 border-t border-slate-300 bg-slate-100 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] backdrop-blur-sm sm:px-6"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-slate-800">
              You have unpublished changes. Save questionnaire so clients see them.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleDiscardDraft}
                disabled={!canDiscard}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-400 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Undo2 size={16} />
                Discard changes
              </button>
              <button
                type="button"
                onClick={handleSaveQuestionnaire}
                disabled={!canSave}
                aria-busy={saving}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Saving…' : 'Save questionnaire'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
