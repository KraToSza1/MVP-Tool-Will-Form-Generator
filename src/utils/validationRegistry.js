/**
 * Global Missing Items Validation Registry
 * 
 * Single source of truth for all missing required items across the form.
 * Provides consistent structure for validation issues with navigation support.
 * 
 * CURRENT SCOPE:
 * - Property Trust Schedule validation
 * - Business Property Relief Trust Schedule validation
 * - Normalization of validation issues from PDF generation
 * 
 * EXTENSIBLE:
 * This registry is designed to be extended with additional validation functions.
 * Future additions could include:
 * - Required field validation per section
 * - Cross-field validation rules
 * - Conditional requirement validation
 * 
 * All validation issues returned by this registry include:
 * - section: Section name (e.g., "Property Trust")
 * - sectionId: Stable section identifier (e.g., "propertyTrustSection")
 * - fieldId: Target field ID for navigation
 * - targetSectionIndex: Section index (fallback, less reliable)
 * - issue: User-friendly issue description
 * - message: Full error message
 */

import defaultFormData from '../data/Complete-WillSuite-Form-Data.json';
import { getBprTrustClientIntent } from '../lib/bprTrustClientIntent.js';

function getFormData(formDataParam) {
  return formDataParam && Array.isArray(formDataParam.formSections) ? formDataParam : defaultFormData;
}

/**
 * Normalize a validation issue to ensure it has all required fields for navigation
 * @param {Object} issue - Raw validation issue
 * @param {Object} formValues - Current form values
 * @param {Object} [formData] - Optional form definition (uses default if not provided)
 * @returns {Object} Normalized validation issue with navigation fields
 */
export const normalizeValidationIssue = (issue, _, formDataParam) => {
  const formData = getFormData(formDataParam);
  // If already normalized, return as-is
  if (issue.targetSectionIndex !== undefined && issue.sectionId) {
    return issue;
  }

  const normalized = {
    ...issue,
    section: issue.section || 'Unknown Section',
    fieldId: issue.fieldId || issue.field || null,
    fieldLabel: issue.fieldLabel || issue.field || 'Unknown Field',
    issue: issue.issue || issue.message || 'Missing required information',
    message: issue.message || issue.issue || 'Missing required information',
  };

  // Find section index by section name
  if (!normalized.targetSectionIndex && normalized.section) {
    const sectionIndex = formData.formSections.findIndex(
      s => s.formSection === normalized.section
    );
    if (sectionIndex >= 0) {
      normalized.targetSectionIndex = sectionIndex;
    }
  }

  // Find sectionId from section name
  if (!normalized.sectionId && normalized.section) {
    const section = formData.formSections.find(
      s => s.formSection === normalized.section
    );
    if (section) {
      // Try to find a field with matching section name
      const sectionField = section.fields?.find(
        f => f.id && f.id.toLowerCase().includes(normalized.section.toLowerCase().replace(/\s+/g, ''))
      );
      if (sectionField) {
        normalized.sectionId = sectionField.id;
      }
    }
  }

  return normalized;
};

/**
 * Collect all missing items from various sources and normalize them
 * @param {Array} pdfMissingItems - Missing items from PDF generation
 * @param {Array} scheduleIssues - Schedule-related issues
 * @param {Array} preValidationIssues - Pre-PDF validation issues
 * @param {Object} formValues - Current form values
 * @returns {Array} Normalized validation issues ready for display and navigation
 */
export const collectAllMissingItems = (
  pdfMissingItems = [],
  scheduleIssues = [],
  preValidationIssues = [],
  formValues = {},
  formDataParam
) => {
  const formData = getFormData(formDataParam);
  const allIssues = [
    ...preValidationIssues,
    ...scheduleIssues,
    ...pdfMissingItems.map(item => {
      // Convert string format to object format if needed
      if (typeof item === 'string') {
        // Parse string format like "CRITICAL: Field Name - description"
        const parts = item.split(' - ');
        const prefix = parts[0] || '';
        const description = parts.slice(1).join(' - ') || item;
        
        // Extract section and field from prefix
        let section = 'Unknown Section';
        let field = '';
        
        if (prefix.includes(':')) {
          const [category, ...rest] = prefix.split(':');
          const fieldPart = rest.join(':').trim();
          
          // Map categories to sections
          const categoryMap = {
            'CRITICAL': 'Residuary Estate',
            'EXECUTION': 'Execution',
            'PROFESSIONAL': 'Professional Appointments',
            'CHARITY': 'Charitable Gifts',
            'PLACEHOLDER': 'Gifts',
            'PET CARE': 'Pet Provisions',
            'PROPERTY TRUST': 'Property Trust',
            'BPR TRUST': 'Business Interests'
          };
          
          section = categoryMap[category] || 'Unknown Section';
          field = fieldPart || description;
        }
        
        return {
          section,
          field,
          fieldId: null, // Will be resolved by normalizeValidationIssue
          issue: description,
          message: item
        };
      }
      return item;
    })
  ];

  // Normalize all issues
  return allIssues.map(issue => normalizeValidationIssue(issue, formValues, formData));
};

