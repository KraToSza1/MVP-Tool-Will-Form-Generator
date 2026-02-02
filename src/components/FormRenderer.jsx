/*
 * 🔍 COMPREHENSIVE CONSOLE LOGGING ENABLED
 * 
 * This FormRenderer component now includes extensive console logging for debugging and monitoring:
 * 
 * 📋 FORM LIFECYCLE:
 * - [FORM INIT] - Component initialization and data loading
 * - [SECTION CHANGE] - Navigation between form sections
 * - [SECTION FIELD] - Processing of individual fields in each section
 * 
 * 🔧 FORM INTERACTIONS:
 * - [QUESTION CHANGE] - All form value changes with field details
 * - [RADIO SELECTION] - Radio button selections with previous/new values
 * - [CHECKBOX CHANGE] - Checkbox group selections with option details
 * - [TEXT INPUT] - Text field changes and validation events
 * - [TEXTAREA] - Textarea changes with character counts
 * - [DATE PICKER] - Date selections with ISO conversion details
 * - [SIGNATURE] - Signature drawing and clearing events
 * - [ADD ITEM BUTTON] / [REMOVE ITEM] - Dynamic list management
 * 
 * ✅ VALIDATION & CONDITIONS:
 * - [VALIDATION] - Form validation checks per field
 * - [VALIDATION CHECK] - Section-level validation summaries
 * - [CONDITION CHECK] - Field condition evaluations
 * - [CONDITION RESULT] - Final condition results for field visibility
 * - [FORM COMPLETION] - Full form completion analysis
 * 
 * 🎯 USER ACTIONS:
 * - [NAVIGATION] - Next/back button clicks and navigation attempts
 * - [SCROLL TO FIELD] - Auto-scrolling to validation errors
 * - [KEYBOARD] - Keyboard shortcut usage (Ctrl+S, Escape)
 * - [PDF DOWNLOAD] - PDF generation and download events
 * - [SAVE DRAFT] / [MANUAL SAVE] - Form saving operations
 * - [RESET FORM] - Form reset and data clearing
 * 
 * 🎪 MODAL INTERACTIONS:
 * - [CLAUSE MODAL] - Clause preview modal open/close
 * - [VALIDATION MODAL] - Validation error modal interactions
 * - [COMPLETION MODAL] - Form completion modal events
 * 
 * 💾 DATA MANAGEMENT:
 * - [AUTOSAVE] - Automatic form saving with field counts
 * - [COMPLETION %] - Form completion percentage calculations
 * 
 * 🔍 FIELD RENDERING:
 * - [FIELD RENDER] - Every field render with type and status
 * - [FIELD SHOWN/HIDDEN] - Field visibility based on conditions
 * - [TEXT FIELD] / [RADIO FIELD] / [CHECKBOX GROUP] etc. - Field type specific logs
 * 
 * All logs include relevant context like field IDs, labels, values, and current form state.
 * Perfect for debugging user interactions, form behavior, and tracking engagement patterns!
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import formData from '../data/Complete-WillSuite-Form-Data.json';
import Sidebar from './Sidebar.jsx';
import FieldRenderer from './FieldRenderer.jsx';
import { Download, FileText, Scroll, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Save, Sparkles, RotateCcw, X, ArrowRight, Info, ArrowUp, Zap, AlertTriangle } from 'lucide-react';
import { autoFillForm, generateDummyFormData } from '../utils/autoFillForm.js';
import { validatePropertyTrustSchedules, validateBPRTrustSchedules } from '../utils/validationRegistry.js';
import { toast } from 'sonner';

const DEBUG_LOGS = false; // Set true for verbose console logging

export default function FormRenderer() {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem('willFormStep');
    const idx = saved != null ? Number(saved) : 0;
    return Number.isFinite(idx) && idx >= 0 ? idx : 0;
  });
  
  // Add global success handlers
  useEffect(() => {
    window.showPartnerNameSuccess = (partnerName) => {
      toast.success('Partner name saved!', { 
        description: `"${partnerName}" has been saved and will be used throughout your Will.` 
      });
    };
    
    window.showAristoneSuccess = (executorType) => {
      toast.success('🥇 Aristone Solicitors Selected!', { 
        description: `Aristone Solicitors has been selected as your professional ${executorType}. They will handle your estate professionally and efficiently.`,
        duration: 4000
      });
    };
    
    window.showSignatureSuccess = (fieldLabel) => {
      toast.success('Signature captured ✓', { 
        description: `${fieldLabel} has been saved and will appear in the PDF.`,
        duration: 3000
      });
    };
    
    return () => {
      delete window.showPartnerNameSuccess;
      delete window.showAristoneSuccess;
      delete window.showSignatureSuccess;
    };
  }, []);
  const [formValues, setFormValues] = useState(() => {
    const saved = localStorage.getItem('willForm');
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
      // Quick check for corrupted data on load
      const hasCorruption = JSON.stringify(parsed).includes('-1.8e+22') || 
                           JSON.stringify(parsed).includes('1.8e+22') ||
                           JSON.stringify(parsed).match(/-?\d+\.?\d*[eE][+-]?2\d+/);
      if (hasCorruption) {
        localStorage.removeItem('willForm');
        return {};
      }
      return parsed;
    } catch (e) {
      console.error('[FORM INIT] Error parsing localStorage data:', e);
      localStorage.removeItem('willForm');
      return {};
    }
  });
  const [submitted, setSubmitted] = useState(false);
  const [expandedFields, setExpandedFields] = useState({});
  const [banner, setBanner] = useState(null); // { type: 'error'|'info', message: string }
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState([]);
  const [clauseModalOpen, setClauseModalOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [formCompletionPercent, setFormCompletionPercent] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const autosaveTimerRef = useRef(null);
  const clauseUpdateTimerRef = useRef(null);
  const currentSection = formData.formSections[currentIndex];
  
  const isDev = import.meta.env.DEV;



  useEffect(() => {
    localStorage.setItem('willFormStep', String(currentIndex));
  }, [currentIndex]);

  // Handle scroll to show/hide back to top button
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      setShowBackToTop(scrollY > 300); // Show button after scrolling 300px
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Escape to close modals
      if (e.key === 'Escape') {
        DEBUG_LOGS&&console.log('[KEYBOARD] Escape key pressed');
        if (validationModalOpen) {
          DEBUG_LOGS&&console.log('[KEYBOARD] Closing validation modal with Escape key');
          setValidationModalOpen(false);
        }
        if (clauseModalOpen) {
          DEBUG_LOGS&&console.log('[KEYBOARD] Closing clause modal with Escape key');
          setClauseModalOpen(false);
        }
        if (submitted) {
          DEBUG_LOGS&&console.log('[KEYBOARD] Closing completion modal with Escape key');
          setSubmitted(false);
        }
      }
      
      // Ctrl/Cmd + S to save draft (prevent default browser save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        DEBUG_LOGS&&console.log('[KEYBOARD] Ctrl/Cmd + S pressed - triggering manual save');
        e.preventDefault();
        // Trigger autosave manually
        try {
          const dataToSave = {};
          let savedCount = 0;
          for (const [key, value] of Object.entries(formValues || {})) {
            if (key.toLowerCase().includes('signature')) continue;
            if (typeof value === 'string' && value.startsWith('data:image')) continue;
            if (isInvalidNumber(value)) continue;
            dataToSave[key] = value;
            savedCount++;
          }
          const testStr = JSON.stringify(dataToSave);
          if (testStr.length <= 5 * 1024 * 1024) {
            localStorage.setItem('willForm', testStr);
            setLastSaved(new Date());
            DEBUG_LOGS&&console.log(`[KEYBOARD] Manual save completed - saved ${savedCount} fields`);
            toast.success('Draft saved', { description: 'Your progress has been saved.' });
          } else {
            DEBUG_LOGS&&console.warn(`[KEYBOARD] Manual save failed - data too large: ${testStr.length} bytes`);
          }
        } catch (error) {
          console.error('[KEYBOARD] Manual save failed:', error);
          toast.error('Failed to save', { description: 'Could not save your draft.' });
        }
      }
      
      // Enter to submit (when in a form field, but not textarea)
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA' && !e.shiftKey) {
        const target = e.target;
        // Only trigger if we're in an input field and not already submitting
        if (target.tagName === 'INPUT' && target.type !== 'submit' && target.type !== 'button') {
          // Don't prevent default - let form handle it naturally
          // But we can add visual feedback
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [validationModalOpen, clauseModalOpen, submitted, formValues]);

  const scrollToTop = () => {
    DEBUG_LOGS&&console.log('[SCROLL TO TOP] Back to top button clicked');
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  // Format last saved time
  const formatLastSaved = (date) => {
    if (!date) return '';
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) > 1 ? 's' : ''} ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  // Prefetch the PDF generator chunk when users reach the final step.
  useEffect(() => {
    if (currentIndex === formData.formSections.length - 1) {
      import('./PDFGeneratorJSPDF.js').catch(() => {});
    }
  }, [currentIndex]);

  // ---------------------------
  // Text Interpolation Logic
  // ---------------------------
  const formatCurrencyValue = (value) => {
    if (value == null || value === '') return '';
    const numeric = typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(numeric)) {
      return `£${numeric.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
    }
    return String(value);
  };

  const interpolateText = (text, values) => {
    if (typeof text !== 'string') {
      return text;
    }

    const fallbackMap = {
      guardiansSection: 'guardianData',
      substituteGuardiansSection: 'substituteGuardianData',
      guardianshipDetailsSection: 'guardianshipDetailsData',
      signingOnBehalfSection: 'signingOnBehalfData',
      interpreterSection: 'interpreterData',
      chattelRecipientsSection: 'chattelRecipientData',
      chattelsGiftBeneficiarySection: 'chattelsGiftBeneficiaryData',
      excludedPersonSection: 'excludedPersonData',
      excludedPersonsSection: 'excludedPersonData',
      petCarerSection: 'petCarerData',
      substitutePetCarerSection: 'substitutePetCarerData',
      professionalTrusteesSection: 'professionalTrusteeData',
      substituteProfessionalTrusteesSection: 'substituteProfessionalTrusteeData',
      separateTrusteesSection: 'separateTrusteeData',
      monetaryGiftsSection: 'monetaryGiftsDetails',
      specificGiftsSection: 'specificGiftsDetails',
      propertyGiftsSection: 'propertyGiftsDetails',
      debtorsSection: 'debtorData',
      debtsReleasedSection: 'debtorData',
      partnerSection: 'partnerData',
      executorsSection: 'executorData',
      substituteExecutorsSection: 'substituteExecutorData',
      professionalExecutorSection: 'professionalExecutorData',
      substituteProfessionalExecutorSection: 'substituteProfessionalExecutorData',
      digitalExecutorsSection: 'digitalExecutorData',
      trusteesSection: 'trusteeData',
      substituteTrusteesSection: 'substituteTrusteeData',
      charityBenefitSection: 'charityBenefitDetails'
    };

    const interpolated = text.replace(/\{\{field:([^}]+)\}\}/g, (_, fullKey) => {
      const [sectionId, subField] = fullKey.split(':');

      if (subField === 'fullDetails' || subField === 'fullList') {
        // Special handling: chattelsGiftBeneficiarySection uses chattelsGiftBeneficiaryName when no array data
        // When name is empty, return placeholder unchanged so clause is skipped (hasUnresolved stays true)
        if (sectionId === 'chattelsGiftBeneficiarySection') {
          const name = values.chattelsGiftBeneficiaryName;
          if (name && String(name).trim() !== '') {
            return String(name).trim();
          }
          return `{{field:${fullKey}}}`;
        }
        const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
        const array = values[fallbackId] || values[sectionId] || [];
        if (Array.isArray(array) && array.length > 0) {
          return array.map(item =>
            typeof item === 'object'
              ? Object.values(item).filter(Boolean).join(', ')
              : item
          ).join('; ');
        }
        return '';
      }

      if (subField === 'formattedAmount') {
        const rawValue = values[sectionId] || values[fullKey];
        return formatCurrencyValue(rawValue);
      }

      // Handle 'value' subField FIRST - this is the most common case (e.g., partnerFullName:value)
      if (subField === 'value') {
        // Special handling for organ donation fields - if empty, return appropriate fallback
        if (sectionId === 'specificOrgansToDonate' || sectionId === 'specificOrgansToExclude') {
          const organValue = values[sectionId] || values[fullKey] || '';
          if (organValue && String(organValue).trim() !== '') {
            return String(organValue).trim();
          }
          // If organs are empty but purposes are selected, use generic phrase
          // This prevents broken clauses like "I wish to donate only the following parts of my body:  for..."
          return 'organs as appropriate';
        }
        
        // Try direct field lookup first (e.g., partnerFullName:value -> formValues.partnerFullName)
        const directValue = values[sectionId];
        if (directValue != null && directValue !== '') {
          return directValue.toString();
        }
        const fullKeyValue = values[fullKey];
        if (fullKeyValue != null && fullKeyValue !== '') {
          return fullKeyValue.toString();
        }
      }

      // Handle special case: selectedPurposes for organPurposeGroup
      if (subField === 'selectedPurposes' && sectionId === 'organPurposeGroup') {
        const selectedPurposes = values[sectionId] || [];
        if (Array.isArray(selectedPurposes) && selectedPurposes.length > 0) {
          // Get the field definition to access willClauseTextFragment
          const purposeField = formData.formSections
            .flatMap(s => s.fields)
            .find(f => f.id === 'organPurposeGroup');
          if (purposeField && purposeField.options) {
            const selectedFragments = purposeField.options
              .filter(opt => {
                const fragment = opt.willClauseTextFragment || opt.label;
                const optValue = (opt.value !== undefined && opt.value !== false && opt.value !== null && opt.value !== '')
                  ? opt.value
                  : (fragment || opt.id);
                // Match by id, value, willClauseTextFragment, or label (checkbox can store any of these)
                return selectedPurposes.includes(opt.id) ||
                  selectedPurposes.includes(opt.value) ||
                  selectedPurposes.includes(opt.willClauseTextFragment) ||
                  selectedPurposes.includes(opt.label) ||
                  selectedPurposes.includes(optValue);
              })
              .map(opt => opt.willClauseTextFragment || opt.label)
              .filter(Boolean);
            if (selectedFragments.length > 0) {
              // Concatenate with "and/or" for legally correct multi-purpose wording
              return selectedFragments.join(' and/or ');
            }
          }
        }
        // Default to "any lawful purpose" when no purposes are selected (as per UI hint)
        return 'any lawful purpose';
      }

      // Handle nested section fields (e.g., partnerSection:relationship, partnerSection:fullName)
      const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
      const sectionData = values[fallbackId] || values[sectionId];
      
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        if (typeof sectionData[0] !== 'object') {
          return sectionData.join(', ');
        }
        const mappedValues = sectionData
          .map((item) => {
            if (!item || typeof item !== 'object') return '';
            const fieldValue = item[subField] ||
              item[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
              item[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
              item[subField.toLowerCase()] ||
              item[subField.toUpperCase()];
            return fieldValue != null ? String(fieldValue) : '';
          })
          .filter(Boolean);
        if (mappedValues.length > 0) {
          return mappedValues.join(', ');
        }
      } else if (typeof sectionData === 'object' && sectionData !== null) {
        // If sectionData is an object (not array), access directly
        const fieldValue = sectionData[subField] || 
                          sectionData[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                          sectionData[subField.charAt(0).toUpperCase() + subField.slice(1)];
        if (fieldValue && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
          const result = fieldValue.toString();
          // Skip data URLs and very long strings
          if (result.startsWith('data:') || result.length > 10000) {
            return '';
          }
          return result;
        }
      }

      // Try other naming conventions
      const customValue = values[`${sectionId}:${subField}`] || 
                         values[`${sectionId}${subField}`] || 
                         values[`${sectionId}_${subField}`] ||
                         values[`${sectionId}.${subField}`];
      if (customValue) return customValue;

      const value = values[fullKey] || values[sectionId] || '';
      const result = (typeof value === 'string' || typeof value === 'number') && value !== '' ? value.toString() : '';
      return result;
    });

    // Remove any remaining unresolved placeholders
    return interpolated.replace(/\{\{field:[^}]+\}\}/g, '');
  };

  // Evaluate field conditions to determine if field should be shown
  const evaluateFieldConditions = useCallback((field) => {
    if (!field.conditions) return true;
    
    const evalClause = (clause) => {
      const value = formValues[clause.field];
      
      // Debug logging for critical FLIT fields
      if (clause.field === 'howResidueDistributed' && isDev) {
        DEBUG_LOGS&&console.log(`[CONDITION DEBUG] Field "${field.id}" checking howResidueDistributed:`, {
          actualValue: value,
          expectedValue: clause.value,
          operator: clause.operator,
          matches: clause.operator === 'eq' ? value === clause.value : 'not eq operator'
        });
      }
      
      if (clause.operator === 'eq') return value === clause.value;
      if (clause.operator === 'in') return Array.isArray(clause.value) ? clause.value.includes(value) : value === clause.value;
      if (clause.operator === 'AND' || clause.operator === 'OR') {
        const results = clause.clauses.map(evalClause);
        return clause.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
      }
      return false;
    };
    
    const result = Array.isArray(field.conditions) 
      ? (field.conditionLogic === 'OR' ? field.conditions.some(evalClause) : field.conditions.every(evalClause))
      : evalClause(field.conditions);
    
    // Enhanced debug logging for FLIT fields
    if (field.id && field.id.includes('FLIT') && isDev) {
      DEBUG_LOGS&&console.log(`[CONDITION DEBUG] Field "${field.id}" condition result:`, {
        fieldId: field.id,
        conditions: field.conditions,
        conditionLogic: field.conditionLogic,
        result: result,
        howResidueDistributed: formValues.howResidueDistributed
      });
    }
    
    return result;
  }, [formValues]);

  // ---------------------------
  // Validation: Required Fields
  // ---------------------------
  const allRequiredFilled = useMemo(() => {
    DEBUG_LOGS&&console.log('[VALIDATION CHECK] ========== VALIDATING SECTION ==========');
    DEBUG_LOGS&&console.log('[VALIDATION CHECK] Current section:', currentSection?.formSection);
    DEBUG_LOGS&&console.log('[VALIDATION CHECK] Total fields to check:', currentSection?.fields?.length);
    
    const result = currentSection.fields.every(field => {
      DEBUG_LOGS&&console.log(`[VALIDATION] Checking field "${field.id}" (${field.label})`);
      
      // Skip fields that shouldn't be shown (conditions not met)
      if (field.conditions && !evaluateFieldConditions(field)) {
        DEBUG_LOGS&&console.log(`[VALIDATION] Field "${field.id}" - SKIPPED (conditions not met)`);
        return true; // Field is hidden, so it's "valid"
      }
      
      // Skip hidden, button, and display fields
      if (['button', 'hidden', 'display'].includes(field.type)) {
        DEBUG_LOGS&&console.log(`[VALIDATION] Field "${field.id}" - SKIPPED (type: ${field.type})`);
        return true;
      }
      
      if (field.required) {
        let isValid = false;
        if (field.type === 'checkboxGroup') {
          isValid = Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          DEBUG_LOGS&&console.log(`[VALIDATION] Field "${field.id}" (checkbox group) - Selected: ${Array.isArray(formValues[field.id]) ? formValues[field.id].length : 0}, Valid: ${isValid}`);
        } else if (field.type === 'text' || field.type === 'textarea') {
          const val = formValues[field.id];
          isValid = typeof val === 'string' && val.trim() !== '';
          DEBUG_LOGS&&console.log(`[VALIDATION] Field "${field.id}" (${field.type}) - Value: "${formValues[field.id] || 'empty'}", Valid: ${isValid}`);
        } else {
          isValid = !!formValues[field.id];
          DEBUG_LOGS&&console.log(`[VALIDATION] Field "${field.id}" (${field.type}) - Value: "${formValues[field.id] || 'empty'}", Valid: ${isValid}`);
        }
        return isValid;
      } else {
        DEBUG_LOGS&&console.log(`[VALIDATION] Field "${field.id}" - NOT REQUIRED, automatically valid`);
      }
      return true;
    });
    
    if (isDev) DEBUG_LOGS&&console.log('[VALIDATION CHECK] allRequiredFilled result:', result);
    return result;
  }, [currentSection, formValues, evaluateFieldConditions]);

  const isFormFullyCompleted = () => {
    try {
      return formData.formSections.every((section) =>
        section.fields.every(field => {
          if (!evaluateFieldConditions(field)) return true;
          if (['button', 'hidden', 'display'].includes(field.type)) return true;
          if (field.required) {
            if (field.type === 'checkboxGroup') {
              return Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
            }
            if (field.type === 'section' && field.subFields) {
              const hasRequiredSubFieldFilled = field.subFields.some(subField => {
                if (!evaluateFieldConditions(subField)) return false;
                return subField.required && !!formValues[subField.id];
              });
              const hasNoRequiredSubFields = field.subFields.every(subField =>
                !subField.required || !evaluateFieldConditions(subField)
              );
              return hasRequiredSubFieldFilled || hasNoRequiredSubFields;
            }
            let isValid = !!formValues[field.id];
            if ((field.type === 'text' || field.type === 'textarea') && typeof formValues[field.id] === 'string') {
              isValid = formValues[field.id].trim() !== '';
            }
            return isValid;
          }
          return true;
        })
      );
    } catch (error) {
      console.error('[FORM] Error checking form completion:', error);
      return true;
    }
  };

  // ---------------------------
  // Validation: Collect All Issues
  // ---------------------------
  const collectValidationIssues = useCallback(() => {
    if (isDev) {
      DEBUG_LOGS&&console.log('[VALIDATION] Collecting validation issues...');
      DEBUG_LOGS&&console.log('[VALIDATION] Current section:', currentSection?.formSection);
      DEBUG_LOGS&&console.log('[VALIDATION] Total fields in section:', currentSection?.fields?.length);
    }
    
    const issues = [];
    
    currentSection.fields.forEach((field, index) => {
      if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] Checking field ${index + 1}/${currentSection.fields.length}:`, field.id, field.label, 'required:', field.required);
      
      // Skip fields that shouldn't be shown (conditions not met)
      if (field.conditions && !evaluateFieldConditions(field)) {
        if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] Field ${field.id} skipped - conditions not met`);
        return;
      }
      
      // Skip hidden, button, and display fields
      if (['button', 'hidden', 'display'].includes(field.type)) {
        if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] Field ${field.id} skipped - type: ${field.type}`);
        return;
      }
      
      // Check required fields
      if (field.required) {
        let isInvalid = false;
        let issueMessage = '';
        
        if (field.type === 'checkboxGroup') {
          const hasSelection = Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] CheckboxGroup ${field.id} - hasSelection:`, hasSelection);
          if (!hasSelection) {
            isInvalid = true;
            issueMessage = 'Please select at least one option';
          }
        } else if (field.type === 'section' && field.subFields) {
          // For sections, check if at least one required subfield is filled
          const hasRequiredSubFieldFilled = field.subFields.some(subField => {
            if (!evaluateFieldConditions(subField)) return false;
            if (subField.required) {
              return !!formValues[subField.id];
            }
            return false;
          });
          const hasNoRequiredSubFields = field.subFields.every(subField => 
            !subField.required || !evaluateFieldConditions(subField)
          );
          if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] Section ${field.id} - hasRequiredSubFieldFilled:`, hasRequiredSubFieldFilled, 'hasNoRequiredSubFields:', hasNoRequiredSubFields);
          if (!hasRequiredSubFieldFilled && !hasNoRequiredSubFields) {
            isInvalid = true;
            issueMessage = 'Please complete at least one required field in this section';
          }
        } else {
          const value = formValues[field.id];
          const isEmpty = !value || (typeof value === 'string' && !value.trim());
          if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] Field ${field.id} - value:`, value, 'isEmpty:', isEmpty);
          if (isEmpty) {
            isInvalid = true;
            issueMessage = 'This field is required';
          }
        }
        
        if (isInvalid) {
          if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] ❌ ISSUE FOUND: ${field.label} (${field.id}) - ${issueMessage}`);
          issues.push({
            fieldId: field.id,
            fieldLabel: field.label,
            message: issueMessage,
            type: 'required'
          });
        } else {
          if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] ✅ Field ${field.id} is valid`);
        }
      } else {
        if (isDev) DEBUG_LOGS&&console.log(`[VALIDATION] Field ${field.id} is not required - skipping`);
      }
    });
    
    if (isDev) {
      DEBUG_LOGS&&console.log('[VALIDATION] Total issues collected:', issues.length);
      DEBUG_LOGS&&console.log('[VALIDATION] Issues:', issues);
    }
    return issues;
  }, [currentSection, formValues, evaluateFieldConditions]);

  // ---------------------------
  // Navigation Logic
  // ---------------------------
  const goNext = () => {
    DEBUG_LOGS&&console.log('[NAVIGATION] ========== GO NEXT CLICKED ==========');
    DEBUG_LOGS&&console.log('[NAVIGATION] Current section:', currentSection?.formSection);
    DEBUG_LOGS&&console.log('[NAVIGATION] allRequiredFilled:', allRequiredFilled);
    DEBUG_LOGS&&console.log('[NAVIGATION] currentIndex:', currentIndex, 'of', formData.formSections.length - 1);
    DEBUG_LOGS&&console.log('[NAVIGATION] Current form values:', Object.keys(formValues));
    
    // Check if all required fields are filled before allowing navigation
    if (!allRequiredFilled) {
      if (isDev) DEBUG_LOGS&&console.log('[GO NEXT] Required fields NOT filled - opening modal');
      // Collect all validation issues
      const issues = collectValidationIssues();
      setValidationIssues(issues);
      setValidationModalOpen(true);
      if (isDev) DEBUG_LOGS&&console.log('[GO NEXT] Modal state set to open');
      return;
    }
    
    if (isDev) DEBUG_LOGS&&console.log('[GO NEXT] All fields valid - proceeding to next step');
    if (currentIndex < formData.formSections.length - 1) {
      const nextIndex = currentIndex + 1;
      if (isDev) DEBUG_LOGS&&console.log('[GO NEXT] Moving from step', currentIndex + 1, 'to step', nextIndex + 1);
      setCurrentIndex(nextIndex);
      // Scroll to top when changing sections
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // Auto-focus first field in new section after a brief delay
      setTimeout(() => {
        const firstField = document.querySelector('[data-field-id]');
        if (firstField) {
          const firstInput = firstField.querySelector('input, textarea, select');
          if (firstInput && typeof firstInput.focus === 'function') {
            firstInput.focus();
          }
        }
      }, 300);
    } else {
      if (isDev) DEBUG_LOGS&&console.log('[GO NEXT] Last step reached - showing completion modal');
      // Don't clear localStorage here - let user download PDF first
      // Only clear after they close the completion modal or download
      setSubmitted(true);
    }
  };

  const handleNextButtonClick = (e) => {
    if (isDev) {
      DEBUG_LOGS&&console.log('[NEXT BUTTON] ========== CLICKED ==========');
      DEBUG_LOGS&&console.log('[NEXT BUTTON] allRequiredFilled:', allRequiredFilled);
      DEBUG_LOGS&&console.log('[NEXT BUTTON] currentIndex:', currentIndex);
      DEBUG_LOGS&&console.log('[NEXT BUTTON] currentSection:', currentSection?.formSection);
    }
    
    if (!allRequiredFilled) {
      if (isDev) DEBUG_LOGS&&console.log('[NEXT BUTTON] ❌ Required fields NOT filled - collecting issues...');
      e.preventDefault();
      e.stopPropagation();
      
      const issues = collectValidationIssues();
      if (isDev) {
        DEBUG_LOGS&&console.log('[NEXT BUTTON] Validation issues found:', issues);
        DEBUG_LOGS&&console.log('[NEXT BUTTON] Number of issues:', issues.length);
      }
      
      setValidationIssues(issues);
      setValidationModalOpen(true);
      if (isDev) DEBUG_LOGS&&console.log('[NEXT BUTTON] ✅ Modal state set to TRUE');
    } else {
      if (isDev) DEBUG_LOGS&&console.log('[NEXT BUTTON] ✅ All required fields filled - proceeding to next step');
      goNext();
    }
  };

  const scrollToField = (fieldId, targetFieldIds = []) => {
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] ========== SCROLLING TO FIELD "${fieldId}" ==========`);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Field ID type:`, typeof fieldId);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Field ID value:`, fieldId);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Target field IDs (fallback):`, targetFieldIds);
    
    if (!fieldId) {
      console.error(`[SCROLL TO FIELD] ❌ No fieldId provided!`);
      return;
    }
    
    // Try primary fieldId first
    const tryField = (id) => {
      DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Trying field ID: "${id}"`);
      const selector = `[data-field-id="${id}"]`;
      const fieldElement = document.querySelector(selector);
      
      if (fieldElement) {
        DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] ✅ Found field element for "${id}" - scrolling and highlighting`);
        DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Element tag:`, fieldElement.tagName);
        DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Element classes:`, fieldElement.className);
        
        try {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] ScrollIntoView called successfully`);
          
          // Add a highlight effect
          fieldElement.classList.add('animate-pulse');
          DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Added animate-pulse class`);
          setTimeout(() => {
            fieldElement.classList.remove('animate-pulse');
            DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Removed animate-pulse class`);
          }, 2000);
          
          // Focus on the first input in that field
          const input = fieldElement?.querySelector('input, textarea, select');
          DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Found input element:`, input);
          if (input) {
            DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Focusing on input element in field "${id}"`);
            setTimeout(() => {
              try {
                input.focus();
                DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] ✅ Input focused successfully`);
              } catch (focusError) {
                console.error(`[SCROLL TO FIELD] ❌ Error focusing input:`, focusError);
              }
            }, 500);
          } else {
            DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] No input element found in field`);
          }
          
          // Close modal after scrolling
          DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Closing validation modal after scroll to "${id}"`);
          setValidationModalOpen(false);
          return true;
        } catch (scrollError) {
          console.error(`[SCROLL TO FIELD] ❌ Error during scroll:`, scrollError);
          return false;
        }
      }
      return false;
    };
    
    // Try primary fieldId
    if (tryField(fieldId)) {
      return;
    }
    
    // Try targetFieldIds as fallback
    if (Array.isArray(targetFieldIds) && targetFieldIds.length > 0) {
      DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Primary fieldId "${fieldId}" not found, trying ${targetFieldIds.length} fallback field IDs...`);
      for (const fallbackId of targetFieldIds) {
        if (fallbackId !== fieldId && tryField(fallbackId)) {
          return;
        }
      }
    }
    
    // Try case-insensitive search
    console.error(`[SCROLL TO FIELD] ❌ Could not find field element for "${fieldId}"`);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Trying case-insensitive search...`);
    
    const allFields = document.querySelectorAll('[data-field-id]');
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Total fields with data-field-id:`, allFields.length);
    
    const searchIds = [fieldId, ...(Array.isArray(targetFieldIds) ? targetFieldIds : [])];
    const foundField = Array.from(allFields).find(field => {
      const id = field.getAttribute('data-field-id') || '';
      return searchIds.some(searchId => id.toLowerCase() === String(searchId).toLowerCase());
    });
    
    if (foundField) {
      DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] ✅ Found field via case-insensitive search`);
      foundField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = foundField.querySelector('input, textarea, select');
      if (input) {
        setTimeout(() => input.focus(), 500);
      }
      setValidationModalOpen(false);
    } else {
      console.error(`[SCROLL TO FIELD] ❌ Field not found even with case-insensitive search`);
      console.error(`[SCROLL TO FIELD] Searched for:`, searchIds);
      console.error(`[SCROLL TO FIELD] Available field IDs (first 20):`, Array.from(allFields).slice(0, 20).map(f => f.getAttribute('data-field-id')));
    }
  };

  // Helper to find and scroll to schedule fields
  const scrollToScheduleField = (scheduleText) => {
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] ========== STARTING SCHEDULE SEARCH ==========`);
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Input scheduleText: "${scheduleText}"`);
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Type of scheduleText:`, typeof scheduleText);
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Current form values:`, Object.keys(formValues).length, 'fields');
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] propertyTrustScheduleNumber:`, formValues.propertyTrustScheduleNumber);
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] bprTrustScheduleNumber:`, formValues.bprTrustScheduleNumber);
    
    // Extract schedule number from "Schedule 65432" or "Schedule65432" etc.
    const scheduleMatch = scheduleText.match(/schedule\s*(\d+)/i);
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Regex match result:`, scheduleMatch);
    const scheduleNumber = scheduleMatch ? scheduleMatch[1] : null;
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Extracted schedule number: "${scheduleNumber}"`);
    
    if (!scheduleNumber) {
      console.error(`[SCROLL TO SCHEDULE] Could not extract schedule number from: "${scheduleText}"`);
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Trying fallback: search for any schedule section...`);
    }
    
    if (scheduleNumber) {
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Searching for schedule number: ${scheduleNumber}`);
      
      // Try multiple strategies to find the schedule field
      const searchStrategies = [
        // Strategy 1: Direct field ID match with schedule number
        `[data-field-id*="schedule${scheduleNumber}"]`,
        // Strategy 2: Field ID containing "schedule" and the number
        `[data-field-id*="schedule"][data-field-id*="${scheduleNumber}"]`,
        // Strategy 3: Label containing schedule number
        `[data-field-id][aria-label*="${scheduleNumber}"]`,
        // Strategy 4: Any field with schedule in ID
        `[data-field-id*="schedule"]`,
      ];
      
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Trying ${searchStrategies.length} selector strategies...`);
      for (let i = 0; i < searchStrategies.length; i++) {
        const selector = searchStrategies[i];
        DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Strategy ${i + 1}: Trying selector "${selector}"`);
        const element = document.querySelector(selector);
        DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Strategy ${i + 1} result:`, element);
        if (element) {
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] ✅ SUCCESS! Found field with selector: ${selector}`);
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Element details:`, {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            dataFieldId: element.getAttribute('data-field-id')
          });
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('animate-pulse');
          setTimeout(() => element.classList.remove('animate-pulse'), 2000);
          
          const input = element.querySelector('input, textarea, select');
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Found input element:`, input);
          if (input) {
            setTimeout(() => {
              DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Focusing input...`);
              input.focus();
            }, 500);
          }
          
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Closing validation modal...`);
          setValidationModalOpen(false);
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] ========== SUCCESS - EXITING ==========`);
          return;
        }
      }
      
      // Strategy 5: Search all fields and find one with schedule number in value or label
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] All selector strategies failed, trying manual field search...`);
      const allFields = document.querySelectorAll('[data-field-id]');
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Total fields with data-field-id: ${allFields.length}`);
      
      let checkedCount = 0;
      for (const field of allFields) {
        checkedCount++;
        const fieldId = field.getAttribute('data-field-id') || '';
        const label = field.querySelector('label')?.textContent || '';
        const value = field.querySelector('input, textarea, select')?.value || '';
        
        const hasScheduleInId = fieldId.toLowerCase().includes('schedule') && fieldId.includes(scheduleNumber);
        const hasScheduleInLabel = label.toLowerCase().includes('schedule') && label.includes(scheduleNumber);
        const hasScheduleInValue = value.includes(scheduleNumber);
        
        if (hasScheduleInId || hasScheduleInLabel || hasScheduleInValue) {
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] ✅ SUCCESS! Found matching field at index ${checkedCount}:`);
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Field ID: "${fieldId}"`);
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Label: "${label}"`);
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Value: "${value}"`);
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Matches:`, { hasScheduleInId, hasScheduleInLabel, hasScheduleInValue });
          
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          field.classList.add('animate-pulse');
          setTimeout(() => field.classList.remove('animate-pulse'), 2000);
          
          const input = field.querySelector('input, textarea, select');
          if (input) {
            setTimeout(() => input.focus(), 500);
          }
          
          setValidationModalOpen(false);
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] ========== SUCCESS - EXITING ==========`);
          return;
        }
        
        // Log first 5 fields for debugging
        if (checkedCount <= 5) {
          DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Field ${checkedCount}: ID="${fieldId}", Label="${label.substring(0, 50)}"`);
        }
      }
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Checked ${checkedCount} fields, no match found`);
    }
    
    // Fallback: Try to find any schedule-related section
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Trying fallback: search for schedule sections...`);
    const scheduleSections = document.querySelectorAll('[aria-label*="Schedule"], [aria-label*="schedule"]');
    DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Found ${scheduleSections.length} schedule sections`);
    if (scheduleSections.length > 0) {
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] Falling back to first schedule section`);
      scheduleSections[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setValidationModalOpen(false);
      DEBUG_LOGS&&console.log(`[SCROLL TO SCHEDULE] ========== FALLBACK SUCCESS - EXITING ==========`);
      return;
    }
    
    console.error(`[SCROLL TO SCHEDULE] ❌ FAILED: Could not find schedule field for "${scheduleText}"`);
    console.error(`[SCROLL TO SCHEDULE] ========== FAILED - EXITING ==========`);
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const saveDraft = () => {
    DEBUG_LOGS&&console.log('[SAVE DRAFT] ========== MANUAL SAVE DRAFT CLICKED ==========');
    DEBUG_LOGS&&console.log('[SAVE DRAFT] Current form values count:', Object.keys(formValues).length);
    
    try {
      // Remove signature data URLs before saving (they're too large and cause issues)
      const dataToSave = {};
      let skippedCount = 0;
      
      for (const [key, value] of Object.entries(formValues)) {
        // Skip signature fields (they'll be re-added if needed)
        if (key.toLowerCase().includes('signature')) {
          skippedCount++;
          DEBUG_LOGS&&console.log(`[SAVE DRAFT] Skipping signature field: "${key}"`);
          continue;
        }
        // Skip data URLs
        if (typeof value === 'string' && value.startsWith('data:image')) {
          skippedCount++;
          DEBUG_LOGS&&console.log(`[SAVE DRAFT] Skipping data URL field: "${key}"`);
          continue;
        }
        // Skip corrupted data
        if (isInvalidNumber(value)) {
          skippedCount++;
          DEBUG_LOGS&&console.log(`[SAVE DRAFT] Skipping corrupted data field: "${key}"`);
          continue;
        }
        dataToSave[key] = value;
      }
      
      DEBUG_LOGS&&console.log(`[SAVE DRAFT] Prepared ${Object.keys(dataToSave).length} fields for saving (skipped ${skippedCount})`);
      
      // Check localStorage quota
      const testStr = JSON.stringify(dataToSave);
      if (testStr.length > 5 * 1024 * 1024) { // 5MB limit
        alert('Form data is too large to save. Please reduce the amount of data.');
        return;
      }
      
      localStorage.setItem('willForm', testStr);
      DEBUG_LOGS&&console.log(`[SAVE DRAFT] Successfully saved draft with ${Object.keys(dataToSave).length} fields`);
      toast.success('Draft saved', { description: 'Your progress has been saved to this device.' });
    } catch (error) {
      console.error('[SAVE DRAFT] Error saving draft:', error);
      if (error.name === 'QuotaExceededError') {
        toast.error('Storage is full', { description: 'Please clear some space or reduce form data.' });
      } else {
        console.error('[SAVE DRAFT] Error saving draft:', error);
        toast.error('Error saving draft', { description: error.message || 'Unknown error' });
      }
    }
  };

  const resetForm = () => setClearConfirmOpen(true);

  const confirmReset = () => {
    localStorage.removeItem('willForm');
    localStorage.removeItem('willFormStep');
    setFormValues({});
    setCurrentIndex(0);
    setBanner(null);
    setClearConfirmOpen(false);
    toast.success('Form reset', { description: 'All data has been cleared. You can now start fresh.' });
  };

  // Auto-fill form with dummy data
  const handleAutoFill = useCallback(() => {
    try {
      const dummyData = generateDummyFormData(formData);
      setFormValues(prev => ({ ...prev, ...dummyData }));
      localStorage.setItem('willForm', JSON.stringify(dummyData));
      setTimeout(() => setFormValues(current => ({ ...current })), 100);
      toast.success('Form auto-filled ✓', {
        description: `Filled ${Object.keys(dummyData).length} fields from start to finish. Ready for PDF preview.`,
        duration: 4000
      });
    } catch (error) {
      console.error('[FORM] Auto-fill error:', error);
      toast.error('Auto-fill failed', { description: error.message });
    }
  }, [formData]);

  // Expose auto-fill function to window for console access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.autoFillWillForm = handleAutoFill;
    }
  }, [handleAutoFill]);

  const verifyNoTestPlaceholders = useCallback(() => {
    const testFields = Object.entries(formValues).filter(([key, val]) => {
      if (typeof val === 'string') {
        const lowerVal = val.toLowerCase();
        return (lowerVal.includes('test test test') || (lowerVal.includes('test test') && !lowerVal.includes('test@') && !lowerVal.includes('@test'))) && lowerVal.trim() !== 'test@example.com';
      }
      return false;
    });
    return testFields.length === 0;
  }, [formValues]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.verifyNoTestPlaceholders = verifyNoTestPlaceholders;
    }
  }, [verifyNoTestPlaceholders]);

  // Calculate form completion percentage
  useEffect(() => {
    const calculateCompletion = () => {
      DEBUG_LOGS&&console.log('[COMPLETION %] ========== CALCULATING FORM COMPLETION PERCENTAGE ==========');
      let totalRequired = 0;
      let completedRequired = 0;

      formData.formSections.forEach((section, sectionIndex) => {
        DEBUG_LOGS&&console.log(`[COMPLETION %] Section ${sectionIndex + 1}: "${section.formSection}"`);
        
        section.fields.forEach(field => {
          if (field.conditions && !evaluateFieldConditions(field)) {
            DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" - SKIPPED (conditions not met)`);
            return;
          }
          if (['button', 'hidden', 'display'].includes(field.type)) {
            DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" - SKIPPED (type: ${field.type})`);
            return;
          }
          
          if (field.required) {
            totalRequired++;
            DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" - REQUIRED field found (total now: ${totalRequired})`);
            
            if (field.type === 'checkboxGroup') {
              const isCompleted = Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
              if (isCompleted) {
                completedRequired++;
                DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" (checkbox) - COMPLETED (completed now: ${completedRequired})`);
              } else {
                DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" (checkbox) - NOT completed`);
              }
            } else if (field.type === 'section' && field.subFields) {
              const hasRequiredSubFieldFilled = field.subFields.some(subField => {
                if (!evaluateFieldConditions(subField)) return false;
                if (subField.required) return !!formValues[subField.id];
                return false;
              });
              if (hasRequiredSubFieldFilled) {
                completedRequired++;
                DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" (section) - COMPLETED (completed now: ${completedRequired})`);
              } else {
                DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" (section) - NOT completed`);
              }
            } else {
              const isCompleted = !!formValues[field.id];
              if (isCompleted) {
                completedRequired++;
                DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" (${field.type}) - COMPLETED (completed now: ${completedRequired})`);
              } else {
                DEBUG_LOGS&&console.log(`[COMPLETION %] Field "${field.id}" (${field.type}) - NOT completed`);
              }
            }
          }
        });
      });

      const percent = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;
      DEBUG_LOGS&&console.log(`[COMPLETION %] FINAL CALCULATION: ${completedRequired}/${totalRequired} = ${percent}%`);
      setFormCompletionPercent(percent);
    };

    calculateCompletion();
  }, [formValues, evaluateFieldConditions]);

  // Autosave (debounced) — with visual feedback
  useEffect(() => {
    DEBUG_LOGS&&console.log('[AUTOSAVE] Form values changed, triggering autosave timer...');
    DEBUG_LOGS&&console.log('[AUTOSAVE] Changed values:', Object.keys(formValues));
    
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setIsSaving(true);

    autosaveTimerRef.current = setTimeout(() => {
      DEBUG_LOGS&&console.log('[AUTOSAVE] Executing autosave...');
      try {
        const dataToSave = {};
        let filteredCount = 0;
        for (const [key, value] of Object.entries(formValues || {})) {
          if (key.toLowerCase().includes('signature')) {
            filteredCount++;
            continue;
          }
          if (typeof value === 'string' && value.startsWith('data:image')) {
            filteredCount++;
            continue;
          }
          if (isInvalidNumber(value)) {
            filteredCount++;
            continue;
          }
          dataToSave[key] = value;
        }

        DEBUG_LOGS&&console.log(`[AUTOSAVE] Prepared ${Object.keys(dataToSave).length} fields for saving (filtered out ${filteredCount})`);
        
        const testStr = JSON.stringify(dataToSave);
        if (testStr.length <= 5 * 1024 * 1024) {
          localStorage.setItem('willForm', testStr);
          setLastSaved(new Date());
          setIsSaving(false);
          DEBUG_LOGS&&console.log(`[AUTOSAVE] Successfully saved ${Object.keys(dataToSave).length} fields to localStorage`);
        } else {
          DEBUG_LOGS&&console.warn(`[AUTOSAVE] Data too large to save: ${testStr.length} bytes`);
          setIsSaving(false);
        }
      } catch (error) {
        console.error('[AUTOSAVE] Error during autosave:', error);
        setIsSaving(false);
      }
    }, 600);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [formValues]);


  // Calculate clause preview - moved outside JSX to fix React Hooks error
  // (evaluateFieldConditions is already defined above, reusing it)
  // Debounced clause preview calculation for better performance
  const [debouncedFormValues, setDebouncedFormValues] = useState(formValues);
  
  useEffect(() => {
    if (clauseUpdateTimerRef.current) {
      clearTimeout(clauseUpdateTimerRef.current);
    }
    
    clauseUpdateTimerRef.current = setTimeout(() => {
      setDebouncedFormValues(formValues);
    }, 400); // Debounce clause updates by 400ms
    
    return () => {
      if (clauseUpdateTimerRef.current) clearTimeout(clauseUpdateTimerRef.current);
    };
  }, [formValues]);

  const clausePreview = useMemo(() => {
    if (currentIndex < 1) return null;

    const allClauses = [];
    const sectionsToProcess = formData.formSections.slice(0, currentIndex + 1);

    sectionsToProcess.forEach(section => {
      section.fields.forEach(field => {
        if (field.conditions && !evaluateFieldConditions(field)) return;
        if (['button', 'hidden', 'display'].includes(field.type)) return;

        if (field.willClauseText) {
          const interpolated = interpolateText(field.willClauseText, debouncedFormValues);
          const hasUnresolved = /\{\{field:[^}]+\}\}/.test(interpolated);
          if (interpolated && !hasUnresolved && interpolated.trim() !== '') {
            allClauses.push({
              id: `${section.formSection}-${field.id}`,
              text: interpolated,
              fieldLabel: field.label,
              section: section.formSection
            });
          }
        }

        if (field.options && (field.type === 'radio' || field.type === 'select')) {
          const selectedValue = debouncedFormValues[field.id];
          if (selectedValue) {
            const selectedOption = field.options.find(opt => opt.value === selectedValue);
            if (selectedOption?.willClauseText) {
              const interpolated = interpolateText(selectedOption.willClauseText, debouncedFormValues);
              const hasUnresolved = /\{\{field:[^}]+\}\}/.test(interpolated);
              if (interpolated && !hasUnresolved && interpolated.trim() !== '') {
                allClauses.push({
                  id: `${section.formSection}-${field.id}-${selectedOption.value}`,
                  text: interpolated,
                  fieldLabel: field.label,
                  section: section.formSection
                });
              }
            }
          }
        }
        
        // Handle section fields with subFields
        if (field.type === 'section' && field.subFields) {
          field.subFields.forEach(subField => {
            // Skip subFields that shouldn't be shown
            if (subField.conditions && !evaluateFieldConditions(subField)) {
              return;
            }
            
            // Check subField's willClauseText
            if (subField.willClauseText) {
              const interpolated = interpolateText(subField.willClauseText, debouncedFormValues);
              if (interpolated && !/\{\{field:[^}]+\}\}/.test(interpolated) && interpolated.trim() !== '') {
                allClauses.push({
                  id: `${section.formSection}-${field.id}-${subField.id}`,
                  text: interpolated,
                  fieldLabel: subField.label || field.label,
                  section: section.formSection
                });
              }
            }
          });
        }
      });
    });

    if (allClauses.length === 0) return null;

    // Maintain consistent ordering: show clauses in the order they appear in the form
    // Only update clause content when fields change, but don't reorder or scroll
    // This prevents the "jump to top then drop" behavior
    return allClauses;
  }, [currentIndex, debouncedFormValues, evaluateFieldConditions]);

  const renderClausePreview = (wrapperClassName = '') => {
    if (currentIndex < 1) {
      return null;
    }

    return (
      <aside className={wrapperClassName}>
        {clausePreview && clausePreview.length > 0 ? (
          <div className="w-full bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-4 flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Scroll className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg">Clause Preview</h3>
              <span className="ml-auto bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                <CheckCircle2 size={14} />
                {clausePreview.length} {clausePreview.length === 1 ? 'Clause' : 'Clauses'}
              </span>
            </div>

            <div className={`p-4 ${clausePreview.length > 3 ? 'max-h-[70vh] overflow-y-auto custom-scrollbar' : ''}`} id="clause-preview-container">
              <div className="space-y-4">
                {clausePreview.map((clause) => (
                  <div
                    key={clause.id}
                    className="bg-white border-l-4 border-indigo-500 rounded-r-lg p-3 shadow-sm hover:shadow-md transition-all duration-300"
                    data-clause-id={clause.id}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-indigo-700 mb-1 uppercase tracking-wide">
                          {clause.fieldLabel}
                        </p>
                        <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-line">
                          {clause.text}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-4">
              <div className="text-center py-12 animate-fadeIn">
                <div className="text-center py-6">
                  <div className="mb-3 flex justify-center">
                    <div className="p-3 bg-indigo-100 rounded-full">
                      <FileText size={24} className="text-indigo-600" />
                    </div>
                  </div>
                  <p className="text-gray-700 font-semibold mb-1.5">No clauses generated yet</p>
                  <p className="text-sm text-gray-500">
                    Complete relevant fields to see generated clauses appear here.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    );
  };

  // Aggressive check for corrupted numbers that break PDF rendering
  const isInvalidNumber = (val) => {
    if (val == null || val === '') return false;
    
    if (typeof val === 'number') {
      const str = val.toString();
      // Check for corrupted exponential patterns
      if (str.includes('e+') && (str.includes('e+2') || str.includes('e+22'))) return true;
      if (str.match(/[eE][+-]?2\d+/)) return true;
      return !isFinite(val) || isNaN(val) || Math.abs(val) >= 1e10;
    }
    
    if (typeof val === 'string') {
      // Check for corrupted number patterns
      if (/-?\d+\.?\d*[eE][+-]?2\d+/.test(val)) return true;
      if (val.includes('-1.8e+') || val.includes('1.8e+22') || val.includes('1.8e+2')) return true;
      // Check for very large numbers that could parse incorrectly
      const largeNumMatch = val.match(/-?\d+\.?\d*[eE][+-]?\d+/g);
      if (largeNumMatch) {
        for (const numStr of largeNumMatch) {
          const num = parseFloat(numStr);
          if (!isFinite(num) || Math.abs(num) >= 1e10) return true;
        }
      }
    }
    
    if (typeof val === 'object' && val !== null) {
      try {
        const str = JSON.stringify(val);
        if (/-?\d+\.?\d*[eE][+-]?2\d+/.test(str)) return true;
        if (str.includes('-1.8e+') || str.includes('1.8e+22')) return true;
      } catch {
        return true; // Can't serialize = invalid
      }
    }
    
    return false;
  };

  // Sanitize text strings to remove corrupted number patterns
  const sanitizeText = (text) => {
    if (typeof text !== 'string') return text;
    
    // Remove corrupted number patterns from strings
    let sanitized = text
      .replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '') // Remove exponential patterns with 2x digits
      .replace(/-1\.8\d*[eE][+-]?\d+/gi, '') // Remove -1.8e+ patterns
      .replace(/1\.8\d*[eE][+-]?2\d+/gi, '') // Remove 1.8e+22 patterns
      .replace(/-?\d+\.?\d*[eE][+-]?\d+/g, (match) => {
        // Check if parsed number is invalid
        const num = parseFloat(match);
        if (!isFinite(num) || Math.abs(num) >= 1e10) {
          return ''; // Remove invalid numbers
        }
        return match; // Keep valid numbers
      });
    
    return sanitized;
  };

  // Sanitize form values before PDF generation to remove corrupted data
  const sanitizeFormValues = (values) => {
    if (!values || typeof values !== 'object') {
      return {};
    }
    
    const sanitized = {};
    
    for (const [key, value] of Object.entries(values)) {
      // Skip signature fields (handled separately)
      if (key.toLowerCase().includes('signature')) {
        continue;
      }
      
      // Skip data URLs
      if (typeof value === 'string' && value.startsWith('data:')) {
        continue;
      }
      
      // Skip invalid numbers
      if (isInvalidNumber(value)) {
        continue;
      }
      
      // Skip very long strings
      if (typeof value === 'string' && value.length > 50000) {
        continue;
      }
      
      // Sanitize nested objects/arrays
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        const sanitizedObj = sanitizeFormValues(value);
        if (Object.keys(sanitizedObj).length > 0 && !isInvalidNumber(sanitizedObj)) {
          sanitized[key] = sanitizedObj;
        }
        continue;
      }
      
      if (Array.isArray(value)) {
        const sanitizedArr = value
          .filter(item => !isInvalidNumber(item))
          .filter(item => typeof item !== 'string' || !item.startsWith('data:'))
          .filter(item => typeof item !== 'string' || item.length <= 50000)
          .slice(0, 100); // Limit array size
        if (sanitizedArr.length > 0) {
          sanitized[key] = sanitizedArr;
        }
        continue;
      }
      
      // Keep valid primitives
      if (value !== null && value !== undefined && !isInvalidNumber(value)) {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      setBanner(null);
      const toastId = toast.loading('Generating PDF…', { description: 'This can take a few seconds on mobile.' });

      const preValidationIssues = [
        ...validatePropertyTrustSchedules(formValues),
        ...validateBPRTrustSchedules(formValues)
      ];

      if (preValidationIssues.length > 0) {
        setIsGeneratingPDF(false);
        toast.dismiss(toastId);
        setValidationIssues(preValidationIssues);
        setValidationModalOpen(true);
        toast.error('Cannot generate PDF', {
          description: 'Missing schedule content detected. Please complete all schedule fields.',
          duration: 5000
        });
        return;
      }

      // Aggressively sanitize all form values
      let sanitizedValues = sanitizeFormValues(formValues);
      
      const extractSignature = (value, maxLength = 3000000) => {
        if (
          value &&
          typeof value === 'string' &&
          value.startsWith('data:image') &&
          value.length > 100 &&
          value.length < maxLength
        ) {
          return value;
        }
        return null;
      };

      const testatorSignature = extractSignature(formValues.testatorSignature);
      const consultantSignature = extractSignature(formValues.consultantSignature);
      const clientSignature = extractSignature(formValues.clientSignature);
      
      // Final aggressive deep clean: recursively remove any corrupted data
      const deepClean = (obj) => {
        if (obj == null) return null;
        
        // Sanitize strings to remove corrupted numbers
        if (typeof obj === 'string') {
          const sanitized = sanitizeText(obj);
          return isInvalidNumber(sanitized) ? '' : sanitized;
        }
        
        if (typeof obj === 'number') {
          return isInvalidNumber(obj) ? null : obj;
        }
        
        if (typeof obj !== 'object') {
          return obj;
        }
        
        if (Array.isArray(obj)) {
          return obj
            .map(item => deepClean(item))
            .filter(item => item != null && !isInvalidNumber(item));
        }
        
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
          try {
            // Skip signature fields
            if (key.toLowerCase().includes('signature')) {
              continue;
            }
            
            const cleanedValue = deepClean(value);
            if (cleanedValue != null) {
              // Double-check string values
              if (typeof cleanedValue === 'string') {
                const finalSanitized = sanitizeText(cleanedValue);
                if (finalSanitized && !isInvalidNumber(finalSanitized)) {
                  cleaned[key] = finalSanitized;
                }
              } else {
                const testStr = JSON.stringify(cleanedValue);
                if (!isInvalidNumber(cleanedValue) && !isInvalidNumber(testStr)) {
                  cleaned[key] = cleanedValue;
                }
              }
            }
          } catch {
            // Skip corrupted fields
            continue;
          }
        }
        return cleaned;
      };
      
      sanitizedValues = deepClean(sanitizedValues);
      
      // Clear localStorage if corrupted data detected
      try {
        const testSerialization = JSON.stringify(sanitizedValues);
        if (isInvalidNumber(testSerialization) || testSerialization.includes('-1.8e+') || testSerialization.includes('1.8e+22')) {
          DEBUG_LOGS&&console.warn('[PDF] Corrupted data detected in formValues, clearing localStorage...');
          localStorage.removeItem('willForm');
          // Create minimal safe fallback
          sanitizedValues = {
            firstName: sanitizeText(String(formValues.firstName || '')),
            lastName: sanitizeText(String(formValues.lastName || ''))
          };
        }
      } catch {
        console.error('[PDF] Cannot validate sanitized data, using fallback');
        sanitizedValues = {
          firstName: sanitizeText(String(formValues.firstName || '')),
          lastName: sanitizeText(String(formValues.lastName || ''))
        };
      }
      
      // Final validation: ensure serialization works
      try {
        const test = JSON.stringify(sanitizedValues);
        if (isInvalidNumber(test)) {
          console.error('[PDF] Corrupted data still present after deep clean');
          sanitizedValues = { firstName: sanitizedValues.firstName || '', lastName: sanitizedValues.lastName || '' };
        }
      } catch {
        console.error('[PDF] Cannot serialize form values, using safe fallback');
        sanitizedValues = { firstName: sanitizedValues.firstName || '', lastName: sanitizedValues.lastName || '' };
      }
      
      // Final check: scan sanitizedValues one more time for any corrupted numbers
      const finalCheck = JSON.stringify(sanitizedValues);
      if (finalCheck.includes('-1.8') && (finalCheck.includes('e+22') || finalCheck.includes('e+2'))) {
        DEBUG_LOGS&&console.warn('[PDF] Corrupted data still detected! Clearing problematic fields...');
        // Find and remove the problematic field
        const problemFields = [];
        for (const [key, value] of Object.entries(sanitizedValues)) {
          const valueStr = String(value);
          if (valueStr.includes('-1.8') && (valueStr.includes('e+22') || valueStr.includes('e+2'))) {
            problemFields.push(key);
            delete sanitizedValues[key];
          }
        }
        if (problemFields.length > 0) {
          DEBUG_LOGS&&console.warn('[PDF] Removed corrupted fields:', problemFields);
        }
      }
      
      
      // Lazy-load the heavy PDF generator so initial app load stays fast.
      let generatePDFWithJSPDF;
      let importAttempts = 0;
      const maxRetries = 2;
      
      while (importAttempts <= maxRetries) {
        try {
          const pdfModule = await import('./PDFGeneratorJSPDF.js');
          generatePDFWithJSPDF = pdfModule.generatePDFWithJSPDF;
          break;
        } catch (error) {
          importAttempts++;
          if (importAttempts > maxRetries) {
            toast.error('Failed to load PDF generator', {
              description: 'There was a network error loading the PDF generator. Please check your connection and try again. Your data has been saved.',
              duration: 10000
            });
            // Data is preserved (formValues still in state), so user can retry
            return;
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * importAttempts));
        }
      }
      
      if (!generatePDFWithJSPDF) {
        toast.error('PDF generator not available', {
          description: 'Unable to load PDF generator. Please refresh the page and try again. Your data has been saved.',
          duration: 10000
        });
        return;
      }
      
      const pdfResult = await generatePDFWithJSPDF(sanitizedValues, {
        testatorSignature,
        consultantSignature,
        clientSignature
      });
      
      // Handle new return format: { doc, missingItems, schedulesMissing, hasPlaceholders, criticalIssues, hasCriticalIssues }
      const doc = pdfResult.doc || pdfResult;
      const missingItems = pdfResult.missingItems || [];
      const schedulesMissing = pdfResult.schedulesMissing || [];
      const hasPlaceholders = pdfResult.hasPlaceholders !== undefined ? pdfResult.hasPlaceholders : (missingItems.length > 0 || schedulesMissing.length > 0);
      const criticalIssues = pdfResult.criticalIssues || [];
      const hasCriticalIssues = pdfResult.hasCriticalIssues || false;
      
      if (hasCriticalIssues && criticalIssues.length > 0) {
        toast.error('PDF Generation Blocked', {
          description: `Cannot generate PDF: ${criticalIssues.length} critical issue(s) found. Please complete all required fields with missing subjects/beneficiaries.`,
          duration: 10000
        });
        
        // Show validation modal with critical issues
        const allIssues = [
          ...criticalIssues.map(issue => ({
            section: issue.section || 'Unknown',
            field: issue.field || 'Unknown',
            issue: issue.issue || 'Critical issue',
            snippet: issue.snippet || '',
            clauseNumber: issue.clauseNumber || null
          })),
          ...missingItems.filter(item => !criticalIssues.includes(item)),
          ...schedulesMissing.map(s => ({ 
            section: 'Schedules', 
            field: s, 
            issue: 'Schedule content not provided', 
            snippet: '', 
            clauseNumber: null
          }))
        ];
        setValidationIssues(allIssues);
        setValidationModalOpen(true);
        setIsGeneratingPDF(false);
        return;
      }
      
      // Store missing items for "View Issues" link
      if (hasPlaceholders) {
        // Map schedule numbers to user-friendly messages
        const scheduleIssues = schedulesMissing.map(scheduleText => {
          // Extract schedule number from "Schedule 2876070" format
          const scheduleMatch = scheduleText.match(/Schedule\s+(\d+)/i);
          const scheduleNumber = scheduleMatch ? scheduleMatch[1] : scheduleText;
          
          
          // Try to identify which field this schedule belongs to by checking form values
          let scheduleType = 'Schedule';
          let userFriendlyMessage = '';
          let fieldHint = '';
          let sectionName = '';
          
          // Check which fields are actually missing
          let missingFields = [];
          let targetFieldIds = [];
          let targetSectionIndex = -1;
          
          // Check if this schedule number matches any known schedule field
          // Use String comparison to handle number/string mismatches
          const propertyTrustScheduleNum = formValues.propertyTrustScheduleNumber ? 
            String(formValues.propertyTrustScheduleNumber).trim() : '';
          const bprTrustScheduleNum = formValues.bprTrustScheduleNumber ? 
            String(formValues.bprTrustScheduleNumber).trim() : '';
          
          DEBUG_LOGS&&console.log(`[SCHEDULE ISSUE MAPPING] Property Trust schedule number: "${propertyTrustScheduleNum}", BPR Trust: "${bprTrustScheduleNum}"`);
          DEBUG_LOGS&&console.log(`[SCHEDULE ISSUE MAPPING] Comparing Property Trust: "${propertyTrustScheduleNum}" === "${scheduleNumber}"`);
          
          if (propertyTrustScheduleNum === scheduleNumber || 
              propertyTrustScheduleNum === String(scheduleText).replace(/Schedule\s+/i, '').trim()) {
            DEBUG_LOGS&&console.log(`[SCHEDULE ISSUE MAPPING] ✅ Matched Property Trust schedule ${scheduleNumber}`);
            scheduleType = 'Property Trust Schedule';
            sectionName = 'Property Trust';
            
            // Check which specific fields are missing
            if (!formValues.propertyTrustDetails || formValues.propertyTrustDetails.trim() === '') {
              missingFields.push('"Property Details"');
              targetFieldIds.push('propertyTrustDetails');
            }
            if (!formValues.propertyTrustTerms || formValues.propertyTrustTerms.trim() === '') {
              missingFields.push('"Property Trust Terms"');
              targetFieldIds.push('propertyTrustTerms');
            }
            
            // Find the section index for Property Trust
            targetSectionIndex = formData.formSections.findIndex(s => s.formSection === 'Property Trust');
            
            userFriendlyMessage = missingFields.length > 0 
              ? `Missing ${missingFields.join(' and ')} in Property Trust section.`
              : `Property Trust schedule details are incomplete.`;
            fieldHint = `Go to "Property Trust" section and fill in: ${missingFields.join(' and ')}`;
            
          } else if (bprTrustScheduleNum === scheduleNumber || 
                     bprTrustScheduleNum === String(scheduleText).replace(/Schedule\s+/i, '').trim()) {
            DEBUG_LOGS&&console.log(`[SCHEDULE ISSUE MAPPING] Comparing BPR Trust: "${bprTrustScheduleNum}" === "${scheduleNumber}"`);
            DEBUG_LOGS&&console.log(`[SCHEDULE ISSUE MAPPING] ✅ Matched BPR Trust schedule ${scheduleNumber}`);
            scheduleType = 'Business Property Relief Trust Schedule';
            sectionName = 'Business Interests';
            
            // Check which specific fields are missing
            if (!formValues.bprTrustDetails || formValues.bprTrustDetails.trim() === '') {
              missingFields.push('"Business Property Details"');
              targetFieldIds.push('bprTrustDetails');
            }
            if (!formValues.bprTrustTerms || formValues.bprTrustTerms.trim() === '') {
              missingFields.push('"Business Property Relief Trust Terms"');
              targetFieldIds.push('bprTrustTerms');
            }
            
            // Find the section index for Business Interests
            targetSectionIndex = formData.formSections.findIndex(s => s.formSection === 'Business Interests');
            
            userFriendlyMessage = missingFields.length > 0 
              ? `Missing ${missingFields.join(' and ')} in Business Interests section.`
              : `Business Property Relief Trust schedule details are incomplete.`;
            fieldHint = `Go to "Business Interests" section and fill in: ${missingFields.join(' and ')}`;
            
          } else {
            // Generic message for unknown schedules - make it user-friendly
            DEBUG_LOGS&&console.log(`[SCHEDULE ISSUE MAPPING] ❌ No match found for schedule ${scheduleNumber}, using generic message`);
            scheduleType = 'Schedule';
            sectionName = 'Schedules'; // Use 'Schedules' so navigation can still try to match by number
            userFriendlyMessage = `A schedule (Schedule ${scheduleNumber}) was referenced in your Will, but the details for that schedule were not provided.`;
            fieldHint = 'Please check sections that mention schedules (like "Property Trust" or "Business Interests") and ensure all schedule details are filled in.';
          }
          
          const issueObject = {
            section: sectionName || scheduleType,
            field: scheduleText,
            fieldId: targetFieldIds[0] || null, // Use first missing field for navigation, or null if unknown
            targetFieldIds: targetFieldIds.length > 0 ? targetFieldIds : [], // All fields that need to be filled
            targetSectionIndex: targetSectionIndex >= 0 ? targetSectionIndex : undefined, // Section to navigate to
            issue: userFriendlyMessage,
            message: `${userFriendlyMessage} ${fieldHint}`,
            snippet: fieldHint,
            scheduleNumber: scheduleNumber, // Keep original for navigation
            fieldLabel: scheduleText,
            missingFields: missingFields // List of missing field names
          };
          
          return issueObject;
        });
        
        setValidationIssues([...missingItems, ...scheduleIssues]);
      }
      
      // Generate a descriptive filename with testator name and date
      const testatorName = formValues.firstName && formValues.lastName 
        ? `${formValues.firstName}-${formValues.lastName}`
        : 'Will';
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `${testatorName}-Last-Will-${currentDate}.pdf`;

      const pdfBlob = doc.output('blob');
      const pdfDataUri = doc.output('datauristring');
      const pdfArrayBuffer = doc.output('arraybuffer');

      // Create a proper PDF blob with explicit MIME type
      const properPdfBlob = new Blob([pdfArrayBuffer], { 
        type: 'application/pdf' 
      });

      // Create download link with forced filename
      const downloadUrl = URL.createObjectURL(properPdfBlob);
      const downloadLink = document.createElement('a');
      
      // Force download attributes
      downloadLink.href = downloadUrl;
      downloadLink.download = filename;
      downloadLink.type = 'application/pdf';
      downloadLink.style.display = 'none';

      document.body.appendChild(downloadLink);
      downloadLink.click();

      setTimeout(() => {
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(downloadUrl);
      }, 100);
      
      // Show appropriate toast message based on completion level
      setTimeout(() => {
        if (hasPlaceholders) {
          toast.error('DRAFT INCOMPLETE - Not ready for signing', { 
            id: toastId, 
            description: 'PDF contains blanks and placeholder text. Complete all sections before creating final Will.' 
          });
          setBanner({ 
            type: 'warning', 
            message: '⚠️  This PDF is a DRAFT with incomplete content. Do not sign - complete all form sections first.',
            missingItems: missingItems,
            schedulesMissing: schedulesMissing
          });
        } else {
          toast.success('PDF ready', { 
            id: toastId, 
            description: 'Professional Will generated successfully.' 
          });
          setBanner(null); // Clear banner if no issues
        }
      }, 500);

      setIsGeneratingPDF(false);
    } catch (error) {
      const msg = error?.message || 'Unknown error';
      setBanner({ type: 'error', message: `Error generating PDF: ${msg}` });
      toast.error('Error generating PDF', { description: msg });
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh bg-gray-50">
      {/* Sidebar */}
      <Sidebar currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} />

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex justify-center py-4 px-3 sm:py-6 sm:px-6 lg:px-8 animate-fadeIn">
        <div className="w-full max-w-6xl">
          <div className="flex flex-col lg:flex-row gap-6">
            <section 
              className="w-full max-w-3xl bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-5 md:p-6 border border-gray-200 transition-all duration-300 hover:shadow-2xl"
              aria-label={`Form section: ${currentSection?.formSection || 'Questionnaire'}`}
              role="region"
            >
              {banner?.message ? (
                <div
                  className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
                    banner.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-800'
                  }`}
                  role={banner.type === 'error' ? 'alert' : 'status'}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span>{banner.message}</span>
                    {(banner.missingItems?.length > 0 || banner.schedulesMissing?.length > 0) && (
                      <button
                        onClick={() => {
                          const allIssues = [
                            ...(banner.missingItems || []),
                            ...(banner.schedulesMissing?.map(s => ({ 
                              section: 'Schedules', 
                              field: s, 
                              issue: 'Schedule content not provided', 
                              snippet: '',
                              clauseNumber: null
                            })) || [])
                          ];
                          setValidationIssues(allIssues);
                          setValidationModalOpen(true);
                        }}
                        className="text-xs font-semibold underline hover:no-underline focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 rounded px-2 py-1 -mt-1 -mr-1"
                        aria-label="View incomplete items"
                      >
                        View Issues →
                      </button>
                    )}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 leading-tight">
                  {formData.formTitle || 'Legacy Last Will & Testament Questionnaire'}
                </h1>
              </div>

              <div className="mb-3">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Sparkles size={14} className="text-indigo-500" />
                    Progress
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {formCompletionPercent}% Complete
                    </span>
                    <span className="text-sm font-semibold text-indigo-600">
                      Step {currentIndex + 1} of {formData.formSections.length}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner mb-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 h-3 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
                    style={{ width: `${((currentIndex + 1) / formData.formSections.length) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  {/* Fixed-height container to prevent layout shift when save status appears/disappears */}
                  <div className="flex items-center gap-2 text-gray-500 min-h-[20px] min-w-[120px]">
                    {isSaving ? (
                      <>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse flex-shrink-0"></div>
                        <span>Saving...</span>
                      </>
                    ) : lastSaved ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        <span>Saved {formatLastSaved(lastSaved)}</span>
                      </>
                    ) : (
                      <span className="invisible" aria-hidden="true">Saved</span>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-green-500 to-green-600 h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${formCompletionPercent}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-3">
                  {currentIndex >= 1 && (
                    <button
                      onClick={() => {
                        setClauseModalOpen(true);
                      }}
                      className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-lg transition-all duration-300 font-medium min-h-[44px] touch-manipulation text-sm sm:text-base w-full sm:w-auto ${
                        clausePreview && clausePreview.length > 0
                          ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 active:from-purple-800 active:to-purple-900 text-white'
                          : 'bg-gradient-to-r from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 active:from-gray-600 active:to-gray-700 text-white'
                      }`}
                      type="button"
                    >
                      <Scroll size={18} className="sm:w-5 sm:h-5" />
                      <span>View Clauses ({clausePreview?.length || 0})</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Download PDF button ONLY shows on the FINAL step (last section) AND when form is fully completed */}
                  {currentIndex === formData.formSections.length - 1 && isFormFullyCompleted() ? (
                    <button
                      onClick={() => {
                        handleDownloadPDF();
                      }}
                      disabled={isGeneratingPDF}
                      className={`flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:from-indigo-800 active:to-indigo-900 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-lg transition-all duration-300 font-medium z-10 relative min-h-[44px] touch-manipulation text-sm sm:text-base w-full sm:w-auto ${
                        isGeneratingPDF 
                          ? 'opacity-75 cursor-not-allowed' 
                          : 'cursor-pointer animate-pulse-subtle'
                      }`}
                      type="button"
                      aria-label={isGeneratingPDF ? "Generating PDF, please wait" : "Download PDF document"}
                      aria-busy={isGeneratingPDF}
                    >
                      {isGeneratingPDF ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span className="whitespace-nowrap">Generating PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download size={20} className="animate-bounce-subtle" />
                          <span>Download PDF</span>
                        </>
                      )}
                    </button>
                  ) : currentIndex === formData.formSections.length - 1 ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                      <AlertCircle size={16} />
                      <span className="italic">Complete all required fields to enable download</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                      <AlertCircle size={16} />
                      <span className="italic">Complete all steps to enable download</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3 pb-1.5 border-b-2 border-indigo-600">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileText className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
                  {currentSection.formSection}
                </h2>
              </div>

              <div className="space-y-3">
                {currentSection.fields.map((field, idx) => {
                  // Skip fields that shouldn't be shown (conditions not met)
                  if (field.conditions && !evaluateFieldConditions(field)) {
                    return null;
                  }
                  
                  // Enhanced label for partner name field with clear instructions
                  let displayLabel = field.label;
                  if (field.id === 'partnerFullName') {
                    if (formValues.maritalStatus === 'Cohabiting') {
                      displayLabel = "Co-habiting Partner's Full Name";
                    } else if (formValues.maritalStatus === 'Married') {
                      displayLabel = "Spouse's Full Name";
                    } else if (formValues.maritalStatus === 'Civil Partnership') {
                      displayLabel = "Civil Partner's Full Name";
                    } else {
                      displayLabel = "Partner's Full Name (Future Spouse/Partner)";
                    }
                  }
                  const interpolatedFieldWillClause = field.willClauseText
                    ? interpolateText(field.willClauseText, formValues)
                    : null;

                  const interpolatedOptions = field.options
                    ? field.options.map(opt => ({
                        ...opt,
                        willClauseText: opt.willClauseText
                          ? interpolateText(opt.willClauseText, formValues)
                          : null
                      }))
                    : null;

                  return (
                    <div
                      key={field.id}
                      className="animate-slideIn opacity-0 transition-all duration-300"
                      style={{
                        animationDelay: `${idx * 0.05}s`,
                        animationFillMode: 'forwards'
                      }}
                    >
                      <FieldRenderer
                        field={{
                          ...field,
                          label: displayLabel,
                          // Add helpful info text for partner name field
                          infoText: field.id === 'partnerFullName' ? 
                            "Simply type your partner's full name in the field above. The form saves automatically as you type - no need to press any buttons!" : 
                            field.infoText,
                          willClauseText: interpolatedFieldWillClause,
                          options: interpolatedOptions || field.options
                        }}
                        formValues={formValues}
                        setFormValues={setFormValues}
                        expandedFields={expandedFields}
                        setExpandedFields={setExpandedFields}
                        evaluateFieldConditions={evaluateFieldConditions}
                      />
                    </div>
                  );
                }).filter(Boolean)}
                {null}
              </div>

              <div className="flex flex-col sm:flex-row justify-between mt-6 gap-3">
                <button
                    onClick={() => {
                    if (currentIndex > 0) {
                      const formSection = document.querySelector('section');
                      if (formSection) {
                        formSection.style.opacity = '0';
                        formSection.style.transform = 'translateY(-10px)';
                      }
                      
                      setTimeout(() => {
                        setCurrentIndex(currentIndex - 1);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        
                        setTimeout(() => {
                          const newFormSection = document.querySelector('section');
                          if (newFormSection) {
                            newFormSection.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                            newFormSection.style.opacity = '1';
                            newFormSection.style.transform = 'translateY(0)';
                          }
                        }, 50);
                      }, 150);
                    }
                  }}
                  disabled={currentIndex === 0}
                  className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 active:bg-gray-400 text-gray-700 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium min-h-[44px] touch-manipulation shadow-md disabled:shadow-none text-sm sm:text-base"
                  aria-label="Go to previous section"
                >
                  <ChevronLeft size={18} className="sm:w-5 sm:h-5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleNextButtonClick}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-lg transition-all duration-300 font-medium min-h-[44px] touch-manipulation text-sm sm:text-base ${
                    allRequiredFilled
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:from-indigo-800 active:to-indigo-900 text-white'
                      : 'bg-gradient-to-r from-indigo-400 to-indigo-500 text-white opacity-75 cursor-pointer hover:opacity-90 active:opacity-100'
                  }`}
                  type="button"
                  title={!allRequiredFilled ? 'Click to see what needs to be completed' : ''}
                >
                  <span>{currentIndex === formData.formSections.length - 1 ? 'Submit' : 'Next'}</span>
                  <ChevronRight size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>


              <div className="mt-4 flex flex-col gap-3 pb-20 lg:pb-0">
                <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                  <button
                    onClick={() => saveDraft()}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 active:from-yellow-600 active:to-yellow-700 text-black px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-md transition-all duration-300 font-medium min-h-[44px] touch-manipulation text-sm sm:text-base w-full sm:w-auto"
                    type="button"
                  >
                    <Save size={18} className="sm:w-5 sm:h-5" />
                    <span>Save Draft</span>
                  </button>
                  <button
                    onClick={() => resetForm()}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 active:from-red-700 active:to-red-800 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-md transition-all duration-300 font-medium min-h-[44px] touch-manipulation text-sm sm:text-base w-full sm:w-auto"
                    type="button"
                    title="Clear all saved data and start from scratch - perfect for testing!"
                  >
                    <RotateCcw size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">Clear Data / Start Fresh</span>
                  </button>
                  <button
                    onClick={() => handleAutoFill()}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-md transition-all duration-300 font-medium min-h-[44px] touch-manipulation text-sm sm:text-base w-full sm:w-auto"
                    type="button"
                    title="Fill the entire form with dummy data for testing - all fields will be populated!"
                  >
                    <Zap size={18} className="sm:w-5 sm:h-5" />
                    <span className="whitespace-nowrap">Auto-Fill Form (Test Data)</span>
                  </button>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-2 flex items-start gap-2 px-1">
                  <Info size={14} className="mt-0.5 flex-shrink-0" />
                  <span><strong>Tip:</strong> Use "Clear Data / Start Fresh" to remove all saved information, or "Auto-Fill Form" to populate all fields with test data for testing.</span>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Clause Preview Modal */}
      {clauseModalOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 px-4 animate-fadeIn"
          onClick={() => setClauseModalOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="clause-modal-title"
        >
          <div 
            className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col animate-slideIn my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Scroll className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Clause Preview</h2>
                  <p className="text-sm text-indigo-100 mt-0.5">
                    {clausePreview?.length || 0} {clausePreview?.length === 1 ? 'clause' : 'clauses'} generated
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setClauseModalOpen(false);
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-gradient-to-br from-indigo-50 via-white to-blue-50">
              {clausePreview && clausePreview.length > 0 ? (
                <div className="space-y-4">
                  {clausePreview.map((clause) => (
                    <div
                      key={clause.id}
                      className="bg-white border-l-4 border-indigo-500 rounded-r-lg p-4 shadow-md hover:shadow-lg transition-all duration-300"
                      data-clause-id={clause.id}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-indigo-700 mb-2 uppercase tracking-wide">
                            {clause.fieldLabel}
                          </p>
                          <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-line">
                            {clause.text}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                    <Scroll className="w-10 h-10 text-gray-400" />
                  </div>
                  <p className="text-gray-600 font-medium mb-1.5">No clauses to preview yet</p>
                  <p className="text-sm text-gray-500">
                    Complete the form fields above to see generated will clauses appear here
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setClauseModalOpen(false);
                }}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all duration-200 font-medium"
                aria-label="Close clause preview modal"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

          {/* Validation Modal */}
          {(() => {
            DEBUG_LOGS&&console.log('[VALIDATION MODAL] ========== MODAL RENDER CHECK ==========');
            DEBUG_LOGS&&console.log('[VALIDATION MODAL] validationModalOpen:', validationModalOpen);
            DEBUG_LOGS&&console.log('[VALIDATION MODAL] validationIssues.length:', validationIssues.length);
            DEBUG_LOGS&&console.log('[VALIDATION MODAL] validationIssues:', validationIssues);
            return null;
          })()}
          {validationModalOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 px-4 animate-fadeIn"
          onClick={(e) => {
            DEBUG_LOGS&&console.log('[MODAL BACKDROP] ========== BACKDROP CLICKED ==========');
            DEBUG_LOGS&&console.log('[MODAL BACKDROP] Event target:', e.target);
            DEBUG_LOGS&&console.log('[MODAL BACKDROP] Event currentTarget:', e.currentTarget);
            DEBUG_LOGS&&console.log('[MODAL BACKDROP] Target === CurrentTarget:', e.target === e.currentTarget);
            if (e.target === e.currentTarget) {
              DEBUG_LOGS&&console.log('[MODAL BACKDROP] Closing modal (clicked backdrop)');
              setValidationModalOpen(false);
            } else {
              DEBUG_LOGS&&console.log('[MODAL BACKDROP] Click was inside modal, not closing');
            }
          }}
          onMouseDown={(e) => {
            DEBUG_LOGS&&console.log('[MODAL BACKDROP] ========== BACKDROP MOUSE DOWN ==========');
            DEBUG_LOGS&&console.log('[MODAL BACKDROP] Event target:', e.target);
            DEBUG_LOGS&&console.log('[MODAL BACKDROP] Event currentTarget:', e.currentTarget);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-slideIn"
            onClick={(e) => {
              DEBUG_LOGS&&console.log('[MODAL CONTENT] ========== MODAL CONTENT CLICKED ==========');
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Event target:', e.target);
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Event target tagName:', e.target.tagName);
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Event target className:', e.target.className);
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Event currentTarget:', e.currentTarget);
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Is button or inside button:', e.target.tagName === 'BUTTON' || e.target.closest('button') !== null);
              // Only stop propagation if clicking on the modal content itself, not on buttons inside
              if (e.target === e.currentTarget || (e.target.tagName !== 'BUTTON' && e.target.closest('button') === null)) {
                DEBUG_LOGS&&console.log('[MODAL CONTENT] Stopping propagation (clicked on modal content, not button)');
                e.stopPropagation();
              } else {
                DEBUG_LOGS&&console.log('[MODAL CONTENT] NOT stopping propagation (clicked on button)');
              }
            }}
            onMouseDown={(e) => {
              DEBUG_LOGS&&console.log('[MODAL CONTENT] ========== MODAL CONTENT MOUSE DOWN ==========');
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Event target:', e.target);
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Event target tagName:', e.target.tagName);
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Event currentTarget:', e.currentTarget);
              DEBUG_LOGS&&console.log('[MODAL CONTENT] Is button or inside button:', e.target.tagName === 'BUTTON' || e.target.closest('button') !== null);
            }}
            ref={(el) => {
              if (el) {
                DEBUG_LOGS&&console.log('[VALIDATION MODAL] ========== MODAL ELEMENT RENDERED ==========');
                DEBUG_LOGS&&console.log('[VALIDATION MODAL] validationIssues.length:', validationIssues.length);
                DEBUG_LOGS&&console.log('[VALIDATION MODAL] validationIssues:', validationIssues);
                DEBUG_LOGS&&console.log('[VALIDATION MODAL] Button should render:', validationIssues.length > 0);
              }
            }}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <AlertCircle size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {validationIssues.some(issue => issue.fieldId) 
                      ? 'Please Complete Required Fields'
                      : 'Draft Will - Incomplete Items'}
                  </h2>
                  <p className="text-sm text-red-100 mt-0.5">
                    {validationIssues.length} {validationIssues.length === 1 ? 'item needs' : 'items need'} to be completed
                  </p>
                </div>
              </div>
              <button
                onClick={() => setValidationModalOpen(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <p className="text-gray-700 mb-4">
                {validationIssues.some(issue => issue.fieldId) 
                  ? 'Before you can proceed to the next section, please complete the following required fields:'
                  : 'This PDF contains incomplete content. Please complete the following items:'}
              </p>
              
              <div className="space-y-3">
                {validationIssues.map((issue, index) => {
                  // Handle both validation format (fieldId) and PDF missing items format (section/field)
                  const fieldId = issue.fieldId || issue.field;
                  
                  // For schedules, show a more user-friendly label
                  const isScheduleIssue = issue.scheduleNumber || (issue.section && (issue.section.toLowerCase().includes('schedule') || issue.section === 'Schedules'));
                  let fieldLabel = issue.fieldLabel || `${issue.section}: ${issue.field}`;
                  if (isScheduleIssue) {
                    // For schedule issues, show the section name instead of the schedule number
                    fieldLabel = `${issue.section || 'Schedule'}: Missing Details`;
                  }
                  
                  // For schedule issues, provide a more helpful display message
                  let message = isScheduleIssue 
                    ? (issue.message || `${issue.issue || 'Schedule details missing'}. ${issue.snippet || ''}`)
                    : (issue.message || issue.issue || issue.snippet);
                  
                  // Improve message clarity - if it's a string from old format, make it user-friendly
                  if (typeof message === 'string') {
                    // Handle old string format like "CRITICAL: Field Name - description"
                    if (message.startsWith('CRITICAL:')) {
                      message = message.replace('CRITICAL:', '⚠️ CRITICAL:').trim();
                    } else if (message.startsWith('EXECUTION:')) {
                      message = message.replace('EXECUTION:', '✍️ EXECUTION:').trim();
                    } else if (message.startsWith('PROFESSIONAL:')) {
                      message = message.replace('PROFESSIONAL:', '👔 PROFESSIONAL:').trim();
                    } else if (message.startsWith('CHARITY:')) {
                      message = message.replace('CHARITY:', '💝 CHARITY:').trim();
                    } else if (message.startsWith('PLACEHOLDER:')) {
                      message = message.replace('PLACEHOLDER:', '📝 PLACEHOLDER:').trim();
                    } else if (message.startsWith('PET CARE:')) {
                      message = message.replace('PET CARE:', '🐾 PET CARE:').trim();
                    }
                  }
                  
                  // If message is still unclear, create a better one
                  if (!message || message.trim() === '' || message === '(empty)') {
                    if (issue.section && issue.field) {
                      message = `Missing information in "${issue.section}" section: ${issue.field}`;
                    } else if (issue.field) {
                      message = `Missing: ${issue.field}`;
                    } else {
                      message = 'Missing required information';
                    }
                  }
                  
                  const clauseNumber = issue.clauseNumber;
                  
                  return (
                    <button
                      key={fieldId || index}
                      ref={(el) => {
                        if (el) {
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] ========== ITEM BUTTON RENDERED ==========`);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Index: ${index}`);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Field ID: ${fieldId}`);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Element:`, el);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Element tagName:`, el.tagName);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Element className:`, el.className);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Element disabled:`, el.disabled);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Element tabIndex:`, el.tabIndex);
                          DEBUG_LOGS&&console.log(`[ITEM RENDER] Has onClick:`, !!el.onclick);
                        }
                      }}
                      onMouseDown={(e) => {
                        DEBUG_LOGS&&console.log('[ITEM MOUSEDOWN] ========== MOUSE DOWN ON ITEM ==========');
                        DEBUG_LOGS&&console.log('[ITEM MOUSEDOWN] Event:', e);
                        DEBUG_LOGS&&console.log('[ITEM MOUSEDOWN] Target:', e.target);
                        DEBUG_LOGS&&console.log('[ITEM MOUSEDOWN] Current target:', e.currentTarget);
                        DEBUG_LOGS&&console.log('[ITEM MOUSEDOWN] Issue index:', index);
                        DEBUG_LOGS&&console.log('[ITEM MOUSEDOWN] Issue:', issue);
                      }}
                      onKeyDown={(e) => {
                        DEBUG_LOGS&&console.log('[ITEM KEYDOWN] ========== KEY PRESSED ON ITEM ==========');
                        DEBUG_LOGS&&console.log('[ITEM KEYDOWN] Key:', e.key);
                        DEBUG_LOGS&&console.log('[ITEM KEYDOWN] Code:', e.code);
                        DEBUG_LOGS&&console.log('[ITEM KEYDOWN] Issue index:', index);
                        if (e.key === 'Enter' || e.key === ' ') {
                          DEBUG_LOGS&&console.log('[ITEM KEYDOWN] Enter/Space pressed - triggering click');
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                      onClick={(e) => {
                        DEBUG_LOGS&&console.log('[ITEM CLICK] ========== ITEM CLICKED ==========');
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event:', e);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event type:', e.type);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event target:', e.target);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event target tagName:', e.target.tagName);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event target className:', e.target.className);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event currentTarget:', e.currentTarget);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event defaultPrevented:', e.defaultPrevented);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event isTrusted:', e.isTrusted);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event bubbles:', e.bubbles);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event cancelable:', e.cancelable);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Event timeStamp:', e.timeStamp);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue index:', index);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue object:', issue);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue keys:', Object.keys(issue));
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue section:', issue.section);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue field:', issue.field);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue fieldId:', issue.fieldId);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue issue:', issue.issue);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue message:', issue.message);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Issue snippet:', issue.snippet);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Computed fieldId:', fieldId);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Computed fieldLabel:', fieldLabel);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Is schedule issue:', isScheduleIssue);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Button element:', e.currentTarget);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Button disabled:', e.currentTarget.disabled);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Button tabIndex:', e.currentTarget.tabIndex);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Button style.pointerEvents:', window.getComputedStyle(e.currentTarget).pointerEvents);
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Button style.zIndex:', window.getComputedStyle(e.currentTarget).zIndex);
                        
                        e.preventDefault();
                        e.stopPropagation();
                        DEBUG_LOGS&&console.log('[ITEM CLICK] Prevented default and stopped propagation');
                        
                        try {
                          // Handle schedule issues with specific navigation - use sectionId first, then fallback to index
                          if (isScheduleIssue) {
                            DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Schedule issue detected');
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Section ID:', issue.sectionId);
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Target section index:', issue.targetSectionIndex);
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Target field IDs:', issue.targetFieldIds);
                            
                            let targetIndex = -1;
                            
                            // PRIMARY: Use sectionId to find section (more reliable than index)
                            if (issue.sectionId) {
                              const sectionByField = formData.formSections.find(section => 
                                section.fields?.some(field => field.id === issue.sectionId)
                              );
                              if (sectionByField) {
                                targetIndex = formData.formSections.findIndex(s => s.formSection === sectionByField.formSection);
                                DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Found section by sectionId:', issue.sectionId, '→ index:', targetIndex);
                              }
                            }
                            
                            // FALLBACK: Use section name to find index
                            if (targetIndex < 0 && issue.section) {
                              targetIndex = formData.formSections.findIndex(s => s.formSection === issue.section);
                              if (targetIndex >= 0) {
                                DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Found section by section name:', issue.section, '→ index:', targetIndex);
                              }
                            }
                            
                            // FINAL FALLBACK: Use provided targetSectionIndex (least reliable)
                            if (targetIndex < 0 && issue.targetSectionIndex !== undefined && issue.targetSectionIndex >= 0) {
                              if (issue.targetSectionIndex < formData.formSections.length) {
                                targetIndex = issue.targetSectionIndex;
                                DEBUG_LOGS&&console.log('[ITEM CLICK] ⚠️ Using provided targetSectionIndex as fallback:', targetIndex);
                              }
                            }
                            
                            if (targetIndex < 0 || targetIndex >= formData.formSections.length) {
                              console.error('[ITEM CLICK] ❌ Could not determine valid section index');
                              return;
                            }
                            
                            // Navigate to the correct section first
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Setting current index to:', targetIndex);
                            setCurrentIndex(targetIndex);
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Closing validation modal');
                            setValidationModalOpen(false);
                            
                            // Wait for section to render, then scroll to first missing field
                            setTimeout(() => {
                              DEBUG_LOGS&&console.log('[ITEM CLICK] Timeout fired, attempting to scroll to field');
                              if (issue.targetFieldIds && issue.targetFieldIds.length > 0) {
                                const firstFieldId = issue.targetFieldIds[0];
                                DEBUG_LOGS&&console.log('[ITEM CLICK] Scrolling to first missing field:', firstFieldId);
                                scrollToField(firstFieldId);
                              } else if (issue.fieldId) {
                                DEBUG_LOGS&&console.log('[ITEM CLICK] Scrolling to fieldId:', issue.fieldId);
                                scrollToField(issue.fieldId);
                              } else {
                                DEBUG_LOGS&&console.log('[ITEM CLICK] No target field IDs, scrolling to top');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }
                            }, 300);
                            return;
                          }
                          
                          if (issue.fieldId && !isScheduleIssue) {
                            DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Has fieldId, calling scrollToField with:', issue.fieldId);
                            scrollToField(issue.fieldId);
                          } else if (isScheduleIssue || issue.section === 'Schedules' || (issue.field && issue.field.toLowerCase().includes('schedule'))) {
                            DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Detected as schedule field');
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Section check:', issue.section === 'Schedules');
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Field includes schedule:', issue.field && issue.field.toLowerCase().includes('schedule'));
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Calling scrollToScheduleField with:', issue.field);
                            // Handle schedule fields specially
                            scrollToScheduleField(issue.field);
                          } else {
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Not a schedule, trying regular field search for:', issue.field);
                            // For other PDF issues, try to find and scroll to the field
                            const fieldElement = document.querySelector(`[data-field-id="${issue.field}"]`);
                            DEBUG_LOGS&&console.log('[ITEM CLICK] Direct querySelector result:', fieldElement);
                            if (fieldElement) {
                              DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Found field element, scrolling...');
                              fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              fieldElement.focus();
                              setValidationModalOpen(false);
                            } else {
                              DEBUG_LOGS&&console.log('[ITEM CLICK] Direct search failed, trying case-insensitive search...');
                              // Try case-insensitive search
                              const allFields = document.querySelectorAll('[data-field-id]');
                              DEBUG_LOGS&&console.log('[ITEM CLICK] Total fields with data-field-id:', allFields.length);
                              const foundField = Array.from(allFields).find(field => {
                                const fieldId = field.getAttribute('data-field-id') || '';
                                return fieldId.toLowerCase() === issue.field.toLowerCase() || 
                                       fieldId.toLowerCase().includes(issue.field.toLowerCase());
                              });
                              DEBUG_LOGS&&console.log('[ITEM CLICK] Case-insensitive search result:', foundField);
                              if (foundField) {
                                DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Found field via case-insensitive search, scrolling...');
                                foundField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                const input = foundField.querySelector('input, textarea, select');
                                if (input) {
                                  setTimeout(() => input.focus(), 500);
                                }
                                setValidationModalOpen(false);
                              } else {
                                console.error('[ITEM CLICK] ❌ Could not find field:', issue.field);
                              }
                            }
                          }
                        } catch (error) {
                          console.error('[ITEM CLICK] ❌ ERROR during click handler:', error);
                          console.error('[ITEM CLICK] Error stack:', error.stack);
                        }
                      }}
                      className="w-full text-left p-4 bg-red-50 border-l-4 border-red-500 rounded-lg hover:bg-red-100 transition-all duration-200 group cursor-pointer"
                      tabIndex={0}
                      role="button"
                      aria-label={`Go to ${fieldLabel}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center justify-center w-6 h-6 bg-red-500 text-white rounded-full text-sm font-bold">
                              {index + 1}
                            </span>
                            <h3 className="font-semibold text-gray-900">{fieldLabel}</h3>
                            {clauseNumber && (
                              <span className="text-xs bg-red-200 text-red-800 px-2 py-0.5 rounded">
                                Clause {clauseNumber}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 ml-8 font-medium">{message}</p>
                          {isScheduleIssue && issue.missingFields && issue.missingFields.length > 0 && (
                            <div className="mt-2 ml-8">
                              <p className="text-xs text-gray-700 font-semibold mb-1">Missing fields:</p>
                              <ul className="text-xs text-gray-600 list-disc list-inside space-y-1">
                                {issue.missingFields.map((fieldName, idx) => (
                                  <li key={idx}>{fieldName}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {isScheduleIssue && issue.snippet && (
                            <p className="text-xs text-blue-600 mt-2 ml-8 font-medium flex items-start gap-1">
                              <span>👉</span>
                              <span>{issue.snippet}</span>
                            </p>
                          )}
                          {!isScheduleIssue && issue.snippet && issue.snippet !== message && (
                            <p className="text-xs text-gray-500 ml-8 mt-1 italic">"{issue.snippet.substring(0, 100)}..."</p>
                          )}
                        </div>
                        <ArrowRight 
                          size={18} 
                          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" 
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              {DEBUG_LOGS&&console.log('[VALIDATION MODAL FOOTER] Rendering footer, validationIssues.length:', validationIssues.length, 'validationIssues:', validationIssues) || null}
              <button
                onClick={() => setValidationModalOpen(false)}
                className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-all duration-200 font-medium"
              >
                Close
              </button>
              {validationIssues.length > 0 && (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] ========== MOUSE DOWN ==========');
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event:', e);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event type:', e.type);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event target:', e.target);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event target tagName:', e.target.tagName);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event target className:', e.target.className);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event currentTarget:', e.currentTarget);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event defaultPrevented:', e.defaultPrevented);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event isTrusted:', e.isTrusted);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Event bubbles:', e.bubbles);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Button element:', e.currentTarget);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Button disabled:', e.currentTarget.disabled);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE MOUSEDOWN] Button tabIndex:', e.currentTarget.tabIndex);
                  }}
                  onKeyDown={(e) => {
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] ========== KEY PRESSED ==========');
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Key:', e.key);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Code:', e.code);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Event type:', e.type);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Event target:', e.target);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Event currentTarget:', e.currentTarget);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Event defaultPrevented:', e.defaultPrevented);
                    if (e.key === 'Enter' || e.key === ' ') {
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Enter/Space pressed - triggering click');
                      e.preventDefault();
                      e.stopPropagation();
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE KEYDOWN] Calling click() on button element');
                      e.currentTarget.click();
                    }
                  }}
                  onFocus={(e) => {
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE FOCUS] ========== BUTTON FOCUSED ==========');
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE FOCUS] Event:', e);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE FOCUS] Event target:', e.target);
                  }}
                  onBlur={(e) => {
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE BLUR] ========== BUTTON BLURRED ==========');
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE BLUR] Event:', e);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE BLUR] Event target:', e.target);
                  }}
                  onClick={(e) => {
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ========== BUTTON CLICKED ==========');
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event:', e);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event type:', e.type);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event target:', e.target);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event currentTarget:', e.currentTarget);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event defaultPrevented:', e.defaultPrevented);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event isTrusted:', e.isTrusted);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event bubbles:', e.bubbles);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Event cancelable:', e.cancelable);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Validation issues exists:', !!validationIssues);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Validation issues type:', typeof validationIssues);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Validation issues is array:', Array.isArray(validationIssues));
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Validation issues count:', validationIssues?.length);
                    DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue exists:', !!validationIssues?.[0]);
                    
                    if (validationIssues?.[0]) {
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue object:', validationIssues[0]);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue keys:', Object.keys(validationIssues[0]));
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue section:', validationIssues[0].section);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue field:', validationIssues[0].field);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue fieldId:', validationIssues[0].fieldId);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue issue:', validationIssues[0].issue);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] First issue message:', validationIssues[0].message);
                    } else {
                      console.error('[GO TO FIRST ISSUE] ❌ No first issue found!');
                      return;
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    try {
                      const firstIssue = validationIssues[0];
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Processing first issue:', firstIssue);
                      
                      if (!firstIssue) {
                        console.error('[GO TO FIRST ISSUE] ❌ No first issue found!');
                        return;
                      }
                      
                      // PRIORITY 1: Use fieldId if available (most reliable) - check this FIRST
                      // This handles Property Trust and BPR Trust schedule issues that have fieldId
                      if (firstIssue.fieldId) {
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ PRIORITY 1: Has fieldId, navigating to field:', firstIssue.fieldId);
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Issue details:', {
                          section: firstIssue.section,
                          sectionId: firstIssue.sectionId,
                          fieldId: firstIssue.fieldId,
                          targetFieldIds: firstIssue.targetFieldIds,
                          targetSectionIndex: firstIssue.targetSectionIndex,
                          scheduleNumber: firstIssue.scheduleNumber
                        });
                        
                        // If we have a section index, navigate to that section first
                        if (firstIssue.targetSectionIndex !== undefined && firstIssue.targetSectionIndex >= 0) {
                          const targetSection = formData.formSections[firstIssue.targetSectionIndex];
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Navigating to section index:', firstIssue.targetSectionIndex);
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Target section name:', targetSection?.formSection);
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Current section index:', currentIndex);
                          setCurrentIndex(firstIssue.targetSectionIndex);
                          setValidationModalOpen(false);
                          // Wait for section to render, then scroll to field
                          setTimeout(() => {
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Section navigation complete, scrolling to field:', firstIssue.fieldId);
                            scrollToField(firstIssue.fieldId, firstIssue.targetFieldIds);
                          }, 300);
                        } else {
                          // Try to find section by sectionId or section name
                          const sectionIndex = formData.formSections.findIndex(s => 
                            s.formSection === firstIssue.section || 
                            s.id === firstIssue.sectionId
                          );
                          if (sectionIndex >= 0) {
                            const targetSection = formData.formSections[sectionIndex];
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Found section by name/id, navigating to index:', sectionIndex);
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Target section name:', targetSection?.formSection);
                            setCurrentIndex(sectionIndex);
                            setValidationModalOpen(false);
                            setTimeout(() => {
                              DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Section navigation complete, scrolling to field:', firstIssue.fieldId);
                              scrollToField(firstIssue.fieldId, firstIssue.targetFieldIds);
                            }, 300);
                          } else {
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Section not found, trying direct field search');
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Searched for section:', firstIssue.section, 'or sectionId:', firstIssue.sectionId);
                            setValidationModalOpen(false);
                            scrollToField(firstIssue.fieldId, firstIssue.targetFieldIds);
                          }
                        }
                        return;
                      }
                      
                      // PRIORITY 2: Handle schedule issues without fieldId (fallback)
                      const isScheduleIssue = firstIssue.scheduleNumber || 
                        (firstIssue.section && (firstIssue.section.toLowerCase().includes('schedule') || firstIssue.section === 'Schedules'));
                      
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] PRIORITY 2: Is schedule issue:', isScheduleIssue);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Target section index:', firstIssue.targetSectionIndex);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Target field IDs:', firstIssue.targetFieldIds);
                      
                      if (isScheduleIssue && firstIssue.targetSectionIndex !== undefined && firstIssue.targetSectionIndex >= 0) {
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Schedule issue detected, navigating to section index:', firstIssue.targetSectionIndex);
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Total sections available:', formData.formSections.length);
                        
                        if (firstIssue.targetSectionIndex < 0 || firstIssue.targetSectionIndex >= formData.formSections.length) {
                          console.error('[GO TO FIRST ISSUE] ❌ Invalid section index:', firstIssue.targetSectionIndex);
                          return;
                        }
                        
                        // Navigate to the correct section first
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Setting current index to:', firstIssue.targetSectionIndex);
                        setCurrentIndex(firstIssue.targetSectionIndex);
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Closing validation modal');
                        setValidationModalOpen(false);
                        
                        // Wait for section to render, then scroll to first missing field
                        setTimeout(() => {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Timeout fired, attempting to scroll');
                          if (firstIssue.targetFieldIds && firstIssue.targetFieldIds.length > 0) {
                            const firstFieldId = firstIssue.targetFieldIds[0];
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Scrolling to first missing field:', firstFieldId);
                            scrollToField(firstFieldId);
                          } else {
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] No target field IDs, scrolling to top');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }, 300);
                        return;
                      }
                      
                      // PRIORITY 3: Handle schedule issues without fieldId (fallback for generic schedule issues)
                      if (isScheduleIssue || firstIssue.section === 'Schedules') {
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Schedule issue detected, checking for Property Trust/BPR Trust by schedule number...');
                        
                        // Extract schedule number from the issue
                        const scheduleNumber = firstIssue.scheduleNumber || 
                          (firstIssue.field ? firstIssue.field.match(/Schedule\s+(\d+)/i)?.[1] : null);
                        
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Extracted schedule number:', scheduleNumber);
                        
                        // Check if this schedule number matches Property Trust or BPR Trust
                        const propertyTrustScheduleNum = formValues.propertyTrustScheduleNumber ? 
                          String(formValues.propertyTrustScheduleNumber).trim() : '';
                        const bprTrustScheduleNum = formValues.bprTrustScheduleNumber ? 
                          String(formValues.bprTrustScheduleNumber).trim() : '';
                        
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Property Trust schedule number:', propertyTrustScheduleNum);
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] BPR Trust schedule number:', bprTrustScheduleNum);
                        
                        let targetSection = null;
                        let targetFieldIds = [];
                        
                        if (scheduleNumber && propertyTrustScheduleNum === scheduleNumber) {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Matched Property Trust schedule by number');
                          targetSection = 'Property Trust';
                          // Determine which fields are missing
                          if (!formValues.propertyTrustDetails || String(formValues.propertyTrustDetails).trim() === '') {
                            targetFieldIds.push('propertyTrustDetails');
                          }
                          if (!formValues.propertyTrustTerms || String(formValues.propertyTrustTerms).trim() === '') {
                            targetFieldIds.push('propertyTrustTerms');
                          }
                          // If we couldn't determine which fields are missing, try both
                          if (targetFieldIds.length === 0) {
                            targetFieldIds = ['propertyTrustDetails', 'propertyTrustTerms'];
                          }
                        } else if (scheduleNumber && bprTrustScheduleNum === scheduleNumber) {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Matched BPR Trust schedule by number');
                          targetSection = 'Business Interests';
                          // Determine which fields are missing
                          if (!formValues.bprTrustDetails || String(formValues.bprTrustDetails).trim() === '') {
                            targetFieldIds.push('bprTrustDetails');
                          }
                          if (!formValues.bprTrustTerms || String(formValues.bprTrustTerms).trim() === '') {
                            targetFieldIds.push('bprTrustTerms');
                          }
                          // If we couldn't determine which fields are missing, try both
                          if (targetFieldIds.length === 0) {
                            targetFieldIds = ['bprTrustDetails', 'bprTrustTerms'];
                          }
                        }
                        
                        // If we found a match, navigate to that section
                        if (targetSection && targetFieldIds.length > 0) {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Found matching section:', targetSection, 'with fields:', targetFieldIds);
                          const sectionIndex = formData.formSections.findIndex(s => 
                            s.formSection === targetSection
                          );
                          if (sectionIndex >= 0) {
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Navigating to section:', targetSection, 'at index:', sectionIndex);
                            setCurrentIndex(sectionIndex);
                            setValidationModalOpen(false);
                            setTimeout(() => {
                              DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Searching for fields:', targetFieldIds);
                              for (const fieldId of targetFieldIds) {
                                const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
                                if (fieldElement) {
                                  DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Found field:', fieldId);
                                  fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  const input = fieldElement.querySelector('input, textarea, select');
                                  if (input) {
                                    setTimeout(() => input.focus(), 500);
                                  }
                                  return;
                                }
                              }
                              console.error('[GO TO FIRST ISSUE] ❌ Could not find any schedule fields:', targetFieldIds);
                            }, 300);
                            return;
                          }
                        }
                        
                        // Fallback to generic schedule search
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Generic schedule issue, calling scrollToScheduleField');
                        scrollToScheduleField(firstIssue.field || `Schedule ${firstIssue.scheduleNumber || ''}`);
                      } else if (firstIssue.field) {
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Has field (not schedule), searching for:', firstIssue.field);
                        const fieldElement = document.querySelector(`[data-field-id="${firstIssue.field}"]`);
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Direct querySelector result:', fieldElement);
                        if (fieldElement) {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Found field element, scrolling...');
                          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          const input = fieldElement.querySelector('input, textarea, select');
                          if (input) {
                            setTimeout(() => input.focus(), 500);
                          }
                          setValidationModalOpen(false);
                        } else {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Direct search failed, trying case-insensitive search...');
                          // Try case-insensitive search
                          const allFields = document.querySelectorAll('[data-field-id]');
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Total fields with data-field-id:', allFields.length);
                          const foundField = Array.from(allFields).find(field => {
                            const fieldId = field.getAttribute('data-field-id') || '';
                            return fieldId.toLowerCase() === firstIssue.field.toLowerCase() || 
                                   fieldId.toLowerCase().includes(firstIssue.field.toLowerCase());
                          });
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Case-insensitive search result:', foundField);
                          if (foundField) {
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Found field via case-insensitive search, scrolling...');
                            foundField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const input = foundField.querySelector('input, textarea, select');
                            if (input) {
                              setTimeout(() => input.focus(), 500);
                            }
                            setValidationModalOpen(false);
                          } else {
                            console.error('[GO TO FIRST ISSUE] ❌ Could not find field:', firstIssue.field);
                          }
                        }
                      } else {
                        console.error('[GO TO FIRST ISSUE] ❌ First issue has no fieldId, field, or is not a schedule');
                        console.error('[GO TO FIRST ISSUE] First issue object:', firstIssue);
                      }
                    } catch (error) {
                      console.error('[GO TO FIRST ISSUE] ❌ ERROR during click handler:', error);
                      console.error('[GO TO FIRST ISSUE] Error stack:', error.stack);
                      console.error('[GO TO FIRST ISSUE] Error message:', error.message);
                    }
                  }}
                  ref={(el) => {
                    if (el) {
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] ========== BUTTON ELEMENT RENDERED ==========');
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Element:', el);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Element tagName:', el.tagName);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Element className:', el.className);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Element disabled:', el.disabled);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Element tabIndex:', el.tabIndex);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Has onClick:', !!el.onclick);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Validation issues count:', validationIssues.length);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Element style.pointerEvents:', window.getComputedStyle(el).pointerEvents);
                      DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE RENDER] Element style.zIndex:', window.getComputedStyle(el).zIndex);
                    }
                  }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-md transition-all duration-200 font-medium flex items-center gap-2 cursor-pointer"
                  tabIndex={0}
                  aria-label="Go to first incomplete item"
                >
                  Go to First Issue
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 z-40 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 animate-fadeIn"
          type="button"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp size={24} />
        </button>
      )}

      {/* Completion Modal - Shows what happens next */}
      {submitted && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 px-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-modal-title"
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-slideIn ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 text-white px-6 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-xl shadow-inner">
                  <CheckCircle2 size={32} className="text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h2 id="completion-modal-title" className="text-2xl font-bold tracking-tight">Congratulations!</h2>
                  <p className="text-sm text-emerald-100 mt-1">You've completed the entire questionnaire</p>
                </div>
              </div>
              <button
                onClick={() => setSubmitted(false)}
                className="p-2.5 hover:bg-white/20 rounded-xl transition-colors"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens next?</h3>
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-indigo-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">
                      1
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Download Your Will PDF</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Click the button below to generate and download your completed Will document.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-blue-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">
                      2
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Review Your Will</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Carefully review the downloaded PDF to ensure all information is correct.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-purple-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">
                      3
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Sign Your Will</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Print and sign in the presence of two independent witnesses.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-amber-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-amber-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">
                      4
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Store Safely</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Keep your signed Will in a safe location and inform your Executors.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/80 border border-blue-200 p-4 rounded-xl">
                <div className="flex items-start gap-3">
                  <Info size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900 mb-1">Want to start over?</p>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      Use <strong>"Clear Data / Start Fresh"</strong> at the bottom of the form to create a new Will.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Download PDF is the primary action */}
            <div className="px-6 py-5 bg-white border-t border-gray-200 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors order-2 sm:order-1"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setSubmitted(false);
                  handleDownloadPDF();
                }}
                disabled={isGeneratingPDF}
                className="flex items-center justify-center gap-2 px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 font-semibold order-1 sm:order-2"
              >
                <Download size={20} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Data Confirmation Modal */}
      {clearConfirmOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 px-4 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-slideIn ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 p-3 bg-amber-100 rounded-xl">
                  <AlertTriangle size={28} className="text-amber-600" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 id="clear-confirm-title" className="text-xl font-semibold text-gray-900 mb-2">Clear all data?</h2>
                  <p className="text-gray-600 leading-relaxed">
                    Are you sure you want to clear all saved data and start fresh? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setClearConfirmOpen(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReset}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-xl transition-colors shadow-sm"
                >
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
