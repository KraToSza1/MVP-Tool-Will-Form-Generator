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
import { useNavigate } from 'react-router-dom';
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';
import Sidebar from './Sidebar.jsx';
import FieldRenderer from './FieldRenderer.jsx';
import { Download, FileText, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Save, Sparkles, RotateCcw, X, ArrowRight, Info, ArrowUp, Zap, AlertTriangle } from 'lucide-react';
import { filterAutofillPayloadToFormSchema, generateDummyFormData } from '../utils/autoFillForm.js';
import { validatePropertyTrustSchedules, validateBPRTrustSchedules } from '../utils/validationRegistry.js';
import { buildClauses } from '../utils/buildClauses.js';
import { isPersonalChattelsGuidedComplete, getPersonalChattelsGuidedValidationIssues } from './PersonalChattelsGuided.jsx';
import {
  isDeliberateExclusionsGuidedComplete,
  getDeliberateExclusionsGuidedValidationIssues,
} from './DeliberateExclusionsGuided.jsx';
import {
  isOtherProvisionsGuidedComplete,
  getOtherProvisionsGuidedValidationIssues,
} from './OtherProvisionsGuided.jsx';
import {
  isAdministrativeProvisionsGuidedComplete,
  getAdministrativeProvisionsGuidedValidationIssues,
} from './AdministrativeProvisionsGuided.jsx';
import {
  isEstateResidueGuidedComplete,
  getEstateResidueGuidedValidationIssues,
} from '../utils/estateResidueGuidedShared.js';
import { isBusinessInterestsGuidedComplete } from '../lib/businessInterestsGuidedComplete.js';
import { isPropertyTrustGuidedComplete, getPropertyTrustGuidedValidationIssues } from '../lib/propertyTrustGuidedComplete.js';
import { toast } from 'sonner';
import {
  isSolicitorMode,
  CLIENT_AUTOFILL_STRIP_FIELD_IDS,
  SOLICITOR_ONLY_FIELD_IDS,
  TESTAMENTARY_CAPACITY_SECTION_TITLE,
  getAristoneEstateRecommendationState,
  getEstateRecommendationLogSummary,
} from '../constants/clientMode.js';
import IdentityVerification from './IdentityVerification.jsx';
import FormPeopleSummaryPanel from './FormPeopleSummaryPanel.jsx';
import BookAppointmentModal from './BookAppointmentModal.jsx';
import ClientSubmitReviewModal from './ClientSubmitReviewModal.jsx';
import LpaOpportunityClient from './LpaOpportunityClient.jsx';
import { getSessionAppointmentContext, formatSlotLabel } from '../lib/appointments.js';
import { createSession, loadSession, saveSession, isSupabaseConfigured } from '../lib/willSessions.js';
import { buildCloudPayload, buildLocalDraftPayload } from '../lib/formPayload.js';
import { submitMatterFromDraft } from '../lib/matters.js';
import {
  ID_VERIFICATION_DOC_KEYS,
  ID_VERIFICATION_DOC_LABELS,
  getMissingIdVerificationDocs,
  hasMeaningfulAnswer,
} from '../lib/matterOutstanding.js';
import { formatExcludedPersonForClause } from '../utils/excludedPersonFormat.js';
import {
  formatAppointmentPersonListForClause,
  formatProfessionalOtherDetailsForClause,
} from '../utils/appointmentPersonFormat.js';
import { resolveGuardianshipDetailsDataForClause } from '../utils/guardianFlowSync.js';
import { toProperNameCase, toProperAddressCase, normalizePostcode } from '../utils/nameCase.js';
import { importPdfGeneratorModule, isStaleChunkLoadError } from '../utils/loadPdfGeneratorModule.js';
import { debugLog, isWillToolDebugEnabled } from '../lib/willToolDebug.js';
import { pruneStaleBranchValues } from '../utils/pruneStaleBranchValues.js';

const DEBUG_LOGS = isWillToolDebugEnabled() || import.meta.env.VITE_DEBUG_FIELD_RENDERER === 'true';
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

/** Strip draft Will clause text from field definitions for questionnaire UI only (PDF uses raw form definition). */
function stripWillClauseTextForUi(field) {
  if (!field || typeof field !== 'object') return field;
  const next = { ...field, willClauseText: undefined };
  if (Array.isArray(next.options)) {
    next.options = next.options.map((o) =>
      o && typeof o === 'object' ? { ...o, willClauseText: undefined } : o
    );
  }
  if (Array.isArray(next.subFields)) {
    next.subFields = next.subFields.map(stripWillClauseTextForUi);
  }
  return next;
}

/**
 * Other / Administrative: render and validate only the guided shell field so legacy duplicate
 * rows (pets, RSPCA, debts, etc.) never mount when the section JSON still lists them.
 */
function getSectionRenderFields(section) {
  if (!section?.fields?.length) return section?.fields || [];
  if (section.formSection === 'Other Provisions') {
    const g = section.fields.find(
      (f) => f.id === 'otherProvisionsGuided' || f.type === 'otherProvisionsGuided'
    );
    if (g) return [g];
  }
  if (section.formSection === 'Administrative Provisions') {
    const g = section.fields.find(
      (f) => f.id === 'administrativeProvisionsGuided' || f.type === 'administrativeProvisionsGuided'
    );
    if (g) return [g];
  }
  if (section.formSection === 'Estate Administration/Residue') {
    const g = section.fields.find((f) => f.id === 'estateResidueGuided' || f.type === 'estateResidueGuided');
    if (g) return [g];
  }
  return section.fields;
}

/** Client flow only: final step in the stepper — upload ID after all questionnaire fields (not in the JSON). */
const IDENTITY_VERIFICATION_ONLY_SECTION = {
  formSection: 'Identity verification',
  fields: [],
  _identityVerificationStep: true,
};

const CLIENT_SIGNATURE_SECTION_TITLE = 'Client signature';

