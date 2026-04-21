/*
 * 🎯 COMPREHENSIVE FIELD INTERACTION LOGGING
 * 
 * This FieldRenderer component includes detailed console logging for every field interaction:
 * 
 * 🔧 FIELD LIFECYCLE:
 * - [FIELD RENDER] - Every field render with ID, label, type, required status, current value
 * - [FIELD SHOWN/HIDDEN] - Field visibility based on conditional logic
 * - [TEXT FIELD] / [RADIO FIELD] / [CHECKBOX GROUP] / [SIGNATURE FIELD] etc. - Field type specific initialization
 * 
 * 🎯 USER INTERACTIONS:
 * - [QUESTION CHANGE] - All form value changes with comprehensive field details
 * - [RADIO SELECTION] - Radio option selections with previous and new values
 * - [CHECKBOX CHANGE] / [CHECKBOX RESULT] - Individual checkbox changes and final array state
 * - [TEXT INPUT] - Text input changes and blur events with validation context
 * - [TEXTAREA] - Textarea changes with character count tracking
 * - [DATE PICKER] - Date selections with ISO conversion and validation
 * - [SIGNATURE] - Signature drawing completion with data URL generation details
 * - [SIGNATURE CLEAR] - Signature clearing events
 * 
 * 🎯 DYNAMIC LIST MANAGEMENT:
 * - [ADD BUTTON FIELD] - Add button initialization with target field mapping
 * - [ADD BUTTON CLICK] - Opening input forms for dynamic lists
 * - [ADD ITEM BUTTON] - Adding items to dynamic lists with item details
 * - [REMOVE ITEM] - Removing items from lists with index and item details
 * 
 * ✅ CONDITIONAL LOGIC:
 * - [CONDITION CHECK] - Field condition evaluation with clause details
 * - [CONDITION RESULT] - Final visibility determination results
 * 
 * 🎪 SPECIAL FIELD TYPES:
 * - [DISPLAY FIELD] - Display-only field rendering with text preview
 * - [SECTION FIELD] - Section field rendering with subfield count
 * - [ADD BUTTON FIELD] - Dynamic add button field setup
 * 
 * All logs include field IDs, labels, types, values, and relevant context for comprehensive debugging!
 */

const DEBUG_LOGS = import.meta.env.VITE_DEBUG_FIELD_RENDERER === 'true';

import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Check, User, Mail, Phone, MapPin, Calendar, FileText, Edit, Trash2, PenTool, Info, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import {
  validateUKPostcode,
  formatUKPostcode,
  validateUKPhoneNumber,
  formatUKPhoneNumber,
  formatUKDate,
  ukDateToISO,
  getUKAddressExample,
} from '../utils/ukValidations';
import ExcludedPersonAddBlock from './ExcludedPersonAddBlock.jsx';
import AddPersonButtonField from './AddPersonButtonField.jsx';
import ExecutorIndividualAgeFlow from './ExecutorIndividualAgeFlow.jsx';
import { toast } from 'sonner';
import GuardianFlow from './GuardianFlow.jsx';
import BusinessInterestsGuided from './BusinessInterestsGuided.jsx';
import { getAristoneEstateRecommendationState } from '../constants/clientMode.js';
import { mapGuardianFlowCompletionToFormValues } from '../utils/guardianFlowSync.js';

let _datePickerPromise;
async function loadDatePicker() {
  if (_datePickerPromise) return _datePickerPromise;
  _datePickerPromise = (async () => {
    // Load styles only when the date picker is actually used (keeps initial CSS smaller).
    await import('react-datepicker/dist/react-datepicker.css');
    const dp = await import('react-datepicker');
    // Import only the single locale we need (avoids bundling every locale).
    const locale = await import('date-fns/locale/en-GB');
    // Register locale once (idempotent in practice)
    dp.registerLocale('en-GB', locale.enGB);
    dp.setDefaultLocale('en-GB');
    return dp.default;
  })();
  return _datePickerPromise;
}

const LazyDatePicker = React.lazy(async () => {
  const Comp = await loadDatePicker();
  return { default: Comp };
});

const LazySignaturePad = React.lazy(() => import('./SignaturePad.jsx'));

