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
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';
import Sidebar from './Sidebar.jsx';
import FieldRenderer from './FieldRenderer.jsx';
import { Download, FileText, Scroll, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Save, Sparkles, RotateCcw, X, ArrowRight, Info, ArrowUp, Zap, AlertTriangle } from 'lucide-react';
import { generateDummyFormData } from '../utils/autoFillForm.js';
import { validatePropertyTrustSchedules, validateBPRTrustSchedules } from '../utils/validationRegistry.js';
import { buildClauses } from '../utils/buildClauses.js';
import { toast } from 'sonner';
import { isSolicitorMode, SOLICITOR_ONLY_FIELD_IDS, TESTAMENTARY_CAPACITY_SECTION_INDEX } from '../constants/clientMode.js';
import IdentityVerification from './IdentityVerification.jsx';
import { createSession, loadSession, saveSession, isSupabaseConfigured } from '../lib/willSessions.js';
import { buildCloudPayload, buildLocalDraftPayload } from '../lib/formPayload.js';
import { submitMatterFromDraft } from '../lib/matters.js';

const DEBUG_LOGS = false; // Set true for verbose console logging
// Set VITE_DEBUG_CLAUSES=true in .env to enable [INTERPOLATE] and [CONDITION EVAL] logs
const DEBUG_INTERPOLATE = import.meta.env.VITE_DEBUG_CLAUSES === 'true';

const REF_REGEX = /^[A-Z0-9]{8,12}$/;

// Local-only ref when Supabase not configured (existing behavior)
function getOrCreateReferenceNumberLocal() {
  const urlParams = new URLSearchParams(window.location.search);
  const refFromUrl = urlParams.get('ref');
  if (refFromUrl && REF_REGEX.test(refFromUrl)) {
    localStorage.setItem('willFormRef', refFromUrl);
    return refFromUrl;
  }
  const savedRef = localStorage.getItem('willFormRef');
  if (savedRef && REF_REGEX.test(savedRef)) return savedRef;
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const newRef = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  localStorage.setItem('willFormRef', newRef);
  const newUrl = new URL(window.location);
  newUrl.searchParams.set('ref', newRef);
  window.history.replaceState({}, '', newUrl);
  return newRef;
}

