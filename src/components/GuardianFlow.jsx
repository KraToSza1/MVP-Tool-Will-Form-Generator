/**
 * GuardianFlow.jsx
 * ----------------
 * Matches site styling: light palette by default; when `html` has `dark-theme`,
 * uses slate surfaces, light text, and indigo accents (aligned with solicitor shell).
 *
 * Usage:
 *   import GuardianFlow from './components/GuardianFlow.jsx';
 *   <GuardianFlow onComplete={(data) => console.log(data)} />
 *
 * onComplete data shape:
 * {
 *   guardianOption: "no" | "yes_same" | "yes_different",
 *   guardians: [ { ...personFields } ],        // yes_same — shared guardian(s)
 *   children: [                                // yes_same & yes_different (under-18s)
 *     { childFirstName, childLastName, dob, guardians?: [ { ...personFields } ] }
 *   ]
 * }
 *
 * No external dependencies — React (useState) only.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { getContactCandidates } from '../lib/personRegistry.js';
import {
  GUARDIAN_FLOW_MODAL_EMPTY,
  dedupeGuardianFlowPersonList,
  guardianFlowPersonIsDuplicate,
  normalizeSourceToGuardianModalForm,
} from '../utils/guardianFlowSync.js';

const YES_DIFFERENT = 'Yes, but appoint different guardians for children';

function mapAppointToGuardianFlowOption(appointGuardians) {
  if (appointGuardians === 'No') return 'no';
  if (appointGuardians === 'Yes') return 'yes_same';
  if (appointGuardians === YES_DIFFERENT) return 'yes_different';
  return null;
}

/** Maps internal flow keys to `appointGuardians` formValues (hidden field). */
function mapFlowOptionToAppointValue(flowOpt) {
  if (flowOpt === 'no') return 'No';
  if (flowOpt === 'yes_same') return 'Yes';
  if (flowOpt === 'yes_different') return YES_DIFFERENT;
  return null;
}

/** Display child DOB: ISO YYYY-MM-DD → DD/MM/YYYY; otherwise as stored. */
function formatDob(v) {
  if (v == null || String(v).trim() === '') return '';
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return String(v).trim();
}

