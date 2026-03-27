// Shared clause builder for Preview and PDF
// Set VITE_DEBUG_CLAUSES=true in .env to enable verbose [BUILD CLAUSES] logs
const DEBUG_CLAUSES = import.meta.env.VITE_DEBUG_CLAUSES === 'true';

export const buildClauses = ({
  formValues,
  formData,
  interpolateText,
  maxSectionIndex = null
}) => {
  if (!formData || !formData.formSections || !Array.isArray(formData.formSections)) return [];
  const clauses = [];
  const seen = new Set();
  const sections = maxSectionIndex == null
    ? formData.formSections
    : formData.formSections.slice(0, maxSectionIndex + 1);

  const extractFieldIds = (template) => {
    if (!template || typeof template !== 'string') return [];
    const ids = [];
    const regex = /\{\{field:([^}:]+)(?::[^}]+)?\}\}/g;
    let match;
    while ((match = regex.exec(template))) {
      ids.push(match[1]);
    }
    return ids;
  };

  const hasValue = (value) => {
    if (value == null) return false;
    if (Array.isArray(value)) return value.length > 0;
    return String(value).trim() !== '';
  };

  const hasFieldValue = (fieldId) => {
    if (!fieldId) return false;
    if (hasValue(formValues[fieldId])) return true;
    
    // CRITICAL FIX: Special handling for executor sections - check for Aristone selection
    if (fieldId === 'executorsSection') {
      // Check if Aristone was selected via chooseAristoneExecutor
      if (formValues.chooseAristoneExecutor === 'Aristone') {
        if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] ✅ hasFieldValue found executorsSection via chooseAristoneExecutor`);
        return true;
      }
    }
    
    if (fieldId === 'substituteExecutorsSection') {
      // Check if Aristone was selected via chooseAristoneSubstituteExecutor
      if (formValues.chooseAristoneSubstituteExecutor === 'Aristone') {
        if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] ✅ hasFieldValue found substituteExecutorsSection via chooseAristoneSubstituteExecutor`);
        return true;
      }
    }
    
    // CRITICAL FIX: Special handling for pet carer sections - check if provisionsForPets is "Yes"
    // and if petCarerData/substitutePetCarerData exists and contains valid entries
    if (fieldId === 'petCarerSection') {
      // Only check if provisionsForPets is "Yes"
      if (formValues.provisionsForPets === 'Yes') {
        const petCarerData = formValues.petCarerData;
        // Check if petCarerData exists and contains valid entries (objects with firstName/lastName/address1)
        if (Array.isArray(petCarerData) && petCarerData.length > 0) {
          const hasValidEntries = petCarerData.some(item => 
            item && typeof item === 'object' && 
            (item.firstName || item.lastName || item.address1)
          );
          if (hasValidEntries) {
            if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] ✅ hasFieldValue found petCarerSection via petCarerData with valid entries`);
            return true;
          }
        }
      }
    }
    
    if (fieldId === 'substitutePetCarerSection') {
      // Only check if provisionsForPets is "Yes"
      if (formValues.provisionsForPets === 'Yes') {
        const substitutePetCarerData = formValues.substitutePetCarerData;
        // Check if substitutePetCarerData exists and contains valid entries
        if (Array.isArray(substitutePetCarerData) && substitutePetCarerData.length > 0) {
          const hasValidEntries = substitutePetCarerData.some(item => 
            item && typeof item === 'object' && 
            (item.firstName || item.lastName || item.address1)
          );
          if (hasValidEntries) {
            if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] ✅ hasFieldValue found substitutePetCarerSection via substitutePetCarerData with valid entries`);
            return true;
          }
        }
      }
    }
    
    // Fallback map for section fields (matches interpolateText logic)
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
      debtsReleasedSection: 'debtorData',
      digitalExecutorSection: 'digitalExecutorData',
      digitalExecutorsSection: 'digitalExecutorData', // CRITICAL FIX: Added missing mapping
      executorsSection: 'executorData', // CRITICAL FIX: Added missing mapping
      substituteExecutorsSection: 'substituteExecutorData', // CRITICAL FIX: Added missing mapping
      professionalExecutorSection: 'professionalExecutorData',
      substituteProfessionalExecutorSection: 'substituteProfessionalExecutorData',
      separateBusinessTrusteeSection: 'separateTrusteeData'
    };
    
    // Check fallback map first
    const fallbackId = fallbackMap[fieldId] || `${fieldId}Data`;
    if (hasValue(formValues[fallbackId])) {
      // Debug logging for executor and pet carer fields
      if (fieldId === 'executorsSection' || fieldId === 'substituteExecutorsSection' || 
          fieldId === 'petCarerSection' || fieldId === 'substitutePetCarerSection') {
        console.log(`[BUILD CLAUSES] ✅ hasFieldValue found ${fieldId} via fallback:`, {
          fieldId,
          fallbackId,
          value: formValues[fallbackId],
          arrayLength: Array.isArray(formValues[fallbackId]) ? formValues[fallbackId].length : 'N/A'
        });
      }
      return true;
    }
    
    // Then check standard candidates
    const candidates = [
      `${fieldId}Data`,
      `${fieldId}Details`,
      `${fieldId}Name`,
      `${fieldId}Number`,
      `${fieldId}Value`,
      `${fieldId}Text`
    ];
    const found = candidates.some((key) => hasValue(formValues[key]));
    
    if (DEBUG_CLAUSES && !found && (fieldId === 'executorsSection' || fieldId === 'substituteExecutorsSection' || 
                   fieldId === 'digitalExecutorsSection' || fieldId === 'petCarerSection' || 
                   fieldId === 'substitutePetCarerSection')) {
      console.log(`[BUILD CLAUSES] ⚠️ hasFieldValue NOT found for ${fieldId}:`, {
        fieldId,
        fallbackId,
        fallbackValue: formValues[fallbackId],
        chooseAristoneExecutor: formValues.chooseAristoneExecutor,
        chooseAristoneSubstituteExecutor: formValues.chooseAristoneSubstituteExecutor,
        candidates: candidates.map(c => ({ key: c, value: formValues[c] }))
      });
    }
    
    return found;
  };

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
    if (clause.operator === 'eq') return value === clause.value;
    if (clause.operator === 'ne') return value !== clause.value;
    if (clause.operator === 'includes') {
      return Array.isArray(value) && value.includes(clause.value);
    }
    if (clause.operator === 'in') {
      if (!Array.isArray(clause.value)) return value === clause.value;
      return clause.value.includes(value);
    }
    return false;
  };

  const evaluateConditions = (conditions, conditionLogic) => {
    if (!conditions) return true;
    if (Array.isArray(conditions)) {
      const logic = conditionLogic === 'OR' ? 'OR' : 'AND';
      return logic === 'OR' ? conditions.some(evalClause) : conditions.every(evalClause);
    }
    return evalClause(conditions);
  };

  const addClause = ({ section, field, template, text, id, isConditional = false }) => {
    const fieldIds = extractFieldIds(template);
    const missingFields = fieldIds.filter((fid) => !hasFieldValue(fid));
    const trimmed = String(text || '').trim();
    
    // CRITICAL FIX: Check for unresolved markers in interpolated text
    // If interpolation returned unresolved markers like {{field:...}}, the clause is incomplete
    const hasUnresolvedMarkers = /\{\{field:[^}]+\}\}/.test(text);
    
    // CRITICAL FIX: Check for missing subjects (patterns that indicate incomplete interpolation)
    const hasMissingSubject =
      /\bmy\s+\.\b/i.test(text) ||
      /\bfor\s+\.\b/i.test(text) ||
      /\bupon\s+trust\s+for\s+\.\b/i.test(text) ||
      /\bI appoint\s+to serve/i.test(text) ||
      /\bI appoint\s+as\s+Trustees/i.test(text) ||
      // CRITICAL: Also check for "I appoint [name] as Trustees" where name is testator (illegal substitution)
      (/\bI appoint\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+as\s+Trustees/i.test(text) && 
       text.includes(formValues.firstName) && text.includes(formValues.lastName) && 
       !fieldIds.some(fid => fid.includes('Trustee') || fid.includes('trustee'))) ||
      // CRITICAL: Check for "my [testator name]" in pet carer clauses (illegal substitution)
      (/\bmy\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/i.test(text) && 
       (text.includes('care for') || text.includes('is unable')) &&
       text.includes(formValues.firstName) && text.includes(formValues.lastName) &&
       !fieldIds.some(fid => fid.includes('pet') || fid.includes('carer')));
    
    // CRITICAL: If clause has no field references, it cannot be incomplete (it's a complete sentence)
    const hasNoFieldRefs = fieldIds.length === 0;
    
    // CRITICAL FIX: Mark as incomplete if:
    // 1. Has unresolved markers (interpolation failed)
    // 2. Has missing fields
    // 3. Has missing subject patterns
    // 4. Is empty
    // BUT: Only if it has field references (otherwise it's a static complete sentence)
    const incomplete = hasNoFieldRefs ? false : (
      hasUnresolvedMarkers || 
      missingFields.length > 0 || 
      hasMissingSubject || 
      trimmed === ''
    );
    
    if (DEBUG_CLAUSES && (id.includes('failedMoneyGiftPassProportionately') || 
        id.includes('failedSpecificGiftPassProportionately') || 
        id.includes('failedPropertyGiftPassProportionately') ||
        id.includes('provisionsForPets') ||
        id.includes('substitutePetCarer') ||
        id.includes('petCarerSection') ||
        id.includes('separateTrustees') ||
        id.includes('appointSeparateTrusteesFLIT'))) {
      console.log(`[BUILD CLAUSES] 🔍 ANALYZING CLAUSE: ${id}`, {
        id,
        template: template,
        text: text,
        trimmed: trimmed,
        trimmedLength: trimmed.length,
        isEmpty: trimmed === '',
        fieldIds,
        fieldIdsLength: fieldIds.length,
        hasNoFieldRefs,
        missingFields,
        missingFieldsLength: missingFields.length,
        hasUnresolvedMarkers,
        hasMissingSubject,
        hasMissingSubjectMatch: hasMissingSubject ? text.match(/\bmy\s+\.\b|\bfor\s+\.\b|\bupon\s+trust\s+for\s+\.\b|\bI appoint\s+to serve|\bI appoint\s+as\s+Trustees/i) : null,
        incomplete,
        incompleteReason: incomplete ? (
          hasNoFieldRefs ? 'SHOULD NOT BE INCOMPLETE (hasNoFieldRefs=true)' :
          hasUnresolvedMarkers ? 'HAS UNRESOLVED MARKERS ({{field:...}})' :
          missingFields.length > 0 ? `MISSING FIELDS: ${missingFields.join(', ')}` :
          hasMissingSubject ? 'HAS MISSING SUBJECT (regex match)' :
          trimmed === '' ? 'TRIMMED TEXT IS EMPTY' :
          'UNKNOWN REASON'
        ) : 'COMPLETE',
        isConditional,
        willBeSkipped: incomplete // CRITICAL FIX: Block ALL incomplete clauses, not just conditional ones
      });
    }
    
    // CRITICAL FIX: Block ALL incomplete clauses, not just conditional ones
    // Incomplete clauses must NEVER be rendered - they would contain unresolved markers or testator name substitutions
    if (incomplete) {
      if (DEBUG_CLAUSES) console.warn(`[BUILD CLAUSES] ⚠️ BLOCKING incomplete clause "${id}" - will not be added to clauses array`);
      return; // Skip this clause entirely - do not add to clauses array
    }
    
    // CRITICAL FIX: Double-check for unresolved markers even if incomplete check passed
    // This is a safety net in case the incomplete check missed something
    if (hasUnresolvedMarkers) {
      if (DEBUG_CLAUSES) console.error(`[BUILD CLAUSES] ❌ CRITICAL ERROR: Clause "${id}" has unresolved markers but was not marked incomplete! Blocking anyway.`);
      return; // Block it
    }
    
    const normalized = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    clauses.push({
      id,
      title: (field && field.label) || (section && section.formSection) || 'Clause',
      section: section?.formSection || '',
      text,
      missingFields,
      incomplete: false // Only complete clauses reach this point
    });
  };

  sections.forEach((section) => {
    if (!section || !section.fields) return;
    section.fields.forEach((field) => {
      if (!field) return;
      if (field.excludeFromWill) return;
      if (field.conditions && !evaluateConditions(field.conditions, field.conditionLogic)) {
        // Debug logging for executor-related sections and separate trustees
        if (field.id === 'executorsSection' || field.id === 'substituteExecutorsSection' || 
            field.id === 'digitalExecutorsSection' || field.id === 'separateTrusteesSection') {
          // Enhanced logging for separate trustees - show condition evaluation results
          let conditionResults = null;
          if (field.id === 'separateTrusteesSection' && Array.isArray(field.conditions)) {
            // Handle nested condition structure: [{ operator: "AND", clauses: [...] }]
            conditionResults = field.conditions.map(cond => {
              if (cond.operator === 'AND' || cond.operator === 'OR') {
                // Nested structure - evaluate each clause
                if (Array.isArray(cond.clauses)) {
                  return {
                    operator: cond.operator,
                    clauses: cond.clauses.map(subClause => {
                      const actualValue = formValues[subClause.field];
                      const expectedValue = subClause.value;
                      const matches = actualValue === expectedValue;
                      return {
                        field: subClause.field,
                        operator: subClause.operator,
                        expected: expectedValue,
                        actual: actualValue,
                        matches
                      };
                    })
                  };
                }
              }
              // Flat structure
              const actualValue = formValues[cond.field];
              const expectedValue = cond.value;
              const matches = actualValue === expectedValue;
              return {
                field: cond.field,
                operator: cond.operator,
                expected: expectedValue,
                actual: actualValue,
                matches
              };
            });
          }
          
          if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] ⚠️ Skipping ${field.id} - conditions not met:`, {
            fieldId: field.id,
            conditions: field.conditions,
            conditionLogic: field.conditionLogic,
            conditionResults,
            formValues: {
              chooseAristoneExecutor: formValues.chooseAristoneExecutor,
              chooseAristoneSubstituteExecutor: formValues.chooseAristoneSubstituteExecutor,
              appointDigitalAssetsExecutor: formValues.appointDigitalAssetsExecutor,
              appointSeparateDigitalExecutor: formValues.appointSeparateDigitalExecutor,
              executorData: formValues.executorData,
              substituteExecutorData: formValues.substituteExecutorData,
              digitalExecutorData: formValues.digitalExecutorData,
              hasBusinessInterests: formValues.hasBusinessInterests,
              trusteePowerCarryOnBusiness: formValues.trusteePowerCarryOnBusiness,
              appointSeparateBusinessTrustee: formValues.appointSeparateBusinessTrustee,
              separateTrusteeData: formValues.separateTrusteeData
            }
          });
        }
        return;
      }
      if (['button', 'hidden', 'display'].includes(field.type)) return;

      if (field.willClauseText) {
        const interpolated = interpolateText(field.willClauseText, formValues);
        // Check if this field has conditions (making it conditional)
        const isConditional = !!(field.conditions && field.conditions.length > 0);
        
        // Debug logging for pet carer sections and separate trustees
        if (field.id === 'petCarerSection' || field.id === 'substitutePetCarerSection' || 
            field.id === 'separateTrusteesSection') {
          const fieldIds = extractFieldIds(field.willClauseText);
          const missingFields = fieldIds.filter((fid) => !hasFieldValue(fid));
          
          // Enhanced logging for separate trustees - show full data structure
          const debugData = {
            template: field.willClauseText, // Full template, no truncation
            interpolated: interpolated, // Full interpolated text, no truncation
            fieldIds,
            missingFields,
            isConditional,
            petCarerData: formValues.petCarerData,
            substitutePetCarerData: formValues.substitutePetCarerData,
            provisionsForPets: formValues.provisionsForPets,
            separateTrusteeData: formValues.separateTrusteeData,
            hasBusinessInterests: formValues.hasBusinessInterests,
            trusteePowerCarryOnBusiness: formValues.trusteePowerCarryOnBusiness,
            appointSeparateBusinessTrustee: formValues.appointSeparateBusinessTrustee
          };
          
          // For separate trustees, also check for modal field data
          if (field.id === 'separateTrusteesSection') {
            debugData.separateTrusteeDataStructure = {
              type: Array.isArray(formValues.separateTrusteeData) ? 'array' : typeof formValues.separateTrusteeData,
              length: Array.isArray(formValues.separateTrusteeData) ? formValues.separateTrusteeData.length : 'N/A',
              firstItem: Array.isArray(formValues.separateTrusteeData) && formValues.separateTrusteeData.length > 0 
                ? formValues.separateTrusteeData[0] 
                : formValues.separateTrusteeData,
              firstItemType: Array.isArray(formValues.separateTrusteeData) && formValues.separateTrusteeData.length > 0
                ? typeof formValues.separateTrusteeData[0]
                : 'N/A',
              hasFieldValue: hasFieldValue('separateTrusteesSection')
            };
            
            // Check for modal field prefixes
            const modalFields = Object.keys(formValues).filter(key => key.startsWith('addSeparateTrustee_'));
            if (modalFields.length > 0) {
              debugData.modalFieldsFound = modalFields;
              debugData.modalFieldValues = {};
              modalFields.forEach(key => {
                debugData.modalFieldValues[key] = formValues[key];
              });
            }
          }
          
          if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] Processing section field clause for ${field.id}:`, debugData);
        }
        
        addClause({
          section,
          field,
          template: field.willClauseText,
          text: interpolated,
          id: `${section.formSection}-${field.id}`,
          isConditional
        });
      }

      if (field.options && (field.type === 'radio' || field.type === 'select')) {
        const selectedValue = formValues[field.id];
        if (selectedValue) {
          const selectedOption = field.options.find((opt) => opt && opt.value === selectedValue);
          if (selectedOption?.willClauseText) {
            const interpolated = interpolateText(selectedOption.willClauseText, formValues);
            // Option clauses are conditional (only appear if option is selected)
            // BUT: if the clause text has no field references and is complete, it's not truly conditional-incomplete
            const hasFieldRefs = /\{\{field:[^}]+\}\}/.test(selectedOption.willClauseText);
            
            // Debug logging for specific problematic clauses
            if (field.id === 'failedMoneyGiftPassProportionately' || 
                field.id === 'failedSpecificGiftPassProportionately' || 
                field.id === 'failedPropertyGiftPassProportionately' ||
                field.id === 'provisionsForPets' ||
                field.id === 'substitutePetCarer') {
              const fieldIds = extractFieldIds(selectedOption.willClauseText);
              const missingFields = fieldIds.filter((fid) => !hasFieldValue(fid));
              if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] Processing option clause for ${field.id}:`, {
                selectedValue,
                hasFieldRefs,
                template: selectedOption.willClauseText, // Full template, no truncation
                interpolated: interpolated, // Full interpolated text, no truncation
                fieldValue: formValues[field.id],
                fieldIds,
                missingFields
              });
            }
            
            // Only mark as conditional if it has field references (otherwise it's always complete when option is selected)
            addClause({
              section,
              field,
              template: selectedOption.willClauseText,
              text: interpolated,
              id: `${section.formSection}-${field.id}-${selectedOption.value}`,
              isConditional: hasFieldRefs // Only conditional if it references fields
            });
          }
        }
      }

      if (field.type === 'section' && field.subFields) {
        field.subFields.forEach((subField) => {
          if (subField.excludeFromWill) return;
          if (subField.conditions && !evaluateConditions(subField.conditions, subField.conditionLogic)) return;
          if (subField.willClauseText) {
            const interpolated = interpolateText(subField.willClauseText, formValues);
            // SubField clauses inherit the parent field's conditional status
            const isConditional = !!(field.conditions && field.conditions.length > 0);
            
            // Debug logging for pet carer sections
            if (field.id === 'substitutePetCarerSection' || field.id === 'petCarerSection') {
              const fieldIds = extractFieldIds(subField.willClauseText);
              const missingFields = fieldIds.filter((fid) => !hasFieldValue(fid));
              if (DEBUG_CLAUSES) console.log(`[BUILD CLAUSES] Processing section clause for ${field.id}:`, {
                template: subField.willClauseText, // Full template, no truncation
                interpolated: interpolated, // Full interpolated text, no truncation
                isConditional,
                hasConditions: !!(field.conditions && field.conditions.length > 0),
                petCarerData: formValues.petCarerData,
                substitutePetCarerData: formValues.substitutePetCarerData,
                fieldIds,
                missingFields
              });
            }
            
            addClause({
              section,
              field: subField.label ? subField : field,
              template: subField.willClauseText,
              text: interpolated,
              id: `${section.formSection}-${field.id}-${subField.id}`,
              isConditional
            });
          }
        });
      }
    });
  });

  return clauses;
};