function FieldRenderer({ field, formValues, setFormValues, evaluateFieldConditions }) {
  
  const [validationErrors, setValidationErrors] = useState({});
  const [dateInputValue, setDateInputValue] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState({});
  const [datePickerManualValue, setDatePickerManualValue] = useState({});
  const sigPadRef = useRef({});
  const textInputRef = useRef(null);
  const sigContainerRef = useRef(null);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [modalSignature, setModalSignature] = useState('');
  const signatureModalRef = useRef(null);

  const dateFieldId = field?.type === 'date' ? field.id : null;
  const dateFormValue = dateFieldId != null ? (formValues[dateFieldId] ?? '') : '';
  const currentDisplayValue = useMemo(() => {
    if (dateFieldId == null) return '';
    if (!dateFormValue) return '';
    const s = String(dateFormValue);
    if (s.match(/^\d{4}-\d{2}-\d{2}$/)) return formatUKDate(s);
    const isoDate = ukDateToISO(s);
    if (isoDate) return formatUKDate(isoDate);
    return s;
  }, [dateFieldId, dateFormValue]);

  useEffect(() => {
    if (field?.type !== 'date') return;
    if (dateInputValue !== currentDisplayValue) {
      setDateInputValue(currentDisplayValue);
    }
  }, [field?.type, currentDisplayValue, dateInputValue]);

  useEffect(() => {
    if (field?.type !== 'signature') {
      setSignatureModalOpen(false);
      setModalSignature('');
    }
  }, [field?.type, field?.id]);

  useEffect(() => {
    if (field?.type !== 'signature' || !signatureModalOpen) return;
    signatureModalRef.current?.focus();
    const onEsc = (e) => {
      if (e.key === 'Escape') setSignatureModalOpen(false);
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [field?.type, signatureModalOpen]);

  // When any date picker modal is open, lock body scroll so the overlay covers the viewport
  useEffect(() => {
    const isOpen = Object.values(datePickerOpen).some(Boolean);
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [datePickerOpen]);

  // Sync text input values when formValues change (for uncontrolled inputs)
  useEffect(() => {
    if (field?.type === 'text' && textInputRef.current) {
      const expectedValue = formValues[field.id] || '';
      const actualValue = textInputRef.current.value;
      if (expectedValue !== actualValue) {
        textInputRef.current.value = expectedValue;
      }
    }
  }, [formValues, field?.id, field?.type]);

  // Icon mapping for field types
  const getFieldIcon = (fieldType, fieldId) => {
    if (fieldId?.toLowerCase().includes('email')) return <Mail size={16} />;
    if (fieldId?.toLowerCase().includes('phone') || fieldId?.toLowerCase().includes('mobile') || fieldId?.toLowerCase().includes('tel')) return <Phone size={16} />;
    if (fieldId?.toLowerCase().includes('address') || fieldId?.toLowerCase().includes('postcode')) return <MapPin size={16} />;
    if (fieldType === 'date') return <Calendar size={16} />;
    if (fieldType === 'signature') return <PenTool size={16} />;
    if (fieldType === 'textarea') return <FileText size={16} />;
    if (fieldId?.toLowerCase().includes('name')) return <User size={16} />;
    return <Edit size={16} />;
  };

  // Helper function to log form value changes (comprehensive logging)
  const logFormChange = (fieldId, value) => {
    // Detect if we're replacing a "test test test" placeholder
    const previousValue = formValues[fieldId];
    const isReplacingTest = previousValue && typeof previousValue === 'string' && 
      (previousValue.toLowerCase().includes('test test test') || 
       previousValue.toLowerCase().includes('test test') ||
       previousValue.toLowerCase().trim() === 'test') &&
      value && typeof value === 'string' &&
      !value.toLowerCase().includes('test test test');
    
    if (isReplacingTest) {
      DEBUG_LOGS&&console.log(`[QUESTION CHANGE] ✅✅✅ PLACEHOLDER REPLACED! Field "${fieldId}" - Replaced "${previousValue.substring(0, 80)}..." with "${value.substring(0, 80)}..."`);
    }
    
    // Warn if new value still contains "test test test"
    if (value && typeof value === 'string' && value.toLowerCase().includes('test test test')) {
      DEBUG_LOGS&&console.warn(`[QUESTION CHANGE] ⚠️  WARNING: Field "${fieldId}" still contains "test test test"! Value: "${value.substring(0, 100)}"`);
    }
    // Log all form changes for debugging
    DEBUG_LOGS&&console.log(`[QUESTION CHANGE] Field "${fieldId}" (${field.label}) changed to:`, value);
    
    // Only log errors for corrupted data
    if (typeof value === 'number' && (!isFinite(value) || Math.abs(value) >= 1e10 || isNaN(value))) {
      console.error(`[FORM] Invalid number in field "${fieldId}":`, value);
    } else if (typeof value === 'string' && (value.includes('-1.8e+') || value.includes('1.8e+22'))) {
      console.error(`[FORM] Corrupted data in field "${fieldId}"`);
    }
  };

  /** Fallback when `evaluateFieldConditions` is not passed (tests / rare paths). Keep in sync with FormRenderer. */
  const evaluateConditions = (fieldToCheck) => {
    const conditions = fieldToCheck?.conditions;
    if (!conditions) return true;

    DEBUG_LOGS&&console.log(`[CONDITION CHECK] Evaluating conditions for field "${fieldToCheck.id}" (${fieldToCheck.label}):`, conditions);

    const evalClause = (clause) => {
      if (!clause) return false;
      if ((clause.operator === 'AND' || clause.operator === 'OR') && clause.clauses) {
        const results = clause.clauses.map(evalClause);
        return clause.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
      }
      if (!clause.field) return false;
      const value = formValues[clause.field];
      DEBUG_LOGS&&console.log(`[CONDITION] Checking clause - Field: ${clause.field}, Value: ${value}, Expected: ${clause.value}, Operator: ${clause.operator}`);

      if (clause.operator === 'eq') return value === clause.value;
      if (clause.operator === 'ne') return value !== clause.value;
      if (clause.operator === 'includes') {
        return Array.isArray(value) && value.includes(clause.value);
      }
      if (clause.operator === 'in') return Array.isArray(clause.value) ? clause.value.includes(value) : value === clause.value;
      if (clause.operator === 'arrayLengthGte') {
        return Array.isArray(value) && value.length >= Number(clause.value ?? 0);
      }
      return false;
    };

    const result = Array.isArray(conditions)
      ? (fieldToCheck?.conditionLogic === 'OR' ? conditions.some(evalClause) : conditions.every(evalClause))
      : evalClause(conditions);

    DEBUG_LOGS&&console.log(`[CONDITION RESULT] Field "${fieldToCheck.id}" condition result:`, result);
    return result;
  };

  const passesFieldConditions = (fieldToCheck) => {
    if (!fieldToCheck?.conditions) return true;
    if (typeof evaluateFieldConditions === 'function') {
      return evaluateFieldConditions(fieldToCheck);
    }
    return evaluateConditions(fieldToCheck);
  };

  if (field.conditions && !passesFieldConditions(field)) {
    if (field.id === 'executorIndividualAgeFlow') {
      console.log('[EXECUTOR_AGE_DEBUG] FieldRenderer return null (conditions not met)', {
        fieldId: field.id,
        passesFieldConditions: false,
      });
    }
    DEBUG_LOGS&&console.log(`[FIELD HIDDEN] Field "${field.id}" (${field.label}) hidden due to conditions not met`);
    return null;
  } else if (field.conditions) {
    DEBUG_LOGS&&console.log(`[FIELD SHOWN] Field "${field.id}" (${field.label}) shown - conditions met`);
  } else {
    DEBUG_LOGS&&console.log(`[FIELD SHOWN] Field "${field.id}" (${field.label}) shown - no conditions`);
  }

  
  if (field.type === 'button' && field.action === 'openAddForm') {
    const rawTarget = field.id.replace(/^add/i, '').replace(/Button$/i, 'Data');
    const targetFieldId = rawTarget.charAt(0).toLowerCase() + rawTarget.slice(1);
    if (targetFieldId === 'excludedPersonData') {
      return <ExcludedPersonAddBlock field={field} formValues={formValues} setFormValues={setFormValues} />;
    }
    return <AddPersonButtonField field={field} formValues={formValues} setFormValues={setFormValues} />;
  }

  if (field.type === 'businessInterestsGuided') {
    return (
      <div className="min-w-0 max-w-full overflow-x-hidden relative z-[1] isolate">
        <BusinessInterestsGuided formValues={formValues} setFormValues={setFormValues} />
      </div>
    );
  }

  if (field.type === 'guardianFlow') {
    const initialFlowState = (() => {
      const raw = formValues.guardianFlowState;
      if (!raw || typeof raw !== 'string') return null;
      try {
        const o = JSON.parse(raw);
        return o && typeof o === 'object' ? o : null;
      } catch {
        return null;
      }
    })();

    return (
      <div className="guardian-flow-embed rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 p-2 sm:p-3 min-w-0 max-w-full overflow-x-hidden">
        {field.label ? (
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2 break-words">{field.label}</p>
        ) : null}
        {field.infoText ? (
          <p className="text-xs text-slate-600 dark:text-slate-300 mb-3 italic break-words">{field.infoText}</p>
        ) : null}
        <GuardianFlow
          variant="embedded"
          formValues={formValues}
          appointGuardiansValue={formValues.appointGuardians}
          initialFlowState={initialFlowState}
          onFlowStateChange={(state) => {
            setFormValues((prev) => ({
              ...prev,
              guardianFlowState: JSON.stringify(state),
            }));
          }}
          onComplete={(data) => {
            const patch = mapGuardianFlowCompletionToFormValues(data, { skipAppointGuardians: true });
            const flow = data._flowState || { sameGuardians: [], children: [], step: 1 };
            setFormValues((prev) => ({
              ...prev,
              ...patch,
              guardianFlowState: JSON.stringify(flow),
            }));
            toast.success('Guardian details saved', {
              description: 'Your answers are stored in this draft. You can change them anytime before finishing.',
            });
          }}
        />
      </div>
    );
  }

  if (field.type === 'text' || field.type === 'number' || field.type === 'currency') {
    DEBUG_LOGS&&console.log(`[TEXT FIELD] Field "${field.id}" (${field.label}) - Type: ${field.type}, Required: ${field.required}`);
    // UK-specific field handling
    const isPostcode = field.id === 'postcode' || field.id.toLowerCase().includes('postcode');
    const isPhone = field.id === 'mobile' || field.id === 'tel2' || field.id.toLowerCase().includes('phone') || field.id.toLowerCase().includes('tel');
    const isEmail = field.id === 'email' || field.id.toLowerCase().includes('email');
    const isName = field.id === 'firstName' || field.id === 'lastName' || field.id === 'middleName' || field.id.toLowerCase().includes('name');
    
    const validateEmail = (email) => {
      if (!email) return true; // Empty is okay, required validation handles that
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    };
    
    const validateName = (name) => {
      if (!name) return true; // Empty is okay, required validation handles that
      // Name should be at least 2 characters, contain letters, spaces, hyphens, apostrophes
      const nameRegex = /^[a-zA-Z\s\-']+$/;
      if (name.length < 2) return false;
      if (!nameRegex.test(name)) return false;
      return true;
    };
    
    const handleChange = (e) => {
      let value = e.target.value;
      const isBlur = e.type === 'blur';
      
      DEBUG_LOGS&&console.log(`[TEXT INPUT] Field "${field.id}" (${field.label}) - ${isBlur ? 'BLUR' : 'CHANGE'} event - Value: "${value}"`);
      
      // Special feedback for partner name field
      if (field.id === 'partnerFullName' && value.trim() && isBlur) {
        DEBUG_LOGS&&console.log(`[PARTNER NAME] Partner name saved: "${value.trim()}" - This will update the summary below automatically!`);
        // Show success message for partner name
        if (typeof window !== 'undefined' && window.showPartnerNameSuccess) {
          window.showPartnerNameSuccess(value.trim());
        }
      }
      
      // Immediately update form state to ensure React and DOM stay in sync
      logFormChange(field.id, value);
      setFormValues((prev) => ({ ...prev, [field.id]: value }));
      
      // Clear previous errors on change (validate on blur)
      if (!isBlur) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field.id];
          return newErrors;
        });
      }
      
      // Format and validate postcode
      if (isPostcode) {
        if (isBlur) {
          const formatted = formatUKPostcode(value);
          if (formatted && formatted !== value) {
            value = formatted;
          }
          // Validate postcode
          if (value && !validateUKPostcode(value)) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid UK postcode (e.g., SW1A 1AA or M1 1AA)' }));
          } else if (field.required && !value) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter a postcode.' }));
          } else {
            setValidationErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors[field.id];
              return newErrors;
            });
          }
        }
      }
      
      // Format and validate phone number
      if (isPhone) {
        if (isBlur) {
          const formatted = formatUKPhoneNumber(value);
          if (formatted && formatted !== value) {
            value = formatted;
          }
          // Validate phone number
          if (value && !validateUKPhoneNumber(value)) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid UK phone number (e.g., 07123 456789 for mobile or 020 1234 5678 for landline)' }));
          } else if (field.required && !value) {
            setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter a phone number.' }));
          } else {
            setValidationErrors((prev) => {
              const newErrors = { ...prev };
              delete newErrors[field.id];
              return newErrors;
            });
          }
        }
      }
      
      // Validate email
      if (isEmail && isBlur) {
        if (value && !validateEmail(value)) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid email address (e.g., name@example.com)' }));
        } else if (field.required && !value) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter an email address.' }));
        } else {
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field.id];
            return newErrors;
          });
        }
      }
      
      // Validate name fields
      if (isName && isBlur) {
        if (value && !validateName(value)) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'Please enter a valid name (letters only, at least 2 characters)' }));
        } else if (field.required && !value) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please enter a name.' }));
        } else {
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field.id];
            return newErrors;
          });
        }
      }
      
      // Validate required fields (generic)
      if (!isPostcode && !isPhone && !isEmail && !isName && isBlur) {
        if (field.required && !value.trim()) {
          setValidationErrors((prev) => ({ ...prev, [field.id]: `This field is required. Please enter ${field.label.toLowerCase()}.` }));
        } else {
          setValidationErrors((prev) => {
            const newErrors = { ...prev };
            delete newErrors[field.id];
            return newErrors;
          });
        }
      }
      
      // Note: We already updated formValues at the beginning of handleChange
      // to ensure immediate synchronization between React state and DOM
    };

    // Get UK-specific or field-specific placeholder
    let placeholder = field.placeholder || '';
    if (field.id === 'knownAs' && !placeholder) {
      placeholder = 'e.g. maiden name or name commonly used';
    } else if (field.id === 'alias' && !placeholder) {
      placeholder = 'e.g. nickname or other name used';
    } else if (isPostcode && !placeholder) {
      placeholder = 'e.g., SW1A 1AA';
    } else if (isPhone && !placeholder) {
      // UK phone number formats: Mobile 07123 456789, London 020 1234 5678, Other 0117 123 4567
      placeholder = field.id === 'mobile' ? 'e.g., 07123 456789' : 'e.g., 020 1234 5678';
    }

    const FieldIcon = getFieldIcon(field.type, field.id);
    
    return (
      <div className="mb-4 sm:mb-5 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
            {FieldIcon}
          </div>
          <span className="break-words">{field.label}</span>
          {field.required && <span className="text-red-500 ml-1 flex-shrink-0" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-0">
            {FieldIcon}
          </div>
          <input
            type={field.type === 'currency' ? 'text' : field.type}
            placeholder={placeholder}
            className={`w-full border rounded-xl pl-10 pr-10 py-2.5 sm:py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 bg-white transition-all duration-300 shadow-sm focus:shadow-md relative z-10 min-h-[44px] ${
              validationErrors[field.id] 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : formValues[field.id] && !validationErrors[field.id] && field.required
                ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-300'
            }`}
            aria-label={field.label}
            aria-required={field.required}
            aria-invalid={!!validationErrors[field.id]}
            aria-describedby={validationErrors[field.id] ? `${field.id}-error` : field.infoText ? `${field.id}-info` : undefined}
            id={field.id}
            defaultValue={formValues[field.id] || ''}
            onChange={handleChange}
            onBlur={handleChange}
            disabled={false}
            readOnly={false}
          />
          {/* Validation feedback icons */}
          {formValues[field.id] && !validationErrors[field.id] && field.required && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 z-20 pointer-events-none">
              <CheckCircle2 size={18} className="animate-fadeIn" />
            </div>
          )}
          {validationErrors[field.id] && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 z-20 pointer-events-none">
              <AlertCircle size={18} />
            </div>
          )}
        </div>
        {validationErrors[field.id] && (
          <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5 flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
        {isPostcode && !validationErrors[field.id] && (
          <p className="text-xs text-gray-500 mt-1.5">UK postcode format (e.g., SW1A 1AA, M1 1AA)</p>
        )}
        {isPhone && !validationErrors[field.id] && (
          <p className="text-xs text-gray-500 mt-1.5">UK phone number format: mobile 07123 456789, landline 020 1234 5678</p>
        )}
      </div>
    );
  }

  if (field.type === 'textarea') {
    DEBUG_LOGS&&console.log(`[TEXTAREA FIELD] Field "${field.id}" (${field.label}) - Required: ${field.required}, Rows: ${field.rows || 4}`);
    const FieldIcon = getFieldIcon(field.type, field.id);
    
    const handleTextareaChange = (e) => {
      const value = e.target.value;
      const isBlur = e.type === 'blur';
      const previousValue = formValues[field.id] || '';
      
      // Detect if "test test test" placeholder is being replaced
      const hasTestPlaceholder = previousValue && (
        previousValue.toLowerCase().includes('test test test') ||
        previousValue.toLowerCase().includes('test test') ||
        previousValue.toLowerCase().trim() === 'test'
      );
      
      if (hasTestPlaceholder && value && !value.toLowerCase().includes('test test test')) {
        DEBUG_LOGS&&console.log(`[TEXTAREA] ✅✅✅ PLACEHOLDER REPLACED! Field "${field.id}" - Replaced "${previousValue.substring(0, 50)}..." with "${value.substring(0, 50)}..."`);
      }
      
      DEBUG_LOGS&&console.log(`[TEXTAREA] Field "${field.id}" (${field.label}) - ${isBlur ? 'BLUR' : 'CHANGE'} event - Value length: ${value.length} chars`);
      if (value.toLowerCase().includes('test test')) {
        DEBUG_LOGS&&console.warn(`[TEXTAREA] ⚠️  WARNING: Field "${field.id}" still contains "test test" placeholder! Current value: "${value.substring(0, 100)}"`);
      }
      
      // Clear previous errors on change (validate on blur)
      if (!isBlur) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field.id];
          return newErrors;
        });
      }
      
      // Validate required fields on blur
      if (isBlur && field.required && !value.trim()) {
        setValidationErrors((prev) => ({ ...prev, [field.id]: `This field is required. Please enter ${field.label.toLowerCase()}.` }));
      } else if (isBlur) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field.id];
          return newErrors;
        });
      }
      
      logFormChange(field.id, value);
      setFormValues((prev) => ({ ...prev, [field.id]: value }));
    };
    
    return (
      <div className="mb-4 sm:mb-5 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
            {FieldIcon}
          </div>
          <span className="break-words">{field.label}</span>
          {field.required && <span className="text-red-500 ml-1 flex-shrink-0" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className="relative">
          <div className="absolute left-3 top-3 text-gray-400 pointer-events-none z-0">
            {FieldIcon}
          </div>
          <textarea
            id={field.id}
            rows={field.rows || 4}
            placeholder={field.placeholder || ''}
            className={`w-full border rounded-xl pl-10 pr-10 py-3 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 bg-white transition-all duration-300 shadow-sm focus:shadow-md relative z-10 ${
              validationErrors[field.id] 
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500' 
                : formValues[field.id] && !validationErrors[field.id] && field.required
                ? 'border-green-500 focus:ring-green-500 focus:border-green-500'
                : 'border-gray-300'
            }`}
            defaultValue={formValues[field.id] || ''}
            onChange={handleTextareaChange}
            onBlur={handleTextareaChange}
            disabled={false}
            readOnly={false}
            aria-label={field.label}
            aria-required={field.required}
            aria-invalid={!!validationErrors[field.id]}
            aria-describedby={validationErrors[field.id] ? `${field.id}-error` : field.infoText ? `${field.id}-info` : undefined}
          />
          {/* Validation feedback icons */}
          {formValues[field.id] && !validationErrors[field.id] && field.required && (
            <div className="absolute right-3 top-3 text-green-500 z-20 pointer-events-none">
              <CheckCircle2 size={18} className="animate-fadeIn" />
            </div>
          )}
          {validationErrors[field.id] && (
            <div className="absolute right-3 top-3 text-red-500 z-20 pointer-events-none">
              <AlertCircle size={18} />
            </div>
          )}
        </div>
        {validationErrors[field.id] && (
          <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5 flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    const FieldIcon = getFieldIcon(field.type, field.id);
    return (
      <div className="mb-4 sm:mb-5 group" data-field-id={field.id}>
        <label htmlFor={field.id} className="block font-semibold text-gray-800 mb-1.5 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
            {FieldIcon}
          </div>
          <span className="break-words min-w-0">{field.label}</span>
          {field.required && <span className="text-red-500 ml-1 flex-shrink-0" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <select
          id={field.id}
          name={field.id}
          value={formValues[field.id] || ''}
          onChange={(e) => {
            const v = e.target.value;
            setFormValues((prev) => ({ ...prev, [field.id]: v || null }));
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all min-h-[44px] dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
          aria-required={field.required || false}
          aria-invalid={!!validationErrors[field.id]}
          aria-describedby={validationErrors[field.id] ? `${field.id}-error` : undefined}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {validationErrors[field.id] && (
          <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5 flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
      </div>
    );
  }

  if (field.type === 'radio' && field.options) {
    DEBUG_LOGS&&console.log(`[RADIO FIELD] Field "${field.id}" (${field.label}) - Options: ${field.options.length}, Selected: "${formValues[field.id] || 'none'}", Required: ${field.required}`);
    const FieldIcon = getFieldIcon(field.type, field.id);
    const estateRecForExecutor =
      field.id === 'chooseAristoneExecutor' ? getAristoneEstateRecommendationState(formValues) : null;
    const showAristoneEstateRecommendation = estateRecForExecutor?.eligible === true;

    return (
      <div className="mb-4 sm:mb-5 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
            {FieldIcon}
          </div>
          <span className="break-words">{field.label}</span>
          {field.required && <span className="text-red-500 ml-1 flex-shrink-0" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        {field.id === 'chooseAristoneExecutor' && showAristoneEstateRecommendation && (
          <div
            role="status"
            aria-live="polite"
            className="mb-3 min-w-0 rounded-lg border-2 border-indigo-400/70 bg-indigo-50/95 px-3 py-3 text-sm shadow-sm break-words dark:border-indigo-400/80 dark:bg-slate-800/95 dark:text-slate-100"
          >
            <p className="text-slate-800 dark:text-slate-100 leading-snug">
              Based on the information you&apos;ve provided, your estate may benefit from professional administration.
            </p>
          </div>
        )}
        <div className={`mt-2 ${field.id === 'title' ? 'flex flex-wrap gap-2' : 'space-y-1'}`}>
          {field.options.map((opt) => {
            const aristoneIsExecutor =
              formValues.chooseAristoneExecutor === 'Aristone' ||
              (formValues.appointProfessionalExecutor === 'Yes' && formValues.professionalExecutorSelection === 'Aristone');
            const aristoneTrusteeLocked =
              (field.id === 'professionalTrusteeSelection' || field.id === 'substituteProfessionalTrusteeSelection') &&
              opt.value === 'Aristone' &&
              !aristoneIsExecutor;
            const recommendAristoneExecutor =
              field.id === 'chooseAristoneExecutor' && opt.value === 'Aristone' && showAristoneEstateRecommendation;
            const optionLabel = opt.label;
            return (
            <label key={opt.value} className={`flex items-center gap-2 rounded-lg transition-colors duration-200 border ${
              recommendAristoneExecutor
                ? 'border-2 border-indigo-400/80 bg-indigo-50/95 shadow-sm dark:border-indigo-400 dark:bg-slate-800/90'
                : 'border-transparent'
            } ${
              aristoneTrusteeLocked
                ? 'cursor-not-allowed opacity-50 pointer-events-none px-2 py-1.5'
                : `hover:bg-gray-50 cursor-pointer hover:border-indigo-200 dark:hover:bg-slate-800/80 ${
              field.id === 'title' 
                ? 'px-3 py-2 bg-white shadow-sm hover:shadow-md' 
                : 'px-2 py-1.5'
            }`}`}>
              <input
                type="radio"
                name={field.id}
                value={opt.value}
                className="accent-indigo-600 w-4 h-4"
                disabled={!!aristoneTrusteeLocked}
                checked={formValues[field.id] === opt.value}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      DEBUG_LOGS&&console.log(`[RADIO SELECTION] Field "${field.id}" (${field.label}) - Selected option: "${newValue}" (was: "${formValues[field.id] || 'none'}")`);
                      
                      // Special logging for Aristone Solicitors selection
                      if ((field.id === 'chooseAristoneExecutor' || field.id === 'chooseAristoneSubstituteExecutor') && newValue === 'Aristone') {
                        DEBUG_LOGS&&console.log(`[ARISTONE SELECTED] 🥇 User selected Aristone Solicitors as ${field.id.includes('Substitute') ? 'substitute ' : ''}executor!`);
                        // Show success message for Aristone selection
                        if (typeof window !== 'undefined' && window.showAristoneSuccess) {
                          window.showAristoneSuccess(field.id.includes('Substitute') ? 'substitute executor' : 'executor');
                        }
                        
                        // Auto-populate the corresponding data field with Aristone details
                        const dataFieldId = field.id.includes('Substitute') ? 'substituteExecutorData' : 'executorData';
                        const aristoneDetails = "Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG";
                        
                        // Update the executor data with Aristone details
                        setTimeout(() => {
                          setFormValues((prev) => ({
                            ...prev,
                            [dataFieldId]: [aristoneDetails]
                          }));
                          DEBUG_LOGS&&console.log(`[ARISTONE DATA] Auto-populated ${dataFieldId} with Aristone details`);
                        }, 100);
                      }
                      
                      // Handle switching to Individual option - clear Aristone data
                      if ((field.id === 'chooseAristoneExecutor' || field.id === 'chooseAristoneSubstituteExecutor') && newValue === 'Individual') {
                        DEBUG_LOGS&&console.log(`[INDIVIDUAL SELECTED] User chose to add individual ${field.id.includes('Substitute') ? 'substitute ' : ''}executor instead of Aristone`);
                        const dataFieldId = field.id.includes('Substitute') ? 'substituteExecutorData' : 'executorData';
                        
                        // Clear any existing Aristone data
                        setTimeout(() => {
                          setFormValues((prev) => ({
                            ...prev,
                            [dataFieldId]: []
                          }));
                          DEBUG_LOGS&&console.log(`[INDIVIDUAL DATA] Cleared ${dataFieldId} for individual entry`);
                        }, 100);
                      }
                      
                      logFormChange(field.id, newValue);
                      
                      // Clear validation errors when selection is made
                      setValidationErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors[field.id];
                        return newErrors;
                      });
                      
                      setFormValues((prev) => ({
                        ...prev,
                        [field.id]: newValue,
                      }));
                    }}
              />
              <span className={`text-gray-800 dark:text-slate-100 ${field.id === 'title' ? '' : 'min-w-0 flex-1 break-words'}`}>
                {optionLabel}
                {recommendAristoneExecutor && (
                  <>
                    <span className="ml-2 inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-xs font-semibold text-white dark:bg-indigo-500">Recommended</span>
                    <span className="block text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Recommended for estates like yours</span>
                  </>
                )}
              </span>
            </label>
            );
          })}
        </div>
        {validationErrors[field.id] && (
          <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5 flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
      </div>
    );
  }

  if (field.type === 'checkboxGroup' && field.options) {
    const selectedCount = Array.isArray(formValues[field.id]) ? formValues[field.id].length : 0;
    DEBUG_LOGS&&console.log(`[CHECKBOX GROUP] Field "${field.id}" (${field.label}) - Options: ${field.options.length}, Selected: ${selectedCount}, Required: ${field.required}`);
    const FieldIcon = getFieldIcon(field.type, field.id);
    
    return (
      <div className="mb-4 sm:mb-5 group" data-field-id={field.id}>
        {(field.label != null && String(field.label).trim() !== '') && (
          <label className="block font-semibold text-gray-800 dark:text-slate-100 mb-1.5 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
            <div className="p-1.5 bg-indigo-100 dark:bg-slate-700 rounded-lg text-indigo-600 dark:text-indigo-300 flex-shrink-0">
              {FieldIcon}
            </div>
            <span className="break-words">{field.label}</span>
            {field.required && <span className="text-red-500 ml-1 flex-shrink-0" title="Required">*</span>}
          </label>
        )}
        {field.infoText && (
          <p className="text-xs text-gray-600 dark:text-slate-400 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <div className={`flex flex-col space-y-1 ${field.label != null && String(field.label).trim() !== '' ? 'mt-2' : ''}`}>
          {field.options.map((opt) => {
            const optValue = (opt.value !== undefined && opt.value !== false && opt.value !== null && opt.value !== '')
              ? opt.value
              : (opt.willClauseTextFragment || opt.id || opt.label);
            const isChecked = Array.isArray(formValues[field.id])
              ? formValues[field.id].includes(optValue)
              : false;
            return (
              <label
                key={optValue || opt.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors duration-200 border border-transparent cursor-pointer hover:bg-gray-50 hover:border-indigo-200"
              >
                <input
                  type="checkbox"
                  className="accent-indigo-600 w-4 h-4"
                  checked={isChecked}
                  onChange={(e) => {
                    let newValue = Array.isArray(formValues[field.id])
                      ? [...formValues[field.id]]
                      : [];
                    DEBUG_LOGS&&console.log(`[CHECKBOX CHANGE] Field "${field.id}" (${field.label}) - Option "${optValue}" ${e.target.checked ? 'CHECKED' : 'UNCHECKED'}`);

                    if (e.target.checked) {
                      newValue.push(optValue);
                    } else {
                      const index = newValue.indexOf(optValue);
                      if (index > -1) newValue.splice(index, 1);
                    }
                    DEBUG_LOGS&&console.log(`[CHECKBOX RESULT] Field "${field.id}" new value:`, newValue);

                    if (newValue.length > 0 || !field.required) {
                      setValidationErrors((prev) => {
                        const newErrors = { ...prev };
                        delete newErrors[field.id];
                        return newErrors;
                      });
                    } else if (field.required && newValue.length === 0) {
                      setValidationErrors((prev) => ({ ...prev, [field.id]: `This field is required. Please select at least one option.` }));
                    }

                    logFormChange(field.id, newValue);
                    setFormValues((prev) => ({
                      ...prev,
                      [field.id]: newValue,
                    }));
                  }}
                />
                <span className="text-gray-800 flex-1">{opt.label}</span>
              </label>
            );
          })}
        </div>
        {validationErrors[field.id] && (
          <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5 flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
      </div>
    );
  }

  if (field.type === 'section' && field.subFields) {
    const isAddressSection = field.label.toLowerCase().includes('address');
    
    return (
      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-3 rounded-lg mb-4 transition-colors duration-300">
        <div className="font-semibold text-indigo-700 mb-1.5">{field.label}</div>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic">{field.infoText}</p>
        )}
        {isAddressSection && (
          <p className="text-xs text-gray-600 mb-1.5 italic">UK address format: {getUKAddressExample()}</p>
        )}
        {field.subFields.map((subField) => {
          // Skip subFields that shouldn't be shown (conditions not met)
          if (subField.conditions && evaluateFieldConditions && !evaluateFieldConditions(subField)) {
            return null; // Skip rendering this subField
          }
          
          return (
            <FieldRenderer
              key={subField.id}
              field={subField}
              formValues={formValues}
              setFormValues={setFormValues}
              evaluateFieldConditions={evaluateFieldConditions}
            />
          );
        }).filter(Boolean)}
      </div>
    );
  }

  if (field.type === 'display') {
    DEBUG_LOGS&&console.log(`[DISPLAY FIELD] Field "${field.id}" (${field.label}) - Displaying text: "${field.text?.substring(0, 50)}..."`);

    if (field.id === 'inlineSubstituteExecutorPrompt') return null;

    if (field.id === 'executorIndividualAgeFlow') {
      console.log('[EXECUTOR_AGE_DEBUG] FieldRenderer before ExecutorIndividualAgeFlow render', {
        fieldId: field.id,
        passesFieldConditions: passesFieldConditions(field),
      });
      return (
        <ExecutorIndividualAgeFlow formValues={formValues} setFormValues={setFormValues} />
      );
    }

    if (field.id === 'additionalExecutorPowersDivider') {
      return (
        <div className="mt-8 mb-2 border-b border-slate-200 dark:border-slate-600 pb-2 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {field.subheading || 'Additional executor powers'}
          </h3>
        </div>
      );
    }

    if (field.id === 'estateOverviewIntro') {
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-100 p-3 my-4 text-sm text-blue-900 dark:border-slate-600 dark:bg-slate-700/80 dark:text-slate-100">
          {field.text}
        </div>
      );
    }

    if (field.id === 'guardianStatusDisplay') {
      const gd = formValues.guardianData;
      const rows = Array.isArray(gd) ? gd.filter(Boolean) : [];
      const line = (e) =>
        typeof e === 'string'
          ? e
          : [e?.title, e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';
      if (rows.length > 0) {
        return (
          <div className="rounded-xl border border-emerald-600/50 bg-emerald-950/40 p-3 my-4 text-sm text-slate-100 dark:border-emerald-700/60 dark:bg-emerald-950/50">
            <p className="font-semibold text-emerald-100 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              Guardian(s) on this draft ({rows.length})
            </p>
            <p className="mt-1.5 text-xs text-slate-300 break-words">{rows.map(line).join(' · ')}</p>
          </div>
        );
      }
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 my-4 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200">
          <p className="font-medium text-slate-800 dark:text-slate-100">No guardian on the draft yet</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Use the guided flow above or &quot;Add Guardian&quot; below, then press Save guardians to form.
          </p>
        </div>
      );
    }

    if (field.id === 'substituteGuardianStatusDisplay') {
      const gd = formValues.substituteGuardianData;
      const rows = Array.isArray(gd) ? gd.filter(Boolean) : [];
      const line = (e) =>
        typeof e === 'string'
          ? e
          : [e?.title, e?.firstName, e?.middleName, e?.lastName].filter(Boolean).join(' ').trim() || '—';
      if (rows.length > 0) {
        return (
          <div className="rounded-xl border border-emerald-600/50 bg-emerald-950/40 p-3 my-4 text-sm text-slate-100 dark:border-emerald-700/60 dark:bg-emerald-950/50">
            <p className="font-semibold text-emerald-100 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              Substitute guardian(s) ({rows.length})
            </p>
            <p className="mt-1.5 text-xs text-slate-300 break-words">{rows.map(line).join(' · ')}</p>
          </div>
        );
      }
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 my-4 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-200">
          <p className="font-medium text-slate-800 dark:text-slate-100">No substitute guardian on the draft yet</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Add one below if you want a backup guardian.</p>
        </div>
      );
    }

    if (field.id === 'choosingExecutorsIntro') {
      const paras = String(field.text || '')
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean);
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 sm:p-6 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-800/90 dark:text-slate-100 space-y-4 min-w-0">
          {paras.map((p, i) => (
            <p key={i} className="leading-relaxed break-words">
              {p}
            </p>
          ))}
        </div>
      );
    }

    if (field.id?.startsWith('estateStep') && field.id?.endsWith('Heading')) {
      return (
        <div className="mt-6 mb-2 border-b border-slate-200 dark:border-slate-600 pb-2 min-w-0">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 break-words">
            {field.text}
          </h3>
        </div>
      );
    }

    if (field.id === 'digitalExecutorStatusDisplay') {
      const data = formValues.digitalExecutorData;
      if (Array.isArray(data) && data.length > 0) return null;
    }
    if (field.id === 'digitalExecutorIfNoStatusDisplay') {
      const data = formValues.digitalExecutorIfNoData;
      if (Array.isArray(data) && data.length > 0) return null;
    }
    
    if (field.id === 'aristoneProfessionalFeesNotice') {
      return (
        <div className="rounded-lg border border-slate-600 bg-slate-800/90 p-4 my-4 text-sm text-slate-100 dark:border-slate-500">
          <p className="leading-relaxed">
            If you appoint Aristone Solicitors, professional fees will apply. You can view our current pricing on our{' '}
            <a
              href="https://aristonesolicitors.co.uk/about-aristone/our-prices/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-300 underline font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded break-all"
            >
              website
            </a>
            .
          </p>
        </div>
      );
    }

    const isPartnerDisplay = field.id === 'partnerInfoDisplay';
    
    // Check if this is executor status display
    const isExecutorDisplay = field.id === 'executorStatusDisplay';
    const aristoneExecutorSelected = formValues.chooseAristoneExecutor === 'Aristone';
    const executorData = formValues.executorData;
    
    // Check if this is substitute executor status display
    const isSubstituteExecutorDisplay = field.id === 'substituteExecutorStatusDisplay';
    const aristoneSubstituteSelected = formValues.chooseAristoneSubstituteExecutor === 'Aristone';
    const substituteExecutorData = formValues.substituteExecutorData;
    
    // Handle executor status display
    if (isExecutorDisplay) {
      if (aristoneExecutorSelected) {
        return (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-800 rounded-r p-4 my-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🥇</span>
              <span className="font-semibold">Executor Selected:</span>
              <span className="font-bold">Aristone Solicitors</span>
            </div>
            <p className="text-xs mt-1 opacity-75">Professional legal firm will handle your estate administration.</p>
          </div>
        );
      } else if (executorData && Array.isArray(executorData) && executorData.length > 0) {
        return (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-800 rounded-r p-4 my-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="font-semibold">Executors Added:</span>
              <span className="font-bold">{executorData.length} executor(s)</span>
            </div>
            <p className="text-xs mt-1 opacity-75">{executorData.map((e) => typeof e === 'string' ? e : [e.title, e.firstName, e.lastName].filter(Boolean).join(' ') || '—').join(', ')}</p>
          </div>
        );
      } else {
        return (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-800 rounded-r p-4 my-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">👇</span>
              <span>Choose Aristone Solicitors (recommended) or add individual executors below.</span>
            </div>
          </div>
        );
      }
    }
    
    // Handle substitute executor status display
    if (isSubstituteExecutorDisplay) {
      if (aristoneSubstituteSelected) {
        return (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-800 rounded-r p-4 my-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🥇</span>
              <span className="font-semibold">Substitute Executor Selected:</span>
              <span className="font-bold">Aristone Solicitors</span>
            </div>
            <p className="text-xs mt-1 opacity-75">Professional backup executor selected.</p>
          </div>
        );
      } else if (substituteExecutorData && Array.isArray(substituteExecutorData) && substituteExecutorData.length > 0) {
        return (
          <div className="bg-green-100 border-l-4 border-green-500 text-green-800 rounded-r p-4 my-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <span className="font-semibold">Substitute Executors Added:</span>
              <span className="font-bold">{substituteExecutorData.length} substitute(s)</span>
            </div>
            <p className="text-xs mt-1 opacity-75">{substituteExecutorData.map((e) => typeof e === 'string' ? e : [e.title, e.firstName, e.lastName].filter(Boolean).join(' ') || '—').join(', ')}</p>
          </div>
        );
      } else {
        return (
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-800 rounded-r p-4 my-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">👇</span>
              <span>Choose Aristone Solicitors or add individual substitute executors below.</span>
            </div>
          </div>
        );
      }
    }
    
    // Inline partner summary removed — same data appears in People overview / matter review; keeps the step scannable.
    if (isPartnerDisplay) {
      return null;
    }
    
    // Regular display field
    return (
      <div className="bg-blue-100 text-blue-900 rounded p-3 my-4 text-sm">
        {field.text}
      </div>
    );
  }

  if (field.type === 'signature') {
    const FieldIcon = getFieldIcon(field.type, field.id);
    // Canvas aspect ratio matches PDF box (wide format for signatures)
    const isTestator = field.id === 'testatorSignature';
    const canvasWidth = isTestator ? 260 : 220;
    const canvasHeight = isTestator ? 90 : 80;
    const hasSignature = formValues[field.id] && typeof formValues[field.id] === 'string' && formValues[field.id].startsWith('data:image');

    const openModal = () => {
      setModalSignature(formValues[field.id] || '');
      setSignatureModalOpen(true);
    };
    const closeModal = () => setSignatureModalOpen(false);
    const handleApply = () => {
      const sig = modalSignature;
      if (sig && sig.startsWith('data:image')) {
        logFormChange(field.id, 'Signature data URL');
        setValidationErrors((prev) => { const n = { ...prev }; delete n[field.id]; return n; });
        setFormValues((prev) => ({ ...prev, [field.id]: sig }));
        if (typeof window !== 'undefined' && window.showSignatureSuccess) {
          window.showSignatureSuccess(field.label);
        }
      }
      closeModal();
    };
    const handleClearInModal = () => {
      setModalSignature('');
      sigPadRef.current[field.id]?.clear?.();
    };
    const onPadClear = () => setModalSignature('');

    return (
      <div className="my-4 sm:my-5 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
            {FieldIcon}
          </div>
          <span className="break-words">{field.label}</span>
          {field.required && <span className="text-red-500 ml-1 flex-shrink-0" title="Required">*</span>}
        </label>
        {field.subLabel && (
          <p className="text-xs text-gray-500 mb-2">{field.subLabel}</p>
        )}
        <div
          ref={sigContainerRef}
          onClick={openModal}
          className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl p-6 flex flex-col items-center justify-center min-h-[120px] cursor-pointer transition-all duration-200 touch-manipulation"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(); } }}
          aria-label={`${hasSignature ? 'Change' : 'Add'} signature for ${field.label}`}
        >
          {hasSignature ? (
            <>
              <img
                src={formValues[field.id]}
                alt="Your signature"
                className="max-w-full max-h-20 object-contain pointer-events-none"
                style={{ maxWidth: canvasWidth, maxHeight: canvasHeight }}
              />
              <span className="mt-2 text-sm font-medium text-indigo-600">Click to change signature</span>
            </>
          ) : (
            <>
              <PenTool className="w-10 h-10 text-indigo-400 mb-2" />
              <span className="text-sm font-medium text-gray-600">Click to sign</span>
            </>
          )}
        </div>
        {hasSignature && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setFormValues((prev) => ({ ...prev, [field.id]: '' }));
              setValidationErrors((prev) => {
                const n = { ...prev };
                delete n[field.id];
                return n;
              });
              if (field.required) setValidationErrors((prev) => ({ ...prev, [field.id]: 'This field is required. Please provide a signature.' }));
            }}
            className="mt-2 px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium"
          >
            Clear Signature
          </button>
        )}
        {validationErrors[field.id] && (
          <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5 flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}

        {signatureModalOpen && (
          <div
            ref={signatureModalRef}
            tabIndex={-1}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 outline-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signature-modal-title"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 pt-6 pb-2">
                <h3 id="signature-modal-title" className="text-lg font-semibold text-gray-900">{field.label}</h3>
                <p className="text-sm text-gray-500 mt-1">Draw your signature in the box below, then click Apply.</p>
              </div>
              <div className="px-6 py-4 flex justify-center bg-gray-50">
                <Suspense fallback={<div className="h-20 flex items-center text-gray-500">Loading…</div>}>
                  <LazySignaturePad
                    ref={(r) => { sigPadRef.current[field.id] = r; }}
                    fieldId={field.id}
                    width={canvasWidth}
                    height={canvasHeight}
                    existingSignature={modalSignature}
                    onSignatureEnd={(dataUrl) => setModalSignature(dataUrl)}
                    onClear={onPadClear}
                    className="border border-gray-300 rounded-lg overflow-hidden bg-white"
                    style={{ width: 'fit-content' }}
                  />
                </Suspense>
              </div>
              <div className="px-6 pb-6 pt-2 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleClearInModal}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="ml-auto px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'date') {
    const dateValue = formValues[field.id]
      ? (formValues[field.id].match(/^\d{4}-\d{2}-\d{2}$/) 
          ? new Date(formValues[field.id]) 
          : ukDateToISO(formValues[field.id]) 
          ? new Date(ukDateToISO(formValues[field.id]))
          : null)
      : null;

    const isValidDate = dateValue && !isNaN(dateValue.getTime());
    DEBUG_LOGS&&console.log(`[DATE FIELD] Field "${field.id}" (${field.label}) - Current value: "${formValues[field.id] || 'empty'}", Valid date: ${isValidDate}, Required: ${field.required}`);
    const FieldIcon = getFieldIcon(field.type, field.id);

    return (
      <div className="mb-4 sm:mb-5 group" data-field-id={field.id}>
        <label className="block font-semibold text-gray-800 mb-1.5 sm:mb-2 flex items-center gap-2 text-sm sm:text-base">
          <div className="p-1.5 bg-indigo-100 rounded-lg text-indigo-600 flex-shrink-0">
            {FieldIcon}
          </div>
          <span className="break-words">{field.label}</span>
          {field.required && <span className="text-red-500 ml-1 flex-shrink-0" title="Required">*</span>}
        </label>
        {field.infoText && (
          <p className="text-xs text-gray-600 mb-1.5 italic flex items-start gap-2">
            <Info size={14} className="mt-0.5 flex-shrink-0" />
            <span>{field.infoText}</span>
          </p>
        )}
        <p className="text-xs text-gray-500 mb-1.5">Click to open — then type the date (DD/MM/YYYY) or pick from the calendar.</p>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
            {FieldIcon}
          </div>
          {/* Clickable trigger: shows current value and opens modal */}
          <button
            type="button"
            onClick={() => {
              setDatePickerManualValue(prev => ({ ...prev, [field.id]: currentDisplayValue }));
              setDatePickerOpen(prev => ({ ...prev, [field.id]: true }));
            }}
            className={`w-full text-left border rounded-xl pl-10 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800 bg-white transition-all duration-300 shadow-sm focus:shadow-md cursor-pointer ${
              validationErrors[field.id] ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'
            }`}
            title="Click to type or pick a date"
            aria-label={`${field.label}, click to open date picker`}
          >
            <span className={currentDisplayValue ? 'text-gray-800' : 'text-gray-400'}>
              {currentDisplayValue || 'DD/MM/YYYY'}
            </span>
          </button>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10">
            <Calendar size={18} />
          </div>
        </div>

        {/* Custom date modal: rendered in a portal so it sits above all content (e.g. Testator's Signature) */}
        {datePickerOpen[field.id] &&
          createPortal(
            <div
              className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`date-modal-title-${field.id}`}
              onClick={() => setDatePickerOpen(prev => ({ ...prev, [field.id]: false }))}
            >
              <div
                className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 sm:p-5">
                  <h3 id={`date-modal-title-${field.id}`} className="text-lg font-semibold text-gray-800 mb-4">
                    {field.label}
                  </h3>

                  {/* Manual type-in */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Type date (DD/MM/YYYY)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={datePickerManualValue[field.id] ?? ''}
                        onChange={(e) => setDatePickerManualValue(prev => ({ ...prev, [field.id]: e.target.value }))}
                        placeholder="e.g. 22/03/1975"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-gray-800"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const raw = (datePickerManualValue[field.id] ?? '').trim();
                            if (!raw) return;
                            const iso = raw.match(/^\d{4}-\d{2}-\d{2}$/) ? raw : ukDateToISO(raw);
                            if (!iso) {
                              setValidationErrors(prev => ({ ...prev, [field.id]: 'Use format DD/MM/YYYY (e.g. 22/03/1975).' }));
                              return;
                            }
                            const parsed = new Date(iso);
                            if (Number.isNaN(parsed.getTime())) {
                              setValidationErrors(prev => ({ ...prev, [field.id]: 'Invalid date.' }));
                              return;
                            }
                            if (field.id === 'dateOfBirth' && parsed > new Date()) {
                              setValidationErrors(prev => ({ ...prev, [field.id]: 'Date of birth cannot be in the future.' }));
                              return;
                            }
                            const isoDate = parsed.toISOString().split('T')[0];
                            setDateInputValue(formatUKDate(isoDate));
                            setFormValues(prev => ({ ...prev, [field.id]: isoDate }));
                            setValidationErrors(prev => { const n = { ...prev }; delete n[field.id]; return n; });
                            setDatePickerOpen(prev => ({ ...prev, [field.id]: false }));
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const raw = (datePickerManualValue[field.id] ?? '').trim();
                          if (!raw) {
                            setValidationErrors(prev => ({ ...prev, [field.id]: 'Enter a date first.' }));
                            return;
                          }
                          const iso = raw.match(/^\d{4}-\d{2}-\d{2}$/) ? raw : ukDateToISO(raw);
                          if (!iso) {
                            setValidationErrors(prev => ({ ...prev, [field.id]: 'Use format DD/MM/YYYY (e.g. 22/03/1975).' }));
                            return;
                          }
                          const parsed = new Date(iso);
                          if (Number.isNaN(parsed.getTime())) {
                            setValidationErrors(prev => ({ ...prev, [field.id]: 'Invalid date.' }));
                            return;
                          }
                          if (field.id === 'dateOfBirth' && parsed > new Date()) {
                            setValidationErrors(prev => ({ ...prev, [field.id]: 'Date of birth cannot be in the future.' }));
                            return;
                          }
                          const isoDate = parsed.toISOString().split('T')[0];
                          setDateInputValue(formatUKDate(isoDate));
                          setFormValues(prev => ({ ...prev, [field.id]: isoDate }));
                          setValidationErrors(prev => { const n = { ...prev }; delete n[field.id]; return n; });
                          setDatePickerOpen(prev => ({ ...prev, [field.id]: false }));
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                      >
                        Use this date
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Enter date then press Enter or click &quot;Use this date&quot;</p>
                  </div>

                  {/* Or pick from calendar */}
                  <p className="text-sm font-medium text-gray-700 mb-2">Or pick from calendar</p>
                  <Suspense fallback={<div className="h-[280px] flex items-center justify-center text-gray-500">Loading calendar…</div>}>
                    <LazyDatePicker
                      selected={isValidDate ? dateValue : null}
                      onChange={(date) => {
                        if (date) {
                          const isoDate = date.toISOString().split('T')[0];
                          logFormChange(field.id, isoDate);
                          setDateInputValue(formatUKDate(isoDate));
                          setFormValues(prev => ({ ...prev, [field.id]: isoDate }));
                          setValidationErrors(prev => { const n = { ...prev }; delete n[field.id]; return n; });
                          setDatePickerOpen(prev => ({ ...prev, [field.id]: false }));
                        }
                      }}
                      inline
                      dateFormat="dd/MM/yyyy"
                      locale="en-GB"
                      showYearDropdown
                      showMonthDropdown
                      dropdownMode="select"
                      maxDate={new Date()}
                    />
                  </Suspense>

                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDatePickerOpen(prev => ({ ...prev, [field.id]: false }))}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg font-medium hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        {validationErrors[field.id] && (
          <p id={`${field.id}-error`} className="text-xs text-red-500 mt-1.5 flex items-center gap-2" role="alert" aria-live="polite">
            <AlertCircle size={14} aria-hidden="true" />
            <span>{validationErrors[field.id]}</span>
          </p>
        )}
        {formValues[field.id] && isValidDate && !validationErrors[field.id] && (
          <p className="text-xs text-gray-500 mt-1">
            Selected: {formatUKDate(formValues[field.id])}
          </p>
        )}
      </div>
    );
  }

  return null;
}

// Memoize FieldRenderer with proper comparison function
export default React.memo(FieldRenderer, (prevProps, nextProps) => {
  // Re-render if field props or form values change
  if (prevProps.field.id !== nextProps.field.id) return false;
  if (prevProps.field.type !== nextProps.field.type) return false;
  // Guardian embedded flow uses many slices of formValues + fresh inline callbacks; never skip updates.
  if (prevProps.field.type === 'guardianFlow' || prevProps.field.type === 'businessInterestsGuided') {
    return false;
  }
  if (prevProps.formValues[prevProps.field.id] !== nextProps.formValues[nextProps.field.id]) return false;
  if (prevProps.setFormValues !== nextProps.setFormValues) return false;
  if (prevProps.evaluateFieldConditions !== nextProps.evaluateFieldConditions) return false;
  
  // Deep compare the field object for other changes
  if (JSON.stringify(prevProps.field) !== JSON.stringify(nextProps.field)) return false;
  
  // If all checks pass, skip re-render (return true = no re-render needed)
  return true;
});
