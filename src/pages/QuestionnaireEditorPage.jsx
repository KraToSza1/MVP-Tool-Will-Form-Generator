import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Save,
  FileText,
  History,
  Trash2,
  Plus,
  Undo2,
  Layers,
  GripVertical,
  User,
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
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import defaultFormData from '../data/Complete-WillSuite-Form-Data.json';
import {
  createCustomField,
  CUSTOM_FIELD_TYPES,
  mergeCustomFieldEdit,
  optionsToMultiline,
} from '../utils/customFieldBuilder.js';
import { PERSON_RECORD_SPECS } from '../utils/personRecordSpecs.js';

/** Browsers may show a generic “leave site?” dialog; this string is used where a custom line still appears. */
const LEAVE_PAGE_UNSAVED_MSG =
  'You have unsaved changes to the questionnaire. If you leave or refresh now, those edits may be lost.';

/** Copy for in-app ConfirmModal (replaces browser window.confirm). */
const CONFIRM_MODAL = {
  moveSectionOrder: {
    title: 'Reorder sections for clients?',
    body: 'This changes the order of steps in the client intake. Question and field IDs stay the same.',
  },
  moveFieldOrder: {
    title: 'Change question order?',
    body: 'Only the display order changes in this section; question IDs stay the same.',
  },
  discardDraft: {
    title: 'Discard draft changes?',
    lead: 'Your edits on this page since the last save will be lost.',
    detail: 'Your draft will be replaced by the last published questionnaire from the server.',
  },
  removeSection: {
    title: 'Remove this section?',
    lead: 'This removes the whole section and every question inside it.',
    detail:
      'You can bring content back later only by restoring an older saved version of the whole questionnaire.',
  },
  removeField: {
    title: 'Remove this question?',
    lead: 'This question will be removed from your draft.',
    detail: 'You can undo only by discarding changes or restoring a saved version.',
  },
  resetToFactory: {
    title: 'Replace draft with factory default?',
    lead: 'Your current draft will be replaced with the factory default questionnaire.',
    detail: 'Nothing is published until you click Save questionnaire.',
  },
  restoreRevision: {
    title: 'Restore this snapshot?',
    lead: 'This publishes the selected snapshot as the live questionnaire.',
    detail:
      'Everyone (including clients) will see this version after it loads. Your current published version will be replaced.',
  },
  deleteRevision: {
    title: 'Delete this snapshot?',
    lead: 'This removes the snapshot from version history only.',
    detail: 'The live questionnaire for clients does not change. This backup cannot be recovered.',
  },
};

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

function collectAllFields(definition) {
  const result = [];
  if (!definition?.formSections) return result;
  for (const sec of definition.formSections) {
    for (const f of sec.fields || []) {
      if (f.id) result.push(f);
      if (f.subFields) {
        for (const sf of f.subFields) {
          if (sf.id) result.push(sf);
        }
      }
    }
  }
  return result;
}

