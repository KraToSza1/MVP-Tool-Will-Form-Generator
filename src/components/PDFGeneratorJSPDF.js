import { jsPDF } from 'jspdf';
import formSchema from '../data/Complete-WillSuite-Form-Data.json';

// Helper to convert image to base64 and get dimensions for jsPDF
const loadImageAsBase64 = async (imagePath) => {
  try {
    // In a build environment, we need to fetch the image
    const response = await fetch(imagePath);
    if (!response.ok) throw new Error('Failed to load image');
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Get image dimensions
        const img = new Image();
        img.onload = () => {
          resolve({
            data: reader.result,
            width: img.width,
            height: img.height,
            aspectRatio: img.width / img.height
          });
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Could not load image:', error);
    return null;
  }
};

// Helper to safely convert values to strings, removing corrupted numbers
const safeString = (value) => {
  if (value == null || value === undefined) return '';
  
  let str = String(value);
  // Remove corrupted number patterns
  str = str.replace(/-?\d+\.?\d*[eE][+-]?2\d+/g, '');
  str = str.replace(/-1\.8\d*[eE][+-]?\d+/gi, '');
  str = str.replace(/1\.8\d*[eE][+-]?2\d+/gi, '');
  
  // Check if parsed number is invalid
  const numMatch = str.match(/-?\d+\.?\d*[eE][+-]?\d+/g);
  if (numMatch) {
    numMatch.forEach(match => {
      const num = parseFloat(match);
      if (!isFinite(num) || Math.abs(num) >= 1e10) {
        str = str.replace(match, '');
      }
    });
  }
  
  return str.substring(0, 5000); // Limit length
};

const formatCurrencyValue = (value) => {
  if (value == null || value === '') return '';
  const numeric = typeof value === 'number'
    ? value
    : Number(String(value).replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(numeric)) {
    return `£${numeric.toLocaleString('en-GB', { maximumFractionDigits: 2 })}`;
  }
  return safeString(value);
};

const getFullName = (fv) => {
  if (!fv || typeof fv !== 'object') return '[Full Name]';
  const parts = [fv.title, fv.firstName, fv.middleName, fv.lastName].filter(Boolean).map(safeString);
  return parts.join(' ') || '[Full Name]';
};

// Helper to detect placeholder or incomplete content that shouldn't appear in final Will
const isPlaceholderOrIncomplete = (text) => {
  if (!text || typeof text !== 'string') return true;
  
  const problematicPatterns = [
    // Test/placeholder text patterns
    /\btest\s+test/i,                  // "test test" or "test test test"
    /\btest\s+test\s+test/i,            // "test test test" explicitly
    /\bmy\s+testing\b/i,                // "my testing"
    /schedule\s+test/i,                 // "Schedule test"
    
    // Blank/incomplete patterns
    /I appoint\s+to serve/i,            // Blank professional fields "I appoint to serve"
    /I appoint\s+as\s+Trustees/i,        // "I appoint as Trustees" (no names)
    /I give the sum of\s*(?:£\s*)?(?:to|$)/i, // "I give the sum of" without amount
    /\bfor\s{2,}/,                      // Double spaces after "for " indicating missing content
    /for\s*\.\s*I request/i,           // "for . I request" (blank organ donation)
    /\bto\s+\.\s/,                      // "to . " (blank)
    /\bto\s+\.\.\./,                    // "to ..." (ellipsis placeholder)
    /\bpay\s+the\s+income\s+thereof\s+to\s+\.\.\./i, // "pay the income thereof to ..."
    /\bfailed\s+share\s+to\s+\./i,      // "failed share to ."
    /\bI\s+give\s+of\s+my\s+net\s+estate\s+to\s+\.\.\./i, // "I give of my net estate to ..."
    /\bto\s+during\s+their\s+lifetime/i, // "to  during" (blank life tenant)
    /\band\s+after\s+their\s+death\s+for\s*$/i, // "and after their death for " (blank remainder)
    /children\s+\]/,                    // Stray bracket like "children ]"
    
    // Internal notes and unprofessional content
    /attestation clause to note signature is weak/i, // Internal note
    /please let people know i love them/i,           // Unprofessional funeral text
    /etc\.\.\.?\s*$/i,                              // "etc..." endings
    
    // Standard placeholder patterns
    /\[.*?\]/,                          // Square bracket placeholders like [Life Tenant Name]
    /£\s*0(?:\.00)?(?:\s|$)/,          // Zero amounts like "£0" or "£0.00"
    /^\s*£?\s*$|^\s*0\s*$/,            // Empty amounts or just "0"
    /placeholder|example/i,             // Placeholder text
    /enter details|enter the/i,         // Template instruction text
    /undefined|null/i,                  // Undefined/null values
    /^\s*$|^\.+$|^\-+$/,              // Empty content, just dots, or dashes
    /\{\{.*?\}\}/,                     // Unresolved template variables
    /Schedule\s*\d*\s*$/i,             // Unfinished schedule references like "Schedule 2"
    
    // Incomplete beneficiary/trustee references
    /(?:to my|appoint)\s*,/i,          // "to my," or "appoint," with no name following
    /beneficiar(?:y|ies)?\s*$/i,       // Lines ending with just "beneficiary"
    /executor(?:\(s\))?\s*$/i,         // Lines ending with just "executor"
    /trustee(?:\(s\))?\s*$/i,          // Lines ending with just "trustee"
  ];
  
  return problematicPatterns.some(pattern => pattern.test(text));
};

