import { jsPDF } from 'jspdf';
import formSchema from '../data/Complete-WillSuite-Form-Data.json';
import { buildClauses } from '../utils/buildClauses.js';
import { CLIENT_VISIBLE_MAX_SECTION_INDEX } from '../constants/clientMode.js';
import { formatExcludedPersonForClause } from '../utils/excludedPersonFormat.js';

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

// Parse PNG dimensions from base64 data URL (synchronous)
const getPngDimensions = (dataUrl) => {
  try {
    const base64 = dataUrl.split(',')[1];
    if (!base64) return null;
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i);
    if (data.length < 24) return null;
    return {
      width: (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19],
      height: (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23],
    };
  } catch {
    return null;
  }
};

// Draw signature image in a fixed box: "contain" scaling, never upscale, padding, centered
const drawSignatureInBox = (doc, dataUrl, boxX, boxY, boxW, boxH, padPoints = 6) => {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image') || dataUrl.length < 100) return false;
  const dims = getPngDimensions(dataUrl);
  if (!dims || dims.width <= 0 || dims.height <= 0) return false;
  const maxW = boxW - padPoints * 2;
  const maxH = boxH - padPoints * 2;
  if (maxW <= 0 || maxH <= 0) return false;
  const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
  const drawW = dims.width * scale;
  const drawH = dims.height * scale;
  const cx = boxX + (boxW - drawW) / 2;
  const cy = boxY + (boxH - drawH) / 2;
  try {
    doc.addImage(dataUrl, 'PNG', cx, cy, drawW, drawH);
    return true;
  } catch {
    return false;
  }
};

// Comprehensive text normalization function
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