function PersonModal({ modalTitle, subtitle, initial, onSave, onClose, formValues }) {
  const candidates = useMemo(() => getContactCandidates(formValues || {}), [formValues]);
  const [sourceId, setSourceId] = useState('__new__');
  const [form, setForm] = useState(() =>
    initial ? normalizeSourceToGuardianModalForm(initial) : { ...GUARDIAN_FLOW_MODAL_EMPTY }
  );
  const [showErrors, setShowErrors] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  useEffect(() => {
    setSourceId('__new__');
    setForm(initial ? normalizeSourceToGuardianModalForm(initial) : { ...GUARDIAN_FLOW_MODAL_EMPTY });
    setShowErrors(false);
  }, [initial, modalTitle]);

  const applySource = (id) => {
    setSourceId(id);
    if (id === '__new__') {
      setForm({ ...GUARDIAN_FLOW_MODAL_EMPTY });
      return;
    }
    const c = candidates.find((x) => x.id === id);
    if (c?.data) {
      setForm(normalizeSourceToGuardianModalForm(c.data));
    }
  };

  const hasAddress = !!(form.addressLine1.trim() || form.postcode.trim());
  const isValid = !!(form.firstName.trim() && form.lastName.trim() && hasAddress);

  const errFirst = showErrors && !form.firstName.trim();
  const errLast = showErrors && !form.lastName.trim();
  const errAddr = showErrors && !hasAddress;

  const trySave = () => {
    setShowErrors(true);
    if (!isValid) return;
    onSave(form);
  };

  const sub = subtitle || modalTitle || 'Add person';

  return createPortal(
    <div className="grd-modal-overlay grd-modal-open" role="presentation" onClick={onClose}>
      <div className="grd-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grd-modal-header">
          <div className="grd-modal-header-left">
            <div className="grd-modal-header-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="grd-modal-title">Add person</p>
              <p className="grd-modal-subtitle break-words">{sub}</p>
            </div>
          </div>
          <button type="button" className="grd-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="grd-modal-body">
          {!initial && (
            <>
              <p className="grd-modal-section-label">Same person or new</p>
              <select
                className="grd-modal-select"
                value={sourceId}
                onChange={(e) => applySource(e.target.value)}
                aria-label="Prefill from an existing person or enter new details"
              >
                <option value="__new__">Enter a new person</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="grd-modal-info-row">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <p>
                  You can copy from someone you already entered, then edit. First name, last name, and at least address
                  line 1 or postcode are required.
                </p>
              </div>
            </>
          )}

          <div className="grd-modal-grid">
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-title">
                Title
              </label>
              <input
                id="gf-m-title"
                className="grd-modal-input"
                type="text"
                placeholder="e.g. Mr, Ms, Dr"
                value={form.title}
                onChange={set('title')}
              />
            </div>
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-fn">
                First name <span className="grd-modal-required">*</span>
              </label>
              <input
                id="gf-m-fn"
                className={`grd-modal-input${errFirst ? ' grd-modal-input-error' : ''}`}
                type="text"
                placeholder="e.g. John"
                value={form.firstName}
                onChange={set('firstName')}
              />
              <span className={`grd-modal-error-text${errFirst ? ' grd-modal-error-visible' : ''}`}>First name is required</span>
            </div>
          </div>
          <div className="grd-modal-grid">
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-mn">
                Middle name(s)
              </label>
              <input
                id="gf-m-mn"
                className="grd-modal-input"
                type="text"
                placeholder="Leave blank if not applicable"
                value={form.middleNames}
                onChange={set('middleNames')}
              />
            </div>
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-ln">
                Last name <span className="grd-modal-required">*</span>
              </label>
              <input
                id="gf-m-ln"
                className={`grd-modal-input${errLast ? ' grd-modal-input-error' : ''}`}
                type="text"
                placeholder="e.g. Smith"
                value={form.lastName}
                onChange={set('lastName')}
              />
              <span className={`grd-modal-error-text${errLast ? ' grd-modal-error-visible' : ''}`}>Last name is required</span>
            </div>
          </div>
          <div className="grd-modal-grid">
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-a1">
                Address line 1
              </label>
              <input
                id="gf-m-a1"
                className={`grd-modal-input${errAddr ? ' grd-modal-input-error' : ''}`}
                type="text"
                placeholder="House number and street"
                value={form.addressLine1}
                onChange={set('addressLine1')}
              />
            </div>
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-a2">
                Address line 2
              </label>
              <input
                id="gf-m-a2"
                className="grd-modal-input"
                type="text"
                placeholder="Flat, building name, or area"
                value={form.addressLine2}
                onChange={set('addressLine2')}
              />
            </div>
          </div>
          <div className="grd-modal-grid">
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-town">
                Town / city
              </label>
              <input
                id="gf-m-town"
                className="grd-modal-input"
                type="text"
                placeholder="Town or city"
                value={form.town}
                onChange={set('town')}
              />
            </div>
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-pc">
                Postcode
              </label>
              <input
                id="gf-m-pc"
                className={`grd-modal-input${errAddr ? ' grd-modal-input-error' : ''}`}
                type="text"
                placeholder="e.g. SW1A 1AA"
                value={form.postcode}
                onChange={set('postcode')}
              />
              <span className={`grd-modal-error-text${errAddr ? ' grd-modal-error-visible' : ''}`}>
                Address line 1 or postcode is required
              </span>
            </div>
          </div>
          <div className="grd-modal-grid">
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-dob">
                Date of birth
              </label>
              <input
                id="gf-m-dob"
                className="grd-modal-input"
                type="date"
                max={new Date().toISOString().split('T')[0]}
                value={/^\d{4}-\d{2}-\d{2}$/.test(String(form.dob || '').trim()) ? String(form.dob).trim() : ''}
                onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              />
            </div>
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-gender">
                Gender
              </label>
              <select id="gf-m-gender" className="grd-modal-field-select" value={form.gender} onChange={set('gender')}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non_binary">Non-binary</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div className="grd-modal-grid">
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-occ">
                Occupation
              </label>
              <input
                id="gf-m-occ"
                className="grd-modal-input"
                type="text"
                placeholder="e.g. Teacher, Retired"
                value={form.occupation}
                onChange={set('occupation')}
              />
            </div>
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-rel">
                What is their relationship to you?
              </label>
              <input
                id="gf-m-rel"
                className="grd-modal-input"
                type="text"
                placeholder="e.g. Friend, sibling, cousin"
                value={form.relationship}
                onChange={set('relationship')}
              />
            </div>
          </div>
          <div className="grd-modal-grid">
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-mob">
                Mobile
              </label>
              <input
                id="gf-m-mob"
                className="grd-modal-input"
                type="tel"
                placeholder="e.g. 07700 900000"
                value={form.mobile}
                onChange={set('mobile')}
              />
            </div>
            <div className="grd-modal-field">
              <label className="grd-modal-label" htmlFor="gf-m-em">
                Email
              </label>
              <input
                id="gf-m-em"
                className="grd-modal-input"
                type="email"
                placeholder="e.g. john.smith@email.com"
                value={form.email}
                onChange={set('email')}
              />
            </div>
          </div>
        </div>

        <div className="grd-modal-footer">
          <button type="button" className="grd-modal-btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="grd-modal-btn-save" onClick={trySave}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Add person
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ChildModal({ title, initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { childFirstName: '', childLastName: '', dob: '' });
  const [showErrors, setShowErrors] = useState(false);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const isValid = form.childFirstName.trim() && form.childLastName.trim() && form.dob.trim();

  useEffect(() => {
    setShowErrors(false);
  }, [initial, title]);

  const dobMax = new Date().toISOString().split('T')[0];
  const dobMin = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 17);
    return d.toISOString().split('T')[0];
  })();

  const trySave = () => {
    setShowErrors(true);
    if (!isValid) return;
    onSave(form);
  };

  return createPortal(
    <div className="grd-child-modal-overlay grd-modal-open" role="presentation" onClick={onClose}>
      <div className="grd-child-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grd-child-modal-header">
          <h3 className="grd-child-modal-title">{title || 'Add Child'}</h3>
          <button type="button" className="grd-modal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="grd-child-modal-body">
          <div className="grd-child-fields" style={{ gridTemplateColumns: '1fr' }}>
            <div>
              <label className="grd-field-label" htmlFor="gf-c-fn">
                First name(s) including middle names *
              </label>
              <input
                id="gf-c-fn"
                className={`grd-field-input${showErrors && !form.childFirstName.trim() ? ' ring-2 ring-red-400' : ''}`}
                placeholder="e.g. Emily Rose"
                value={form.childFirstName}
                onChange={set('childFirstName')}
              />
            </div>
            <div>
              <label className="grd-field-label" htmlFor="gf-c-ln">
                Last name / Surname *
              </label>
              <input
                id="gf-c-ln"
                className={`grd-field-input${showErrors && !form.childLastName.trim() ? ' ring-2 ring-red-400' : ''}`}
                placeholder="e.g. Smith"
                value={form.childLastName}
                onChange={set('childLastName')}
              />
            </div>
            <div>
              <label className="grd-field-label" htmlFor="gf-c-dob">
                Date of birth *
              </label>
              <input
                id="gf-c-dob"
                className={`grd-field-input${showErrors && !form.dob.trim() ? ' ring-2 ring-red-400' : ''}`}
                type="date"
                value={/^\d{4}-\d{2}-\d{2}$/.test(String(form.dob || '').trim()) ? String(form.dob).trim() : ''}
                max={dobMax}
                min={dobMin}
                onChange={(e) => setForm((f) => ({ ...f, dob: e.target.value }))}
              />
            </div>
          </div>

          <div className="grd-save-row flex flex-wrap justify-end gap-2">
            <button type="button" className="grd-btn-secondary min-h-[44px]" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="grd-btn-add min-h-[44px]" onClick={trySave}>
              Save child
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function GuardianList({ guardians, onChange, addLabel = 'Add Guardian', modalSubtitle, formValues }) {
  const [modal, setModal] = useState(null);

  const openAdd = () => setModal({ mode: 'add' });
  const openEdit = (i) => setModal({ mode: 'edit', index: i });
  const closeModal = () => setModal(null);

  const handleSave = (formData) => {
    if (modal.mode === 'add') {
      if (guardianFlowPersonIsDuplicate(formData, guardians)) {
        toast.warning('Already in this list', {
          description: 'That person matches a guardian you already added (same name and address).',
        });
        return;
      }
      onChange([...guardians, formData]);
    } else {
      if (guardianFlowPersonIsDuplicate(formData, guardians, { excludeIndex: modal.index })) {
        toast.warning('Duplicate guardian', {
          description: 'Another entry in this list already has the same name and address.',
        });
        return;
      }
      const updated = [...guardians];
      updated[modal.index] = formData;
      onChange(updated);
    }
    closeModal();
  };

  const handleRemove = (i) => onChange(guardians.filter((_, idx) => idx !== i));

  const displayName = (g) => [g.title, g.firstName, g.middleNames, g.lastName].filter(Boolean).join(' ');
  const initials = (g) => {
    const a = (g.firstName || '').trim().charAt(0);
    const b = (g.lastName || '').trim().charAt(0);
    return (a + b || '?').toUpperCase();
  };
  const detailLine = (g) =>
    [g.addressLine1, g.town, g.postcode].filter((x) => x && String(x).trim()).join(', ');

  const sub =
    modalSubtitle ||
    (modal?.mode === 'edit' ? 'Edit details' : `For: ${addLabel}`);

  return (
    <>
      {guardians.length === 0 && (
        <div className="grd-empty-card">
          <p className="ec-title">No guardian added yet</p>
          <p className="ec-sub">Use the button below to add someone.</p>
        </div>
      )}

      {guardians.map((g, i) => (
        <div key={i} className="grd-person-card">
          <div className="grd-person-avatar" aria-hidden>
            {initials(g)}
          </div>
          <div className="grd-person-info min-w-0">
            <p className="grd-person-name break-words">{displayName(g) || 'Guardian'}</p>
            {detailLine(g) ? <p className="grd-person-detail break-words">{detailLine(g)}</p> : null}
          </div>
          <div className="flex flex-shrink-0 flex-col gap-1 sm:flex-row">
            <button type="button" className="grd-btn-secondary min-h-[44px] px-3 text-xs" onClick={() => openEdit(i)}>
              Edit
            </button>
            <button type="button" className="grd-btn-remove" onClick={() => handleRemove(i)}>
              Remove
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="grd-btn-add" onClick={openAdd}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {addLabel}
      </button>

      {modal && (
        <PersonModal
          modalTitle={modal.mode === 'add' ? 'Add Guardian' : 'Edit Guardian'}
          subtitle={sub}
          initial={modal.mode === 'edit' ? guardians[modal.index] : null}
          formValues={formValues}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </>
  );
}

export default function GuardianFlow({
  onComplete,
  variant = 'standalone',
  appointGuardiansValue,
  initialFlowState = null,
  onFlowStateChange,
  onAppointGuardiansChange,
  formValues: formValuesProp,
}) {
  const isEmbedded = variant === 'embedded';
  const embeddedOption = useMemo(
    () => (isEmbedded ? mapAppointToGuardianFlowOption(appointGuardiansValue) : null),
    [isEmbedded, appointGuardiansValue]
  );

  const [standaloneOption, setStandaloneOption] = useState(null);
  const [sameGuardians, setSameGuardians] = useState([]);
  const [substituteSameGuardians, setSubstituteSameGuardians] = useState([]);
  const [children, setChildren] = useState([]);
  const [childModal, setChildModal] = useState(null);
  /** 1 = add children, 2 = assign guardian(s) */
  const [step, setStep] = useState(1);
  const hydratedKeyRef = useRef('');
  const prevEmbeddedOptionRef = useRef(null);

  const option = isEmbedded ? embeddedOption : standaloneOption;

  const openAddChild = () => setChildModal({ mode: 'add' });
  const openEditChild = (i) => setChildModal({ mode: 'edit', index: i });
  const closeChildModal = () => setChildModal(null);

  const handleSaveChild = (form) => {
    if (childModal.mode === 'add') {
      setChildren((prev) => [...prev, { ...form, guardians: [] }]);
    } else {
      setChildren((prev) => {
        const updated = [...prev];
        updated[childModal.index] = { ...updated[childModal.index], ...form };
        return updated;
      });
    }
    closeChildModal();
  };

  const handleRemoveChild = (i) => setChildren((prev) => prev.filter((_, idx) => idx !== i));

  const updateChildGuardians = (childIndex, guardians) =>
    setChildren((prev) => {
      const updated = [...prev];
      updated[childIndex] = { ...updated[childIndex], guardians };
      return updated;
    });

  const flowStateSnapshot = useMemo(
    () => ({ sameGuardians, children, step, substituteSameGuardians }),
    [sameGuardians, children, step, substituteSameGuardians]
  );

  useLayoutEffect(() => {
    if (!isEmbedded || !initialFlowState) return;
    const key = JSON.stringify(initialFlowState);
    if (hydratedKeyRef.current === key) return;
    hydratedKeyRef.current = key;
    const snap = initialFlowState;
    queueMicrotask(() => {
      if (Array.isArray(snap.sameGuardians)) {
        setSameGuardians(snap.sameGuardians);
      }
      if (Array.isArray(snap.children)) {
        setChildren(snap.children);
      }
      if (Array.isArray(snap.substituteSameGuardians)) {
        setSubstituteSameGuardians(snap.substituteSameGuardians);
      }
      if (typeof snap.step === 'number' && (snap.step === 1 || snap.step === 2)) {
        setStep(snap.step);
      } else if (typeof snap.childrenConfirmed === 'boolean') {
        setStep(snap.childrenConfirmed ? 2 : 1);
      }
    });
  }, [isEmbedded, initialFlowState]);

  useEffect(() => {
    if (!isEmbedded || typeof onFlowStateChange !== 'function') return;
    const t = setTimeout(() => {
      onFlowStateChange(flowStateSnapshot);
    }, 400);
    return () => clearTimeout(t);
  }, [isEmbedded, onFlowStateChange, flowStateSnapshot]);

  useEffect(() => {
    if (!isEmbedded) return;
    const prev = prevEmbeddedOptionRef.current;
    prevEmbeddedOptionRef.current = embeddedOption;
    if (prev !== null && prev !== embeddedOption) {
      queueMicrotask(() => {
        setStep(1);
        setChildren([]);
        setSameGuardians([]);
        setSubstituteSameGuardians([]);
      });
    }
  }, [isEmbedded, embeddedOption]);

  const selectEmbedded = (flowOpt) => {
    const v = mapFlowOptionToAppointValue(flowOpt);
    if (v) onAppointGuardiansChange?.(v);
  };

  const handleComplete = () => {
    const resolved = isEmbedded
      ? mapAppointToGuardianFlowOption(appointGuardiansValue)
      : standaloneOption;

    const sameDeduped = dedupeGuardianFlowPersonList(sameGuardians);
    const substituteDeduped = dedupeGuardianFlowPersonList(substituteSameGuardians);
    const childrenDeduped = children.map((ch) => ({
      ...ch,
      guardians: dedupeGuardianFlowPersonList(Array.isArray(ch.guardians) ? ch.guardians : []),
    }));

    const childGuardianCount = (chs) =>
      (chs || []).reduce((n, ch) => n + (Array.isArray(ch.guardians) ? ch.guardians.length : 0), 0);
    if (
      sameDeduped.length < sameGuardians.length ||
      substituteDeduped.length < substituteSameGuardians.length ||
      childGuardianCount(childrenDeduped) < childGuardianCount(children)
    ) {
      toast.info('Duplicate guardians removed', {
        description: 'The same person was listed more than once; only one copy is kept when saving.',
      });
    }

    if (resolved === 'no') {
      onComplete?.({
        guardianOption: 'no',
        _flowState: { sameGuardians: [], children: [], step: 1, substituteSameGuardians: [] },
      });
      return;
    }

    if (resolved === 'yes_same') {
      if (!childrenDeduped.length) {
        toast.error('Add your children', {
          description: 'Add at least one child under 18 before saving.',
        });
        return;
      }
      if (!sameDeduped.length) {
        toast.error('Add a guardian', {
          description: 'Name at least one guardian for your children.',
        });
        return;
      }
      onComplete?.({
        guardianOption: 'yes_same',
        guardians: sameDeduped,
        substituteGuardians: substituteDeduped,
        children: childrenDeduped,
        _flowState: {
          sameGuardians: sameDeduped,
          children: childrenDeduped,
          step,
          substituteSameGuardians: substituteDeduped,
        },
      });
      return;
    }

    if (resolved === 'yes_different') {
      if (!childrenDeduped.length) {
        toast.error('Add your children', {
          description: 'Add at least one child under 18 before saving.',
        });
        return;
      }
      const missingG = childrenDeduped.some((ch) => !Array.isArray(ch.guardians) || ch.guardians.length === 0);
      if (missingG) {
        toast.error('Guardians for every child', {
          description: 'Assign at least one guardian to each child before saving.',
        });
        return;
      }
      onComplete?.({
        guardianOption: 'yes_different',
        children: childrenDeduped,
        _flowState: {
          sameGuardians: [],
          children: childrenDeduped,
          step,
          substituteSameGuardians: [],
        },
      });
      return;
    }

    if (import.meta.env.DEV) {
      console.warn('[GuardianFlow] Save ignored: could not map appointGuardians', {
        appointGuardiansValue,
        resolved,
        isEmbedded,
      });
    }
  };

  const q1Radios = (
    <>
      <div className="grd-q-header">
        <div className="grd-badge-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <h3>Do you have children under 18 that you would like to appoint a guardian for?</h3>
      </div>

      <div className="grd-why">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>
          WHY WE ASK THIS: A guardian takes full legal responsibility for raising your children if both parents pass
          away. Without one named in your will, a court decides — which may not reflect your wishes.
        </p>
      </div>

      <p className="grd-helper">
        If you have children under 18, we strongly recommend naming at least one guardian. You can also name a backup
        in case your first choice is unable to act.
      </p>

      <div className="grd-radio-group">
        <label className="grd-radio-opt" htmlFor="gf-q-no">
          <input
            id="gf-q-no"
            type="radio"
            name={isEmbedded ? 'grd-embed-appoint' : 'guardianOptionStandalone'}
            checked={option === 'no'}
            onChange={() => {
              if (isEmbedded) selectEmbedded('no');
              else {
                setStandaloneOption('no');
                setChildren([]);
                setSameGuardians([]);
                setSubstituteSameGuardians([]);
                setStep(1);
              }
            }}
          />
          <div>
            <div className="grd-opt-label">No — I don&apos;t need to appoint a guardian</div>
            <div className="grd-opt-sub">
              I have no children under 18, or I don&apos;t wish to name a guardian in my will
            </div>
          </div>
        </label>
        <label className="grd-radio-opt" htmlFor="gf-q-yes-same">
          <input
            id="gf-q-yes-same"
            type="radio"
            name={isEmbedded ? 'grd-embed-appoint' : 'guardianOptionStandalone'}
            checked={option === 'yes_same'}
            onChange={() => {
              if (isEmbedded) selectEmbedded('yes_same');
              else {
                setStandaloneOption('yes_same');
                setChildren([]);
                setSameGuardians([]);
                setSubstituteSameGuardians([]);
                setStep(1);
              }
            }}
          />
          <div>
            <div className="grd-opt-label">Yes — the same guardian(s) for all my children</div>
            <div className="grd-opt-sub">
              I want to name one set of guardian(s) who will look after all my children together
            </div>
          </div>
        </label>
        <label className="grd-radio-opt" htmlFor="gf-q-yes-diff">
          <input
            id="gf-q-yes-diff"
            type="radio"
            name={isEmbedded ? 'grd-embed-appoint' : 'guardianOptionStandalone'}
            checked={option === 'yes_different'}
            onChange={() => {
              if (isEmbedded) selectEmbedded('yes_different');
              else {
                setStandaloneOption('yes_different');
                setChildren([]);
                setSameGuardians([]);
                setSubstituteSameGuardians([]);
                setStep(1);
              }
            }}
          />
          <div>
            <div className="grd-opt-label">Yes, but I want to appoint different guardians for each child</div>
            <div className="grd-opt-sub">
              Each child will have their own guardian — I&apos;ll assign them individually below
            </div>
          </div>
        </label>
      </div>
    </>
  );

  return (
    <div className="grd-wrap min-w-0">
      <div className="grd-section-title">
        <div className="grd-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <h2>Guardians</h2>
      </div>
      <hr className="grd-rule" />

      {q1Radios}

      {option === 'yes_different' && (step === 1 || step === 2) && (
        <div className="grd-warn">
          <p className="grd-warn-title">Assigning guardians per child</p>
          <p className="grd-warn-body">
            Add each of your children below, then assign their individual guardian(s). Each child has a completely
            separate guardian list.
          </p>
        </div>
      )}

      {(option === 'yes_same' || option === 'yes_different') && step === 1 && (
        <div className="grd-step-card min-w-0">
          <div className="grd-step-label">Step 1 of 2 — Your children</div>
          <div className="grd-step-title">Add each child under 18</div>
          <div className="grd-step-help">
            {option === 'yes_same'
              ? 'Add all children below. On the next step you will choose guardian(s) for all of them.'
              : 'Add all children below. On the next step you will assign a specific guardian to each one.'}
          </div>

          {children.length === 0 && (
            <div className="grd-empty-card">
              <p className="ec-title">No children added yet</p>
              <p className="ec-sub">Click &quot;Add Child&quot; below to get started.</p>
            </div>
          )}

          {children.map((c, i) => (
            <div key={i} className="grd-person-card">
              <div className="grd-person-avatar" aria-hidden>
                {String(i + 1)}
              </div>
              <div className="grd-person-info min-w-0">
                <p className="grd-person-name break-words">
                  {c.childFirstName} {c.childLastName}
                </p>
                <p className="grd-person-detail">DOB: {formatDob(c.dob)}</p>
              </div>
              <div className="flex flex-shrink-0 flex-col gap-1 sm:flex-row">
                <button type="button" className="grd-btn-secondary min-h-[44px] px-3 text-xs" onClick={() => openEditChild(i)}>
                  Edit
                </button>
                <button type="button" className="grd-btn-remove" onClick={() => handleRemoveChild(i)}>
                  Remove
                </button>
              </div>
            </div>
          ))}

          <button type="button" className="grd-btn-add" onClick={openAddChild}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add Child
          </button>

          {children.length > 0 && (
            <div className="grd-save-row">
              <button type="button" className="grd-btn-add w-full sm:w-auto" onClick={() => setStep(2)}>
                Continue — assign guardian{option === 'yes_different' ? 's' : ''} →
              </button>
            </div>
          )}

          {childModal && (
            <ChildModal
              key={childModal.mode === 'edit' ? `child-edit-${childModal.index}` : 'child-add'}
              title={childModal.mode === 'edit' ? 'Edit Child' : 'Add Child'}
              initial={
                childModal.mode === 'edit'
                  ? {
                      childFirstName: children[childModal.index].childFirstName,
                      childLastName: children[childModal.index].childLastName,
                      dob: children[childModal.index].dob,
                    }
                  : null
              }
              onSave={handleSaveChild}
              onClose={closeChildModal}
            />
          )}
        </div>
      )}

      {option === 'yes_same' && step === 2 && (
        <div className="grd-step-card min-w-0">
          <div className="grd-step-label">Step 2 of 2 — Guardian(s)</div>
          <div className="grd-step-title">Who would you like to be your children&apos;s guardian?</div>
          <div className="grd-step-help">
            This should be someone you trust completely to raise your children. You can appoint more than one person.
            These guardian(s) will apply to all {children.length} {children.length === 1 ? 'child' : 'children'} listed.
          </div>

          <div className="grd-panel">
            <p className="grd-panel-title">Applies to</p>
            {children.map((c, i) => (
              <p key={i} className="grd-person-detail mb-1 break-words">
                {c.childFirstName} {c.childLastName} — DOB: {formatDob(c.dob)}
              </p>
            ))}
          </div>

          <div className="grd-panel">
            <p className="grd-panel-title">Who would you like to be your children&apos;s guardian?</p>
            <p className="grd-panel-sub">
              This should be someone you trust completely to raise your children. You can appoint more than one person —
              they will act jointly.
            </p>
            <GuardianList
              guardians={sameGuardians}
              onChange={setSameGuardians}
              addLabel="Add Guardian"
              modalSubtitle="For: Add Guardian"
              formValues={formValuesProp}
            />
          </div>

          <div className="grd-panel">
            <p className="grd-panel-title">Is there a backup guardian if your first choice is unable to act?</p>
            <p className="grd-panel-sub">
              A substitute guardian steps in if your first-choice guardian is unable or unwilling to take on the role.
              Optional but strongly recommended.
            </p>
            <div className="grd-tiles">
              <div className="grd-tile">
                <p className="t-title">Why have a backup?</p>
                <p className="t-sub">Your first choice may predecease you, become ill, or decline the role</p>
              </div>
              <div className="grd-tile">
                <p className="t-title">Who to choose</p>
                <p className="t-sub">Someone who shares your values and could step in at short notice</p>
              </div>
            </div>
            <GuardianList
              guardians={substituteSameGuardians}
              onChange={setSubstituteSameGuardians}
              addLabel="Add Substitute Guardian"
              modalSubtitle="For: Add Substitute Guardian"
              formValues={formValuesProp}
            />
          </div>

          <button type="button" className="grd-btn-secondary min-h-[44px]" onClick={() => setStep(1)}>
            ← Edit children
          </button>
        </div>
      )}

      {option === 'yes_different' && step === 2 && (
        <div className="grd-step-card min-w-0">
          <div className="grd-step-label">Step 2 of 2 — Guardians per child</div>
          <div className="grd-step-title">Assign a guardian to each child</div>
          <div className="grd-step-help">
            For each child below, add the person(s) you would like to be their guardian if both parents passed away.
          </div>

          {children.map((child, i) => (
            <div key={i} className="grd-child-card">
              <div className="grd-child-header">
                <div className="grd-child-header-left min-w-0">
                  <div className="grd-child-number">{i + 1}</div>
                  <span className="grd-child-header-name break-words">
                    {child.childFirstName} {child.childLastName}
                  </span>
                </div>
              </div>
              <div className="grd-child-body">
                <p className="grd-person-detail mb-3">Date of birth: {formatDob(child.dob)}</p>
                <p className="grd-guardian-sub-label">Who would you like to be {child.childFirstName}&apos;s guardian?</p>
                <p className="grd-guardian-empty-msg mb-2">
                  This should be someone you trust completely. You can appoint more than one person.
                </p>
                <GuardianList
                  guardians={child.guardians}
                  onChange={(g) => updateChildGuardians(i, g)}
                  addLabel={`Add Guardian for ${child.childFirstName}`}
                  modalSubtitle={`For: Add Guardian (${child.childFirstName})`}
                  formValues={formValuesProp}
                />
              </div>
            </div>
          ))}

          <button type="button" className="grd-btn-secondary mt-2 min-h-[44px]" onClick={() => setStep(1)}>
            ← Edit children
          </button>
        </div>
      )}

      {option && (
        <div className="grd-save-row">
          <button type="button" className="grd-btn-add w-full sm:w-auto" onClick={handleComplete}>
            {isEmbedded ? 'Save guardians to form →' : 'Save and continue →'}
          </button>
        </div>
      )}
    </div>
  );
}
