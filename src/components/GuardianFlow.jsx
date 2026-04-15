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
 *   guardians: [ { ...personFields } ],        // if yes_same
 *   children: [                                // if yes_different
 *     { childFirstName, childLastName, dob, guardians: [ { ...personFields } ] }
 *   ]
 * }
 *
 * No external dependencies — React (useState) only.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const YES_DIFFERENT = 'Yes, but appoint different guardians for children';

function mapAppointToGuardianFlowOption(appointGuardians) {
  if (appointGuardians === 'No') return 'no';
  if (appointGuardians === 'Yes') return 'yes_same';
  if (appointGuardians === YES_DIFFERENT) return 'yes_different';
  return null;
}

/** Sync with `html.dark-theme` (solicitor shell + client intake). */
function useDocumentDarkTheme() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark-theme') : false
  );
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains('dark-theme'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

// ─── Palettes (light = existing Mariyam spec; dark = slate shell + indigo accents) ──
const PALETTE_LIGHT = {
  indigo: '#4f46e5',
  indigoDark: '#3730a3',
  indigoLight: '#eef2ff',
  indigoBorder: '#c7d2fe',
  indigoMid: '#6366f1',
  textDark: '#111827',
  textMid: '#374151',
  textLight: '#6b7280',
  border: '#e5e7eb',
  inputBg: '#ffffff',
  pageBg: '#f9fafb',
  surface: '#ffffff',
  emptyStateBg: '#dde4fb',
  emptyStateFg: '#4338ca',
  modalOverlay: 'rgba(0,0,0,0.35)',
  modalShadow: '0 8px 40px rgba(0,0,0,0.18)',
  backBtnBg: '#e5e7eb',
  btnOnPrimary: '#ffffff',
  green: '#16a34a',
  red: '#ef4444',
};

const PALETTE_DARK = {
  indigo: '#6366f1',
  indigoDark: '#c7d2fe',
  indigoLight: '#1e293b',
  indigoBorder: '#475569',
  indigoMid: '#a5b4fc',
  textDark: '#f1f5f9',
  textMid: '#cbd5e1',
  textLight: '#94a3b8',
  border: '#475569',
  inputBg: '#0f172a',
  pageBg: '#0f172a',
  surface: '#1e293b',
  emptyStateBg: 'rgba(51, 65, 85, 0.65)',
  emptyStateFg: '#c7d2fe',
  modalOverlay: 'rgba(0,0,0,0.65)',
  modalShadow: '0 16px 48px rgba(0,0,0,0.5)',
  backBtnBg: '#334155',
  btnOnPrimary: '#f8fafc',
  green: '#4ade80',
  red: '#f87171',
};

function buildGuardianFlowStyles(C) {
  const btnText = C.btnOnPrimary;
  return {
    section: {
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      maxWidth: 700,
      margin: '0 auto',
      padding: '32px 24px',
      background: C.pageBg,
      color: C.textDark,
    },
    sectionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    sectionIcon: {
      background: C.indigoLight,
      borderRadius: 8,
      width: 36,
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 18,
    },
    sectionTitle: {
      fontSize: 24,
      fontWeight: 700,
      color: C.textDark,
      margin: 0,
    },
    divider: {
      border: 'none',
      borderTop: `2px solid ${C.indigo}`,
      margin: '0 0 28px 0',
    },
    questionRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 6,
    },
    questionIcon: {
      color: C.indigo,
      fontSize: 18,
      marginTop: 1,
      flexShrink: 0,
    },
    questionText: {
      fontSize: 16,
      fontWeight: 700,
      color: C.textDark,
      margin: 0,
    },
    helpRow: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 20,
    },
    helpIcon: {
      color: C.textLight,
      fontSize: 15,
      flexShrink: 0,
      marginTop: 1,
    },
    helpText: {
      fontSize: 14,
      color: C.textLight,
      fontStyle: 'italic',
      margin: 0,
    },
    radioGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      marginBottom: 28,
    },
    radioLabel: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      fontSize: 15,
      color: C.textDark,
      cursor: 'pointer',
    },
    radio: {
      width: 20,
      height: 20,
      accentColor: C.indigo,
      cursor: 'pointer',
      flexShrink: 0,
    },
    blueCard: {
      background: C.indigoLight,
      border: `2px solid ${C.indigoBorder}`,
      borderRadius: 12,
      padding: '24px 20px',
      marginBottom: 24,
    },
    blueCardTitle: {
      fontSize: 16,
      fontWeight: 700,
      color: C.indigoDark,
      marginBottom: 4,
    },
    blueCardHelp: {
      fontSize: 13,
      color: C.indigoMid,
      fontStyle: 'italic',
      marginBottom: 18,
    },
    emptyState: {
      background: C.emptyStateBg,
      borderRadius: 8,
      padding: '12px 16px',
      fontSize: 14,
      color: C.emptyStateFg,
      marginBottom: 14,
    },
    itemRow: {
      background: C.surface,
      border: `1px solid ${C.indigoBorder}`,
      borderRadius: 8,
      padding: '12px 16px',
      marginBottom: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 14,
      color: C.textMid,
      gap: 8,
    },
    itemActions: {
      display: 'flex',
      gap: 14,
      flexShrink: 0,
    },
    editBtn: {
      color: C.indigoMid,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      padding: 0,
    },
    removeBtn: {
      color: C.red,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: 600,
      padding: 0,
    },
    addedLabel: {
      fontSize: 13,
      fontWeight: 700,
      color: C.green,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    addBtn: {
      background: C.indigo,
      color: btnText,
      border: 'none',
      borderRadius: 8,
      padding: '10px 18px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
    },
    continueBtn: {
      background: C.indigo,
      color: btnText,
      border: 'none',
      borderRadius: 8,
      padding: '11px 24px',
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: 8,
    },
    backBtn: {
      background: C.backBtnBg,
      color: C.textMid,
      border: 'none',
      borderRadius: 8,
      padding: '11px 24px',
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: 8,
      marginRight: 12,
    },
    saveBtn: {
      background: C.indigo,
      color: btnText,
      border: 'none',
      borderRadius: 8,
      padding: '12px 28px',
      fontSize: 15,
      fontWeight: 700,
      cursor: 'pointer',
      marginTop: 4,
    },
    sectionDivider: {
      border: 'none',
      borderTop: `1.5px solid ${C.border}`,
      margin: '24px 0',
    },
    childBlock: {
      background: C.surface,
      border: `1.5px solid ${C.indigoBorder}`,
      borderRadius: 12,
      padding: '20px',
      marginBottom: 20,
    },
    childName: {
      fontSize: 15,
      fontWeight: 700,
      color: C.indigoDark,
      marginBottom: 2,
    },
    childDob: {
      fontSize: 13,
      color: C.textLight,
      marginBottom: 14,
    },
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: C.modalOverlay,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16,
    },
    modalBox: {
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      padding: '28px 24px',
      width: '100%',
      maxWidth: 640,
      boxShadow: C.modalShadow,
      maxHeight: '90vh',
      overflowY: 'auto',
      color: C.textDark,
    },
    modalHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 700,
      color: C.textDark,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      margin: 0,
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: C.textLight,
      fontSize: 20,
      cursor: 'pointer',
      lineHeight: 1,
      padding: 0,
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
      gap: '16px 20px',
    },
    formGridFull: {
      gridColumn: '1 / -1',
    },
    fieldGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    },
    fieldLabel: {
      fontSize: 13,
      fontWeight: 600,
      color: C.textMid,
    },
    fieldInput: {
      width: '100%',
      padding: '9px 12px',
      border: `1.5px solid ${C.border}`,
      borderRadius: 8,
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
      background: C.inputBg,
      color: C.textDark,
      transition: 'border-color 0.15s',
    },
    fieldSelect: {
      width: '100%',
      padding: '9px 12px',
      border: `1.5px solid ${C.border}`,
      borderRadius: 8,
      fontSize: 14,
      outline: 'none',
      boxSizing: 'border-box',
      background: C.inputBg,
      color: C.textDark,
      cursor: 'pointer',
    },
    modalActions: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 28,
    },
    modalCancelBtn: {
      background: C.surface,
      color: C.textMid,
      border: `1.5px solid ${C.border}`,
      borderRadius: 8,
      padding: '10px 20px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
    },
    modalApplyBtn: {
      background: C.indigo,
      color: btnText,
      border: 'none',
      borderRadius: 8,
      padding: '10px 20px',
      fontSize: 14,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
    },
    requiredNote: {
      fontSize: 12,
      color: C.textLight,
      marginTop: 14,
    },
  };
}