// Sanitize punctuation in clause text (double periods, stray punctuation)
// DEPRECATED: Use normalizeClauseText instead
const sanitizeClausePunctuation = (text) => {
  return normalizeClauseText(text);
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
    /\bI\s+appoint\s+as\s+Trustees\b/i,  // "I appoint as Trustees" (no names between - must be word boundary to avoid false positives)
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
    
    // Known placeholder names that must never appear in PDF
    /\bChattel Recipient Name\b/i,
    /\bExcluded Person Name\b/i,
    /\bJohn Debtor Smith\b/i,
    /\bDigital Executor Name\b/i,
    /\bSeparate Trustee Name\b/i,
    /\bAuthorised Signatory Name\b/i,
    /\bInterpreter Name\b/i,
    
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
    // CRITICAL FIX: Use separateTrusteeData (not flitTrustees) - this is where FLIT trustees are stored
    if (formValues.appointSeparateTrusteesFLIT === 'Yes') {
      const separateTrusteeData = formValues.separateTrusteeData || [];
      const hasValidTrustees = Array.isArray(separateTrusteeData) && separateTrusteeData.length > 0 &&
        separateTrusteeData.some(item => 
          item && typeof item === 'object' && 
          (item.firstName || item.lastName || item.address1)
        );
      if (!hasValidTrustees) {
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
    // Pets: if user says Yes, require pet carer details
    const petCarerList = formValues.petCarerData || formValues.petCarerSectionData || [];
    if (!Array.isArray(petCarerList) || petCarerList.length === 0) {
      criticalIssues.push({
        section: 'Other Provisions',
        fieldId: 'petCarerSection',
        message: 'Pet carer details are required when "Provisions for pets" is Yes.',
      });
    }
    
    if (formValues.substitutePetCarer === 'Yes') {
      const subPetCarerList = formValues.substitutePetCarerData || formValues.substitutePetCarerSectionData || [];
      if (!Array.isArray(subPetCarerList) || subPetCarerList.length === 0) {
        criticalIssues.push({
          section: 'Other Provisions',
          fieldId: 'substitutePetCarerSection',
          message: 'Substitute pet carer details are required when "Substitute pet carer" is Yes.',
        });
      }
    }
    
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
    if (clause.operator === 'ne') return value !== clause.value;
    if (clause.operator === 'includes') {
      return Array.isArray(value) && value.includes(clause.value);
    }
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

// Bold markers for client-entered values in PDF (Unicode private use, minimal width)
const BOLD_START = '\uE001';
const BOLD_END = '\uE002';

// Wraps resolved client values with bold markers for PDF rendering. Exclusions: unresolved placeholders, empty strings.
const wrapClientValue = (val) => {
  if (val == null || val === '') return '';
  const s = String(val);
  if (s.trim() === '') return s;
  return BOLD_START + s + BOLD_END;
};

// Text interpolation function (matching FormRenderer logic)
// Optional third arg: { schema } so organPurposeGroup can resolve field options (used when called from generatePDFWithJSPDF).
const interpolateText = (text, values, options = {}) => {
  const schema = options.schema || options.formSchema;

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
      console.log(`[PDF INTERPOLATE] 🔄 Replacing bracket placeholder "${placeholder}" with "${fieldRef}"`);
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
          console.log(`[PDF INTERPOLATE] Alias mapping: ${fullKey.split(':')[0]} -> ${sectionId} (raw value was: ${raw})`);
        } else {
          // Even if same ID, ensure we're using the correct section ID for data lookup
          console.log(`[PDF INTERPOLATE] Using section ID: ${sectionId} (raw value was: ${raw})`);
        }
      }
    }

    if (subField === 'fullDetails' || subField === 'fullList') {
      // Special handling: chattelsGiftBeneficiarySection uses chattelsGiftBeneficiaryName when no array data
      // When name is empty, return placeholder so clause is blocked (hasUnresolved stays true)
      if (sectionId === 'chattelsGiftBeneficiarySection') {
        const name = values.chattelsGiftBeneficiaryName;
        if (name && String(name).trim() !== '') {
          return wrapClientValue(String(name).trim());
        }
        return `{{field:${fullKey}}}`;
      }
      
      // CRITICAL FIX: Special handling for executor sections - check for Aristone selection
      if (sectionId === 'executorsSection') {
        // Check if Aristone was selected via chooseAristoneExecutor
        if (values.chooseAristoneExecutor === 'Aristone') {
          return wrapClientValue("Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG");
        }
        // Fall through to normal array handling
      }
      
      if (sectionId === 'substituteExecutorsSection') {
        // Check if Aristone was selected via chooseAristoneSubstituteExecutor
        if (values.chooseAristoneSubstituteExecutor === 'Aristone') {
          return wrapClientValue("Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG");
        }
        // Fall through to normal array handling
      }
      
      // CRITICAL FIX: Special handling for pet carer sections when using fullDetails
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
          console.log(`[PDF INTERPOLATE] separateTrusteesSection:fullDetails - Looking for data:`, {
            hasPetCarerData: !!values.petCarerData,
            hasSubstitutePetCarerData: !!values.substitutePetCarerData,
            hasSeparateTrusteeData: !!values.separateTrusteeData,
            hasSeparateTrusteesData: !!values.separateTrusteesData,
            hasSeparateTrusteesSectionData: !!values.separateTrusteesSectionData,
            sectionData,
            sectionDataType: Array.isArray(sectionData) ? 'array' : typeof sectionData,
            sectionDataLength: Array.isArray(sectionData) ? sectionData.length : 'N/A',
            firstItem: Array.isArray(sectionData) && sectionData.length > 0 ? sectionData[0] : null,
            firstItemType: Array.isArray(sectionData) && sectionData.length > 0 ? typeof sectionData[0] : 'N/A',
            availableKeys: Object.keys(values).filter(k => k.includes('separate') || k.includes('Trustee') || k.includes('pet') || k.includes('carer')).slice(0, 15)
          });
        }
        
        // CRITICAL: Only process if we have valid array data - never use testator name as fallback
        // If sectionData is null, undefined, not an array, or empty, return unresolved marker immediately
        if (!sectionData || !Array.isArray(sectionData) || sectionData.length === 0) {
          if (sectionId === 'separateTrusteesSection') {
            console.log(`[PDF INTERPOLATE] separateTrusteesSection:fullDetails - ❌ No valid array data found, returning unresolved marker`);
          }
          return `{{field:${sectionId}:${subField}}}`;
        }
        
        if (sectionData.length > 0) {
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
                  console.log(`[PDF INTERPOLATE] ${sectionId}:fullDetails - Detected exact placeholder string: "${item}"`);
                  return ''; // Return empty to mark as incomplete
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
              const addressParts = [
                item.address1,
                item.address2,
                item.address3,
                item.city,
                item.postcode
              ].filter(Boolean);
              const address = addressParts.join(', ');
              
              // Validate we have at least name (firstName or lastName) and address1
              if ((!name || name.trim() === '') || (!address || !item.address1)) {
                // Debug logging for separate trustees when validation fails
                if (sectionId === 'separateTrusteesSection') {
                  console.log(`[PDF INTERPOLATE] separateTrusteesSection:fullDetails - Validation failed for item:`, {
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
            console.log(`[PDF INTERPOLATE] separateTrusteesSection:fullDetails - formattedItems after filter:`, {
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
            const testatorFullName = [values.title, testatorFirstName, values.middleName, testatorLastName].filter(Boolean).join(' ').trim();
            
            if (testatorFullName && result.includes(testatorFullName)) {
              console.error(`[PDF INTERPOLATE] ❌ CRITICAL ERROR: Result contains testator name "${testatorFullName}" for ${sectionId}:fullDetails! Result: "${result}"`);
              console.error(`[PDF INTERPOLATE] ❌ This should NEVER happen - returning unresolved marker to block clause`);
              return `{{field:${sectionId}:${subField}}}`;
            }
            
            // Debug logging for separate trustees
            if (sectionId === 'separateTrusteesSection') {
              console.log(`[PDF INTERPOLATE] separateTrusteesSection:fullDetails - ✅ Returning interpolated result: "${result}"`);
            }
            
            return wrapClientValue(result);
          } else {
            // No valid formatted items after filtering - return unresolved marker
            if (sectionId === 'separateTrusteesSection') {
              console.log(`[PDF INTERPOLATE] separateTrusteesSection:fullDetails - ❌ No valid formatted items after filtering, returning unresolved marker`);
            }
            return `{{field:${sectionId}:${subField}}}`;
          }
        }
        
        // This should never be reached due to early return above, but add guard just in case
        if (sectionId === 'separateTrusteesSection') {
          console.warn(`[PDF INTERPOLATE] separateTrusteesSection:fullDetails - ⚠️ Unexpected code path, returning unresolved marker`);
        }
        return `{{field:${sectionId}:${subField}}}`;
      }
      
      // CRITICAL FIX: For fullDetails on pet carer and separate trustees sections, 
      // NEVER fall through to generic array handling - we already handled these above
      // This prevents accidentally returning testator name or other wrong data
      if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && subField === 'fullDetails') {
        console.warn(`[PDF INTERPOLATE] ⚠️ ${sectionId}:fullDetails - Should have been handled above, returning unresolved marker`);
        return `{{field:${sectionId}:${subField}}}`;
      }
      
      // CRITICAL FIX: For fullDetails on pet carer and separate trustees sections,
      // NEVER use generic array fallback - we already handled these above
      if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && 
          (subField === 'fullDetails' || subField === 'fullList')) {
        console.warn(`[PDF INTERPOLATE] ⚠️ ${sectionId}:${subField} - Should have been handled above, returning unresolved marker`);
        return `{{field:${sectionId}:${subField}}}`;
      }

      if (
        (sectionId === 'excludedPersonSection' || sectionId === 'excludedPersonsSection') &&
        (subField === 'fullDetails' || subField === 'fullList')
      ) {
        const array = values.excludedPersonData || [];
        if (Array.isArray(array) && array.length > 0) {
          const resolved = array.map(formatExcludedPersonForClause).filter(Boolean).join('; ');
          return wrapClientValue(resolved);
        }
        return '';
      }

      const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
      const array = values[fallbackId] || values[sectionId] || [];
      if (Array.isArray(array) && array.length > 0) {
        const resolved = array.map(item =>
          typeof item === 'object'
            ? Object.values(item).filter(Boolean).join(', ')
            : item
        ).join('; ');
        // Block known placeholder strings - return unresolved so clause is omitted
        const placeholderNames = [
          'Chattel Recipient Name', 'Excluded Person Name', 'John Debtor Smith',
          'Digital Executor Name', 'Separate Trustee Name', 'Authorised Signatory Name', 'Interpreter Name',
          'Testing the Per Carer works', 'Testing the Per Carer', 'Per Carer works' // CRITICAL FIX: Block pet carer placeholder text
        ];
        const isPlaceholder = placeholderNames.some(p =>
          resolved === p || resolved.startsWith(p + ';') || resolved.endsWith('; ' + p) || resolved.includes('; ' + p + ';') ||
          resolved.includes('Testing') || resolved.includes('Per Carer') // CRITICAL FIX: Also block if contains test keywords
        );
        if (isPlaceholder) return `{{field:${fullKey}}}`;
        return wrapClientValue(resolved);
      }
      return '';
    }

    if (subField === 'formattedAmount') {
      const rawValue = values[sectionId] || values[fullKey];
      return wrapClientValue(formatCurrencyValue(rawValue));
    }

    // Handle 'value' subField - special handling for organ donation fields
    if (subField === 'value') {
      // Special handling for organ donation fields - if empty, return appropriate fallback
      if (sectionId === 'specificOrgansToDonate' || sectionId === 'specificOrgansToExclude') {
        const organValue = values[sectionId] || values[fullKey] || '';
        if (organValue && String(organValue).trim() !== '') {
          return wrapClientValue(String(organValue).trim());
        }
        // If organs are empty but purposes are selected, use generic phrase (not client-entered, no bold)
        return 'organs as appropriate';
      }
      
      // Try direct field lookup
      const directValue = values[sectionId] || values[fullKey];
      if (directValue != null && directValue !== '') {
        return wrapClientValue(String(directValue));
      }
      return '';
    }

    // Handle special case: selectedPurposes for organPurposeGroup
    if (subField === 'selectedPurposes' && sectionId === 'organPurposeGroup') {
      const selectedPurposes = values[sectionId] || [];
      if (Array.isArray(selectedPurposes) && selectedPurposes.length > 0 && schema?.formSections) {
        // Get the field definition to access willClauseTextFragment
        const purposeField = schema.formSections
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
            return wrapClientValue(selectedFragments.join(' and/or '));
          }
        }
      }
      // Default when no purposes selected (not client-entered, no bold)
      return 'any lawful purpose';
    }

    // Handle special Aristone professional selections with auto-population
    if (['professionalExecutorSelection', 'substituteProfessionalExecutorSelection', 
         'professionalTrusteeSelection', 'substituteProfessionalTrusteeSelection'].includes(sectionId) && 
        subField === 'fullDetails') {
      const selectionValue = values[sectionId];
      
      if (selectionValue === 'Aristone') {
        return wrapClientValue(`${getCanonicalFirmName()}, SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG`);
      } else if (selectionValue === 'Other') {
        const otherDetailsField = sectionId.replace('Selection', 'OtherDetails');
        const otherDetails = values[otherDetailsField];
        if (otherDetails && otherDetails.trim()) {
          return wrapClientValue(otherDetails.trim());
        }
      }
      
      return '';
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
            return fieldValue != null ? safeString(String(fieldValue).trim()) : '';
          })
          .filter(Boolean);
        
        if (mappedValues.length > 0) {
          // Join with "and" for multiple items, or just return single value
          const joined = mappedValues.length === 1
            ? mappedValues[0]
            : mappedValues.length === 2
            ? mappedValues.join(' and ')
            : mappedValues.slice(0, -1).join(', ') + ', and ' + mappedValues[mappedValues.length - 1];
          return wrapClientValue(joined);
        }
      }
      // CRITICAL FIX: Return placeholder to mark clause as incomplete if no data
      return `{{field:${sectionId}:${subField}}}`;
    }
    
    // Handle nested section fields
    const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
    const sectionData = values[fallbackId] || values[sectionId];
    
    if (Array.isArray(sectionData) && sectionData.length > 0) {
      if (typeof sectionData[0] !== 'object') {
        return wrapClientValue(sectionData.map(safeString).join(', '));
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
        return wrapClientValue(mappedValues.join(', '));
      }
    } else if (typeof sectionData === 'object' && sectionData !== null) {
      const fieldValue = sectionData[subField] || 
                       sectionData[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                       sectionData[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
                       sectionData[subField.toLowerCase()] ||
                       sectionData[subField.toUpperCase()];
      if (fieldValue && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
        return wrapClientValue(safeString(fieldValue));
      }
    }

    // CRITICAL FIX: For fullDetails on pet carer and separate trustees sections,
    // NEVER use generic fallbacks that might return testator name
    // These sections MUST have valid array data or return unresolved marker
    // MUST CHECK THIS BEFORE any generic fallbacks to prevent testator name substitution
    if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && 
        (subField === 'fullDetails' || subField === 'fullList')) {
      console.warn(`[PDF INTERPOLATE] ⚠️ ${sectionId}:${subField} - Reached generic fallback section, returning unresolved marker (preventing testator name fallback)`);
      return `{{field:${sectionId}:${subField}}}`;
    }

    // Handle direct field references
    if (subField === 'value') {
      const directValue = values[sectionId];
      if (directValue != null) {
        return wrapClientValue(safeString(directValue));
      }
    }

    // Try other naming conventions (matching FormRenderer)
    const customValue = values[`${sectionId}:${subField}`] || 
                       values[`${sectionId}${subField}`] || 
                       values[`${sectionId}_${subField}`] ||
                       values[`${sectionId}.${subField}`];
    if (customValue) return wrapClientValue(safeString(customValue));

    // Try direct field lookup
    const directField = values[sectionId];
    if (directField != null) {
      if (Array.isArray(directField)) {
        return wrapClientValue(directField.map(safeString).filter(Boolean).join(', '));
      }
      if (typeof directField === 'string' || typeof directField === 'number') {
        return wrapClientValue(safeString(directField));
      }
    }

    // CRITICAL FIX: For fullDetails on pet carer and separate trustees sections,
    // NEVER return empty string - always return unresolved marker to ensure clause is blocked
    if ((sectionId === 'petCarerSection' || sectionId === 'substitutePetCarerSection' || sectionId === 'separateTrusteesSection') && 
        (subField === 'fullDetails' || subField === 'fullList')) {
      console.warn(`[PDF INTERPOLATE] ⚠️ ${sectionId}:${subField} - Reached final fallback, returning unresolved marker (preventing empty string/testator name)`);
      return `{{field:${sectionId}:${subField}}}`;
    }

    // Final fallback: try the full key as a direct field name
    const fullKeyValue = values[fullKey];
    if (fullKeyValue != null) {
      if (Array.isArray(fullKeyValue)) {
        return wrapClientValue(fullKeyValue.map(safeString).filter(Boolean).join(', '));
      }
      return wrapClientValue(safeString(fullKeyValue));
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
      
      const lifeTenantBold = lifeTenant ? wrapClientValue(lifeTenant) : lifeTenant;
      processed = processed.replace(/\[Life Tenant Name\]/g, lifeTenantBold);
      processed = processed.replace(/to __ during/g, lifeTenant ? `to ${lifeTenantBold} during` : 'to __ during');
      processed = processed.replace(/to __/g, lifeTenant ? `to ${lifeTenantBold}` : 'to __');
    }
    
    // FLIT Final beneficiaries placeholders
    if (processed.includes('[Final Beneficiaries') || processed.includes('for __')) {
      const finalBeneficiaries = values.beneficiariesDetails ||
                               values.trustEndDistributionDetails ||
                               values.flitFinalBeneficiaries ||
                               values.finalBeneficiaries || 
                               values.finalBeneficiaryDetails || 
                               'my children who survive me';
      const isClientValue = !!(values.beneficiariesDetails || values.trustEndDistributionDetails ||
        values.flitFinalBeneficiaries || values.finalBeneficiaries || values.finalBeneficiaryDetails);
      const finalBeneficiariesBold = isClientValue ? wrapClientValue(finalBeneficiaries) : finalBeneficiaries;

      processed = processed.replace(/\[Final Beneficiaries[^\]]*\]/g, finalBeneficiariesBold);
      processed = processed.replace(/for __ /g, `for ${finalBeneficiariesBold} `);
      processed = processed.replace(/for __$/g, `for ${finalBeneficiariesBold}`);
      processed = processed.replace(/and after their death for $/g, `and after their death for ${finalBeneficiariesBold}`);
    }
    
    // Gender pronouns
    const gender = values.gender || 'Other';
    const pronounHis = gender === 'Female' ? 'her' : gender === 'Male' ? 'his' : 'their';
    const pronounHe = gender === 'Female' ? 'she' : gender === 'Male' ? 'he' : 'they';
    
    processed = processed.replace(/\[his\/her\]/g, wrapClientValue(pronounHis));
    processed = processed.replace(/\[he\/she\]/g, wrapClientValue(pronounHe));
  }
  
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
      return `as specified: ${wrapClientValue(formattedLoansGifts)}`;
    }
    return '';
  });
  // CRITICAL FIX: Ensure proper sentence separation when inserting loans/gifts text
  // If template ends with "children" and loans text starts with "I", add period separator
  processed = processed.replace(/\bchildren\s+\[Specific Loans\/Gifts List\]/gi, (match) => {
    if (formattedLoansGifts && formattedLoansGifts.match(/^I\s+/i)) {
      return `children. ${wrapClientValue(formattedLoansGifts)}`;
    }
    return match.replace('[Specific Loans/Gifts List]', formattedLoansGifts ? wrapClientValue(formattedLoansGifts) : formattedLoansGifts);
  });
  processed = processed.replace(/\[Specific Loans\/Gifts List\]/gi, formattedLoansGifts ? wrapClientValue(formattedLoansGifts) : formattedLoansGifts);
  
  // Fix Clause 35: Add proper lead-in for residual gifts if missing
  let formattedResidualList = residualList.trim();
  if (formattedResidualList && !formattedResidualList.match(/^(I\s+give|upon\s+trust|My\s+Trustees)/i)) {
    // If it doesn't start with proper lead-in, it's likely raw text like "50% to my wife..."
    // The template should handle this, but if it's being inserted into "upon trust for", fix it
    if (processed.includes('upon trust for') && formattedResidualList) {
      formattedResidualList = `the following: ${formattedResidualList}`;
    }
  }
  processed = processed.replace(/\[Residual Beneficiary List and Shares\]/gi, formattedResidualList ? wrapClientValue(formattedResidualList) : formattedResidualList);
  
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
      processed = processed.replace(/If\s+any\s+gift\s+of\s+my\s+Residuary\s+Estate\s+should\s+fail[.,]\s*I\s+give\s+the\s+failed\s+share\s+to\s*\[Further Residual Beneficiary List and Shares\]/gi, wrapClientValue(formattedFurtherResidualList));
      processed = processed.replace(/\[Further Residual Beneficiary List and Shares\]/gi, '');
    } else {
      processed = processed.replace(/\[Further Residual Beneficiary List and Shares\]/gi, wrapClientValue(formattedFurtherResidualList));
    }
  } else {
    processed = processed.replace(/\[Further Residual Beneficiary List and Shares\]/gi, '');
  }
  
  processed = processed.replace(/\[Charity\/Charities List\]/gi, charityList ? wrapClientValue(charityList) : charityList);
  processed = processed.replace(/\[10% \/ minimum amount specified\]/gi, charityAmount ? wrapClientValue(charityAmount) : charityAmount);
  processed = processed.replace(/\[conditionally if IHT due\]/gi, charityCondition ? wrapClientValue(charityCondition) : charityCondition);
  processed = processed.replace(/\[\s*as specified:\s*([^\]]*)\]/gi, '$1');

  // Remove any remaining bracket placeholders to avoid incomplete text in final Will
  processed = processed.replace(/\[[^\]]*\]/g, '');
  
  // Apply text normalization (fix punctuation, grammar, etc.)
  processed = normalizeClauseText(processed);
  
  // Clean up extra whitespace
  processed = processed.replace(/\s+/g, ' ').trim();
  
  // CRITICAL FIX: Check for clauses that contain unresolved markers for pet carer/separate trustees
  // These should have been blocked earlier, but if they somehow got through, block them now
  // Pattern: "I appoint {{field:separateTrusteesSection:fullDetails}} as Trustees"
  // Pattern: "my {{field:petCarerSection:fullDetails}} care" or "my {{field:petCarerSection:fullDetails}} is unable"
  if (processed.includes('{{field:petCarerSection:fullDetails}}') || 
      processed.includes('{{field:substitutePetCarerSection:fullDetails}}') ||
      processed.includes('{{field:separateTrusteesSection:fullDetails}}')) {
    console.warn(`[PDF INTERPOLATE] ⚠️ CRITICAL: Unresolved marker found in final processed text, this clause should have been blocked: "${processed.substring(0, 100)}"`);
    // Return empty string to ensure clause is blocked (will be caught by validation)
    return '';
  }
  
  // CRITICAL FIX: Check for patterns that indicate testator name was incorrectly inserted
  // Pattern: "I appoint [Testator Name] as Trustees" when it should be trustee names
  // Pattern: "my [Testator Name] care" or "my [Testator Name] is unable" when it should be pet carer name
  const testatorNamePattern = /\b(Raymond|Van Der Walt|firstName|lastName)\b/i;
  if ((processed.includes('I appoint') && processed.includes('as Trustees') && testatorNamePattern.test(processed)) ||
      (processed.includes('my') && (processed.includes('care for') || processed.includes('is unable')) && testatorNamePattern.test(processed))) {
    console.error(`[PDF INTERPOLATE] ❌ CRITICAL ERROR: Testator name detected in clause that should contain pet carer/trustee names: "${processed.substring(0, 150)}"`);
    // Return empty string to block this clause
    return '';
  }
  
  // CRITICAL: Standardize all Aristone name references for consistency
  processed = standardizeAristoneName(processed);

  return processed;
};