// COMPREHENSIVE Final Export Validation - blocks unprofessional/incomplete Wills
const validateWillCompleteness = (formValues, willClauses) => {
  const errors = [];
  const warnings = [];
  const criticalIssues = [];
  
  // ========== CRITICAL LEGAL COMPLETENESS CHECKS ==========
  
  // 1) BLANK TOKEN DETECTION - catch all incomplete clause content
  const blankTokenPatterns = [
    /\bto\s*\.\s/gi,                     // "to . " 
    /\bto\s*…\s/gi,                      // "to … "
    /\bincome thereof to\s+during/gi,    // "pay income to ___ during" (blank life tenant)
    /death for\s*$/gi,                   // "after their death for" (blank remainder beneficiary)
    /I appoint\s+as Trustees/gi,         // "I appoint as Trustees" (blank trustee names)
    /I give the failed share to\s*\./gi, // "failed share to ." (blank fallback)
    /I give\s+of my net estate to/gi,    // "I give ___ of my net estate to" (blank percentage)
    /specifically for the.*Trust\s*\./gi, // Incomplete trust references
    // CRITICAL: Missing subjects in clauses
    /\bmy\s+\[missing\s+(?:person|beneficiary)\]/gi,  // "my [missing person]" or "my [missing beneficiary]"
    /\brelease\s+and\s+forgive\s+my\s+\[missing/gi,  // "release and forgive my [missing"
    /\bno\s+provision\s+.*\s+for\s+my\s+\[missing/gi, // "no provision for my [missing"
    /\bcare\s+for\s+.*\s+my\s+\[missing/gi,          // "care for my [missing"
    /\bunable\s+.*\s+my\s+\[missing/gi,              // "unable my [missing"
    /\bupon\s+trust\s+for\s+\[missing/gi,            // "upon trust for [missing"
    /\bfor\s+\[missing\s+(?:person|beneficiary)\]/gi, // "for [missing person]" or "for [missing beneficiary]"
  ];
  
  willClauses.forEach((clause, index) => {
    blankTokenPatterns.forEach(pattern => {
      if (pattern.test(clause.text)) {
        criticalIssues.push({
          type: 'BLANK_TOKEN',
          clauseIndex: index + 1,
          section: clause.sectionLabel,
          issue: `Blank/incomplete content: "${clause.text.substring(0, 80)}..."`,
          pattern: pattern.source
        });
      }
    });
    
    // CRITICAL: Check for incomplete Clause 31 (condition without gift)
    if (index === 30) { // Clause 31 is index 30 (0-based)
      const clause31Text = clause.text.trim();
      const isIncompleteCondition = /^\(.*\)\s*$/.test(clause31Text) && 
                                     !clause31Text.toLowerCase().includes('i give') &&
                                     !clause31Text.toLowerCase().includes('i appoint') &&
                                     !clause31Text.toLowerCase().includes('i direct') &&
                                     !clause31Text.toLowerCase().includes('i wish');
      
      if (isIncompleteCondition) {
        criticalIssues.push({
          type: 'INCOMPLETE_CLAUSE_31',
          clauseIndex: 31,
          section: clause.sectionLabel,
          issue: `Clause 31 is incomplete - contains only a condition without an actual gift: "${clause31Text}"`,
          pattern: 'incomplete_condition'
        });
      }
    }
  });
  
  // 2) ARISTONE NAME TYPO DETECTION - catch "solicitorss", "solicitorsss" etc
  const aristoneTysoPatterns = [
    /aristone\s+solicotors/gi,           // "solicotors" typo
    /aristone\s+solicitors{2,}/gi,       // "solicitorss", "solicitorsss" (extra s)
    /aristone\s+solicitor(?!s\b)/gi,     // "solicitor" (should be plural)
  ];
  
  willClauses.forEach((clause, index) => {
    aristoneTysoPatterns.forEach(pattern => {
      if (pattern.test(clause.text)) {
        criticalIssues.push({
          type: 'ARISTONE_TYPO',
          clauseIndex: index + 1,
          section: clause.sectionLabel,
          issue: `Aristone name typo in: "${clause.text.substring(0, 80)}..."`,
          pattern: pattern.source
        });
      }
    });
  });
  
  // 3) RESIDUARY ESTATE VALIDATION - must be complete or excluded
  const residuaryClausesPresent = willClauses.filter(clause => 
    clause.text.toLowerCase().includes('residuary estate')
  );
  
  if (residuaryClausesPresent.length > 0) {
    // If residuary clauses exist, they must be complete
    const incompleteResiduary = residuaryClausesPresent.some(clause => {
      return (
        clause.text.includes('to  during their lifetime') || // Blank life tenant
        clause.text.includes('death for ') ||                // Blank remainder beneficiary  
        clause.text.includes('I appoint  to serve') ||      // Blank trustees
        clause.text.includes('[') && clause.text.includes(']') // Bracket placeholders
      );
    });
    
    if (incompleteResiduary) {
      criticalIssues.push({
        type: 'INCOMPLETE_RESIDUARY',
        issue: 'Residuary Estate clauses contain blanks - life tenant, beneficiaries, or trustees missing',
        affectedClauses: residuaryClausesPresent.length
      });
    }
  } else {
    // Must have some form of residuary clause
    criticalIssues.push({
      type: 'MISSING_RESIDUARY',
      issue: 'No Residuary Estate distribution clause found - Will must specify how remainder is distributed'
    });
  }
  
  // Simplified witness validation
  if (formValues.includeWitnessDetails === 'Yes') {
    const witnessFieldsRequired = ['witness1Name', 'witness1Address', 'witness1Occupation', 'witness2Name', 'witness2Address', 'witness2Occupation'];
    const missingWitnessFields = witnessFieldsRequired.filter(field => 
      !formValues[field] || String(formValues[field]).trim() === '' || String(formValues[field]) === 'undefined'
    );
    
    if (missingWitnessFields.length > 0) {
      criticalIssues.push({
        type: 'MISSING_WITNESSES',
        issue: 'Witness details incomplete for final execution',
        missingFields: missingWitnessFields
      });
    }
  }
  
  // 5) PROFESSIONAL EXECUTOR/TRUSTEE COMPLETENESS
  const professionalFields = [
    'professionalExecutorSelection',
    'substituteProfessionalExecutorSelection',
    'professionalTrusteeSelection', 
    'substituteProfessionalTrusteeSelection'
  ];
  
  const incompleteProfessionalAppointments = [];
  professionalFields.forEach(field => {
    if (formValues.appointProfessionalExecutor === 'Yes' || formValues.appointProfessionalTrustee === 'Yes') {
      if (!formValues[field] || formValues[field] === '' || formValues[field] === 'undefined') {
        const correspondingClause = willClauses.find(clause => 
          clause.text.includes('I appoint  to serve as my professional')
        );
        if (correspondingClause) {
          incompleteProfessionalAppointments.push(field);
        }
      }
    }
  });
  
  if (incompleteProfessionalAppointments.length > 0) {
    criticalIssues.push({
      type: 'INCOMPLETE_PROFESSIONAL_APPOINTMENTS',
      issue: 'Professional executor/trustee appointments are enabled but selections are blank',
      missingFields: incompleteProfessionalAppointments
    });
  }
  
  // 6) STANDARD WILL SKELETON VALIDATION
  const requiredWillElements = {
    revocation: willClauses.some(clause => clause.text.toLowerCase().includes('revoke') || clause.text.toLowerCase().includes('cancel')),
    executorAppointment: willClauses.some(clause => clause.text.toLowerCase().includes('executor')),
    debtsExpenses: willClauses.some(clause => clause.text.toLowerCase().includes('debt') || clause.text.toLowerCase().includes('expense') || clause.text.toLowerCase().includes('funeral')),
  };
  
  Object.entries(requiredWillElements).forEach(([element, present]) => {
    if (!present) {
      warnings.push({
        type: 'MISSING_STANDARD_ELEMENT',
        title: `Missing ${element} clause`,
        message: `Standard Wills should include a ${element} clause for legal completeness`
      });
    }
  });
  
  // ========== AGGREGATE RESULTS ==========
  
  if (criticalIssues.length > 0) {
    errors.push({
      type: 'CRITICAL_FINAL_EXPORT_ISSUES',
      title: 'Will cannot be finalized - critical legal content missing',
      issues: criticalIssues,
      message: `${criticalIssues.length} critical issue(s) prevent final export. This would create legal problems in probate.`
    });
  }
  
  return {
    isValid: errors.length === 0 && criticalIssues.length === 0,
    errors,
    warnings,
    criticalIssues,
    canGenerateDraft: true, // Always allow draft generation
    canGenerateFinal: errors.length === 0 && criticalIssues.length === 0
  };
};

// Standardized Aristone Solicitors naming - ensures consistent firm reference throughout
const getCanonicalFirmName = () => {
  return "Aristone Solicitors";
};

// Function to standardize all Aristone references in text
const standardizeAristoneName = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  // Patterns to catch typos and variations
  const variations = [
    /aristone\s+solicitorss+/gi,      // "solicitorss", "solicitorsss", etc
    /aristone\s+solicitors+s+/gi,     // Extra s after solicitors  
    /aristone\s+solicitorsss+/gi,     // Multiple extra s
    /aristone\s+solicotors?/gi,       // "solicotors" typo
    /aristone\s+solicitor(?!s\b)/gi,  // "solicitor" (singular)
    /aristone(?!\s+solicitors\b)/gi,  // "aristone" alone
    /\baristone\b(?!\s+solicitors)/gi, // Aristone without solicitors
    /ARISTONE\s+SOLICITORS+S*/gi,     // ALL CAPS with extra s
    /Aristone\s+solicitors+s*/gi,     // Mixed case with extra s
  ];
  
  let standardized = text;
  variations.forEach(variation => {
    standardized = standardized.replace(variation, getCanonicalFirmName());
  });
  
  return standardized;
};

// Auto-populate Aristone professional selections
const getAristoneProfessionalOptions = () => {
  return {
    fullDetails: `${getCanonicalFirmName()}, of [Office Address], Solicitors`,
    firmName: getCanonicalFirmName(),
    address: "[Office Address]", // TODO: Replace with actual office address
    designation: "Solicitors"
  };
};

// Sanitize unprofessional or informal content for legal documents
const sanitizeUnprofessionalContent = (text) => {
  if (!text || typeof text !== 'string') return text;
  
  let sanitized = text;
  
  // Replace informal funeral wishes with professional language
  if (sanitized.toLowerCase().includes('please let people know i love them')) {
    sanitized = sanitized.replace(
      /please let people know i love them[^.]*\.?\s*/gi,
      'I leave the arrangements for my funeral to my Executors.'
    );
  }
  
  // Remove "etc..." endings and replace with proper closure
  sanitized = sanitized.replace(/\s*etc\.\.\.?\s*$/gi, '.');
  
  // Remove internal notes that shouldn't appear in final Will
  sanitized = sanitized.replace(
    /attestation clause to note signature is weak[^.]*\.?\s*/gi,
    ''
  );
  
  // Clean up any double spaces or formatting issues
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  // If the entire clause became empty due to sanitization, return a professional default
  if (!sanitized || sanitized === '.') {
    if (text.toLowerCase().includes('funeral')) {
      return 'I leave the arrangements for my funeral to my Executors.';
    }
    return '';
  }
  
  return sanitized;
};

// Generate specific missing data report for user guidance
const generateMissingDataReport = (formValues, willClauses, criticalIssues = []) => {
  const missing = [];
  
  // CRITICAL: Residuary Estate section fields (user's main complaint)
  if (formValues.howResidueDistributed === 'IntoFLIT') {
    // Flexible Life Interest Trust requires specific fields
    const flitRequiredFields = [
      { key: 'flitLifeTenant', label: 'FLIT Life Tenant name' },
      { key: 'flitFinalBeneficiaries', label: 'FLIT remainder beneficiaries' },
      { key: 'lifeTenantDetails', label: 'Life tenant full details' },
      { key: 'beneficiariesDetails', label: 'Discretionary beneficiaries details' },
      { key: 'trustEndDistributionDetails', label: 'Trust distribution on termination' }
    ];
    
    flitRequiredFields.forEach(field => {
      const value = formValues[field.key];
      if (!value || String(value).trim() === '' || String(value) === 'undefined') {
        missing.push(`CRITICAL: ${field.label} - required for residuary estate distribution`);
      }
    });
    
    // Check for FLIT trustee appointments
    if (formValues.appointSeparateTrusteesFLIT === 'Yes') {
      if (!formValues.flitTrustees || String(formValues.flitTrustees).trim() === '') {
        missing.push('CRITICAL: FLIT-specific trustees - must be appointed for life interest trust');
      }
    }
  } else if (formValues.howResidueDistributed === 'AsShares') {
    // Simple residuary gifts require beneficiary details
    if (!formValues.residualBeneficiariesDetails || String(formValues.residualBeneficiariesDetails).includes('[')) {
      missing.push('CRITICAL: Residuary beneficiaries list and shares - must specify who inherits remainder of estate');
    }
  }
  
  // Check fallback provisions for residuary estate
  if (formValues.specifyFurtherResidualGiftsOnFail === 'Yes') {
    if (!formValues.furtherResidualGiftsDetails || String(formValues.furtherResidualGiftsDetails).includes('[')) {
      missing.push('CRITICAL: Fallback residuary beneficiaries - required when residuary gifts fail');
    }
  }
  
  // CRITICAL: Witness details (user's complaint #3)
  if (formValues.includeWitnessDetails === 'Yes') {
    const witnessFields = [
      { key: 'witness1Name', label: 'Witness 1 full name' },
      { key: 'witness1Address', label: 'Witness 1 full address' }, 
      { key: 'witness1Phone', label: 'Witness 1 phone number' },
      { key: 'witness1Occupation', label: 'Witness 1 occupation' },
      { key: 'witness2Name', label: 'Witness 2 full name' },
      { key: 'witness2Address', label: 'Witness 2 full address' },
      { key: 'witness2Phone', label: 'Witness 2 phone number' },
      { key: 'witness2Occupation', label: 'Witness 2 occupation' }
    ];
    
    witnessFields.forEach(field => {
      const value = formValues[field.key];
      if (!value || String(value).trim() === '' || String(value) === 'undefined') {
        missing.push(`EXECUTION: ${field.label} - required for legal Will signing`);
      }
    });
  }
  
  // Professional executor/trustee appointments (user's complaint #1)
  const professionalFields = [
    { key: 'professionalExecutorSelection', label: 'Professional Executor selection', condition: formValues.appointProfessionalExecutor === 'Yes' },
    { key: 'substituteProfessionalExecutorSelection', label: 'Substitute Professional Executor selection', condition: formValues.appointProfessionalExecutor === 'Yes' },
    { key: 'professionalTrusteeSelection', label: 'Professional Trustee selection', condition: formValues.appointProfessionalTrustee === 'Yes' },
    { key: 'substituteProfessionalTrusteeSelection', label: 'Substitute Professional Trustee selection', condition: formValues.appointProfessionalTrustee === 'Yes' }
  ];
  
  professionalFields.forEach(field => {
    if (field.condition && (!formValues[field.key] || formValues[field.key] === '')) {
      missing.push(`PROFESSIONAL: ${field.label} - must select "Aristone" or "Other" and provide details`);
    }
  });
  
  // Charity details if charitable gifts enabled
  if (formValues.give10PercentToCharity === 'Yes') {
    const charityFields = [
      { key: 'charityBenefitDetails', label: 'Charity beneficiaries list' },
      { key: 'minimumCharityAmountValue', label: 'Minimum charity amount', condition: formValues.minimumCharityAmount === 'Yes' }
    ];
    
    charityFields.forEach(field => {
      if ((!field.condition || field.condition) && (!formValues[field.key] || String(formValues[field.key]).includes('['))) {
        missing.push(`CHARITY: ${field.label} - required for charitable gifts`);
      }
    });
  }
  
  // Check for placeholder text in critical fields
  const placeholderFields = [
    { key: 'monetaryGiftsDetails', label: 'Monetary gifts details' },
    { key: 'specificGiftsDetails', label: 'Specific gifts details' },
    { key: 'propertyGiftsDetails', label: 'Property gifts details' },
    { key: 'propertyTrustDetails', label: 'Property trust property description' },
    { key: 'bprTrustDetails', label: 'Business property relief trust details' },
    { key: 'otherFuneralRequirements', label: 'Funeral wishes' }
  ];
  
  placeholderFields.forEach(field => {
    const value = formValues[field.key];
    if (value && typeof value === 'string') {
      if (value.toLowerCase().includes('please let people know') ||
          value.includes('[') || value.includes(']')) {
        missing.push(`PLACEHOLDER: ${field.label} - contains placeholder text that must be replaced with real information`);
      }
    }
  });
  
  // Add critical issues from validation
  if (criticalIssues && criticalIssues.length > 0) {
    criticalIssues.forEach(issue => {
      if (issue.type === 'BLANK_TOKEN') {
        missing.push(`CRITICAL BLANK: ${issue.section} - Clause ${issue.clauseIndex} has incomplete content`);
      } else if (issue.type === 'ARISTONE_TYPO') {
        missing.push(`TYPO: ${issue.section} - Clause ${issue.clauseIndex} has Aristone name spelling error`);
      }
    });
  }
  
  // Pet provisions
  if (formValues.provisionsForPets === 'Yes') {
    if (!formValues.petCarerGift || String(formValues.petCarerGift).trim() === '' || formValues.petCarerGift === '0') {
      missing.push('PET CARE: Pet carer gift amount - must specify monetary support for pet care');
    }
  }
  
  // Property Trust Schedule validation - catch missing schedule content before PDF generation
  if (formValues.includePropertyTrust === 'Yes' && formValues.propertyTrustScheduleNumber) {
    const scheduleNumber = String(formValues.propertyTrustScheduleNumber).trim();
    if (scheduleNumber && scheduleNumber !== '') {
      // Schedule number exists, check if content is missing
      const hasDetails = formValues.propertyTrustDetails && String(formValues.propertyTrustDetails).trim() !== '';
      const hasTerms = formValues.propertyTrustTerms && String(formValues.propertyTrustTerms).trim() !== '';
      
      if (!hasDetails || !hasTerms) {
        const missingParts = [];
        if (!hasDetails) missingParts.push('Property Details');
        if (!hasTerms) missingParts.push('Property Trust Terms');
        missing.push(`PROPERTY TRUST: Missing Schedule content in Property Trust section. Schedule ${scheduleNumber} is referenced but ${missingParts.join(' and ')} ${missingParts.length === 1 ? 'is' : 'are'} missing.`);
      }
    }
  }
  
  // Business Property Relief Trust Schedule validation
  if (formValues.includeBPRTrust === 'Yes' && formValues.bprTrustScheduleNumber) {
    const scheduleNumber = String(formValues.bprTrustScheduleNumber).trim();
    if (scheduleNumber && scheduleNumber !== '') {
      const hasDetails = formValues.bprTrustDetails && String(formValues.bprTrustDetails).trim() !== '';
      const hasTerms = formValues.bprTrustTerms && String(formValues.bprTrustTerms).trim() !== '';
      
      if (!hasDetails || !hasTerms) {
        const missingParts = [];
        if (!hasDetails) missingParts.push('Business Property Details');
        if (!hasTerms) missingParts.push('Business Property Relief Trust Terms');
        missing.push(`BPR TRUST: Missing Schedule content in Business Interests section. Schedule ${scheduleNumber} is referenced but ${missingParts.join(' and ')} ${missingParts.length === 1 ? 'is' : 'are'} missing.`);
      }
    }
  }
  
  return missing;
};

const evaluateConditions = (conditions, formValues, conditionLogic) => {
  if (!conditions) return true;
  if (!formValues || typeof formValues !== 'object') return false;

  const evalClause = (clause) => {
    if (!clause || !clause.field) return false;
    const value = formValues[clause.field];
    if (clause.operator === 'eq') return value === clause.value;
    if (clause.operator === 'in') {
      if (!Array.isArray(clause.value)) return value === clause.value;
      return clause.value.includes(value);
    }
    if (clause.operator === 'AND' || clause.operator === 'OR') {
      if (!clause.clauses || !Array.isArray(clause.clauses)) return false;
      const results = clause.clauses.map(evalClause);
      return clause.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
    }
    return false;
  };

  if (Array.isArray(conditions)) {
    const logic = conditionLogic === 'OR' ? 'OR' : 'AND';
    return logic === 'OR' ? conditions.some(evalClause) : conditions.every(evalClause);
  }
  return evalClause(conditions);
};

// Text interpolation function (matching FormRenderer logic)
const interpolateText = (text, values) => {
  
  if (typeof text !== 'string') return text;

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
    charityBenefitSection: 'charityBenefitDetails',
    // New Aristone professional selections
    professionalExecutorSelection: 'professionalExecutorSelection',
    substituteProfessionalExecutorSelection: 'substituteProfessionalExecutorSelection',
    professionalTrusteeSelection: 'professionalTrusteeSelection', 
    substituteProfessionalTrusteeSelection: 'substituteProfessionalTrusteeSelection'
  };

  const interpolated = text.replace(/\{\{field:([^}]+)\}\}/g, (_, fullKey) => {
    const [sectionId, subField] = fullKey.split(':');

    if (subField === 'fullDetails' || subField === 'fullList') {
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

    // Handle 'value' subField - special handling for organ donation fields
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
      
      // Try direct field lookup
      const directValue = values[sectionId] || values[fullKey];
      if (directValue != null && directValue !== '') {
        return String(directValue);
      }
      return '';
    }

    // Handle special case: selectedPurposes for organPurposeGroup
    if (subField === 'selectedPurposes' && sectionId === 'organPurposeGroup') {
      const selectedPurposes = values[sectionId] || [];
      if (Array.isArray(selectedPurposes) && selectedPurposes.length > 0) {
        // Get the field definition to access willClauseTextFragment
        const purposeField = formSchema.formSections
          .flatMap(s => s.fields)
          .find(f => f.id === 'organPurposeGroup');
        if (purposeField && purposeField.options) {
          const selectedFragments = purposeField.options
            .filter(opt => {
              // Check if this option is selected by ID or value
              return selectedPurposes.includes(opt.id) || selectedPurposes.includes(opt.value);
            })
            .map(opt => opt.willClauseTextFragment || opt.label)
            .filter(Boolean);
          if (selectedFragments.length > 0) {
            return selectedFragments.join(', ');
          }
        }
      }
      // Default to "any lawful purpose" when no purposes are selected (as per UI hint)
      return 'any lawful purpose';
    }

    // Handle special Aristone professional selections with auto-population
    if (['professionalExecutorSelection', 'substituteProfessionalExecutorSelection', 
         'professionalTrusteeSelection', 'substituteProfessionalTrusteeSelection'].includes(sectionId) && 
        subField === 'fullDetails') {
      const selectionValue = values[sectionId];
      
      if (selectionValue === 'Aristone') {
        return `${getCanonicalFirmName()}, SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG`;
      } else if (selectionValue === 'Other') {
        const otherDetailsField = sectionId.replace('Selection', 'OtherDetails');
        const otherDetails = values[otherDetailsField];
        if (otherDetails && otherDetails.trim()) {
          return otherDetails.trim();
        }
      }
      
      return '';
    }

    // Handle nested section fields
    const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
    const sectionData = values[fallbackId] || values[sectionId];
    
    if (Array.isArray(sectionData) && sectionData.length > 0) {
      if (typeof sectionData[0] !== 'object') {
        return sectionData.map(safeString).join(', ');
      }
      const mappedValues = sectionData
        .map((item) => {
          if (!item || typeof item !== 'object') return '';
          const fieldValue = item[subField] || 
            item[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
            item[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
            item[subField.toLowerCase()] ||
            item[subField.toUpperCase()];
          return fieldValue != null ? safeString(fieldValue) : '';
        })
        .filter(Boolean);
      if (mappedValues.length > 0) {
        return mappedValues.join(', ');
      }
    } else if (typeof sectionData === 'object' && sectionData !== null) {
      const fieldValue = sectionData[subField] || 
                       sectionData[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                       sectionData[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
                       sectionData[subField.toLowerCase()] ||
                       sectionData[subField.toUpperCase()];
      if (fieldValue && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
        return safeString(fieldValue);
      }
    }

    // Handle direct field references
    if (subField === 'value') {
      const directValue = values[sectionId];
      if (directValue != null) {
        return safeString(directValue);
      }
    }

    // Try other naming conventions (matching FormRenderer)
    const customValue = values[`${sectionId}:${subField}`] || 
                       values[`${sectionId}${subField}`] || 
                       values[`${sectionId}_${subField}`] ||
                       values[`${sectionId}.${subField}`];
    if (customValue) return safeString(customValue);

    // Try direct field lookup
    const directField = values[sectionId];
    if (directField != null) {
      if (Array.isArray(directField)) {
        return directField.map(safeString).filter(Boolean).join(', ');
      }
      if (typeof directField === 'string' || typeof directField === 'number') {
        return safeString(directField);
      }
    }

    // Final fallback: try the full key as a direct field name
    const fullKeyValue = values[fullKey];
    if (fullKeyValue != null) {
      if (Array.isArray(fullKeyValue)) {
        return fullKeyValue.map(safeString).filter(Boolean).join(', ');
      }
      return safeString(fullKeyValue);
    }

    return '';
  });

  // Handle template placeholders that need to be replaced with actual values
  let processed = interpolated;
  
  // Replace common template placeholders with appropriate values
  if (values && typeof values === 'object') {
    // FLIT Life tenant placeholders
    if (processed.includes('[Life Tenant Name]') || processed.includes('to __') || processed.includes('to __ during')) {
      const lifeTenant = values.lifeTenantDetails || 
                        values.flitLifeTenant ||
                        values.lifeTenant || 
                        values.lifeTenantName || 
                        getFullName(values) || '';
      
      processed = processed.replace(/\[Life Tenant Name\]/g, lifeTenant);
      processed = processed.replace(/to __ during/g, `to ${lifeTenant} during`);
      processed = processed.replace(/to __/g, `to ${lifeTenant}`);
    }
    
    // FLIT Final beneficiaries placeholders
    if (processed.includes('[Final Beneficiaries') || processed.includes('for __')) {
      const finalBeneficiaries = values.beneficiariesDetails ||
                               values.trustEndDistributionDetails ||
                               values.flitFinalBeneficiaries ||
                               values.finalBeneficiaries || 
                               values.finalBeneficiaryDetails || 
                               'my children who survive me';
      
      processed = processed.replace(/\[Final Beneficiaries[^\]]*\]/g, finalBeneficiaries);
      processed = processed.replace(/for __ /g, `for ${finalBeneficiaries} `);
      processed = processed.replace(/for __$/g, `for ${finalBeneficiaries}`);
      processed = processed.replace(/and after their death for $/g, `and after their death for ${finalBeneficiaries}`);
    }
    
    // Gender pronouns
    const gender = values.gender || 'Other';
    const pronounHis = gender === 'Female' ? 'her' : gender === 'Male' ? 'his' : 'their';
    const pronounHe = gender === 'Female' ? 'she' : gender === 'Male' ? 'he' : 'they';
    
    processed = processed.replace(/\[his\/her\]/g, pronounHis);
    processed = processed.replace(/\[he\/she\]/g, pronounHe);
  }
  
  // Remove any remaining bracket placeholders to avoid incomplete text in final Will
  processed = processed.replace(/\[[^\]]*\]/g, '');
  
  // Clean up extra whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  // CRITICAL: Standardize all Aristone name references for consistency
  processed = standardizeAristoneName(processed);

  return processed;
};

export const generatePDFWithJSPDF = async (formValues, signatures = {}) => {
  try {
    
    const {
      testatorSignature = null,
      consultantSignature = null,
      clientSignature = null
    } = signatures || {};
    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    });
    
    // Load logo image - try multiple methods
    let logoData = null;
    try {
      // Method 1: Try importing as URL (Vite)
      try {
        const logoModule = await import('../assets/logo_resized.png?url');
        if (logoModule.default) {
          logoData = await loadImageAsBase64(logoModule.default);
        }
      } catch {
        // Method 2: Try default import
        try {
          const logoModule = await import('../assets/logo_resized.png');
          if (logoModule.default) {
            logoData = await loadImageAsBase64(logoModule.default);
          }
        } catch {
          // Method 3: Try direct URL path
          try {
            const logoUrl = '/src/assets/logo_resized.png';
            logoData = await loadImageAsBase64(logoUrl);
          } catch {
            // Method 4: Try public path
            try {
              const logoUrl = '/logo_resized.png';
              logoData = await loadImageAsBase64(logoUrl);
            } catch {
              console.warn('Could not load logo image, will use text fallback');
            }
          }
        }
      }
    } catch {
      console.warn('Could not load logo image, will use text fallback');
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // A4: 210mm x 297mm
    // Professional margins: ~20mm
    const margin = 20;
    const lineHeight = 5.5; // Modern tighter line spacing
    let yPos = margin;

    // Helper to add new page if needed
    const checkPageBreak = (requiredHeight = lineHeight) => {
      if (yPos + requiredHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
    };

    // Helper to render report text with proper Y advancement (prevents overlap)
    const reportLine = (text, options = {}) => {
      const {
        x = margin,
        maxWidth = pageWidth - (margin * 2),
        lineHeight: customLineHeight = 5.5,
        fontSize = 10,
        bold = false,
        spacingAfter = 0,
        indent = 0
      } = options;
      
      const actualX = x + indent;
      const actualMaxWidth = maxWidth - indent;
      
      // Wrap text
      doc.setFontSize(fontSize);
      doc.setFont('times', bold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(String(text).trim(), actualMaxWidth);
      
      // Check page break before rendering
      const neededHeight = lines.length * customLineHeight + spacingAfter;
      if (yPos + neededHeight > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      
      // Render each line individually, advancing Y for each
      let currentY = yPos;
      lines.forEach((line) => {
        doc.text(line, actualX, currentY);
        currentY += customLineHeight;
      });
      
      // Update global yPos
      yPos = currentY + spacingAfter;
    };

    // Helper to add text with proper formatting and width constraints
    const addText = (text, x, fontSize = 12, bold = false, align = 'left', maxWidth = null, lineSpacing = null) => {
      checkPageBreak(lineHeight);
      const safeText = safeString(text);
      if (safeText) {
        doc.setFontSize(fontSize);
        doc.setFont('times', bold ? 'bold' : 'normal');
        doc.setTextColor(0, 0, 0);
        
        // Calculate available width - ensure text never goes past right margin
        const availableWidth = maxWidth || (pageWidth - margin - x); // Width from x to right margin
        const lines = doc.splitTextToSize(safeText, availableWidth);
        const spacing = lineSpacing || (fontSize * 0.45);
        
        let currentY = yPos;
        if (align === 'center') {
          lines.forEach(line => {
            const lineWidth = doc.getTextWidth(line);
            const xPos = x - (lineWidth / 2);
            // Ensure text doesn't go past margins
            const clampedX = Math.max(margin, Math.min(xPos, pageWidth - margin - lineWidth));
            doc.text(line, clampedX, currentY);
            currentY += spacing;
          });
        } else if (align === 'right') {
          lines.forEach(line => {
            const lineWidth = doc.getTextWidth(line);
            const xPos = x - lineWidth;
            const clampedX = Math.max(margin, Math.min(xPos, pageWidth - margin - lineWidth));
            doc.text(line, clampedX, currentY);
            currentY += spacing;
          });
        } else {
          // Left align - ensure text stays within margins
          lines.forEach(line => {
            const lineWidth = doc.getTextWidth(line);
            const maxX = pageWidth - margin;
            if (x + lineWidth > maxX) {
              // Text would overflow, truncate at word boundaries if needed
              let truncated = line;
              while (doc.getTextWidth(truncated) > availableWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
              }
              doc.text(truncated || line.substring(0, Math.floor(availableWidth / (fontSize * 0.5))), x, currentY);
            } else {
              doc.text(line, x, currentY);
            }
            currentY += spacing;
          });
        }
        yPos = currentY;
      }
      return yPos;
    };

    // ===== COVER PAGE (FIRST PAGE) =====
    // The first page is already created by jsPDF, so we use it for the cover
    
    // Outer border - thick line (1.5pt = ~0.5mm), positioned at 24pt from edges
    const borderMargin = 8.5; // ~24pt = 8.5mm
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.rect(borderMargin, borderMargin, pageWidth - (borderMargin * 2), pageHeight - (borderMargin * 2));
    
    // Inner border - thin line (0.5pt = ~0.18mm), positioned at 36pt from edges
    const innerBorderMargin = 12.7; // ~36pt = 12.7mm
    doc.setLineWidth(0.18);
    doc.rect(innerBorderMargin, innerBorderMargin, pageWidth - (innerBorderMargin * 2), pageHeight - (innerBorderMargin * 2));

    // Title - centered, large, bold, split on two lines (matching professional format)
    yPos = pageHeight / 2 - 25;
    doc.setFontSize(24);
    doc.setFont('times', 'bold');
    const titleLine1 = 'Last Will';
    const titleLine2 = 'and Testament';
    const title1Width = doc.getTextWidth(titleLine1);
    const title2Width = doc.getTextWidth(titleLine2);
    doc.text(titleLine1, pageWidth / 2 - title1Width / 2, yPos);
    yPos += 7;
    doc.text(titleLine2, pageWidth / 2 - title2Width / 2, yPos);
    
    yPos += 8;
    doc.setFontSize(18);
    doc.setFont('times', 'italic');
    const ofText = '-of-';
    const ofWidth = doc.getTextWidth(ofText);
    doc.text(ofText, pageWidth / 2 - ofWidth / 2, yPos);
    
    yPos += 10;
    // Name
    const fullName = getFullName(formValues);
    doc.setFontSize(16);
    doc.setFont('times', 'normal');
    const nameText = fullName !== '[Full Name]' ? fullName : '';
    if (nameText) {
      const nameWidth = doc.getTextWidth(nameText);
      doc.text(nameText, pageWidth / 2 - nameWidth / 2, yPos);
    }
    
    // Logo at bottom - center - using actual logo image with proper aspect ratio
    yPos = pageHeight - 50;
    try {
      // Calculate logo size preserving aspect ratio
      let logoWidth = 60; // mm - target width
      let logoHeight = 60; // mm - will be adjusted
      let logoDataString = null;
      
      if (logoData && logoData.data && logoData.aspectRatio) {
        // Use actual image dimensions to preserve aspect ratio
        logoDataString = logoData.data;
        
        // Calculate height based on aspect ratio to prevent squishing
        if (logoData.aspectRatio > 1) {
          // Landscape logo - wider than tall
          logoHeight = logoWidth / logoData.aspectRatio;
        } else {
          // Portrait or square logo - taller than wide
          logoHeight = logoWidth / logoData.aspectRatio;
        }
        
        // Ensure logo isn't too small or too large
        const maxWidth = 70; // mm
        const maxHeight = 30; // mm
        if (logoWidth > maxWidth) {
          logoWidth = maxWidth;
          logoHeight = logoWidth / logoData.aspectRatio;
        }
        if (logoHeight > maxHeight) {
          logoHeight = maxHeight;
          logoWidth = logoHeight * logoData.aspectRatio;
        }
      }
      
      const logoX = pageWidth / 2 - logoWidth / 2;
      const logoY = yPos;
      
      // Try to add actual logo image if loaded
      if (logoDataString && typeof logoDataString === 'string' && logoDataString.startsWith('data:')) {
        try {
          doc.addImage(logoDataString, 'PNG', logoX, logoY, logoWidth, logoHeight);
        } catch (imgError) {
          console.warn('Could not add logo image:', imgError);
          // Fall through to text fallback
          throw imgError;
        }
      } else {
        throw new Error('Logo not available');
      }
    } catch {
      // Fallback to text logo if image fails - styled to match logo design
      yPos = pageHeight - 45;
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(106, 62, 155); // Purple color matching logo (#6A3E9B)
      const logoText = 'ARISTONE';
      const logoTextWidth = doc.getTextWidth(logoText);
      doc.text(logoText, pageWidth / 2 - logoTextWidth / 2, yPos);
      yPos += 6;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(192, 192, 192); // Gray color matching logo
      const logoSolicitors = 'SOLICITORS';
      const solicitorsWidth = doc.getTextWidth(logoSolicitors);
      doc.text(logoSolicitors, pageWidth / 2 - solicitorsWidth / 2, yPos);
    }

    // ===== CONTENT PAGE =====
    doc.addPage();
    yPos = margin;
    doc.setFontSize(11.5);
    doc.setFont('times', 'normal');
    doc.setTextColor(0, 0, 0);

    // Header: "This is the Will of [Full Name]." (Fixed "my Mrs" issue)
    const fullNameText = fullName !== '[Full Name]' ? fullName : '[Name]';
    
    // Clean up the name to avoid "my Mrs" issue
    let cleanName = fullNameText;
    
    // Remove leading "my " if present (this causes "my Mrs" issue)
    cleanName = cleanName.replace(/^my\s+/i, '');
    
    // Ensure proper honorific formatting - no duplicate honorifics
    const honorifics = ['Mrs', 'Mr', 'Ms', 'Miss', 'Dr', 'Prof', 'Sir', 'Dame', 'Lord', 'Lady'];
    const nameParts = cleanName.split(' ').filter(part => part.trim());
    
    // If first part is an honorific, ensure it's properly formatted
    if (nameParts.length > 0 && honorifics.includes(nameParts[0])) {
      // Name already has honorific, use as is
      cleanName = nameParts.join(' ');
    }
    
    // Header text - use direct rendering for consistent Y tracking
    doc.setFontSize(11.5);
    doc.setFont('times', 'normal');
    doc.text(`This is the Will of ${cleanName}.`, margin, yPos);
    yPos += 8;

    // Helper function for hanging indent clause rendering
    const renderNumberedClause = (doc, {
      number,
      text,
      margin,
      yPos: currentYPos,
      pageWidth,
      pageHeight,
      lineHeight = 5.5,
      spacingAfter = 6,
      fontSize = 11.5,
      numColW = 12
    }) => {
      const textX = margin + numColW;
      const availableWidth = pageWidth - margin - textX;

      // Wrap text to the text column width
      doc.setFont('times', 'normal');
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, availableWidth);

      // Page break check (handle multi-line clauses properly)
      const neededHeight = Math.max(lines.length, 1) * lineHeight + spacingAfter;
      if (currentYPos + neededHeight > pageHeight - margin) {
        doc.addPage();
        currentYPos = margin;
      }

      // Number (bold) - on same baseline as first line of text
      doc.setFont('times', 'bold');
      doc.setFontSize(fontSize);
      doc.text(`${number}.`, margin, currentYPos);

      // Text (normal) - first line same baseline as number, wrapped lines align under text
      doc.setFont('times', 'normal');
      doc.setFontSize(fontSize);
      let lineY = currentYPos;
      for (let i = 0; i < lines.length; i++) {
        doc.text(lines[i], textX, lineY);
        lineY += lineHeight; // Increment Y for each line
      }

      // Return the final Y position after all lines
      return lineY + spacingAfter;
    };

    // Helper to add DRAFT watermark to a page
    const addDraftWatermark = (doc, pageNum) => {
      doc.setPage(pageNum);
      doc.setFontSize(48);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 220, 220); // Very light gray for watermark effect
      const text = 'DRAFT - DO NOT SIGN';
      const textWidth = doc.getTextWidth(text);
      // Center diagonally on page (jsPDF doesn't support angle, so we'll center it)
      const centerX = (pageWidth - textWidth) / 2;
      const centerY = pageHeight / 2;
      doc.text(text, centerX, centerY);
      doc.setTextColor(0, 0, 0); // Reset color
    };

    // Collect all will clauses from form sections
    const willClauses = [];
    const seenClauses = new Set(); // Track seen clauses to prevent duplicates
    const scheduleReferences = new Set(); // Track schedule references throughout function
    
    // Explicit signing date fields - declared once for use throughout function
    const explicitSigningDateFields = [
      'executionDate',
      'dateSigned',
      'willSigningDate',
      'willExecutionDate', 
      'dateOfExecution',
      'signingDate'
    ];
    
    if (formSchema && formSchema.formSections && Array.isArray(formSchema.formSections)) {
      formSchema.formSections.forEach((section) => {
        if (!section || !section.fields) return;

        const processFields = (fields) => {
          fields.forEach((field, fieldIndex) => {
            if (!field) return;

            // Skip if conditions not met
            if (field.conditions && !evaluateConditions(field.conditions, formValues, field.conditionLogic)) {
              return;
            }

            // Skip display/button/hidden/signature fields
            if (['display', 'button', 'hidden', 'signature'].includes(field.type)) {
              return;
            }

            // Check field's willClauseText
            if (field.willClauseText) {
              const interpolated = interpolateText(field.willClauseText, formValues);
              
              // CRITICAL: Block clauses with missing subjects or empty critical interpolations
              if (interpolated && 
                  !/\{\{field:[^}]+\}\}/.test(interpolated) && 
                  interpolated.trim() !== '' &&
                  !isPlaceholderOrIncomplete(interpolated)) {
                
                // CRITICAL: Check for pet care clauses with missing data
                if (field.id === 'petCarerSection' || field.id === 'substitutePetCarerSection') {
                  const petCarerData = formValues.petCarerData || [];
                  const substitutePetCarerData = formValues.substitutePetCarerData || [];
                  const hasPetCarer = Array.isArray(petCarerData) && petCarerData.length > 0;
                  const hasSubstitutePetCarer = Array.isArray(substitutePetCarerData) && substitutePetCarerData.length > 0;
                  
                  if (field.id === 'petCarerSection' && !hasPetCarer) {
                    console.warn(`[PDF VALIDATION] ⚠️ BLOCKING pet carer clause - no pet carer data: "${interpolated.substring(0, 100)}"`);
                    return; // Skip this clause
                  }
                  
                  if (field.id === 'substitutePetCarerSection' && (!hasPetCarer || !hasSubstitutePetCarer)) {
                    console.warn(`[PDF VALIDATION] ⚠️ BLOCKING substitute pet carer clause - missing data: "${interpolated.substring(0, 100)}"`);
                    return; // Skip this clause
                  }
                }
                
                // CRITICAL: Check for inheritance tax condition clause without charity gift
                if (field.id === 'charityGiftOnlyIfIHTDue' && formValues.give10PercentToCharity !== 'Yes') {
                  console.warn(`[PDF VALIDATION] ⚠️ BLOCKING IHT condition clause - no charity gift: "${interpolated.substring(0, 100)}"`);
                  return; // Skip this clause - it's meaningless without a charity gift
                }
                
                // CRITICAL: Check for missing subjects BEFORE adding clause
                // Detect patterns indicating empty interpolations that leave missing subjects
                const hasMissingSubject = 
                  // Explicit [missing person] markers
                  /\bmy\s+\[missing\s+(?:person|beneficiary)\]/i.test(interpolated) ||
                  /\bfor\s+\[missing\s+(?:person|beneficiary)\]/i.test(interpolated) ||
                  /\brelease\s+and\s+forgive\s+my\s+\[missing/i.test(interpolated) ||
                  /\bno\s+provision\s+.*\s+for\s+my\s+\[missing/i.test(interpolated) ||
                  /\bcare\s+for\s+.*\s+my\s+\[missing/i.test(interpolated) ||
                  /\bunable\s+.*\s+my\s+\[missing/i.test(interpolated) ||
                  /\bupon\s+trust\s+for\s+\[missing/i.test(interpolated) ||
                  // Patterns indicating empty interpolation (missing name after "my " or "for ")
                  /\brelease\s+and\s+forgive\s+my\s+(?:from|\.|$)/i.test(interpolated) ||
                  /\bno\s+provision\s+.*\s+for\s+my\s+\./i.test(interpolated) ||
                  /\bcare\s+for\s+.*\s+my\s+\./i.test(interpolated) ||
                  /\bunable\s+.*\s+my\s+\./i.test(interpolated) ||
                  /\bupon\s+trust\s+for\s+\./i.test(interpolated) ||
                  // "my " followed immediately by punctuation or "from" (empty name)
                  /\bmy\s+[\.\s]+(?:from|for|care|unable|provision|This)/i.test(interpolated) ||
                  // "for " followed immediately by punctuation (empty beneficiary)
                  /\bupon\s+trust\s+for\s+[\.\s]+(?:\.|$)/i.test(interpolated) ||
                  // Pet care specific patterns - "I request that my " followed by "care" or "is unable" without a name
                  (/\brequest\s+that\s+my\s+(?:care|is\s+unable)/i.test(interpolated) && !/\brequest\s+that\s+my\s+\w+\s+(?:care|is\s+unable)/i.test(interpolated));
                
                if (hasMissingSubject) {
                  console.warn(`[PDF VALIDATION] ⚠️ BLOCKING clause with missing subject: "${interpolated.substring(0, 100)}"`);
                  return; // Skip this clause - don't add it to willClauses
                }
                
                // Normalize clause for duplicate detection (ignore minor whitespace differences)
                const normalizedClause = safeString(interpolated).replace(/\s+/g, ' ').trim().toLowerCase();
                
                // Only add if we haven't seen this clause before
                if (!seenClauses.has(normalizedClause)) {
                  seenClauses.add(normalizedClause);
                  willClauses.push({
                    sectionLabel: section.formSection,
                    fieldLabel: field.label,
                    text: safeString(interpolated)
                  });
                }
              }
            }

            // Check options' willClauseText for radio/select fields
            if (field.options && (field.type === 'radio' || field.type === 'select')) {
              const selectedValue = formValues[field.id];
              if (selectedValue) {
                const selectedOption = field.options.find(opt => opt && opt.value === selectedValue);
                if (selectedOption?.willClauseText) {
                  const interpolated = interpolateText(selectedOption.willClauseText, formValues);
                  if (interpolated && 
                      !/\{\{field:[^}]+\}\}/.test(interpolated) && 
                      interpolated.trim() !== '' &&
                      !isPlaceholderOrIncomplete(interpolated)) {
                    
                    // CRITICAL: Check for missing subjects BEFORE adding clause
                    const hasMissingSubject = 
                      /\bmy\s+\[missing\s+(?:person|beneficiary)\]/i.test(interpolated) ||
                      /\bfor\s+\[missing\s+(?:person|beneficiary)\]/i.test(interpolated) ||
                      /\brelease\s+and\s+forgive\s+my\s+\[missing/i.test(interpolated) ||
                      /\bno\s+provision\s+.*\s+for\s+my\s+\[missing/i.test(interpolated) ||
                      /\bcare\s+for\s+.*\s+my\s+\[missing/i.test(interpolated) ||
                      /\bunable\s+.*\s+my\s+\[missing/i.test(interpolated) ||
                      /\bupon\s+trust\s+for\s+\[missing/i.test(interpolated) ||
                      /\brelease\s+and\s+forgive\s+my\s+(?:from|\.|$)/i.test(interpolated) ||
                      /\bno\s+provision\s+.*\s+for\s+my\s+\./i.test(interpolated) ||
                      /\bcare\s+for\s+.*\s+my\s+\./i.test(interpolated) ||
                      /\bunable\s+.*\s+my\s+\./i.test(interpolated) ||
                      /\bupon\s+trust\s+for\s+\./i.test(interpolated) ||
                      /\bmy\s+[\.\s]+(?:from|for|care|unable|provision|This)/i.test(interpolated) ||
                      /\bupon\s+trust\s+for\s+[\.\s]+(?:\.|$)/i.test(interpolated);
                    
                    if (hasMissingSubject) {
                      console.warn(`[PDF VALIDATION] ⚠️ BLOCKING clause with missing subject: "${interpolated.substring(0, 100)}"`);
                      return; // Skip this clause
                    }
                    
                    // Normalize clause for duplicate detection
                    const normalizedClause = safeString(interpolated).replace(/\s+/g, ' ').trim().toLowerCase();
                    
                    // Only add if we haven't seen this clause before
                    if (!seenClauses.has(normalizedClause)) {
                      seenClauses.add(normalizedClause);
                      willClauses.push({
                        sectionLabel: section.formSection,
                        fieldLabel: field.label,
                        text: safeString(interpolated)
                      });
                    }
                  }
                }
              }
            }

            // Handle section fields with subFields
            if (field.type === 'section' && field.subFields) {
              field.subFields.forEach(subField => {
                if (subField.conditions && !evaluateConditions(subField.conditions, formValues, subField.conditionLogic)) {
                  return;
                }
                
                if (subField.willClauseText) {
                  const interpolated = interpolateText(subField.willClauseText, formValues);
                  if (interpolated && 
                      !/\{\{field:[^}]+\}\}/.test(interpolated) && 
                      interpolated.trim() !== '' &&
                      !isPlaceholderOrIncomplete(interpolated)) {
                    
                    // CRITICAL: Check for pet care clauses with missing data
                    if (field.id === 'petCarerSection' || field.id === 'substitutePetCarerSection') {
                      const petCarerData = formValues.petCarerData || [];
                      const substitutePetCarerData = formValues.substitutePetCarerData || [];
                      const hasPetCarer = Array.isArray(petCarerData) && petCarerData.length > 0;
                      const hasSubstitutePetCarer = Array.isArray(substitutePetCarerData) && substitutePetCarerData.length > 0;
                      
                      if (field.id === 'petCarerSection' && !hasPetCarer) {
                        console.warn(`[PDF VALIDATION] ⚠️ BLOCKING pet carer clause - no pet carer data: "${interpolated.substring(0, 100)}"`);
                        return; // Skip this clause
                      }
                      
                      if (field.id === 'substitutePetCarerSection' && (!hasPetCarer || !hasSubstitutePetCarer)) {
                        console.warn(`[PDF VALIDATION] ⚠️ BLOCKING substitute pet carer clause - missing data: "${interpolated.substring(0, 100)}"`);
                        return; // Skip this clause
                      }
                    }
                    
                    // CRITICAL: Check for missing subjects BEFORE adding clause
                    const hasMissingSubject = 
                      /\bmy\s+\[missing\s+(?:person|beneficiary)\]/i.test(interpolated) ||
                      /\bfor\s+\[missing\s+(?:person|beneficiary)\]/i.test(interpolated) ||
                      /\brelease\s+and\s+forgive\s+my\s+\[missing/i.test(interpolated) ||
                      /\bno\s+provision\s+.*\s+for\s+my\s+\[missing/i.test(interpolated) ||
                      /\bcare\s+for\s+.*\s+my\s+\[missing/i.test(interpolated) ||
                      /\bunable\s+.*\s+my\s+\[missing/i.test(interpolated) ||
                      /\bupon\s+trust\s+for\s+\[missing/i.test(interpolated) ||
                      /\brelease\s+and\s+forgive\s+my\s+(?:from|\.|$)/i.test(interpolated) ||
                      /\bno\s+provision\s+.*\s+for\s+my\s+\./i.test(interpolated) ||
                      /\bcare\s+for\s+.*\s+my\s+\./i.test(interpolated) ||
                      /\bunable\s+.*\s+my\s+\./i.test(interpolated) ||
                      /\bupon\s+trust\s+for\s+\./i.test(interpolated) ||
                      /\bmy\s+[\.\s]+(?:from|for|care|unable|provision|This)/i.test(interpolated) ||
                      /\bupon\s+trust\s+for\s+[\.\s]+(?:\.|$)/i.test(interpolated) ||
                      // Pet care specific patterns
                      /\brequest\s+that\s+my\s+(?:care|is\s+unable)/i.test(interpolated) && !/\brequest\s+that\s+my\s+\w+\s+(?:care|is\s+unable)/i.test(interpolated);
                    
                    if (hasMissingSubject) {
                      console.warn(`[PDF VALIDATION] ⚠️ BLOCKING clause with missing subject: "${interpolated.substring(0, 100)}"`);
                      return; // Skip this clause
                    }
                    
                    // Normalize clause for duplicate detection
                    const normalizedClause = safeString(interpolated).replace(/\s+/g, ' ').trim().toLowerCase();
                    
                    // Only add if we haven't seen this clause before
                    if (!seenClauses.has(normalizedClause)) {
                      seenClauses.add(normalizedClause);
                      willClauses.push({
                        sectionLabel: section.formSection,
                        fieldLabel: subField.label || field.label,
                        text: safeString(interpolated)
                      });
                    }
                  }
                }
              });
            }

            // Process nested fields if section type
            if (field.type === 'section' && field.subFields) {
              processFields(field.subFields);
            }
          });
        };

        processFields(section.fields);
      });
    }

    // ===== PREFLIGHT VALIDATION GATE =====
    // Comprehensive validation before PDF generation - builds missing[] and warnings[]
    const missing = [];
    const warnings = [];
    const placeholderPatterns = [
      /\btest\s+test/i,              // "test test" or "test test test"
      /\btest\s+test\s+test/i,       // "test test test" explicitly
      /\bmy\s+testing\b/i,           // "my testing"
      /schedule\s+test/i,             // "Schedule test"
      /\[.*?\]/,                      // Bracket placeholders [...]
      /\bto\s+\.\s/,                  // "to . " (blank)
      /\bfor\s{2,}/,                  // Double spaces after "for "
      /\bto\s+\.\.\./,                // "to ..." (ellipsis placeholder)
      /\bI\s+appoint\s+as\s+Trustees/i, // "I appoint as Trustees" (no names)
      /\bpay\s+the\s+income\s+thereof\s+to\s+\.\.\./i, // "pay the income thereof to ..."
      /\bfailed\s+share\s+to\s+\./i, // "failed share to ."
      /\bI\s+give\s+of\s+my\s+net\s+estate\s+to\s+\.\.\./i, // "I give of my net estate to ..."
      /children\s+\]/,                 // Stray bracket like "children ]"
      /\bto\s+during\s+their\s+lifetime/i, // "to  during" (blank life tenant)
      /\band\s+after\s+their\s+death\s+for\s*$/i // "and after their death for " (blank remainder)
    ];
    
    // Scan clauses for unresolved patterns (scheduleReferences already declared above)
    let validationClauseNumber = 0;
    willClauses.forEach((clause) => {
      validationClauseNumber++;
      if (!clause.text) {
        missing.push({
          section: clause.sectionLabel,
          field: clause.fieldLabel,
          clauseNumber: validationClauseNumber,
          issue: 'Empty clause',
          snippet: '(empty)'
        });
        return;
      }
      
      // Detect schedule references
      const scheduleMatch = clause.text.match(/Schedule\s+(\d+)/gi);
      if (scheduleMatch) {
        scheduleMatch.forEach(match => {
          const scheduleNum = match.match(/\d+/);
          if (scheduleNum) {
            scheduleReferences.add(`Schedule ${scheduleNum[0]}`);
          }
        });
      }
      
      // CRITICAL: Check for missing subjects in clauses (e.g., "my [missing person]", "for [missing beneficiary]")
      const missingSubjectPatterns = [
        /\bmy\s+\[missing\s+(?:person|beneficiary)\]/i,
        /\bfor\s+\[missing\s+(?:person|beneficiary)\]/i,
        /\brelease\s+and\s+forgive\s+my\s+\[missing/i,
        /\bno\s+provision\s+.*\s+for\s+my\s+\[missing/i,
        /\bcare\s+for\s+.*\s+my\s+\[missing/i,
        /\bunable\s+.*\s+my\s+\[missing/i,
        /\bupon\s+trust\s+for\s+\[missing/i,
        /\bdeliberately\s+made\s+no\s+provision\s+.*\s+for\s+my\s+\[missing/i,
      ];
      
      missingSubjectPatterns.forEach(pattern => {
        if (pattern.test(clause.text)) {
          const snippet = clause.text.substring(0, 100) + (clause.text.length > 100 ? '...' : '');
          missing.push({
            section: clause.sectionLabel,
            field: clause.fieldLabel,
            clauseNumber: validationClauseNumber,
            issue: 'CRITICAL: Missing subject/person/beneficiary in clause',
            snippet: snippet
          });
        }
      });
      
      // CRITICAL: Check for incomplete Clause 31 (condition without gift)
      if (validationClauseNumber === 31) {
        const clause31Text = clause.text.trim();
        const isIncompleteCondition = /^\(.*\)\s*$/.test(clause31Text) && 
                                       !clause31Text.toLowerCase().includes('i give') &&
                                       !clause31Text.toLowerCase().includes('i appoint') &&
                                       !clause31Text.toLowerCase().includes('i direct') &&
                                       !clause31Text.toLowerCase().includes('i wish');
        
        if (isIncompleteCondition) {
          missing.push({
            section: clause.sectionLabel,
            field: clause.fieldLabel,
            clauseNumber: 31,
            issue: 'CRITICAL: Clause 31 is incomplete - contains only a condition without an actual gift',
            snippet: clause31Text
          });
        }
      }
      
      // Check for placeholder patterns
      placeholderPatterns.forEach(pattern => {
        if (pattern.test(clause.text)) {
          const snippet = clause.text.substring(0, 80) + (clause.text.length > 80 ? '...' : '');
          missing.push({
            section: clause.sectionLabel,
            field: clause.fieldLabel,
            clauseNumber: validationClauseNumber,
            issue: 'Placeholder or incomplete content',
            snippet: snippet
          });
        }
      });
      
      // CRITICAL: Additional check for missing subjects in clause text (catch any that slipped through)
      const hasMissingSubjectInText = 
        /\brelease\s+and\s+forgive\s+my\s+(?:from|\.|$)/i.test(clause.text) ||
        /\bno\s+provision\s+.*\s+for\s+my\s+\./i.test(clause.text) ||
        /\bcare\s+for\s+.*\s+my\s+\./i.test(clause.text) ||
        /\bunable\s+.*\s+my\s+\./i.test(clause.text) ||
        /\bupon\s+trust\s+for\s+\./i.test(clause.text) ||
        /\bmy\s+[\.\s]{2,}(?:from|for|care|unable|provision|This)/i.test(clause.text);
      
      if (hasMissingSubjectInText) {
        const snippet = clause.text.substring(0, 100) + (clause.text.length > 100 ? '...' : '');
        missing.push({
          section: clause.sectionLabel,
          field: clause.fieldLabel,
          clauseNumber: validationClauseNumber,
          issue: 'CRITICAL: Missing subject/person/beneficiary in clause',
          snippet: snippet
        });
      }
      
      // Check for incomplete patterns
      if (isPlaceholderOrIncomplete(clause.text)) {
        const snippet = clause.text.substring(0, 80) + (clause.text.length > 80 ? '...' : '');
        missing.push({
          section: clause.sectionLabel,
          field: clause.fieldLabel,
          clauseNumber: validationClauseNumber,
          issue: 'Incomplete clause',
          snippet: snippet
        });
      }
    });
    
    // Scan formValues for placeholder text
    Object.entries(formValues).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        placeholderPatterns.forEach(pattern => {
          if (pattern.test(value)) {
            missing.push({
              section: 'Form Data',
              field: key,
              clauseNumber: null,
              issue: 'Placeholder text in form field',
              snippet: value.substring(0, 80) + (value.length > 80 ? '...' : '')
            });
          }
        });
      }
    });
    
    // Check for missing required fields (basic check)
    const requiredFields = ['firstName', 'lastName'];
    requiredFields.forEach(field => {
      if (!formValues[field] || String(formValues[field]).trim() === '') {
        missing.push({
          section: 'Personal Information',
          field: field,
          clauseNumber: null,
          issue: 'Required field missing',
          snippet: '(empty)'
        });
      }
    });
    
    // Check for missing signing date (explicitSigningDateFields already declared above)
    const hasSigningDate = explicitSigningDateFields.some(field => {
      const value = formValues[field];
      if (!value || typeof value !== 'string' || !value.trim()) return false;
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const currentYear = new Date().getFullYear();
          return year >= 2000 && year <= currentYear;
        }
      } catch (e) {
        // Check if it's in DD/MM/YYYY format
        if (value.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
          const yearMatch = value.match(/\d{4}/);
          if (yearMatch) {
            const year = parseInt(yearMatch[0]);
            const currentYear = new Date().getFullYear();
            return year >= 2000 && year <= currentYear;
          }
        }
      }
      return false;
    });
    
    if (!hasSigningDate) {
      missing.push({
        section: 'Execution',
        field: 'Signing Date',
        clauseNumber: null,
        issue: 'Missing signing date (leave blank for manual fill OR require user input)',
        snippet: 'Date field will be left blank'
      });
    }
    
    // Group missing items by category
    // CRITICAL: Separate critical issues from regular placeholders
    const criticalBlanks = missing.filter(item => 
      item.issue && (
        item.issue.includes('CRITICAL: Missing subject') ||
        item.issue.includes('CRITICAL: Clause 31') ||
        item.issue.includes('CRITICAL:') ||
        item.issue.includes('blank') || 
        item.issue.includes('Empty') || 
        item.issue.includes('incomplete')
      )
    );
    const placeholders = missing.filter(item => 
      !item.issue || (
        !item.issue.includes('CRITICAL:') &&
        (item.issue.includes('Placeholder') || item.snippet?.includes('test'))
      )
    );
    const executionRequirements = missing.filter(item => item.section === 'Execution' || item.issue.includes('signing date'));
    
    // Calculate missing schedules using the same logic as schedule rendering
    // This ensures Property Trust and BPR Trust schedules are correctly identified
    const schedulesMissing = Array.from(scheduleReferences).filter(scheduleName => {
      // Extract schedule number from scheduleName (e.g., "Schedule 3680359" -> "3680359")
      const scheduleNumMatch = scheduleName.match(/\d+/);
      const scheduleNumber = scheduleNumMatch ? scheduleNumMatch[0] : null;
      
      console.log(`[PDF SCHEDULES MISSING] Checking ${scheduleName}, extracted number: ${scheduleNumber}`);
      
      if (!scheduleNumber) {
        // Can't identify schedule, consider it missing
        console.log(`[PDF SCHEDULES MISSING] ❌ ${scheduleName} - no schedule number found, marking as missing`);
        return true;
      }
      
      // Check if this schedule number matches Property Trust schedule
      const propertyTrustScheduleNum = formValues.propertyTrustScheduleNumber ? 
        String(formValues.propertyTrustScheduleNumber).trim() : '';
      
      console.log(`[PDF SCHEDULES MISSING] Comparing "${propertyTrustScheduleNum}" === "${scheduleNumber}" for Property Trust`);
      
      if (propertyTrustScheduleNum === scheduleNumber) {
        // This is a Property Trust schedule - check if content exists
        const details = formValues.propertyTrustDetails ? 
          String(formValues.propertyTrustDetails).trim() : '';
        const terms = formValues.propertyTrustTerms ? 
          String(formValues.propertyTrustTerms).trim() : '';
        
        const isMissing = !details && !terms;
        console.log(`[PDF SCHEDULES MISSING] Property Trust schedule ${scheduleNumber} - details: ${!!details}, terms: ${!!terms}, isMissing: ${isMissing}`);
        
        // Schedule is missing if both details and terms are empty
        return isMissing;
      }
      
      // Check if this schedule number matches BPR Trust schedule
      const bprTrustScheduleNum = formValues.bprTrustScheduleNumber ? 
        String(formValues.bprTrustScheduleNumber).trim() : '';
      
      console.log(`[PDF SCHEDULES MISSING] Comparing "${bprTrustScheduleNum}" === "${scheduleNumber}" for BPR Trust`);
      
      if (bprTrustScheduleNum === scheduleNumber) {
        // This is a BPR Trust schedule - check if content exists
        const details = formValues.bprTrustDetails ? 
          String(formValues.bprTrustDetails).trim() : '';
        const terms = formValues.bprTrustTerms ? 
          String(formValues.bprTrustTerms).trim() : '';
        
        const isMissing = !details && !terms;
        console.log(`[PDF SCHEDULES MISSING] BPR Trust schedule ${scheduleNumber} - details: ${!!details}, terms: ${!!terms}, isMissing: ${isMissing}`);
        
        // Schedule is missing if both details and terms are empty
        return isMissing;
      }
      
      // For other schedule types, use generic lookup (fallback)
      const scheduleKey = scheduleName.toLowerCase().replace(/\s+/g, '');
      const hasGenericContent = formValues[scheduleKey] || formValues[`${scheduleKey}Data`] || formValues[`${scheduleKey}Details`];
      console.log(`[PDF SCHEDULES MISSING] Generic schedule ${scheduleName} - hasContent: ${!!hasGenericContent}, isMissing: ${!hasGenericContent}`);
      return !hasGenericContent;
    });
    
    console.log(`[PDF SCHEDULES MISSING] Total schedule references: ${scheduleReferences.size}, Missing schedules: ${schedulesMissing.length}`, schedulesMissing);
    
    // Check if any placeholders or missing items exist (including schedules)
    // CRITICAL: Check for missing subjects in clauses before allowing PDF generation
    const hasCriticalMissingSubjects = missing.some(item => 
      item.issue && item.issue.includes('CRITICAL: Missing subject')
    );
    const hasIncompleteClause31 = missing.some(item => 
      item.clauseNumber === 31 && item.issue && item.issue.includes('Clause 31 is incomplete')
    );
    
    const hasPlaceholders = missing.length > 0 || schedulesMissing.length > 0;
    const hasCriticalIssues = hasCriticalMissingSubjects || hasIncompleteClause31;
    
    console.log(`[PDF VALIDATION] Missing items: ${missing.length}, Schedules missing: ${schedulesMissing.length}`);
    console.log(`[PDF VALIDATION] Critical missing subjects: ${hasCriticalMissingSubjects}, Incomplete Clause 31: ${hasIncompleteClause31}`);
    console.log(`[PDF VALIDATION] Has placeholders: ${hasPlaceholders}, Has critical issues: ${hasCriticalIssues}`);
    
    // Helper function to render validation errors report (will be called at the END)
    const renderValidationErrorsReport = () => {
      if (!hasPlaceholders && criticalBlanks.length === 0) return;
      
      // Add new page for validation report
      doc.addPage();
      yPos = margin; // Reset to margin, use ONE cursor
      
      // Title
      checkPageBreak(15);
      doc.setFontSize(16);
      doc.setFont('times', 'bold');
      doc.setTextColor(200, 0, 0); // Red
      doc.text('Draft - Incomplete Items (Do Not Sign)', pageWidth / 2, yPos, { align: 'center' });
      yPos += 12; // Advance Y after title
      
      // Introduction
      if (criticalBlanks.length > 0) {
        doc.setTextColor(200, 0, 0); // Red
        reportLine('⚠️ CRITICAL: This Will contains incomplete clauses and CANNOT be signed.', {
          fontSize: 13,
          bold: true,
          spacingAfter: 8
        });
        reportLine('The following clauses have missing subjects/beneficiaries and must be completed:', {
          fontSize: 11,
          spacingAfter: 10
        });
      } else {
        reportLine('This Will cannot be finalized. Complete all items below before signing.', {
          fontSize: 12,
          spacingAfter: 10
        });
      }
      
      // Critical Blanks (show first and prominently)
      if (criticalBlanks.length > 0) {
        yPos += 4; // Section spacing
        reportLine('Critical Blanks:', {
          fontSize: 12,
          bold: true,
          spacingAfter: 6
        });
        
        const availableWidth = pageWidth - (margin * 2) - 10;
        criticalBlanks.forEach((item) => {
          const itemText = `- ${item.section}: ${item.field}`;
          reportLine(itemText, {
            fontSize: 10,
            indent: 5,
            spacingAfter: 2
          });
          
          if (item.clauseNumber) {
            const clauseText = `  Clause ${item.clauseNumber}: ${item.issue}`;
            reportLine(clauseText, {
              fontSize: 10,
              indent: 10,
              spacingAfter: 2
            });
          }
          
          if (item.snippet) {
            const snippetText = `  ${item.snippet}`;
            reportLine(snippetText, {
              fontSize: 10,
              indent: 10,
              spacingAfter: 4
            });
          }
        });
        yPos += 5; // Section end spacing
      }
      
      // Placeholders
      if (placeholders.length > 0) {
        yPos += 4; // Section spacing
        reportLine('Placeholders Found:', {
          fontSize: 12,
          bold: true,
          spacingAfter: 6
        });
        
        const availableWidth = pageWidth - (margin * 2) - 10;
        placeholders.forEach((item) => {
          const itemText = `- ${item.section}: ${item.field}`;
          reportLine(itemText, {
            fontSize: 10,
            indent: 5,
            spacingAfter: 2
          });
          
          if (item.clauseNumber) {
            const clauseText = `  Clause ${item.clauseNumber}`;
            reportLine(clauseText, {
              fontSize: 10,
              indent: 10,
              spacingAfter: 2
            });
          }
          
          if (item.snippet) {
            const snippetText = `  ${item.snippet}`;
            reportLine(snippetText, {
              fontSize: 10,
              indent: 10,
              spacingAfter: 4
            });
          }
        });
        yPos += 5; // Section end spacing
      }
      
      // Missing Schedules
      if (schedulesMissing.length > 0) {
        yPos += 4; // Section spacing
        reportLine('Missing Schedules:', {
          fontSize: 12,
          bold: true,
          spacingAfter: 6
        });
        
        schedulesMissing.forEach((schedule) => {
          const scheduleText = `- ${schedule}: Content not provided`;
          reportLine(scheduleText, {
            fontSize: 10,
            indent: 5,
            spacingAfter: 4
          });
        });
        yPos += 5; // Section end spacing
      }
      
      // Execution/Witness Requirements
      if (executionRequirements.length > 0) {
        yPos += 4; // Section spacing
        reportLine('Execution/Witness Requirements:', {
          fontSize: 12,
          bold: true,
          spacingAfter: 6
        });
        
        executionRequirements.forEach((item) => {
          const reqText = `- ${item.field}: ${item.issue}`;
          reportLine(reqText, {
            fontSize: 10,
            indent: 5,
            spacingAfter: 4
          });
        });
        yPos += 5; // Section end spacing
      }
      
      // Final warning
      yPos += 10;
      doc.setFontSize(11);
      doc.setFont('times', 'bold');
      doc.setTextColor(200, 0, 0);
      reportLine('DO NOT SIGN THIS DOCUMENT - Complete all items above first.', {
        fontSize: 11,
        bold: true
      });
      doc.setTextColor(0, 0, 0);
    };
    
    // Will content continues on the same page as the intro line (no page break here)
    // The intro line was already added above, so clauses will start directly below it

    // Generate the final Will with hanging indent clause numbering
    // CRITICAL: Show EVERYTHING - do not skip clauses, render with [MISSING] placeholders
    // Note: scheduleReferences is already tracked during validation above
    
    // Build schedule number mapping: old number -> legal number (Schedule 1, Schedule 2, etc.)
    const scheduleNumberMap = new Map();
    let legalScheduleIndex = 1;
    
    // Map Property Trust schedule
    if (formValues.includePropertyTrust === 'Yes' && formValues.propertyTrustScheduleNumber) {
      const oldNumber = String(formValues.propertyTrustScheduleNumber).trim();
      if (oldNumber) {
        scheduleNumberMap.set(oldNumber, legalScheduleIndex);
        console.log(`[PDF SCHEDULE MAP] Property Trust: old "${oldNumber}" -> legal "Schedule ${legalScheduleIndex}"`);
        legalScheduleIndex++;
      }
    }
    
    // Map BPR Trust schedule
    if (formValues.includeBPRTrust === 'Yes' && formValues.bprTrustScheduleNumber) {
      const oldNumber = String(formValues.bprTrustScheduleNumber).trim();
      if (oldNumber && !scheduleNumberMap.has(oldNumber)) {
        scheduleNumberMap.set(oldNumber, legalScheduleIndex);
        console.log(`[PDF SCHEDULE MAP] BPR Trust: old "${oldNumber}" -> legal "Schedule ${legalScheduleIndex}"`);
        legalScheduleIndex++;
      }
    }
    
    console.log(`[PDF SCHEDULE MAP] Total schedule mappings:`, Array.from(scheduleNumberMap.entries()));
    
    // Render will clauses with hanging indent (number and text on same line)
    let clauseNumber = 1;
    willClauses.forEach((clause) => {
      // DO NOT skip clauses - render everything, even if incomplete
      let processedClauseText = clause.text || '';
      
      // Replace placeholder patterns with [MISSING] markers
      if (processedClauseText) {
        // Replace common placeholder patterns with [MISSING] markers
        processedClauseText = processedClauseText.replace(/\btest\s+test\s+test/gi, '[MISSING: content]');
        processedClauseText = processedClauseText.replace(/\btest\s+test/gi, '[MISSING: content]');
        
        // CRITICAL: Replace schedule references with legal schedule numbers BEFORE other processing
        processedClauseText = processedClauseText.replace(/Schedule\s+(\d+)/gi, (match, oldNum) => {
          const legalNum = scheduleNumberMap.get(oldNum);
          if (legalNum) {
            console.log(`[PDF SCHEDULE MAP] Replacing "${match}" with "Schedule ${legalNum}" in clause ${clauseNumber}`);
            return `Schedule ${legalNum}`;
          }
          // If not mapped, still add to references but use original number
          scheduleReferences.add(`Schedule ${oldNum}`);
          return match;
        });
        
        // Detect any remaining schedule references (for unmapped schedules)
        const scheduleMatch = processedClauseText.match(/Schedule\s+(\d+)/gi);
        if (scheduleMatch) {
          scheduleMatch.forEach(match => {
            const scheduleNum = match.match(/\d+/);
            if (scheduleNum) {
              scheduleReferences.add(`Schedule ${scheduleNum[0]}`);
            }
          });
        }
        
        // Replace bracket placeholders with [MISSING] markers
        processedClauseText = processedClauseText.replace(/\[.*?\]/g, (match) => {
          // Keep bracket placeholders but mark them as missing
          if (match.length > 2) {
            return `[MISSING: ${match.slice(1, -1)}]`;
          }
          return match;
        });
        processedClauseText = processedClauseText.replace(/\bto\s+\.\s/g, 'to [MISSING: name] ');
        processedClauseText = processedClauseText.replace(/\bpay\s+the\s+income\s+thereof\s+to\s+\.\.\./gi, 'pay the income thereof to [MISSING: life tenant]');
        processedClauseText = processedClauseText.replace(/\bfailed\s+share\s+to\s+\./gi, 'failed share to [MISSING: beneficiary]');
        processedClauseText = processedClauseText.replace(/\bI\s+give\s+of\s+my\s+net\s+estate\s+to\s+\.\.\./gi, 'I give [MISSING: percentage] of my net estate to [MISSING: beneficiary]');
        processedClauseText = processedClauseText.replace(/children\s+\]/g, 'children [MISSING: details]');
        processedClauseText = processedClauseText.replace(/\band\s+after\s+their\s+death\s+for\s*$/gi, 'and after their death for [MISSING: remainder beneficiary]');
        
        // CRITICAL: Detect missing subjects in common clause patterns
        const missingSubjectPatterns = [
          /\bmy\s+\[missing\s+person\]/gi,
          /\bmy\s+\[missing\s+beneficiary\]/gi,
          /\bfor\s+\[missing\s+person\]/gi,
          /\bfor\s+\[missing\s+beneficiary\]/gi,
          /\brelease\s+and\s+forgive\s+my\s+\[missing/gi,
          /\bno\s+provision\s+.*\s+for\s+my\s+\[missing/gi,
          /\bcare\s+for\s+.*\s+my\s+\[missing/gi,
          /\bunable\s+.*\s+my\s+\[missing/gi,
          /\bupon\s+trust\s+for\s+\[missing/gi,
        ];
        
        missingSubjectPatterns.forEach(pattern => {
          if (pattern.test(processedClauseText)) {
            console.warn(`[PDF VALIDATION] ⚠️ Clause ${clauseNumber} contains missing subject: "${processedClauseText.substring(0, 100)}"`);
          }
        });
      }
      
      // Apply final standardization and sanitization
      processedClauseText = sanitizeUnprofessionalContent(processedClauseText);
      processedClauseText = standardizeAristoneName(processedClauseText);
      
      // Clean whitespace for hanging indent (remove newlines, normalize spaces)
      processedClauseText = String(processedClauseText).replace(/\s*\n\s*/g, ' ').trim();
      
      // CRITICAL: Detect incomplete clauses that should be blocked
      const hasMissingSubject = 
        // Explicit [missing person] markers
        /\[missing\s+(?:person|beneficiary)\]/i.test(processedClauseText) ||
        /\bmy\s+\[missing/i.test(processedClauseText) ||
        /\bfor\s+\[missing/i.test(processedClauseText) ||
        // Patterns indicating empty interpolation (missing name after "my " or "for ")
        /\brelease\s+and\s+forgive\s+my\s+(?:from|\.|$)/i.test(processedClauseText) ||
        /\bno\s+provision\s+.*\s+for\s+my\s+\./i.test(processedClauseText) ||
        /\bcare\s+for\s+.*\s+my\s+\./i.test(processedClauseText) ||
        /\bunable\s+.*\s+my\s+\./i.test(processedClauseText) ||
        /\bupon\s+trust\s+for\s+\./i.test(processedClauseText) ||
        // "my " followed immediately by punctuation or "from" (empty name)
        /\bmy\s+[\.\s]{2,}(?:from|for|care|unable|provision|This)/i.test(processedClauseText) ||
        // "for " followed immediately by punctuation (empty beneficiary)  
        /\bupon\s+trust\s+for\s+[\.\s]+(?:\.|$)/i.test(processedClauseText) ||
        // Double space after "my " indicating missing name
        /\brelease\s+and\s+forgive\s+my\s{2,}from/i.test(processedClauseText) ||
        /\bno\s+provision\s+.*\s+for\s+my\s{2,}\./i.test(processedClauseText);
      
      const isIncompleteCondition = /^\(.*\)\s*$/.test(processedClauseText.trim()) && 
                                     !processedClauseText.toLowerCase().includes('i give') &&
                                     !processedClauseText.toLowerCase().includes('i appoint') &&
                                     !processedClauseText.toLowerCase().includes('i direct') &&
                                     !processedClauseText.toLowerCase().includes('i wish');
      
      // Block clauses with missing subjects or incomplete conditions
      if (hasMissingSubject) {
        console.error(`[PDF VALIDATION] ❌ BLOCKING Clause ${clauseNumber} - contains missing subject: "${processedClauseText.substring(0, 100)}"`);
        // Don't render this clause - it's incomplete
        return; // Skip this clause entirely
      }
      
      if (isIncompleteCondition && clauseNumber === 31) {
        console.error(`[PDF VALIDATION] ❌ BLOCKING Clause 31 - incomplete condition without actual gift: "${processedClauseText}"`);
        // Don't render incomplete Clause 31
        return; // Skip this clause entirely
      }
      
      // Render clause even if empty or incomplete (show [MISSING] markers)
      if (!processedClauseText || processedClauseText.trim() === '') {
        processedClauseText = '[MISSING: clause content]';
      }
      
      // Only number substantive clauses (length > 20 characters or contains content)
      if (processedClauseText.length > 20 || processedClauseText.includes('[MISSING')) {
        yPos = renderNumberedClause(doc, {
          number: clauseNumber,
          text: processedClauseText,
          margin,
          yPos,
          pageWidth,
          pageHeight,
          fontSize: 11.5,
          lineHeight: 5.5,
          spacingAfter: 6,
          numColW: 12
        });
        clauseNumber++;
      } else {
        // Short clauses (like headings) render without numbering
        checkPageBreak(lineHeight * 2);
        doc.setFont('times', 'normal');
        doc.setFontSize(11.5);
        const availableWidth = pageWidth - (margin * 2);
        const lines = doc.splitTextToSize(processedClauseText, availableWidth);
        
        // Check page break before rendering
        const neededHeight = lines.length * 5.5 + 6;
        if (yPos + neededHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        
        // Render each line with proper Y tracking
        let lineY = yPos;
        lines.forEach((line, index) => {
          doc.text(line, margin, lineY);
          lineY += 5.5; // Increment for each line
        });
        yPos = lineY + 6; // Final Y position after spacing
      }
    });
    
    // Add schedules after the last clause (on same page if space allows, otherwise new page)
    // Use sequential legal naming (Schedule 1, Schedule 2, etc.) instead of random numbers
    console.log(`[PDF SCHEDULE] ========== STARTING SCHEDULE RENDERING ==========`);
    console.log(`[PDF SCHEDULE] scheduleReferences.size: ${scheduleReferences.size}`);
    console.log(`[PDF SCHEDULE] scheduleReferences contents:`, Array.from(scheduleReferences));
    console.log(`[PDF SCHEDULE] Current yPos after last clause: ${yPos.toFixed(1)}`);
    console.log(`[PDF SCHEDULE] pageHeight: ${pageHeight}, margin: ${margin}`);
    console.log(`[PDF SCHEDULE] Available space on current page: ${(pageHeight - margin - yPos).toFixed(1)} units`);
    
    if (scheduleReferences.size > 0) {
      let scheduleIndex = 1; // Start with Schedule 1 for legal numbering
      const scheduleArray = Array.from(scheduleReferences);
      console.log(`[PDF SCHEDULE] Processing ${scheduleArray.length} schedule(s):`, scheduleArray);
      
      // CRITICAL: Filter out schedules that don't have content BEFORE rendering
      const schedulesWithContent = scheduleArray.filter(scheduleName => {
        const scheduleNumMatch = scheduleName.match(/\d+/);
        const scheduleNumber = scheduleNumMatch ? scheduleNumMatch[0] : null;
        
        if (!scheduleNumber) return false;
        
        // Check Property Trust schedule
        const propertyTrustScheduleNum = formValues.propertyTrustScheduleNumber ? 
          String(formValues.propertyTrustScheduleNumber).trim() : '';
        if (propertyTrustScheduleNum === scheduleNumber) {
          const hasDetails = formValues.propertyTrustDetails && String(formValues.propertyTrustDetails).trim() !== '';
          const hasTerms = formValues.propertyTrustTerms && String(formValues.propertyTrustTerms).trim() !== '';
          const hasContent = hasDetails || hasTerms;
          console.log(`[PDF SCHEDULE FILTER] Schedule ${scheduleNumber} (Property Trust) - hasContent: ${hasContent}`);
          return hasContent;
        }
        
        // Check BPR Trust schedule
        const bprTrustScheduleNum = formValues.bprTrustScheduleNumber ? 
          String(formValues.bprTrustScheduleNumber).trim() : '';
        if (bprTrustScheduleNum === scheduleNumber) {
          const hasDetails = formValues.bprTrustDetails && String(formValues.bprTrustDetails).trim() !== '';
          const hasTerms = formValues.bprTrustTerms && String(formValues.bprTrustTerms).trim() !== '';
          const hasContent = hasDetails || hasTerms;
          console.log(`[PDF SCHEDULE FILTER] Schedule ${scheduleNumber} (BPR Trust) - hasContent: ${hasContent}`);
          return hasContent;
        }
        
        // For other schedules, check generic fields
        const scheduleKey = scheduleName.toLowerCase().replace(/\s+/g, '');
        const hasGenericContent = formValues[scheduleKey] || formValues[`${scheduleKey}Data`] || formValues[`${scheduleKey}Details`];
        console.log(`[PDF SCHEDULE FILTER] Schedule ${scheduleNumber} (Generic) - hasContent: ${!!hasGenericContent}`);
        return !!hasGenericContent;
      });
      
      console.log(`[PDF SCHEDULE] Filtered schedules: ${schedulesWithContent.length} with content out of ${scheduleArray.length} total`);
      
      schedulesWithContent.forEach((scheduleName, index) => {
        console.log(`[PDF SCHEDULE] ========== PROCESSING SCHEDULE ${index + 1}/${scheduleArray.length} ==========`);
        console.log(`[PDF SCHEDULE] Original scheduleName from references: "${scheduleName}"`);
        console.log(`[PDF SCHEDULE] Current yPos: ${yPos.toFixed(1)}`);
        console.log(`[PDF SCHEDULE] pageHeight: ${pageHeight}, margin: ${margin}`);
        
        // Check if we need a new page - be lenient: only add new page if we're very close to bottom
        // This allows schedule to appear on same page as last clause whenever possible
        // We only need space for the heading initially - content can flow to next page if needed
        const headingHeight = 30; // Space for "Schedule X" heading plus spacing
        const availableSpace = pageHeight - margin - yPos;
        console.log(`[PDF SCHEDULE] Available space calculation: pageHeight (${pageHeight}) - margin (${margin}) - yPos (${yPos.toFixed(1)}) = ${availableSpace.toFixed(1)}`);
        console.log(`[PDF SCHEDULE] Threshold check: availableSpace (${availableSpace.toFixed(1)}) < 40? ${availableSpace < 40}`);
        
        // Only force new page if we're within 40 units of the bottom (very tight)
        // Otherwise, render on same page and let content flow naturally
        if (availableSpace < 40) {
          console.log(`[PDF SCHEDULE] ❌ Very little space remaining (${availableSpace.toFixed(1)} units < 40), adding new page`);
          doc.addPage();
          yPos = margin;
          console.log(`[PDF SCHEDULE] ✅ New page added, yPos reset to: ${yPos}`);
        } else {
          // Add spacing after last clause before schedule
          console.log(`[PDF SCHEDULE] ✅ Enough space (${availableSpace.toFixed(1)} units >= 40), rendering on same page`);
          console.log(`[PDF SCHEDULE] Adding 12 units spacing after last clause`);
          yPos += 12; // Slightly more spacing for visual separation
          console.log(`[PDF SCHEDULE] yPos after spacing: ${yPos.toFixed(1)}`);
        }
        
        // Use legal sequential naming: Schedule 1, Schedule 2, etc.
        const legalScheduleName = `Schedule ${scheduleIndex}`;
        console.log(`[PDF SCHEDULE] Legal schedule name: "${legalScheduleName}" (replacing "${scheduleName}")`);
        console.log(`[PDF SCHEDULE] scheduleIndex: ${scheduleIndex}`);
        
        // Final check before rendering heading - ensure we have space for at least the heading
        const spaceForHeading = yPos + 30;
        const maxAllowedY = pageHeight - margin;
        console.log(`[PDF SCHEDULE] Final heading check: yPos (${yPos.toFixed(1)}) + 30 = ${spaceForHeading.toFixed(1)}, maxAllowedY: ${maxAllowedY.toFixed(1)}`);
        console.log(`[PDF SCHEDULE] Final check condition: ${spaceForHeading.toFixed(1)} > ${maxAllowedY.toFixed(1)}? ${spaceForHeading > maxAllowedY}`);
        
        if (spaceForHeading > maxAllowedY) {
          console.log(`[PDF SCHEDULE] ❌ Final check: not enough space for heading, adding new page`);
          doc.addPage();
          yPos = margin;
          console.log(`[PDF SCHEDULE] ✅ New page added after final check, yPos reset to: ${yPos}`);
        } else {
          console.log(`[PDF SCHEDULE] ✅ Final check passed, enough space for heading`);
        }
        
        console.log(`[PDF SCHEDULE] About to render heading "${legalScheduleName}" at yPos: ${yPos.toFixed(1)}`);
        doc.setFontSize(14);
        doc.setFont('times', 'bold');
        const scheduleTitleWidth = doc.getTextWidth(legalScheduleName);
        console.log(`[PDF SCHEDULE] Heading text width: ${scheduleTitleWidth.toFixed(1)}, centering at: ${(pageWidth / 2 - scheduleTitleWidth / 2).toFixed(1)}`);
        doc.text(legalScheduleName, pageWidth / 2 - scheduleTitleWidth / 2, yPos);
        console.log(`[PDF SCHEDULE] ✅ Heading "${legalScheduleName}" rendered successfully`);
        yPos += 15;
        console.log(`[PDF SCHEDULE] yPos after heading: ${yPos.toFixed(1)}`);
        
        doc.setFontSize(11.5);
        doc.setFont('times', 'normal');
        const availableWidth = pageWidth - (margin * 2);
        
        // Extract schedule number from scheduleName (e.g., "Schedule 2177354" -> "2177354")
        const scheduleNumMatch = scheduleName.match(/\d+/);
        const scheduleNumber = scheduleNumMatch ? scheduleNumMatch[0] : null;
        
        console.log(`[PDF SCHEDULE] Rendering ${scheduleName}, extracted number: ${scheduleNumber}`);
        
        // Map schedule number to actual form fields
        let scheduleData = null;
        
        if (scheduleNumber) {
          // Check if this schedule number matches Property Trust schedule
          const propertyTrustScheduleNum = formValues.propertyTrustScheduleNumber ? 
            String(formValues.propertyTrustScheduleNumber).trim() : '';
          
          console.log(`[PDF SCHEDULE] Property Trust schedule number in form: "${propertyTrustScheduleNum}"`);
          
          if (propertyTrustScheduleNum === scheduleNumber) {
            console.log(`[PDF SCHEDULE] ✅ Matched Property Trust schedule ${scheduleNumber}`);
            // This is a Property Trust schedule - combine details and terms
            const details = formValues.propertyTrustDetails ? 
              String(formValues.propertyTrustDetails).trim() : '';
            const terms = formValues.propertyTrustTerms ? 
              String(formValues.propertyTrustTerms).trim() : '';
            
            console.log(`[PDF SCHEDULE] Property Trust details length: ${details.length}, terms length: ${terms.length}`);
            
            // Combine details and terms if both exist
            if (details && terms) {
              scheduleData = `${details}\n\n${terms}`;
            } else if (details) {
              scheduleData = details;
            } else if (terms) {
              scheduleData = terms;
            }
            
            console.log(`[PDF SCHEDULE] Property Trust scheduleData found: ${!!scheduleData}, length: ${scheduleData?.length || 0}`);
          }
          
          // Check if this schedule number matches BPR Trust schedule
          if (!scheduleData) {
            const bprTrustScheduleNum = formValues.bprTrustScheduleNumber ? 
              String(formValues.bprTrustScheduleNumber).trim() : '';
            
            console.log(`[PDF SCHEDULE] BPR Trust schedule number in form: "${bprTrustScheduleNum}"`);
            console.log(`[PDF SCHEDULE] Comparing "${bprTrustScheduleNum}" === "${scheduleNumber}"`);
            
            if (bprTrustScheduleNum === scheduleNumber) {
              console.log(`[PDF SCHEDULE] ✅ Matched BPR Trust schedule ${scheduleNumber}`);
              // This is a BPR Trust schedule - combine details and terms
              const details = formValues.bprTrustDetails ? 
                String(formValues.bprTrustDetails).trim() : '';
              const terms = formValues.bprTrustTerms ? 
                String(formValues.bprTrustTerms).trim() : '';
              
              console.log(`[PDF SCHEDULE] BPR Trust details exists: ${!!details}, length: ${details.length}`);
              console.log(`[PDF SCHEDULE] BPR Trust terms exists: ${!!terms}, length: ${terms.length}`);
              
              // Combine details and terms if both exist
              if (details && terms) {
                scheduleData = `${details}\n\n${terms}`;
                console.log(`[PDF SCHEDULE] ✅ Combined BPR Trust details + terms, total length: ${scheduleData.length}`);
              } else if (details) {
                scheduleData = details;
                console.log(`[PDF SCHEDULE] ✅ Using BPR Trust details only, length: ${scheduleData.length}`);
              } else if (terms) {
                scheduleData = terms;
                console.log(`[PDF SCHEDULE] ✅ Using BPR Trust terms only, length: ${scheduleData.length}`);
              } else {
                console.log(`[PDF SCHEDULE] ❌ BPR Trust schedule ${scheduleNumber} matched but no content found`);
              }
              
              console.log(`[PDF SCHEDULE] BPR Trust scheduleData found: ${!!scheduleData}, length: ${scheduleData?.length || 0}`);
            } else {
              console.log(`[PDF SCHEDULE] BPR Trust schedule number "${bprTrustScheduleNum}" does not match "${scheduleNumber}"`);
            }
          }
        }
        
        // Fallback: Try generic lookup (for other schedule types)
        if (!scheduleData) {
          scheduleData = formValues[scheduleName.toLowerCase().replace(/\s+/g, '')] || 
                        formValues[`${scheduleName}Data`] ||
                        formValues[`${scheduleName}Details`];
        }
        
        // CRITICAL: Skip rendering schedule if no content exists
        if (!scheduleData || (typeof scheduleData === 'string' && !scheduleData.trim())) {
          console.log(`[PDF SCHEDULE] ❌ SKIPPING ${legalScheduleName} - no content found`);
          console.log(`[PDF SCHEDULE] scheduleName: "${scheduleName}", scheduleNumber: "${scheduleNumber}"`);
          console.log(`[PDF SCHEDULE] Property Trust schedule: ${formValues.propertyTrustScheduleNumber}, BPR Trust schedule: ${formValues.bprTrustScheduleNumber}`);
          // Don't render this schedule - skip to next one
          scheduleIndex++;
          return; // Skip this schedule entirely
        }
        
        if (scheduleData && typeof scheduleData === 'string' && scheduleData.trim()) {
          console.log(`[PDF SCHEDULE] ✅ Schedule content found, length: ${scheduleData.length} characters`);
          console.log(`[PDF SCHEDULE] Rendering schedule content starting at yPos: ${yPos.toFixed(1)}`);
          const scheduleLines = doc.splitTextToSize(scheduleData, availableWidth);
          console.log(`[PDF SCHEDULE] Schedule content split into ${scheduleLines.length} lines`);
          let lineY = yPos;
          let pageBreaksAdded = 0;
          scheduleLines.forEach((line, lineIndex) => {
            // Check for page break before each line
            if (lineY + 5.5 > pageHeight - margin) {
              console.log(`[PDF SCHEDULE] Page break needed at line ${lineIndex + 1}/${scheduleLines.length} (lineY: ${lineY.toFixed(1)})`);
              doc.addPage();
              lineY = margin;
              pageBreaksAdded++;
            }
            doc.text(line, margin, lineY);
            lineY += 5.5;
          });
          yPos = lineY;
          console.log(`[PDF SCHEDULE] Schedule content rendered, pageBreaks added: ${pageBreaksAdded}, final yPos: ${yPos.toFixed(1)}`);
        } else {
          console.log(`[PDF SCHEDULE] ❌ No schedule content found for "${legalScheduleName}"`);
          // Schedule stub - clearly mark as missing
          // Check for page break before missing content
          if (yPos + 20 > pageHeight - margin) {
            console.log(`[PDF SCHEDULE] Not enough space for missing content message, adding new page`);
            doc.addPage();
            yPos = margin;
          }
          doc.setFont('times', 'bold');
          doc.setTextColor(200, 0, 0);
          console.log(`[PDF SCHEDULE] Rendering missing content message for "${legalScheduleName}"`);
          doc.text(`[MISSING: ${legalScheduleName} content]`, margin, yPos);
          doc.setTextColor(0, 0, 0);
          yPos += 10;
          doc.setFont('times', 'normal');
          const stubLines = doc.splitTextToSize('This schedule is referenced in the Will but the content has not been provided.', availableWidth);
          let lineY = yPos;
          stubLines.forEach(line => {
            // Check for page break before each line
            if (lineY + 5.5 > pageHeight - margin) {
              doc.addPage();
              lineY = margin;
            }
            doc.text(line, margin, lineY);
            lineY += 5.5;
          });
          yPos = lineY;
        }
        
        console.log(`[PDF SCHEDULE] ========== COMPLETED SCHEDULE ${index + 1}/${scheduleArray.length} ==========`);
        console.log(`[PDF SCHEDULE] Final yPos after schedule content: ${yPos.toFixed(1)}`);
        console.log(`[PDF SCHEDULE] Incrementing scheduleIndex from ${scheduleIndex} to ${scheduleIndex + 1}`);
        
        // Increment schedule index for next schedule
        scheduleIndex++;
      });
      
      console.log(`[PDF SCHEDULE] ========== ALL SCHEDULES RENDERED ==========`);
      console.log(`[PDF SCHEDULE] Total schedules rendered: ${scheduleArray.length}`);
      console.log(`[PDF SCHEDULE] Final yPos: ${yPos.toFixed(1)}`);
    } else {
      console.log(`[PDF SCHEDULE] No schedules to render (scheduleReferences.size = 0)`);
    }

    // ===== EXECUTION PAGE (SIGNATURE PAGE) =====
    // NOTE: Execution page is ALWAYS included, even in draft mode (with DRAFT watermark)
    // NOTE: Page numbering is done AFTER all pages are added (at the very end)
    doc.addPage();
    
    // Helper function to draw identical witness boxes - MUST be identical for both
    // NO outer border - clean professional look with just field lines
    const drawWitnessBox = (doc, x, y, w, h, title) => {
      const pad = 6;
      const lineX1 = x + pad;
      const lineX2 = x + w - pad;

      // NO outer rect() - both witness boxes render identically without borders
      // Calculate positions - ensure all content fits
      let cy = y + 8;
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text(title, x + pad, cy);

      cy += 7;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text('SIGNATURE', x + pad, cy);
      cy += 6;
      doc.setLineWidth(0.2);
      doc.setDrawColor(0, 0, 0);
      doc.line(lineX1, cy, lineX2, cy);

      cy += 10;
      doc.text('Full name', x + pad, cy);
      cy += 6;
      doc.line(lineX1, cy, lineX2, cy);

      cy += 10;
      doc.text('Address', x + pad, cy);
      cy += 6;
      doc.line(lineX1, cy, lineX2, cy);
      // Second address line for better structure
      cy += 8;
      doc.line(lineX1, cy, lineX2, cy);

      cy += 10;
      doc.text('Phone', x + pad, cy);
      cy += 6;
      doc.line(lineX1, cy, lineX2, cy);

      cy += 10;
      doc.text('Occupation', x + pad, cy);
      cy += 6;
      doc.line(lineX1, cy, lineX2, cy);
    };

    // Render execution page with clean grid layout
    let y = 60; // Start position
    const contentW = pageWidth - margin * 2;

    // --- Testator signature block ---
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Signed by ${cleanName}, to give effect to this Will, on`, margin, y);
    y += 14;

    // Date line + value - MUST use execution/signing date, NOT DOB
    // Explicitly exclude DOB fields and validate date is reasonable
    let executionDate = null;
    
    // DOB-related field names to EXCLUDE (never use these)
    const dobFieldPatterns = [
      /dateOfBirth/i,
      /dob/i,
      /birthDate/i,
      /birthday/i,
      /dateOfBirth/i,
      /birth/i
    ];
    
    // Check ONLY explicit signing date fields - no fallbacks (explicitSigningDateFields already declared above)
    for (const field of explicitSigningDateFields) {
      // Extra safety: Skip if field name contains DOB patterns
      if (dobFieldPatterns.some(pattern => pattern.test(field))) {
        continue;
      }
      
      if (formValues[field]) {
        const dateValue = formValues[field];
        
        if (typeof dateValue === 'string' && dateValue.trim()) {
          try {
            const date = new Date(dateValue);
            if (!isNaN(date.getTime())) {
              // Validate date is reasonable (not too old - must be after 2000, not future)
              const year = date.getFullYear();
              const currentYear = new Date().getFullYear();
              
              // Date must be between 2000 and current year (reasonable for will signing)
              if (year >= 2000 && year <= currentYear) {
                executionDate = date.toLocaleDateString('en-GB');
                break;
              }
            }
          } catch (e) {
            // If parsing fails, check if it's already in DD/MM/YYYY format
            if (dateValue.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
              // Validate year in the string
              const yearMatch = dateValue.match(/\d{4}/);
              if (yearMatch) {
                const year = parseInt(yearMatch[0]);
                const currentYear = new Date().getFullYear();
                if (year >= 2000 && year <= currentYear) {
                  executionDate = dateValue;
                  break;
                }
              }
            }
          }
        }
      }
    }
    
    // CRITICAL: If no valid execution date found, leave it BLANK (do not use DOB or current date)
    // This ensures the date field is never auto-filled with incorrect data

    doc.text('Date', margin, y);
    doc.setLineWidth(0.35);
    doc.setDrawColor(0, 0, 0);
    doc.line(margin + 18, y + 1, margin + 90, y + 1);
    // Only print date if valid execution date was found (leave blank otherwise)
    if (executionDate) {
      doc.setFontSize(11);
      doc.text(String(executionDate), margin + 20, y); // prints on same baseline
    }
    // If executionDate is null, the line remains blank (user fills in at signing)
    y += 14;

    // Testator signature line
    if (testatorSignature && 
        typeof testatorSignature === 'string' && 
        testatorSignature.startsWith('data:image') &&
        testatorSignature.length > 100 &&
        testatorSignature.length < 3000000) {
      try {
        doc.addImage(testatorSignature, 'PNG', margin, y, 90, 25);
        y += 30;
      } catch {
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.text('TESTATOR SIGNATURE', margin, y);
        y += 8;
        doc.setLineWidth(0.35);
        doc.line(margin, y, margin + 90, y);
        y += 18;
      }
    } else {
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text('TESTATOR SIGNATURE', margin, y);
      y += 8;
      doc.setLineWidth(0.35);
      doc.line(margin, y, margin + 90, y);
      y += 18;
    }

    // Attestation sentence
    doc.setFont('times', 'normal');
    doc.setFontSize(11.5);
    doc.text(
      `We confirm this Will was signed first by ${cleanName} in our presence and then by`,
      margin,
      y
    );
    y += 6;
    doc.text(`both of us in the presence of ${cleanName}.`, margin, y);
    y += 18;

    // --- Witness boxes (2 columns) ---
    const gap = 10;
    const colW = (contentW - gap) / 2;
    const boxH = 70; // Increased from 55 to ensure all fields (including Occupation) fit inside box

    const w1x = margin;
    const w2x = margin + colW + gap;

    // Draw both witness boxes using the SAME function to ensure they're identical
    // This guarantees both boxes have identical styling, spacing, and structure
    drawWitnessBox(doc, w1x, y, colW, boxH, 'Witness 1');
    drawWitnessBox(doc, w2x, y, colW, boxH, 'Witness 2');

    // ===== VALIDATION ERRORS APPENDIX (AT THE END) =====
    // Render validation errors report at the end of the document
    renderValidationErrorsReport();

    // ===== ADD PAGE NUMBERS AND WATERMARKS (AFTER ALL PAGES ARE CREATED) =====
    // CRITICAL: Get total pages AFTER all pages including execution page and validation report are added
    const totalPages = doc.internal.getNumberOfPages();
    // Page numbering excludes cover page: cover = no number, content pages = Page 1 of N (where N = totalPages - 1)
    const contentPagesTotal = totalPages - 1; // Exclude cover page from count
    
    // Add page numbers and watermarks to all pages
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Cover page (page 1): no page number
      if (i === 1) {
        // Add DRAFT watermark if placeholders detected (skip cover page for watermark)
        // No page number on cover
        continue;
      }
      
      // All other pages: show page number (Page X of N, where X = i - 1, N = totalPages - 1)
      const displayPageNumber = i - 1; // Page 2 becomes "Page 1", Page 3 becomes "Page 2", etc.
      
      // DRAFT watermark disabled - validation errors are shown in appendix at the end instead
      
      // Add page number - exclude cover from count
      doc.setFontSize(10);
      doc.setFont('times', 'normal');
      doc.setTextColor(100, 100, 100);
      const pageText = `Page ${displayPageNumber} of ${contentPagesTotal}`;
      const pageTextWidth = doc.getTextWidth(pageText);
      // Ensure page number stays within margins
      const pageNumberX = Math.min(pageWidth - margin - pageTextWidth, pageWidth - margin - 20);
      doc.text(pageText, pageNumberX, pageHeight - 15);
    }
    
    // Return doc and validation results for UI display
    return {
      doc,
      missingItems: missing,
      schedulesMissing: Array.from(schedulesMissing),
      hasPlaceholders: hasPlaceholders,
      criticalIssues: criticalBlanks,
      hasCriticalIssues: criticalBlanks.length > 0
    };
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