/**
 * Validate Property Trust Schedule content
 * @param {Object} formValues - Current form values
 * @param {Object} [formDataParam] - Optional form definition (uses default if not provided)
 * @returns {Array} Validation issues for Property Trust schedules
 */
export const validatePropertyTrustSchedules = (formValues, formDataParam) => {
  const formData = getFormData(formDataParam);
  const issues = [];

  console.log('[VALIDATE PROPERTY TRUST] Checking validation...');
  console.log('[VALIDATE PROPERTY TRUST] includePropertyTrust:', formValues.includePropertyTrust);
  console.log('[VALIDATE PROPERTY TRUST] propertyTrustScheduleNumber:', formValues.propertyTrustScheduleNumber);
  console.log('[VALIDATE PROPERTY TRUST] propertyTrustDetails exists:', !!formValues.propertyTrustDetails);
  console.log('[VALIDATE PROPERTY TRUST] propertyTrustTerms exists:', !!formValues.propertyTrustTerms);

  // Check if Property Trust is enabled
  const isPropertyTrustEnabled = formValues.includePropertyTrust === 'Yes' || 
                                  formValues.includePropertyTrust === true ||
                                  String(formValues.includePropertyTrust || '').toLowerCase() === 'yes';
  
  const scheduleNumber = formValues.propertyTrustScheduleNumber ? 
                         String(formValues.propertyTrustScheduleNumber).trim() : '';
  
  console.log('[VALIDATE PROPERTY TRUST] isPropertyTrustEnabled:', isPropertyTrustEnabled);
  console.log('[VALIDATE PROPERTY TRUST] scheduleNumber:', scheduleNumber);
  console.log('[VALIDATE PROPERTY TRUST] propertyTrustDetails:', formValues.propertyTrustDetails ? `EXISTS (${formValues.propertyTrustDetails.length} chars)` : 'MISSING');
  console.log('[VALIDATE PROPERTY TRUST] propertyTrustTerms:', formValues.propertyTrustTerms ? `EXISTS (${formValues.propertyTrustTerms.length} chars)` : 'MISSING');

  if (isPropertyTrustEnabled && scheduleNumber && scheduleNumber !== '') {
    const detailsValue = formValues.propertyTrustDetails;
    const termsValue = formValues.propertyTrustTerms;
    
    const hasDetails = detailsValue && 
                      String(detailsValue).trim() !== '' && 
                      String(detailsValue).trim() !== 'undefined' &&
                      !String(detailsValue).includes('[MISSING');
    const hasTerms = termsValue && 
                    String(termsValue).trim() !== '' && 
                    String(termsValue).trim() !== 'undefined' &&
                    !String(termsValue).includes('[MISSING');

    console.log('[VALIDATE PROPERTY TRUST] hasDetails:', hasDetails, 'detailsValue:', detailsValue?.substring(0, 50));
    console.log('[VALIDATE PROPERTY TRUST] hasTerms:', hasTerms, 'termsValue:', termsValue?.substring(0, 50));

    if (!hasDetails || !hasTerms) {
      const missingParts = [];
      if (!hasDetails) missingParts.push('Property Details');
      if (!hasTerms) missingParts.push('Property Trust Terms');

      const propertyTrustSectionIndex = formData.formSections.findIndex(
        s => s.formSection === 'Property Trust'
      );

      issues.push({
        section: 'Property Trust',
        sectionId: 'propertyTrustSection',
        fieldId: !hasDetails ? 'propertyTrustDetails' : 'propertyTrustTerms',
        targetFieldIds: [
          ...(!hasDetails ? ['propertyTrustDetails'] : []),
          ...(!hasTerms ? ['propertyTrustTerms'] : [])
        ],
        targetSectionIndex: propertyTrustSectionIndex,
        issue: 'Missing Schedule content in Property Trust section.',
        message: `Schedule ${scheduleNumber} is referenced but ${missingParts.join(' and ')} ${missingParts.length === 1 ? 'is' : 'are'} missing.`,
        fieldLabel: `Schedule ${scheduleNumber}`,
        scheduleNumber,
        missingFields: missingParts
      });
    }
  }

  return issues;
};

/**
 * Validate Business Property Relief Trust Schedule content
 * @param {Object} formValues - Current form values
 * @param {Object} [formDataParam] - Optional form definition (uses default if not provided)
 * @returns {Array} Validation issues for BPR Trust schedules
 */