export const generatePDFWithJSPDF = async (formValues, signatures = {}, options = {}) => {
  const { isClientPDF = false, formSchema: customSchema } = options || {};
  console.log('[WillTool Flow] PDF generator started', { isClientPDF, hasFormValues: !!formValues, valueKeys: formValues ? Object.keys(formValues).length : 0 });
  try {
    const schema = customSchema && customSchema.formSections ? customSchema : formSchema;

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
    
    // Header text - testator name is client-entered (bold)
    doc.setFontSize(11.5);
    doc.setFont('times', 'normal');
    doc.text('This is the Will of ', margin, yPos);
    doc.setFont('times', 'bold');
    doc.text(cleanName, margin + doc.getTextWidth('This is the Will of '), yPos);
    doc.setFont('times', 'normal');
    doc.text('.', margin + doc.getTextWidth('This is the Will of ' + cleanName), yPos);
    yPos += 8;

    // Helper: render text with bold segments (BOLD_START...BOLD_END = client-entered values)
    const renderTextWithBoldSegments = (doc, text, x, y, availableWidth, lineHeight, fontSize) => {
      const re = new RegExp(BOLD_START + '|' + BOLD_END, 'g');
      const displayText = text.replace(re, '');
      const lines = doc.splitTextToSize(displayText, availableWidth);
      let displayOffset = 0;
      let lineY = y;
      doc.setFontSize(fontSize);
      let boldDepth = 0;
      for (const line of lines) {
        const lineDisplayEnd = displayOffset + line.length;
        let displayPos = 0;
        let lineOrig = '';
        let lineStartBoldDepth = boldDepth;
        for (let i = 0; i < text.length; i++) {
          const c = text[i];
          if (c === BOLD_START || c === BOLD_END) {
            if (displayOffset <= displayPos && displayPos < lineDisplayEnd) lineOrig += c;
            if (c === BOLD_START) boldDepth++; else if (c === BOLD_END) boldDepth--;
          } else {
            if (displayOffset <= displayPos && displayPos < lineDisplayEnd) lineOrig += c;
            displayPos++;
          }
        }
        displayOffset = lineDisplayEnd;
        const splitRe = new RegExp(BOLD_START + '|' + BOLD_END);
        const parts = lineOrig.split(splitRe);
        let segX = x;
        const startBold = lineStartBoldDepth % 2 === 1;
        for (let j = 0; j < parts.length; j++) {
          const seg = parts[j];
          if (!seg) continue;
          const isBold = startBold ? (j % 2 === 0) : (j % 2 === 1);
          doc.setFont('times', isBold ? 'bold' : 'normal');
          doc.text(seg, segX, lineY);
          segX += doc.getTextWidth(seg);
        }
        lineY += lineHeight;
      }
      return lineY;
    };

    // Helper function for hanging indent clause rendering (supports bold client-entered values)
    // number: use "1.1", "2.3" etc for sub-paragraphs; null = render unnumbered (single-paragraph section)
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
      const hasNumber = number != null && number !== '';
      const textX = hasNumber ? margin + numColW : margin;
      const availableWidth = pageWidth - margin - (hasNumber ? numColW : 0);

      doc.setFont('times', 'normal');
      doc.setFontSize(fontSize);
      const re = new RegExp(BOLD_START + '|' + BOLD_END, 'g');
      const displayText = text.replace(re, '');
      const lines = doc.splitTextToSize(displayText, availableWidth);

      const neededHeight = Math.max(lines.length, 1) * lineHeight + spacingAfter;
      if (currentYPos + neededHeight > pageHeight - margin) {
        doc.addPage();
        currentYPos = margin;
      }

      if (hasNumber) {
        doc.setFont('times', 'bold');
        doc.setFontSize(fontSize);
        doc.text(`${number}.`, margin, currentYPos);
      }

      const finalY = renderTextWithBoldSegments(doc, text, textX, currentYPos, availableWidth, lineHeight, fontSize);
      return finalY + spacingAfter;
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

    // Collect all will clauses from form sections (shared builder for Preview + PDF)
    const scheduleReferences = new Set(); // Track schedule references throughout function
    const interpolateTextWithSchema = (text, values) => interpolateText(text, values, { schema });
    const willClauses = buildClauses({
      formValues,
      formData: schema,
      interpolateText: interpolateTextWithSchema,
      maxSectionIndex: isClientPDF ? CLIENT_VISIBLE_MAX_SECTION_INDEX : null,
    }).map((clause) => ({
      id: clause.id,
      sectionLabel: clause.section,
      fieldLabel: clause.title,
      text: clause.text,
      incomplete: clause.incomplete,
      missingFields: clause.missingFields || []
    }));
    
    // Explicit signing date fields - declared once for use throughout function
    const explicitSigningDateFields = [
      'executionDate',
      'dateSigned',
      'willSigningDate',
      'willExecutionDate', 
      'dateOfExecution',
      'signingDate'
    ];
    
    // Legacy clause builder disabled (shared builder used above)
    if (false) {
      schema.formSections.forEach((section) => {
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
                  interpolated.trim() !== '') {
                
                    // CRITICAL: Check for pet care clauses with missing data
                    if (field.id === 'petCarerSection' || field.id === 'substitutePetCarerSection') {
                      const petCarerData = formValues.petCarerData || [];
                      const substitutePetCarerData = formValues.substitutePetCarerData || [];
                      // Check for valid data (not just array length)
                      const hasPetCarer = Array.isArray(petCarerData) && petCarerData.length > 0 &&
                        petCarerData.some(item => 
                          item && typeof item === 'object' && 
                          (item.firstName || item.lastName || item.address1)
                        );
                      const hasSubstitutePetCarer = Array.isArray(substitutePetCarerData) && substitutePetCarerData.length > 0 &&
                        substitutePetCarerData.some(item => 
                          item && typeof item === 'object' && 
                          (item.firstName || item.lastName || item.address1)
                        );
                      
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
                  console.warn(`[PDF VALIDATION] ⚠️ Clause contains missing subject (will still render): "${interpolated.substring(0, 100)}"`);
                }
                
                // Normalize clause for duplicate detection (ignore minor whitespace differences)
                const normalizedClause = safeString(interpolated).replace(/\s+/g, ' ').trim().toLowerCase();
                
                // Only add if we haven't seen this clause before
                if (!seenClauses.has(normalizedClause)) {
                  seenClauses.add(normalizedClause);
                  willClauses.push({
                    sectionLabel: section.formSection,
                    fieldLabel: field.label,
                    text: sanitizeClausePunctuation(safeString(interpolated))
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
                  // CRITICAL: Block personal chattels beneficiary clause when beneficiary name is missing
                  if (field.id === 'personalChattelsGift' && selectedValue === 'Beneficiary') {
                    const name = (formValues.chattelsGiftBeneficiaryName || '').toString().trim();
                    if (!name) {
                      console.warn(`[PDF VALIDATION] ⚠️ BLOCKING personal chattels beneficiary clause - no beneficiary name`);
                      return; // Skip - clause must not render without beneficiary name
                    }
                  }
                  // DE-DUPLICATION: Skip unspecifiedChattelsAction "SpecificRecipient" when personalChattelsGift is "Beneficiary"
                  // Only one "personal possessions" clause may appear - Beneficiary takes precedence
                  if (field.id === 'unspecifiedChattelsAction' && selectedValue === 'SpecificRecipient' && formValues.personalChattelsGift === 'Beneficiary') {
                    console.warn(`[PDF VALIDATION] ⚠️ SKIPPING unspecifiedChattelsAction SpecificRecipient - personalChattelsGift Beneficiary takes precedence`);
                    return;
                  }
                  const interpolated = interpolateText(selectedOption.willClauseText, formValues);
                  
                  // CRITICAL: Block clause if it contains unresolved markers or is empty
                  if (!interpolated || 
                      /\{\{field:[^}]+\}\}/.test(interpolated) || 
                      interpolated.trim() === '') {
                    if (field.id === 'appointSeparateTrusteesFLIT') {
                      console.warn(`[PDF VALIDATION] ⚠️ BLOCKING FLIT separate trustees clause - unresolved markers or empty: "${interpolated}"`);
                    }
                    return; // Skip this clause
                  }
                  
                  if (interpolated.trim() !== '') {
                    
                    // CRITICAL: Check for FLIT separate trustees clause with missing data
                    // This clause comes from appointSeparateTrusteesFLIT radio option
                    if (field.id === 'appointSeparateTrusteesFLIT' && selectedValue === 'Yes') {
                      // Check if clause contains "I appoint" and "as Trustees" but no names inserted
                      if (interpolated.includes('I appoint') && interpolated.includes('as Trustees')) {
                        const appointMatch = interpolated.match(/\bI\s+appoint\s+(.+?)\s+as\s+Trustees/i);
                        if (appointMatch && appointMatch[1]) {
                          const betweenText = appointMatch[1].trim();
                          // Check if it's empty, too short, or contains unresolved markers
                          if (!betweenText || betweenText.length < 3 || 
                              betweenText.match(/^\s*$/) || 
                              betweenText.includes('{{field:') || 
                              betweenText.includes('[missing') ||
                              /^\[.*\]$/.test(betweenText)) {
                            console.warn(`[PDF VALIDATION] ⚠️ BLOCKING FLIT separate trustees clause - no names inserted: "${interpolated.substring(0, 100)}"`);
                            console.warn(`[PDF VALIDATION] ⚠️ Between text: "${betweenText}"`);
                            return; // Skip this clause
                          }
                        } else {
                          // Pattern "I appoint as Trustees" (no text between) - block it
                          if (/\bI\s+appoint\s+as\s+Trustees\b/i.test(interpolated)) {
                            console.warn(`[PDF VALIDATION] ⚠️ BLOCKING FLIT separate trustees clause - missing names (direct pattern): "${interpolated.substring(0, 100)}"`);
                            return; // Skip this clause
                          }
                        }
                      }
                    }
                    
                    // DE-DUPLICATION: Only one "personal possessions" clause may render
                    if (PERSONAL_POSSESSIONS_PATTERN.test(interpolated) && hasPersonalPossessionsClause) {
                      console.warn(`[PDF VALIDATION] ⚠️ SKIPPING duplicate personal possessions clause`);
                      return;
                    }
                    if (PERSONAL_POSSESSIONS_PATTERN.test(interpolated)) hasPersonalPossessionsClause = true;
                    
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
                      console.warn(`[PDF VALIDATION] ⚠️ Clause contains missing subject (will still render): "${interpolated.substring(0, 100)}"`);
                    }
                    
                    // Normalize clause for duplicate detection
                    const normalizedClause = safeString(interpolated).replace(/\s+/g, ' ').trim().toLowerCase();
                    
                    // Only add if we haven't seen this clause before
                    if (!seenClauses.has(normalizedClause)) {
                      seenClauses.add(normalizedClause);
                      willClauses.push({
                        sectionLabel: section.formSection,
                        fieldLabel: field.label,
                        text: sanitizeClausePunctuation(safeString(interpolated))
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
                      interpolated.trim() !== '') {
                    
                    // CRITICAL: Check for pet care clauses with missing data
                    if (field.id === 'petCarerSection' || field.id === 'substitutePetCarerSection') {
                      const petCarerData = formValues.petCarerData || [];
                      const substitutePetCarerData = formValues.substitutePetCarerData || [];
                      const hasPetCarer = Array.isArray(petCarerData) && petCarerData.length > 0 &&
                        petCarerData.some(item => 
                          item && typeof item === 'object' && 
                          (item.firstName || item.lastName || item.address1)
                        );
                      const hasSubstitutePetCarer = Array.isArray(substitutePetCarerData) && substitutePetCarerData.length > 0 &&
                        substitutePetCarerData.some(item => 
                          item && typeof item === 'object' && 
                          (item.firstName || item.lastName || item.address1)
                        );
                      
                      if (field.id === 'petCarerSection' && !hasPetCarer) {
                        console.warn(`[PDF VALIDATION] ⚠️ BLOCKING pet carer clause - no pet carer data: "${interpolated.substring(0, 100)}"`);
                        return; // Skip this clause
                      }
                      
                      if (field.id === 'substitutePetCarerSection' && (!hasPetCarer || !hasSubstitutePetCarer)) {
                        console.warn(`[PDF VALIDATION] ⚠️ BLOCKING substitute pet carer clause - missing data: "${interpolated.substring(0, 100)}"`);
                        return; // Skip this clause
                      }
                    }
                    
                    // CRITICAL: Additional check for pet carer clauses with empty interpolation
                    // Catch cases where interpolation returned empty, resulting in "If my is unable..."
                    if (interpolated.includes('If my') && interpolated.includes('is unable')) {
                      // Check if there's a name between "If my" and "is unable"
                      const myMatch = interpolated.match(/\bIf\s+my\s+(.+?)\s+is\s+unable/i);
                      if (myMatch && myMatch[1]) {
                        const betweenText = myMatch[1].trim();
                        // If it's empty, too short, or contains unresolved markers, block it
                        if (!betweenText || betweenText.length < 2 || 
                            betweenText.includes('{{field:') || 
                            betweenText.includes('[missing') ||
                            betweenText.match(/^\s*$/)) {
                          console.warn(`[PDF VALIDATION] ⚠️ BLOCKING pet carer clause - empty name interpolation: "${interpolated.substring(0, 100)}"`);
                          return; // Skip this clause
                        }
                      } else {
                        // Pattern "If my is unable" (no name) - block it
                        if (/\bIf\s+my\s+is\s+unable/i.test(interpolated)) {
                          console.warn(`[PDF VALIDATION] ⚠️ BLOCKING pet carer clause - missing name (direct pattern): "${interpolated.substring(0, 100)}"`);
                          return; // Skip this clause
                        }
                      }
                    }
                    
                    // CRITICAL: Check for separate trustees clauses with missing data
                    // Check if clause text contains "I appoint" and "as Trustees" but interpolation returned empty/placeholder
                    if (interpolated.includes('I appoint') && interpolated.includes('as Trustees')) {
                      // Check if there's meaningful content between "I appoint" and "as Trustees"
                      // Use a more flexible regex that handles various clause structures
                      const appointMatch = interpolated.match(/\bI\s+appoint\s+(.+?)\s+as\s+Trustees/i);
                      if (appointMatch && appointMatch[1]) {
                        const betweenText = appointMatch[1].trim();
                        
                        // Check if it's a placeholder pattern (exact match only, not substring)
                        const isPlaceholderPattern = betweenText.match(/^(?:placeholder|example|name|\.\.\.|\[.*\]|\{\{.*\}\})$/i);
                        // Check if it contains unresolved interpolation markers
                        const hasUnresolvedMarkers = betweenText.includes('{{field:') || betweenText.includes('[missing');
                        
                        // Block only if: empty, too short (< 3 chars), just whitespace, exact placeholder pattern match, or has unresolved markers
                        // Allow content like "Testing Separate Trustee" even if it contains "test" as a substring
                        if (!betweenText || betweenText.length < 3 || betweenText.match(/^\s*$/) || isPlaceholderPattern || hasUnresolvedMarkers) {
                          console.warn(`[PDF VALIDATION] ⚠️ BLOCKING separate trustees clause - no names inserted: "${interpolated.substring(0, 100)}"`);
                          console.warn(`[PDF VALIDATION] ⚠️ Between text: "${betweenText}"`);
                          console.warn(`[PDF VALIDATION] ⚠️ Checks: empty=${!betweenText}, short=${betweenText.length < 3}, whitespace=${!!betweenText.match(/^\s*$/)}, placeholder=${!!isPlaceholderPattern}, unresolved=${hasUnresolvedMarkers}`);
                          return; // Skip this clause
                        } else {
                          // Valid content found - log for debugging
                          console.log(`[PDF VALIDATION] ✅ Separate trustees clause has valid content: "${betweenText}"`);
                        }
                      } else {
                        // Check if the pattern is "I appoint as Trustees" (no text between) - this is the problematic pattern
                        const directAppointPattern = /\bI\s+appoint\s+as\s+Trustees\b/i;
                        if (directAppointPattern.test(interpolated)) {
                          console.warn(`[PDF VALIDATION] ⚠️ BLOCKING separate trustees clause - missing names (direct pattern): "${interpolated.substring(0, 100)}"`);
                          return; // Skip this clause
                        }
                        // If regex didn't match but clause contains both phrases, it might be a different structure - allow it
                        console.log(`[PDF VALIDATION] ℹ️ Separate trustees clause has different structure, allowing: "${interpolated.substring(0, 100)}"`);
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
                      console.warn(`[PDF VALIDATION] ⚠️ Clause contains missing subject (will still render): "${interpolated.substring(0, 100)}"`);
                    }
                    
                    // Normalize clause for duplicate detection
                    const normalizedClause = safeString(interpolated).replace(/\s+/g, ' ').trim().toLowerCase();
                    
                    // Only add if we haven't seen this clause before
                    if (!seenClauses.has(normalizedClause)) {
                      seenClauses.add(normalizedClause);
                      willClauses.push({
                        sectionLabel: section.formSection,
                        fieldLabel: subField.label || field.label,
                        text: sanitizeClausePunctuation(safeString(interpolated))
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
      // FIXED: Only match when there's NO content between "I appoint" and "as Trustees"
      // Match: "I appoint  as Trustees" (double space) or "I appoint as Trustees" (direct)
      // Don't match: "I appoint [names] as Trustees" (has content between)
      /\bI\s+appoint\s+(?:\s{2,}|as\s+Trustees\b)/i, // "I appoint  as Trustees" (double+ space) or "I appoint as Trustees" (direct, no content)
      /\bpay\s+the\s+income\s+thereof\s+to\s+\.\.\./i, // "pay the income thereof to ..."
      /\bfailed\s+share\s+to\s+\./i, // "failed share to ."
      /\bI\s+give\s+of\s+my\s+net\s+estate\s+to\s+\.\.\./i, // "I give of my net estate to ..."
      /children\s+\]/,                 // Stray bracket like "children ]"
      /\bto\s+during\s+their\s+lifetime/i, // "to  during" (blank life tenant)
      /\band\s+after\s+their\s+death\s+for\s*$/i // "and after their death for " (blank remainder)
    ];
    
    // Ensure trust schedules are referenced when data exists (even if clause text is filtered)
    if (formValues.includePropertyTrust === 'Yes' && formValues.propertyTrustScheduleNumber) {
      scheduleReferences.add(`Schedule ${String(formValues.propertyTrustScheduleNumber).trim()}`);
    }
    if (formValues.includeBPRTrust === 'Yes' && formValues.bprTrustScheduleNumber) {
      scheduleReferences.add(`Schedule ${String(formValues.bprTrustScheduleNumber).trim()}`);
    }

    // Scan clauses for unresolved patterns (scheduleReferences already declared above)
    let validationClauseNumber = 0;
    willClauses.forEach((clause) => {
      validationClauseNumber++;
      if (!clause.text) {
        missing.push({
          section: clause.sectionLabel || clause.section || 'Unknown',
          field: clause.fieldLabel || clause.title || 'Unknown',
          clauseNumber: validationClauseNumber,
          issue: 'Empty clause',
          snippet: '(empty)'
        });
        return;
      }
      
      // CRITICAL: Check for incomplete clauses (marked by buildClauses.js)
      // These will be rendered as [Incomplete clause — requires user input: ...] or [MISSING: ...]
      
      // ALWAYS-ON Debug logging for problematic clauses (15, 17, 19, 28, 29)
      const problematicClauseIds = ['failedMoneyGiftPassProportionately', 'failedSpecificGiftPassProportionately', 
        'failedPropertyGiftPassProportionately', 'provisionsForPets', 'substitutePetCarer', 'petCarerSection'];
      const isProblematicClause = problematicClauseIds.some(id => clause.id?.includes(id));
      
      if (isProblematicClause) {
        console.log(`[PDF VALIDATION] 🔍 CHECKING PROBLEMATIC CLAUSE ${validationClauseNumber}:`, {
          clauseId: clause.id,
          clauseIncomplete: clause.incomplete,
          clauseIncompleteType: typeof clause.incomplete,
          clauseText: clause.text,
          clauseTextLength: clause.text?.length,
          missingFields: clause.missingFields,
          sectionLabel: clause.sectionLabel,
          fieldLabel: clause.fieldLabel
        });
      }
      
      if (clause.incomplete === true) {
        const missingFields = Array.isArray(clause.missingFields) && clause.missingFields.length > 0
          ? clause.missingFields.join(', ')
          : 'required fields';
        const snippet = clause.text.substring(0, 100) + (clause.text.length > 100 ? '...' : '');
        const incompleteItem = {
          section: clause.sectionLabel || clause.section || 'Unknown',
          field: clause.fieldLabel || clause.title || 'Unknown',
          clauseNumber: validationClauseNumber,
          issue: `Incomplete clause — requires user input: ${missingFields}`,
          snippet: snippet
        };
        console.log(`[PDF VALIDATION] Found incomplete clause ${validationClauseNumber}:`, {
          section: incompleteItem.section,
          field: incompleteItem.field,
          issue: incompleteItem.issue.substring(0, 60)
        });
        missing.push(incompleteItem);
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
            section: clause.sectionLabel || clause.section || 'Unknown',
            field: clause.fieldLabel || clause.title || 'Unknown',
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
            section: clause.sectionLabel || clause.section || 'Unknown',
            field: clause.fieldLabel || clause.title || 'Unknown',
            clauseNumber: 31,
            issue: 'CRITICAL: Clause 31 is incomplete - contains only a condition without an actual gift',
            snippet: clause31Text
          });
        }
      }
      
      // Check for placeholder patterns
      // SKIP placeholderPatterns check for "I appoint ... as Trustees" clauses - they're already validated
      // by the specific check at lines 1990-2025, which correctly identifies valid vs invalid content
      const isAppointTrusteesClause = clause.text.includes('I appoint') && clause.text.includes('as Trustees');
      
      if (!isAppointTrusteesClause) {
        placeholderPatterns.forEach(pattern => {
          if (pattern.test(clause.text)) {
            const snippet = clause.text.substring(0, 80) + (clause.text.length > 80 ? '...' : '');
            missing.push({
              section: clause.sectionLabel || clause.section || 'Unknown',
              field: clause.fieldLabel || clause.title || 'Unknown',
              clauseNumber: validationClauseNumber,
              issue: 'Placeholder or incomplete content',
              snippet: snippet
            });
          }
        });
      } else {
        // Log that we're skipping placeholderPatterns for this clause since it's already validated
        console.log(`[PDF VALIDATION] ℹ️ Skipping placeholderPatterns check for clause ${validationClauseNumber} (already validated by specific "I appoint" check)`);
      }
      
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
          section: clause.sectionLabel || clause.section || 'Unknown',
          field: clause.fieldLabel || clause.title || 'Unknown',
          clauseNumber: validationClauseNumber,
          issue: 'CRITICAL: Missing subject/person/beneficiary in clause',
          snippet: snippet
        });
      }
      
      // Check for incomplete patterns (skip if already marked as incomplete above)
      // CRITICAL FIX: If buildClauses.js explicitly marks a clause as complete (incomplete: false),
      // we should trust that assessment and NOT double-check with isPlaceholderOrIncomplete.
      // Only check isPlaceholderOrIncomplete if clause.incomplete is undefined/null (not explicitly set).
      // This prevents false positives where buildClauses.js correctly identifies a clause as complete
      // but isPlaceholderOrIncomplete incorrectly flags it due to pattern matching.
      if (clause.incomplete === false) {
        // Clause is explicitly marked as complete by buildClauses.js - trust it
        if (isProblematicClause) {
          console.log(`[PDF VALIDATION] ✅ PROBLEMATIC CLAUSE ${validationClauseNumber} MARKED COMPLETE BY buildClauses - TRUSTING IT:`, {
            clauseId: clause.id,
            clauseIncomplete: clause.incomplete,
            clauseText: clause.text
          });
        }
      } else if (clause.incomplete !== true && isPlaceholderOrIncomplete(clause.text)) {
        // Only check isPlaceholderOrIncomplete if clause.incomplete is not explicitly false
        const snippet = clause.text.substring(0, 80) + (clause.text.length > 80 ? '...' : '');
        
        // ALWAYS-ON Debug logging for problematic clauses being flagged by isPlaceholderOrIncomplete
        if (isProblematicClause) {
          console.log(`[PDF VALIDATION] ⚠️ PROBLEMATIC CLAUSE ${validationClauseNumber} FLAGGED BY isPlaceholderOrIncomplete:`, {
            clauseId: clause.id,
            clauseIncomplete: clause.incomplete,
            clauseText: clause.text,
            snippet: snippet
          });
        }
        
        missing.push({
          section: clause.sectionLabel || clause.section || 'Unknown',
          field: clause.fieldLabel || clause.title || 'Unknown',
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
    
    // Signing date is intentionally not required for draft PDF: it is filled by the
    // solicitor at the client's execution appointment, so we do not add it to missing
    // or block PDF generation when it is blank.

    // Group missing items by category
    // CRITICAL: Separate critical issues from regular placeholders
    const criticalBlanks = missing.filter(item => {
      if (!item.issue) return false;
      const matches = 
        item.issue.includes('CRITICAL: Missing subject') ||
        item.issue.includes('CRITICAL: Clause 31') ||
        item.issue.includes('CRITICAL:') ||
        item.issue.includes('blank') || 
        item.issue.includes('Empty') || 
        item.issue.toLowerCase().includes('incomplete') ||
        item.issue.includes('requires user input');
      if (matches) {
        console.log(`[PDF VALIDATION] Item added to criticalBlanks:`, {
          section: item.section,
          field: item.field,
          clauseNumber: item.clauseNumber,
          issue: item.issue.substring(0, 60)
        });
      }
      return matches;
    });
    const placeholders = missing.filter(item => 
      !criticalBlanks.includes(item) && (
        !item.issue || (
          !item.issue.includes('CRITICAL:') &&
          (item.issue.includes('Placeholder') || item.snippet?.includes('test'))
        )
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
    console.log(`[PDF VALIDATION] criticalBlanks.length: ${criticalBlanks.length}, placeholders.length: ${placeholders.length}`);
    if (missing.length > 0) {
      console.log(`[PDF VALIDATION] First 3 missing items:`, missing.slice(0, 3).map(m => ({
        section: m.section,
        field: m.field,
        clauseNumber: m.clauseNumber,
        issue: m.issue?.substring(0, 80)
      })));
    }
    if (criticalBlanks.length > 0) {
      console.log(`[PDF VALIDATION] First 3 criticalBlanks:`, criticalBlanks.slice(0, 3).map(m => ({
        section: m.section,
        field: m.field,
        clauseNumber: m.clauseNumber,
        issue: m.issue?.substring(0, 80)
      })));
    }
    
    // Helper function to render validation errors report (will be called at the END)
    const renderValidationErrorsReport = () => {
      console.log(`[PDF VALIDATION REPORT] Rendering report - hasPlaceholders: ${hasPlaceholders}, criticalBlanks.length: ${criticalBlanks.length}, placeholders.length: ${placeholders.length}, missing.length: ${missing.length}`);
      
      // Fallback: if we have missing items but they weren't categorized, show them all
      const itemsToShow = criticalBlanks.length > 0 ? criticalBlanks : 
                         placeholders.length > 0 ? placeholders :
                         missing.length > 0 ? missing : [];
      
      if (itemsToShow.length === 0 && schedulesMissing.length === 0) {
        console.log(`[PDF VALIDATION REPORT] Skipping report - no items to show`);
        return;
      }
      
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
      if (criticalBlanks.length > 0 || (criticalBlanks.length === 0 && missing.length > 0)) {
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
      // Use criticalBlanks if available, otherwise fall back to all missing items
      const itemsToDisplay = criticalBlanks.length > 0 ? criticalBlanks : (missing.length > 0 ? missing : []);
      if (itemsToDisplay.length > 0) {
        yPos += 4; // Section spacing
        reportLine('Critical Blanks:', {
          fontSize: 12,
          bold: true,
          spacingAfter: 6
        });
        
        const availableWidth = pageWidth - (margin * 2) - 10;
        itemsToDisplay.forEach((item) => {
          console.log(`[PDF VALIDATION REPORT] Rendering item:`, {
            section: item.section,
            field: item.field,
            clauseNumber: item.clauseNumber,
            issue: item.issue?.substring(0, 60)
          });
          const itemText = `- ${item.section}: ${item.field}`;
          reportLine(itemText, {
            fontSize: 10,
            indent: 5,
            spacingAfter: 2
          });
          
          if (item.clauseNumber && item.issue) {
            const clauseText = `  Clause ${item.clauseNumber}: ${item.issue}`;
            reportLine(clauseText, {
              fontSize: 10,
              indent: 10,
              spacingAfter: 2
            });
          } else if (item.issue) {
            // Display issue even if no clause number
            const issueText = `  ${item.issue}`;
            reportLine(issueText, {
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
          
          if (item.clauseNumber && item.issue) {
            const clauseText = `  Clause ${item.clauseNumber}: ${item.issue}`;
            reportLine(clauseText, {
              fontSize: 10,
              indent: 10,
              spacingAfter: 2
            });
          } else if (item.clauseNumber) {
            const clauseText = `  Clause ${item.clauseNumber}`;
            reportLine(clauseText, {
              fontSize: 10,
              indent: 10,
              spacingAfter: 2
            });
          } else if (item.issue) {
            // Display issue even if no clause number
            const issueText = `  ${item.issue}`;
            reportLine(issueText, {
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

    // Pre-compute paragraph count per section for Mariyam's numbering rules:
    // Single-paragraph section: no sub-number (1. Header, then body text)
    // Multi-paragraph section: 1.1, 1.2, 1.3 etc.
    const sectionParaCount = new Map();
    willClauses.forEach((clause) => {
      const label = clause.sectionLabel || '';
      sectionParaCount.set(label, (sectionParaCount.get(label) || 0) + 1);
    });
    
    // 1. SECTION HEADERS: Render section header when section changes (numbered, bold, visually distinct)
    let lastSection = null;
    let sectionNumber = 0;
    const sectionParaIndex = new Map(); // paraIndex per section (1-based)

    // Render will clauses with hanging indent (number and text on same line)
    let clauseNumber = 1;
    willClauses.forEach((clause) => {
      // Emit section header before first clause of each new section
      if (clause.sectionLabel && clause.sectionLabel !== lastSection) {
        lastSection = clause.sectionLabel;
        sectionNumber++;
        sectionParaIndex.set(lastSection, 0); // reset para index for new section
        checkPageBreak(lineHeight * 3);
        doc.setFont('times', 'bold');
        doc.setFontSize(12);
        doc.text(`${sectionNumber}. ${clause.sectionLabel}`, margin, yPos);
        yPos += 8;
        doc.setFont('times', 'normal');
        doc.setFontSize(11.5);
      }
      // CRITICAL FIX: Skip clauses with unresolved markers - they should have been blocked in buildClauses.js
      // This is a safety net in case any somehow got through
      if (/\{\{field:[^}]+\}\}/.test(clause.text)) {
        console.error(`[PDF RENDER] ❌ CRITICAL: Skipping clause with unresolved markers (should have been blocked in buildClauses): "${clause.text.substring(0, 100)}"`);
        return; // Skip this clause entirely - do not render it
      }
      
      // DO NOT skip clauses - render everything, even if incomplete
      let processedClauseText = clause.text || '';
      if (clause.incomplete) {
        const fields = Array.isArray(clause.missingFields) && clause.missingFields.length > 0
          ? clause.missingFields.join(', ')
          : 'required fields';
        processedClauseText = `[Incomplete clause — requires user input: ${fields}]`;
      }
      
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
      
      // Apply comprehensive text normalization FIRST (fixes punctuation, grammar, duplication)
      processedClauseText = normalizeClauseText(processedClauseText);
      
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
      
      // Do not block clauses with missing subjects; preview and PDF must align
      if (hasMissingSubject) {
        console.warn(`[PDF VALIDATION] ⚠️ Clause ${clauseNumber} contains missing subject (will still render): "${processedClauseText.substring(0, 100)}"`);
      }
      
      if (isIncompleteCondition && clauseNumber === 31) {
        console.warn(`[PDF VALIDATION] ⚠️ Clause 31 incomplete condition (will render placeholder): "${processedClauseText}"`);
        processedClauseText = '[Incomplete clause — requires user input: Clause 31 condition]';
      }
      
      // Render clause even if empty or incomplete (show [MISSING] markers)
      if (!processedClauseText || processedClauseText.trim() === '') {
        processedClauseText = '[MISSING: clause content]';
      }
      
      // Only number substantive clauses (length > 20 characters or contains content)
      // Mariyam's numbering: sub-number (1.1, 1.2) only if section has >1 paragraph; else no sub-number
      if (processedClauseText.length > 20 || processedClauseText.includes('[MISSING')) {
        const paraCount = sectionParaCount.get(lastSection || '') || 1;
        const idx = (sectionParaIndex.get(lastSection || '') || 0) + 1;
        sectionParaIndex.set(lastSection || '', idx);
        const displayNumber = paraCount > 1 ? `${sectionNumber}.${idx}` : null;
        yPos = renderNumberedClause(doc, {
          number: displayNumber,
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
        const displayRe = new RegExp(BOLD_START + '|' + BOLD_END, 'g');
        const displayText = processedClauseText.replace(displayRe, '');
        const lines = doc.splitTextToSize(displayText, availableWidth);

        const neededHeight = lines.length * 5.5 + 6;
        if (yPos + neededHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }

        yPos = renderTextWithBoldSegments(doc, processedClauseText, margin, yPos, availableWidth, 5.5, 11.5) + 6;
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
                scheduleData = `Schedule Number: ${scheduleNumber}\nBusiness Property Details: ${details}\n\nBusiness Property Relief Trust Terms: ${terms}`;
                console.log(`[PDF SCHEDULE] ✅ Combined BPR Trust details + terms, total length: ${scheduleData.length}`);
              } else if (details) {
                scheduleData = `Schedule Number: ${scheduleNumber}\nBusiness Property Details: ${details}`;
                console.log(`[PDF SCHEDULE] ✅ Using BPR Trust details only, length: ${scheduleData.length}`);
              } else if (terms) {
                scheduleData = `Schedule Number: ${scheduleNumber}\nBusiness Property Relief Trust Terms: ${terms}`;
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
          doc.setFont('times', 'bold'); // Schedule content is client-entered
          const scheduleLines = doc.splitTextToSize(scheduleData, availableWidth);
          console.log(`[PDF SCHEDULE] Schedule content split into ${scheduleLines.length} lines`);
          let lineY = yPos;
          let pageBreaksAdded = 0;
          scheduleLines.forEach((line, lineIndex) => {
            if (lineY + 5.5 > pageHeight - margin) {
              console.log(`[PDF SCHEDULE] Page break needed at line ${lineIndex + 1}/${scheduleLines.length} (lineY: ${lineY.toFixed(1)})`);
              doc.addPage();
              lineY = margin;
              pageBreaksAdded++;
            }
            doc.text(line, margin, lineY);
            lineY += 5.5;
          });
          doc.setFont('times', 'normal');
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
    
    // Helper to get witness details from formValues (witness1 or witness2)
    const getWitnessDetails = (n) => {
      const prefix = `witness${n}`;
      const name = formValues[`${prefix}Name`] ||
        (formValues[`${prefix}Data`] && Array.isArray(formValues[`${prefix}Data`]) && formValues[`${prefix}Data`][0]
          ? (typeof formValues[`${prefix}Data`][0] === 'object'
              ? [formValues[`${prefix}Data`][0].firstName, formValues[`${prefix}Data`][0].lastName].filter(Boolean).join(' ')
              : String(formValues[`${prefix}Data`][0]))
          : '') || '';
      const addrParts = [
        formValues[`${prefix}Address1`] || formValues[`${prefix}address1`],
        formValues[`${prefix}Address2`] || formValues[`${prefix}address2`],
        [formValues[`${prefix}Address3`] || formValues[`${prefix}address3`], formValues[`${prefix}Postcode`] || formValues[`${prefix}postcode`]].filter(Boolean).join(' ')
      ].filter(Boolean);
      const address = addrParts.join(', ') || '';
      const phone = formValues[`${prefix}Phone`] || formValues[`${prefix}mobile`] || formValues[`${prefix}Mobile`] || '';
      const occupation = formValues[`${prefix}Occupation`] || '';
      return { name: String(name).trim(), address: String(address).trim(), phone: String(phone).trim(), occupation: String(occupation).trim() };
    };

    const WITNESS_SIG_BOX_W = 42;
    const WITNESS_SIG_BOX_H = 18;

    const drawWitnessBox = (doc, x, y, w, h, title, signatureDataUrl = null, details = {}) => {
      const pad = 6;
      const lineX1 = x + pad;
      const lineX2 = x + w - pad;
      const { name = '', address = '', phone = '', occupation = '' } = details;

      let cy = y + 8;
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text(title, x + pad, cy);

      cy += 7;
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.text('SIGNATURE', x + pad, cy);
      cy += 6;
      // Fixed signature bounding box - always reserve space, visible border
      doc.setLineWidth(0.2);
      doc.setDrawColor(0, 0, 0);
      const sigBoxX = lineX1;
      const sigBoxY = cy;
      doc.rect(sigBoxX, sigBoxY, WITNESS_SIG_BOX_W, WITNESS_SIG_BOX_H);
      if (signatureDataUrl && typeof signatureDataUrl === 'string' && signatureDataUrl.startsWith('data:image') && signatureDataUrl.length > 100) {
        drawSignatureInBox(doc, signatureDataUrl, sigBoxX, sigBoxY, WITNESS_SIG_BOX_W, WITNESS_SIG_BOX_H);
      }
      cy += WITNESS_SIG_BOX_H + 4;
      doc.text('Full name', x + pad, cy);
      cy += 6;
      if (name) doc.text(name.substring(0, 35), lineX1, cy - 1);
      doc.line(lineX1, cy, lineX2, cy);

      cy += 10;
      doc.text('Address', x + pad, cy);
      cy += 6;
      if (address) doc.text(address.substring(0, 45), lineX1, cy - 1);
      doc.line(lineX1, cy, lineX2, cy);
      cy += 8;
      doc.line(lineX1, cy, lineX2, cy);

      cy += 10;
      doc.text('Phone', x + pad, cy);
      cy += 6;
      if (phone) doc.text(phone.substring(0, 25), lineX1, cy - 1);
      doc.line(lineX1, cy, lineX2, cy);

      cy += 10;
      doc.text('Occupation', x + pad, cy);
      cy += 6;
      if (occupation) doc.text(occupation.substring(0, 35), lineX1, cy - 1);
      doc.line(lineX1, cy, lineX2, cy);
    };

    // Render execution page with clean grid layout
    let y = 60; // Start position
    const contentW = pageWidth - margin * 2;

    // --- Testator signature block ---
    doc.setFont('times', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    if (isClientPDF) {
      // Client PDF: no "signed" wording, no sign-ready assertions. Intake only.
      doc.setFont('times', 'bold');
      doc.setFontSize(10);
      doc.text('INTAKE ONLY — This is not a final Will. Sign in person with witnesses at your solicitor appointment.', margin, y);
      y += 8;
      doc.setFont('times', 'normal');
      doc.setFontSize(11);
      doc.text(`To be signed by ${cleanName} at your solicitor appointment.`, margin, y);
      y += 10;
    } else {
      // Solicitor/internal PDF: execution wording
      doc.text(`Signed by ${cleanName}, to give effect to this Will, on`, margin, y);
      y += 14;
    }

    // Date line + value - Client PDF: blank (not yet signed). Solicitor PDF: use execution date.
    let executionDate = null;
    if (!isClientPDF) {
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
    }
    
    // CRITICAL: If no valid execution date found, leave it BLANK (do not use DOB or current date)
    // This ensures the date field is never auto-filled with incorrect data

    doc.text(isClientPDF ? 'Date of signing' : 'Date', margin, y);
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

    // Testator signature: fixed box (56mm x 21mm), always reserve space
    const TESTATOR_BOX_W = 56;
    const TESTATOR_BOX_H = 21;
    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.text('TESTATOR SIGNATURE', margin, y);
    y += 8;
    // Fixed bounding box with visible border
    doc.setLineWidth(0.2);
    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, y, TESTATOR_BOX_W, TESTATOR_BOX_H);
    // Client PDF: leave signature box empty (sign in person at appointment). Solicitor PDF: show if available.
    if (!isClientPDF && testatorSignature && typeof testatorSignature === 'string' && testatorSignature.startsWith('data:image') &&
        testatorSignature.length > 100 && testatorSignature.length < 3000000) {
      drawSignatureInBox(doc, testatorSignature, margin, y, TESTATOR_BOX_W, TESTATOR_BOX_H);
    }
    y += TESTATOR_BOX_H + 6;

    // #5 Client PDF: testator signature only. Internal/solicitor PDF: include attestation + witnesses
    if (!isClientPDF) {
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
      const boxH = 105;

      const w1x = margin;
      const w2x = margin + colW + gap;

      const witness1Details = getWitnessDetails(1);
      const witness2Details = getWitnessDetails(2);
      drawWitnessBox(doc, w1x, y, colW, boxH, 'Witness 1', consultantSignature, witness1Details);
      drawWitnessBox(doc, w2x, y, colW, boxH, 'Witness 2', clientSignature, witness2Details);
    }

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
    console.log('[WillTool Flow] PDF generator finished', { hasDoc: true, hasPlaceholders: hasPlaceholders, criticalCount: criticalBlanks.length });
    return {
      doc,
      missingItems: missing,
      schedulesMissing: Array.from(schedulesMissing),
      hasPlaceholders: hasPlaceholders,
      criticalIssues: criticalBlanks,
      hasCriticalIssues: criticalBlanks.length > 0
    };
  } catch (error) {
    console.error('[WillTool Flow] PDF generator error', error);
    throw error;
  }
};
