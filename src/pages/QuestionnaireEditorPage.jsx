import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, ChevronRight, Edit3, Save, FileText } from 'lucide-react';
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';
import { saveFormDefinition } from '../lib/formDefinition.js';
import defaultFormData from '../data/Complete-WillSuite-Form-Data.json';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function FieldEditModal({ field, onClose, onSave }) {
  const [label, setLabel] = useState(field.label || '');
  const [placeholder, setPlaceholder] = useState(field.placeholder ?? '');
  const [infoText, setInfoText] = useState(field.infoText ?? '');
  const [optionLabels, setOptionLabels] = useState(
    Array.isArray(field.options)
      ? field.options.map((o) => o.label ?? o.value ?? '')
      : []
  );

  const handleSave = () => {
    const next = { ...field, label, placeholder: placeholder || undefined, infoText: infoText || undefined };
    if (Array.isArray(field.options) && optionLabels.length === field.options.length) {
      next.options = field.options.map((o, i) => ({ ...o, label: optionLabels[i] ?? o.label ?? o.value }));
    }
    onSave(next);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Edit question</h3>
        <p className="mt-1 text-xs text-slate-500">ID: {field.id} · Type: {field.type}</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Question / label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. Who moved my cheese?"
            />
          </div>
          {(field.type === 'text' || field.type === 'date') && (
            <div>
              <label className="block text-sm font-medium text-slate-700">Placeholder</label>
              <input
                type="text"
                value={placeholder}
                onChange={(e) => setPlaceholder(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700">Help text (optional)</label>
            <textarea
              value={infoText}
              onChange={(e) => setInfoText(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          {optionLabels.length > 0 && (
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
                        const next = [...optionLabels];
                        next[i] = e.target.value;
                        setOptionLabels(next);
                      }}
                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                      placeholder="Label"
                    />
                    <span className="self-center text-xs text-slate-400">value: {String(opt.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
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
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Edit section title</h3>
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Section name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="e.g. Personal Information"
          />
        </div>
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
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

  useEffect(() => {
    if (!loading) {
      setDefinition(deepClone(formData));
    }
  }, [loading, formData]);

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
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const updateSection = useCallback((sectionIndex, newName) => {
    setDefinition((d) => {
      const next = deepClone(d);
      if (next.formSections[sectionIndex]) next.formSections[sectionIndex].formSection = newName;
      return next;
    });
    setDirty(true);
    setEditingSectionIndex(null);
  }, []);

  const updateField = useCallback((sectionIndex, fieldIndex, updatedField) => {
    setDefinition((d) => {
      const next = deepClone(d);
      if (next.formSections[sectionIndex]?.fields?.[fieldIndex]) {
        next.formSections[sectionIndex].fields[fieldIndex] = { ...next.formSections[sectionIndex].fields[fieldIndex], ...updatedField };
      }
      return next;
    });
    setDirty(true);
    setEditingField(null);
  }, []);

  const handleSaveQuestionnaire = useCallback(async () => {
    setSaving(true);
    try {
      const { error } = await saveFormDefinition(definition);
      if (error) {
        toast.error('Could not save questionnaire', { description: error });
        return;
      }
      await refresh();
      const now = new Date();
      setLastSavedAt(now);
      try {
        sessionStorage.setItem(LAST_SAVED_STORAGE_KEY, now.toISOString());
      } catch {
        /* ignore quota / private mode */
      }
      setDirty(false);
      toast.success('Questionnaire saved', { description: 'Clients and the form will see the updated questions.' });
    } finally {
      setSaving(false);
    }
  }, [definition, refresh]);

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== 's') return;
      e.preventDefault();
      if (dirty && !saving && !loading) {
        void handleSaveQuestionnaire();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, saving, loading, handleSaveQuestionnaire]);

  const handleResetToDefault = () => {
    if (!window.confirm('Reload the built-in default questionnaire? Any unsaved custom changes will be lost.')) return;
    setDefinition(deepClone(defaultFormData));
    setDirty(true);
    toast.info('Reset to built-in default', { description: 'Click Save questionnaire to publish this version.' });
  };

  const sections = definition.formSections || [];
  const lastSavedLabel = formatSavedTime(lastSavedAt);
  const canSave = dirty && !loading && !saving;

  return (
    <div className={`space-y-6 ${dirty ? 'pb-24 sm:pb-20' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/solicitor" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>
      </div>

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" role="status">
          Loading the saved questionnaire…
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-semibold text-amber-900">Quick steps</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-amber-950/90">
            <li>Expand a section and use <strong className="font-semibold">Edit</strong> to change wording. In the pop-up, click <strong className="font-semibold">Apply changes</strong> (that only updates this page).</li>
            <li>When you are finished, click <strong className="font-semibold">Save questionnaire</strong> (here or in the bar at the bottom) so clients see your updates.</li>
            <li>Tip: <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-xs">Ctrl</kbd> + <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-xs">S</kbd> (or <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-xs">⌘</kbd> + <kbd className="rounded border border-amber-300 bg-white px-1.5 py-0.5 font-mono text-xs">S</kbd> on Mac) saves when you have unsaved changes.</li>
          </ol>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700">Form title</label>
          <input
            type="text"
            value={definition.formTitle || ''}
            onChange={(e) => {
              const v = e.target.value;
              setDefinition((d) => ({ ...d, formTitle: v }));
              setDirty(true);
            }}
            disabled={loading || saving}
            className="mt-1 max-w-md rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
            placeholder="Legacy Last Will & Testament Questionnaire"
          />
        </div>

        <div className="mt-8 space-y-2 questionnaire-editor-sections">
          {sections.map((section, sIdx) => (
            <div key={sIdx} className="questionnaire-editor-section rounded-xl border border-amber-200/80 bg-amber-50/40">
              <div className="flex w-full items-center justify-between gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => toggleSection(sIdx)}
                  className="flex flex-1 items-center gap-2 text-left font-medium text-stone-900 questionnaire-section-title"
                >
                  {expandedSections.has(sIdx) ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  <FileText size={16} className="questionnaire-section-icon text-amber-700" />
                  {section.formSection || `Section ${sIdx + 1}`}
                </button>
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
              {expandedSections.has(sIdx) && (
                <div className="questionnaire-editor-section-content border-t border-amber-200/80 bg-white/70 px-4 pb-3 pt-2">
                  <ul className="space-y-1">
                    {(section.fields || []).map((field, fIdx) => (
                      <li key={field.id || fIdx} className="questionnaire-field-item flex items-center justify-between rounded-lg bg-white border border-stone-100 px-3 py-2 text-sm shadow-sm">
                        <span className="text-stone-700 questionnaire-field-text">
                          <span className="font-mono text-stone-500">{field.id}</span>
                          <span className="mx-2">·</span>
                          {field.label || '(no label)'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEditingField({ sectionIndex: sIdx, fieldIndex: fIdx, field })}
                          disabled={loading || saving}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
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

      {dirty && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-amber-300 bg-amber-100/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] backdrop-blur-sm sm:px-6"
          role="status"
          aria-live="polite"
        >
          <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-amber-950">
              You have unpublished changes. Save questionnaire so clients see them.
            </p>
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
      )}
    </div>
  );
}
