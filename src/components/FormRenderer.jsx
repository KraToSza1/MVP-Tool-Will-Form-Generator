import React, { useState, useEffect, useMemo } from 'react';
import formData from '../data/Complete-WillSuite-Form-Data.json';
import Sidebar from './Sidebar.jsx';
import FieldRenderer from './FieldRenderer.jsx';
import { Download, FileText, Scroll, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft, Save, Sparkles, FileCheck } from 'lucide-react';
import { generatePDFWithJSPDF } from './PDFGeneratorJSPDF.js';

export default function FormRenderer() {
  const [currentIndex, setCurrentIndex] = useState(0);
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
        console.warn('Corrupted data detected in localStorage, clearing...');
        localStorage.removeItem('willForm');
        // Cleared corrupted data
        return {};
      }
      // Loaded from localStorage
      return parsed;
    } catch (e) {
      console.error('Error parsing localStorage data:', e);
      localStorage.removeItem('willForm');
        // Cleared due to parsing error
      return {};
    }
  });
  const [submitted, setSubmitted] = useState(false);
  const [expandedFields, setExpandedFields] = useState({});
  const currentSection = formData.formSections[currentIndex];

  // ---------------------------
  // Text Interpolation Logic
  // ---------------------------
  const interpolateText = (text, values, context = '') => {
    if (typeof text !== 'string') {
      return text;
    }

    const fallbackMap = {
      guardiansSection: 'guardianData',
      substituteGuardiansSection: 'substituteGuardianData',
      guardianshipDetailsSection: 'guardianshipDetailsData',
      signingOnBehalfSection: 'signingOnBehalfData',
      interpreterSection: 'interpreterData',
      chattelRecipientsSection: 'chattelRecipientsData',
      excludedPersonSection: 'excludedPersonData',
      petCarerSection: 'petCarerData',
      substitutePetCarerSection: 'substitutePetCarerData',
      professionalTrusteesSection: 'professionalTrusteeData',
      substituteProfessionalTrusteesSection: 'substituteProfessionalTrusteeData',
      separateTrusteesSection: 'separateTrusteeData',
      monetaryGiftsSection: 'monetaryGiftsDetails',
      specificGiftsSection: 'specificGiftsDetails',
      propertyGiftsSection: 'propertyGiftsDetails',
      debtorsSection: 'debtorsData',
      partnerSection: 'partnerData'
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

      // Handle nested section fields (e.g., partnerSection:relationship, partnerSection:fullName)
      const fallbackId = fallbackMap[sectionId] || `${sectionId}Data`;
      const sectionData = values[fallbackId] || values[sectionId];
      
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        // Get the first item from the array
        const firstItem = sectionData[0];
        if (typeof firstItem === 'object' && firstItem !== null) {
          // Try various naming conventions for the field
          const fieldValue = firstItem[subField] || 
                           firstItem[subField.charAt(0).toLowerCase() + subField.slice(1)] ||
                           firstItem[subField.charAt(0).toUpperCase() + subField.slice(1)] ||
                           firstItem[subField.toLowerCase()] ||
                           firstItem[subField.toUpperCase()];
          if (fieldValue && (typeof fieldValue === 'string' || typeof fieldValue === 'number')) {
            const result = fieldValue.toString();
            // Skip data URLs and very long strings
            if (result.startsWith('data:') || result.length > 10000) {
              return '';
            }
            return result;
          }
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
  const evaluateFieldConditions = (field) => {
    if (!field.conditions) return true;
    
    const evalClause = (clause) => {
      const value = formValues[clause.field];
      if (clause.operator === 'eq') return value === clause.value;
      if (clause.operator === 'in') return Array.isArray(clause.value) ? clause.value.includes(value) : value === clause.value;
      if (clause.operator === 'AND' || clause.operator === 'OR') {
        const results = clause.clauses.map(evalClause);
        return clause.operator === 'AND' ? results.every(Boolean) : results.some(Boolean);
      }
      return false;
    };
    
    return Array.isArray(field.conditions)
      ? field.conditions.every(evalClause)
      : evalClause(field.conditions);
  };

  // ---------------------------
  // Validation: Required Fields
  // ---------------------------
  const allRequiredFilled = currentSection.fields.every(field => {
    // Skip fields that shouldn't be shown (conditions not met)
    if (field.conditions && !evaluateFieldConditions(field)) {
      return true; // Field is hidden, so it's "valid"
    }
    
    // Skip hidden, button, and display fields
    if (['button', 'hidden', 'display'].includes(field.type)) {
      return true;
    }
    
    if (field.required) {
      if (field.type === 'checkboxGroup') {
        return Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
      }
      return !!formValues[field.id];
    }
    return true;
  });

  const isFormFullyCompleted = () => {
    try {
    return formData.formSections.every(section =>
      section.fields.every(field => {
          // Skip fields that shouldn't be shown (conditions not met)
          if (!evaluateFieldConditions(field)) {
            return true; // Field is hidden, so it's "valid"
          }
          
          // Skip hidden fields, button fields, and display fields
          if (['button', 'hidden', 'display'].includes(field.type)) {
            return true;
          }
          
          // Check required fields
        if (field.required) {
          if (field.type === 'checkboxGroup') {
            return Array.isArray(formValues[field.id]) && formValues[field.id].length > 0;
          }
            if (field.type === 'section' && field.subFields) {
              // For sections, check if at least one subfield is filled if required
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
              return hasRequiredSubFieldFilled || hasNoRequiredSubFields;
            }
          return !!formValues[field.id];
        }
        return true;
      })
    );
    } catch (error) {
      console.error('Error checking form completion:', error);
      // If there's an error, allow download anyway
      return true;
    }
  };

  // ---------------------------
  // Navigation Logic
  // ---------------------------
  const goNext = () => {
    // Check if all required fields are filled before allowing navigation
    if (!allRequiredFilled) {
      // Scroll to first invalid field or show error message
      const firstInvalidField = currentSection.fields.find(field => {
        if (field.conditions && !evaluateFieldConditions(field)) return false;
        if (['button', 'hidden', 'display'].includes(field.type)) return false;
        if (field.required) {
          if (field.type === 'checkboxGroup') {
            return !(Array.isArray(formValues[field.id]) && formValues[field.id].length > 0);
          }
          return !formValues[field.id];
        }
        return false;
      });
      
      if (firstInvalidField) {
        // Scroll to the field
        const fieldElement = document.querySelector(`[data-field-id="${firstInvalidField.id}"]`);
        if (fieldElement) {
          fieldElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add a highlight effect
          fieldElement.classList.add('animate-pulse');
          setTimeout(() => fieldElement.classList.remove('animate-pulse'), 2000);
        }
        // Focus on the first input in that field
        const input = fieldElement?.querySelector('input, textarea, select');
        if (input) {
          setTimeout(() => input.focus(), 500);
        }
      }
      
      // Show alert message
      alert(`Please complete all required fields marked with * before proceeding.\n\nMissing field: ${firstInvalidField?.label || 'Required field'}`);
      return;
    }
    
    if (currentIndex < formData.formSections.length - 1) {
      const nextIndex = currentIndex + 1;
      const nextSection = formData.formSections[nextIndex];
      setCurrentIndex(nextIndex);
    } else {
      setSubmitted(true);
      localStorage.removeItem('willForm');
    }
  };

  const goBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const saveDraft = () => {
    try {
      // Remove signature data URLs before saving (they're too large and cause issues)
      const dataToSave = {};
      for (const [key, value] of Object.entries(formValues)) {
        // Skip signature fields (they'll be re-added if needed)
        if (key.toLowerCase().includes('signature')) {
          continue;
        }
        // Skip data URLs
        if (typeof value === 'string' && value.startsWith('data:image')) {
          continue;
        }
        // Skip corrupted data
        if (isInvalidNumber(value)) {
          continue;
        }
        dataToSave[key] = value;
      }
      
      // Check localStorage quota
      const testStr = JSON.stringify(dataToSave);
      if (testStr.length > 5 * 1024 * 1024) { // 5MB limit
        alert('Form data is too large to save. Please reduce the amount of data.');
        return;
      }
      
      localStorage.setItem('willForm', testStr);
      alert('Draft saved successfully! Your progress has been saved to your device.');
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        alert('Storage is full. Please clear some space or reduce form data.');
      } else {
        console.error('[PDF] Error saving draft:', error);
        alert('Error saving draft: ' + error.message);
      }
    }
  };

  // Calculate clause preview - moved outside JSX to fix React Hooks error
  // (evaluateFieldConditions is already defined above, reusing it)
  const clausePreview = useMemo(() => {
    // Only render clause preview from step 2 onwards
    if (currentIndex < 1) {
      return null;
    }

    // Collect clauses from all sections up to and including the current one
    const allClauses = [];
    
    // Process all sections up to current index (and current section)
    const sectionsToProcess = formData.formSections.slice(0, currentIndex + 1);
    
    sectionsToProcess.forEach(section => {
      section.fields.forEach(field => {
        // Skip fields that shouldn't be shown (conditions not met)
        if (field.conditions && !evaluateFieldConditions(field)) {
          return; // Skip this field
        }
        
        // Skip hidden, button, and display fields
        if (['button', 'hidden', 'display'].includes(field.type)) {
          return;
        }
        
        // Check field's willClauseText
        if (field.willClauseText) {
          const interpolated = interpolateText(field.willClauseText, formValues, `section-${section.formSection}-field-${field.id}`);
          if (interpolated && !/\{\{field:[^}]+\}\}/.test(interpolated) && interpolated.trim() !== '') {
            allClauses.push({
              id: `${section.formSection}-${field.id}`,
              text: interpolated,
              fieldLabel: `${section.formSection}: ${field.label}`,
              section: section.formSection
            });
          }
        }
        
        // Check options' willClauseText for radio/select fields
        if (field.options && (field.type === 'radio' || field.type === 'select')) {
          const selectedValue = formValues[field.id];
          if (selectedValue) {
            const selectedOption = field.options.find(opt => opt.value === selectedValue);
            if (selectedOption?.willClauseText) {
              const interpolated = interpolateText(selectedOption.willClauseText, formValues);
              if (interpolated && !/\{\{field:[^}]+\}\}/.test(interpolated) && interpolated.trim() !== '') {
                allClauses.push({
                  id: `${section.formSection}-${field.id}-${selectedOption.value}`,
                  text: interpolated,
                  fieldLabel: `${section.formSection}: ${field.label}: ${selectedOption.label}`,
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
              const interpolated = interpolateText(subField.willClauseText, formValues);
              if (interpolated && !/\{\{field:[^}]+\}\}/.test(interpolated) && interpolated.trim() !== '') {
                allClauses.push({
                  id: `${section.formSection}-${field.id}-${subField.id}`,
                  text: interpolated,
                  fieldLabel: `${section.formSection}: ${field.label}: ${subField.label}`,
                  section: section.formSection
                });
              }
            }
          });
        }
      });
    });

    if (allClauses.length === 0) {
      return null;
    }

    return allClauses;
  }, [currentIndex, formValues, currentSection]);

  // Check if a value contains invalid numbers
  const hasInvalidNumber = (val) => {
    if (typeof val === 'number') {
      return !isFinite(val) || Math.abs(val) >= 1e10 || isNaN(val);
    }
    if (typeof val === 'string') {
      if (val.includes('-1.8') || val.includes('1.8e+22') || val.includes('-1.80000') || val.includes('1.80000e+')) {
        return true;
      }
      const largeNumberMatch = val.match(/-?\d+\.?\d*[eE][+-]?\d+/g);
      if (largeNumberMatch) {
        for (const numStr of largeNumberMatch) {
          const num = parseFloat(numStr);
          if (!isFinite(num) || Math.abs(num) >= 1e10 || isNaN(num)) {
            return true;
          }
        }
      }
      const bigNumberMatch = val.match(/-?\d{15,}/g);
      if (bigNumberMatch) {
        for (const numStr of bigNumberMatch) {
          const num = parseFloat(numStr);
          if (!isFinite(num) || Math.abs(num) >= 1e10) {
            return true;
          }
        }
      }
    }
    return false;
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
      } catch (e) {
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
    try {
      console.log('[PDF] Starting PDF generation...');
      
      // Aggressively sanitize all form values
      let sanitizedValues = sanitizeFormValues(formValues);
      
      // Extract testator signature separately (only valid one) - handle both drawn and uploaded
      let testatorSignature = null;
      if (formValues.testatorSignature && 
          typeof formValues.testatorSignature === 'string' && 
          formValues.testatorSignature.startsWith('data:image') &&
          formValues.testatorSignature.length > 100 &&
          formValues.testatorSignature.length < 3000000 && // Increased limit for uploaded images
          !isInvalidNumber(formValues.testatorSignature)) {
        try {
          testatorSignature = formValues.testatorSignature;
        } catch (e) {
          console.error('[PDF] Invalid signature image, skipping');
        }
      }
      
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
          } catch (e) {
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
          console.warn('[PDF] Corrupted data detected in formValues, clearing localStorage...');
          localStorage.removeItem('willForm');
          // Create minimal safe fallback
          sanitizedValues = {
            firstName: sanitizeText(String(formValues.firstName || '')),
            lastName: sanitizeText(String(formValues.lastName || ''))
          };
        }
      } catch (e) {
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
      } catch (e) {
        console.error('[PDF] Cannot serialize form values, using safe fallback');
        sanitizedValues = { firstName: sanitizedValues.firstName || '', lastName: sanitizedValues.lastName || '' };
      }
      
      // Final check: scan sanitizedValues one more time for any corrupted numbers
      const finalCheck = JSON.stringify(sanitizedValues);
      if (finalCheck.includes('-1.8') && (finalCheck.includes('e+22') || finalCheck.includes('e+2'))) {
        console.warn('[PDF] Corrupted data still detected! Clearing problematic fields...');
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
          console.warn('[PDF] Removed corrupted fields:', problemFields);
        }
      }
      
      console.log('[PDF] Generating PDF with jsPDF...');
      
      // Use jsPDF instead of React PDF Renderer (now async)
      const doc = await generatePDFWithJSPDF(sanitizedValues, testatorSignature);
      
      console.log('[PDF] PDF generated successfully');
      
      // Save and download the PDF
      doc.save('Will-Preview.pdf');
      
      console.log('[PDF] Download initiated');
    } catch (error) {
      console.error('[PDF] Generation Error:', error);
      console.error('[PDF] Error details:', {
        message: error.message,
        stack: error.stack,
        formValuesKeys: Object.keys(formValues).length
      });
      alert(`Error generating PDF: ${error.message || 'Unknown error'}\n\nPlease try saving your draft and refreshing the page, then try again.`);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} />

      {/* Main Content */}
      <main className="flex-1 flex justify-center py-6 px-4 sm:px-6 lg:px-8 animate-fadeIn">
        <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl p-4 sm:p-6 border border-gray-200 transition-all duration-300 hover:shadow-2xl">
          {/* Title */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
              {formData.formTitle || 'Legacy Last Will & Testament Questionnaire'}
            </h1>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="mb-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-500" />
                Progress
              </span>
              <span className="text-sm font-semibold text-indigo-600">
                Step {currentIndex + 1} of {formData.formSections.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-indigo-700 h-3 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
                style={{ width: `${((currentIndex + 1) / formData.formSections.length) * 100}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
            </div>
          </div>

          {/* Title & PDF Download */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3">
            {/* PDF Download Button - Enhanced */}
            {currentIndex === formData.formSections.length - 1 ? (
              isFormFullyCompleted() ? (
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 font-medium cursor-pointer z-10 relative transform hover:scale-105 active:scale-95 hover:shadow-xl animate-pulse-subtle"
                  type="button"
                >
                  <Download size={20} className="animate-bounce-subtle" />
                  <span>Download PDF</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                  <AlertCircle size={16} />
                  <span className="italic">Complete all required fields to enable download</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-4 py-2 rounded-lg">
                <AlertCircle size={16} />
                <span className="italic">Complete all steps to enable download</span>
              </div>
            )}
          </div>

          {/* Enhanced Section Header */}
          <div className="flex items-center gap-2 mb-3 pb-1.5 border-b-2 border-indigo-600">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
            {currentSection.formSection}
          </h2>
          </div>

          {/* Fields with Animations */}
          <div className="space-y-3">
            {currentSection.fields.map((field, idx) => {
              // Interpolate field's willClauseText
              const interpolatedFieldWillClause = field.willClauseText 
                ? interpolateText(field.willClauseText, formValues) 
                : null;
              
              // Interpolate options' willClauseText if field has options
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
                  className="animate-slideIn opacity-0"
                  style={{ 
                    animationDelay: `${idx * 0.1}s`,
                    animationFillMode: 'forwards'
                  }}
                >
                <FieldRenderer
                    field={{ 
                      ...field, 
                      willClauseText: interpolatedFieldWillClause,
                      options: interpolatedOptions || field.options
                    }}
                  formValues={formValues}
                  setFormValues={setFormValues}
                  expandedFields={expandedFields}
                  setExpandedFields={setExpandedFields}
                />
              </div>
              );
            })}
          </div>

          {/* Enhanced Navigation */}
          <div className="flex flex-col sm:flex-row justify-between mt-6 gap-3">
            <button
              onClick={goBack}
              disabled={currentIndex === 0}
              className="flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transform hover:scale-105 active:scale-95 shadow-md disabled:shadow-none"
            >
              <ChevronLeft size={18} />
              <span>Back</span>
            </button>
            <button
              onClick={goNext}
              disabled={!allRequiredFilled}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed font-medium transform hover:scale-105 active:scale-95 disabled:transform-none"
              type="button"
            >
              <span>{currentIndex === formData.formSections.length - 1 ? 'Submit' : 'Next'}</span>
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Enhanced Save + Preview */}
          <div className="mt-4 flex flex-col gap-3">
            <button
              onClick={saveDraft}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-black px-6 py-3 rounded-xl shadow-md transition-all duration-300 self-start font-medium transform hover:scale-105 active:scale-95"
              type="button"
            >
              <Save size={18} />
              <span>Save Draft</span>
            </button>

            {/* Enhanced Clause Preview with Animations - Only show from step 2 onwards */}
            {clausePreview && clausePreview.length > 0 ? (
              <aside className="w-full bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl">
                {/* Enhanced Header */}
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

                {/* Enhanced Content */}
                <div className={`p-4 ${clausePreview.length > 3 ? 'max-h-96 overflow-y-auto custom-scrollbar' : ''}`}>
                  <div className="space-y-4">
                    {clausePreview.map((clause, index) => (
                      <div 
                        key={clause.id} 
                        className="bg-white border-l-4 border-indigo-500 rounded-r-lg p-3 shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-[1.02] hover:-translate-y-0.5"
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm mt-0.5 shadow-sm">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-indigo-700 mb-1 uppercase tracking-wide flex items-center gap-2">
                              {clause.section && clause.section !== currentSection.formSection && (
                                <span className="text-indigo-600">{clause.section} → </span>
                              )}
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
              </aside>
            ) : currentIndex >= 1 ? (
              <aside className="w-full bg-gradient-to-br from-indigo-50 via-white to-blue-50 border-2 border-indigo-200 rounded-xl shadow-lg overflow-hidden">
                <div className="p-4">
                  <div className="text-center py-12 animate-fadeIn">
                    <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                      <Scroll className="w-10 h-10 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium mb-1.5">No clauses to preview yet</p>
                    <p className="text-sm text-gray-500 mb-1.5">
                      Complete the form fields above to see generated will clauses appear here
                    </p>
                    </div>
              </div>
            </aside>
            ) : null}
          </div>
        </div>
      </main>

      {/* Modal */}
      {submitted && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 px-4">
          <div className="bg-white p-6 sm:p-8 rounded-lg shadow-lg text-center max-w-md w-full">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-900">Submission Complete!</h2>
            <p className="text-gray-700">Your will form has been submitted successfully.</p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-all duration-200 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