function ConditionEditor({ conditions, conditionLogic, onChange, allFields }) {
  const rows = Array.isArray(conditions) ? conditions.filter((c) => c.field) : [];
  const logic = conditionLogic || 'AND';

  const fieldOptions = allFields
    .filter((f) => f.type === 'radio' || f.type === 'checkboxGroup' || f.type === 'text' || f.type === 'select' || f.type === 'hidden')
    .map((f) => ({ id: f.id, label: f.label || f.id, options: f.options }));

  const addRow = () => onChange([...rows, { field: '', operator: 'eq', value: '' }], logic);
  const removeRow = (i) => { const next = rows.filter((_, idx) => idx !== i); onChange(next, logic); };
  const updateRow = (i, patch) => { const next = rows.map((r, idx) => idx === i ? { ...r, ...patch } : r); onChange(next, logic); };

  const selectedFieldOptions = (fieldId) => {
    const f = fieldOptions.find((o) => o.id === fieldId);
    return Array.isArray(f?.options) ? f.options : [];
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Show this field when…</label>
        {rows.length > 1 && (
          <select value={logic} onChange={(e) => onChange(rows, e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
            <option value="AND">ALL conditions match</option>
            <option value="OR">ANY condition matches</option>
          </select>
        )}
      </div>
      {rows.length === 0 && (
        <p className="text-xs text-slate-500 italic">No conditions — this field is always visible.</p>
      )}
      {rows.map((row, i) => {
        const opts = selectedFieldOptions(row.field);
        return (
          <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <select value={row.field} onChange={(e) => updateRow(i, { field: e.target.value, value: '' })} className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800">
              <option value="">— select field —</option>
              {fieldOptions.map((fo) => <option key={fo.id} value={fo.id}>{fo.id} · {fo.label}</option>)}
            </select>
            <select value={row.operator} onChange={(e) => updateRow(i, { operator: e.target.value })} className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800">
              <option value="eq">equals</option>
              <option value="ne">not equal</option>
              <option value="in">is one of</option>
              <option value="arrayLengthGte">has ≥</option>
            </select>
            {opts.length > 0 ? (
              <select value={row.value ?? ''} onChange={(e) => updateRow(i, { value: e.target.value })} className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800">
                <option value="">— value —</option>
                {opts.map((o) => <option key={o.value} value={o.value}>{o.label || o.value}</option>)}
              </select>
            ) : (
              <input type="text" value={row.value ?? ''} onChange={(e) => updateRow(i, { value: e.target.value })} placeholder="value" className="flex-1 min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800" />
            )}
            <button type="button" onClick={() => removeRow(i)} className="shrink-0 rounded p-1 text-red-500 hover:bg-red-50" title="Remove condition">
              <Trash2 size={12} />
            </button>
          </div>
        );
      })}
      <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50">
        <Plus size={12} /> Add condition
      </button>
    </div>
  );
}

function FieldEditModal({ field, onClose, onSave }) {
  const { formData } = useFormDefinition();
  const allFields = useMemo(() => collectAllFields(formData), [formData]);
  const isCustom = field.id?.startsWith?.('custom_');
  const isDisplay = field.type === 'display';
  const isBizGuided = field.type === 'businessInterestsGuided';
  const isPropertyGiftsGuided = field.type === 'propertyGiftsGuided';
  const isPropertyTrustGuided = field.type === 'propertyTrustGuided';
  const [label, setLabel] = useState(field.label || '');
  const [displayText, setDisplayText] = useState(field.text ?? '');
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? '');
  const [infoText, setInfoText] = useState(field.infoText ?? '');
  const [required, setRequired] = useState(!!field.required);
  const [rows, setRows] = useState(field.rows || 4);
  const [conditions, setConditions] = useState(() => Array.isArray(field.conditions) ? field.conditions.filter((c) => c.field) : []);
  const [conditionLogic, setConditionLogic] = useState(field.conditionLogic || 'AND');
  const [optionLabels, setOptionLabels] = useState(
    Array.isArray(field.options)
      ? field.options.map((o) => o.label ?? o.value ?? '')
      : []
  );
  const [optionsText, setOptionsText] = useState(() =>
    Array.isArray(field.options) ? optionsToMultiline(field.options) : ''
  );
  const [bprTrustRequestedMessage, setBprTrustRequestedMessage] = useState(field.bprTrustRequestedMessage ?? '');
  const [bprTrustUnsureMessage, setBprTrustUnsureMessage] = useState(field.bprTrustUnsureMessage ?? '');

  const applyConditions = (next) => {
    const validConditions = conditions.filter((c) => c.field && c.operator);
    if (validConditions.length > 0) {
      next.conditions = validConditions;
      next.conditionLogic = conditionLogic;
    } else {
      delete next.conditions;
      delete next.conditionLogic;
    }
    return next;
  };

  const handleSave = () => {
    if (isCustom && (field.type === 'radio' || field.type === 'checkboxGroup')) {
      try {
        const next = applyConditions(mergeCustomFieldEdit(field, { label, infoText, required, optionsText }));
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
        const next = applyConditions(mergeCustomFieldEdit(field, {
          label,
          placeholder,
          infoText,
          required,
          rows: field.type === 'textarea' ? rows : undefined,
        }));
        onSave(next);
      } catch (e) {
        toast.error(e.message || 'Could not update field');
        return;
      }
      onClose();
      return;
    }

    if (field.type === 'businessInterestsGuided') {
      const next = {
        ...field,
        label: label.trim(),
        infoText: infoText.trim() || undefined,
      };
      if (!next.infoText) delete next.infoText;
      const req = bprTrustRequestedMessage.trim();
      const uns = bprTrustUnsureMessage.trim();
      if (req) next.bprTrustRequestedMessage = req;
      else delete next.bprTrustRequestedMessage;
      if (uns) next.bprTrustUnsureMessage = uns;
      else delete next.bprTrustUnsureMessage;
      applyConditions(next);
      onSave(next);
      onClose();
      return;
    }

    if (field.type === 'propertyGiftsGuided') {
      const next = {
        ...field,
        label: label.trim(),
        infoText: infoText.trim() || undefined,
      };
      if (!next.infoText) delete next.infoText;
      applyConditions(next);
      onSave(next);
      onClose();
      return;
    }

    if (field.type === 'propertyTrustGuided') {
      const next = {
        ...field,
        label: label.trim(),
        infoText: infoText.trim() || undefined,
      };
      if (!next.infoText) delete next.infoText;
      applyConditions(next);
      onSave(next);
      onClose();
      return;
    }

    const next = { ...field, label, placeholder: placeholder || undefined, infoText: infoText || undefined };
    if (isDisplay) {
      next.text = displayText;
    }
    if (field.type === 'textarea' && typeof rows === 'number' && rows > 0) {
      next.rows = rows;
    }
    if (Array.isArray(field.options) && optionLabels.length === field.options.length) {
      next.options = field.options.map((o, i) => ({ ...o, label: optionLabels[i] ?? o.label ?? o.value }));
    }
    applyConditions(next);
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
        <h3 className="text-lg font-semibold text-slate-900">
          {isDisplay
            ? 'Edit alert / info message'
            : isBizGuided
              ? 'Edit Business Interests (guided)'
              : isPropertyGiftsGuided
                ? 'Edit Property Gifts (guided)'
                : isPropertyTrustGuided
                  ? 'Edit Property Trust (guided)'
                  : 'Edit question'}
        </h3>
        <p className="mt-1 text-xs text-slate-500">ID: {field.id} · Type: {field.type}</p>
        <div className="mt-4 space-y-4">
          {isDisplay && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Message text</label>
              <p className="mt-0.5 text-xs text-slate-500">This is the text displayed to the client as an informational message or alert.</p>
              <textarea
                value={displayText}
                onChange={(e) => setDisplayText(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                placeholder="Enter the message to display..."
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">
              {isDisplay
                ? 'Heading / label (optional)'
                : isBizGuided || isPropertyGiftsGuided || isPropertyTrustGuided
                  ? 'Internal label (optional)'
                  : 'Question / label'}
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="e.g. Who moved my cheese?"
            />
          </div>
          {isBizGuided && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700">BPR confirmation — client chose “Yes” (include BPR trust)</label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Shown in the green confirmation box after the client selects that they want a BPR trust. Leave blank to use
                  the default short line.
                </p>
                <textarea
                  value={bprTrustRequestedMessage}
                  onChange={(e) => setBprTrustRequestedMessage(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="BPR trust requested"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  BPR confirmation — client needs advice first (unsure)
                </label>
                <p className="mt-0.5 text-xs text-slate-500">
                  Shown when the client needs advice first. Leave blank to use the default wording.
                </p>
                <textarea
                  value={bprTrustUnsureMessage}
                  onChange={(e) => setBprTrustUnsureMessage(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Flagged for discussion…"
                />
              </div>
            </>
          )}
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
          <ConditionEditor
            conditions={conditions}
            conditionLogic={conditionLogic}
            onChange={(c, l) => { setConditions(c); setConditionLogic(l); }}
            allFields={allFields}
          />
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

function PersonFieldEditModal({ fieldKey, currentOverride, defaultSpec, onClose, onSave }) {
  const [label, setLabel] = useState(currentOverride?.label ?? defaultSpec?.label ?? '');
  const [placeholder, setPlaceholder] = useState(currentOverride?.placeholder ?? defaultSpec?.placeholder ?? '');
  const [hidden, setHidden] = useState(!!currentOverride?.hidden);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl questionnaire-modal-panel">
        <h3 className="text-lg font-semibold text-slate-900">Edit contact field</h3>
        <p className="mt-1 text-xs text-slate-500">Field key: {fieldKey} · Type: {defaultSpec?.type || 'text'}</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Label (shown to user)</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder={defaultSpec?.label || ''}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Placeholder (optional)</label>
            <input
              type="text"
              value={placeholder}
              onChange={(e) => setPlaceholder(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder={defaultSpec?.placeholder || ''}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={hidden}
              onChange={(e) => setHidden(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Hide this field from clients
          </label>
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 questionnaire-modal-hint">
          Changes apply to every add-person form (executors, guardians, trustees, spouse, etc.). Click <strong className="font-semibold text-slate-800">Save questionnaire</strong> to publish.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(fieldKey, {
                label: label.trim() || defaultSpec?.label || fieldKey,
                placeholder: placeholder.trim() || undefined,
                hidden,
              });
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
  const { isDark } = useTheme();
  const { formData, loading, refresh, isCustom } = useFormDefinition();
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
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editingPersonFieldKey, setEditingPersonFieldKey] = useState(null);
  const [personFieldsExpanded, setPersonFieldsExpanded] = useState(false);
  const [expandedSubFields, setExpandedSubFields] = useState(() => new Set());

  const openConfirm = useCallback((config) => {
    setConfirmDialog({
      title: config.title,
      children: config.children,
      confirmLabel: config.confirmLabel ?? 'Confirm',
      cancelLabel: config.cancelLabel ?? 'Cancel',
      variant: config.variant ?? 'default',
      onConfirm: config.onConfirm,
    });
  }, []);

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
      e.returnValue = LEAVE_PAGE_UNSAVED_MSG;
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

  const updateSubField = useCallback((sectionIndex, fieldIndex, subFieldIndex, updatedSubField) => {
    qLog('subfield_edit_apply', { sectionIndex, fieldIndex, subFieldIndex, subFieldId: updatedSubField?.id });
    setDefinition((d) => {
      const next = deepClone(d);
      const parentField = next.formSections[sectionIndex]?.fields?.[fieldIndex];
      if (parentField?.subFields?.[subFieldIndex]) {
        parentField.subFields[subFieldIndex] = { ...parentField.subFields[subFieldIndex], ...updatedSubField };
      }
      return next;
    });
    setDirty(true);
    qLog('dirty_set', { reason: 'subfield_edit_apply' });
    setEditingField(null);
  }, []);

  const toggleSubFieldVisibility = useCallback((sectionIndex, fieldIndex, subFieldIndex) => {
    setDefinition((d) => {
      const next = deepClone(d);
      const sf = next.formSections[sectionIndex]?.fields?.[fieldIndex]?.subFields?.[subFieldIndex];
      if (sf) sf._hiddenFromClient = !sf._hiddenFromClient;
      return next;
    });
    setDirty(true);
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

  const moveSection = useCallback(
    (sectionIndex, direction) => {
      openConfirm({
        title: CONFIRM_MODAL.moveSectionOrder.title,
        children: <p>{CONFIRM_MODAL.moveSectionOrder.body}</p>,
        confirmLabel: 'Continue',
        onConfirm: () => {
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
        },
      });
    },
    [openConfirm]
  );

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

  const moveField = useCallback(
    (sectionIndex, fieldIndex, direction) => {
      openConfirm({
        title: CONFIRM_MODAL.moveFieldOrder.title,
        children: <p>{CONFIRM_MODAL.moveFieldOrder.body}</p>,
        confirmLabel: 'Continue',
        onConfirm: () => {
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
        },
      });
    },
    [openConfirm]
  );

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
    openConfirm({
      title: CONFIRM_MODAL.discardDraft.title,
      children: (
        <>
          <p>{CONFIRM_MODAL.discardDraft.lead}</p>
          <p>{CONFIRM_MODAL.discardDraft.detail}</p>
        </>
      ),
      confirmLabel: 'Discard',
      variant: 'danger',
      onConfirm: () => {
        setDefinition(deepClone(formData));
        setDirty(false);
        setExpandedSections(new Set([0]));
        qLog('draft_discarded', { restoredSectionCount: formData?.formSections?.length });
        toast.info('Draft discarded', { description: 'This page now matches the last published questionnaire.' });
      },
    });
  }, [dirty, definition.formSections?.length, formData, openConfirm]);

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
      openConfirm({
        title: CONFIRM_MODAL.removeSection.title,
        children: (
          <>
            <p>{CONFIRM_MODAL.removeSection.lead}</p>
            <p>{CONFIRM_MODAL.removeSection.detail}</p>
          </>
        ),
        confirmLabel: 'Remove section',
        variant: 'danger',
        onConfirm: () => {
          qLog('structure_remove_section', { sectionIndex });
          setDefinition((d) => {
            const next = deepClone(d);
            next.formSections.splice(sectionIndex, 1);
            return next;
          });
          setDirty(true);
          qLog('dirty_set', { reason: 'remove_section' });
        },
      });
    },
    [definition.formSections, openConfirm]
  );

  const removeField = useCallback(
    (sectionIndex, fieldIndex) => {
      const field = definition.formSections[sectionIndex]?.fields?.[fieldIndex];
      if (!field?.id?.startsWith?.('custom_')) {
        toast.error('Only fields with IDs starting with custom_ (added in Advanced mode) can be removed.');
        return;
      }
      openConfirm({
        title: CONFIRM_MODAL.removeField.title,
        children: (
          <>
            <p>{CONFIRM_MODAL.removeField.lead}</p>
            <p>{CONFIRM_MODAL.removeField.detail}</p>
          </>
        ),
        confirmLabel: 'Remove',
        variant: 'danger',
        onConfirm: () => {
          qLog('structure_remove_field', { sectionIndex, fieldIndex });
          setDefinition((d) => {
            const next = deepClone(d);
            next.formSections[sectionIndex].fields.splice(fieldIndex, 1);
            return next;
          });
          setDirty(true);
          qLog('dirty_set', { reason: 'remove_field' });
        },
      });
    },
    [definition.formSections, openConfirm]
  );

  const toggleFieldVisibility = useCallback((sectionIndex, fieldIndex) => {
    setDefinition((d) => {
      const next = deepClone(d);
      const field = next.formSections[sectionIndex]?.fields?.[fieldIndex];
      if (!field) return d;
      field._hiddenFromClient = !field._hiddenFromClient;
      return next;
    });
    setDirty(true);
    qLog('field_visibility_toggle', { sectionIndex, fieldIndex });
  }, []);

  const toggleSectionVisibility = useCallback((sectionIndex) => {
    setDefinition((d) => {
      const next = deepClone(d);
      const section = next.formSections[sectionIndex];
      if (!section) return d;
      section._hiddenFromClient = !section._hiddenFromClient;
      return next;
    });
    setDirty(true);
    qLog('section_visibility_toggle', { sectionIndex });
  }, []);

  const savePersonFieldOverride = useCallback((fieldKey, override) => {
    setDefinition((d) => {
      const next = deepClone(d);
      next._personFieldOverrides = next._personFieldOverrides || {};
      next._personFieldOverrides[fieldKey] = override;
      return next;
    });
    setDirty(true);
    qLog('person_field_override', { fieldKey });
  }, []);

  const togglePersonFieldVisibility = useCallback((fieldKey) => {
    setDefinition((d) => {
      const next = deepClone(d);
      next._personFieldOverrides = next._personFieldOverrides || {};
      const current = next._personFieldOverrides[fieldKey] || {};
      next._personFieldOverrides[fieldKey] = { ...current, hidden: !current.hidden };
      return next;
    });
    setDirty(true);
    qLog('person_field_visibility_toggle', { fieldKey });
  }, []);

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

  const handleResetToDefault = () => {
    openConfirm({
      title: CONFIRM_MODAL.resetToFactory.title,
      children: (
        <>
          <p>{CONFIRM_MODAL.resetToFactory.lead}</p>
          <p>{CONFIRM_MODAL.resetToFactory.detail}</p>
        </>
      ),
      confirmLabel: 'Reset draft',
      variant: 'danger',
      onConfirm: () => {
        void (async () => {
          qLog('reset_to_factory_clicked', {});
          const { data, source } = await getFactoryDefault();
          const payload = data || defaultFormData;
          setDefinition(deepClone(payload));
          setDirty(true);
          qLog('reset_to_factory_applied', { source, sectionCount: payload?.formSections?.length });
          toast.info('Draft reset to factory default', {
            description: `Source: ${source}. Click Save questionnaire to publish.`,
          });
        })();
      },
    });
  };

  const handleRestoreRevision = (revisionId) => {
    openConfirm({
      title: CONFIRM_MODAL.restoreRevision.title,
      children: (
        <>
          <p>{CONFIRM_MODAL.restoreRevision.lead}</p>
          <p>{CONFIRM_MODAL.restoreRevision.detail}</p>
        </>
      ),
      confirmLabel: 'Restore',
      variant: 'danger',
      onConfirm: () => {
        void (async () => {
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
        })();
      },
    });
  };

  const handleDeleteRevision = (revisionId) => {
    openConfirm({
      title: CONFIRM_MODAL.deleteRevision.title,
      children: (
        <>
          <p>{CONFIRM_MODAL.deleteRevision.lead}</p>
          <p>{CONFIRM_MODAL.deleteRevision.detail}</p>
        </>
      ),
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: () => {
        void (async () => {
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
        })();
      },
    });
  };

  const sections = definition.formSections || [];
  const lastSavedLabel = formatSavedTime(lastSavedAt);
  const canSave = dirty && !loading && !saving;
  const canDiscard = dirty && !loading && !saving;

  const editorCardClass = isDark
    ? 'rounded-2xl border border-slate-700 bg-[#0f1419] p-6 shadow-lg shadow-black/20 questionnaire-editor-card'
    : 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm questionnaire-editor-card';
  const sectionRowClass = (dragActive) =>
    isDark
      ? `questionnaire-editor-section rounded-xl border border-slate-600/90 bg-[#161b30] transition-all duration-200 ease-out ${showAdvanced && dragActive ? 'ring-2 ring-indigo-500/80 ring-offset-2 ring-offset-[#0f1419]' : ''} ${showAdvanced && dragFromIndex != null ? 'hover:border-indigo-500/40' : ''}`
      : `questionnaire-editor-section rounded-xl border border-amber-200/80 bg-amber-50/40 transition-all duration-200 ease-out ${showAdvanced && dragActive ? 'ring-2 ring-indigo-400 ring-offset-1' : ''} ${showAdvanced && dragFromIndex != null ? 'transition-colors' : ''}`;

  return (
    <div className={`space-y-6 ${dirty ? 'pb-24 sm:pb-20' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/solicitor"
          className={`inline-flex items-center gap-2 text-sm font-medium questionnaire-back-link ${isDark ? 'text-slate-400 hover:text-slate-100' : 'text-slate-600 hover:text-slate-900'}`}
        >
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>
      </div>

      {loading && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm questionnaire-loading-banner ${isDark ? 'border-slate-600 bg-slate-800/80 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
          role="status"
        >
          Loading the saved questionnaire…
        </div>
      )}

      {!loading && (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${
            isCustom
              ? isDark
                ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200'
                : 'border-emerald-300 bg-emerald-50 text-emerald-800'
              : isDark
                ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                : 'border-amber-300 bg-amber-50 text-amber-800'
          }`}
          role="status"
        >
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              isCustom
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]'
            }`}
            aria-hidden
          />
          <span>
            {isCustom ? (
              <>
                <strong className="font-semibold">Your customised questionnaire is active.</strong>{' '}
                Changes you save here are permanent and will not be overwritten by developer updates.
                {lastSavedLabel && (
                  <span className={isDark ? 'text-emerald-300/70' : 'text-emerald-600'}> · Last published: {lastSavedLabel}</span>
                )}
              </>
            ) : (
              <>
                <strong className="font-semibold">Using the default questionnaire.</strong>{' '}
                Edit and save to create your own version — it will persist across all future updates.
              </>
            )}
          </span>
        </div>
      )}

      <div className={editorCardClass}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className={`text-xl font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Edit questionnaire</h1>
            <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Change question text, labels, placeholders, and answer options. Clients will see these when filling the form. Section names and field IDs affect PDF logic—edit labels only if unsure.
            </p>
            {lastSavedLabel && (
              <p className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Last published: {lastSavedLabel}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={loading || saving}
              className={`rounded-xl border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-slate-500 bg-slate-800/80 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
            >
              Reset to default
            </button>
            {dirty && (
              <button
                type="button"
                onClick={handleDiscardDraft}
                disabled={!canDiscard}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-slate-500 bg-slate-800/80 text-slate-200 hover:bg-slate-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
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

        <div
          className={`questionnaire-quick-steps mt-6 rounded-xl border p-4 text-sm ${isDark ? 'border-slate-600 bg-slate-800/40 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
        >
          <p className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>Quick steps</p>
          <ol className={`mt-2 list-decimal space-y-1 pl-5 ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
            <li>
              Expand a section and use <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Edit</strong> to change wording. In the pop-up, click{' '}
              <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Apply changes</strong> (that only updates this page).
            </li>
            <li>
              When you are finished, click <strong className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>Save questionnaire</strong> (here or in the bar at the bottom) so clients see your updates.
            </li>
            <li className={isDark ? 'text-slate-300' : 'text-slate-800'}>
              Tip:{' '}
              <kbd className={`questionnaire-kbd rounded border px-1.5 py-0.5 font-mono text-xs font-medium shadow-sm ${isDark ? 'border-slate-500 bg-slate-700 text-slate-100' : 'border-slate-400 bg-slate-200 text-slate-900'}`}>Ctrl</kbd>{' '}
              +{' '}
              <kbd className={`questionnaire-kbd rounded border px-1.5 py-0.5 font-mono text-xs font-medium shadow-sm ${isDark ? 'border-slate-500 bg-slate-700 text-slate-100' : 'border-slate-400 bg-slate-200 text-slate-900'}`}>S</kbd>{' '}
              (or{' '}
              <kbd className={`questionnaire-kbd rounded border px-1.5 py-0.5 font-mono text-xs font-medium shadow-sm ${isDark ? 'border-slate-500 bg-slate-700 text-slate-100' : 'border-slate-400 bg-slate-200 text-slate-900'}`}>⌘</kbd>{' '}
              +{' '}
              <kbd className={`questionnaire-kbd rounded border px-1.5 py-0.5 font-mono text-xs font-medium shadow-sm ${isDark ? 'border-slate-500 bg-slate-700 text-slate-100' : 'border-slate-400 bg-slate-200 text-slate-900'}`}>S</kbd> on Mac) saves when you have unsaved changes.
            </li>
            <li>
              If you close the tab or navigate away while you still have unpublished changes, your browser may ask whether to leave. Stay to keep editing; leaving can discard work that was not saved.
            </li>
          </ol>
        </div>

        <div
          className={`questionnaire-version-history mt-6 rounded-xl border p-4 ${isDark ? 'border-slate-600 bg-slate-800/40' : 'border-slate-200 bg-slate-50'}`}
        >
          <div className={`questionnaire-version-history-header flex flex-wrap items-center gap-2 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <History size={18} className={`shrink-0 questionnaire-version-history-icon ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} />
            <span className="font-semibold">Backups &amp; restore</span>
            {revisionsLoading && <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Loading…</span>}
          </div>
          <p className={`questionnaire-version-history-desc mt-1.5 text-sm leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
            Every time you save, a backup is created automatically. You can go back to any previous version at any time.
          </p>
          <div className={`mt-3 rounded-lg border p-3 text-xs ${isDark ? 'border-slate-600/60 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-white text-slate-600'}`}>
            <p><strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>Restore</strong> — replaces the live questionnaire with that version. Clients will see the restored version.</p>
            <p className="mt-1"><strong className={isDark ? 'text-slate-200' : 'text-slate-800'}>Delete</strong> — removes the backup from history only. Does not change the live questionnaire.</p>
          </div>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
            {revisions.length === 0 && !revisionsLoading && (
              <li className={`questionnaire-version-history-empty rounded-lg border p-3 text-center ${isDark ? 'border-slate-600 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
                No backups yet. A backup will appear here after you save for the first time.
              </li>
            )}
            {revisions.map((r, rIdx) => {
              const sourceLabel = r.source === 'save' ? 'Saved' : r.source === 'restore' ? 'Restored' : r.source;
              return (
                <li
                  key={r.id}
                  className={`questionnaire-revision-row flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2.5 ${isDark ? 'border-slate-600 bg-slate-900/60' : 'border-slate-200 bg-white'}`}
                >
                  <span className={`min-w-0 flex-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    {rIdx === 0 && (
                      <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-emerald-900/50 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                        Latest
                      </span>
                    )}
                    {formatSavedTime(new Date(r.created_at)) || r.created_at}
                    <span className={`ml-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>· {sourceLabel}</span>
                  </span>
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      disabled={loading || restoreBusyId === r.id || deleteBusyId === r.id}
                      onClick={() => handleRestoreRevision(r.id)}
                      className={`questionnaire-revision-restore rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${isDark ? 'border-indigo-500/50 bg-indigo-950/40 text-indigo-200 hover:bg-indigo-900/50' : 'border-indigo-300 bg-white text-indigo-800 hover:bg-indigo-50'}`}
                    >
                      {restoreBusyId === r.id ? 'Restoring…' : 'Restore this version'}
                    </button>
                    <button
                      type="button"
                      disabled={loading || deleteBusyId === r.id || restoreBusyId === r.id}
                      onClick={() => handleDeleteRevision(r.id)}
                      className={`questionnaire-revision-delete inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium disabled:opacity-50 ${isDark ? 'border-red-500/40 bg-red-950/30 text-red-300 hover:bg-red-950/50' : 'border-red-200 bg-white text-red-700 hover:bg-red-50'}`}
                      aria-label="Delete backup"
                    >
                      <Trash2 size={12} aria-hidden />
                      {deleteBusyId === r.id ? 'Removing…' : 'Delete'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mt-6">
          <label className={`block text-sm font-medium ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Form title</label>
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
            className={`mt-1 max-w-md rounded-xl border px-3 py-2 text-sm disabled:opacity-60 ${isDark ? 'border-slate-600 bg-slate-800/80 text-slate-100 placeholder:text-slate-500' : 'border-slate-300 bg-white text-slate-900 disabled:bg-slate-50'}`}
            placeholder="Legacy Last Will & Testament Questionnaire"
          />
        </div>

        <div
          className={`questionnaire-advanced-panel mt-4 rounded-xl border p-4 text-sm ${isDark ? 'border-slate-600 bg-slate-800/30 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
        >
          <button
            type="button"
            id="questionnaire-advanced-trigger"
            aria-expanded={showAdvanced}
            aria-controls="questionnaire-advanced-toolbar"
            onClick={() => setShowAdvanced((s) => !s)}
            className={`questionnaire-advanced-toggle-btn group relative flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isDark ? 'border-slate-600 bg-gradient-to-br from-slate-800 to-slate-900 ring-1 ring-white/5 hover:border-indigo-500/40 hover:shadow-md hover:ring-indigo-500/20 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900' : 'border-slate-200/90 bg-gradient-to-br from-white via-white to-slate-50 ring-1 ring-slate-900/[0.04] hover:border-indigo-300/90 hover:shadow-md hover:ring-indigo-500/15 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50'}`}
          >
            <span
              className="questionnaire-advanced-toggle-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-900/25 ring-1 ring-white/10"
              aria-hidden
            >
              <Layers size={20} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={`questionnaire-advanced-toggle-title block text-sm font-semibold tracking-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                Advanced editing
              </span>
              <span className={`questionnaire-advanced-toggle-sub mt-0.5 block text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {showAdvanced
                  ? 'Open — reorder, add sections, or remove fields'
                  : 'Reorder sections · add sections · Remove on rows you added'}
              </span>
            </span>
            <ChevronDown
              size={22}
              className={`shrink-0 transition-transform duration-200 ease-out ${isDark ? 'text-slate-500 group-hover:text-indigo-400' : 'text-slate-400 group-hover:text-indigo-500'} ${showAdvanced ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          <p className={`questionnaire-advanced-hint mt-3 text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Drag the grip icon to reorder sections, use ↑↓, or pick a position number. Reordering changes client step order only; field IDs stay the same. New fields use IDs starting with{' '}
            <code className={`questionnaire-advanced-code rounded-md px-1.5 py-0.5 font-mono text-[0.8rem] ${isDark ? 'bg-slate-700 text-amber-200/90' : 'bg-slate-200/90 text-slate-800'}`}>custom_</code>. For sections and fields you added, use{' '}
            <strong className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Remove section</strong> / <strong className={`font-semibold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>Remove</strong> on each row (visible without opening this panel). Built-in questionnaire sections cannot be deleted here—edit wording only.
          </p>
          {showAdvanced && (
            <div
              id="questionnaire-advanced-toolbar"
              className={`questionnaire-advanced-toolbar mt-4 flex flex-wrap gap-2 border-t pt-4 ${isDark ? 'border-slate-600' : 'border-slate-200/80'}`}
            >
              <button
                type="button"
                onClick={openAddSectionModal}
                disabled={loading || saving}
                className={`questionnaire-advanced-add inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition disabled:opacity-50 ${isDark ? 'border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700' : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'}`}
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
              className={sectionRowClass(dragFromIndex === sIdx)}
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
                  className={`flex min-w-0 flex-1 items-center gap-2 text-left font-medium questionnaire-section-title ${section._hiddenFromClient ? 'opacity-50' : ''} ${isDark ? 'text-slate-100' : 'text-stone-900'}`}
                >
                  {expandedSections.has(sIdx) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <FileText size={16} className={`questionnaire-section-icon shrink-0 ${isDark ? 'text-amber-400/90' : 'text-amber-700'}`} />
                  <span className="min-w-0 break-words">
                    {section.formSection || `Section ${sIdx + 1}`}
                    {section._hiddenFromClient && (
                      <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-600'}`}>
                        Hidden from clients
                      </span>
                    )}
                  </span>
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
                        className={`cursor-grab rounded-lg p-1.5 active:cursor-grabbing touch-manipulation transition-colors ${isDark ? 'text-amber-300/90 hover:bg-slate-700/80' : 'text-amber-900 hover:bg-amber-100'}`}
                      >
                        <GripVertical size={18} />
                      </button>
                      <label
                        className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${isDark ? 'border-amber-400/50 bg-slate-950/80 text-amber-200' : 'border-amber-200/80 bg-white/80 text-amber-900'}`}
                      >
                        <span className="hidden sm:inline">#</span>
                        <select
                          value={sIdx + 1}
                          onChange={(e) => {
                            const to = parseInt(e.target.value, 10) - 1;
                            if (!Number.isNaN(to) && to !== sIdx) moveSectionToIndex(sIdx, to);
                          }}
                          disabled={loading || saving}
                          className={`max-w-[4rem] cursor-pointer rounded border-0 bg-transparent py-0 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 ${isDark ? 'text-amber-100' : 'text-amber-950'}`}
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
                        className={`rounded-lg p-1.5 disabled:opacity-30 ${isDark ? 'text-amber-200 hover:bg-slate-700' : 'text-amber-900 hover:bg-amber-100'}`}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        title="Move section down"
                        onClick={() => moveSection(sIdx, 1)}
                        disabled={sIdx >= sections.length - 1 || loading || saving}
                        className={`rounded-lg p-1.5 disabled:opacity-30 ${isDark ? 'text-amber-200 hover:bg-slate-700' : 'text-amber-900 hover:bg-amber-100'}`}
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
                      className={`questionnaire-remove-section-btn inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${isDark ? 'border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-950/60' : 'border-red-200 bg-white text-red-700 hover:bg-red-50'}`}
                      aria-label="Remove section"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">Remove section</span>
                    </button>
                  )}
                  <button
                    type="button"
                    title={section._hiddenFromClient ? 'Hidden from clients — click to show' : 'Visible to clients — click to hide'}
                    onClick={() => toggleSectionVisibility(sIdx)}
                    disabled={loading || saving}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                      section._hiddenFromClient
                        ? isDark
                          ? 'border-orange-500/40 bg-orange-950/40 text-orange-300 hover:bg-orange-950/60'
                          : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                        : isDark
                          ? 'border-slate-500 bg-slate-800/60 text-slate-300 hover:bg-slate-700'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {section._hiddenFromClient ? <EyeOff size={13} /> : <Eye size={13} />}
                    <span className="hidden sm:inline">{section._hiddenFromClient ? 'Hidden' : 'Visible'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingSectionIndex(sIdx)}
                    disabled={loading || saving}
                    className={`questionnaire-edit-section-btn shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-indigo-500/45 bg-indigo-950/50 text-indigo-100 hover:bg-indigo-900/60 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#161b30]' : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 focus:ring-amber-400 focus:ring-offset-1'}`}
                  >
                    <Edit3 size={12} />
                    Edit section
                  </button>
                </div>
              </div>
              {expandedSections.has(sIdx) && (
                <div
                  className={`questionnaire-editor-section-content border-t px-4 pb-3 pt-2 ${isDark ? 'border-slate-600 bg-slate-900/40' : 'border-amber-200/80 bg-white/70'}`}
                >
                  {showAdvanced && (
                    <button
                      type="button"
                      onClick={() => openAddFieldModal(sIdx)}
                      disabled={loading || saving}
                      className={`mb-2 inline-flex items-center gap-1 rounded-lg border border-dashed px-2 py-1 text-xs font-medium disabled:opacity-50 ${isDark ? 'border-slate-500 text-slate-200 hover:bg-slate-800' : 'border-amber-300 text-amber-900 hover:bg-amber-50'}`}
                    >
                      <Plus size={12} /> Add field in this section
                    </button>
                  )}
                  <ul className="space-y-1">
                    {(section.fields || []).map((field, fIdx) => {
                      const subFieldKey = `${sIdx}-${fIdx}`;
                      const hasSubFields = field.type === 'section' && Array.isArray(field.subFields) && field.subFields.length > 0;
                      const subFieldsOpen = expandedSubFields.has(subFieldKey);
                      return (
                      <li
                        key={field.id || fIdx}
                        className={`questionnaire-field-item rounded-lg border text-sm shadow-sm ${field._hiddenFromClient ? 'opacity-50' : ''} ${isDark ? 'border-slate-600 bg-slate-900/70' : 'border-stone-100 bg-white'}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                        <span className={`min-w-0 questionnaire-field-text ${isDark ? 'text-slate-300' : 'text-stone-700'}`}>
                          <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-stone-500'}`}>{field.id}</span>
                          <span className="mx-2">·</span>
                          {field.type === 'display'
                            ? (field.label || (field.text ? (field.text.length > 60 ? field.text.slice(0, 60) + '…' : field.text) : '(info/alert message)'))
                            : (field.label || '(no label)')}
                          {field.type === 'display' && (
                            <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-100 text-blue-600'}`}>
                              Alert / Info
                            </span>
                          )}
                          {hasSubFields && (
                            <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-violet-900/50 text-violet-300' : 'bg-violet-100 text-violet-600'}`}>
                              {field.subFields.length} sub-fields
                            </span>
                          )}
                          {field._hiddenFromClient && (
                            <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-600'}`}>
                              Hidden
                            </span>
                          )}
                          {Array.isArray(field.conditions) && field.conditions.length > 0 && (
                            <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>
                              Conditional
                            </span>
                          )}
                        </span>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          {hasSubFields && (
                            <button
                              type="button"
                              title={subFieldsOpen ? 'Collapse sub-fields' : 'Expand sub-fields'}
                              onClick={() => setExpandedSubFields((prev) => { const n = new Set(prev); if (n.has(subFieldKey)) n.delete(subFieldKey); else n.add(subFieldKey); return n; })}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${isDark ? 'border-violet-500/40 text-violet-300 hover:bg-violet-950/50' : 'border-violet-200 text-violet-600 hover:bg-violet-50'}`}
                            >
                              {subFieldsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                              <span className="hidden sm:inline">Fields</span>
                            </button>
                          )}
                          {showAdvanced && (
                            <>
                              <button
                                type="button"
                                title="Move field up"
                                onClick={() => moveField(sIdx, fIdx, -1)}
                                disabled={fIdx === 0 || loading || saving}
                                className={`rounded p-1 disabled:opacity-30 ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-stone-600 hover:bg-stone-100'}`}
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                title="Move field down"
                                onClick={() => moveField(sIdx, fIdx, 1)}
                                disabled={fIdx >= (section.fields || []).length - 1 || loading || saving}
                                className={`rounded p-1 disabled:opacity-30 ${isDark ? 'text-slate-400 hover:bg-slate-700' : 'text-stone-600 hover:bg-stone-100'}`}
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
                              className={`questionnaire-remove-field-btn inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${isDark ? 'border-red-500/40 text-red-300 hover:bg-red-950/50' : 'border-red-200 text-red-700 hover:bg-red-50'}`}
                              aria-label="Remove question"
                            >
                              <Trash2 size={12} />
                              <span className="hidden sm:inline">Remove</span>
                            </button>
                          )}
                          <button
                            type="button"
                            title={field._hiddenFromClient ? 'Hidden from clients — click to show' : 'Visible to clients — click to hide'}
                            onClick={() => toggleFieldVisibility(sIdx, fIdx)}
                            disabled={loading || saving}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                              field._hiddenFromClient
                                ? isDark
                                  ? 'border-orange-500/40 bg-orange-950/40 text-orange-300 hover:bg-orange-950/60'
                                  : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                : isDark
                                  ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                                  : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                            }`}
                          >
                            {field._hiddenFromClient ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingField({ sectionIndex: sIdx, fieldIndex: fIdx, field })}
                            disabled={loading || saving}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-indigo-500/40 bg-indigo-950/40 text-indigo-200 hover:bg-indigo-900/50' : 'border-transparent text-indigo-600 hover:bg-indigo-50'}`}
                          >
                            <Edit3 size={12} />
                            Edit
                          </button>
                        </div>
                        </div>
                        {hasSubFields && subFieldsOpen && (
                          <ul className={`mx-3 mb-2 space-y-1 rounded-lg border p-2 ${isDark ? 'border-slate-700 bg-slate-950/50' : 'border-violet-100 bg-violet-50/40'}`}>
                            {field.subFields.map((sf, sfIdx) => (
                              <li
                                key={sf.id || sfIdx}
                                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${sf._hiddenFromClient ? 'opacity-50' : ''} ${isDark ? 'border-slate-700 bg-slate-900/80' : 'border-stone-100 bg-white'}`}
                              >
                                <span className={`min-w-0 ${isDark ? 'text-slate-300' : 'text-stone-700'}`}>
                                  <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-stone-500'}`}>{sf.id}</span>
                                  <span className="mx-1.5">·</span>
                                  {sf.type === 'display'
                                    ? (sf.label || (sf.text ? (sf.text.length > 50 ? sf.text.slice(0, 50) + '…' : sf.text) : '(info)'))
                                    : (sf.label || '(no label)')}
                                  {sf._hiddenFromClient && (
                                    <span className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-600'}`}>Hidden</span>
                                  )}
                                  {Array.isArray(sf.conditions) && sf.conditions.length > 0 && (
                                    <span className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-amber-900/50 text-amber-300' : 'bg-amber-100 text-amber-700'}`}>Conditional</span>
                                  )}
                                </span>
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    title={sf._hiddenFromClient ? 'Hidden — click to show' : 'Visible — click to hide'}
                                    onClick={() => toggleSubFieldVisibility(sIdx, fIdx, sfIdx)}
                                    disabled={loading || saving}
                                    className={`rounded-lg border px-1.5 py-1 disabled:opacity-50 ${
                                      sf._hiddenFromClient
                                        ? isDark ? 'border-orange-500/40 text-orange-300' : 'border-orange-300 text-orange-700'
                                        : isDark ? 'border-slate-600 text-slate-400' : 'border-slate-200 text-slate-500'
                                    }`}
                                  >
                                    {sf._hiddenFromClient ? <EyeOff size={10} /> : <Eye size={10} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingField({ sectionIndex: sIdx, fieldIndex: fIdx, subFieldIndex: sfIdx, field: sf })}
                                    disabled={loading || saving}
                                    className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold disabled:opacity-50 ${isDark ? 'border-indigo-500/40 text-indigo-200 hover:bg-indigo-900/50' : 'border-transparent text-indigo-600 hover:bg-indigo-50'}`}
                                  >
                                    <Edit3 size={10} />
                                    Edit
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className={`mt-8 rounded-xl border p-4 ${isDark ? 'border-slate-600 bg-slate-800/30' : 'border-slate-200 bg-slate-50'}`}>
          <button
            type="button"
            onClick={() => setPersonFieldsExpanded((v) => !v)}
            className={`flex w-full items-center gap-2 text-left font-semibold ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
          >
            {personFieldsExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            <User size={16} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
            Contact / person fields
            <span className={`ml-2 text-xs font-normal ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              (spouse, executors, guardians, trustees)
            </span>
          </button>
          <p className={`mt-1 ml-9 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            These fields appear every time someone adds a person. Edit labels, placeholders, or hide fields clients don't need to fill in.
          </p>

          {personFieldsExpanded && (
            <ul className="mt-4 space-y-1">
              {PERSON_RECORD_SPECS.map((spec) => {
                const override = definition._personFieldOverrides?.[spec.key];
                const isHidden = !!override?.hidden;
                const displayLabel = override?.label || spec.label;
                return (
                  <li
                    key={spec.key}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm shadow-sm ${isHidden ? 'opacity-50' : ''} ${isDark ? 'border-slate-600 bg-slate-900/70' : 'border-stone-100 bg-white'}`}
                  >
                    <span className={`min-w-0 ${isDark ? 'text-slate-300' : 'text-stone-700'}`}>
                      <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-stone-500'}`}>{spec.key}</span>
                      <span className="mx-2">·</span>
                      {displayLabel}
                      {isHidden && (
                        <span className={`ml-2 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'bg-orange-900/50 text-orange-300' : 'bg-orange-100 text-orange-600'}`}>
                          Hidden
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        title={isHidden ? 'Hidden from clients — click to show' : 'Visible to clients — click to hide'}
                        onClick={() => togglePersonFieldVisibility(spec.key)}
                        disabled={loading || saving}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                          isHidden
                            ? isDark
                              ? 'border-orange-500/40 bg-orange-950/40 text-orange-300 hover:bg-orange-950/60'
                              : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                            : isDark
                              ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPersonFieldKey(spec.key)}
                        disabled={loading || saving}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-indigo-500/40 bg-indigo-950/40 text-indigo-200 hover:bg-indigo-900/50' : 'border-transparent text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        <Edit3 size={12} />
                        Edit
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {editingPersonFieldKey && (
        <PersonFieldEditModal
          fieldKey={editingPersonFieldKey}
          currentOverride={definition._personFieldOverrides?.[editingPersonFieldKey]}
          defaultSpec={PERSON_RECORD_SPECS.find((s) => s.key === editingPersonFieldKey)}
          onClose={() => setEditingPersonFieldKey(null)}
          onSave={savePersonFieldOverride}
        />
      )}

      {editingField && (
        <FieldEditModal
          key={`${editingField.sectionIndex}-${editingField.fieldIndex}-${editingField.subFieldIndex ?? 'top'}-${editingField.field.id}`}
          field={editingField.field}
          onClose={() => setEditingField(null)}
          onSave={(updated) =>
            editingField.subFieldIndex != null
              ? updateSubField(editingField.sectionIndex, editingField.fieldIndex, editingField.subFieldIndex, updated)
              : updateField(editingField.sectionIndex, editingField.fieldIndex, updated)
          }
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
          className={`questionnaire-sticky-save fixed inset-x-0 bottom-0 z-40 border-t px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.12)] backdrop-blur-md sm:px-6 ${isDark ? 'border-slate-600 bg-slate-900/95 text-slate-100' : 'border-slate-300 bg-slate-100 text-slate-800'}`}
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm font-medium ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
              You have unpublished changes. Save questionnaire so clients see them.
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleDiscardDraft}
                disabled={!canDiscard}
                className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${isDark ? 'border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700' : 'border-slate-400 bg-white text-slate-800 hover:bg-slate-50'}`}
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

      <ConfirmModal
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => confirmDialog?.onConfirm?.()}
        title={confirmDialog?.title ?? ''}
        confirmLabel={confirmDialog?.confirmLabel}
        cancelLabel={confirmDialog?.cancelLabel}
        variant={confirmDialog?.variant}
      >
        {confirmDialog?.children}
      </ConfirmModal>
    </div>
  );
}