const DEFAULT_THEME = { C: PALETTE_LIGHT, S: buildGuardianFlowStyles(PALETTE_LIGHT) };
const GuardianFlowThemeContext = createContext(DEFAULT_THEME);

function useGuardianFlowTheme() {
  return useContext(GuardianFlowThemeContext);
}

const emptyPerson = {
  title: '',
  firstName: '',
  middleNames: '',
  lastName: '',
  addressLine1: '',
  addressLine2: '',
  town: '',
  postcode: '',
  dob: '',
  gender: '',
  occupation: '',
  relationship: '',
  mobile: '',
  email: '',
};

function PersonModal({ modalTitle, initial, onSave, onClose }) {
  const { S } = useGuardianFlowTheme();
  const [form, setForm] = useState(initial ? { ...initial } : { ...emptyPerson });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const isValid =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.addressLine1.trim() &&
    form.town.trim() &&
    form.postcode.trim();

  const Field = ({ label, field, placeholder, type = 'text', fullWidth = false, required = false }) => (
    <div style={{ ...S.fieldGroup, ...(fullWidth ? S.formGridFull : {}) }}>
      <label style={S.fieldLabel}>
        {label}
        {required ? ' *' : ''}
      </label>
      <input
        style={S.fieldInput}
        type={type}
        placeholder={placeholder}
        value={form[field]}
        onChange={set(field)}
      />
    </div>
  );

  return (
    <div style={S.modalOverlay} role="presentation" onClick={onClose}>
      <div style={S.modalBox} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={S.modalTitle}>👤 {modalTitle}</h3>
          <button type="button" style={S.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={S.formGrid}>
          <Field label="Title" field="title" placeholder="e.g. Mr, Ms, Dr" />
          <Field label="First name" field="firstName" placeholder="e.g. John" required />
          <Field label="Middle name(s)" field="middleNames" placeholder="Leave blank if not applicable" />
          <Field label="Last name" field="lastName" placeholder="e.g. Smith" required />
          <Field label="Address line 1" field="addressLine1" placeholder="House number and street" required />
          <Field label="Address line 2" field="addressLine2" placeholder="Flat, building name, or area" />
          <Field label="Town / city" field="town" placeholder="Town or city" required />
          <Field label="Postcode" field="postcode" placeholder="e.g. SW1A 1AA" required />
          <Field label="Date of birth" field="dob" placeholder="DD/MM/YYYY" />
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>Gender</label>
            <select style={S.fieldSelect} value={form.gender} onChange={set('gender')}>
              <option value="">Select...</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non_binary">Non-binary</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </div>
          <Field label="Occupation" field="occupation" placeholder="e.g. Teacher, Retired" />
          <Field label="Relationship to you" field="relationship" placeholder="e.g. Friend, sibling, child" />
          <Field label="Mobile" field="mobile" placeholder="e.g. 07700 900000" />
          <Field label="Email" field="email" placeholder="e.g. john.smith@example.com" type="email" />
        </div>

        <div style={S.requiredNote}>* Required fields</div>

        <div style={S.modalActions}>
          <button type="button" style={S.modalCancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...S.modalApplyBtn, opacity: isValid ? 1 : 0.45, cursor: isValid ? 'pointer' : 'not-allowed' }}
            disabled={!isValid}
            onClick={() => onSave(form)}
          >
            💾 Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}

function ChildModal({ title, initial, onSave, onClose }) {
  const { S } = useGuardianFlowTheme();
  const [form, setForm] = useState(initial || { childFirstName: '', childLastName: '', dob: '' });
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const isValid = form.childFirstName.trim() && form.childLastName.trim() && form.dob.trim();

  return (
    <div style={S.modalOverlay} role="presentation" onClick={onClose}>
      <div style={S.modalBox} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHeader}>
          <h3 style={S.modalTitle}>{title || 'Add Child'}</h3>
          <button type="button" style={S.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={S.formGrid}>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>First name(s) including middle names *</label>
            <input
              style={S.fieldInput}
              placeholder="e.g. Emily Rose"
              value={form.childFirstName}
              onChange={set('childFirstName')}
            />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.fieldLabel}>Last name / Surname *</label>
            <input
              style={S.fieldInput}
              placeholder="e.g. Smith"
              value={form.childLastName}
              onChange={set('childLastName')}
            />
          </div>
          <div style={{ ...S.fieldGroup, ...S.formGridFull }}>
            <label style={S.fieldLabel}>Date of birth *</label>
            <input style={S.fieldInput} placeholder="DD/MM/YYYY" value={form.dob} onChange={set('dob')} />
          </div>
        </div>

        <div style={S.requiredNote}>* Required fields</div>

        <div style={S.modalActions}>
          <button type="button" style={S.modalCancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...S.modalApplyBtn, opacity: isValid ? 1 : 0.45, cursor: isValid ? 'pointer' : 'not-allowed' }}
            disabled={!isValid}
            onClick={() => onSave(form)}
          >
            💾 Apply changes
          </button>
        </div>
      </div>
    </div>
  );
}