export const validateBPRTrustSchedules = (formValues, formDataParam) => {
  const formData = getFormData(formDataParam);
  const issues = [];

  const intent = getBprTrustClientIntent(formValues);

  console.log('[VALIDATE BPR TRUST] Checking validation...');
  console.log('[VALIDATE BPR TRUST] bprTrustClientIntent:', intent);
  console.log('[VALIDATE BPR TRUST] bprTrustScheduleNumber:', formValues.bprTrustScheduleNumber);
  console.log('[VALIDATE BPR TRUST] bprTrustDetails exists:', !!formValues.bprTrustDetails);
  console.log('[VALIDATE BPR TRUST] bprTrustTerms exists:', !!formValues.bprTrustTerms);

  if (intent === 'Unsure' || intent === 'No' || intent === '') {
    console.log('[VALIDATE BPR TRUST] Skipping schedule content validation for intent:', intent || '(empty)');
    return issues;
  }

  // Client requested BPR (Yes) — require schedule content when a schedule number is present (legacy: includeBPRTrust)
  const isBPRTrustEnabled = intent === 'Yes' ||
                            formValues.includeBPRTrust === 'Yes' ||
                            formValues.includeBPRTrust === true ||
                            String(formValues.includeBPRTrust || '').toLowerCase() === 'yes';
  
  const scheduleNumber = formValues.bprTrustScheduleNumber ? 
                         String(formValues.bprTrustScheduleNumber).trim() : '';
  
  console.log('[VALIDATE BPR TRUST] isBPRTrustEnabled:', isBPRTrustEnabled);
  console.log('[VALIDATE BPR TRUST] scheduleNumber:', scheduleNumber);
  console.log('[VALIDATE BPR TRUST] bprTrustDetails:', formValues.bprTrustDetails ? `EXISTS (${formValues.bprTrustDetails.length} chars)` : 'MISSING');
  console.log('[VALIDATE BPR TRUST] bprTrustTerms:', formValues.bprTrustTerms ? `EXISTS (${formValues.bprTrustTerms.length} chars)` : 'MISSING');

  if (isBPRTrustEnabled && scheduleNumber && scheduleNumber !== '') {
    const detailsValue = formValues.bprTrustDetails;
    const termsValue = formValues.bprTrustTerms;
    
    const hasDetails = detailsValue && 
                      String(detailsValue).trim() !== '' && 
                      String(detailsValue).trim() !== 'undefined' &&
                      !String(detailsValue).includes('[MISSING');
    const hasTerms = termsValue && 
                    String(termsValue).trim() !== '' && 
                    String(termsValue).trim() !== 'undefined' &&
                    !String(termsValue).includes('[MISSING');

    console.log('[VALIDATE BPR TRUST] hasDetails:', hasDetails, 'detailsValue:', detailsValue?.substring(0, 50));
    console.log('[VALIDATE BPR TRUST] hasTerms:', hasTerms, 'termsValue:', termsValue?.substring(0, 50));

    if (!hasDetails || !hasTerms) {
      const missingParts = [];
      if (!hasDetails) missingParts.push('Business Property Details');
      if (!hasTerms) missingParts.push('Business Property Relief Trust Terms');

      const bprSectionIndex = formData.formSections.findIndex(
        s => s.formSection === 'Business Interests'
      );

      console.log('[VALIDATE BPR TRUST] ❌ Missing content detected, creating validation issue');
      console.log('[VALIDATE BPR TRUST] Missing parts:', missingParts);
      console.log('[VALIDATE BPR TRUST] Section index:', bprSectionIndex);
      console.log('[VALIDATE BPR TRUST] Field ID will be:', !hasDetails ? 'bprTrustDetails' : 'bprTrustTerms');

      issues.push({
        section: 'Business Interests',
        sectionId: 'bprTrustSection',
        fieldId: !hasDetails ? 'bprTrustDetails' : 'bprTrustTerms',
        targetFieldIds: [
          ...(!hasDetails ? ['bprTrustDetails'] : []),
          ...(!hasTerms ? ['bprTrustTerms'] : [])
        ],
        targetSectionIndex: bprSectionIndex,
        issue: 'Missing Schedule content in Business Interests section.',
        message: `Schedule ${scheduleNumber} is referenced but ${missingParts.join(' and ')} ${missingParts.length === 1 ? 'is' : 'are'} missing.`,
        fieldLabel: `Schedule ${scheduleNumber}`,
        scheduleNumber,
        missingFields: missingParts
      });
      
      console.log('[VALIDATE BPR TRUST] ✅ Created validation issue:', issues[0]);
    }
  }

  console.log('[VALIDATE BPR TRUST] Returning', issues.length, 'issues');
  return issues;
};

/**
 * Get all validation issues for the current form state
 * @param {Object} formValues - Current form values
 * @param {Array} pdfMissingItems - Missing items from PDF generation
 * @param {Array} scheduleIssues - Schedule-related issues
 * @returns {Array} All normalized validation issues
 */
export const getAllValidationIssues = (formValues, pdfMissingItems = [], scheduleIssues = []) => {
  const preValidationIssues = [
    ...validatePropertyTrustSchedules(formValues),
    ...validateBPRTrustSchedules(formValues)
  ];

  return collectAllMissingItems(
    pdfMissingItems,
    scheduleIssues,
    preValidationIssues,
    formValues
  );
};
