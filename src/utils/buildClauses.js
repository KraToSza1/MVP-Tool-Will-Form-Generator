// Shared clause builder for Preview and PDF
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
      separateBusinessTrusteeSection: 'separateTrusteeData'
    };
    
    // Check fallback map first
    const fallbackId = fallbackMap[fieldId] || `${fieldId}Data`;
    if (hasValue(formValues[fallbackId])) {
      // Debug logging for pet carer fields
      if (fieldId === 'petCarerSection' || fieldId === 'substitutePetCarerSection') {
        console.log(`[BUILD CLAUSES] hasFieldValue found ${fieldId} via fallback:`, {
          fieldId,
          fallbackId,
          value: formValues[fallbackId]
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
    
    // Debug logging if not found
    if (!found && (fieldId === 'petCarerSection' || fieldId === 'substitutePetCarerSection')) {
      console.log(`[BUILD CLAUSES] hasFieldValue NOT found for ${fieldId}:`, {
        fieldId,
        fallbackId,
        fallbackValue: formValues[fallbackId],
        candidates: candidates.map(c => ({ key: c, value: formValues[c] }))
      });
    }
    
    return found;
  };

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
    if (!trimmed && missingFields.length === 0) return;
    const hasMissingSubject =
      /\bmy\s+\.\b/i.test(text) ||
      /\bfor\s+\.\b/i.test(text) ||
      /\bupon\s+trust\s+for\s+\.\b/i.test(text) ||
      /\bI appoint\s+to serve/i.test(text) ||
      /\bI appoint\s+as\s+Trustees/i.test(text);
    
    // CRITICAL: If clause has no field references, it cannot be incomplete (it's a complete sentence)
    const hasNoFieldRefs = fieldIds.length === 0;
    const incomplete = hasNoFieldRefs ? false : (missingFields.length > 0 || hasMissingSubject || trimmed === '');
    
    // ALWAYS-ON Debug logging for problematic clauses (15, 17, 19, 28, 29)
    if (id.includes('failedMoneyGiftPassProportionately') || 
        id.includes('failedSpecificGiftPassProportionately') || 
        id.includes('failedPropertyGiftPassProportionately') ||
        id.includes('provisionsForPets') ||
        id.includes('substitutePetCarer') ||
        id.includes('petCarerSection')) {
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
        hasMissingSubject,
        hasMissingSubjectMatch: hasMissingSubject ? text.match(/\bmy\s+\.\b|\bfor\s+\.\b|\bupon\s+trust\s+for\s+\.\b|\bI appoint\s+to serve|\bI appoint\s+as\s+Trustees/i) : null,
        incomplete,
        incompleteReason: incomplete ? (
          hasNoFieldRefs ? 'SHOULD NOT BE INCOMPLETE (hasNoFieldRefs=true)' :
          missingFields.length > 0 ? `MISSING FIELDS: ${missingFields.join(', ')}` :
          hasMissingSubject ? 'HAS MISSING SUBJECT (regex match)' :
          trimmed === '' ? 'TRIMMED TEXT IS EMPTY' :
          'UNKNOWN REASON'
        ) : 'COMPLETE',
        isConditional,
        willBeSkipped: isConditional && incomplete
      });
    }
    
    // If clause is conditional (has conditions) AND incomplete, skip it entirely
    // This prevents incomplete conditional clauses from appearing in the PDF
    if (isConditional && incomplete) {
      return;
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
      incomplete
    });
  };

  sections.forEach((section) => {
    if (!section || !section.fields) return;
    section.fields.forEach((field) => {
      if (!field) return;
      if (field.conditions && !evaluateConditions(field.conditions, field.conditionLogic)) return;
      if (['button', 'hidden', 'display'].includes(field.type)) return;

      if (field.willClauseText) {
        const interpolated = interpolateText(field.willClauseText, formValues);
        // Check if this field has conditions (making it conditional)
        const isConditional = !!(field.conditions && field.conditions.length > 0);
        
        // Debug logging for pet carer sections
        if (field.id === 'petCarerSection' || field.id === 'substitutePetCarerSection') {
          const fieldIds = extractFieldIds(field.willClauseText);
          const missingFields = fieldIds.filter((fid) => !hasFieldValue(fid));
          console.log(`[BUILD CLAUSES] Processing section field clause for ${field.id}:`, {
            template: field.willClauseText, // Full template, no truncation
            interpolated: interpolated, // Full interpolated text, no truncation
            fieldIds,
            missingFields,
            isConditional,
            petCarerData: formValues.petCarerData,
            substitutePetCarerData: formValues.substitutePetCarerData,
            provisionsForPets: formValues.provisionsForPets
          });
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
              console.log(`[BUILD CLAUSES] Processing option clause for ${field.id}:`, {
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
          if (subField.conditions && !evaluateConditions(subField.conditions, subField.conditionLogic)) return;
          if (subField.willClauseText) {
            const interpolated = interpolateText(subField.willClauseText, formValues);
            // SubField clauses inherit the parent field's conditional status
            const isConditional = !!(field.conditions && field.conditions.length > 0);
            
            // Debug logging for pet carer sections
            if (field.id === 'substitutePetCarerSection' || field.id === 'petCarerSection') {
              const fieldIds = extractFieldIds(subField.willClauseText);
              const missingFields = fieldIds.filter((fid) => !hasFieldValue(fid));
              console.log(`[BUILD CLAUSES] Processing section clause for ${field.id}:`, {
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