export default function FormRenderer({ initialFormState = null, externalPersistence = null }) {
  const { formData } = useFormDefinition();
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const refFromUrl = urlParams?.get('ref') ?? '';
  const secretFromUrl = urlParams?.get('s') ?? '';
  const hasCloudRefAndSecret = REF_REGEX.test(refFromUrl) && secretFromUrl.length >= 8;
  const useExternalPersistence = !!externalPersistence;
  const solicitorMode = isSolicitorMode();
  const useCloud = !useExternalPersistence && typeof window !== 'undefined' && isSupabaseConfigured();

  const [referenceNumber, setReferenceNumber] = useState(() => {
    if (initialFormState?.referenceNumber) return initialFormState.referenceNumber;
    if (!useCloud) return getOrCreateReferenceNumberLocal();
    if (hasCloudRefAndSecret) return refFromUrl;
    return '';
  });
  const [sessionSecret, setSessionSecret] = useState(() => {
    if (useExternalPersistence) return '';
    return useCloud && hasCloudRefAndSecret ? secretFromUrl : '';
  });
  const [sessionInitialized, setSessionInitialized] = useState(!useCloud);
  const sessionLoadAttemptedRef = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(() => {
    if (typeof initialFormState?.currentIndex === 'number') {
      return Math.max(0, initialFormState.currentIndex);
    }
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

  // Phase 2: Supabase load or create session (once on mount when cloud configured)
  useEffect(() => {
    if (!useCloud || sessionLoadAttemptedRef.current || useExternalPersistence) return;
    sessionLoadAttemptedRef.current = true;

    if (hasCloudRefAndSecret) {
      console.log('[WillTool Flow] Client resuming: loading session from URL', { ref: refFromUrl, phase: 'client_load_start' });
      loadSession(refFromUrl, secretFromUrl).then((result) => {
        if (result.error) {
          console.warn('[WillTool Flow] Client session load failed', { ref: refFromUrl, error: result.error });
          toast.error('Could not load session', { description: result.error });
          setSessionInitialized(true);
          return;
        }
        const payload = result.payload ?? {};
        const step = typeof payload._step === 'number' ? Math.max(0, payload._step) : 0;
        const { _step: _, ...rest } = payload;
        setFormValues(rest);
        setCurrentIndex(step);
        setReferenceNumber(refFromUrl);
        setSessionSecret(secretFromUrl);
        setSessionInitialized(true);
        console.log('[WillTool Flow] Client session loaded; form ready', { ref: refFromUrl, step, fieldCount: Object.keys(rest).length });
      });
      return;
    }

    const initialFromStorage = (() => {
      const saved = localStorage.getItem('willForm');
      if (!saved) return {};
      try {
        const parsed = JSON.parse(saved);
        if (JSON.stringify(parsed).includes('e+22') || /[eE][+-]?2\d+/.test(JSON.stringify(parsed))) return {};
        return parsed;
      } catch {
        return {};
      }
    })();
    const step = (() => {
      const s = localStorage.getItem('willFormStep');
      const idx = s != null ? Number(s) : 0;
      return Number.isFinite(idx) && idx >= 0 ? idx : 0;
    })();
    const initialPayload = buildCloudPayload(initialFromStorage, step);
    console.log('[WillTool Flow] Client starting: creating new session', { step, fromStorage: Object.keys(initialFromStorage).length, phase: 'client_create_start' });

    createSession(initialPayload).then((result) => {
      if (result.error) {
        console.warn('[WillTool Flow] Client session create failed', { error: result.error });
        toast.error('Could not create session', { description: result.error });
        setReferenceNumber(getOrCreateReferenceNumberLocal());
        setSessionInitialized(true);
        return;
      }
      const { ref, secret } = result;
      setReferenceNumber(ref);
      setSessionSecret(secret);
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('ref', ref);
      newUrl.searchParams.set('s', secret);
      window.history.replaceState({}, '', newUrl);
      setSessionInitialized(true);
      console.log('[WillTool Flow] Client session created; URL updated', { ref });
    });
  }, [useCloud, hasCloudRefAndSecret, refFromUrl, secretFromUrl, useExternalPersistence]);

  const [formValues, setFormValues] = useState(() => {
    if (initialFormState?.formValues) return initialFormState.formValues;
    if (useCloud && hasCloudRefAndSecret) return {};
    const saved = localStorage.getItem('willForm');
    if (!saved) return {};
    try {
      const parsed = JSON.parse(saved);
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
  const [isSubmittingMatter, setIsSubmittingMatter] = useState(false);
  const [submittedMatterId, setSubmittedMatterId] = useState(null);
  const autosaveTimerRef = useRef(null);
  const clauseUpdateTimerRef = useRef(null);
  
  // Filter sections: hide Testamentary Capacity section from clients (solicitor-only)
  const visibleSections = useMemo(() => {
    if (solicitorMode) {
      return formData.formSections;
    }
    // Client mode: exclude Testamentary Capacity section (index 18)
    return formData.formSections.filter((_, idx) => idx !== TESTAMENTARY_CAPACITY_SECTION_INDEX);
  }, [solicitorMode]);
  
  // Map currentIndex to actual section index (accounting for filtered sections)
  const actualSectionIndex = useMemo(() => {
    if (solicitorMode) {
      return currentIndex;
    }
    // In client mode, if currentIndex >= TESTAMENTARY_CAPACITY_SECTION_INDEX, add 1 to skip it
    return currentIndex >= TESTAMENTARY_CAPACITY_SECTION_INDEX ? currentIndex + 1 : currentIndex;
  }, [currentIndex, solicitorMode]);
  
  const currentSection = visibleSections[currentIndex] || formData.formSections[actualSectionIndex];
  
  const isDev = import.meta.env.DEV;

  const submitCurrentMatter = useCallback(async () => {
    if (externalPersistence?.submit) {
      return externalPersistence.submit({ formValues, currentIndex, referenceNumber, sessionSecret });
    }

    if (!referenceNumber || !sessionSecret) {
      return { ok: true };
    }

    return submitMatterFromDraft({
      ref: referenceNumber,
      secret: sessionSecret,
      formValues,
      currentIndex,
    });
  }, [currentIndex, externalPersistence, formValues, referenceNumber, sessionSecret]);



  useEffect(() => {
    if (!useExternalPersistence) {
      localStorage.setItem('willFormStep', String(currentIndex));
    }
  }, [currentIndex, useExternalPersistence]);

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
    if (currentIndex === visibleSections.length - 1) {
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

    // CRITICAL FIX: Handle bracket placeholders FIRST (before {{field:...}} replacement)
    // Map bracket placeholders to their corresponding field references
    let processedText = text;
    
    // Map bracket placeholders to field references
    const bracketPlaceholderMap = {
      '[Separate Trustee(s) List]': '{{field:separateTrusteesSection:fullDetails}}',
      '[Separate Trustee List]': '{{field:separateTrusteesSection:fullDetails}}',
      '[Pet Carer List]': '{{field:petCarerSection:fullDetails}}',
      '[Substitute Pet Carer List]': '{{field:substitutePetCarerSection:fullDetails}}',
    };
    
    Object.entries(bracketPlaceholderMap).forEach(([placeholder, fieldRef]) => {
      if (processedText.includes(placeholder)) {
        if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] 🔄 Replacing bracket placeholder "${placeholder}" with "${fieldRef}"`);
        processedText = processedText.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), fieldRef);
      }
    });

    const interpolated = processedText.replace(/\{\{field:([^}]+)\}\}/g, (_, fullKey) => {
      let [sectionId, subField] = fullKey.split(':');
      
      // Allow templates to reference either "X" or "XSection" for :fullDetails / :fullList
      const fullDetailsAliasMap = {
        petCarer: 'petCarerSection',
        substitutePetCarer: 'substitutePetCarerSection',
        separateTrustees: 'separateTrusteesSection',
        // safety: if someone used these ids without "Section" in JSON
        petCarerSection: 'petCarerSection',
        substitutePetCarerSection: 'substitutePetCarerSection',
        separateTrusteesSection: 'separateTrusteesSection',
      };
      
      // CRITICAL FIX: Alias mapping for fullDetails/fullList
      // Handle cases where template uses shorter IDs (e.g., "separateTrustees") or when data is stored under different key
      if ((subField === 'fullDetails' || subField === 'fullList') && fullDetailsAliasMap[sectionId]) {
        const raw = values[sectionId];
        // If it's a Yes/No, primitive, or missing (not the repeater data array), swap to the Section id
        // This handles cases like: {{field:separateTrustees:fullDetails}} when separateTrustees = "Yes"
        if (raw == null || typeof raw === 'string' || typeof raw === 'boolean' || typeof raw === 'number' || !Array.isArray(raw)) {
          const mappedId = fullDetailsAliasMap[sectionId];
          // Only swap if it's actually different (avoid no-op)
          if (mappedId !== sectionId) {
            sectionId = mappedId;
            if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] Alias mapping: ${fullKey.split(':')[0]} -> ${sectionId} (raw value was: ${raw})`);
          } else {
            if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] Using section ID: ${sectionId} (raw value was: ${raw})`);
          }
        }
      }

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
        
        // CRITICAL FIX: Special handling for executor sections - check for Aristone selection
        if (sectionId === 'executorsSection') {
          // Check if Aristone was selected via chooseAristoneExecutor
          if (values.chooseAristoneExecutor === 'Aristone') {
            return "Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG";
          }
          // Fall through to normal array handling
        }
        
        if (sectionId === 'substituteExecutorsSection') {
          // Check if Aristone was selected via chooseAristoneSubstituteExecutor
          if (values.chooseAristoneSubstituteExecutor === 'Aristone') {
            return "Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG";
          }
          // Fall through to normal array handling
        }
        
        // CRITICAL FIX: Special handling for pet carer sections and separate trustees when using fullDetails
        if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && subField === 'fullDetails') {
          // CRITICAL: Use explicit data keys - DO NOT fall back to generic lookups
          let sectionData = null;
          if (sectionId === 'petCarerSection') {
            sectionData = values.petCarerData || values.petCarerSectionData || null;
          } else if (sectionId === 'substitutePetCarerSection') {
            sectionData = values.substitutePetCarerData || values.substitutePetCarerSectionData || null;
          } else if (sectionId === 'separateTrusteesSection') {
            sectionData = values.separateTrusteeData || values.separateTrusteesData || values.separateTrusteesSectionData || null;
          }
          
          // If still null, try fallbackMap as last resort
          if (!sectionData) {
            const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
            sectionData = values[fallbackId] || null;
          }
          
          // Debug logging for separate trustees
          if (sectionId === 'separateTrusteesSection') {
            if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] separateTrusteesSection:fullDetails - sectionData:`, {
              sectionData,
              sectionDataType: Array.isArray(sectionData) ? 'array' : typeof sectionData,
              sectionDataLength: Array.isArray(sectionData) ? sectionData.length : 'N/A',
              firstItem: Array.isArray(sectionData) && sectionData.length > 0 ? sectionData[0] : null,
              firstItemType: Array.isArray(sectionData) && sectionData.length > 0 ? typeof sectionData[0] : 'N/A',
              testatorFirstName: values.firstName,
              testatorLastName: values.lastName,
              testatorFullName: [values.title, values.firstName, values.middleName, values.lastName].filter(Boolean).join(' ')
            });
          }
          
              // CRITICAL: Only process if we have valid array data - never use testator name as fallback
              // If sectionData is null, undefined, not an array, or empty, return unresolved marker immediately
              if (!sectionData || !Array.isArray(sectionData) || sectionData.length === 0) {
                if (sectionId === 'separateTrusteesSection') {
                  if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] separateTrusteesSection:fullDetails - ❌ No valid array data found, returning unresolved marker`);
                }
                return `{{field:${sectionId}:${subField}}}`;
              }
              
              if (sectionData.length > 0) {
                // CRITICAL FIX: Get testator name for validation BEFORE processing items
                const testatorFirstName = values.firstName || '';
                const testatorLastName = values.lastName || '';
                const testatorMiddleName = values.middleName || '';
                const testatorTitle = values.title || '';
                const testatorFullName = [testatorTitle, testatorFirstName, testatorMiddleName, testatorLastName].filter(Boolean).join(' ').trim();
                const testatorNameWithoutTitle = [testatorFirstName, testatorMiddleName, testatorLastName].filter(Boolean).join(' ').trim();
                
                const formattedItems = sectionData
                  .map((item) => {
                    // Handle string items (fallback for simple data structures)
                    if (typeof item === 'string') {
                      // Check if it's an exact known placeholder string from autofill
                      // Use exact matching to avoid false positives with legitimate user input
                      const exactPlaceholders = {
                        separateTrusteesSection: [
                          'Testing the Trustees',
                          'Testing the Separate Trustees',
                          'test test test',
                          'testing'
                        ],
                        petCarerSection: [
                          'Testing the Per Carer works',
                          'Testing the Pet Carer works',
                          'test test test',
                          'testing'
                        ],
                        substitutePetCarerSection: [
                          'Testing the Per Carer works Sub',
                          'Testing the Pet Carer works Sub',
                          'Testing the Substitute Pet Carer works',
                          'test test test',
                          'testing'
                        ]
                      };
                      
                      const placeholders = exactPlaceholders[sectionId] || [];
                      const trimmed = item.trim();
                      const isPlaceholder = placeholders.some(placeholder =>
                        trimmed.toLowerCase() === placeholder.toLowerCase()
                      );
                      
                      if (isPlaceholder) {
                        if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] ${sectionId}:fullDetails - Detected exact placeholder string: "${item}"`);
                        return ''; // Return empty to mark as incomplete
                      }
                      
                      // CRITICAL FIX: Check if string contains testator name (multiple checks)
                      const testatorFirstNameLastName = [testatorFirstName, testatorLastName].filter(Boolean).join(' ').trim();
                      const containsTestatorNameInString = 
                        (testatorFullName && trimmed.includes(testatorFullName)) ||
                        (testatorNameWithoutTitle && trimmed.includes(testatorNameWithoutTitle)) ||
                        (testatorFirstNameLastName && trimmed.includes(testatorFirstNameLastName)) ||
                        (testatorFirstName && testatorLastName && trimmed.includes(testatorFirstName) && trimmed.includes(testatorLastName));
                      
                      if (containsTestatorNameInString) {
                        if (DEBUG_INTERPOLATE) {
                          console.error(`[INTERPOLATE] ❌ CRITICAL: String item contains testator name: "${item}"`);
                          console.error(`[INTERPOLATE] Testator full name: "${testatorFullName}"`);
                          console.error(`[INTERPOLATE] Testator name (no title): "${testatorNameWithoutTitle}"`);
                          console.error(`[INTERPOLATE] Testator firstName + lastName: "${testatorFirstNameLastName}"`);
                        }
                        return ''; // Reject this item
                      }
                      
                      return item; // Return as-is if it's a valid formatted string
                    }
                
                if (!item || typeof item !== 'object') return '';
                
                // Format as: "relationship name of address" (e.g., "Friend Charlie Pet Carer of 789 Pet Street, Animal District, London, SW1A 2BB")
                const relationship = item.relationship || item.relationshipToTestator || '';
                const nameParts = [
                  item.title,
                  item.firstName,
                  item.lastName
                ].filter(Boolean);
                const name = nameParts.join(' ');
                const nameWithoutTitle = [item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ');
                const addressParts = [
                  item.address1,
                  item.address2,
                  item.address3,
                  item.city,
                  item.postcode
                ].filter(Boolean);
                const address = addressParts.join(', ');
                
                // CRITICAL FIX: Validate name doesn't match testator name BEFORE other validation
                if (testatorFullName && name === testatorFullName) {
                  if (DEBUG_INTERPOLATE) {
                    console.error(`[INTERPOLATE] ❌ CRITICAL ERROR: Item name "${name}" matches testator name "${testatorFullName}" for ${sectionId}:fullDetails! Rejecting item.`);
                    if (sectionId === 'separateTrusteesSection') console.error(`[INTERPOLATE] separateTrusteesSection:fullDetails - Item details:`, item);
                  }
                  return ''; // Reject this item - testator cannot be their own trustee/pet carer
                }
                if (testatorNameWithoutTitle && nameWithoutTitle === testatorNameWithoutTitle) {
                  if (DEBUG_INTERPOLATE) {
                    console.error(`[INTERPOLATE] ❌ CRITICAL ERROR: Item name (no title) "${nameWithoutTitle}" matches testator name "${testatorNameWithoutTitle}" for ${sectionId}:fullDetails! Rejecting item.`);
                    if (sectionId === 'separateTrusteesSection') console.error(`[INTERPOLATE] separateTrusteesSection:fullDetails - Item details:`, item);
                  }
                  return ''; // Reject this item
                }
                // Also check if firstName + lastName match (even if title differs)
                if (testatorFirstName && testatorLastName && 
                    item.firstName === testatorFirstName && item.lastName === testatorLastName) {
                  if (DEBUG_INTERPOLATE) {
                    console.error(`[INTERPOLATE] ❌ CRITICAL ERROR: Item firstName "${item.firstName}" + lastName "${item.lastName}" matches testator for ${sectionId}:fullDetails! Rejecting item.`);
                    if (sectionId === 'separateTrusteesSection') console.error(`[INTERPOLATE] separateTrusteesSection:fullDetails - Item details:`, item);
                  }
                  return ''; // Reject this item
                }
                
                // Validate we have at least name (firstName or lastName) and address1
                if ((!name || name.trim() === '') || (!address || !item.address1)) {
                  // Debug logging for separate trustees when validation fails
                  if (sectionId === 'separateTrusteesSection') {
                    if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] separateTrusteesSection:fullDetails - Validation failed for item:`, {
                      item,
                      hasName: !!(name && name.trim()),
                      hasAddress: !!(address && item.address1),
                      nameParts,
                      addressParts
                    });
                  }
                  return '';
                }
                
                // Build formatted string: "relationship name of address"
                const parts = [relationship, name, address].filter(Boolean);
                if (parts.length === 0) return '';
                
                // Format: "relationship name of address" or "name of address" if no relationship
                if (relationship) {
                  return `${relationship} ${name} of ${address}`;
                } else {
                  return `${name} of ${address}`;
                }
              })
              .filter(Boolean);
            
            // Debug logging for separate trustees
            if (sectionId === 'separateTrusteesSection') {
              if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] separateTrusteesSection:fullDetails - formattedItems after filter:`, {
                formattedItems,
                length: formattedItems.length,
                items: formattedItems.map(item => ({ value: item, type: typeof item }))
              });
            }
            
            if (formattedItems.length > 0) {
              const result = formattedItems.length === 1 
                ? formattedItems[0]
                : formattedItems.length === 2
                ? formattedItems.join(' and ')
                : formattedItems.slice(0, -1).join(', ') + ', and ' + formattedItems[formattedItems.length - 1];
              
              // CRITICAL FIX: Validate result doesn't contain testator name
              // Check if result matches testator name pattern (firstName + lastName)
              const testatorFirstName = values.firstName || '';
              const testatorLastName = values.lastName || '';
              const testatorMiddleName = values.middleName || '';
              const testatorTitle = values.title || '';
              const testatorFullName = [testatorTitle, testatorFirstName, testatorMiddleName, testatorLastName].filter(Boolean).join(' ').trim();
              const testatorNameWithoutTitle = [testatorFirstName, testatorMiddleName, testatorLastName].filter(Boolean).join(' ').trim();
              const testatorFirstNameLastName = [testatorFirstName, testatorLastName].filter(Boolean).join(' ').trim();
              
              // CRITICAL: Multiple checks for testator name in result
              const containsTestatorName = 
                (testatorFullName && result.includes(testatorFullName)) ||
                (testatorNameWithoutTitle && result.includes(testatorNameWithoutTitle)) ||
                (testatorFirstNameLastName && result.includes(testatorFirstNameLastName)) ||
                (testatorFirstName && testatorLastName && result.includes(testatorFirstName) && result.includes(testatorLastName));
              
              if (containsTestatorName) {
                if (DEBUG_INTERPOLATE) {
                  console.error(`[INTERPOLATE] ❌ CRITICAL ERROR: Result contains testator name for ${sectionId}:fullDetails!`);
                  console.error(`[INTERPOLATE] Result: "${result}"`);
                  console.error(`[INTERPOLATE] Testator full name: "${testatorFullName}"`);
                  console.error(`[INTERPOLATE] Testator name (no title): "${testatorNameWithoutTitle}"`);
                  console.error(`[INTERPOLATE] Testator firstName + lastName: "${testatorFirstNameLastName}"`);
                  console.error(`[INTERPOLATE] ❌ BLOCKING - returning unresolved marker to prevent clause with testator name`);
                }
                return `{{field:${sectionId}:${subField}}}`;
              }
              
              // Debug logging for separate trustees
              if (sectionId === 'separateTrusteesSection') {
                if (DEBUG_INTERPOLATE) {
                  console.log(`[INTERPOLATE] separateTrusteesSection:fullDetails - ✅ Returning interpolated result: "${result}"`);
                  console.log(`[INTERPOLATE] separateTrusteesSection:fullDetails - Testator name check passed (fullName: "${testatorFullName}", result: "${result}")`);
                }
              }
              
              return result;
            } else {
              // No valid formatted items after filtering - return unresolved marker
              if (sectionId === 'separateTrusteesSection') {
                if (DEBUG_INTERPOLATE) console.log(`[INTERPOLATE] separateTrusteesSection:fullDetails - ❌ No valid formatted items after filtering, returning unresolved marker`);
              }
              return `{{field:${sectionId}:${subField}}}`;
            }
          }
          
          // This should never be reached due to early return above, but add guard just in case
          if (sectionId === 'separateTrusteesSection') {
            if (DEBUG_INTERPOLATE) console.warn(`[INTERPOLATE] separateTrusteesSection:fullDetails - ⚠️ Unexpected code path, returning unresolved marker`);
          }
          return `{{field:${sectionId}:${subField}}}`;
        }
        
        // CRITICAL FIX: For fullDetails on pet carer and separate trustees sections, 
        // NEVER fall through to generic array handling - we already handled these above
        // This prevents accidentally returning testator name or other wrong data
        if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && 
            (subField === 'fullDetails' || subField === 'fullList')) {
          if (DEBUG_INTERPOLATE) console.warn(`[INTERPOLATE] ⚠️ ${sectionId}:${subField} - Should have been handled above, returning unresolved marker`);
          return `{{field:${sectionId}:${subField}}}`;
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

      // Handle pet carer sections - format more readably
      if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection') && 
          (subField === 'relationshipList' || subField === 'nameList' || subField === 'addressList')) {
        const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
        const sectionData = values[fallbackId] || values[sectionId];
        
        if (Array.isArray(sectionData) && sectionData.length > 0) {
          const mappedValues = sectionData
            .map((item) => {
              if (!item || typeof item !== 'object') return '';
              // Extract specific field based on subField type
              let fieldValue = '';
              if (subField === 'relationshipList') {
                fieldValue = item.relationship || item.relationshipToTestator || '';
              } else if (subField === 'nameList') {
                // Format name nicely: "Title FirstName LastName" or "FirstName LastName"
                // CRITICAL FIX: Ensure we have at least firstName OR lastName
                const parts = [
                  item.title,
                  item.firstName,
                  item.lastName
                ].filter(Boolean);
                fieldValue = parts.join(' ');
                // If name is empty or just whitespace, return empty to mark clause incomplete
                if (!fieldValue || fieldValue.trim() === '') {
                  return '';
                }
              } else if (subField === 'addressList') {
                // Format address nicely - at minimum need address1
                const addressParts = [
                  item.address1,
                  item.address2,
                  item.address3,
                  item.city,
                  item.postcode
                ].filter(Boolean);
                fieldValue = addressParts.join(', ');
                // If address is empty, return empty to mark clause incomplete
                if (!fieldValue || fieldValue.trim() === '') {
                  return '';
                }
              } else {
                // Fallback to generic subField lookup
                fieldValue = item[subField] ||
                  item[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                  item[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
                  item[subField.toLowerCase()] ||
                  item[subField.toUpperCase()];
              }
              return fieldValue != null ? String(fieldValue).trim() : '';
            })
            .filter(Boolean);
          
          if (mappedValues.length > 0) {
            // Join with "and" for multiple items, or just return single value
            if (mappedValues.length === 1) {
              return mappedValues[0];
            } else if (mappedValues.length === 2) {
              return mappedValues.join(' and ');
            } else {
              return mappedValues.slice(0, -1).join(', ') + ', and ' + mappedValues[mappedValues.length - 1];
            }
          }
        }
        // CRITICAL FIX: Return placeholder to mark clause as incomplete if no data
        return `{{field:${sectionId}:${subField}}}`;
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

      // CRITICAL FIX: For fullDetails on pet carer and separate trustees sections,
      // NEVER use generic fallbacks that might return testator name
      // These sections MUST have valid array data or return unresolved marker
      // MUST CHECK THIS BEFORE any generic fallbacks to prevent testator name substitution
      if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && 
          (subField === 'fullDetails' || subField === 'fullList')) {
        if (DEBUG_INTERPOLATE) console.warn(`[INTERPOLATE] ⚠️ ${sectionId}:${subField} - Reached generic fallback section, returning unresolved marker (preventing testator name fallback)`);
        return `{{field:${sectionId}:${subField}}}`;
      }

      // CRITICAL FIX: For fullDetails on pet carer and separate trustees sections,
      // NEVER return empty string or use generic fallbacks - always return unresolved marker
      if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && 
          (subField === 'fullDetails' || subField === 'fullList')) {
        if (DEBUG_INTERPOLATE) console.warn(`[INTERPOLATE] ⚠️ ${sectionId}:${subField} - Reached final fallback, returning unresolved marker (preventing empty string/testator name)`);
        return `{{field:${sectionId}:${subField}}}`;
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

    let processed = interpolated;

    // Replace bracket placeholders with real values where possible
    const loansGifts = values.specifyLoansGiftsText || '';
    const residualList = values.residualGiftsDetails || values.residualBeneficiariesDetails || '';
    const furtherResidualList = values.furtherResidualGiftsDetails || '';
    const charityList = values.charityBenefitDetails || '';
    const minCharityValue = values.minimumCharityAmountValue || '';
    const charityAmount = values.minimumCharityAmount === 'Yes' && minCharityValue
      ? `a minimum amount of £${parseInt(String(minCharityValue).replace(/[^0-9.]/g, ''), 10).toLocaleString('en-GB')} of my net estate`
      : '10% of my net estate';
    const charityCondition = values.charityGiftOnlyIfIHTDue === 'Yes'
      ? 'if Inheritance Tax is due'
      : '';

    // Fix Clause 33: Insert loans/gifts text properly (add period if missing, ensure proper sentence structure)
    let formattedLoansGifts = loansGifts.trim();
    if (formattedLoansGifts && !formattedLoansGifts.endsWith('.')) {
      formattedLoansGifts += '.';
    }
    // If the template has "[as specified: ...]", replace it properly
    processed = processed.replace(/\[as specified:\s*\[Specific Loans\/Gifts List\]\]/gi, (match) => {
      if (formattedLoansGifts) {
        return `as specified: ${formattedLoansGifts}`;
      }
      return '';
    });
    // CRITICAL FIX: Ensure proper sentence separation when inserting loans/gifts text
    // If template ends with "children" and loans text starts with "I", add period separator
    processed = processed.replace(/\bchildren\s+\[Specific Loans\/Gifts List\]/gi, (match) => {
      if (formattedLoansGifts && formattedLoansGifts.match(/^I\s+/i)) {
        return `children. ${formattedLoansGifts}`;
      }
      return match.replace('[Specific Loans/Gifts List]', formattedLoansGifts);
    });
    processed = processed.replace(/\[Specific Loans\/Gifts List\]/gi, formattedLoansGifts);
    
    // Fix Clause 35: Add proper lead-in for residual gifts if missing
    let formattedResidualList = residualList.trim();
    if (formattedResidualList && !formattedResidualList.match(/^(I\s+give|upon\s+trust|My\s+Trustees)/i)) {
      // If it doesn't start with proper lead-in, it's likely raw text like "50% to my wife..."
      // The template should handle this, but if it's being inserted into "upon trust for", fix it
      if (processed.includes('upon trust for') && formattedResidualList) {
        formattedResidualList = `the following: ${formattedResidualList}`;
      }
    }
    processed = processed.replace(/\[Residual Beneficiary List and Shares\]/gi, formattedResidualList);
    
    // Fix Clause 36: Prevent duplication - if furtherResidualList already contains the lead-in, 
    // remove the template's duplicate lead-in sentence
    let formattedFurtherResidualList = furtherResidualList.trim();
    if (formattedFurtherResidualList) {
      // Check if user text already contains "If any gifts fail" or similar lead-in
      const hasLeadIn = formattedFurtherResidualList.match(/^(If\s+any\s+gifts?\s+fail|I\s+give\s+the\s+failed\s+share)/i);
      
      if (hasLeadIn) {
        // User text already has the full clause, so remove the template's lead-in entirely
        // Template: "If any gift of my Residuary Estate should fail, I give the failed share to [Further Residual Beneficiary List and Shares]."
        // Replace with just the user text (which already has the lead-in)
        processed = processed.replace(/If\s+any\s+gift\s+of\s+my\s+Residuary\s+Estate\s+should\s+fail[.,]\s*I\s+give\s+the\s+failed\s+share\s+to\s*\[Further Residual Beneficiary List and Shares\]/gi, formattedFurtherResidualList);
        // Also handle standalone bracket replacement
        processed = processed.replace(/\[Further Residual Beneficiary List and Shares\]/gi, '');
      } else {
        // User text is just the beneficiary list, use the template's lead-in
        processed = processed.replace(/\[Further Residual Beneficiary List and Shares\]/gi, formattedFurtherResidualList);
      }
    } else {
      processed = processed.replace(/\[Further Residual Beneficiary List and Shares\]/gi, '');
    }
    processed = processed.replace(/\[Charity\/Charities List\]/gi, charityList);
    processed = processed.replace(/\[10% \/ minimum amount specified\]/gi, charityAmount);
    processed = processed.replace(/\[conditionally if IHT due\]/gi, charityCondition);

    // Clean up leftover bracket wrappers like "[as specified: ...]"
    processed = processed.replace(/\[\s*as specified:\s*([^\]]*)\]/gi, '$1');

    // Remove any remaining unresolved placeholders
    processed = processed.replace(/\{\{field:[^}]+\}\}/g, '');
    
    // Apply text normalization (fix punctuation, grammar, etc.)
    processed = normalizeClauseText(processed);
    
    return processed;
  };
  
  // Comprehensive text normalization function (shared with PDFGenerator)
  const normalizeClauseText = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    let normalized = text;
    
    // STEP 1: Fix double spaces FIRST (before other processing)
    normalized = normalized.replace(/\s{2,}/g, ' ');
    
    // STEP 2: Fix all double/triple periods (most aggressive)
    // Replace any sequence of 2+ periods with a single period
    normalized = normalized.replace(/\.{2,}/g, '.');
    
    // STEP 3: Fix trailing periods/spaces (e.g., "text.." -> "text.")
    normalized = normalized.replace(/([a-zA-Z0-9])\s*\.{2,}/g, '$1.');
    
    // STEP 4: Fix space before period
    normalized = normalized.replace(/\s+\./g, '.');
    
    // STEP 5: Fix period-space-period
    normalized = normalized.replace(/\.\s*\./g, '.');
    
    // STEP 6: Fix trailing triple dots at end of clause (e.g., "clause...")
    normalized = normalized.replace(/\.{3,}\s*$/g, '.');
    
    // STEP 7: Fix "to my <Name>" grammar - more comprehensive pattern
    // Pattern: "to my Emma Wilson" -> "to Emma Wilson" (when name doesn't need "my")
    // But keep "to my wife Jane Smith" (relationship present)
    // Match: "to my" followed by capitalized name (first name + last name)
    normalized = normalized.replace(/\bto\s+my\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, (match, name) => {
      // Check if name already starts with a relationship word
      const relationshipWords = ['wife', 'husband', 'son', 'daughter', 'brother', 'sister', 'mother', 'father', 'partner', 'spouse', 'child', 'children', 'nephew', 'niece', 'uncle', 'aunt', 'cousin', 'friend', 'executor', 'trustee'];
      const nameParts = name.toLowerCase().split(/\s+/);
      const hasRelationship = relationshipWords.some(rel => nameParts.includes(rel));
      
      // If name already contains relationship, keep "my"
      if (hasRelationship) {
        return match;
      }
      // Otherwise, remove "my" prefix
      return `to ${name}`;
    });
    
    // STEP 8: Fix "for my <Name>" grammar (same logic)
    normalized = normalized.replace(/\bfor\s+my\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g, (match, name) => {
      const relationshipWords = ['wife', 'husband', 'son', 'daughter', 'brother', 'sister', 'mother', 'father', 'partner', 'spouse', 'child', 'children', 'nephew', 'niece', 'uncle', 'aunt', 'cousin', 'friend', 'executor', 'trustee'];
      const nameParts = name.toLowerCase().split(/\s+/);
      const hasRelationship = relationshipWords.some(rel => nameParts.includes(rel));
      if (hasRelationship) {
        return match;
      }
      return `for ${name}`;
    });
    
    // STEP 9: Fix clause 33 issue: "to any of my children I loaned..." -> "to any of my children. I loaned..."
    // Insert period before standalone "I" after "children" if missing
    normalized = normalized.replace(/\bchildren\s+(I\s+(?:loaned|gave|made|wish|direct|appoint))/gi, 'children. $1');
    
    // Also fix: "to any of my children" followed directly by "I" (more general)
    normalized = normalized.replace(/\bchildren\s+(I\s+[a-z])/gi, 'children. I$1');
    
    // STEP 10: Fix clause 35 issue: "upon trust for I give..." -> "upon trust for the following: I give..."
    // More comprehensive pattern matching
    normalized = normalized.replace(/\bupon\s+trust\s+for\s+(I\s+give)/gi, 'upon trust for the following: $1');
    // Also catch variations like "upon trust for" followed by percentage or number
    normalized = normalized.replace(/\bupon\s+trust\s+for\s+(\d+%|50%|25%|I\s+give)/gi, 'upon trust for the following: $1');
    
    // STEP 11: Fix clause 36 duplication: Multiple patterns
    // Pattern 1: "I give the failed share to If any gifts fail..."
    normalized = normalized.replace(/\bI\s+give\s+the\s+failed\s+share\s+to\s+If\s+any\s+gifts?\s+fail/gi, 'If any gifts fail');
    
    // Pattern 2: "should fail, I give the failed share to If any gifts fail..."
    normalized = normalized.replace(/\bshould\s+fail,\s+I\s+give\s+the\s+failed\s+share\s+to\s+If\s+any\s+gifts?\s+fail/gi, 'should fail. If any gifts fail');
    
    // Pattern 3: Remove duplicate "I give the failed share" if it appears twice
    normalized = normalized.replace(/(I\s+give\s+the\s+failed\s+share\s+to[^.]*?)\s+I\s+give\s+the\s+failed\s+share\s+to/gi, '$1');
    
    // Pattern 4: Fix Clause 36 duplication - remove duplicated lead-in sentence
    // Catch: "If any gift of my Residuary Estate should fail. If any gifts fail..." 
    // Result: Keep only one lead-in
    normalized = normalized.replace(/\bIf\s+any\s+gift\s+of\s+my\s+Residuary\s+Estate\s+should\s+fail[.,]\s*If\s+any\s+gifts?\s+fail/gi, 'If any gift of my Residuary Estate should fail. If any gifts fail');
    
    // Pattern 5: Also catch when separated by period but still duplicated
    normalized = normalized.replace(/\bIf\s+any\s+gift\s+of\s+my\s+Residuary\s+Estate\s+should\s+fail\.\s+If\s+any\s+gifts?\s+fail/gi, 'If any gift of my Residuary Estate should fail. If any gifts fail');
    
    // Pattern 6: Catch case where template lead-in appears twice
    normalized = normalized.replace(/(If\s+any\s+gift\s+of\s+my\s+Residuary\s+Estate\s+should\s+fail[.,]?\s*){2,}/gi, 'If any gift of my Residuary Estate should fail. ');
    
    // STEP 12: Fix grammar - "minimum amount of" -> "a minimum amount of"
    // BUT: Only add "a" if it's not already there (prevent "a a a")
    normalized = normalized.replace(/\bI\s+give\s+(?:a\s+){0,2}minimum\s+amount\s+of/gi, 'I give a minimum amount of');
    normalized = normalized.replace(/\b(?:a\s+){0,2}minimum\s+amount\s+of\s+£/gi, 'a minimum amount of £');
    
    // STEP 12b: Remove duplicate "a" words (catch "a a a", "a a", etc.)
    normalized = normalized.replace(/\b(a\s+){2,}/gi, 'a ');
    
    // STEP 13: Final cleanup - remove any remaining double periods that might have been introduced
    // This must be VERY aggressive - catch ALL cases
    normalized = normalized.replace(/\.{2,}/g, '.');
    
    // STEP 14: Fix trailing double periods after words (e.g., "at sea..", "21..")
    normalized = normalized.replace(/([a-zA-Z0-9])\s*\.{2,}(?=\s|$|,|;)/g, '$1.');
    
    // STEP 15: Fix double periods in the middle of sentences
    normalized = normalized.replace(/\s+\.{2,}\s+/g, '. ');
    
    // STEP 16: Trim trailing punctuation (but keep final period)
    normalized = normalized.replace(/\s*\.{2,}\s*$/g, '.');
    
    // STEP 17: Final pass - catch any remaining double periods anywhere
    normalized = normalized.replace(/\.{2,}/g, '.');
    
    // STEP 18: Remove duplicate words (catch "a a", "the the", "of of", etc.)
    normalized = normalized.replace(/\b(a|an|the|of|to|for|in|on|at|by|with|from)\s+\1\b/gi, '$1');
    
    // STEP 19: Remove triple+ duplicate words (catch "a a a", etc.)
    normalized = normalized.replace(/\b(a|an|the|of|to|for|in|on|at|by|with|from)(\s+\1){2,}\b/gi, '$1');
    
    // STEP 20: Final double space cleanup (after all other processing)
    normalized = normalized.replace(/\s{2,}/g, ' ');
    
    // Trim and return
    return normalized.trim();
  };

  // Evaluate field conditions to determine if field should be shown
  const evaluateFieldConditions = useCallback((field) => {
    if (!field.conditions) return true;
    
    const evalClause = (clause) => {
      if (!clause) return false;
      
      // CRITICAL FIX: Handle nested conditions with operator/clauses FIRST (before checking field)
      // This handles structures like: { operator: "AND", clauses: [{ field: "...", ... }, ...] }
      if ((clause.operator === 'AND' || clause.operator === 'OR') && clause.clauses) {
        if (!Array.isArray(clause.clauses)) return false;
        const results = clause.clauses.map(evalClause);
        return clause.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
      }
      
      // Then handle simple field-based conditions
      if (!clause.field) return false;
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
      
      if (DEBUG_INTERPOLATE && (field.id === 'foreignWillNotRevoked' || clause.field === 'assetsAbroad')) {
        console.log(`[CONDITION EVAL] 🔍 Evaluating condition for field "${field.id}":`, {
          clauseField: clause.field,
          clauseValue: clause.value,
          clauseOperator: clause.operator,
          actualFormValue: value,
          matches: clause.operator === 'eq' ? value === clause.value : 'N/A (not eq)'
        });
      }
      
      if (clause.operator === 'eq') return value === clause.value;
      if (clause.operator === 'in') return Array.isArray(clause.value) ? clause.value.includes(value) : value === clause.value;
      return false;
    };
    
    const result = Array.isArray(field.conditions) 
      ? (field.conditionLogic === 'OR' ? field.conditions.some(evalClause) : field.conditions.every(evalClause))
      : evalClause(field.conditions);
    
    if (DEBUG_INTERPOLATE && field.id === 'foreignWillNotRevoked') {
      console.log(`[CONDITION EVAL] ✅ Final result for field "${field.id}":`, {
        fieldId: field.id,
        conditions: field.conditions,
        conditionLogic: field.conditionLogic,
        result: result,
        assetsAbroad: formValues.assetsAbroad,
        willBeRendered: result
      });
    }
    
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
    if (currentIndex < visibleSections.length - 1) {
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
      const finishSubmission = async () => {
        console.log('[WillTool Flow] Client reached last step; submitting matter', { ref: referenceNumber, step: currentIndex, phase: 'client_submit_start' });
        if (isDev) DEBUG_LOGS&&console.log('[GO NEXT] Last step reached - submitting matter or completing external persistence');
        setIsSubmittingMatter(true);
        const result = await submitCurrentMatter();
        setIsSubmittingMatter(false);

        if (result?.error) {
          console.error('[WillTool Flow] Client submit failed', { ref: referenceNumber, error: result.error });
          console.error('[Will Tool] submit: failed', result.error);
          toast.error('Could not complete submission', { description: result.error });
          return;
        }

        if (result?.matterId) {
          console.log('[WillTool Flow] Client submission complete; matter in DB', { matterId: result.matterId, ref: referenceNumber, phase: 'client_submit_success' });
          setSubmittedMatterId(result.matterId);
        } else {
          console.log('[WillTool Flow] Client submission completed (no matterId)', { ref: referenceNumber, result });
        }

        setSubmitted(true);
      };

      void finishSubmission();
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

  // Helper function to recursively search through a field and its nested structures
  const searchFieldRecursively = (field, normalized, keyWords, allowPartial) => {
    if (!field) return null;
    
    // Special logging for foreignWillNotRevoked
    if (normalized === 'foreignwillnotrevoked' || normalized.includes('foreignwill')) {
      console.log('[SEARCH FIELD RECURSIVELY] 🔍 Checking field:', {
        fieldId: field.id,
        fieldLabel: field.label,
        fieldType: field.type,
        hasOptions: !!field.options,
        optionsCount: field.options?.length,
        hasSubFields: !!field.subFields,
        subFieldsCount: field.subFields?.length,
        normalized,
        match: field.id?.toLowerCase() === normalized
      });
    }
    
    // Check field ID directly
    if (field.id && field.id.toLowerCase() === normalized) {
      if (normalized === 'foreignwillnotrevoked' || normalized.includes('foreignwill')) {
        console.log('[SEARCH FIELD RECURSIVELY] ✅ DIRECT ID MATCH:', field.id);
      }
      return field.id;
    }
    
    // Check field label
    const fieldLabel = field.label ? String(field.label).trim().toLowerCase() : '';
    if (fieldLabel === normalized) return field.id;
    
    // Partial match on label - prioritize more specific matches
    if (allowPartial && fieldLabel) {
      // CRITICAL FIX: If searching for separate trustees, exclude guardian, digital executor, and business trustee fields
      const isSearchingForSeparateTrustees = normalized.includes('separate') && 
        (normalized.includes('trustee') || normalized.includes('trustees'));
      const isGuardianField = fieldLabel.includes('guardian') && !fieldLabel.includes('trustee');
      const isDigitalExecutorField = fieldLabel.includes('digital') && (fieldLabel.includes('executor') || fieldLabel.includes('executors'));
      const isBusinessTrusteeField = (fieldLabel.includes('business') && fieldLabel.includes('trustee')) || 
        field.id === 'appointSeparateBusinessTrustee';
      
      if (isSearchingForSeparateTrustees) {
        // Skip guardian fields when searching for separate trustees
        if (isGuardianField) {
          return null;
        }
        // Skip digital executor fields when searching for separate trustees
        if (isDigitalExecutorField) {
          return null;
        }
        // Skip business trustee fields when searching for FLIT separate trustees
        if (isBusinessTrusteeField) {
          return null;
        }
      }
      
      // First check: exact substring match (most specific)
      if (fieldLabel.includes(normalized.substring(0, 30)) || 
          normalized.includes(fieldLabel.substring(0, 30))) {
        return field.id;
      }
      // Second check: require multiple keywords to match (more specific than single keyword)
      if (keyWords.length > 0) {
        const matchingKeywords = keyWords.filter(word => fieldLabel.includes(word));
        // Require at least 2 keywords to match for better accuracy
        // Special case: if normalized contains "separate" and "trustees", prioritize fields with both
        if (normalized.includes('separate') && (normalized.includes('trustee') || normalized.includes('trustees'))) {
          if (fieldLabel.includes('separate') && (fieldLabel.includes('trustee') || fieldLabel.includes('trustees'))) {
            // Double-check it's not a guardian, digital executor, or business trustee field
            if (!isGuardianField && !isDigitalExecutorField && !isBusinessTrusteeField) {
              return field.id;
            }
          }
        }
        // For other cases, require at least 2 keywords to match
        if (matchingKeywords.length >= 2) {
          return field.id;
        }
      }
    }
    
    // Check subFields (for section-type fields)
    if (field.type === 'section' && field.subFields) {
      for (const subField of field.subFields) {
        const result = searchFieldRecursively(subField, normalized, keyWords, allowPartial);
        if (result) return result;
      }
    }
    
    // Check option.fields (for fields nested within radio/select options)
    if (field.options && Array.isArray(field.options)) {
      for (const option of field.options) {
        if (option && option.fields && Array.isArray(option.fields)) {
          for (const nestedField of option.fields) {
            const result = searchFieldRecursively(nestedField, normalized, keyWords, allowPartial);
            if (result) return result;
          }
        }
      }
    }
    
    return null;
  };

  // Helper function to collect all field IDs recursively for debugging
  const collectAllFieldIds = (fields = [], collected = new Set()) => {
    for (const field of fields) {
      if (!field) continue;
      if (field.id) collected.add(field.id);
      
      // Collect from subFields
      if (field.type === 'section' && field.subFields) {
        collectAllFieldIds(field.subFields, collected);
      }
      
      // Collect from option.fields
      if (field.options && Array.isArray(field.options)) {
        for (const option of field.options) {
          if (option && option.fields && Array.isArray(option.fields)) {
            collectAllFieldIds(option.fields, collected);
          }
        }
      }
    }
    return collected;
  };

  const scrollToField = (fieldId, targetFieldIds = [], retryCount = 0) => {
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] ========== SCROLLING TO FIELD "${fieldId}" ==========`);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Field ID type:`, typeof fieldId);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Field ID value:`, fieldId);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Target field IDs (fallback):`, targetFieldIds);
    DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Retry count:`, retryCount);
    
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
          
          // Focus on the first input in that field (or the button itself if it's a button)
          const input = fieldElement?.querySelector('input, textarea, select');
          const isButton = fieldElement.tagName === 'BUTTON' || fieldElement.querySelector('button');
          DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Found input element:`, input, 'isButton:', isButton);
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
          } else if (isButton) {
            DEBUG_LOGS&&console.log(`[SCROLL TO FIELD] Field is a button, no input to focus`);
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
      console.log(`[SCROLL TO FIELD] Primary fieldId "${fieldId}" not found, trying ${targetFieldIds.length} fallback field IDs...`);
      for (const fallbackId of targetFieldIds) {
        if (fallbackId !== fieldId) {
          console.log(`[SCROLL TO FIELD] Trying fallback field ID: "${fallbackId}"`);
          if (tryField(fallbackId)) {
            console.log(`[SCROLL TO FIELD] ✅ Found fallback field "${fallbackId}"`);
            return;
          }
        }
      }
      console.log(`[SCROLL TO FIELD] ⚠️ None of the fallback field IDs worked:`, targetFieldIds);
    }
    
    // Try case-insensitive search
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
      const isButton = foundField.tagName === 'BUTTON' || foundField.querySelector('button');
      if (input) {
        setTimeout(() => input.focus(), 500);
      }
      // Add highlight for buttons too
      foundField.classList.add('animate-pulse');
      setTimeout(() => foundField.classList.remove('animate-pulse'), 2000);
      setValidationModalOpen(false);
      return;
    }
    
    // If not found and retry count is less than 3, retry after a delay (for DOM updates)
    if (retryCount < 3) {
      console.log(`[SCROLL TO FIELD] ⏳ Field "${fieldId}" not found, retrying in ${(retryCount + 1) * 500}ms... (attempt ${retryCount + 1}/3)`);
      setTimeout(() => {
        scrollToField(fieldId, targetFieldIds, retryCount + 1);
      }, (retryCount + 1) * 500);
      return;
    }
    
    // Final error logging
    console.error(`[SCROLL TO FIELD] ❌ Could not find field element for "${fieldId}" after ${retryCount + 1} attempts`);
    console.error(`[SCROLL TO FIELD] Searched for:`, searchIds);
    console.error(`[SCROLL TO FIELD] Available field IDs (first 20):`, Array.from(allFields).slice(0, 20).map(f => f.getAttribute('data-field-id')));
    
    // Use collectAllFieldIds to show all available field IDs from formData structure
    const allFieldIdsFromData = collectAllFieldIds(
      formData?.formSections?.flatMap(s => s.fields || []) || []
    );
    console.error(`[SCROLL TO FIELD] All field IDs from formData structure (${allFieldIdsFromData.size} total):`, 
      Array.from(allFieldIdsFromData).sort().slice(0, 50));
    console.error(`[SCROLL TO FIELD] Is "${fieldId}" in formData?`, allFieldIdsFromData.has(fieldId));
  };

  const findFieldIdByLabel = (label, allowPartial = true) => {
    console.log('[FIND FIELD BY LABEL] 🔍 Starting search:', { label, allowPartial });
    if (!label || !formData?.formSections) {
      console.error('[FIND FIELD BY LABEL] ❌ Invalid input:', { label, hasFormData: !!formData, hasFormSections: !!formData?.formSections });
      return null;
    }
    const normalized = String(label).trim().toLowerCase();
    console.log('[FIND FIELD BY LABEL] 🔍 Normalized label:', normalized);
    // Extract key words from the label (first 30-50 chars usually contain the question)
    const keyWords = normalized.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    console.log('[FIND FIELD BY LABEL] 🔍 Key words:', keyWords);
    
    let searchCount = 0;
    for (const section of formData.formSections) {
      if (!section?.fields) continue;
      for (const field of section.fields) {
        searchCount++;
        const result = searchFieldRecursively(field, normalized, keyWords, allowPartial);
        if (result) {
          console.log('[FIND FIELD BY LABEL] ✅ Found match:', { result, searchCount, section: section.formSection });
          return result;
        }
      }
    }
    console.error('[FIND FIELD BY LABEL] ❌ No match found after searching', searchCount, 'fields');
    return null;
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
      const dataToSave = buildLocalDraftPayload(formValues);
      DEBUG_LOGS&&console.log(`[SAVE DRAFT] Prepared ${Object.keys(dataToSave).length} fields for saving`);
      
      // Check localStorage quota
      const testStr = JSON.stringify(dataToSave);
      if (testStr.length > 5 * 1024 * 1024) { // 5MB limit
        alert('Form data is too large to save. Please reduce the amount of data.');
        return;
      }
      
      if (!useExternalPersistence) {
        localStorage.setItem('willForm', testStr);
      }
      DEBUG_LOGS&&console.log(`[SAVE DRAFT] Successfully saved draft with ${Object.keys(dataToSave).length} fields`);

      if (externalPersistence?.save) {
        externalPersistence.save({ formValues, currentIndex, saveType: 'manual' });
      } else if (useCloud && sessionInitialized && referenceNumber && sessionSecret) {
        const cloudPayload = buildCloudPayload(formValues, currentIndex);
        console.log('[WillTool Flow] Client manual save: sending draft to cloud', { ref: referenceNumber, step: currentIndex });
        saveSession(referenceNumber, sessionSecret, cloudPayload).then((res) => {
          if (res.error) {
            console.warn('[WillTool Flow] Client cloud save failed', { ref: referenceNumber, error: res.error });
            toast.error('Cloud save failed', { description: res.error });
          } else {
            console.log('[WillTool Flow] Client draft saved to cloud (manual)', { ref: referenceNumber });
            toast.success('Draft saved', { description: 'Saved on this device and in the cloud.' });
          }
        });
      } else {
        toast.success('Draft saved', { description: 'Your progress has been saved to this device.' });
      }
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
    if (!useExternalPersistence) {
      localStorage.removeItem('willForm');
      localStorage.removeItem('willFormStep');
    }
    setFormValues({});
    setCurrentIndex(0);
    setBanner(null);
    setClearConfirmOpen(false);
    toast.success('Form reset', { description: 'All data has been cleared. You can now start fresh.' });
  };

  const getClauseDisplayText = (clause) => {
    if (!clause) return '';
    if (!clause.incomplete) return clause.text || '';
    const fields = Array.isArray(clause.missingFields) && clause.missingFields.length > 0
      ? clause.missingFields.join(', ')
      : 'required fields';
    return `[Incomplete clause — requires user input: ${fields}]`;
  };

  const buildClauseDebugExport = useCallback((values, previewMaxSectionIndex) => {
    const toHash = (text) => {
      const str = String(text || '');
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      return `${hash}:${str.length}`;
    };
    const preview = buildClauses({
      formValues: values,
      formData,
      interpolateText,
      maxSectionIndex: previewMaxSectionIndex
    });
    const pdf = buildClauses({
      formValues: values,
      formData,
      interpolateText
    });
    const mapClause = (c) => {
      const displayText = getClauseDisplayText(c);
      return {
        id: c.id,
        title: c.title,
        hash: toHash(displayText),
        textSample: String(displayText || '').slice(0, 200)
      };
    };
    const previewClauses = preview.map(mapClause);
    const pdfClauses = pdf.map(mapClause);
    const previewSet = new Set(previewClauses.map(c => `${c.id}:${c.hash}`));
    const pdfSet = new Set(pdfClauses.map(c => `${c.id}:${c.hash}`));
    const missingInPdf = previewClauses.filter(c => !pdfSet.has(`${c.id}:${c.hash}`)).map(c => c.id);
    const extraInPdf = pdfClauses.filter(c => !previewSet.has(`${c.id}:${c.hash}`)).map(c => c.id);
    const orderMismatch = previewClauses.length === pdfClauses.length &&
      previewClauses.some((c, i) => c.id !== pdfClauses[i]?.id || c.hash !== pdfClauses[i]?.hash);
    return {
      previewClauses,
      pdfClauses,
      diff: { missingInPdf, extraInPdf, orderMismatch }
    };
  }, [formData, interpolateText, getClauseDisplayText]);

  // Auto-fill form with dummy data - respects client mode (filters solicitor-only fields)
  const handleAutoFill = useCallback(() => {
    console.log('[FORM AUTO-FILL] ========== AUTO-FILL BUTTON CLICKED ==========');
      const isClient = !solicitorMode;
    console.log('[FORM AUTO-FILL] 📋 Form data available:', {
      hasFormData: !!formData,
      totalSections: formData?.formSections?.length || 0,
      visibleSections: visibleSections.length,
      isClientMode: isClient,
      currentFormValuesCount: Object.keys(formValues).length
    });
    
    try {
      console.log('[FORM AUTO-FILL] 🔄 Calling generateDummyFormData...');
      // Generate dummy data using ALL sections (needed for proper field mapping)
      const dummyData = generateDummyFormData(formData);
      
      // Filter out solicitor-only fields if in client mode
      if (isClient) {
        console.log('[FORM AUTO-FILL] 🔒 Client mode detected - filtering solicitor-only fields...');
        let removedCount = 0;
        SOLICITOR_ONLY_FIELD_IDS.forEach(fieldId => {
          if (dummyData[fieldId] !== undefined) {
            delete dummyData[fieldId];
            removedCount++;
            console.log(`[FORM AUTO-FILL] 🗑️ Removed solicitor-only field: ${fieldId}`);
          }
        });
        console.log(`[FORM AUTO-FILL] ✅ Removed ${removedCount} solicitor-only fields`);
      }
      
      console.log('[FORM AUTO-FILL] ✅ Generated dummy data:', {
        totalFields: Object.keys(dummyData).length,
        hasSeparateTrusteeData: !!dummyData.separateTrusteeData,
        separateTrusteeDataLength: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 'N/A',
        howResidueDistributed: dummyData.howResidueDistributed,
        appointSeparateTrusteesFLIT: dummyData.appointSeparateTrusteesFLIT,
        sampleFields: Object.keys(dummyData).slice(0, 5)
      });
      
      if (dummyData.separateTrusteeData) {
        console.log('[FORM AUTO-FILL] 🔍 Separate trustee data details:', {
          isArray: Array.isArray(dummyData.separateTrusteeData),
          length: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 'N/A',
          firstItem: Array.isArray(dummyData.separateTrusteeData) && dummyData.separateTrusteeData.length > 0 
            ? dummyData.separateTrusteeData[0] 
            : 'N/A',
          allItems: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData : 'N/A'
        });
      }
      
      console.log('[FORM AUTO-FILL] 🔄 Updating form values state...');
      setFormValues(prev => {
        const merged = { ...prev, ...dummyData };
        console.log('[FORM AUTO-FILL] ✅ Merged form values:', {
          previousCount: Object.keys(prev).length,
          newCount: Object.keys(merged).length,
          hasSeparateTrusteeData: !!merged.separateTrusteeData
        });
        return merged;
      });
      
      console.log('[FORM AUTO-FILL] 💾 Saving to localStorage...');
      try {
        localStorage.setItem('willForm', JSON.stringify(dummyData));
        console.log('[FORM AUTO-FILL] ✅ Saved to localStorage successfully');
      } catch (storageError) {
        console.error('[FORM AUTO-FILL] ❌ Failed to save to localStorage:', storageError);
      }
      
      console.log('[FORM AUTO-FILL] ⏱️ Scheduling form values refresh...');
      setTimeout(() => {
        console.log('[FORM AUTO-FILL] 🔄 Refreshing form values state...');
        setFormValues(current => {
          console.log('[FORM AUTO-FILL] ✅ Form values refreshed:', {
            currentCount: Object.keys(current).length,
            hasSeparateTrusteeData: !!current.separateTrusteeData
          });
          return { ...current };
        });
      }, 100);
      
      const modeText = isClient ? 'client' : 'solicitor';
      toast.success('Form auto-filled ✓', {
        description: `Filled ${Object.keys(dummyData).length} fields with test data (${modeText} mode). All visible fields are now populated.`,
        duration: 4000
      });
      
      if (import.meta.env.DEV) {
        console.log('[FORM AUTO-FILL] 🔍 Building clause debug export...');
        const previewMaxIndex = visibleSections.length - 1;
        const exportPayload = buildClauseDebugExport(dummyData, previewMaxIndex);
        window.lastClauseDebugExport = exportPayload;
        console.group('[CLAUSE DEBUG][AUTO-FILL]');
        console.info('diff', exportPayload.diff);
        console.info('previewClauses', exportPayload.previewClauses);
        console.info('pdfClauses', exportPayload.pdfClauses);
        console.groupEnd();
      }
      
      console.log('[FORM AUTO-FILL] ========== AUTO-FILL COMPLETED SUCCESSFULLY ==========');
    } catch (error) {
      console.error('[FORM AUTO-FILL] ❌ Auto-fill error:', error);
      console.error('[FORM AUTO-FILL] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error('Auto-fill failed', { description: error.message });
    }
  }, [buildClauseDebugExport, formValues, visibleSections]);

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

  // Process modal fields and convert them to structured data arrays
  // CRITICAL FIX: Separate useEffect to ALWAYS clean up string entries, independent of modal field processing
  useEffect(() => {
    const cleanupStringEntries = () => {
      const updatedValues = { ...formValues };
      let hasChanges = false;

      // Clean up string entries in separateTrusteeData
      // Only remove exact placeholder strings from autofill, not legitimate user entries
      if (Array.isArray(formValues.separateTrusteeData) && formValues.separateTrusteeData.length > 0) {
        // Only match exact known placeholder strings from autofill
        const exactPlaceholders = [
          'Testing the Trustees',
          'Testing the Separate Trustees',
          'test test test',
          'testing'
        ];
        
        const isPlaceholder = (item) => {
          if (typeof item !== 'string') return false;
          const trimmed = item.trim();
          // Only remove if it's an exact match (case-insensitive) to known placeholders
          return exactPlaceholders.some(placeholder => 
            trimmed.toLowerCase() === placeholder.toLowerCase()
          );
        };
        
        const hasPlaceholderEntries = formValues.separateTrusteeData.some(isPlaceholder);
        if (hasPlaceholderEntries) {
          console.log('[CLEANUP] 🔍 Found exact placeholder string entries in separateTrusteeData, cleaning up...');
          const cleanedData = formValues.separateTrusteeData.filter(item => !isPlaceholder(item));
          if (cleanedData.length !== formValues.separateTrusteeData.length) {
            updatedValues.separateTrusteeData = cleanedData;
            hasChanges = true;
            console.log('[CLEANUP] ✅ Cleaned up placeholder string entries from separateTrusteeData:', {
              before: formValues.separateTrusteeData.length,
              after: cleanedData.length,
              removed: formValues.separateTrusteeData.length - cleanedData.length
            });
          }
        } else {
          // Log when we have string entries but they're not placeholders (legitimate user input)
          const stringEntries = formValues.separateTrusteeData.filter(item => typeof item === 'string');
          if (stringEntries.length > 0) {
            console.log('[CLEANUP] ℹ️ Found legitimate string entries in separateTrusteeData (keeping them):', stringEntries);
          }
        }
      }

      // Clean up string entries in petCarerData
      // Only remove exact placeholder strings from autofill, not legitimate user entries
      if (Array.isArray(formValues.petCarerData) && formValues.petCarerData.length > 0) {
        // Only match exact known placeholder strings from autofill
        const exactPlaceholders = [
          'Testing the Per Carer works',
          'Testing the Pet Carer works',
          'test test test',
          'testing'
        ];
        
        const isPlaceholder = (item) => {
          if (typeof item !== 'string') return false;
          const trimmed = item.trim();
          // Only remove if it's an exact match (case-insensitive) to known placeholders
          return exactPlaceholders.some(placeholder => 
            trimmed.toLowerCase() === placeholder.toLowerCase()
          );
        };
        
        const hasPlaceholderEntries = formValues.petCarerData.some(isPlaceholder);
        if (hasPlaceholderEntries) {
          console.log('[CLEANUP] 🔍 Found exact placeholder string entries in petCarerData, cleaning up...');
          const cleanedData = formValues.petCarerData.filter(item => !isPlaceholder(item));
          if (cleanedData.length !== formValues.petCarerData.length) {
            updatedValues.petCarerData = cleanedData;
            hasChanges = true;
            console.log('[CLEANUP] ✅ Cleaned up placeholder string entries from petCarerData:', {
              before: formValues.petCarerData.length,
              after: cleanedData.length,
              removed: formValues.petCarerData.length - cleanedData.length
            });
          }
        } else {
          // Log when we have string entries but they're not placeholders (legitimate user input)
          const stringEntries = formValues.petCarerData.filter(item => typeof item === 'string');
          if (stringEntries.length > 0) {
            console.log('[CLEANUP] ℹ️ Found legitimate string entries in petCarerData (keeping them):', stringEntries);
          }
        }
      }

      // Clean up string entries in substitutePetCarerData
      // Only remove exact placeholder strings from autofill, not legitimate user entries
      if (Array.isArray(formValues.substitutePetCarerData) && formValues.substitutePetCarerData.length > 0) {
        // Only match exact known placeholder strings from autofill
        const exactPlaceholders = [
          'Testing the Per Carer works Sub',
          'Testing the Pet Carer works Sub',
          'Testing the Substitute Pet Carer works',
          'test test test',
          'testing'
        ];
        
        const isPlaceholder = (item) => {
          if (typeof item !== 'string') return false;
          const trimmed = item.trim();
          // Only remove if it's an exact match (case-insensitive) to known placeholders
          return exactPlaceholders.some(placeholder => 
            trimmed.toLowerCase() === placeholder.toLowerCase()
          );
        };
        
        const hasPlaceholderEntries = formValues.substitutePetCarerData.some(isPlaceholder);
        if (hasPlaceholderEntries) {
          console.log('[CLEANUP] 🔍 Found exact placeholder string entries in substitutePetCarerData, cleaning up...');
          const cleanedData = formValues.substitutePetCarerData.filter(item => !isPlaceholder(item));
          if (cleanedData.length !== formValues.substitutePetCarerData.length) {
            updatedValues.substitutePetCarerData = cleanedData;
            hasChanges = true;
            console.log('[CLEANUP] ✅ Cleaned up placeholder string entries from substitutePetCarerData:', {
              before: formValues.substitutePetCarerData.length,
              after: cleanedData.length,
              removed: formValues.substitutePetCarerData.length - cleanedData.length
            });
          }
        } else {
          // Log when we have string entries but they're not placeholders (legitimate user input)
          const stringEntries = formValues.substitutePetCarerData.filter(item => typeof item === 'string');
          if (stringEntries.length > 0) {
            console.log('[CLEANUP] ℹ️ Found legitimate string entries in substitutePetCarerData (keeping them):', stringEntries);
          }
        }
      }

      if (hasChanges) {
        console.log('[CLEANUP] ✅ Applying cleanup changes to form values');
        setFormValues(updatedValues);
      }
    };

    // Run cleanup immediately and also debounced to catch any late additions
    cleanupStringEntries();
    const timer = setTimeout(cleanupStringEntries, 100);
    return () => clearTimeout(timer);
  }, [formValues.separateTrusteeData, formValues.petCarerData, formValues.substitutePetCarerData]);

  useEffect(() => {
    const processModalFields = () => {
      const updatedValues = { ...formValues };
      let hasChanges = false;

      // Process separate trustee modal fields
      const separateTrusteePrefix = 'addSeparateTrustee_';
      const separateTrusteeFields = Object.keys(formValues).filter(key => key.startsWith(separateTrusteePrefix));
      
      if (separateTrusteeFields.length > 0) {
        // Check if we have enough data to create a structured object
        const hasRequiredFields = separateTrusteeFields.some(key => {
          const fieldName = key.replace(separateTrusteePrefix, '');
          return ['title', 'firstName', 'lastName', 'address1', 'postcode'].includes(fieldName) && formValues[key];
        });

        if (hasRequiredFields) {
          // Collect all separate trustee modal fields into a structured object
          const trusteeObject = {};
          separateTrusteeFields.forEach(key => {
            const fieldName = key.replace(separateTrusteePrefix, '');
            const value = formValues[key];
            if (value && value.trim() !== '') {
              trusteeObject[fieldName] = value.trim();
            }
          });

          // Only create object if we have essential fields
          if (trusteeObject.title || trusteeObject.firstName || trusteeObject.lastName) {
            const existingData = Array.isArray(updatedValues.separateTrusteeData) 
              ? updatedValues.separateTrusteeData 
              : [];
            
            // Filter out any remaining string entries
            const cleanedExistingData = existingData.filter(item => typeof item !== 'string');
            
            // Check if this trustee already exists (by comparing key fields)
            const existingIndex = cleanedExistingData.findIndex(item => {
              if (typeof item === 'string') return false; // Skip string entries
              return item.firstName === trusteeObject.firstName && 
                     item.lastName === trusteeObject.lastName &&
                     item.address1 === trusteeObject.address1;
            });

            if (existingIndex >= 0) {
              // Update existing entry
              cleanedExistingData[existingIndex] = { ...cleanedExistingData[existingIndex], ...trusteeObject };
            } else {
              // Add new entry
              cleanedExistingData.push(trusteeObject);
            }

            updatedValues.separateTrusteeData = cleanedExistingData;
            hasChanges = true;

            console.log('[MODAL PROCESSOR] Processed separate trustee modal fields:', {
              trusteeObject,
              totalTrustees: cleanedExistingData.length
            });
          }
        }
      }


      // Process pet carer modal fields
      const petCarerPrefix = 'addPetCarer_';
      const petCarerFields = Object.keys(formValues).filter(key => key.startsWith(petCarerPrefix));
      
      if (petCarerFields.length > 0) {
        const hasRequiredFields = petCarerFields.some(key => {
          const fieldName = key.replace(petCarerPrefix, '');
          return ['title', 'firstName', 'lastName', 'address1', 'postcode'].includes(fieldName) && formValues[key];
        });

        if (hasRequiredFields) {
          const carerObject = {};
          petCarerFields.forEach(key => {
            const fieldName = key.replace(petCarerPrefix, '');
            const value = formValues[key];
            if (value && value.trim() !== '') {
              carerObject[fieldName] = value.trim();
            }
          });

          if (carerObject.title || carerObject.firstName || carerObject.lastName) {
            const existingData = Array.isArray(updatedValues.petCarerData) 
              ? updatedValues.petCarerData 
              : [];
            
            // Filter out any remaining string entries
            const cleanedExistingData = existingData.filter(item => typeof item !== 'string');
            
            const existingIndex = cleanedExistingData.findIndex(item => {
              if (typeof item === 'string') return false;
              return item.firstName === carerObject.firstName && 
                     item.lastName === carerObject.lastName &&
                     item.address1 === carerObject.address1;
            });

            if (existingIndex >= 0) {
              cleanedExistingData[existingIndex] = { ...cleanedExistingData[existingIndex], ...carerObject };
            } else {
              cleanedExistingData.push(carerObject);
            }

            updatedValues.petCarerData = cleanedExistingData;
            hasChanges = true;

            console.log('[MODAL PROCESSOR] Processed pet carer modal fields:', {
              carerObject,
              totalCarers: cleanedExistingData.length
            });
          }
        }
      }


      // Process substitute pet carer modal fields
      const substitutePetCarerPrefix = 'addSubstitutePetCarer_';
      const substitutePetCarerFields = Object.keys(formValues).filter(key => key.startsWith(substitutePetCarerPrefix));
      
      if (substitutePetCarerFields.length > 0) {
        const hasRequiredFields = substitutePetCarerFields.some(key => {
          const fieldName = key.replace(substitutePetCarerPrefix, '');
          return ['title', 'firstName', 'lastName', 'address1', 'postcode'].includes(fieldName) && formValues[key];
        });

        if (hasRequiredFields) {
          const carerObject = {};
          substitutePetCarerFields.forEach(key => {
            const fieldName = key.replace(substitutePetCarerPrefix, '');
            const value = formValues[key];
            if (value && value.trim() !== '') {
              carerObject[fieldName] = value.trim();
            }
          });

          if (carerObject.title || carerObject.firstName || carerObject.lastName) {
            const existingData = Array.isArray(updatedValues.substitutePetCarerData) 
              ? updatedValues.substitutePetCarerData 
              : [];
            
            // Filter out any remaining string entries
            const cleanedExistingData = existingData.filter(item => typeof item !== 'string');
            
            const existingIndex = cleanedExistingData.findIndex(item => {
              if (typeof item === 'string') return false;
              return item.firstName === carerObject.firstName && 
                     item.lastName === carerObject.lastName &&
                     item.address1 === carerObject.address1;
            });

            if (existingIndex >= 0) {
              cleanedExistingData[existingIndex] = { ...cleanedExistingData[existingIndex], ...carerObject };
            } else {
              cleanedExistingData.push(carerObject);
            }

            updatedValues.substitutePetCarerData = cleanedExistingData;
            hasChanges = true;

            console.log('[MODAL PROCESSOR] Processed substitute pet carer modal fields:', {
              carerObject,
              totalCarers: cleanedExistingData.length
            });
          }
        }
      }

      if (hasChanges) {
        // Check if the data actually changed to prevent infinite loops
        const dataChanged = 
          JSON.stringify(updatedValues.separateTrusteeData || []) !== JSON.stringify(formValues.separateTrusteeData || []) ||
          JSON.stringify(updatedValues.petCarerData || []) !== JSON.stringify(formValues.petCarerData || []) ||
          JSON.stringify(updatedValues.substitutePetCarerData || []) !== JSON.stringify(formValues.substitutePetCarerData || []);
        
        if (dataChanged) {
          console.log('[MODAL PROCESSOR] Updating form values with structured modal data');
          setFormValues(updatedValues);
        } else {
          console.log('[MODAL PROCESSOR] No data changes detected, skipping update');
        }
      }
    };

    // Debounce the processing to avoid excessive updates
    const timer = setTimeout(processModalFields, 500);
    return () => clearTimeout(timer);
  }, [formValues]);

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
        const dataToSave = buildLocalDraftPayload(formValues);
        DEBUG_LOGS&&console.log(`[AUTOSAVE] Prepared ${Object.keys(dataToSave).length} fields for saving`);
        
        const testStr = JSON.stringify(dataToSave);
        if (testStr.length <= 5 * 1024 * 1024) {
          if (!useExternalPersistence) {
            localStorage.setItem('willForm', testStr);
          }
          setLastSaved(new Date());
          setIsSaving(false);
          DEBUG_LOGS&&console.log(`[AUTOSAVE] Successfully saved ${Object.keys(dataToSave).length} fields to localStorage`);
          if (externalPersistence?.save) {
            externalPersistence.save({ formValues, currentIndex, saveType: 'auto' }).then((res) => {
              if (res?.error) console.warn('[AUTOSAVE] External save failed:', res.error);
            });
          } else if (useCloud && sessionInitialized && referenceNumber && sessionSecret) {
            const cloudPayload = buildCloudPayload(formValues, currentIndex);
            saveSession(referenceNumber, sessionSecret, cloudPayload).then((res) => {
              if (res.error) console.warn('[WillTool Flow] Client autosave cloud failed', { ref: referenceNumber, error: res.error });
            });
          }
        } else {
          DEBUG_LOGS&&console.warn(`[AUTOSAVE] Data too large to save: ${testStr.length} bytes`);
          setIsSaving(false);
        }
      } catch (error) {
        console.error('[AUTOSAVE] Error during autosave:', error);
        setIsSaving(false);
      }
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [formValues, useCloud, sessionInitialized, referenceNumber, sessionSecret, currentIndex, externalPersistence, useExternalPersistence]);


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
    const clauses = buildClauses({
      formValues: debouncedFormValues,
      formData,
      interpolateText,
      maxSectionIndex: currentIndex
    });
    return clauses.length > 0 ? clauses : null;
  }, [currentIndex, debouncedFormValues, interpolateText]);

  const clauseDebugExport = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    return buildClauseDebugExport(debouncedFormValues, currentIndex);
  }, [currentIndex, debouncedFormValues, buildClauseDebugExport]);

  useEffect(() => {
    if (!import.meta.env.DEV || !clauseDebugExport) return;
    const payload = clauseDebugExport;
    window.downloadClauseDebug = () => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clause-debug-export.json';
      a.click();
      URL.revokeObjectURL(url);
    };
  }, [clauseDebugExport]);

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
                          {clause.title}
                        </p>
                        <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-line">
                          {getClauseDisplayText(clause)}
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

  const handleDownloadPDF = async (clientCopy = false) => {
    // CRITICAL FIX: Prevent PDF generation spam - guard against multiple simultaneous calls
    if (isGeneratingPDF) {
      console.warn('[PDF] ⚠️ PDF generation already in progress, ignoring duplicate call');
      return;
    }
    
    setIsGeneratingPDF(true);
    setBanner(null);
    
    let timeoutId;
    let toastId;
    
    // Set a timeout to prevent hanging forever (30 seconds max)
    timeoutId = setTimeout(() => {
      console.error('[PDF] ⚠️ PDF generation timeout after 30 seconds');
      setIsGeneratingPDF(false);
      if (toastId) toast.dismiss(toastId);
      toast.error('PDF generation timed out', {
        description: 'The PDF generation took too long. Please try again or refresh the page.',
        duration: 8000
      });
    }, 30000);
    
    try {
      toastId = toast.loading('Generating PDF…', { description: 'This can take a few seconds on mobile.' });

      const preValidationIssues = [
        ...validatePropertyTrustSchedules(formValues, formData),
        ...validateBPRTrustSchedules(formValues, formData)
      ];

      if (preValidationIssues.length > 0) {
        clearTimeout(timeoutId);
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
          if (!useExternalPersistence) {
            localStorage.removeItem('willForm');
          }
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
            clearTimeout(timeoutId);
            setIsGeneratingPDF(false);
            if (toastId) toast.dismiss(toastId);
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
        clearTimeout(timeoutId);
        setIsGeneratingPDF(false);
        toast.dismiss(toastId);
        toast.error('PDF generator not available', {
          description: 'Unable to load PDF generator. Please refresh the page and try again. Your data has been saved.',
          duration: 10000
        });
        return;
      }
      
      console.log('[WillTool Flow] PDF generation started', { isClientPDF: clientCopy || !solicitorMode, phase: 'client_pdf_start' });
      console.log('[PDF GENERATION] 🔄 Calling generatePDFWithJSPDF with sanitized values...');
      console.log('[PDF GENERATION] 📊 Sanitized values summary:', {
        totalFields: Object.keys(sanitizedValues).length,
        hasSeparateTrusteeData: !!sanitizedValues.separateTrusteeData,
        separateTrusteeDataType: Array.isArray(sanitizedValues.separateTrusteeData) ? 'array' : typeof sanitizedValues.separateTrusteeData,
        separateTrusteeDataLength: Array.isArray(sanitizedValues.separateTrusteeData) ? sanitizedValues.separateTrusteeData.length : 'N/A',
        howResidueDistributed: sanitizedValues.howResidueDistributed,
        appointSeparateTrusteesFLIT: sanitizedValues.appointSeparateTrusteesFLIT,
        hasTestatorSignature: !!testatorSignature,
        hasConsultantSignature: !!consultantSignature,
        hasClientSignature: !!clientSignature
      });
      
      if (sanitizedValues.separateTrusteeData) {
        console.log('[PDF GENERATION] 🔍 Separate trustee data in sanitized values:', {
          isArray: Array.isArray(sanitizedValues.separateTrusteeData),
          length: Array.isArray(sanitizedValues.separateTrusteeData) ? sanitizedValues.separateTrusteeData.length : 'N/A',
          firstItem: Array.isArray(sanitizedValues.separateTrusteeData) && sanitizedValues.separateTrusteeData.length > 0 
            ? sanitizedValues.separateTrusteeData[0] 
            : 'N/A'
        });
      }
      
      // clientCopy: client-safe PDF (no witnesses, not sign-ready) for sending to client. Otherwise: full execution PDF.
      const isClientPDF = clientCopy || !solicitorMode;
      const pdfResult = await generatePDFWithJSPDF(sanitizedValues, {
        testatorSignature,
        consultantSignature,
        clientSignature
      }, { isClientPDF, formSchema: formData });
      
      console.log('[WillTool Flow] PDF generation completed', { hasDoc: !!pdfResult?.doc, hasPlaceholders: pdfResult?.hasPlaceholders, phase: 'client_pdf_done' });
      console.log('[PDF GENERATION] ✅ PDF generation completed:', {
        hasDoc: !!pdfResult.doc,
        hasMissingItems: !!pdfResult.missingItems,
        missingItemsCount: pdfResult.missingItems?.length || 0,
        hasPlaceholders: pdfResult.hasPlaceholders,
        hasCriticalIssues: pdfResult.hasCriticalIssues,
        criticalIssuesCount: pdfResult.criticalIssues?.length || 0
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
        clearTimeout(timeoutId);
        setValidationIssues(allIssues);
        setValidationModalOpen(true);
        setIsGeneratingPDF(false);
        toast.dismiss(toastId);
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
      console.log('[WillTool Flow] Client PDF downloaded', { filename, phase: 'client_pdf_download' });

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

      if (timeoutId) clearTimeout(timeoutId);
      setIsGeneratingPDF(false);
      if (toastId) toast.dismiss(toastId);
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      const msg = error?.message || 'Unknown error';
      setIsGeneratingPDF(false);
      if (toastId) toast.dismiss(toastId);
      setBanner({ type: 'error', message: `Error generating PDF: ${msg}` });
      toast.error('Error generating PDF', { description: msg });
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-dvh bg-gray-50">
      {/* Full-screen PDF Generation Loading Overlay */}
      {isGeneratingPDF && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-loading-title"
          aria-busy="true"
          onClick={(e) => e.preventDefault()} // Prevent any clicks
          onMouseDown={(e) => e.preventDefault()} // Prevent any mouse interactions
          style={{ pointerEvents: 'all', userSelect: 'none' }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
              <h2 id="pdf-loading-title" className="text-2xl font-bold text-gray-900">
                Generating PDF...
              </h2>
              <p className="text-gray-600">
                This can take a few seconds. Please wait...
              </p>
              <div className="mt-2 text-sm text-gray-500">
                Do not close this window
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} visibleSections={visibleSections} />

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
                {/* Reference Number Display */}
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <span className="text-gray-600">Ref:</span>
                  <code className="px-2 py-1 bg-gray-100 rounded font-mono font-semibold text-indigo-700">
                    {referenceNumber}
                  </code>
                  {!useExternalPersistence && (
                    <button
                      type="button"
                      onClick={() => {
                        const shareUrl = new URL(window.location.href);
                        shareUrl.searchParams.set('ref', referenceNumber);
                        if (sessionSecret) shareUrl.searchParams.set('s', sessionSecret);
                        const urlToShare = shareUrl.toString();
                        
                        if (navigator.share) {
                          navigator.share({
                            title: 'Will Form - Share Link',
                            text: useCloud && sessionSecret
                              ? 'Use this link to open your Will form on another device. Your progress is saved to the cloud.'
                              : 'Use this link to share your Will form. Your reference number is included. Form data is stored on this device only.',
                            url: urlToShare,
                          }).catch(() => {
                            navigator.clipboard.writeText(urlToShare);
                            toast.success('Link copied', { description: useCloud && sessionSecret ? 'Share link copied. Open it on another device to continue. Anyone with the link can view or edit—keep it secure.' : 'Share link copied. The link includes your reference number. Form data is stored on this device only.' });
                          });
                        } else {
                          navigator.clipboard.writeText(urlToShare);
                          toast.success('Link copied', { description: useCloud && sessionSecret ? 'Share link copied. Open it on another device to continue. Anyone with the link can view or edit—keep it secure.' : 'Share link copied. The link includes your reference number. Form data is stored on this device only.' });
                        }
                      }}
                      className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors font-medium"
                      title={sessionSecret ? 'Copy link (opens your saved form on another device)' : 'Share link (includes reference number)'}
                    >
                      {sessionSecret ? 'Copy link' : 'Share'}
                    </button>
                  )}
                </div>
              </div>
              
              {/* Share Link Warning */}
              {!useExternalPersistence && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs text-amber-800">
                    {useCloud && sessionSecret ? (
                      <><strong>Cross-device:</strong> Your link saves and loads your form from the cloud. Anyone with the link can view or edit—share only with trusted parties and keep it secure.</>
                    ) : (
                      <><strong>Important:</strong> Your reference number and share link let you share your progress. Form data is currently stored on this device only—opening the link on another device will not restore your form. If you share the link, anyone with it can view and edit your form. Keep it secure.</>
                    )}
                  </p>
                </div>
              )}

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
                      Step {currentIndex + 1} of {visibleSections.length}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner mb-2">
                  <div
                    className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 h-3 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
                    style={{ width: `${((currentIndex + 1) / visibleSections.length) * 100}%` }}
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
                  {/* Client mode: no downloads. Solicitor mode: Execution PDF + Client copy */}
                  {currentIndex === visibleSections.length - 1 && isFormFullyCompleted() ? (
                    <div className="flex flex-wrap items-center gap-2">
                    {solicitorMode && (
                    <>
                    <button
                      onClick={() => handleDownloadPDF(false)}
                      disabled={isGeneratingPDF}
                      className={`flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:from-indigo-800 active:to-indigo-900 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-lg transition-all duration-300 font-medium z-10 relative min-h-[44px] touch-manipulation text-sm sm:text-base w-full sm:w-auto ${
                        isGeneratingPDF 
                          ? 'opacity-75 cursor-not-allowed' 
                          : 'cursor-pointer animate-pulse-subtle'
                      }`}
                      type="button"
                      aria-label={isGeneratingPDF ? "Generating PDF, please wait" : "Download full PDF (execution copy)"}
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
                          <span>Execution PDF (for file)</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDownloadPDF(true)}
                      disabled={isGeneratingPDF}
                      className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl shadow transition-all font-medium min-h-[44px] touch-manipulation text-sm border border-amber-500"
                      type="button"
                      aria-label="Download client copy (intake-only, not a final Will)"
                    >
                      <Download size={18} />
                      <span>Download Client copy (Intake-only – not a final Will)</span>
                    </button>
                    </>
                    )}
                    {!solicitorMode && (
                    <div className="flex flex-col gap-1 text-sm text-gray-700 bg-amber-50 border border-amber-300 px-4 py-3 rounded-xl max-w-lg">
                      <p className="font-semibold text-amber-900">Questionnaire complete — this is not your final Will</p>
                      <p>Solicitor review and identity verification happen next. Your documents will be emailed to you. An appointment will be scheduled for legal signing (wet signature) with witnesses.</p>
                    </div>
                    )}
                    </div>
                  ) : currentIndex === visibleSections.length - 1 ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                      <AlertCircle size={16} />
                      <span className="italic">{solicitorMode ? 'Complete all required fields to enable download' : 'Complete all required fields'}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                      <AlertCircle size={16} />
                      <span className="italic">{solicitorMode ? 'Complete all steps to enable download' : 'Complete all steps'}</span>
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
                  // #3 Client mode: hide solicitor-only fields (witness, signatures, execution) in Testamentary Capacity
                  if (!solicitorMode && SOLICITOR_ONLY_FIELD_IDS.has(field.id)) {
                    return null;
                  }
                  // Skip fields that shouldn't be shown (conditions not met)
                  if (field.conditions && !evaluateFieldConditions(field)) {
                    // ALWAYS-ON Debug logging for foreignWillNotRevoked
                    if (field.id === 'foreignWillNotRevoked') {
                      console.log(`[FIELD RENDER] ❌ Field "${field.id}" SKIPPED - conditions not met:`, {
                        fieldId: field.id,
                        fieldLabel: field.label,
                        conditions: field.conditions,
                        conditionLogic: field.conditionLogic,
                        assetsAbroad: formValues.assetsAbroad,
                        currentSection: currentSection.formSection
                      });
                    }
                    return null;
                  }
                  
                  // ALWAYS-ON Debug logging for foreignWillNotRevoked when it IS rendered
                  if (field.id === 'foreignWillNotRevoked') {
                    console.log(`[FIELD RENDER] ✅ Field "${field.id}" WILL BE RENDERED:`, {
                      fieldId: field.id,
                      fieldLabel: field.label,
                      currentSection: currentSection.formSection,
                      hasConditions: !!field.conditions,
                      conditionResult: field.conditions ? evaluateFieldConditions(field) : 'N/A (no conditions)'
                    });
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
                {/* #8 Identity verification - client mode, post-completion section on last step */}
                {!solicitorMode && currentIndex === visibleSections.length - 1 && (
                  <IdentityVerification formValues={formValues} setFormValues={setFormValues} />
                )}
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
                  disabled={isSubmittingMatter}
                  className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-lg transition-all duration-300 font-medium min-h-[44px] touch-manipulation text-sm sm:text-base ${
                    allRequiredFilled && !isSubmittingMatter
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:from-indigo-800 active:to-indigo-900 text-white'
                      : 'bg-gradient-to-r from-indigo-400 to-indigo-500 text-white opacity-75 cursor-pointer hover:opacity-90 active:opacity-100'
                  }`}
                  type="button"
                  title={!allRequiredFilled ? 'Click to see what needs to be completed' : ''}
                >
                  <span>{currentIndex === visibleSections.length - 1 ? (isSubmittingMatter ? 'Submitting...' : 'Submit') : 'Next'}</span>
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
                            {clause.title}
                          </p>
                          <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-line">
                            {getClauseDisplayText(clause)}
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
                      key={`${fieldId || issue.field || issue.fieldLabel || 'issue'}-${index}`}
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
                                const labelMatchId = findFieldIdByLabel(issue.field || issue.fieldLabel || fieldLabel);
                                if (labelMatchId) {
                                  DEBUG_LOGS&&console.log('[ITEM CLICK] ✅ Found field by label mapping:', labelMatchId);
                                  scrollToField(labelMatchId);
                                  setValidationModalOpen(false);
                                } else {
                                  console.error('[ITEM CLICK] ❌ Could not find field:', issue.field);
                                }
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
                      // CRITICAL FIX: Prevent multiple clicks and PDF generation spam
                      e.preventDefault();
                      e.stopPropagation();
                      
                      console.log('[GO TO FIRST ISSUE] 🔍 ========== BUTTON CLICKED ==========');
                      console.log('[GO TO FIRST ISSUE] 🔍 Validation issues count:', validationIssues?.length);
                      console.log('[GO TO FIRST ISSUE] 🔍 Validation issues:', validationIssues);
                      
                      const firstIssue = validationIssues[0];
                      console.log('[GO TO FIRST ISSUE] 🔍 First issue object:', firstIssue);
                      console.log('[GO TO FIRST ISSUE] 🔍 First issue keys:', firstIssue ? Object.keys(firstIssue) : 'N/A');
                      console.log('[GO TO FIRST ISSUE] 🔍 First issue details:', {
                        field: firstIssue?.field,
                        fieldId: firstIssue?.fieldId,
                        fieldLabel: firstIssue?.fieldLabel,
                        section: firstIssue?.section,
                        sectionId: firstIssue?.sectionId,
                        clauseNumber: firstIssue?.clauseNumber,
                        issue: firstIssue?.issue,
                        targetFieldIds: firstIssue?.targetFieldIds,
                        targetSectionIndex: firstIssue?.targetSectionIndex
                      });
                      
                      if (!firstIssue) {
                        console.error('[GO TO FIRST ISSUE] ❌ No first issue found!');
                        return;
                      }
                      
                      // EARLY CHECK: Handle missing data issues for separate trustees and pet carers
                      const issueField = (firstIssue.field || '').toLowerCase();
                      const issueSection = (firstIssue.section || '').toLowerCase();
                      const isSeparateTrusteeIssue = (issueField.includes('separate') && issueField.includes('trustee')) ||
                        (issueSection.includes('estate') && issueField.includes('trustee'));
                      const isPetCarerIssue = (issueField.includes('pet') && (issueField.includes('carer') || issueField.includes('care'))) ||
                        (issueSection.includes('provision') && issueField.includes('pet'));
                      
                      // Check for separate trustees: if "Yes" selected but no data
                      if (isSeparateTrusteeIssue && formValues.appointSeparateTrusteesFLIT === 'Yes') {
                        const hasSeparateTrusteeData = Array.isArray(formValues.separateTrusteeData) && 
                          formValues.separateTrusteeData.length > 0 &&
                          formValues.separateTrusteeData.some(item => 
                            item && typeof item === 'object' && 
                            (item.firstName || item.lastName || item.address1)
                          );
                        
                        if (!hasSeparateTrusteeData) {
                          console.log('[GO TO FIRST ISSUE] ✅ Early check: Separate trustee issue with missing data');
                          // Search recursively through fields and subFields to find the section containing addSeparateTrusteeButton or appointSeparateTrusteesFLIT
                          let containingSection = null;
                          let containingSectionIndex = -1;
                          
                          for (let i = 0; i < formData.formSections.length; i++) {
                            const section = formData.formSections[i];
                            const hasField = section.fields?.some(f => {
                              if (f.id === 'addSeparateTrusteeButton' || f.id === 'appointSeparateTrusteesFLIT') {
                                return true;
                              }
                              // Check subFields if it's a section field
                              if (f.type === 'section' && f.subFields) {
                                return f.subFields.some(sf => sf.id === 'addSeparateTrusteeButton' || sf.id === 'appointSeparateTrusteesFLIT');
                              }
                              return false;
                            });
                            
                            if (hasField) {
                              containingSection = section;
                              containingSectionIndex = i;
                              break;
                            }
                          }
                          
                          if (containingSection && containingSectionIndex >= 0) {
                            console.log('[GO TO FIRST ISSUE] Found section containing separate trustee fields:', containingSection.formSection);
                            setCurrentIndex(containingSectionIndex);
                            setValidationModalOpen(false);
                            toast.info('Please click "Add Separate Trustee" to add trustee details.', { duration: 5000 });
                            // Wait longer for section to render, then try multiple field IDs
                            setTimeout(() => {
                              // Try addSeparateTrusteeButton first, then appointSeparateTrusteesFLIT as fallback
                              scrollToField('addSeparateTrusteeButton', ['appointSeparateTrusteesFLIT'], 0);
                            }, 1000);
                            return;
                          } else {
                            console.warn('[GO TO FIRST ISSUE] Could not find section containing addSeparateTrusteeButton');
                          }
                        }
                      }
                      
                      // Check for pet carers: if "Yes" selected but no data
                      if (isPetCarerIssue && formValues.provisionsForPets === 'Yes') {
                        const hasPetCarerData = Array.isArray(formValues.petCarerData) && 
                          formValues.petCarerData.length > 0 &&
                          formValues.petCarerData.some(item => 
                            item && typeof item === 'object' && 
                            (item.firstName || item.lastName || item.address1)
                          );
                        
                        if (!hasPetCarerData) {
                          console.log('[GO TO FIRST ISSUE] ✅ Early check: Pet carer issue with missing data');
                          // Search recursively through fields and subFields to find the section containing addPetCarerButton or provisionsForPets
                          let containingSection = null;
                          let containingSectionIndex = -1;
                          
                          for (let i = 0; i < formData.formSections.length; i++) {
                            const section = formData.formSections[i];
                            const hasField = section.fields?.some(f => {
                              if (f.id === 'addPetCarerButton' || f.id === 'provisionsForPets') {
                                return true;
                              }
                              // Check subFields if it's a section field
                              if (f.type === 'section' && f.subFields) {
                                return f.subFields.some(sf => sf.id === 'addPetCarerButton' || sf.id === 'provisionsForPets');
                              }
                              return false;
                            });
                            
                            if (hasField) {
                              containingSection = section;
                              containingSectionIndex = i;
                              break;
                            }
                          }
                          
                          if (containingSection && containingSectionIndex >= 0) {
                            console.log('[GO TO FIRST ISSUE] Found section containing pet carer fields:', containingSection.formSection);
                            setCurrentIndex(containingSectionIndex);
                            setValidationModalOpen(false);
                            toast.info('Please click "Add Pet Carer" to add pet carer details.', { duration: 5000 });
                            // Wait longer for section to render, then scroll
                            setTimeout(() => scrollToField('addPetCarerButton'), 800);
                            return;
                          } else {
                            console.warn('[GO TO FIRST ISSUE] Could not find section containing addPetCarerButton');
                          }
                        }
                      }
                      
                      // PRIORITY 1: Use fieldId if available (most reliable) - check this FIRST
                      // This handles Property Trust and BPR Trust schedule issues that have fieldId
                      console.log('[GO TO FIRST ISSUE] 🔍 Checking PRIORITY 1: fieldId =', firstIssue.fieldId);
                      if (firstIssue.fieldId) {
                        console.log('[GO TO FIRST ISSUE] ✅ PRIORITY 1: Has fieldId, navigating to field:', firstIssue.fieldId);
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
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Issue details:', {
                          section: firstIssue.section,
                          field: firstIssue.field,
                          clauseNumber: firstIssue.clauseNumber,
                          fieldLabel: firstIssue.fieldLabel
                        });
                        
                        // Strategy 1: Try direct field ID match (if field is actually an ID)
                        console.log('[GO TO FIRST ISSUE] 🔍 Strategy 1: Trying direct field ID match:', {
                          fieldId: firstIssue.field,
                          selector: `[data-field-id="${firstIssue.field}"]`
                        });
                        let fieldElement = document.querySelector(`[data-field-id="${firstIssue.field}"]`);
                        console.log('[GO TO FIRST ISSUE] 🔍 Strategy 1 result:', {
                          fieldElement: !!fieldElement,
                          found: !!fieldElement
                        });
                        if (fieldElement) {
                          console.log('[GO TO FIRST ISSUE] ✅ Found field element via direct ID, scrolling...');
                          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          const input = fieldElement.querySelector('input, textarea, select');
                          if (input) {
                            setTimeout(() => input.focus(), 500);
                          }
                          setValidationModalOpen(false);
                          return;
                        }
                        console.error('[GO TO FIRST ISSUE] ❌ Strategy 1 failed - field element not found');
                        
                        // Strategy 2: Try to find field by label (most reliable for PDF issues)
                        console.log('[GO TO FIRST ISSUE] 🔍 Strategy 2: Searching for field by label:', {
                          fieldLabel: firstIssue.field,
                          fieldLabelAlt: firstIssue.fieldLabel,
                          searchString: firstIssue.field || firstIssue.fieldLabel
                        });
                        
                        // CRITICAL FIX: Direct mapping for "Do you wish to appoint separate Trustees?"
                        let labelMatchId = null;
                        
                        // Extract field label - remove section prefix if present (format: "Section: Field Label")
                        let fieldLabelOriginal = firstIssue.field || firstIssue.fieldLabel || '';
                        // If field contains colon, extract the part after the colon (the actual field label)
                        if (fieldLabelOriginal.includes(':')) {
                          const colonIndex = fieldLabelOriginal.indexOf(':');
                          fieldLabelOriginal = fieldLabelOriginal.substring(colonIndex + 1).trim();
                        }
                        const fieldLabelLower = fieldLabelOriginal.toLowerCase();
                        const issueSectionLower = (firstIssue.section || '').toLowerCase();
                        
                        console.log('[GO TO FIRST ISSUE] 🔍 Extracted field label:', {
                          original: firstIssue.field || firstIssue.fieldLabel,
                          extracted: fieldLabelOriginal,
                          fieldId: firstIssue.fieldId,
                          section: firstIssue.section
                        });
                        
                        // PRIORITY 1: Check if this is explicitly a separate trustee field by ID
                        if (firstIssue.fieldId === 'appointSeparateTrusteesFLIT' || 
                            firstIssue.fieldId === 'separateTrusteesSection') {
                          labelMatchId = 'appointSeparateTrusteesFLIT';
                          console.log('[GO TO FIRST ISSUE] ✅ Matched by fieldId:', firstIssue.fieldId);
                        }
                        // PRIORITY 2: Check section name + field text combination (most reliable)
                        else if ((issueSectionLower.includes('estate') && issueSectionLower.includes('residue')) ||
                                 issueSectionLower === 'estate administration/residue') {
                          // If section is "Estate Administration/Residue" and field mentions trustee/separate
                          // Exclude digital executor fields
                          const isDigitalExecutorField = fieldLabelLower.includes('digital') && (fieldLabelLower.includes('executor') || fieldLabelLower.includes('executors'));
                          if (!isDigitalExecutorField && 
                              (fieldLabelLower.includes('separate') || 
                               fieldLabelLower.includes('trustee') || 
                               fieldLabelLower.includes('trustees') ||
                               fieldLabelLower.includes('appoint'))) {
                            labelMatchId = 'appointSeparateTrusteesFLIT';
                            console.log('[GO TO FIRST ISSUE] ✅ Matched by section + field text:', {
                              section: firstIssue.section,
                              field: fieldLabelOriginal
                            });
                          }
                        }
                        // PRIORITY 3: Direct exact match for "Do you wish to appoint separate Trustees?"
                        else if (fieldLabelOriginal === 'Do you wish to appoint separate Trustees?' || 
                                 fieldLabelLower === 'do you wish to appoint separate trustees?') {
                          labelMatchId = 'appointSeparateTrusteesFLIT';
                          console.log('[GO TO FIRST ISSUE] ✅ Matched by exact label:', fieldLabelOriginal);
                        }
                        // PRIORITY 3b: Check field text patterns (exclude digital executor fields)
                        else if (!fieldLabelLower.includes('digital') && 
                                 ((fieldLabelLower.includes('separate') && fieldLabelLower.includes('trustee')) ||
                                  (fieldLabelLower.includes('separate') && fieldLabelLower.includes('trustees')) ||
                                  (fieldLabelLower.includes('appoint') && fieldLabelLower.includes('separate') && fieldLabelLower.includes('trustee')) ||
                                  (fieldLabelLower.includes('wish') && fieldLabelLower.includes('appoint') && fieldLabelLower.includes('separate')))) {
                          labelMatchId = 'appointSeparateTrusteesFLIT';
                          console.log('[GO TO FIRST ISSUE] ✅ Matched by field text pattern:', fieldLabelOriginal);
                        }
                        // PRIORITY 4: Try findFieldIdByLabel as fallback
                        else {
                          // Before calling findFieldIdByLabel, check if it's NOT a guardian, digital executor, or business trustee field
                          const isGuardianField = fieldLabelLower.includes('guardian') && !fieldLabelLower.includes('trustee');
                          const isDigitalExecutorField = fieldLabelLower.includes('digital') && (fieldLabelLower.includes('executor') || fieldLabelLower.includes('executors'));
                          const isBusinessTrusteeField = (fieldLabelLower.includes('business') && fieldLabelLower.includes('trustee')) || 
                            firstIssue.fieldId === 'appointSeparateBusinessTrustee';
                          
                          // If searching for separate trustees, exclude digital executor and business trustee fields
                          const isSearchingForSeparateTrustees = fieldLabelLower.includes('separate') && 
                            (fieldLabelLower.includes('trustee') || fieldLabelLower.includes('trustees'));
                          
                          if (isGuardianField) {
                            console.log('[GO TO FIRST ISSUE] ⚠️ Detected as guardian field, skipping separate trustee search');
                          } else if (isSearchingForSeparateTrustees && (isDigitalExecutorField || isBusinessTrusteeField)) {
                            console.log('[GO TO FIRST ISSUE] ⚠️ Detected as digital executor or business trustee field, skipping separate trustee search');
                            // For separate trustees, directly map to appointSeparateTrusteesFLIT
                            labelMatchId = 'appointSeparateTrusteesFLIT';
                            console.log('[GO TO FIRST ISSUE] ✅ Directly mapped to appointSeparateTrusteesFLIT (excluded digital executor/business trustee)');
                          } else {
                            labelMatchId = findFieldIdByLabel(fieldLabelOriginal);
                            console.log('[GO TO FIRST ISSUE] 🔍 Tried findFieldIdByLabel, result:', labelMatchId);
                            
                            // CRITICAL FIX: If findFieldIdByLabel returned a digital executor, business trustee, or separateTrusteesSection field but we're looking for FLIT trustees, override it
                            if (isSearchingForSeparateTrustees && (
                              labelMatchId === 'appointSeparateDigitalExecutor' || 
                              labelMatchId === 'appointSeparateBusinessTrustee' ||
                              labelMatchId === 'separateTrusteesSection'
                            )) {
                              console.log('[GO TO FIRST ISSUE] ⚠️ findFieldIdByLabel returned wrong field (' + labelMatchId + '), overriding to appointSeparateTrusteesFLIT');
                              labelMatchId = 'appointSeparateTrusteesFLIT';
                            }
                          }
                        }
                        
                        console.log('[GO TO FIRST ISSUE] 🔍 Strategy 2 result:', {
                          labelMatchId,
                          found: !!labelMatchId,
                          searchString: firstIssue.field || firstIssue.fieldLabel
                        });
                        if (labelMatchId) {
                          console.log('[GO TO FIRST ISSUE] ✅ Found field by label mapping:', labelMatchId);
                          
                          // CRITICAL FIX: Handle conditionally rendered fields (like appointSeparateTrusteesFLIT)
                          if (labelMatchId === 'appointSeparateTrusteesFLIT') {
                            console.log('[GO TO FIRST ISSUE] 🎯 Handling separate trustees field navigation');
                            
                            // Check if field conditions are met (field requires howResidueDistributed === 'IntoFLIT')
                            const fieldDef = formData.formSections
                              .flatMap(s => s.fields || [])
                              .find(f => f.id === labelMatchId);
                            
                            const needsFLITCondition = fieldDef?.conditions?.some(c => 
                              c.field === 'howResidueDistributed' && c.value === 'IntoFLIT'
                            );
                            const hasFLITCondition = formValues.howResidueDistributed === 'IntoFLIT';
                            
                            console.log('[GO TO FIRST ISSUE] Field condition check:', {
                              needsFLITCondition,
                              hasFLITCondition,
                              howResidueDistributed: formValues.howResidueDistributed
                            });
                            
                            // Find the section containing this field - use section from issue or search
                            let targetSection = null;
                            let targetSectionIndex = -1;
                            
                            // First, try to find section by name from the issue
                            if (firstIssue.section) {
                              targetSectionIndex = formData.formSections.findIndex(s => 
                                s.formSection.toLowerCase() === firstIssue.section.toLowerCase() ||
                                (s.formSection.toLowerCase().includes('estate') && s.formSection.toLowerCase().includes('residue'))
                              );
                              if (targetSectionIndex >= 0) {
                                targetSection = formData.formSections[targetSectionIndex];
                                console.log('[GO TO FIRST ISSUE] ✅ Found section by issue.section:', targetSection.formSection);
                              }
                            }
                            
                            // If not found, search for section containing the field
                            if (!targetSection) {
                              targetSection = formData.formSections.find(section =>
                                section.fields?.some(f => f.id === labelMatchId)
                              );
                              if (targetSection) {
                                targetSectionIndex = formData.formSections.findIndex(s =>
                                  s.formSection === targetSection.formSection
                                );
                                console.log('[GO TO FIRST ISSUE] ✅ Found section by field search:', targetSection.formSection);
                              }
                            }
                            
                            // If still not found, try "Estate Administration/Residue" directly
                            if (!targetSection) {
                              targetSectionIndex = formData.formSections.findIndex(s =>
                                s.formSection.toLowerCase().includes('estate') && 
                                s.formSection.toLowerCase().includes('residue')
                              );
                              if (targetSectionIndex >= 0) {
                                targetSection = formData.formSections[targetSectionIndex];
                                console.log('[GO TO FIRST ISSUE] ✅ Found section by name search:', targetSection.formSection);
                              }
                            }
                            
                            if (targetSection && targetSectionIndex >= 0) {
                              console.log('[GO TO FIRST ISSUE] 🚀 Navigating to section:', targetSection.formSection, 'at index:', targetSectionIndex);
                              
                              // CRITICAL: Ensure FLIT condition is met BEFORE navigating
                              if (needsFLITCondition && !hasFLITCondition) {
                                console.log('[GO TO FIRST ISSUE] ⚠️ FLIT condition not met, setting howResidueDistributed to "IntoFLIT"');
                                setFormValues(prev => ({ ...prev, howResidueDistributed: 'IntoFLIT' }));
                                // Wait for condition evaluation, then navigate and scroll
                                setTimeout(() => {
                                  setCurrentIndex(targetSectionIndex);
                                  setValidationModalOpen(false);
                                  // Use longer timeout to ensure field is rendered after condition evaluation
                                  setTimeout(() => {
                                    console.log('[GO TO FIRST ISSUE] 🔍 Attempting to scroll to field after condition set:', labelMatchId);
                                    scrollToField(labelMatchId);
                                  }, 1000);
                                }, 300);
                                return;
                              }
                              
                              setCurrentIndex(targetSectionIndex);
                              setValidationModalOpen(false);
                              
                              // Wait for section to render and condition to be evaluated, then scroll to field
                              // Increased timeout to ensure condition evaluation completes and field is visible
                              setTimeout(() => {
                                console.log('[GO TO FIRST ISSUE] 🔍 Attempting to scroll to field:', labelMatchId);
                                // Try multiple times with increasing delays to account for conditional rendering
                                const tryScroll = (attempt = 0) => {
                                  const fieldElement = document.querySelector(`[data-field-id="${labelMatchId}"]`);
                                  if (fieldElement) {
                                    console.log('[GO TO FIRST ISSUE] ✅ Found field element, scrolling');
                                    fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    const input = fieldElement.querySelector('input, textarea, select, button');
                                    if (input) {
                                      setTimeout(() => input.focus(), 300);
                                    }
                                    fieldElement.classList.add('animate-pulse');
                                    setTimeout(() => fieldElement.classList.remove('animate-pulse'), 2000);
                                  } else if (attempt < 3) {
                                    console.log(`[GO TO FIRST ISSUE] ⏳ Field not found, retrying in ${(attempt + 1) * 500}ms (attempt ${attempt + 1}/3)`);
                                    setTimeout(() => tryScroll(attempt + 1), (attempt + 1) * 500);
                                  } else {
                                    console.error('[GO TO FIRST ISSUE] ❌ Field not found after retries, using scrollToField function');
                                    scrollToField(labelMatchId);
                                  }
                                };
                                tryScroll();
                              }, 800); // Initial delay to ensure section renders
                              return;
                            } else {
                              console.error('[GO TO FIRST ISSUE] ❌ Could not find section containing appointSeparateTrusteesFLIT');
                              // Fallback: try direct scroll anyway
                              setValidationModalOpen(false);
                              setTimeout(() => {
                                scrollToField(labelMatchId);
                              }, 100);
                              return;
                            }
                          }
                          
                          // CRITICAL FIX: Handle pet carer issues - if user selected "Yes" but hasn't added pet carer data
                          const fieldLabelLower = (firstIssue.field || firstIssue.fieldLabel || '').toLowerCase();
                          const isPetCarerIssue = fieldLabelLower.includes('pet') && 
                            (fieldLabelLower.includes('carer') || fieldLabelLower.includes('care'));
                          
                          if (isPetCarerIssue) {
                            const hasPetProvisions = formValues.provisionsForPets === 'Yes';
                            const hasPetCarerData = Array.isArray(formValues.petCarerData) && 
                              formValues.petCarerData.length > 0 &&
                              formValues.petCarerData.some(item => 
                                item && typeof item === 'object' && 
                                (item.firstName || item.lastName || item.address1)
                              );
                            
                            if (hasPetProvisions && !hasPetCarerData) {
                              console.log('[GO TO FIRST ISSUE] ✅ User selected "Yes" for pet provisions but no pet carer data - scrolling to Add button');
                              
                              // Find the section containing provisionsForPets field
                              const containingSection = formData.formSections.find(section =>
                                section.fields?.some(f => f.id === 'provisionsForPets' || f.id === 'addPetCarerButton')
                              );
                              
                              if (containingSection) {
                                const sectionIndex = formData.formSections.findIndex(s => 
                                  s.formSection === containingSection.formSection
                                );
                                if (sectionIndex >= 0) {
                                  console.log('[GO TO FIRST ISSUE] Navigating to section:', containingSection.formSection);
                                  setCurrentIndex(sectionIndex);
                                  setValidationModalOpen(false);
                                  
                                  // Show helpful message
                                  toast.info(
                                    'Please click "Add Pet Carer" to add pet carer details.',
                                    { duration: 5000 }
                                  );
                                  
                                  // Wait for section to render, then scroll to Add button
                                  setTimeout(() => {
                                    scrollToField('addPetCarerButton');
                                  }, 500);
                                  return;
                                }
                              }
                            }
                          }
                          
                          // SPECIAL HANDLING for foreignWillNotRevoked: Find its section and navigate to it first
                          if (labelMatchId === 'foreignWillNotRevoked') {
                            console.log('[GO TO FIRST ISSUE] 🔍 SPECIAL HANDLING: foreignWillNotRevoked detected');
                            
                            // Find which section contains this field
                            let targetSectionIndex = -1;
                            for (let i = 0; i < formData.formSections.length; i++) {
                              const section = formData.formSections[i];
                              const hasField = section.fields?.some(f => {
                                // Check field itself
                                if (f.id === 'foreignWillNotRevoked') return true;
                                // Check nested structures
                                if (f.subFields?.some(sf => sf.id === 'foreignWillNotRevoked')) return true;
                                if (f.options?.some(opt => opt.fields?.some(nf => nf.id === 'foreignWillNotRevoked'))) return true;
                                return false;
                              });
                              if (hasField) {
                                targetSectionIndex = i;
                                console.log('[GO TO FIRST ISSUE] ✅ Found foreignWillNotRevoked in section:', {
                                  index: i,
                                  sectionName: section.formSection
                                });
                                break;
                              }
                            }
                            
                            // Ensure assetsAbroad is set to "Yes" to meet the condition
                            if (formValues.assetsAbroad !== 'Yes') {
                              console.log('[GO TO FIRST ISSUE] ⚠️ assetsAbroad is not "Yes", setting it to meet condition');
                              setFormValues(prev => ({ ...prev, assetsAbroad: 'Yes' }));
                            }
                            
                            // Navigate to the section first
                            if (targetSectionIndex >= 0) {
                              console.log('[GO TO FIRST ISSUE] 🔍 Navigating to section index:', targetSectionIndex);
                              setCurrentIndex(targetSectionIndex);
                              setValidationModalOpen(false);
                              // Wait for section to render and condition to be evaluated
                              setTimeout(() => {
                                console.log('[GO TO FIRST ISSUE] 🔍 Section rendered, scrolling to field');
                                scrollToField(labelMatchId);
                              }, 500); // Longer timeout to ensure condition evaluation completes
                              return;
                            } else {
                              console.error('[GO TO FIRST ISSUE] ❌ Could not find section containing foreignWillNotRevoked');
                            }
                          }
                          
                          console.log('[GO TO FIRST ISSUE] 🔍 Calling scrollToField with:', labelMatchId);
                          scrollToField(labelMatchId);
                          setValidationModalOpen(false);
                          return;
                        }
                        console.error('[GO TO FIRST ISSUE] ❌ Strategy 2 failed - labelMatchId is null/undefined');
                        console.error('[GO TO FIRST ISSUE] ❌ findFieldIdByLabel returned null for:', firstIssue.field || firstIssue.fieldLabel);
                        
                        // Strategy 3: Try to find field by section + partial label match
                        if (firstIssue.section) {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Trying section-based search for:', firstIssue.section);
                          const section = formData.formSections.find(s => 
                            s.formSection === firstIssue.section || 
                            s.formSection?.toLowerCase() === firstIssue.section?.toLowerCase()
                          );
                          if (section) {
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Found section, searching fields...');
                            // Try to find field by matching label substring
                            const fieldLabelLower = (firstIssue.field || '').toLowerCase();
                            for (const field of section.fields || []) {
                              if (field.label && field.label.toLowerCase().includes(fieldLabelLower.substring(0, 30))) {
                                DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Found matching field by label substring:', field.id);
                                scrollToField(field.id);
                                setValidationModalOpen(false);
                                return;
                              }
                            }
                          }
                        }
                        
                        // Strategy 4: Case-insensitive search on all fields
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Trying case-insensitive search...');
                        const allFields = document.querySelectorAll('[data-field-id]');
                        DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Total fields with data-field-id:', allFields.length);
                        const foundField = Array.from(allFields).find(field => {
                          const fieldId = field.getAttribute('data-field-id') || '';
                          return fieldId.toLowerCase() === firstIssue.field.toLowerCase() || 
                                 fieldId.toLowerCase().includes(firstIssue.field.toLowerCase());
                        });
                        if (foundField) {
                          DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] ✅ Found field via case-insensitive search, scrolling...');
                          foundField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          const input = foundField.querySelector('input, textarea, select');
                          if (input) {
                            setTimeout(() => input.focus(), 500);
                          }
                          setValidationModalOpen(false);
                          return;
                        }
                        
                        // Strategy 5: Last resort - try to navigate to the section
                        if (firstIssue.section) {
                          const sectionIndex = formData.formSections.findIndex(s => 
                            s.formSection === firstIssue.section || 
                            s.formSection?.toLowerCase() === firstIssue.section?.toLowerCase()
                          );
                          if (sectionIndex >= 0) {
                            DEBUG_LOGS&&console.log('[GO TO FIRST ISSUE] Navigating to section index:', sectionIndex);
                            setCurrentIndex(sectionIndex);
                            setValidationModalOpen(false);
                            setTimeout(() => {
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }, 100);
                            return;
                          }
                        }
                        
                        console.error('[GO TO FIRST ISSUE] ❌ Could not find field after all strategies:', firstIssue.field);
                        console.error('[GO TO FIRST ISSUE] Available sections:', formData.formSections.map(s => s.formSection));
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
            className="completion-modal bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-slideIn ring-1 ring-black/5"
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

            {/* Content - #7 different for client (intake only) vs solicitor (full flow) */}
            <div className="completion-modal-body p-6 overflow-y-auto flex-1 bg-gray-50/50">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens next?</h3>
                  {!solicitorMode && submittedMatterId ? (
                    <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <p className="text-sm font-medium text-emerald-900">Matter submitted successfully.</p>
                      <p className="text-sm text-emerald-800 mt-1">Your questionnaire is now stored for solicitor review under secure reference <strong>{referenceNumber}</strong>.</p>
                    </div>
                  ) : null}
                {solicitorMode ? (
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-indigo-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">1</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Download Execution PDF (for file)</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Full execution copy with witnesses for your records.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-blue-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">2</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Download Client copy (intake-only)</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Intake-only PDF for sending to client before appointment.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-purple-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">3</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Review with client</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Client reviews before appointment. Client signs in person with witnesses.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-amber-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-amber-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">4</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">File and store</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Keep signed Will on file and inform Executors.</p>
                    </div>
                  </div>
                </div>
                ) : (
                <div className="space-y-3 text-gray-700">
                  <p className="font-medium text-amber-900 mb-3">Questionnaire complete — this is intake only. Legal signing happens in person later.</p>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-indigo-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">1</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Solicitor review</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Your completed questionnaire will be reviewed by our team.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-blue-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">2</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Identity verification</p>
                      <p className="text-sm text-gray-600 leading-relaxed">Upload Photo ID and proofs of address if you haven&apos;t already.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-purple-100">
                    <div className="flex-shrink-0 w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow">3</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 mb-1">Sign in person</p>
                      <p className="text-sm text-gray-600 leading-relaxed">An appointment will be scheduled. Sign your Will in person with witnesses present.</p>
                    </div>
                  </div>
                </div>
                )}
              </div>

              <div className="completion-modal-info bg-blue-50/80 border border-blue-200 p-4 rounded-xl">
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

            {/* Footer - Client mode: no downloads. Solicitor mode: Execution + Client copy */}
            <div className="completion-modal-footer px-6 py-5 bg-white border-t border-gray-200 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
              <button
                onClick={() => setSubmitted(false)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors order-2 sm:order-1"
              >
                Close
              </button>
              {solicitorMode && (
              <div className="flex flex-wrap gap-2 order-1 sm:order-2">
                <button
                  onClick={() => { setSubmitted(false); handleDownloadPDF(false); }}
                  disabled={isGeneratingPDF}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl shadow-lg shadow-indigo-500/25 font-semibold"
                >
                  <Download size={20} />
                  Execution PDF (for file)
                </button>
                <button
                  onClick={() => { setSubmitted(false); handleDownloadPDF(true); }}
                  disabled={isGeneratingPDF}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow font-semibold border border-amber-500"
                >
                  <Download size={18} />
                  Download Client copy (Intake-only – not a final Will)
                </button>
              </div>
              )}
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