export default function FormRenderer({ initialFormState = null, externalPersistence = null }) {
  const navigate = useNavigate();
  const { formData } = useFormDefinition();
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const refFromUrl = urlParams?.get('ref') ?? '';
  const secretFromUrl = urlParams?.get('s') ?? '';
  const hasCloudRefAndSecret = REF_REGEX.test(refFromUrl) && secretFromUrl.length >= 8;
  const useExternalPersistence = !!externalPersistence;
  const solicitorMode = isSolicitorMode();
  /** Demo auto-fill fills fictional emails (e.g. marcus.ellwood.demo@example.com). Hide from real clients on hosted prod unless opted-in. */
  const showAutoFillControls =
    solicitorMode || import.meta.env.DEV || import.meta.env.VITE_SHOW_CLIENT_AUTOFILL === 'true';
  const allowClientSignatureRequest =
    !solicitorMode
    && (
      urlParams?.get('client_sign') === '1'
      || urlParams?.get('clientSign') === '1'
      || urlParams?.get('client_sign') === 'true'
      || urlParams?.get('clientSign') === 'true'
    );
  const useCloud = !useExternalPersistence && typeof window !== 'undefined' && isSupabaseConfigured();
  const inIframe = useMemo(
    () => typeof window !== 'undefined' && window.self !== window.top,
    [],
  );
  const matterIdFromPath = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const match = window.location.pathname.match(/\/solicitor\/matters\/([^/]+)/i);
    return match?.[1] || '';
  }, []);

  const clientSignatureFieldDefinition = useMemo(() => {
    const sections = Array.isArray(formData?.formSections) ? formData.formSections : [];
    for (const section of sections) {
      const fields = Array.isArray(section?.fields) ? section.fields : [];
      const direct = fields.find((f) => f?.id === 'testatorSignature');
      if (direct) return direct;
    }
    return null;
  }, [formData?.formSections]);

  const clientSignatureOnlySection = useMemo(() => {
    if (!clientSignatureFieldDefinition) return null;
    return {
      formSection: CLIENT_SIGNATURE_SECTION_TITLE,
      fields: [{ ...clientSignatureFieldDefinition }],
      _clientSignatureStep: true,
    };
  }, [clientSignatureFieldDefinition]);

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
      debugLog('[WillTool Flow] Client resuming: loading session from URL', { ref: refFromUrl, phase: 'client_load_start' });
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
        debugLog('[WillTool Flow] Client session loaded; form ready', { ref: refFromUrl, step, fieldCount: Object.keys(rest).length });
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
    debugLog('[WillTool Flow] Client starting: creating new session', { step, fromStorage: Object.keys(initialFromStorage).length, phase: 'client_create_start' });

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
      debugLog('[WillTool Flow] Client session created; URL updated', { ref });
    });
  }, [useCloud, hasCloudRefAndSecret, refFromUrl, secretFromUrl, useExternalPersistence]);

  const [formValues, setFormValuesState] = useState(() => {
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

  const setFormValues = useCallback((updater) => {
    setFormValuesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      return pruneStaleBranchValues(prev, next);
    });
  }, []);

  const [submitted, setSubmitted] = useState(false);
  const [expandedFields, setExpandedFields] = useState({});
  const [banner, setBanner] = useState(null); // { type: 'error'|'info', message: string }
  const [validationModalOpen, setValidationModalOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState([]);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [formCompletionPercent, setFormCompletionPercent] = useState(0);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSubmittingMatter, setIsSubmittingMatter] = useState(false);
  const [submittedMatterId, setSubmittedMatterId] = useState(null);
  const [idVerificationIncompleteModalOpen, setIdVerificationIncompleteModalOpen] = useState(false);
  const [submitReviewModalOpen, setSubmitReviewModalOpen] = useState(false);
  const [submittedWithIncompleteId, setSubmittedWithIncompleteId] = useState(false);
  const [showBookAppointment, setShowBookAppointment] = useState(false);
  const [signatureRequestModalOpen, setSignatureRequestModalOpen] = useState(false);
  const [signatureRequestEmail, setSignatureRequestEmail] = useState('');
  // Mirrors the active appointment so the post-submit button reflects the
  // booking state ("Book appointment" vs "Manage appointment · 14:30 Tue 4 May").
  // Only loaded once we know the session ref + secret are valid.
  const [activeAppointment, setActiveAppointment] = useState(null);
  const [appointmentLoading, setAppointmentLoading] = useState(false);
  const autosaveTimerRef = useRef(null);
  const clauseUpdateTimerRef = useRef(null);
  const latestPersistRef = useRef({ formValues: {}, currentIndex: 0 });
  latestPersistRef.current = { formValues, currentIndex };

  // Testamentary Capacity: whole section is solicitors-only. Field-level _hiddenFromClient: strip everywhere
  // (guided shells replace legacy questions; values still live in formValues + buildClauses / PDF).
  const visibleSections = useMemo(() => {
    if (!formData?.formSections) return [];
    const mapped = formData.formSections
      .filter((s) => {
        if (s.formSection === TESTAMENTARY_CAPACITY_SECTION_TITLE && !solicitorMode) return false;
        if (s._hiddenFromClient && !solicitorMode) return false;
        return true;
      })
      .map((s) => {
        if (!Array.isArray(s.fields)) return s;
        let changed = false;
        const visibleFields = s.fields
          .filter((f) => { if (f._hiddenFromClient) { changed = true; return false; } return true; })
          .map((f) => {
            if (f.type === 'section' && Array.isArray(f.subFields)) {
              const visibleSub = f.subFields.filter((sf) => !sf._hiddenFromClient);
              if (visibleSub.length !== f.subFields.length) { changed = true; return { ...f, subFields: visibleSub }; }
            }
            return f;
          });
        return changed ? { ...s, fields: visibleFields } : s;
      });
    if (!solicitorMode) {
      const clientSteps = [...mapped, IDENTITY_VERIFICATION_ONLY_SECTION];
      if (allowClientSignatureRequest && clientSignatureOnlySection) {
        clientSteps.push(clientSignatureOnlySection);
      }
      return clientSteps;
    }
    return mapped;
  }, [allowClientSignatureRequest, clientSignatureOnlySection, solicitorMode, formData?.formSections]);

  // Aristone as executor (quick pick or professional Aristone): trustees must match executors — hide "different trustees?" and force No.
  useEffect(() => {
    const aristoneAsExecutor =
      formValues?.chooseAristoneExecutor === 'Aristone' ||
      (formValues?.appointProfessionalExecutor === 'Yes' && formValues?.professionalExecutorSelection === 'Aristone');
    if (!aristoneAsExecutor) return;
    setFormValues((prev) => {
      if (prev.appointDifferentTrustees === 'No') return prev;
      return { ...prev, appointDifferentTrustees: 'No' };
    });
  }, [
    formValues?.chooseAristoneExecutor,
    formValues?.appointProfessionalExecutor,
    formValues?.professionalExecutorSelection,
  ]);

  // Dev: re-evaluate and log qualification whenever Estate Overview values change.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    getAristoneEstateRecommendationState(formValues);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- estate fields only; full formValues would log on every keystroke
  }, [
    formValues?.estateApproxValue,
    formValues?.estateApproxLiabilities,
  ]);

  // Aristone not executor: cannot remain selected as professional trustee.
  useEffect(() => {
    const aristoneAsExecutor =
      formValues?.chooseAristoneExecutor === 'Aristone' ||
      (formValues?.appointProfessionalExecutor === 'Yes' && formValues?.professionalExecutorSelection === 'Aristone');
    if (aristoneAsExecutor) return;
    setFormValues((prev) => {
      let changed = false;
      const next = { ...prev };
      if (prev.professionalTrusteeSelection === 'Aristone') {
        next.professionalTrusteeSelection = null;
        changed = true;
      }
      if (prev.substituteProfessionalTrusteeSelection === 'Aristone') {
        next.substituteProfessionalTrusteeSelection = null;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [
    formValues?.chooseAristoneExecutor,
    formValues?.appointProfessionalExecutor,
    formValues?.professionalExecutorSelection,
  ]);

  /** Index in full formData.formSections for the visible step (stable when TC is filtered by title). */
  const actualSectionIndex = useMemo(() => {
    if (solicitorMode) {
      return currentIndex;
    }
    const section = visibleSections[currentIndex];
    if (!section || !formData?.formSections) return currentIndex;
    const i = formData.formSections.indexOf(section);
    if (i >= 0) return i;
    if (section?._identityVerificationStep) {
      return Math.max(0, formData.formSections.length - 1);
    }
    return currentIndex;
  }, [currentIndex, solicitorMode, visibleSections, formData?.formSections]);

  useEffect(() => {
    if (!visibleSections.length) return;
    if (currentIndex >= visibleSections.length) {
      setCurrentIndex(visibleSections.length - 1);
    }
  }, [visibleSections, currentIndex]);

  const currentSection = visibleSections[currentIndex] || formData.formSections[actualSectionIndex];
  /** Guided Other Provisions: first real heading is inside OtherProvisionsGuided — hide duplicate page chrome for this step. */
  const hideOtherProvisionsTopChrome = currentSection?.formSection === 'Other Provisions';
  const isClientIdentityOnlyStep = !solicitorMode && !!currentSection?._identityVerificationStep;
  const currentSectionRenderFields = useMemo(
    () => getSectionRenderFields(currentSection),
    [currentSection]
  );
  const shouldHideSolicitorOnlyFieldForClient = useCallback((fieldId) => {
    if (solicitorMode) return false;
    if (!SOLICITOR_ONLY_FIELD_IDS.has(fieldId)) return false;
    return !(allowClientSignatureRequest && fieldId === 'testatorSignature');
  }, [allowClientSignatureRequest, solicitorMode]);
  const uploadedIdDocumentCount = useMemo(() => {
    const identityVerification = formValues?.identityVerification;
    if (!identityVerification || typeof identityVerification !== 'object') return 0;
    return ID_VERIFICATION_DOC_KEYS.filter((key) => hasMeaningfulAnswer(identityVerification[key])).length;
  }, [formValues]);
  const hasUploadedIdDocuments = uploadedIdDocumentCount > 0;
  const solicitorMissingIdDocs = useMemo(
    () => getMissingIdVerificationDocs({ identityVerification: formValues?.identityVerification }),
    [formValues?.identityVerification],
  );
  const solicitorIdVerificationPending = solicitorMode && solicitorMissingIdDocs.length > 0;
  
  const isDev = import.meta.env.DEV;
  const isFinalStep = currentIndex === visibleSections.length - 1;
  const lpaPreSubmitStepIndex = useMemo(
    () => visibleSections.findIndex((s) => s._identityVerificationStep || s._clientSignatureStep),
    [visibleSections],
  );
  const showLpaPreSubmitBanner =
    !solicitorMode
    && visibleSections.length > 0
    && (lpaPreSubmitStepIndex >= 0
      ? currentIndex === lpaPreSubmitStepIndex
      : currentIndex === visibleSections.length - 1);
  const primaryActionLabel = isFinalStep
    ? isSubmittingMatter
      ? (submittedMatterId ? 'Updating submission...' : 'Submitting...')
      : (submittedMatterId ? 'Update submission' : 'Submit')
    : 'Next';

  const submitCurrentMatter = useCallback(async () => {
    if (externalPersistence?.submit) {
      debugLog('[WillTool Flow] client_submit_using_external_persistence', { phase: 'client_submit_external' });
      return externalPersistence.submit({ formValues, currentIndex, referenceNumber, sessionSecret });
    }

    if (!referenceNumber || !sessionSecret) {
      console.warn('[WillTool Flow] client_submit_skipped_no_session', {
        hasRef: !!referenceNumber,
        hasSecret: !!sessionSecret,
        phase: 'client_submit_skipped',
      });
      return { ok: true };
    }

    return submitMatterFromDraft({
      ref: referenceNumber,
      secret: sessionSecret,
      formValues,
      currentIndex,
    });
  }, [currentIndex, externalPersistence, formValues, referenceNumber, sessionSecret]);

  const finishSubmission = useCallback(async () => {
    debugLog('[WillTool Flow] client_submit_ui_start', {
      ref: referenceNumber,
      currentIndex,
      formKeys: Object.keys(formValues || {}).length,
      phase: 'client_submit_ui_start',
    });
    if (isDev) DEBUG_LOGS && debugLog('[GO NEXT] Last step reached - submitting matter or completing external persistence');
    setIsSubmittingMatter(true);
    try {
      const result = await submitCurrentMatter();
      debugLog('[WillTool Flow] client_submit_ui_result', {
        ref: referenceNumber,
        hasError: !!result?.error,
        hasMatterId: !!result?.matterId,
        ok: result?.ok,
        phase: 'client_submit_ui_result',
      });
      if (result?.error) {
        console.error('[WillTool Flow] Client submit failed', { ref: referenceNumber, error: result.error });
        toast.error('Could not complete submission', { description: result.error });
        return;
      }
      if (result?.matterId) {
        setSubmittedMatterId(result.matterId);
      }
      setSubmitted(true);
      debugLog('[WillTool Flow] client_submit_ui_success', {
        ref: referenceNumber,
        matterId: result?.matterId ?? null,
        phase: 'client_submit_ui_success',
      });
    } catch (err) {
      console.error('[WillTool Flow] Client submit threw', { ref: referenceNumber, err });
      toast.error('Submission failed', { description: err?.message || 'Network or server error. Check your connection and try again.' });
    } finally {
      setIsSubmittingMatter(false);
      debugLog('[WillTool Flow] client_submit_ui_finally', { ref: referenceNumber, phase: 'client_submit_ui_finally' });
    }
  }, [referenceNumber, submitCurrentMatter, formValues, currentIndex, isDev]);

  useEffect(() => {
    if (!useExternalPersistence) {
      localStorage.setItem('willFormStep', String(currentIndex));
    }
  }, [currentIndex, useExternalPersistence]);

  /** After client submission: clear form and session so they can start a new questionnaire. */
  const startOverAfterSubmit = useCallback(() => {
    setSubmitted(false);
    setSubmittedMatterId(null);
    setSubmittedWithIncompleteId(false);
    setFormValues({});
    setCurrentIndex(0);
    setBanner(null);
    if (!useExternalPersistence) {
      localStorage.removeItem('willForm');
      localStorage.removeItem('willFormStep');
      localStorage.removeItem('willFormRef');
    }
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('ref');
    newUrl.searchParams.delete('s');
    window.history.replaceState({}, '', newUrl);
    if (useCloud) {
      setSessionInitialized(false);
      createSession(buildCloudPayload({}, 0)).then((result) => {
        if (result.error) {
          toast.error('Could not start new session', { description: result.error });
          setReferenceNumber(getOrCreateReferenceNumberLocal());
          setSessionInitialized(true);
          return;
        }
        const { ref, secret } = result;
        setReferenceNumber(ref);
        setSessionSecret(secret);
        const u = new URL(window.location.href);
        u.searchParams.set('ref', ref);
        u.searchParams.set('s', secret);
        window.history.replaceState({}, '', u);
        setSessionInitialized(true);
        toast.success('Form cleared', { description: 'You can start a new questionnaire.' });
      });
    } else {
      setReferenceNumber(getOrCreateReferenceNumberLocal());
      setSessionInitialized(true);
      toast.success('Form cleared', { description: 'You can start a new questionnaire.' });
    }
  }, [useCloud, useExternalPersistence]);

  const closeCompletionModal = useCallback(({ scrollToIdentity = false } = {}) => {
    setSubmitted(false);
    if (!scrollToIdentity) return;

    window.setTimeout(() => {
      const identitySection = document.getElementById('identity-verification-section');
      if (!identitySection) return;
      identitySection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const firstAction = identitySection.querySelector('button');
      if (firstAction && typeof firstAction.focus === 'function') {
        firstAction.focus();
      }
    }, 120);
  }, []);
  /** After submit, client is already on the identity step; only scroll if ID was incomplete (reminder to add docs). */
  const closeCompletionModalAsClient = useCallback(() => {
    closeCompletionModal({ scrollToIdentity: submittedWithIncompleteId });
  }, [closeCompletionModal, submittedWithIncompleteId]);

  /** Completion modal shortcut: close and return user to Identity upload area. */
  const returnToIdentityUploads = useCallback(() => {
    closeCompletionModal({ scrollToIdentity: true });
  }, [closeCompletionModal]);

  /** Solicitor mode: jump straight to matter detail ID review panel. */
  const goToSolicitorIdReview = useCallback(() => {
    if (!matterIdFromPath) return;
    navigate(`/solicitor/matters/${matterIdFromPath}`, { state: { scrollToIdDocs: true } });
  }, [matterIdFromPath, navigate]);

  const clientSignatureRequestUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const u = new URL(window.location.origin + '/');
    if (referenceNumber) u.searchParams.set('ref', referenceNumber);
    if (sessionSecret) u.searchParams.set('s', sessionSecret);
    u.searchParams.set('client_sign', '1');
    return u.toString();
  }, [referenceNumber, sessionSecret]);

  const signatureRequestRecipient = useMemo(() => {
    const candidates = [
      formValues?.client_email,
      formValues?.email,
      formValues?.emailAddress,
      formValues?.clientEmail,
    ];
    const first = candidates.find((v) => typeof v === 'string' && v.includes('@'));
    return first ? String(first).trim() : '';
  }, [formValues]);

  useEffect(() => {
    if (!signatureRequestModalOpen) return;
    setSignatureRequestEmail(signatureRequestRecipient || '');
  }, [signatureRequestModalOpen, signatureRequestRecipient]);

  const signatureRequestDraft = useMemo(() => {
    const to = String(signatureRequestEmail || signatureRequestRecipient || '').trim();
    const clientFullName = String(
      formValues?.clientName
      || formValues?.fullName
      || `${formValues?.firstName || ''} ${formValues?.lastName || ''}`.trim()
      || 'Client'
    ).trim();
    const subjectText = `Action required: Signature request (${referenceNumber || 'Will matter'})`;
    const bodyText =
      `Dear ${clientFullName},\n\n` +
      `Reference number: ${referenceNumber || 'Not provided'}\n\n` +
      `Your solicitor has requested your signature for your Will instructions.\n\n` +
      `Please complete the following steps:\n` +
      `1) Open your secure signing link:\n${clientSignatureRequestUrl}\n` +
      `2) Review your details\n` +
      `3) Add your signature and submit\n\n` +
      `If the link does not open, copy and paste it into your browser.\n\n` +
      `If you need help, please reply to this email quoting your reference number.\n\n` +
      `Kind regards,\n` +
      `Aristone Solicitors`;
    const subject = encodeURIComponent(subjectText);
    const body = encodeURIComponent(bodyText);
    return {
      to,
      subjectText,
      bodyText,
      mailtoHref: `mailto:${to}?subject=${subject}&body=${body}`,
      outlookWebHref: `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${subject}&body=${body}`,
    };
  }, [clientSignatureRequestUrl, formValues?.clientName, formValues?.firstName, formValues?.fullName, formValues?.lastName, referenceNumber, signatureRequestEmail, signatureRequestRecipient]);

  const copyClientSignatureLink = useCallback(async () => {
    if (!clientSignatureRequestUrl) return;
    try {
      await navigator.clipboard.writeText(clientSignatureRequestUrl);
      toast.success('Signature link copied', {
        description: 'Send this secure link to the client so they can sign remotely.',
      });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy signature link.' });
    }
  }, [clientSignatureRequestUrl]);

  const openSignatureRequestModal = useCallback(() => {
    if (!clientSignatureRequestUrl) {
      toast.error('Could not build signature link', { description: 'Missing session details for this matter.' });
      return;
    }
    setSignatureRequestModalOpen(true);
  }, [clientSignatureRequestUrl]);

  const closeSignatureRequestModal = useCallback(() => {
    setSignatureRequestModalOpen(false);
  }, []);

  const openOutlookSignatureDraft = useCallback(() => {
    const to = String(signatureRequestDraft.to || '').trim();
    if (!to || !to.includes('@')) {
      toast.error('Client email required', { description: 'Enter a valid client email before opening Outlook draft.' });
      return;
    }
    window.open(signatureRequestDraft.outlookWebHref, '_blank', 'noopener,noreferrer');
    toast.success('Outlook draft opened', {
      description: 'Please send from your Microsoft 365 account.',
    });
  }, [signatureRequestDraft]);

  const copySignatureEmailDraft = useCallback(async () => {
    const to = String(signatureRequestDraft.to || '').trim();
    if (!to || !to.includes('@')) {
      toast.error('Client email required', { description: 'Enter a valid client email before copying draft.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(
        `To: ${to}\nSubject: ${signatureRequestDraft.subjectText}\n\n${signatureRequestDraft.bodyText}`
      );
      toast.success('Email draft copied', { description: 'Paste into Outlook if needed.' });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy email draft.' });
    }
  }, [signatureRequestDraft]);

  /**
   * Open the in-app booking modal so the client can pick an appointment slot
   * directly. The modal hides already-booked slots (DB has a unique index on
   * active slots so two clients can never grab the same time). When the cloud
   * tables are not yet available, the modal exposes a mailto: fallback.
   */
  const handleBookAppointment = useCallback(() => {
    setShowBookAppointment(true);
  }, []);

  const closeBookAppointmentModal = useCallback(() => {
    setShowBookAppointment(false);
  }, []);

  /**
   * Pulls the latest active (future, non-cancelled) appointment for this
   * session so the post-submit screen can show "Manage appointment · time"
   * instead of always saying "Book appointment". Safe to call multiple times.
   */
  const refreshActiveAppointment = useCallback(async () => {
    if (!referenceNumber || !sessionSecret) return;
    setAppointmentLoading(true);
    try {
      const ctx = await getSessionAppointmentContext({
        ref: referenceNumber,
        secret: sessionSecret,
      });
      setActiveAppointment(ctx?.appointment || null);
    } catch {
      // Non-fatal: button just falls back to "Book appointment".
    } finally {
      setAppointmentLoading(false);
    }
  }, [referenceNumber, sessionSecret]);

  // Whenever the user sees the "completed submission" screen, sync the active
  // appointment so the button label is correct from the first paint.
  useEffect(() => {
    if (submitted && referenceNumber && sessionSecret) {
      void refreshActiveAppointment();
    }
  }, [submitted, referenceNumber, sessionSecret, refreshActiveAppointment]);

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
        DEBUG_LOGS&&debugLog('[KEYBOARD] Escape key pressed');
        if (signatureRequestModalOpen) {
          setSignatureRequestModalOpen(false);
        }
        if (validationModalOpen) {
          DEBUG_LOGS&&debugLog('[KEYBOARD] Closing validation modal with Escape key');
          setValidationModalOpen(false);
        }
        if (submitted) {
          DEBUG_LOGS&&debugLog('[KEYBOARD] Closing completion modal with Escape key');
          if (!solicitorMode) closeCompletionModalAsClient();
          else setSubmitted(false);
        }
      }
      
      // Ctrl/Cmd + S to save draft (prevent default browser save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        DEBUG_LOGS&&debugLog('[KEYBOARD] Ctrl/Cmd + S pressed - triggering manual save');
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
            DEBUG_LOGS&&debugLog(`[KEYBOARD] Manual save completed - saved ${savedCount} fields`);
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
  }, [signatureRequestModalOpen, validationModalOpen, submitted, formValues, solicitorMode, closeCompletionModalAsClient]);

  const scrollToTop = () => {
    DEBUG_LOGS&&debugLog('[SCROLL TO TOP] Back to top button clicked');
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
      importPdfGeneratorModule().catch(() => {});
    }
  }, [currentIndex, visibleSections.length]);

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

    /**
     * Decide whether a placeholder value should be re-cased before insertion
     * into clause text. We only auto-correct names/addresses (the fields the
     * client most often types in ALL CAPS); everything else is returned as-is.
     */
    const NAME_FIELD_IDS = new Set([
      'fullName', 'firstName', 'middleName', 'middleNames', 'lastName', 'name',
      'displayName', 'partnerFullName', 'partnerFirstName', 'partnerLastName',
      'childFirstName', 'childLastName', 'title',
    ]);
    const ADDRESS_FIELD_IDS = new Set([
      'address', 'address1', 'address2', 'address3',
      'addressLine1', 'addressLine2', 'town', 'city', 'county',
    ]);
    const normalizeFieldCase = (sectionId, subField, raw) => {
      if (raw == null) return '';
      const str = String(raw);
      if (!str) return str;
      const key = subField || sectionId || '';
      if (key === 'postcode') return normalizePostcode(str);
      if (NAME_FIELD_IDS.has(key)) return toProperNameCase(str);
      if (ADDRESS_FIELD_IDS.has(key)) return toProperAddressCase(str);
      return str;
    };

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
      digitalExecutorIfNoSection: 'digitalExecutorIfNoData',
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
        if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] 🔄 Replacing bracket placeholder "${placeholder}" with "${fieldRef}"`);
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
            if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] Alias mapping: ${fullKey.split(':')[0]} -> ${sectionId} (raw value was: ${raw})`);
          } else {
            if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] Using section ID: ${sectionId} (raw value was: ${raw})`);
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

        if (
          ['professionalExecutorSelection', 'substituteProfessionalExecutorSelection',
            'professionalTrusteeSelection', 'substituteProfessionalTrusteeSelection'].includes(sectionId) &&
          (subField === 'fullDetails' || subField === 'fullList')
        ) {
          const selectionValue = values[sectionId];
          if (selectionValue === 'Aristone') {
            return 'Aristone Solicitors, SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG';
          }
          if (selectionValue === 'Other') {
            const otherDetailsField = sectionId.replace('Selection', 'OtherDetails');
            const otherDetails = values[otherDetailsField];
            if (otherDetails && String(otherDetails).trim()) {
              return formatProfessionalOtherDetailsForClause(String(otherDetails));
            }
          }
          return '';
        }

        const personSectionFullDetailsIds = [
          'executorsSection',
          'substituteExecutorsSection',
          'guardiansSection',
          'substituteGuardiansSection',
          'digitalExecutorsSection',
          'digitalExecutorIfNoSection',
          'trusteesSection',
          'substituteTrusteesSection',
          'signingOnBehalfSection',
          'interpreterSection',
          'chattelRecipientsSection',
          'debtorsSection',
          'debtsReleasedSection',
          'professionalTrusteesSection',
          'substituteProfessionalTrusteesSection',
        ];
        if (personSectionFullDetailsIds.includes(sectionId) && (subField === 'fullDetails' || subField === 'fullList')) {
          const dataKey = fallbackMap[sectionId];
          const arr = dataKey ? values[dataKey] : null;
          if (Array.isArray(arr) && arr.length > 0) {
            const resolved = formatAppointmentPersonListForClause(arr);
            if (resolved) return resolved;
          }
          return '';
        }

        if (sectionId === 'guardianshipDetailsSection' && (subField === 'fullDetails' || subField === 'fullList')) {
          const resolved = resolveGuardianshipDetailsDataForClause(values);
          return resolved || '';
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
            if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] separateTrusteesSection:fullDetails - sectionData:`, {
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
                  if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] separateTrusteesSection:fullDetails - ❌ No valid array data found, returning unresolved marker`);
                }
                return `{{field:${sectionId}:${subField}}}`;
              }
              
              if (sectionData.length > 0) {
                // CRITICAL FIX: Get testator name for validation BEFORE processing items.
                // Title-case the parts so the comparison still matches when items are
                // also title-cased on output (avoids "MARCUS ELLWOOD" !== "Marcus Ellwood").
                const testatorFirstName = toProperNameCase(values.firstName || '');
                const testatorLastName = toProperNameCase(values.lastName || '');
                const testatorMiddleName = toProperNameCase(values.middleName || '');
                const testatorTitle = toProperNameCase(values.title || '');
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
                        if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] ${sectionId}:fullDetails - Detected exact placeholder string: "${item}"`);
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
                
                // Format as: "relationship name of address" (e.g., "Friend Charlie Pet Carer of 789 Pet Street, Animal District, London, SW1A 2BB").
                // Names + address fragments are run through nameCase helpers so ALL CAPS / all-lowercase input
                // becomes "First letter capital, rest lowercase" in the rendered Will/PDF.
                const relationship = item.relationship || item.relationshipToTestator || '';
                const nameParts = [
                  toProperNameCase(item.title),
                  toProperNameCase(item.firstName),
                  toProperNameCase(item.lastName)
                ].filter(Boolean);
                const name = nameParts.join(' ');
                const nameWithoutTitle = [
                  toProperNameCase(item.firstName),
                  toProperNameCase(item.middleName),
                  toProperNameCase(item.lastName),
                ].filter(Boolean).join(' ');
                const addressParts = [
                  toProperAddressCase(item.address1),
                  toProperAddressCase(item.address2),
                  toProperAddressCase(item.address3),
                  toProperAddressCase(item.city),
                  normalizePostcode(item.postcode),
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
                    if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] separateTrusteesSection:fullDetails - Validation failed for item:`, {
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
              if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] separateTrusteesSection:fullDetails - formattedItems after filter:`, {
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
              const testatorFirstName = toProperNameCase(values.firstName || '');
              const testatorLastName = toProperNameCase(values.lastName || '');
              const testatorMiddleName = toProperNameCase(values.middleName || '');
              const testatorTitle = toProperNameCase(values.title || '');
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
                  debugLog(`[INTERPOLATE] separateTrusteesSection:fullDetails - ✅ Returning interpolated result: "${result}"`);
                  debugLog(`[INTERPOLATE] separateTrusteesSection:fullDetails - Testator name check passed (fullName: "${testatorFullName}", result: "${result}")`);
                }
              }
              
              return result;
            } else {
              // No valid formatted items after filtering - return unresolved marker
              if (sectionId === 'separateTrusteesSection') {
                if (DEBUG_INTERPOLATE) debugLog(`[INTERPOLATE] separateTrusteesSection:fullDetails - ❌ No valid formatted items after filtering, returning unresolved marker`);
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

        if (
          (sectionId === 'excludedPersonSection' || sectionId === 'excludedPersonsSection') &&
          (subField === 'fullDetails' || subField === 'fullList')
        ) {
          const array = values.excludedPersonData || [];
          if (Array.isArray(array) && array.length > 0) {
            return array.map(formatExcludedPersonForClause).filter(Boolean).join('; ');
          }
          return '';
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
              if (subField === 'relationshipList') {
                const fieldValue = item.relationship || item.relationshipToTestator || '';
                return fieldValue != null ? String(fieldValue).trim() : '';
              }
              if (subField === 'nameList') {
                const parts = [
                  item.title,
                  item.firstName,
                  item.lastName
                ].filter(Boolean);
                const fieldValue = parts.join(' ');
                if (!fieldValue || fieldValue.trim() === '') {
                  return '';
                }
                return String(fieldValue).trim();
              }
              if (subField === 'addressList') {
                const addressParts = [
                  item.address1,
                  item.address2,
                  item.address3,
                  item.city,
                  item.postcode
                ].filter(Boolean);
                const fieldValue = addressParts.join(', ');
                if (!fieldValue || fieldValue.trim() === '') {
                  return '';
                }
                return String(fieldValue).trim();
              }
              const fieldValue = item[subField] ||
                item[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                item[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
                item[subField.toLowerCase()] ||
                item[subField.toUpperCase()];
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
      if (customValue) return normalizeFieldCase(sectionId, subField, customValue);

      const value = values[fullKey] || values[sectionId] || '';
      const result = (typeof value === 'string' || typeof value === 'number') && value !== '' ? value.toString() : '';
      return normalizeFieldCase(sectionId, subField, result);
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
    processed = processed.replace(/\[as specified:\s*\[Specific Loans\/Gifts List\]\]/gi, () => {
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

  const interpolateTextRef = useRef(interpolateText);
  interpolateTextRef.current = interpolateText;
  
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
        DEBUG_LOGS&&debugLog(`[CONDITION DEBUG] Field "${field.id}" checking howResidueDistributed:`, {
          actualValue: value,
          expectedValue: clause.value,
          operator: clause.operator,
          matches: clause.operator === 'eq' ? value === clause.value : 'not eq operator'
        });
      }
      
      if (DEBUG_INTERPOLATE && (field.id === 'foreignWillNotRevoked' || clause.field === 'assetsAbroad')) {
        debugLog(`[CONDITION EVAL] 🔍 Evaluating condition for field "${field.id}":`, {
          clauseField: clause.field,
          clauseValue: clause.value,
          clauseOperator: clause.operator,
          actualFormValue: value,
          matches: clause.operator === 'eq' ? value === clause.value : 'N/A (not eq)'
        });
      }
      
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
    
    const result = Array.isArray(field.conditions) 
      ? (field.conditionLogic === 'OR' ? field.conditions.some(evalClause) : field.conditions.every(evalClause))
      : evalClause(field.conditions);
    
    if (DEBUG_INTERPOLATE && field.id === 'foreignWillNotRevoked') {
      debugLog(`[CONDITION EVAL] ✅ Final result for field "${field.id}":`, {
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
      DEBUG_LOGS&&debugLog(`[CONDITION DEBUG] Field "${field.id}" condition result:`, {
        fieldId: field.id,
        conditions: field.conditions,
        conditionLogic: field.conditionLogic,
        result: result,
        howResidueDistributed: formValues.howResidueDistributed
      });
    }

    if (field.id === 'executorIndividualAgeFlow') {
      const clauseResults = Array.isArray(field.conditions)
        ? field.conditions.map((clause) => {
            const single = evalClause(clause);
            const actual = clause.field ? formValues[clause.field] : undefined;
            return {
              field: clause.field,
              operator: clause.operator,
              expectedValue: clause.value,
              actualValue: actual,
              clausePass: single,
            };
          })
        : [];
      debugLog('[EXECUTOR_AGE_DEBUG] evaluateFieldConditions', {
        fieldId: field.id,
        conditionLogic: field.conditionLogic,
        chooseAristoneExecutor: formValues.chooseAristoneExecutor,
        executorDataArrayLength: Array.isArray(formValues.executorData) ? formValues.executorData.length : null,
        clauseResults,
        finalPassFail: result,
      });
    }

    return result;
  }, [formValues, isDev]);

  // ---------------------------
  // Validation: Required Fields
  // ---------------------------
  const allRequiredFilled = useMemo(() => {
    DEBUG_LOGS&&debugLog('[VALIDATION CHECK] ========== VALIDATING SECTION ==========');
    DEBUG_LOGS&&debugLog('[VALIDATION CHECK] Current section:', currentSection?.formSection);
    DEBUG_LOGS&&debugLog('[VALIDATION CHECK] Total fields to check:', currentSectionRenderFields?.length);

    const checkField = (field) => {
      DEBUG_LOGS&&debugLog(`[VALIDATION] Checking field "${field.id}" (${field.label})`);

      if (shouldHideSolicitorOnlyFieldForClient(field.id)) {
        return true;
      }

      if (field.conditions && !evaluateFieldConditions(field)) {
        DEBUG_LOGS&&debugLog(`[VALIDATION] Field "${field.id}" - SKIPPED (conditions not met)`);
        return true;
      }

      if (['button', 'hidden', 'display'].includes(field.type)) {
        DEBUG_LOGS&&debugLog(`[VALIDATION] Field "${field.id}" - SKIPPED (type: ${field.type})`);
        return true;
      }

      if (field.type === 'businessInterestsGuided') {
        const ok = isBusinessInterestsGuidedComplete(formValues);
        DEBUG_LOGS&&debugLog(`[VALIDATION] businessInterestsGuided valid: ${ok}`);
        return ok;
      }

      if (field.type === 'propertyGiftsGuided') {
        if (formValues.leavePropertyGifts !== 'Yes') return true;
        const list = formValues.propertyGiftsList;
        const hasGifts = Array.isArray(list) && list.length > 0;
        const lapse = formValues.failedPropertyGiftPassProportionately;
        const lapseOk = lapse === 'Yes' || lapse === 'No' || lapse === 'Unsure';
        const ok = hasGifts && lapseOk;
        DEBUG_LOGS&&debugLog(
          `[VALIDATION] propertyGiftsGuided hasGifts: ${hasGifts}, lapse: "${lapse}", valid: ${ok}`
        );
        return ok;
      }

      if (field.type === 'propertyTrustGuided') {
        const ok = isPropertyTrustGuidedComplete(formValues);
        DEBUG_LOGS && debugLog(`[VALIDATION] propertyTrustGuided valid: ${ok}`);
        return ok;
      }

      if (field.type === 'personalChattelsGuided') {
        const ok = isPersonalChattelsGuidedComplete(formValues);
        DEBUG_LOGS && debugLog(`[VALIDATION] personalChattelsGuided valid: ${ok}`);
        return ok;
      }

      if (field.type === 'deliberateExclusionsGuided') {
        const ok = isDeliberateExclusionsGuidedComplete(formValues);
        DEBUG_LOGS && debugLog(`[VALIDATION] deliberateExclusionsGuided valid: ${ok}`);
        return ok;
      }

      if (field.type === 'otherProvisionsGuided') {
        const ok = isOtherProvisionsGuidedComplete(formValues);
        DEBUG_LOGS && debugLog(`[VALIDATION] otherProvisionsGuided valid: ${ok}`);
        return ok;
      }

      if (field.type === 'administrativeProvisionsGuided') {
        const ok = isAdministrativeProvisionsGuidedComplete(formValues);
        DEBUG_LOGS && debugLog(`[VALIDATION] administrativeProvisionsGuided valid: ${ok}`);
        return ok;
      }

      if (field.type === 'estateResidueGuided') {
        const ok = isEstateResidueGuidedComplete(formValues);
        DEBUG_LOGS && debugLog(`[VALIDATION] estateResidueGuided valid: ${ok}`);
        return ok;
      }

      if (field.type === 'section' && field.subFields) {
        return field.subFields.every(checkField);
      }

      if (field.required) {
        if (field.type === 'checkboxGroup') {
          const isValid = Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          DEBUG_LOGS&&debugLog(`[VALIDATION] Field "${field.id}" (checkbox group) - Selected: ${Array.isArray(formValues[field.id]) ? formValues[field.id].length : 0}, Valid: ${isValid}`);
          return isValid;
        }
        if (field.type === 'text' || field.type === 'textarea') {
          const val = formValues[field.id];
          const isValid = typeof val === 'string' && val.trim() !== '';
          DEBUG_LOGS&&debugLog(`[VALIDATION] Field "${field.id}" (${field.type}) - Value: "${formValues[field.id] || 'empty'}", Valid: ${isValid}`);
          return isValid;
        }
        const isValid = !!formValues[field.id];
        DEBUG_LOGS&&debugLog(`[VALIDATION] Field "${field.id}" (${field.type}) - Value: "${formValues[field.id] || 'empty'}", Valid: ${isValid}`);
        return isValid;
      }
      DEBUG_LOGS&&debugLog(`[VALIDATION] Field "${field.id}" - NOT REQUIRED, automatically valid`);
      return true;
    };

    const result = currentSectionRenderFields.every(checkField);

    if (isDev) DEBUG_LOGS&&debugLog('[VALIDATION CHECK] allRequiredFilled result:', result);
    return result;
  }, [currentSection, currentSectionRenderFields, formValues, evaluateFieldConditions, shouldHideSolicitorOnlyFieldForClient, isDev]);

  const isFormFullyCompleted = () => {
    try {
      return formData.formSections.every((section) => {
        const fieldFullyCompleted = (field) => {
          if (shouldHideSolicitorOnlyFieldForClient(field.id)) return true;
          if (field.conditions && !evaluateFieldConditions(field)) return true;
          if (['button', 'hidden', 'display'].includes(field.type)) return true;
          if (field.type === 'businessInterestsGuided') {
            return isBusinessInterestsGuidedComplete(formValues);
          }
          if (field.type === 'propertyGiftsGuided') {
            if (formValues.leavePropertyGifts !== 'Yes') return true;
            const list = formValues.propertyGiftsList;
            const hasGifts = Array.isArray(list) && list.length > 0;
            const lapse = formValues.failedPropertyGiftPassProportionately;
            return hasGifts && (lapse === 'Yes' || lapse === 'No' || lapse === 'Unsure');
          }
          if (field.type === 'propertyTrustGuided') {
            return isPropertyTrustGuidedComplete(formValues);
          }
          if (field.type === 'personalChattelsGuided') {
            return isPersonalChattelsGuidedComplete(formValues);
          }
          if (field.type === 'deliberateExclusionsGuided') {
            return isDeliberateExclusionsGuidedComplete(formValues);
          }
          if (field.type === 'otherProvisionsGuided') {
            return isOtherProvisionsGuidedComplete(formValues);
          }
          if (field.type === 'administrativeProvisionsGuided') {
            return isAdministrativeProvisionsGuidedComplete(formValues);
          }
          if (field.type === 'estateResidueGuided') {
            return isEstateResidueGuidedComplete(formValues);
          }
          if (field.type === 'section' && field.subFields) {
            return field.subFields.every(fieldFullyCompleted);
          }
          if (!field.required) return true;
          if (field.type === 'checkboxGroup') {
            return Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          }
          if (field.type === 'text' || field.type === 'textarea') {
            const val = formValues[field.id];
            return typeof val === 'string' && val.trim() !== '';
          }
          return !!formValues[field.id];
        };
        return getSectionRenderFields(section).every(fieldFullyCompleted);
      });
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
      DEBUG_LOGS&&debugLog('[VALIDATION] Collecting validation issues...');
      DEBUG_LOGS&&debugLog('[VALIDATION] Current section:', currentSection?.formSection);
      DEBUG_LOGS&&debugLog('[VALIDATION] Total fields in section:', currentSectionRenderFields?.length);
    }
    
    const issues = [];

    const collectFromField = (field) => {
      if (isDev) DEBUG_LOGS&&debugLog(`[VALIDATION] Checking field:`, field.id, field.label, 'required:', field.required);

      if (shouldHideSolicitorOnlyFieldForClient(field.id)) {
        return;
      }

      if (field.conditions && !evaluateFieldConditions(field)) {
        if (isDev) DEBUG_LOGS&&debugLog(`[VALIDATION] Field ${field.id} skipped - conditions not met`);
        return;
      }

      if (['button', 'hidden', 'display'].includes(field.type)) {
        if (isDev) DEBUG_LOGS&&debugLog(`[VALIDATION] Field ${field.id} skipped - type: ${field.type}`);
        return;
      }

      if (field.type === 'businessInterestsGuided') {
        if (!isBusinessInterestsGuidedComplete(formValues)) {
          issues.push({
            fieldId: field.id,
            fieldLabel: 'Business interests',
            message:
              'Please complete the business questions (type, ownership, how long held, value, agreement, trading nature, trustees, beneficiaries, separate trustee if applicable, and fallback). Your solicitor will refine everything at your appointment.',
            type: 'required',
          });
        }
        return;
      }

      if (field.type === 'propertyGiftsGuided') {
        if (formValues.leavePropertyGifts === 'Yes') {
          const list = formValues.propertyGiftsList;
          const hasGifts = Array.isArray(list) && list.length > 0;
          if (!hasGifts) {
            issues.push({
              fieldId: field.id,
              fieldLabel: 'Property gifts',
              message: 'Add at least one property gift, or change your answer to “No” if you do not want to leave property as direct gifts.',
              type: 'required',
            });
          }
          const lapse = formValues.failedPropertyGiftPassProportionately;
          if (lapse !== 'Yes' && lapse !== 'No' && lapse !== 'Unsure') {
            issues.push({
              fieldId: field.id,
              fieldLabel: 'Property gifts — if a recipient dies first',
              message:
                'Please choose what should happen if a person you have left a property to dies before you, or ask your solicitor to advise.',
              type: 'required',
            });
          }
        }
        return;
      }

      if (field.type === 'propertyTrustGuided') {
        getPropertyTrustGuidedValidationIssues(formValues, field.id).forEach((issue) => {
          issues.push({
            fieldId: issue.fieldId,
            fieldLabel: issue.fieldLabel,
            message: issue.message,
            type: issue.type,
          });
        });
        return;
      }

      if (field.type === 'personalChattelsGuided') {
        getPersonalChattelsGuidedValidationIssues(formValues).forEach((i) => {
          issues.push({ ...i, fieldId: field.id });
        });
        return;
      }

      if (field.type === 'deliberateExclusionsGuided') {
        getDeliberateExclusionsGuidedValidationIssues(formValues).forEach((i) => {
          issues.push({ ...i, fieldId: field.id });
        });
        return;
      }

      if (field.type === 'otherProvisionsGuided') {
        getOtherProvisionsGuidedValidationIssues(formValues).forEach((i) => {
          issues.push({ ...i, fieldId: field.id });
        });
        return;
      }

      if (field.type === 'administrativeProvisionsGuided') {
        getAdministrativeProvisionsGuidedValidationIssues(formValues).forEach((i) => {
          issues.push({ ...i, fieldId: field.id });
        });
        return;
      }

      if (field.type === 'estateResidueGuided') {
        getEstateResidueGuidedValidationIssues(formValues).forEach((i) => {
          issues.push({ ...i, fieldId: field.id });
        });
        return;
      }

      if (field.type === 'section' && field.subFields) {
        field.subFields.forEach(collectFromField);
        return;
      }

      if (field.required) {
        let isInvalid = false;
        let issueMessage = '';

        if (field.type === 'checkboxGroup') {
          const hasSelection = Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          if (isDev) DEBUG_LOGS&&debugLog(`[VALIDATION] CheckboxGroup ${field.id} - hasSelection:`, hasSelection);
          if (!hasSelection) {
            isInvalid = true;
            issueMessage = 'Please select at least one option';
          }
        } else {
          const value = formValues[field.id];
          const isEmpty = !value || (typeof value === 'string' && !value.trim());
          if (isDev) DEBUG_LOGS&&debugLog(`[VALIDATION] Field ${field.id} - value:`, value, 'isEmpty:', isEmpty);
          if (isEmpty) {
            isInvalid = true;
            issueMessage = 'This field is required';
          }
        }

        if (isInvalid) {
          if (isDev) DEBUG_LOGS&&debugLog(`[VALIDATION] ❌ ISSUE FOUND: ${field.label} (${field.id}) - ${issueMessage}`);
          issues.push({
            fieldId: field.id,
            fieldLabel: field.label,
            message: issueMessage,
            type: 'required'
          });
        } else if (isDev) {
          DEBUG_LOGS&&debugLog(`[VALIDATION] ✅ Field ${field.id} is valid`);
        }
      } else if (isDev) {
        DEBUG_LOGS&&debugLog(`[VALIDATION] Field ${field.id} is not required - skipping`);
      }
    };

    currentSectionRenderFields.forEach(collectFromField);
    
    if (isDev) {
      DEBUG_LOGS&&debugLog('[VALIDATION] Total issues collected:', issues.length);
      DEBUG_LOGS&&debugLog('[VALIDATION] Issues:', issues);
    }
    return issues;
  }, [currentSection, currentSectionRenderFields, formValues, evaluateFieldConditions, shouldHideSolicitorOnlyFieldForClient, isDev]);

  // ---------------------------
  // Navigation Logic
  // ---------------------------
  const goNext = () => {
    DEBUG_LOGS&&debugLog('[NAVIGATION] ========== GO NEXT CLICKED ==========');
    DEBUG_LOGS&&debugLog('[NAVIGATION] Current section:', currentSection?.formSection);
    DEBUG_LOGS&&debugLog('[NAVIGATION] allRequiredFilled:', allRequiredFilled);
    DEBUG_LOGS&&debugLog('[NAVIGATION] currentIndex:', currentIndex, 'of', formData.formSections.length - 1);
    DEBUG_LOGS&&debugLog('[NAVIGATION] Current form values:', Object.keys(formValues));
    
    // Check if all required fields are filled before allowing navigation
    if (!allRequiredFilled) {
      if (isDev) DEBUG_LOGS&&debugLog('[GO NEXT] Required fields NOT filled - opening modal');
      // Collect all validation issues
      const issues = collectValidationIssues();
      setValidationIssues(issues);
      setValidationModalOpen(true);
      if (isDev) DEBUG_LOGS&&debugLog('[GO NEXT] Modal state set to open');
      return;
    }
    
    if (isDev) DEBUG_LOGS&&debugLog('[GO NEXT] All fields valid - proceeding to next step');
    if (currentIndex < visibleSections.length - 1) {
      const nextIndex = currentIndex + 1;
      if (isDev) DEBUG_LOGS&&debugLog('[GO NEXT] Moving from step', currentIndex + 1, 'to step', nextIndex + 1);
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
      if (!solicitorMode) {
        setSubmitReviewModalOpen(true);
        return;
      }
      const missingIdDocs = getMissingIdVerificationDocs({ identityVerification: formValues?.identityVerification });
      const idVerificationIncomplete = missingIdDocs.length > 0;
      if (idVerificationIncomplete) {
        setIdVerificationIncompleteModalOpen(true);
        return;
      }
      void finishSubmission();
    }
  };

  const proceedAfterSubmitReview = useCallback(() => {
    setSubmitReviewModalOpen(false);
    const missingIdDocs = getMissingIdVerificationDocs({ identityVerification: formValues?.identityVerification });
    if (missingIdDocs.length > 0) {
      setIdVerificationIncompleteModalOpen(true);
      return;
    }
    void finishSubmission();
  }, [finishSubmission, formValues?.identityVerification]);

  const handleNextButtonClick = (e) => {
    if (isDev) {
      DEBUG_LOGS&&debugLog('[NEXT BUTTON] ========== CLICKED ==========');
      DEBUG_LOGS&&debugLog('[NEXT BUTTON] allRequiredFilled:', allRequiredFilled);
      DEBUG_LOGS&&debugLog('[NEXT BUTTON] currentIndex:', currentIndex);
      DEBUG_LOGS&&debugLog('[NEXT BUTTON] currentSection:', currentSection?.formSection);
    }
    
    if (!allRequiredFilled) {
      if (isDev) DEBUG_LOGS&&debugLog('[NEXT BUTTON] ❌ Required fields NOT filled - collecting issues...');
      e.preventDefault();
      e.stopPropagation();
      
      const issues = collectValidationIssues();
      if (isDev) {
        DEBUG_LOGS&&debugLog('[NEXT BUTTON] Validation issues found:', issues);
        DEBUG_LOGS&&debugLog('[NEXT BUTTON] Number of issues:', issues.length);
      }
      
      setValidationIssues(issues);
      setValidationModalOpen(true);
      if (isDev) DEBUG_LOGS&&debugLog('[NEXT BUTTON] ✅ Modal state set to TRUE');
    } else {
      if (isDev) DEBUG_LOGS&&debugLog('[NEXT BUTTON] ✅ All required fields filled - proceeding to next step');
      goNext();
    }
  };

  // Helper function to recursively search through a field and its nested structures
  const searchFieldRecursively = (field, normalized, keyWords, allowPartial) => {
    if (!field) return null;
    
    // Special logging for foreignWillNotRevoked
    if (normalized === 'foreignwillnotrevoked' || normalized.includes('foreignwill')) {
      debugLog('[SEARCH FIELD RECURSIVELY] 🔍 Checking field:', {
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
        debugLog('[SEARCH FIELD RECURSIVELY] ✅ DIRECT ID MATCH:', field.id);
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
    DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] ========== SCROLLING TO FIELD "${fieldId}" ==========`);
    DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Field ID type:`, typeof fieldId);
    DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Field ID value:`, fieldId);
    DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Target field IDs (fallback):`, targetFieldIds);
    DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Retry count:`, retryCount);
    
    if (!fieldId) {
      console.error(`[SCROLL TO FIELD] ❌ No fieldId provided!`);
      return;
    }
    
    // Try primary fieldId first
    const tryField = (id) => {
      DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Trying field ID: "${id}"`);
      const selector = `[data-field-id="${id}"]`;
      const fieldElement = document.querySelector(selector);
      
      if (fieldElement) {
        DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] ✅ Found field element for "${id}" - scrolling and highlighting`);
        DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Element tag:`, fieldElement.tagName);
        DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Element classes:`, fieldElement.className);
        
        try {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] ScrollIntoView called successfully`);
          
          // Add a highlight effect
          fieldElement.classList.add('animate-pulse');
          DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Added animate-pulse class`);
          setTimeout(() => {
            fieldElement.classList.remove('animate-pulse');
            DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Removed animate-pulse class`);
          }, 2000);
          
          // Focus on the first input in that field (or the button itself if it's a button)
          const input = fieldElement?.querySelector('input, textarea, select');
          const isButton = fieldElement.tagName === 'BUTTON' || fieldElement.querySelector('button');
          DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Found input element:`, input, 'isButton:', isButton);
          if (input) {
            DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Focusing on input element in field "${id}"`);
            setTimeout(() => {
              try {
                input.focus();
                DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] ✅ Input focused successfully`);
              } catch (focusError) {
                console.error(`[SCROLL TO FIELD] ❌ Error focusing input:`, focusError);
              }
            }, 500);
          } else if (isButton) {
            DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Field is a button, no input to focus`);
          } else {
            DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] No input element found in field`);
          }
          
          // Close modal after scrolling
          DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Closing validation modal after scroll to "${id}"`);
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
      debugLog(`[SCROLL TO FIELD] Primary fieldId "${fieldId}" not found, trying ${targetFieldIds.length} fallback field IDs...`);
      for (const fallbackId of targetFieldIds) {
        if (fallbackId !== fieldId) {
          debugLog(`[SCROLL TO FIELD] Trying fallback field ID: "${fallbackId}"`);
          if (tryField(fallbackId)) {
            debugLog(`[SCROLL TO FIELD] ✅ Found fallback field "${fallbackId}"`);
            return;
          }
        }
      }
      debugLog(`[SCROLL TO FIELD] ⚠️ None of the fallback field IDs worked:`, targetFieldIds);
    }
    
    // Try case-insensitive search
    const allFields = document.querySelectorAll('[data-field-id]');
    DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] Total fields with data-field-id:`, allFields.length);
    
    const searchIds = [fieldId, ...(Array.isArray(targetFieldIds) ? targetFieldIds : [])];
    const foundField = Array.from(allFields).find(field => {
      const id = field.getAttribute('data-field-id') || '';
      return searchIds.some(searchId => id.toLowerCase() === String(searchId).toLowerCase());
    });
    
    if (foundField) {
      DEBUG_LOGS&&debugLog(`[SCROLL TO FIELD] ✅ Found field via case-insensitive search`);
      foundField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = foundField.querySelector('input, textarea, select');
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
      debugLog(`[SCROLL TO FIELD] ⏳ Field "${fieldId}" not found, retrying in ${(retryCount + 1) * 500}ms... (attempt ${retryCount + 1}/3)`);
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
    debugLog('[FIND FIELD BY LABEL] 🔍 Starting search:', { label, allowPartial });
    if (!label || !formData?.formSections) {
      console.error('[FIND FIELD BY LABEL] ❌ Invalid input:', { label, hasFormData: !!formData, hasFormSections: !!formData?.formSections });
      return null;
    }
    const normalized = String(label).trim().toLowerCase();
    debugLog('[FIND FIELD BY LABEL] 🔍 Normalized label:', normalized);
    // Extract key words from the label (first 30-50 chars usually contain the question)
    const keyWords = normalized.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    debugLog('[FIND FIELD BY LABEL] 🔍 Key words:', keyWords);
    
    let searchCount = 0;
    for (const section of formData.formSections) {
      if (!section?.fields) continue;
      for (const field of section.fields) {
        searchCount++;
        const result = searchFieldRecursively(field, normalized, keyWords, allowPartial);
        if (result) {
          debugLog('[FIND FIELD BY LABEL] ✅ Found match:', { result, searchCount, section: section.formSection });
          return result;
        }
      }
    }
    console.error('[FIND FIELD BY LABEL] ❌ No match found after searching', searchCount, 'fields');
    return null;
  };

  // Helper to find and scroll to schedule fields
  const scrollToScheduleField = (scheduleText) => {
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] ========== STARTING SCHEDULE SEARCH ==========`);
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Input scheduleText: "${scheduleText}"`);
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Type of scheduleText:`, typeof scheduleText);
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Current form values:`, Object.keys(formValues).length, 'fields');
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] propertyTrustScheduleNumber:`, formValues.propertyTrustScheduleNumber);
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] bprTrustScheduleNumber:`, formValues.bprTrustScheduleNumber);
    
    // Extract schedule number from "Schedule 65432" or "Schedule65432" etc.
    const scheduleMatch = scheduleText.match(/schedule\s*(\d+)/i);
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Regex match result:`, scheduleMatch);
    const scheduleNumber = scheduleMatch ? scheduleMatch[1] : null;
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Extracted schedule number: "${scheduleNumber}"`);
    
    if (!scheduleNumber) {
      console.error(`[SCROLL TO SCHEDULE] Could not extract schedule number from: "${scheduleText}"`);
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Trying fallback: search for any schedule section...`);
    }
    
    if (scheduleNumber) {
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Searching for schedule number: ${scheduleNumber}`);
      
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
      
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Trying ${searchStrategies.length} selector strategies...`);
      for (let i = 0; i < searchStrategies.length; i++) {
        const selector = searchStrategies[i];
        DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Strategy ${i + 1}: Trying selector "${selector}"`);
        const element = document.querySelector(selector);
        DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Strategy ${i + 1} result:`, element);
        if (element) {
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] ✅ SUCCESS! Found field with selector: ${selector}`);
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Element details:`, {
            tagName: element.tagName,
            id: element.id,
            className: element.className,
            dataFieldId: element.getAttribute('data-field-id')
          });
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('animate-pulse');
          setTimeout(() => element.classList.remove('animate-pulse'), 2000);
          
          const input = element.querySelector('input, textarea, select');
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Found input element:`, input);
          if (input) {
            setTimeout(() => {
              DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Focusing input...`);
              input.focus();
            }, 500);
          }
          
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Closing validation modal...`);
          setValidationModalOpen(false);
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] ========== SUCCESS - EXITING ==========`);
          return;
        }
      }
      
      // Strategy 5: Search all fields and find one with schedule number in value or label
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] All selector strategies failed, trying manual field search...`);
      const allFields = document.querySelectorAll('[data-field-id]');
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Total fields with data-field-id: ${allFields.length}`);
      
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
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] ✅ SUCCESS! Found matching field at index ${checkedCount}:`);
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Field ID: "${fieldId}"`);
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Label: "${label}"`);
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Value: "${value}"`);
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Matches:`, { hasScheduleInId, hasScheduleInLabel, hasScheduleInValue });
          
          field.scrollIntoView({ behavior: 'smooth', block: 'center' });
          field.classList.add('animate-pulse');
          setTimeout(() => field.classList.remove('animate-pulse'), 2000);
          
          const input = field.querySelector('input, textarea, select');
          if (input) {
            setTimeout(() => input.focus(), 500);
          }
          
          setValidationModalOpen(false);
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] ========== SUCCESS - EXITING ==========`);
          return;
        }
        
        // Log first 5 fields for debugging
        if (checkedCount <= 5) {
          DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Field ${checkedCount}: ID="${fieldId}", Label="${label.substring(0, 50)}"`);
        }
      }
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Checked ${checkedCount} fields, no match found`);
    }
    
    // Fallback: Try to find any schedule-related section
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Trying fallback: search for schedule sections...`);
    const scheduleSections = document.querySelectorAll('[aria-label*="Schedule"], [aria-label*="schedule"]');
    DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Found ${scheduleSections.length} schedule sections`);
    if (scheduleSections.length > 0) {
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] Falling back to first schedule section`);
      scheduleSections[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setValidationModalOpen(false);
      DEBUG_LOGS&&debugLog(`[SCROLL TO SCHEDULE] ========== FALLBACK SUCCESS - EXITING ==========`);
      return;
    }
    
    console.error(`[SCROLL TO SCHEDULE] ❌ FAILED: Could not find schedule field for "${scheduleText}"`);
    console.error(`[SCROLL TO SCHEDULE] ========== FAILED - EXITING ==========`);
  };

  const saveDraft = () => {
    DEBUG_LOGS&&debugLog('[SAVE DRAFT] ========== MANUAL SAVE DRAFT CLICKED ==========');
    DEBUG_LOGS&&debugLog('[SAVE DRAFT] Current form values count:', Object.keys(formValues).length);
    
    try {
      const dataToSave = buildLocalDraftPayload(formValues);
      DEBUG_LOGS&&debugLog(`[SAVE DRAFT] Prepared ${Object.keys(dataToSave).length} fields for saving`);
      
      // Check localStorage quota
      const testStr = JSON.stringify(dataToSave);
      if (testStr.length > 5 * 1024 * 1024) { // 5MB limit
        alert('Form data is too large to save. Please reduce the amount of data.');
        return;
      }
      
      if (!useExternalPersistence) {
        localStorage.setItem('willForm', testStr);
      }
      DEBUG_LOGS&&debugLog(`[SAVE DRAFT] Successfully saved draft with ${Object.keys(dataToSave).length} fields`);

      if (externalPersistence?.save) {
        externalPersistence.save({ formValues, currentIndex, saveType: 'manual' });
      } else if (useCloud && sessionInitialized && referenceNumber && sessionSecret) {
        const cloudPayload = buildCloudPayload(formValues, currentIndex);
        debugLog('[WillTool Flow] Client manual save: sending draft to cloud', { ref: referenceNumber, step: currentIndex });
        saveSession(referenceNumber, sessionSecret, cloudPayload).then((res) => {
          if (res.error) {
            console.warn('[WillTool Flow] Client cloud save failed', { ref: referenceNumber, error: res.error });
            toast.error('Cloud save failed', { description: res.error });
          } else {
            debugLog('[WillTool Flow] Client draft saved to cloud (manual)', { ref: referenceNumber });
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

  const getClauseDisplayText = useCallback((clause) => {
    if (!clause) return '';
    if (!clause.incomplete) return clause.text || '';
    const fields = Array.isArray(clause.missingFields) && clause.missingFields.length > 0
      ? clause.missingFields.join(', ')
      : 'required fields';
    return `[Incomplete clause — requires user input: ${fields}]`;
  }, []);

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
      interpolateText: interpolateTextRef.current,
      maxSectionIndex: previewMaxSectionIndex
    });
    const pdf = buildClauses({
      formValues: values,
      formData,
      interpolateText: interpolateTextRef.current
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
  }, [formData, getClauseDisplayText]);

  // Auto-fill form with dummy data - respects client mode (filters solicitor-only fields)
  const handleAutoFill = useCallback(() => {
    debugLog('[FORM AUTO-FILL] ========== AUTO-FILL BUTTON CLICKED ==========');
      const isClient = !solicitorMode;
    debugLog('[FORM AUTO-FILL] 📋 Form data available:', {
      hasFormData: !!formData,
      totalSections: formData?.formSections?.length || 0,
      visibleSections: visibleSections.length,
      isClientMode: isClient,
      currentFormValuesCount: Object.keys(formValues).length
    });
    
    try {
      debugLog('[FORM AUTO-FILL] 🔄 Calling generateDummyFormData...');
      // Generate dummy data using ALL sections (needed for proper field mapping)
      const dummyData = generateDummyFormData(formData);
      
      // Filter out solicitor-only fields if in client mode
      if (isClient) {
        debugLog('[FORM AUTO-FILL] 🔒 Client mode detected - filtering solicitor-only fields...');
        let removedCount = 0;
        CLIENT_AUTOFILL_STRIP_FIELD_IDS.forEach((fieldId) => {
          if (dummyData[fieldId] !== undefined) {
            delete dummyData[fieldId];
            removedCount++;
            debugLog(`[FORM AUTO-FILL] 🗑️ Removed client-hidden field: ${fieldId}`);
          }
        });
        debugLog(
          `[FORM AUTO-FILL] ✅ Removed ${removedCount} client-hidden fields (BPR/property trust drafting + TC demo values kept for dashboard workflow)`,
        );
      }

      debugLog(
        '[AUTOFILL_VERIFY] Next: solicitor mode → open Trustees/Executors step. Console: filter AUTOFILL_VERIFY or EXECUTOR_AGE_DEBUG or AUTOFILL GENERATE.'
      );
      
      debugLog('[FORM AUTO-FILL] ✅ Generated dummy data:', {
        totalFields: Object.keys(dummyData).length,
        contactRegistryEntries: Array.isArray(dummyData.contactRegistry) ? dummyData.contactRegistry.length : 0,
        hasSeparateTrusteeData: !!dummyData.separateTrusteeData,
        separateTrusteeDataLength: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 'N/A',
        guardianSampleIsObject: !!(dummyData.guardianData?.[0] && typeof dummyData.guardianData[0] === 'object'),
        howResidueDistributed: dummyData.howResidueDistributed,
        appointSeparateTrusteesFLIT: dummyData.appointSeparateTrusteesFLIT,
        sampleFields: Object.keys(dummyData).slice(0, 8)
      });

      debugLog('[EXECUTOR_AGE_DEBUG] autofill run', {
        when: 'after dummyData generated (before setState)',
        solicitorMode: !isClient,
        chooseAristoneExecutor: dummyData.chooseAristoneExecutor,
        executorDataIsArray: Array.isArray(dummyData.executorData),
        executorDataLength: Array.isArray(dummyData.executorData) ? dummyData.executorData.length : null,
      });
      if (Array.isArray(dummyData.executorData)) {
        dummyData.executorData.forEach((row, i) => {
          const keys = row && typeof row === 'object' && !Array.isArray(row) ? Object.keys(row) : null;
          debugLog('[EXECUTOR_AGE_DEBUG] autofill executorData row', {
            index: i,
            typeofRow: typeof row,
            keys,
            nameFields:
              row && typeof row === 'object' && !Array.isArray(row)
                ? { title: row.title, firstName: row.firstName, lastName: row.lastName }
                : null,
            dateOfBirth: row && typeof row === 'object' && !Array.isArray(row) ? row.dateOfBirth : undefined,
          });
        });
      }
      
      if (dummyData.separateTrusteeData) {
        debugLog('[FORM AUTO-FILL] 🔍 Separate trustee data details:', {
          isArray: Array.isArray(dummyData.separateTrusteeData),
          length: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 'N/A',
          firstItem: Array.isArray(dummyData.separateTrusteeData) && dummyData.separateTrusteeData.length > 0 
            ? dummyData.separateTrusteeData[0] 
            : 'N/A',
          allItems: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData : 'N/A'
        });
      }

      const filteredToSchema = filterAutofillPayloadToFormSchema(dummyData, formData);
      if (import.meta.env.DEV && Object.keys(filteredToSchema).length < Object.keys(dummyData).length) {
        const dropped = Object.keys(dummyData).filter((k) => !(k in filteredToSchema));
        debugLog('[FORM AUTO-FILL] 🧹 Dropped non-schema autofill keys:', dropped);
      }
      
      const nextStateForPreview = { ...filteredToSchema };
      debugLog('[FORM AUTO-FILL] ✅ New form state (schema-filtered) preview:', {
        previousKeyCount: Object.keys(formValues).length,
        nextKeyCount: Object.keys(nextStateForPreview).length,
        hasSeparateTrusteeData: !!nextStateForPreview.separateTrusteeData
      });
      if (import.meta.env.DEV) {
        const est = getAristoneEstateRecommendationState(nextStateForPreview);
        debugLog('[FORM AUTO-FILL] Estate recommendation preview (after merge):', {
          summary: getEstateRecommendationLogSummary(est),
          eligible: est.eligible,
          estateApproxValue: est.grossKey,
          estateApproxLiabilities: est.liabilityKey,
          inferredLiabilityFromNoLiabilities: est.inferredLiability,
          grossMinK: est.grossMin,
          liabilityMaxK: est.liabMax,
          netPositiveBands: est.grossMin != null && est.liabMax != null && est.grossMin > est.liabMax,
          reasons: est.reasons,
        });
      }

      debugLog('[FORM AUTO-FILL] 🔄 Updating form values state (replace with schema-only keys, no legacy merge)...');
      setFormValues(filteredToSchema);
      
      debugLog('[FORM AUTO-FILL] 💾 Saving to localStorage...');
      try {
        localStorage.setItem('willForm', JSON.stringify(filteredToSchema));
        debugLog('[FORM AUTO-FILL] ✅ Saved to localStorage successfully');
      } catch (storageError) {
        console.error('[FORM AUTO-FILL] ❌ Failed to save to localStorage:', storageError);
      }
      
      debugLog('[FORM AUTO-FILL] ⏱️ Scheduling form values refresh...');
      setTimeout(() => {
        debugLog('[FORM AUTO-FILL] 🔄 Refreshing form values state...');
        setFormValues(current => {
          debugLog('[FORM AUTO-FILL] ✅ Form values refreshed:', {
            currentCount: Object.keys(current).length,
            hasSeparateTrusteeData: !!current.separateTrusteeData,
            contactRegistryEntries: Array.isArray(current.contactRegistry) ? current.contactRegistry.length : 0
          });
          return { ...current };
        });
      }, 100);
      
      const modeText = isClient ? 'client' : 'solicitor';
      toast.success('Form auto-filled ✓', {
        description: isClient
          ? `Filled ${Object.keys(filteredToSchema).length} fields for testing. Upload real ID documents on the final step (not auto-filled).`
          : `Filled ${Object.keys(filteredToSchema).length} fields with test data (${modeText} mode). ID uploads left empty.`,
        duration: 2200
      });
      
      if (import.meta.env.DEV) {
        debugLog('[FORM AUTO-FILL] 🔍 Building clause debug export...');
        const previewMaxIndex = visibleSections.length - 1;
        const exportPayload = buildClauseDebugExport(filteredToSchema, previewMaxIndex);
        window.lastClauseDebugExport = exportPayload;
        console.group('[CLAUSE DEBUG][AUTO-FILL]');
        console.info('diff', exportPayload.diff);
        console.info('previewClauses', exportPayload.previewClauses);
        console.info('pdfClauses', exportPayload.pdfClauses);
        console.groupEnd();
      }
      
      debugLog('[FORM AUTO-FILL] ========== AUTO-FILL COMPLETED SUCCESSFULLY ==========');
    } catch (error) {
      console.error('[FORM AUTO-FILL] ❌ Auto-fill error:', error);
      console.error('[FORM AUTO-FILL] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      toast.error('Auto-fill failed', { description: error.message });
    }
  }, [buildClauseDebugExport, formData, formValues, setFormValues, visibleSections, solicitorMode]);

  // Expose auto-fill function to window for console access (dev / solicitors / explicit flag only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (showAutoFillControls) {
      window.autoFillWillForm = handleAutoFill;
    } else {
      try {
        delete window.autoFillWillForm;
      } catch {
        window.autoFillWillForm = undefined;
      }
    }
  }, [handleAutoFill, showAutoFillControls]);

  const verifyNoTestPlaceholders = useCallback(() => {
    const testFields = Object.entries(formValues).filter((entry) => {
      const val = entry[1];
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
      DEBUG_LOGS&&debugLog('[COMPLETION %] ========== CALCULATING FORM COMPLETION PERCENTAGE ==========');
      let totalRequired = 0;
      let completedRequired = 0;

      formData.formSections.forEach((section, sectionIndex) => {
        DEBUG_LOGS&&debugLog(`[COMPLETION %] Section ${sectionIndex + 1}: "${section.formSection}"`);

        const accumulateCompletion = (field) => {
          if (field.conditions && !evaluateFieldConditions(field)) {
            DEBUG_LOGS&&debugLog(`[COMPLETION %] Field "${field.id}" - SKIPPED (conditions not met)`);
            return;
          }
          if (['button', 'hidden', 'display'].includes(field.type)) {
            DEBUG_LOGS&&debugLog(`[COMPLETION %] Field "${field.id}" - SKIPPED (type: ${field.type})`);
            return;
          }
          if (field.type === 'section' && field.subFields) {
            field.subFields.forEach(accumulateCompletion);
            return;
          }
          if (!field.required) return;
          totalRequired++;
          DEBUG_LOGS&&debugLog(`[COMPLETION %] Field "${field.id}" - REQUIRED field found (total now: ${totalRequired})`);
          let isCompleted;
          if (field.type === 'checkboxGroup') {
            isCompleted = Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          } else if (field.type === 'text' || field.type === 'textarea') {
            const val = formValues[field.id];
            isCompleted = typeof val === 'string' && val.trim() !== '';
          } else {
            isCompleted = !!formValues[field.id];
          }
          if (isCompleted) {
            completedRequired++;
            DEBUG_LOGS&&debugLog(`[COMPLETION %] Field "${field.id}" - COMPLETED (completed now: ${completedRequired})`);
          } else {
            DEBUG_LOGS&&debugLog(`[COMPLETION %] Field "${field.id}" - NOT completed`);
          }
        };

        section.fields.forEach(accumulateCompletion);
      });

      const percent = totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;
      DEBUG_LOGS&&debugLog(`[COMPLETION %] FINAL CALCULATION: ${completedRequired}/${totalRequired} = ${percent}%`);
      setFormCompletionPercent(percent);
    };

    calculateCompletion();
  }, [formValues, evaluateFieldConditions, solicitorMode, formData]);

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
          debugLog('[CLEANUP] 🔍 Found exact placeholder string entries in separateTrusteeData, cleaning up...');
          const cleanedData = formValues.separateTrusteeData.filter(item => !isPlaceholder(item));
          if (cleanedData.length !== formValues.separateTrusteeData.length) {
            updatedValues.separateTrusteeData = cleanedData;
            hasChanges = true;
            debugLog('[CLEANUP] ✅ Cleaned up placeholder string entries from separateTrusteeData:', {
              before: formValues.separateTrusteeData.length,
              after: cleanedData.length,
              removed: formValues.separateTrusteeData.length - cleanedData.length
            });
          }
        } else {
          // Log when we have string entries but they're not placeholders (legitimate user input)
          const stringEntries = formValues.separateTrusteeData.filter(item => typeof item === 'string');
          if (stringEntries.length > 0) {
            debugLog('[CLEANUP] ℹ️ Found legitimate string entries in separateTrusteeData (keeping them):', stringEntries);
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
          debugLog('[CLEANUP] 🔍 Found exact placeholder string entries in petCarerData, cleaning up...');
          const cleanedData = formValues.petCarerData.filter(item => !isPlaceholder(item));
          if (cleanedData.length !== formValues.petCarerData.length) {
            updatedValues.petCarerData = cleanedData;
            hasChanges = true;
            debugLog('[CLEANUP] ✅ Cleaned up placeholder string entries from petCarerData:', {
              before: formValues.petCarerData.length,
              after: cleanedData.length,
              removed: formValues.petCarerData.length - cleanedData.length
            });
          }
        } else {
          // Log when we have string entries but they're not placeholders (legitimate user input)
          const stringEntries = formValues.petCarerData.filter(item => typeof item === 'string');
          if (stringEntries.length > 0) {
            debugLog('[CLEANUP] ℹ️ Found legitimate string entries in petCarerData (keeping them):', stringEntries);
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
          debugLog('[CLEANUP] 🔍 Found exact placeholder string entries in substitutePetCarerData, cleaning up...');
          const cleanedData = formValues.substitutePetCarerData.filter(item => !isPlaceholder(item));
          if (cleanedData.length !== formValues.substitutePetCarerData.length) {
            updatedValues.substitutePetCarerData = cleanedData;
            hasChanges = true;
            debugLog('[CLEANUP] ✅ Cleaned up placeholder string entries from substitutePetCarerData:', {
              before: formValues.substitutePetCarerData.length,
              after: cleanedData.length,
              removed: formValues.substitutePetCarerData.length - cleanedData.length
            });
          }
        } else {
          // Log when we have string entries but they're not placeholders (legitimate user input)
          const stringEntries = formValues.substitutePetCarerData.filter(item => typeof item === 'string');
          if (stringEntries.length > 0) {
            debugLog('[CLEANUP] ℹ️ Found legitimate string entries in substitutePetCarerData (keeping them):', stringEntries);
          }
        }
      }

      if (hasChanges) {
        debugLog('[CLEANUP] ✅ Applying cleanup changes to form values');
        setFormValues(updatedValues);
      }
    };

    // Run cleanup immediately and also debounced to catch any late additions
    cleanupStringEntries();
    const timer = setTimeout(cleanupStringEntries, 100);
    return () => clearTimeout(timer);
  }, [formValues]);

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

            debugLog('[MODAL PROCESSOR] Processed separate trustee modal fields:', {
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

            debugLog('[MODAL PROCESSOR] Processed pet carer modal fields:', {
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

            debugLog('[MODAL PROCESSOR] Processed substitute pet carer modal fields:', {
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
          debugLog('[MODAL PROCESSOR] Updating form values with structured modal data');
          setFormValues(updatedValues);
        } else {
          debugLog('[MODAL PROCESSOR] No data changes detected, skipping update');
        }
      }
    };

    // Debounce the processing to avoid excessive updates
    const timer = setTimeout(processModalFields, 500);
    return () => clearTimeout(timer);
  }, [formValues]);

  // Autosave (debounced) — with visual feedback
  useEffect(() => {
    DEBUG_LOGS&&debugLog('[AUTOSAVE] Form values changed, triggering autosave timer...');
    DEBUG_LOGS&&debugLog('[AUTOSAVE] Changed values:', Object.keys(formValues));
    
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setIsSaving(true);

    autosaveTimerRef.current = setTimeout(() => {
      DEBUG_LOGS&&debugLog('[AUTOSAVE] Executing autosave...');
      try {
        const dataToSave = buildLocalDraftPayload(formValues);
        DEBUG_LOGS&&debugLog(`[AUTOSAVE] Prepared ${Object.keys(dataToSave).length} fields for saving`);
        
        const testStr = JSON.stringify(dataToSave);
        if (testStr.length <= 5 * 1024 * 1024) {
          if (!useExternalPersistence) {
            localStorage.setItem('willForm', testStr);
          }
          setLastSaved(new Date());
          setIsSaving(false);
          DEBUG_LOGS&&debugLog(`[AUTOSAVE] Successfully saved ${Object.keys(dataToSave).length} fields to localStorage`);
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

  /** Flush draft immediately on tab close / navigation so the last keystroke is not lost waiting for the 1s debounce. */
  useEffect(() => {
    const flushDraft = () => {
      try {
        const { formValues: fv, currentIndex: step } = latestPersistRef.current;
        if (useExternalPersistence) return;
        const dataToSave = buildLocalDraftPayload(fv);
        const testStr = JSON.stringify(dataToSave);
        if (testStr.length <= 5 * 1024 * 1024) {
          localStorage.setItem('willForm', testStr);
          localStorage.setItem('willFormStep', String(step));
        }
        if (useCloud && sessionInitialized && referenceNumber && sessionSecret) {
          const cloudPayload = buildCloudPayload(fv, step);
          void saveSession(referenceNumber, sessionSecret, cloudPayload);
        }
      } catch (e) {
        console.warn('[AUTOSAVE] Draft flush on page leave failed', e);
      }
    };
    const onLeave = () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      flushDraft();
    };
    window.addEventListener('pagehide', onLeave);
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('pagehide', onLeave);
      window.removeEventListener('beforeunload', onLeave);
    };
  }, [useCloud, sessionInitialized, referenceNumber, sessionSecret, useExternalPersistence]);

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
        setValidationIssues(preValidationIssues.map((issue) => ({
          ...issue,
          blockingAction: 'download_pdf',
        })));
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
          const pdfModule = await importPdfGeneratorModule();
          generatePDFWithJSPDF = pdfModule.generatePDFWithJSPDF;
          break;
        } catch (e) {
          if (isStaleChunkLoadError(e)) {
            clearTimeout(timeoutId);
            setIsGeneratingPDF(false);
            if (toastId) toast.dismiss(toastId);
            toast.error('App was just updated', {
              description:
                'Refresh the page, then try the PDF again. (A new version was published while you had this tab open.)',
              duration: 14_000,
              action: {
                label: 'Refresh page',
                onClick: () => window.location.reload(),
              },
            });
            return;
          }
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
          await new Promise((resolve) => setTimeout(resolve, 1000 * importAttempts));
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
      
      debugLog('[WillTool Flow] PDF generation started', { isClientPDF: clientCopy || !solicitorMode, phase: 'client_pdf_start' });
      debugLog('[PDF GENERATION] 🔄 Calling generatePDFWithJSPDF with sanitized values...');
      debugLog('[PDF GENERATION] 📊 Sanitized values summary:', {
        totalFields: Object.keys(sanitizedValues).length,
        hasSeparateTrusteeData: !!sanitizedValues.separateTrusteeData,
        separateTrusteeDataType: Array.isArray(sanitizedValues.separateTrusteeData) ? 'array' : typeof sanitizedValues.separateTrusteeData,
        separateTrusteeDataLength: Array.isArray(sanitizedValues.separateTrusteeData) ? sanitizedValues.separateTrusteeData.length : 'N/A',
        howResidueDistributed: sanitizedValues.howResidueDistributed,
        appointSeparateTrusteesFLIT: sanitizedValues.appointSeparateTrusteesFLIT,
        hasTestatorSignature: !!testatorSignature,
        hasConsultantSignature: !!consultantSignature
      });
      
      if (sanitizedValues.separateTrusteeData) {
        debugLog('[PDF GENERATION] 🔍 Separate trustee data in sanitized values:', {
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
        consultantSignature
      }, { isClientPDF, formSchema: formData });
      
      debugLog('[WillTool Flow] PDF generation completed', { hasDoc: !!pdfResult?.doc, hasPlaceholders: pdfResult?.hasPlaceholders, phase: 'client_pdf_done' });
      debugLog('[PDF GENERATION] ✅ PDF generation completed:', {
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
        setValidationIssues(allIssues.map((issue) => ({
          ...issue,
          blockingAction: 'download_pdf',
        })));
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
          
          DEBUG_LOGS&&debugLog(`[SCHEDULE ISSUE MAPPING] Property Trust schedule number: "${propertyTrustScheduleNum}", BPR Trust: "${bprTrustScheduleNum}"`);
          DEBUG_LOGS&&debugLog(`[SCHEDULE ISSUE MAPPING] Comparing Property Trust: "${propertyTrustScheduleNum}" === "${scheduleNumber}"`);
          
          let scheduleType;
          let userFriendlyMessage;
          let fieldHint;
          let sectionName;

          if (propertyTrustScheduleNum === scheduleNumber || 
              propertyTrustScheduleNum === String(scheduleText).replace(/Schedule\s+/i, '').trim()) {
            DEBUG_LOGS&&debugLog(`[SCHEDULE ISSUE MAPPING] ✅ Matched Property Trust schedule ${scheduleNumber}`);
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
            DEBUG_LOGS&&debugLog(`[SCHEDULE ISSUE MAPPING] Comparing BPR Trust: "${bprTrustScheduleNum}" === "${scheduleNumber}"`);
            DEBUG_LOGS&&debugLog(`[SCHEDULE ISSUE MAPPING] ✅ Matched BPR Trust schedule ${scheduleNumber}`);
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
            DEBUG_LOGS&&debugLog(`[SCHEDULE ISSUE MAPPING] ❌ No match found for schedule ${scheduleNumber}, using generic message`);
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
            missingFields: missingFields, // List of missing field names
            blockingAction: 'download_pdf'
          };
          
          return issueObject;
        });
        
        setValidationIssues(
          [...missingItems, ...scheduleIssues].map((issue) => ({
            ...issue,
            blockingAction: issue?.blockingAction || 'download_pdf',
          }))
        );
      }
      
      // Generate a descriptive filename with testator name and date
      const testatorName = formValues.firstName && formValues.lastName 
        ? `${formValues.firstName}-${formValues.lastName}`
        : 'Will';
      const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `${testatorName}-Last-Will-${currentDate}.pdf`;

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
      debugLog('[WillTool Flow] Client PDF downloaded', { filename, phase: 'client_pdf_download' });

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
              className="will-form-section-card w-full max-w-3xl bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-5 md:p-6 border border-gray-200 transition-all duration-300 hover:shadow-2xl"
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

              {!hideOtherProvisionsTopChrome && (
                <>
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
                      <>
                        <strong>Secure resume link:</strong> Anyone with this link can access and update this draft.
                        Do not forward it except to Aristone Solicitors. Keep it private on your device.
                      </>
                    ) : (
                      <><strong>Important:</strong> Your reference number and share link let you share your progress. Form data is currently stored on this device only—opening the link on another device will not restore your form. If you share the link, anyone with it can view and edit your form. Keep it secure.</>
                    )}
                  </p>
                </div>
              )}

              {inIframe && !useExternalPersistence && (
                <p className="mb-4 text-xs text-slate-600 dark:text-slate-300">
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[44px] inline-flex items-center font-medium text-indigo-700 underline dark:text-indigo-400"
                  >
                    Open form in full tab
                  </a>
                  {' '}
                  if the embedded view is difficult on your phone or tablet.
                </p>
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

              {!solicitorMode && <FormPeopleSummaryPanel payload={formValues} variant="client" />}

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                <div className="flex items-center gap-3" />
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
                    <div className={`flex flex-col gap-1 text-sm text-gray-700 px-4 py-3 rounded-xl max-w-lg ${
                      submittedMatterId
                        ? 'bg-emerald-50 border border-emerald-300'
                        : 'bg-amber-50 border border-amber-300'
                    }`}>
                      <p className={`font-semibold ${submittedMatterId ? 'text-emerald-900' : 'text-amber-900'}`}>
                        {submittedMatterId ? 'Questionnaire submitted — ID can be added below' : 'Questionnaire complete — this is not your final Will'}
                      </p>
                      <p>
                        {submittedMatterId
                          ? 'Upload ID documents below, then click Update submission to attach them to the same matter for solicitor review.'
                          : isClientIdentityOnlyStep
                            ? 'Upload your documents below, then click Submit. The solicitor will review your questionnaire and arrange signing (remote or in person).'
                            : 'Submit ID on the final step, then the solicitor reviews your questionnaire and arranges signing (remote or in person).'}
                      </p>
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

              {!isClientIdentityOnlyStep && (
                <div className="flex items-center gap-2 mb-3 pb-1.5 border-b-2 border-indigo-600">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FileText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 dark:text-slate-100">
                    {currentSection.formSection}
                  </h2>
                </div>
              )}

              {solicitorMode ? (
                <div
                  className={`mb-4 rounded-xl border px-4 py-3 ${
                    solicitorIdVerificationPending
                      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-600/15 dark:text-amber-100'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-600/15 dark:text-emerald-100'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        ID Verification: {solicitorIdVerificationPending ? 'Verification pending' : 'Verification complete'}
                      </p>
                      <p className="mt-1 text-xs sm:text-sm opacity-90 break-words">
                        {solicitorIdVerificationPending
                          ? `${solicitorMissingIdDocs.length} document${solicitorMissingIdDocs.length === 1 ? '' : 's'} still missing.`
                          : 'All required ID documents are present for this matter.'}
                      </p>
                      {solicitorIdVerificationPending ? (
                        <p className="mt-1 text-[11px] sm:text-xs opacity-80 break-words">
                          Missing: {solicitorMissingIdDocs.map((id) => ID_VERIFICATION_DOC_LABELS[id] || id).join(', ')}
                        </p>
                      ) : null}
                    </div>
                    {matterIdFromPath ? (
                      <button
                        type="button"
                        onClick={goToSolicitorIdReview}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-current/30 bg-white/70 px-3 py-2 text-xs sm:text-sm font-semibold hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                      >
                        Go to ID review
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
                </>
              )}

              <div className="space-y-3">
                {isClientIdentityOnlyStep ? (
                  <IdentityVerification
                    formValues={formValues}
                    setFormValues={setFormValues}
                    submittedMatterId={submittedMatterId}
                    isStandaloneStep
                  />
                ) : (
                currentSectionRenderFields.map((field, idx) => {
                  // #3 Client mode: hide solicitor-only fields (witness, signatures, execution) in Testamentary Capacity
                  if (shouldHideSolicitorOnlyFieldForClient(field.id)) {
                    return null;
                  }
                  // Skip fields that shouldn't be shown (conditions not met)
                  if (field.conditions && !evaluateFieldConditions(field)) {
                    // ALWAYS-ON Debug logging for foreignWillNotRevoked
                    if (field.id === 'foreignWillNotRevoked') {
                      debugLog(`[FIELD RENDER] ❌ Field "${field.id}" SKIPPED - conditions not met:`, {
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
                    debugLog(`[FIELD RENDER] ✅ Field "${field.id}" WILL BE RENDERED:`, {
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
                  /** Questionnaire must not surface draft Will clause text — PDF only (client / firm request). */
                  const fieldForUi = stripWillClauseTextForUi({
                    ...field,
                    label: displayLabel,
                    infoText:
                      field.id === 'partnerFullName'
                        ? "Simply type your partner's full name in the field above. The form saves automatically as you type - no need to press any buttons!"
                        : field.infoText,
                  });

                  return (
                    <div
                      key={field.id}
                      className="animate-slideIn opacity-0 transition-all duration-300"
                      style={{
                        animationDelay: `${idx * 0.05}s`,
                        animationFillMode: 'forwards'
                      }}
                    >
                      {solicitorMode && field.id === 'testatorSignature' ? (
                        <div className="mb-3 rounded-xl border border-violet-300 bg-violet-50 px-3 py-3 text-violet-900 dark:border-violet-500/50 dark:bg-violet-500/15 dark:text-violet-100">
                          <p className="text-sm font-semibold">Remote signature request</p>
                          <p className="mt-1 text-xs sm:text-sm opacity-90">
                            If the client is not in the office, send them a secure link so they can sign remotely.
                          </p>
                          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                            <button
                              type="button"
                              onClick={openSignatureRequestModal}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                            >
                              Send client signature request
                            </button>
                            <button
                              type="button"
                              onClick={() => { void copyClientSignatureLink(); }}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-violet-300 bg-white px-3 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-violet-400/50 dark:bg-slate-900/50 dark:text-violet-100 dark:hover:bg-slate-900/70"
                            >
                              Copy signature link
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {!solicitorMode && allowClientSignatureRequest && field.id === 'testatorSignature' ? (
                        <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs sm:text-sm text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-100">
                          Signature request received: please sign below and submit to send it back to your solicitor.
                        </div>
                      ) : null}
                      <FieldRenderer
                        field={fieldForUi}
                        formValues={formValues}
                        setFormValues={setFormValues}
                        expandedFields={expandedFields}
                        setExpandedFields={setExpandedFields}
                        evaluateFieldConditions={evaluateFieldConditions}
                      />
                    </div>
                  );
                }).filter(Boolean)
                )}
              </div>

              <LpaOpportunityClient
                solicitorMode={solicitorMode}
                formValues={formValues}
                setFormValues={setFormValues}
                currentSectionTitle={currentSection?.formSection ?? ''}
                actualSectionIndex={actualSectionIndex}
                showPreSubmitBanner={showLpaPreSubmitBanner}
                submitted={submitted}
              />

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
                  <span>{primaryActionLabel}</span>
                  <ChevronRight size={18} className="sm:w-5 sm:h-5" />
                </button>
              </div>

              {solicitorMode ? (
                <div
                  className={`mt-3 rounded-xl border px-4 py-3 ${
                    solicitorIdVerificationPending
                      ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-600/15 dark:text-amber-100'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-600/15 dark:text-emerald-100'
                  }`}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold">
                      ID Verification: {solicitorIdVerificationPending ? 'Verification pending' : 'Verification complete'}
                    </p>
                    {matterIdFromPath ? (
                      <button
                        type="button"
                        onClick={goToSolicitorIdReview}
                        className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-current/30 bg-white/70 px-3 py-2 text-xs sm:text-sm font-semibold hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-900/40 dark:hover:bg-slate-900/60"
                      >
                        Open ID review
                      </button>
                    ) : null}
                  </div>
                  {solicitorIdVerificationPending ? (
                    <p className="mt-1 text-xs sm:text-sm opacity-90 break-words">
                      Missing {solicitorMissingIdDocs.length} document{solicitorMissingIdDocs.length === 1 ? '' : 's'}:
                      {' '}
                      {solicitorMissingIdDocs.map((id) => ID_VERIFICATION_DOC_LABELS[id] || id).join(', ')}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs sm:text-sm opacity-90">
                      All required ID documents are present for this matter.
                    </p>
                  )}
                </div>
              ) : null}


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
                  {showAutoFillControls ? (
                    <button
                      onClick={() => handleAutoFill()}
                      className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 active:from-purple-700 active:to-purple-800 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl shadow-md transition-all duration-300 font-medium min-h-[44px] touch-manipulation text-sm sm:text-base w-full sm:w-auto"
                      type="button"
                      title="Fill every section with fictional demo answers. ID document uploads are left empty for you to add real files."
                    >
                      <Zap size={18} className="sm:w-5 sm:h-5" />
                      <span className="whitespace-nowrap">Auto-Fill Form (Test Data)</span>
                    </button>
                  ) : null}
                </div>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-2 flex items-start gap-2 px-1 wrap-break-word">
                  <Info size={14} className="mt-0.5 flex-shrink-0" aria-hidden />
                  <span>
                    <strong>Tip:</strong> Use &quot;Clear Data / Start Fresh&quot; to remove all saved information.
                    {showAutoFillControls ? (
                      <> On staging or dev you can also use &quot;Auto-Fill Form&quot; for fictional test data.</>
                    ) : null}
                  </span>
                </p>
              </div>
            </section>
          </div>
        </div>
      </main>

          {signatureRequestModalOpen && (
            <div
              className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 px-4 animate-fadeIn"
              onClick={(e) => {
                if (e.target === e.currentTarget) closeSignatureRequestModal();
              }}
              role="dialog"
              aria-modal="true"
              aria-label="Send client signature request"
            >
              <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-600 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Send client signature request</h3>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      Opens an Outlook Web draft so you can send from your Microsoft account.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeSignatureRequestModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800"
                    aria-label="Close signature request modal"
                  >
                    <X size={18} />
                  </button>
                </div>

                <label className="mt-4 block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Client email</span>
                  <input
                    type="email"
                    value={signatureRequestEmail}
                    onChange={(e) => setSignatureRequestEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>

                <label className="mt-3 block text-sm">
                  <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">Signature link</span>
                  <input
                    type="text"
                    value={clientSignatureRequestUrl}
                    readOnly
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs sm:text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  />
                </label>

                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={openOutlookSignatureDraft}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    Open in Outlook (Microsoft 365)
                  </button>
                  <button
                    type="button"
                    onClick={() => { void copySignatureEmailDraft(); }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    Copy email draft
                  </button>
                  <button
                    type="button"
                    onClick={() => { void copyClientSignatureLink(); }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-violet-500/50 dark:bg-violet-500/10 dark:text-violet-100 dark:hover:bg-violet-500/20"
                  >
                    Copy signature link
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Validation Modal */}
          {(() => {
            DEBUG_LOGS&&debugLog('[VALIDATION MODAL] ========== MODAL RENDER CHECK ==========');
            DEBUG_LOGS&&debugLog('[VALIDATION MODAL] validationModalOpen:', validationModalOpen);
            DEBUG_LOGS&&debugLog('[VALIDATION MODAL] validationIssues.length:', validationIssues.length);
            DEBUG_LOGS&&debugLog('[VALIDATION MODAL] validationIssues:', validationIssues);
            return null;
          })()}
          {validationModalOpen && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 px-4 animate-fadeIn"
          onClick={(e) => {
            DEBUG_LOGS&&debugLog('[MODAL BACKDROP] ========== BACKDROP CLICKED ==========');
            DEBUG_LOGS&&debugLog('[MODAL BACKDROP] Event target:', e.target);
            DEBUG_LOGS&&debugLog('[MODAL BACKDROP] Event currentTarget:', e.currentTarget);
            DEBUG_LOGS&&debugLog('[MODAL BACKDROP] Target === CurrentTarget:', e.target === e.currentTarget);
            if (e.target === e.currentTarget) {
              DEBUG_LOGS&&debugLog('[MODAL BACKDROP] Closing modal (clicked backdrop)');
              setValidationModalOpen(false);
            } else {
              DEBUG_LOGS&&debugLog('[MODAL BACKDROP] Click was inside modal, not closing');
            }
          }}
          onMouseDown={(e) => {
            DEBUG_LOGS&&debugLog('[MODAL BACKDROP] ========== BACKDROP MOUSE DOWN ==========');
            DEBUG_LOGS&&debugLog('[MODAL BACKDROP] Event target:', e.target);
            DEBUG_LOGS&&debugLog('[MODAL BACKDROP] Event currentTarget:', e.currentTarget);
          }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col animate-slideIn"
            onClick={(e) => {
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] ========== MODAL CONTENT CLICKED ==========');
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Event target:', e.target);
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Event target tagName:', e.target.tagName);
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Event target className:', e.target.className);
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Event currentTarget:', e.currentTarget);
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Is button or inside button:', e.target.tagName === 'BUTTON' || e.target.closest('button') !== null);
              // Only stop propagation if clicking on the modal content itself, not on buttons inside
              if (e.target === e.currentTarget || (e.target.tagName !== 'BUTTON' && e.target.closest('button') === null)) {
                DEBUG_LOGS&&debugLog('[MODAL CONTENT] Stopping propagation (clicked on modal content, not button)');
                e.stopPropagation();
              } else {
                DEBUG_LOGS&&debugLog('[MODAL CONTENT] NOT stopping propagation (clicked on button)');
              }
            }}
            onMouseDown={(e) => {
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] ========== MODAL CONTENT MOUSE DOWN ==========');
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Event target:', e.target);
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Event target tagName:', e.target.tagName);
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Event currentTarget:', e.currentTarget);
              DEBUG_LOGS&&debugLog('[MODAL CONTENT] Is button or inside button:', e.target.tagName === 'BUTTON' || e.target.closest('button') !== null);
            }}
            ref={(el) => {
              if (el) {
                DEBUG_LOGS&&debugLog('[VALIDATION MODAL] ========== MODAL ELEMENT RENDERED ==========');
                DEBUG_LOGS&&debugLog('[VALIDATION MODAL] validationIssues.length:', validationIssues.length);
                DEBUG_LOGS&&debugLog('[VALIDATION MODAL] validationIssues:', validationIssues);
                DEBUG_LOGS&&debugLog('[VALIDATION MODAL] Button should render:', validationIssues.length > 0);
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
                    {validationIssues.some((issue) => issue.blockingAction === 'download_pdf')
                      ? 'Cannot download PDF yet'
                      : validationIssues.some((issue) => issue.fieldId)
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
                {validationIssues.some((issue) => issue.blockingAction === 'download_pdf')
                  ? 'Before downloading the PDF, please complete the following required fields:'
                  : validationIssues.some((issue) => issue.fieldId)
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
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] ========== ITEM BUTTON RENDERED ==========`);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Index: ${index}`);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Field ID: ${fieldId}`);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Element:`, el);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Element tagName:`, el.tagName);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Element className:`, el.className);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Element disabled:`, el.disabled);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Element tabIndex:`, el.tabIndex);
                          DEBUG_LOGS&&debugLog(`[ITEM RENDER] Has onClick:`, !!el.onclick);
                        }
                      }}
                      onMouseDown={(e) => {
                        DEBUG_LOGS&&debugLog('[ITEM MOUSEDOWN] ========== MOUSE DOWN ON ITEM ==========');
                        DEBUG_LOGS&&debugLog('[ITEM MOUSEDOWN] Event:', e);
                        DEBUG_LOGS&&debugLog('[ITEM MOUSEDOWN] Target:', e.target);
                        DEBUG_LOGS&&debugLog('[ITEM MOUSEDOWN] Current target:', e.currentTarget);
                        DEBUG_LOGS&&debugLog('[ITEM MOUSEDOWN] Issue index:', index);
                        DEBUG_LOGS&&debugLog('[ITEM MOUSEDOWN] Issue:', issue);
                      }}
                      onKeyDown={(e) => {
                        DEBUG_LOGS&&debugLog('[ITEM KEYDOWN] ========== KEY PRESSED ON ITEM ==========');
                        DEBUG_LOGS&&debugLog('[ITEM KEYDOWN] Key:', e.key);
                        DEBUG_LOGS&&debugLog('[ITEM KEYDOWN] Code:', e.code);
                        DEBUG_LOGS&&debugLog('[ITEM KEYDOWN] Issue index:', index);
                        if (e.key === 'Enter' || e.key === ' ') {
                          DEBUG_LOGS&&debugLog('[ITEM KEYDOWN] Enter/Space pressed - triggering click');
                          e.preventDefault();
                          e.currentTarget.click();
                        }
                      }}
                      onClick={(e) => {
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] ========== ITEM CLICKED ==========');
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event:', e);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event type:', e.type);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event target:', e.target);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event target tagName:', e.target.tagName);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event target className:', e.target.className);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event currentTarget:', e.currentTarget);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event defaultPrevented:', e.defaultPrevented);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event isTrusted:', e.isTrusted);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event bubbles:', e.bubbles);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event cancelable:', e.cancelable);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Event timeStamp:', e.timeStamp);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue index:', index);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue object:', issue);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue keys:', Object.keys(issue));
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue section:', issue.section);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue field:', issue.field);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue fieldId:', issue.fieldId);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue issue:', issue.issue);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue message:', issue.message);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Issue snippet:', issue.snippet);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Computed fieldId:', fieldId);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Computed fieldLabel:', fieldLabel);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Is schedule issue:', isScheduleIssue);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Button element:', e.currentTarget);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Button disabled:', e.currentTarget.disabled);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Button tabIndex:', e.currentTarget.tabIndex);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Button style.pointerEvents:', window.getComputedStyle(e.currentTarget).pointerEvents);
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Button style.zIndex:', window.getComputedStyle(e.currentTarget).zIndex);
                        
                        e.preventDefault();
                        e.stopPropagation();
                        DEBUG_LOGS&&debugLog('[ITEM CLICK] Prevented default and stopped propagation');
                        
                        try {
                          // Handle schedule issues with specific navigation - use sectionId first, then fallback to index
                          if (isScheduleIssue) {
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Schedule issue detected');
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Section ID:', issue.sectionId);
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Target section index:', issue.targetSectionIndex);
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Target field IDs:', issue.targetFieldIds);
                            
                            let targetIndex = -1;
                            
                            // PRIMARY: Use sectionId to find section (more reliable than index)
                            if (issue.sectionId) {
                              const sectionByField = formData.formSections.find(section => 
                                section.fields?.some(field => field.id === issue.sectionId)
                              );
                              if (sectionByField) {
                                targetIndex = formData.formSections.findIndex(s => s.formSection === sectionByField.formSection);
                                DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Found section by sectionId:', issue.sectionId, '→ index:', targetIndex);
                              }
                            }
                            
                            // FALLBACK: Use section name to find index
                            if (targetIndex < 0 && issue.section) {
                              targetIndex = formData.formSections.findIndex(s => s.formSection === issue.section);
                              if (targetIndex >= 0) {
                                DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Found section by section name:', issue.section, '→ index:', targetIndex);
                              }
                            }
                            
                            // FINAL FALLBACK: Use provided targetSectionIndex (least reliable)
                            if (targetIndex < 0 && issue.targetSectionIndex !== undefined && issue.targetSectionIndex >= 0) {
                              if (issue.targetSectionIndex < formData.formSections.length) {
                                targetIndex = issue.targetSectionIndex;
                                DEBUG_LOGS&&debugLog('[ITEM CLICK] ⚠️ Using provided targetSectionIndex as fallback:', targetIndex);
                              }
                            }
                            
                            if (targetIndex < 0 || targetIndex >= formData.formSections.length) {
                              console.error('[ITEM CLICK] ❌ Could not determine valid section index');
                              return;
                            }
                            
                            // Navigate to the correct section first
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Setting current index to:', targetIndex);
                            setCurrentIndex(targetIndex);
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Closing validation modal');
                            setValidationModalOpen(false);
                            
                            // Wait for section to render, then scroll to first missing field
                            setTimeout(() => {
                              DEBUG_LOGS&&debugLog('[ITEM CLICK] Timeout fired, attempting to scroll to field');
                              if (issue.targetFieldIds && issue.targetFieldIds.length > 0) {
                                const firstFieldId = issue.targetFieldIds[0];
                                DEBUG_LOGS&&debugLog('[ITEM CLICK] Scrolling to first missing field:', firstFieldId);
                                scrollToField(firstFieldId);
                              } else if (issue.fieldId) {
                                DEBUG_LOGS&&debugLog('[ITEM CLICK] Scrolling to fieldId:', issue.fieldId);
                                scrollToField(issue.fieldId);
                              } else {
                                DEBUG_LOGS&&debugLog('[ITEM CLICK] No target field IDs, scrolling to top');
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }
                            }, 300);
                            return;
                          }
                          
                          if (issue.fieldId && !isScheduleIssue) {
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Has fieldId, calling scrollToField with:', issue.fieldId);
                            scrollToField(issue.fieldId);
                          } else if (isScheduleIssue || issue.section === 'Schedules' || (issue.field && issue.field.toLowerCase().includes('schedule'))) {
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Detected as schedule field');
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Section check:', issue.section === 'Schedules');
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Field includes schedule:', issue.field && issue.field.toLowerCase().includes('schedule'));
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Calling scrollToScheduleField with:', issue.field);
                            // Handle schedule fields specially
                            scrollToScheduleField(issue.field);
                          } else {
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Not a schedule, trying regular field search for:', issue.field);
                            // For other PDF issues, try to find and scroll to the field
                            const fieldElement = document.querySelector(`[data-field-id="${issue.field}"]`);
                            DEBUG_LOGS&&debugLog('[ITEM CLICK] Direct querySelector result:', fieldElement);
                            if (fieldElement) {
                              DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Found field element, scrolling...');
                              fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              fieldElement.focus();
                              setValidationModalOpen(false);
                            } else {
                              DEBUG_LOGS&&debugLog('[ITEM CLICK] Direct search failed, trying case-insensitive search...');
                              // Try case-insensitive search
                              const allFields = document.querySelectorAll('[data-field-id]');
                              DEBUG_LOGS&&debugLog('[ITEM CLICK] Total fields with data-field-id:', allFields.length);
                              const foundField = Array.from(allFields).find(field => {
                                const fieldId = field.getAttribute('data-field-id') || '';
                                return fieldId.toLowerCase() === issue.field.toLowerCase() || 
                                       fieldId.toLowerCase().includes(issue.field.toLowerCase());
                              });
                              DEBUG_LOGS&&debugLog('[ITEM CLICK] Case-insensitive search result:', foundField);
                              if (foundField) {
                                DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Found field via case-insensitive search, scrolling...');
                                foundField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                const input = foundField.querySelector('input, textarea, select');
                                if (input) {
                                  setTimeout(() => input.focus(), 500);
                                }
                                setValidationModalOpen(false);
                              } else {
                                const labelMatchId = findFieldIdByLabel(issue.field || issue.fieldLabel || fieldLabel);
                                if (labelMatchId) {
                                  DEBUG_LOGS&&debugLog('[ITEM CLICK] ✅ Found field by label mapping:', labelMatchId);
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
              {DEBUG_LOGS&&debugLog('[VALIDATION MODAL FOOTER] Rendering footer, validationIssues.length:', validationIssues.length, 'validationIssues:', validationIssues) || null}
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
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] ========== MOUSE DOWN ==========');
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event:', e);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event type:', e.type);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event target:', e.target);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event target tagName:', e.target.tagName);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event target className:', e.target.className);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event currentTarget:', e.currentTarget);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event defaultPrevented:', e.defaultPrevented);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event isTrusted:', e.isTrusted);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Event bubbles:', e.bubbles);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Button element:', e.currentTarget);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Button disabled:', e.currentTarget.disabled);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE MOUSEDOWN] Button tabIndex:', e.currentTarget.tabIndex);
                  }}
                  onKeyDown={(e) => {
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] ========== KEY PRESSED ==========');
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Key:', e.key);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Code:', e.code);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Event type:', e.type);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Event target:', e.target);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Event currentTarget:', e.currentTarget);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Event defaultPrevented:', e.defaultPrevented);
                    if (e.key === 'Enter' || e.key === ' ') {
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Enter/Space pressed - triggering click');
                      e.preventDefault();
                      e.stopPropagation();
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE KEYDOWN] Calling click() on button element');
                      e.currentTarget.click();
                    }
                  }}
                  onFocus={(e) => {
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE FOCUS] ========== BUTTON FOCUSED ==========');
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE FOCUS] Event:', e);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE FOCUS] Event target:', e.target);
                  }}
                  onBlur={(e) => {
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE BLUR] ========== BUTTON BLURRED ==========');
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE BLUR] Event:', e);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE BLUR] Event target:', e.target);
                  }}
                  onClick={(e) => {
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ========== BUTTON CLICKED ==========');
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event:', e);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event type:', e.type);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event target:', e.target);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event currentTarget:', e.currentTarget);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event defaultPrevented:', e.defaultPrevented);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event isTrusted:', e.isTrusted);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event bubbles:', e.bubbles);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Event cancelable:', e.cancelable);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Validation issues exists:', !!validationIssues);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Validation issues type:', typeof validationIssues);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Validation issues is array:', Array.isArray(validationIssues));
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Validation issues count:', validationIssues?.length);
                    DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue exists:', !!validationIssues?.[0]);
                    
                    if (validationIssues?.[0]) {
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue object:', validationIssues[0]);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue keys:', Object.keys(validationIssues[0]));
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue section:', validationIssues[0].section);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue field:', validationIssues[0].field);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue fieldId:', validationIssues[0].fieldId);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue issue:', validationIssues[0].issue);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] First issue message:', validationIssues[0].message);
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
                      
                      debugLog('[GO TO FIRST ISSUE] 🔍 ========== BUTTON CLICKED ==========');
                      debugLog('[GO TO FIRST ISSUE] 🔍 Validation issues count:', validationIssues?.length);
                      debugLog('[GO TO FIRST ISSUE] 🔍 Validation issues:', validationIssues);
                      
                      const firstIssue = validationIssues[0];
                      debugLog('[GO TO FIRST ISSUE] 🔍 First issue object:', firstIssue);
                      debugLog('[GO TO FIRST ISSUE] 🔍 First issue keys:', firstIssue ? Object.keys(firstIssue) : 'N/A');
                      debugLog('[GO TO FIRST ISSUE] 🔍 First issue details:', {
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
                          debugLog('[GO TO FIRST ISSUE] ✅ Early check: Separate trustee issue with missing data');
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
                            debugLog('[GO TO FIRST ISSUE] Found section containing separate trustee fields:', containingSection.formSection);
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
                          debugLog('[GO TO FIRST ISSUE] ✅ Early check: Pet carer issue with missing data');
                          // Search recursively through fields and subFields to find the section containing addPetCarerButton or provisionsForPets
                          let containingSection = null;
                          let containingSectionIndex = -1;
                          
                          for (let i = 0; i < formData.formSections.length; i++) {
                            const section = formData.formSections[i];
                            const hasField = section.fields?.some(f => {
                              if (f.id === 'addPetCarerButton' || f.id === 'provisionsForPets' || f.id === 'otherProvisionsGuided') {
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
                            debugLog('[GO TO FIRST ISSUE] Found section containing pet carer fields:', containingSection.formSection);
                            setCurrentIndex(containingSectionIndex);
                            setValidationModalOpen(false);
                            toast.info('Please add a pet carer in Other Provisions.', { duration: 5000 });
                            // Wait longer for section to render, then scroll
                            setTimeout(() => scrollToField('otherProvisionsGuided', ['addPetCarerButton']), 800);
                            return;
                          } else {
                            console.warn('[GO TO FIRST ISSUE] Could not find section containing addPetCarerButton');
                          }
                        }
                      }
                      
                      // PRIORITY 1: Use fieldId if available (most reliable) - check this FIRST
                      // This handles Property Trust and BPR Trust schedule issues that have fieldId
                      debugLog('[GO TO FIRST ISSUE] 🔍 Checking PRIORITY 1: fieldId =', firstIssue.fieldId);
                      if (firstIssue.fieldId) {
                        debugLog('[GO TO FIRST ISSUE] ✅ PRIORITY 1: Has fieldId, navigating to field:', firstIssue.fieldId);
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Issue details:', {
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
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Navigating to section index:', firstIssue.targetSectionIndex);
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Target section name:', targetSection?.formSection);
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Current section index:', currentIndex);
                          setCurrentIndex(firstIssue.targetSectionIndex);
                          setValidationModalOpen(false);
                          // Wait for section to render, then scroll to field
                          setTimeout(() => {
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Section navigation complete, scrolling to field:', firstIssue.fieldId);
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
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Found section by name/id, navigating to index:', sectionIndex);
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Target section name:', targetSection?.formSection);
                            setCurrentIndex(sectionIndex);
                            setValidationModalOpen(false);
                            setTimeout(() => {
                              DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Section navigation complete, scrolling to field:', firstIssue.fieldId);
                              scrollToField(firstIssue.fieldId, firstIssue.targetFieldIds);
                            }, 300);
                          } else {
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Section not found, trying direct field search');
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Searched for section:', firstIssue.section, 'or sectionId:', firstIssue.sectionId);
                            setValidationModalOpen(false);
                            scrollToField(firstIssue.fieldId, firstIssue.targetFieldIds);
                          }
                        }
                        return;
                      }
                      
                      // PRIORITY 2: Handle schedule issues without fieldId (fallback)
                      const isScheduleIssue = firstIssue.scheduleNumber || 
                        (firstIssue.section && (firstIssue.section.toLowerCase().includes('schedule') || firstIssue.section === 'Schedules'));
                      
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] PRIORITY 2: Is schedule issue:', isScheduleIssue);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Target section index:', firstIssue.targetSectionIndex);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Target field IDs:', firstIssue.targetFieldIds);
                      
                      if (isScheduleIssue && firstIssue.targetSectionIndex !== undefined && firstIssue.targetSectionIndex >= 0) {
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Schedule issue detected, navigating to section index:', firstIssue.targetSectionIndex);
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Total sections available:', formData.formSections.length);
                        
                        if (firstIssue.targetSectionIndex < 0 || firstIssue.targetSectionIndex >= formData.formSections.length) {
                          console.error('[GO TO FIRST ISSUE] ❌ Invalid section index:', firstIssue.targetSectionIndex);
                          return;
                        }
                        
                        // Navigate to the correct section first
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Setting current index to:', firstIssue.targetSectionIndex);
                        setCurrentIndex(firstIssue.targetSectionIndex);
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Closing validation modal');
                        setValidationModalOpen(false);
                        
                        // Wait for section to render, then scroll to first missing field
                        setTimeout(() => {
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Timeout fired, attempting to scroll');
                          if (firstIssue.targetFieldIds && firstIssue.targetFieldIds.length > 0) {
                            const firstFieldId = firstIssue.targetFieldIds[0];
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Scrolling to first missing field:', firstFieldId);
                            scrollToField(firstFieldId);
                          } else {
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] No target field IDs, scrolling to top');
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }
                        }, 300);
                        return;
                      }
                      
                      // PRIORITY 3: Handle schedule issues without fieldId (fallback for generic schedule issues)
                      if (isScheduleIssue || firstIssue.section === 'Schedules') {
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Schedule issue detected, checking for Property Trust/BPR Trust by schedule number...');
                        
                        // Extract schedule number from the issue
                        const scheduleNumber = firstIssue.scheduleNumber || 
                          (firstIssue.field ? firstIssue.field.match(/Schedule\s+(\d+)/i)?.[1] : null);
                        
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Extracted schedule number:', scheduleNumber);
                        
                        // Check if this schedule number matches Property Trust or BPR Trust
                        const propertyTrustScheduleNum = formValues.propertyTrustScheduleNumber ? 
                          String(formValues.propertyTrustScheduleNumber).trim() : '';
                        const bprTrustScheduleNum = formValues.bprTrustScheduleNumber ? 
                          String(formValues.bprTrustScheduleNumber).trim() : '';
                        
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Property Trust schedule number:', propertyTrustScheduleNum);
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] BPR Trust schedule number:', bprTrustScheduleNum);
                        
                        let targetSection = null;
                        let targetFieldIds = [];
                        
                        if (scheduleNumber && propertyTrustScheduleNum === scheduleNumber) {
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Matched Property Trust schedule by number');
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
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Matched BPR Trust schedule by number');
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
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Found matching section:', targetSection, 'with fields:', targetFieldIds);
                          const sectionIndex = formData.formSections.findIndex(s => 
                            s.formSection === targetSection
                          );
                          if (sectionIndex >= 0) {
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Navigating to section:', targetSection, 'at index:', sectionIndex);
                            setCurrentIndex(sectionIndex);
                            setValidationModalOpen(false);
                            setTimeout(() => {
                              DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Searching for fields:', targetFieldIds);
                              for (const fieldId of targetFieldIds) {
                                const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
                                if (fieldElement) {
                                  DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Found field:', fieldId);
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
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Generic schedule issue, calling scrollToScheduleField');
                        scrollToScheduleField(firstIssue.field || `Schedule ${firstIssue.scheduleNumber || ''}`);
                      } else if (firstIssue.field) {
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Has field (not schedule), searching for:', firstIssue.field);
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Issue details:', {
                          section: firstIssue.section,
                          field: firstIssue.field,
                          clauseNumber: firstIssue.clauseNumber,
                          fieldLabel: firstIssue.fieldLabel
                        });
                        
                        // Strategy 1: Try direct field ID match (if field is actually an ID)
                        debugLog('[GO TO FIRST ISSUE] 🔍 Strategy 1: Trying direct field ID match:', {
                          fieldId: firstIssue.field,
                          selector: `[data-field-id="${firstIssue.field}"]`
                        });
                        let fieldElement = document.querySelector(`[data-field-id="${firstIssue.field}"]`);
                        debugLog('[GO TO FIRST ISSUE] 🔍 Strategy 1 result:', {
                          fieldElement: !!fieldElement,
                          found: !!fieldElement
                        });
                        if (fieldElement) {
                          debugLog('[GO TO FIRST ISSUE] ✅ Found field element via direct ID, scrolling...');
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
                        debugLog('[GO TO FIRST ISSUE] 🔍 Strategy 2: Searching for field by label:', {
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
                        
                        debugLog('[GO TO FIRST ISSUE] 🔍 Extracted field label:', {
                          original: firstIssue.field || firstIssue.fieldLabel,
                          extracted: fieldLabelOriginal,
                          fieldId: firstIssue.fieldId,
                          section: firstIssue.section
                        });
                        
                        // PRIORITY 1: Check if this is explicitly a separate trustee field by ID
                        if (firstIssue.fieldId === 'appointSeparateTrusteesFLIT' || 
                            firstIssue.fieldId === 'separateTrusteesSection') {
                          labelMatchId = 'appointSeparateTrusteesFLIT';
                          debugLog('[GO TO FIRST ISSUE] ✅ Matched by fieldId:', firstIssue.fieldId);
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
                            debugLog('[GO TO FIRST ISSUE] ✅ Matched by section + field text:', {
                              section: firstIssue.section,
                              field: fieldLabelOriginal
                            });
                          }
                        }
                        // PRIORITY 3: Direct exact match for "Do you wish to appoint separate Trustees?"
                        else if (fieldLabelOriginal === 'Do you wish to appoint separate Trustees?' || 
                                 fieldLabelLower === 'do you wish to appoint separate trustees?') {
                          labelMatchId = 'appointSeparateTrusteesFLIT';
                          debugLog('[GO TO FIRST ISSUE] ✅ Matched by exact label:', fieldLabelOriginal);
                        }
                        // PRIORITY 3b: Check field text patterns (exclude digital executor fields)
                        else if (!fieldLabelLower.includes('digital') && 
                                 ((fieldLabelLower.includes('separate') && fieldLabelLower.includes('trustee')) ||
                                  (fieldLabelLower.includes('separate') && fieldLabelLower.includes('trustees')) ||
                                  (fieldLabelLower.includes('appoint') && fieldLabelLower.includes('separate') && fieldLabelLower.includes('trustee')) ||
                                  (fieldLabelLower.includes('wish') && fieldLabelLower.includes('appoint') && fieldLabelLower.includes('separate')))) {
                          labelMatchId = 'appointSeparateTrusteesFLIT';
                          debugLog('[GO TO FIRST ISSUE] ✅ Matched by field text pattern:', fieldLabelOriginal);
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
                            debugLog('[GO TO FIRST ISSUE] ⚠️ Detected as guardian field, skipping separate trustee search');
                          } else if (isSearchingForSeparateTrustees && (isDigitalExecutorField || isBusinessTrusteeField)) {
                            debugLog('[GO TO FIRST ISSUE] ⚠️ Detected as digital executor or business trustee field, skipping separate trustee search');
                            // For separate trustees, directly map to appointSeparateTrusteesFLIT
                            labelMatchId = 'appointSeparateTrusteesFLIT';
                            debugLog('[GO TO FIRST ISSUE] ✅ Directly mapped to appointSeparateTrusteesFLIT (excluded digital executor/business trustee)');
                          } else {
                            labelMatchId = findFieldIdByLabel(fieldLabelOriginal);
                            debugLog('[GO TO FIRST ISSUE] 🔍 Tried findFieldIdByLabel, result:', labelMatchId);
                            
                            // CRITICAL FIX: If findFieldIdByLabel returned a digital executor, business trustee, or separateTrusteesSection field but we're looking for FLIT trustees, override it
                            if (isSearchingForSeparateTrustees && (
                              labelMatchId === 'digitalAssetsWhoManages' ||
                              labelMatchId === 'appointSeparateBusinessTrustee' ||
                              labelMatchId === 'separateTrusteesSection'
                            )) {
                              debugLog('[GO TO FIRST ISSUE] ⚠️ findFieldIdByLabel returned wrong field (' + labelMatchId + '), overriding to appointSeparateTrusteesFLIT');
                              labelMatchId = 'appointSeparateTrusteesFLIT';
                            }
                          }
                        }
                        
                        debugLog('[GO TO FIRST ISSUE] 🔍 Strategy 2 result:', {
                          labelMatchId,
                          found: !!labelMatchId,
                          searchString: firstIssue.field || firstIssue.fieldLabel
                        });
                        if (labelMatchId) {
                          debugLog('[GO TO FIRST ISSUE] ✅ Found field by label mapping:', labelMatchId);
                          
                          // CRITICAL FIX: Handle conditionally rendered fields (like appointSeparateTrusteesFLIT)
                          if (labelMatchId === 'appointSeparateTrusteesFLIT') {
                            debugLog('[GO TO FIRST ISSUE] 🎯 Handling separate trustees field navigation');
                            
                            // Check if field conditions are met (field requires howResidueDistributed === 'IntoFLIT')
                            const fieldDef = formData.formSections
                              .flatMap(s => s.fields || [])
                              .find(f => f.id === labelMatchId);
                            
                            const needsFLITCondition = fieldDef?.conditions?.some(c => 
                              c.field === 'howResidueDistributed' && c.value === 'IntoFLIT'
                            );
                            const hasFLITCondition = formValues.howResidueDistributed === 'IntoFLIT';
                            
                            debugLog('[GO TO FIRST ISSUE] Field condition check:', {
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
                                debugLog('[GO TO FIRST ISSUE] ✅ Found section by issue.section:', targetSection.formSection);
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
                                debugLog('[GO TO FIRST ISSUE] ✅ Found section by field search:', targetSection.formSection);
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
                                debugLog('[GO TO FIRST ISSUE] ✅ Found section by name search:', targetSection.formSection);
                              }
                            }
                            
                            if (targetSection && targetSectionIndex >= 0) {
                              debugLog('[GO TO FIRST ISSUE] 🚀 Navigating to section:', targetSection.formSection, 'at index:', targetSectionIndex);
                              
                              // CRITICAL: Ensure FLIT condition is met BEFORE navigating
                              if (needsFLITCondition && !hasFLITCondition) {
                                debugLog('[GO TO FIRST ISSUE] ⚠️ FLIT condition not met, setting howResidueDistributed to "IntoFLIT"');
                                setFormValues(prev => ({ ...prev, howResidueDistributed: 'IntoFLIT' }));
                                // Wait for condition evaluation, then navigate and scroll
                                setTimeout(() => {
                                  setCurrentIndex(targetSectionIndex);
                                  setValidationModalOpen(false);
                                  // Use longer timeout to ensure field is rendered after condition evaluation
                                  setTimeout(() => {
                                    debugLog('[GO TO FIRST ISSUE] 🔍 Attempting to scroll to field after condition set:', labelMatchId);
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
                                debugLog('[GO TO FIRST ISSUE] 🔍 Attempting to scroll to field:', labelMatchId);
                                // Try multiple times with increasing delays to account for conditional rendering
                                const tryScroll = (attempt = 0) => {
                                  const fieldElement = document.querySelector(`[data-field-id="${labelMatchId}"]`);
                                  if (fieldElement) {
                                    debugLog('[GO TO FIRST ISSUE] ✅ Found field element, scrolling');
                                    fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    const input = fieldElement.querySelector('input, textarea, select, button');
                                    if (input) {
                                      setTimeout(() => input.focus(), 300);
                                    }
                                    fieldElement.classList.add('animate-pulse');
                                    setTimeout(() => fieldElement.classList.remove('animate-pulse'), 2000);
                                  } else if (attempt < 3) {
                                    debugLog(`[GO TO FIRST ISSUE] ⏳ Field not found, retrying in ${(attempt + 1) * 500}ms (attempt ${attempt + 1}/3)`);
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
                              debugLog('[GO TO FIRST ISSUE] ✅ User selected "Yes" for pet provisions but no pet carer data - scrolling to Add button');
                              
                              // Find the section containing guided or legacy pet carer fields
                              const containingSection = formData.formSections.find(section =>
                                section.fields?.some(
                                  (f) =>
                                    f.id === 'provisionsForPets' ||
                                    f.id === 'addPetCarerButton' ||
                                    f.id === 'otherProvisionsGuided'
                                )
                              );
                              
                              if (containingSection) {
                                const sectionIndex = formData.formSections.findIndex(s => 
                                  s.formSection === containingSection.formSection
                                );
                                if (sectionIndex >= 0) {
                                  debugLog('[GO TO FIRST ISSUE] Navigating to section:', containingSection.formSection);
                                  setCurrentIndex(sectionIndex);
                                  setValidationModalOpen(false);
                                  
                                  // Show helpful message
                                  toast.info('Please add a pet carer in Other Provisions.', { duration: 5000 });
                                  
                                  // Wait for section to render, then scroll to guided block
                                  setTimeout(() => {
                                    scrollToField('otherProvisionsGuided', ['addPetCarerButton']);
                                  }, 500);
                                  return;
                                }
                              }
                            }
                          }
                          
                          // SPECIAL HANDLING for foreignWillNotRevoked: Find its section and navigate to it first
                          if (labelMatchId === 'foreignWillNotRevoked') {
                            debugLog('[GO TO FIRST ISSUE] 🔍 SPECIAL HANDLING: foreignWillNotRevoked detected');
                            
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
                                debugLog('[GO TO FIRST ISSUE] ✅ Found foreignWillNotRevoked in section:', {
                                  index: i,
                                  sectionName: section.formSection
                                });
                                break;
                              }
                            }
                            
                            // Ensure assetsAbroad is set to "Yes" to meet the condition
                            if (formValues.assetsAbroad !== 'Yes') {
                              debugLog('[GO TO FIRST ISSUE] ⚠️ assetsAbroad is not "Yes", setting it to meet condition');
                              setFormValues(prev => ({ ...prev, assetsAbroad: 'Yes' }));
                            }
                            
                            // Navigate to the section first
                            if (targetSectionIndex >= 0) {
                              debugLog('[GO TO FIRST ISSUE] 🔍 Navigating to section index:', targetSectionIndex);
                              setCurrentIndex(targetSectionIndex);
                              setValidationModalOpen(false);
                              // Wait for section to render and condition to be evaluated
                              setTimeout(() => {
                                debugLog('[GO TO FIRST ISSUE] 🔍 Section rendered, scrolling to field');
                                scrollToField(labelMatchId);
                              }, 500); // Longer timeout to ensure condition evaluation completes
                              return;
                            } else {
                              console.error('[GO TO FIRST ISSUE] ❌ Could not find section containing foreignWillNotRevoked');
                            }
                          }
                          
                          debugLog('[GO TO FIRST ISSUE] 🔍 Calling scrollToField with:', labelMatchId);
                          scrollToField(labelMatchId);
                          setValidationModalOpen(false);
                          return;
                        }
                        console.error('[GO TO FIRST ISSUE] ❌ Strategy 2 failed - labelMatchId is null/undefined');
                        console.error('[GO TO FIRST ISSUE] ❌ findFieldIdByLabel returned null for:', firstIssue.field || firstIssue.fieldLabel);
                        
                        // Strategy 3: Try to find field by section + partial label match
                        if (firstIssue.section) {
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Trying section-based search for:', firstIssue.section);
                          const section = formData.formSections.find(s => 
                            s.formSection === firstIssue.section || 
                            s.formSection?.toLowerCase() === firstIssue.section?.toLowerCase()
                          );
                          if (section) {
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Found section, searching fields...');
                            // Try to find field by matching label substring
                            const fieldLabelLower = (firstIssue.field || '').toLowerCase();
                            for (const field of section.fields || []) {
                              if (field.label && field.label.toLowerCase().includes(fieldLabelLower.substring(0, 30))) {
                                DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Found matching field by label substring:', field.id);
                                scrollToField(field.id);
                                setValidationModalOpen(false);
                                return;
                              }
                            }
                          }
                        }
                        
                        // Strategy 4: Case-insensitive search on all fields
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Trying case-insensitive search...');
                        const allFields = document.querySelectorAll('[data-field-id]');
                        DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Total fields with data-field-id:', allFields.length);
                        const foundField = Array.from(allFields).find(field => {
                          const fieldId = field.getAttribute('data-field-id') || '';
                          return fieldId.toLowerCase() === firstIssue.field.toLowerCase() || 
                                 fieldId.toLowerCase().includes(firstIssue.field.toLowerCase());
                        });
                        if (foundField) {
                          DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] ✅ Found field via case-insensitive search, scrolling...');
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
                            DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE] Navigating to section index:', sectionIndex);
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
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] ========== BUTTON ELEMENT RENDERED ==========');
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Element:', el);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Element tagName:', el.tagName);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Element className:', el.className);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Element disabled:', el.disabled);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Element tabIndex:', el.tabIndex);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Has onClick:', !!el.onclick);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Validation issues count:', validationIssues.length);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Element style.pointerEvents:', window.getComputedStyle(el).pointerEvents);
                      DEBUG_LOGS&&debugLog('[GO TO FIRST ISSUE RENDER] Element style.zIndex:', window.getComputedStyle(el).zIndex);
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

      {isSubmittingMatter && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm dark:bg-slate-950/60">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:ring-slate-600">
            <div className="flex items-start gap-4">
              <div className="mt-1 h-10 w-10 flex-shrink-0 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin dark:border-indigo-900 dark:border-t-indigo-400" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {submittedMatterId ? 'Saving your latest changes' : 'Submitting your questionnaire'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {hasUploadedIdDocuments
                    ? 'We are processing your uploaded ID documents as well. On slower mobile connections this can take up to 90 seconds.'
                    : 'Please keep this page open while your answers are saved securely.'}
                </p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                  {hasUploadedIdDocuments ? `${uploadedIdDocumentCount} ID document${uploadedIdDocumentCount === 1 ? '' : 's'} included` : 'No ID documents attached yet'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <ClientSubmitReviewModal
        open={submitReviewModalOpen && !solicitorMode}
        formValues={formValues}
        onCancel={() => setSubmitReviewModalOpen(false)}
        onConfirm={proceedAfterSubmitReview}
        submitting={isSubmittingMatter}
      />

      {/* ID verification incomplete – prompt to upload or submit anyway */}
      {idVerificationIncompleteModalOpen && !solicitorMode && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/45 backdrop-blur-sm px-4 dark:bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="id-incomplete-modal-title"
        >
          <div className="max-w-md w-full rounded-2xl border border-amber-300 bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:border-amber-500/40 dark:bg-slate-900 dark:ring-slate-600" onClick={(e) => e.stopPropagation()}>
            <h2 id="id-incomplete-modal-title" className="mb-2 text-xl font-bold text-slate-900 dark:text-slate-100">ID verification incomplete</h2>
            <p className="mb-4 text-sm text-slate-700 dark:text-slate-300">
              You haven&apos;t uploaded all ID documents. Your application will be marked as <strong>Partially complete – ID verification outstanding</strong>. You can submit now or add documents first.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setIdVerificationIncompleteModalOpen(false);
                  const el = document.getElementById('identity-verification-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Add documents
              </button>
              <button
                type="button"
                onClick={() => {
                  setSubmittedWithIncompleteId(true);
                  setIdVerificationIncompleteModalOpen(false);
                  void finishSubmission();
                }}
                className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Modal - Shows what happens next */}
      {submitted && (
        <div 
          className="fixed inset-0 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm z-50 px-4 animate-fadeIn dark:bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="completion-modal-title"
        >
          <div 
            className="completion-modal flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200 animate-slideIn dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600"
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
                  <p className="text-sm text-emerald-100 mt-1">
                    {submittedWithIncompleteId ? 'Partially complete – ID verification outstanding' : "You've completed the entire questionnaire"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => (!solicitorMode ? closeCompletionModalAsClient() : setSubmitted(false))}
                className="rounded-xl border border-white/30 bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/60"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>

            {/* Content - #7 different for client (intake only) vs solicitor (full flow) */}
            <div className="completion-modal-body flex-1 overflow-y-auto bg-slate-50 p-6 dark:bg-slate-800/40">
              <div className="mb-6">
                <h3 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">What happens next?</h3>
                  {!solicitorMode && submittedMatterId ? (
                    <div className={`mb-4 rounded-xl border px-4 py-3 ${submittedWithIncompleteId ? 'border-amber-500/50 bg-amber-950/40' : 'border-emerald-500/40 bg-emerald-950/35'}`}>
                      <p className="text-sm font-medium text-emerald-200">Matter submitted successfully.</p>
                      <p className="mt-1 text-sm text-emerald-100/90">Your questionnaire is now stored for solicitor review under secure reference <strong>{referenceNumber}</strong>.</p>
                      {submittedWithIncompleteId && (
                        <p className="mt-2 text-sm font-medium text-amber-200">This application is marked as <strong>Partially complete – ID verification outstanding</strong>. You can upload ID documents below and click Update submission to attach them.</p>
                      )}
                    </div>
                  ) : null}
                {solicitorMode ? (
                <div className="space-y-3 text-slate-700 dark:text-slate-300">
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow">1</div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Download Execution PDF (for file)</p>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Full execution copy with witnesses for your records.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow">2</div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Download Client copy (intake-only)</p>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Intake-only PDF for sending to client before appointment.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-bold text-white shadow">3</div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Review with client</p>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Client reviews before signing. Final execution follows your firm process (remote or in person, with witnesses where required).</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-600 text-sm font-bold text-white shadow">4</div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">File and store</p>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Keep signed Will on file and inform Executors.</p>
                    </div>
                  </div>
                </div>
                ) : (
                <div className="space-y-3 text-slate-700 dark:text-slate-300">
                  <p className="mb-3 font-medium text-amber-800 dark:text-amber-200/95">Questionnaire complete — this is intake only. Legal signing happens in person later.</p>
                  <button
                    type="button"
                    onClick={returnToIdentityUploads}
                    className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-indigo-500/60 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800/90 dark:hover:bg-slate-800"
                  >
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-sm font-bold text-white shadow">1</div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-semibold text-slate-900 group-hover:text-indigo-700 dark:text-slate-100 dark:group-hover:text-indigo-200">ID documents</p>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Complete or update uploads on the step behind this message, then use Update submission if the solicitor should receive new images.</p>
                      <p className="mt-2 text-xs font-medium text-indigo-700 dark:text-indigo-300">Click to return to Identity verification uploads</p>
                    </div>
                  </button>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white shadow">2</div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Solicitor review</p>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Once your intake and ID are in, the solicitor reviews everything and follows up if anything is missing.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-800/90">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-600 text-sm font-bold text-white shadow">3</div>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Signing</p>
                      <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">Your solicitor will confirm the final signing process (remote or in person), including witness requirements.</p>
                    </div>
                  </div>
                </div>
                )}
              </div>

              <div className="completion-modal-info rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-600/40 dark:bg-blue-950/50">
                <div className="flex items-start gap-3">
                  <Info size={20} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <div>
                    <p className="mb-1 text-sm font-semibold text-blue-900 dark:text-blue-100">Close to return to your submitted form</p>
                    <p className="text-sm leading-relaxed text-blue-700 dark:text-blue-200/90">
                      {solicitorMode
                        ? 'Close this message to return to the form.'
                        : 'You are still on the Identity verification step. Close to return to the form, add or change ID if needed, then use Update submission when ready.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer - Client mode: no downloads. Solicitor mode: Execution + Client copy */}
            <div className="completion-modal-footer flex flex-col gap-3 border-t border-slate-200 bg-white px-6 py-5 dark:border-slate-600 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => (!solicitorMode ? closeCompletionModalAsClient() : setSubmitted(false))}
                className="order-2 inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 sm:order-1"
              >
                Close
              </button>
              {solicitorMode ? (
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
              ) : (
              <div className="flex w-full flex-col gap-2 order-1 sm:order-2 sm:w-auto sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={returnToIdentityUploads}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-5 py-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-indigo-500/60 dark:bg-indigo-600/20 dark:text-indigo-100 dark:hover:bg-indigo-600/30"
                >
                  Upload ID documents
                </button>
                <button
                  type="button"
                  onClick={handleBookAppointment}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold focus:outline-none focus:ring-2 ${
                    activeAppointment && activeAppointment.start
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 focus:ring-indigo-500 dark:border-indigo-500/60 dark:bg-indigo-600/20 dark:text-indigo-100 dark:hover:bg-indigo-600/30'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus:ring-emerald-500 dark:border-emerald-500/60 dark:bg-emerald-600/20 dark:text-emerald-100 dark:hover:bg-emerald-600/30'
                  }`}
                  title={
                    activeAppointment?.start
                      ? `Booked for ${formatSlotLabel(new Date(activeAppointment.start))}. Click to change or cancel.`
                      : 'Click to book your signing appointment'
                  }
                >
                  {appointmentLoading
                    ? 'Loading appointment…'
                    : activeAppointment?.start
                      ? `Change or cancel · ${formatSlotLabel(new Date(activeAppointment.start))}`
                      : 'Book appointment'}
                </button>
                <button
                  type="button"
                  onClick={startOverAfterSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  Start new questionnaire
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
          className="fixed inset-0 flex items-center justify-center bg-slate-900/45 backdrop-blur-sm z-50 px-4 animate-fadeIn dark:bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-confirm-title"
        >
          <div 
            className="max-w-md w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-slate-200 animate-slideIn dark:border-slate-600 dark:bg-slate-900 dark:ring-slate-600"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 rounded-xl bg-amber-900/50 p-3 ring-1 ring-amber-600/40">
                  <AlertTriangle size={28} className="text-amber-400" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="clear-confirm-title" className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">Clear all data?</h2>
                  <p className="leading-relaxed text-slate-600 dark:text-slate-400">
                    Are you sure you want to clear all saved data and start fresh? This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setClearConfirmOpen(false)}
                  className="flex-1 rounded-xl border border-slate-500 bg-slate-800 px-4 py-3 font-medium text-slate-100 transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmReset}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  Clear Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BookAppointmentModal
        open={showBookAppointment}
        onClose={closeBookAppointmentModal}
        referenceNumber={referenceNumber}
        sessionSecret={sessionSecret}
        clientName={formValues?.fullName || ''}
        clientEmail={formValues?.email || ''}
        matterId={submittedMatterId}
        onAppointmentChange={refreshActiveAppointment}
      />
    </div>
  );
}