function GuardianList({ guardians, onChange, addLabel = 'Add Guardian' }) {
  const { S } = useGuardianFlowTheme();
  const [modal, setModal] = useState(null);

  const openAdd = () => setModal({ mode: 'add' });
  const openEdit = (i) => setModal({ mode: 'edit', index: i });
  const closeModal = () => setModal(null);

  const handleSave = (formData) => {
    if (modal.mode === 'add') {
      onChange([...guardians, formData]);
    } else {
      const updated = [...guardians];
      updated[modal.index] = formData;
      onChange(updated);
    }
    closeModal();
  };

  const handleRemove = (i) => onChange(guardians.filter((_, idx) => idx !== i));

  const displayName = (g) => [g.title, g.firstName, g.middleNames, g.lastName].filter(Boolean).join(' ');

  return (
    <>
      {guardians.length === 0 && <div style={S.emptyState}>No guardian has been specified.</div>}

      {guardians.length > 0 && (
        <>
          <div style={S.addedLabel}>✅ Added ({guardians.length}):</div>
          {guardians.map((g, i) => (
            <div key={i} style={S.itemRow}>
              <span className="min-w-0 break-words">
                <strong>{displayName(g)}</strong>
                {g.addressLine1 && ` — ${g.addressLine1}, ${g.town}, ${g.postcode}`}
              </span>
              <div style={S.itemActions}>
                <button type="button" style={S.editBtn} onClick={() => openEdit(i)}>
                  ✏️ Edit
                </button>
                <button type="button" style={S.removeBtn} onClick={() => handleRemove(i)}>
                  🗑 Remove
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <button type="button" style={S.addBtn} onClick={openAdd}>
        + {addLabel}
      </button>

      {modal && (
        <PersonModal
          modalTitle={modal.mode === 'add' ? 'Add Guardian' : 'Edit Guardian'}
          initial={modal.mode === 'edit' ? guardians[modal.index] : null}
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
}) {
  const isEmbedded = variant === 'embedded';
  const embeddedOption = useMemo(
    () => (isEmbedded ? mapAppointToGuardianFlowOption(appointGuardiansValue) : null),
    [isEmbedded, appointGuardiansValue]
  );

  const [standaloneOption, setStandaloneOption] = useState(null);
  const [sameGuardians, setSameGuardians] = useState([]);
  const [children, setChildren] = useState([]);
  const [childModal, setChildModal] = useState(null);
  const [childrenConfirmed, setChildrenConfirmed] = useState(false);
  const hydratedKeyRef = useRef('');

  const option = isEmbedded ? embeddedOption : standaloneOption;

  const dark = useDocumentDarkTheme();
  const theme = useMemo(() => {
    const C = dark ? PALETTE_DARK : PALETTE_LIGHT;
    return { C, S: buildGuardianFlowStyles(C) };
  }, [dark]);

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
    () => ({ sameGuardians, children, childrenConfirmed }),
    [sameGuardians, children, childrenConfirmed]
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
      if (typeof snap.childrenConfirmed === 'boolean') {
        setChildrenConfirmed(snap.childrenConfirmed);
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
    if (embeddedOption !== 'yes_different') {
      queueMicrotask(() => setChildrenConfirmed(false));
    }
  }, [isEmbedded, embeddedOption]);

  const handleComplete = () => {
    const flow = { sameGuardians, children, childrenConfirmed };
    if (option === 'no') {
      onComplete?.({ guardianOption: 'no', _flowState: { sameGuardians: [], children: [], childrenConfirmed: false } });
    } else if (option === 'yes_same') {
      onComplete?.({ guardianOption: 'yes_same', guardians: sameGuardians, _flowState: flow });
    } else if (option === 'yes_different') {
      onComplete?.({ guardianOption: 'yes_different', children, _flowState: flow });
    }
  };

  return (
    <GuardianFlowThemeContext.Provider value={theme}>
    <div style={theme.S.section} className="min-w-0">
      <div style={theme.S.sectionHeader}>
        <div style={theme.S.sectionIcon}>📄</div>
        <h2 style={theme.S.sectionTitle}>{isEmbedded ? 'Guardian details' : 'Guardians'}</h2>
      </div>
      <hr style={theme.S.divider} />

      {!isEmbedded && (
        <>
          <div style={theme.S.questionRow}>
            <span style={theme.S.questionIcon}>✏️</span>
            <p style={theme.S.questionText}>Do you have children under 18 that you would like to appoint a guardian for?</p>
          </div>
          <div style={theme.S.helpRow}>
            <span style={theme.S.helpIcon}>ℹ️</span>
            <p style={theme.S.helpText}>
              A guardian is someone who would take legal responsibility for your children if both parents passed away.
            </p>
          </div>

          <div style={theme.S.radioGroup}>
            {[
              { value: 'no', label: 'No' },
              { value: 'yes_same', label: 'Yes' },
              {
                value: 'yes_different',
                label: 'Yes, but I want to appoint different guardians for different children',
              },
            ].map((opt) => (
              <label key={opt.value} style={theme.S.radioLabel}>
                <input
                  type="radio"
                  style={theme.S.radio}
                  name="guardianOption"
                  value={opt.value}
                  checked={standaloneOption === opt.value}
                  onChange={() => {
                    setStandaloneOption(opt.value);
                    setChildrenConfirmed(false);
                  }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </>
      )}

      {isEmbedded && embeddedOption && (
        <p style={{ ...theme.S.helpText, marginBottom: 18, fontStyle: 'normal', color: theme.C.textMid }}>
          Add the people you want as guardian(s). Your answer to the question above controls which steps you see.
        </p>
      )}

      {option === 'yes_same' && (
        <div style={theme.S.blueCard}>
          <div style={theme.S.blueCardTitle}>Who would you like to be your children&apos;s guardian?</div>
          <div style={theme.S.blueCardHelp}>
            This should be someone you trust completely to raise your children. You can appoint more than one person.
          </div>
          <GuardianList guardians={sameGuardians} onChange={setSameGuardians} />
        </div>
      )}

      {option === 'yes_different' && !childrenConfirmed && (
        <div style={theme.S.blueCard}>
          <div style={theme.S.blueCardTitle}>Tell us about your children under 18</div>
          <div style={theme.S.blueCardHelp}>
            Please add each child below. You will then be able to assign a specific guardian to each one.
          </div>

          {children.length === 0 && <div style={theme.S.emptyState}>No children have been added yet.</div>}

          {children.length > 0 && (
            <>
              <div style={theme.S.addedLabel}>✅ Added ({children.length}):</div>
              {children.map((c, i) => (
                <div key={i} style={theme.S.itemRow}>
                  <span className="min-w-0 break-words">
                    {c.childFirstName} {c.childLastName} — DOB: {c.dob}
                  </span>
                  <div style={theme.S.itemActions}>
                    <button type="button" style={theme.S.editBtn} onClick={() => openEditChild(i)}>
                      ✏️ Edit
                    </button>
                    <button type="button" style={theme.S.removeBtn} onClick={() => handleRemoveChild(i)}>
                      🗑 Remove
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          <button type="button" style={theme.S.addBtn} onClick={openAddChild}>
            + Add Child
          </button>

          {children.length > 0 && (
            <>
              <hr style={theme.S.sectionDivider} />
              <button type="button" style={theme.S.continueBtn} onClick={() => setChildrenConfirmed(true)}>
                Continue — assign guardians →
              </button>
            </>
          )}

          {childModal && (
            <ChildModal
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

      {option === 'yes_different' && childrenConfirmed && (
        <div className="min-w-0">
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4, color: theme.C.textDark }}>
            Now assign a guardian to each child
          </div>
          <div style={{ fontSize: 14, color: theme.C.textLight, fontStyle: 'italic', marginBottom: 20 }}>
            For each child below, add the person(s) you would like to be their guardian if both parents passed away.
          </div>

          {children.map((child, i) => (
            <div key={i} style={theme.S.childBlock}>
              <div style={theme.S.childName}>
                {child.childFirstName} {child.childLastName}
              </div>
              <div style={theme.S.childDob}>Date of birth: {child.dob}</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: theme.C.textMid }}>
                Who would you like to be {child.childFirstName}&apos;s guardian?
              </div>
              <div style={{ fontSize: 12, color: theme.C.textLight, fontStyle: 'italic', marginBottom: 14 }}>
                This should be someone you trust completely. You can appoint more than one person.
              </div>
              <GuardianList
                guardians={child.guardians}
                onChange={(g) => updateChildGuardians(i, g)}
                addLabel={`Add Guardian for ${child.childFirstName}`}
              />
            </div>
          ))}

          <button type="button" style={theme.S.backBtn} onClick={() => setChildrenConfirmed(false)}>
            ← Edit children
          </button>
        </div>
      )}

      {option && (
        <>
          <hr style={theme.S.sectionDivider} />
          <button type="button" style={theme.S.saveBtn} onClick={handleComplete} className="min-h-[44px]">
            {isEmbedded ? 'Save guardians to form →' : 'Save and continue →'}
          </button>
        </>
      )}
    </div>
    </GuardianFlowThemeContext.Provider>
  );
}
