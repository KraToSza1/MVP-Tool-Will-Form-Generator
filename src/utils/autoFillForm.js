/**
 * Auto-fill utility for the Will Form
 * Fills all form fields with dummy data for testing
 * This version is comprehensive and handles ALL field types including arrays, textareas, and special cases
 */

export const generateDummyFormData = (formData) => {
  console.log('[AUTOFILL] ========== GENERATING DUMMY FORM DATA ==========');
  console.log('[AUTOFILL] Form sections count:', formData?.formSections?.length);
  
  const dummyData = {};
  
  if (!formData || !formData.formSections) {
    console.error('[AUTOFILL] Invalid form data structure');
    return dummyData;
  }

  // Helper to get first option value
  const getFirstOption = (field) => {
    if (field.options && field.options.length > 0) {
      return field.options[0].value;
    }
    return null;
  };

  // Helper to get "Yes" option if available
  const getYesOption = (field) => {
    if (field.options) {
      const yesOption = field.options.find(opt => 
        opt.value === 'Yes' || opt.label === 'Yes' || 
        opt.value === 'yes' || opt.label === 'yes' ||
        (typeof opt.label === 'string' && opt.label.toLowerCase().includes('yes'))
      );
      if (yesOption) {
        console.log(`[AUTOFILL]     Found "Yes" option: "${yesOption.value}"`);
        return yesOption.value;
      }
      return getFirstOption(field);
    }
    return null;
  };

  // Generate realistic names for different roles
  const generateName = (role) => {
    const names = {
      guardian: ['Sarah Johnson', 'Michael Brown', 'Emma Williams'],
      executor: ['David Thompson', 'Lisa Anderson', 'Robert Taylor'],
      trustee: ['James Wilson', 'Patricia Martinez', 'Christopher Davis'],
      witness: ['Alice Witness', 'Bob Witness'],
      petCarer: ['Charlie Pet Carer', 'Diana Pet Helper'],
      excluded: ['Excluded Person Name'],
      substitute: ['Substitute Person Name']
    };
    
    for (const [key, values] of Object.entries(names)) {
      if (role.toLowerCase().includes(key)) {
        return values[0];
      }
    }
    return 'John Smith';
  };

  formData.formSections.forEach((section, sectionIndex) => {
    console.log(`[AUTOFILL] ========== PROCESSING SECTION ${sectionIndex + 1}/${formData.formSections.length} ==========`);
    console.log(`[AUTOFILL] Section name: "${section.formSection}"`);
    console.log(`[AUTOFILL] Section fields count:`, section.fields?.length || 0);
    
    if (!section.fields) {
      console.warn(`[AUTOFILL] Section "${section.formSection}" has no fields`);
      return;
    }

    section.fields.forEach((field, fieldIndex) => {
      console.log(`[AUTOFILL]   ──────────────────────────────────────────`);
      console.log(`[AUTOFILL]   Field ${fieldIndex + 1}/${section.fields.length}: "${field.id}"`);
      console.log(`[AUTOFILL]   Field type: ${field.type}`);
      console.log(`[AUTOFILL]   Field label: "${field.label || 'N/A'}"`);
      console.log(`[AUTOFILL]   Field required: ${field.required || false}`);
      
      // Skip display fields and buttons (but log them)
      if (field.type === 'display' || field.type === 'button') {
        console.log(`[AUTOFILL]     ⏭️  Skipping ${field.type} field`);
        return;
      }

      // Skip hidden fields (but we'll handle guardianData, executorData etc specially)
      if (field.type === 'hidden') {
        console.log(`[AUTOFILL]     ⏭️  Skipping hidden field (will be handled by section logic)`);
        return;
      }

      let value = null;

      switch (field.type) {
        case 'radio':
          // Special handling for organ donation preference - select "YesButOnly" to test organ donation clause
          if (field.id === 'organDonationPreference') {
            const yesButOnlyOption = field.options?.find(opt => opt.value === 'YesButOnly');
            if (yesButOnlyOption) {
              value = 'YesButOnly';
              console.log(`[AUTOFILL]     🫀 Organ donation preference - Selected: "YesButOnly" (to test organ donation clause)`);
            } else {
              value = getYesOption(field) || getFirstOption(field);
            }
          } else {
            value = getYesOption(field) || getFirstOption(field);
            console.log(`[AUTOFILL]     ✅ Radio field - Selected: "${value}"`);
          }
          break;

        case 'text':
          if (field.id.includes('Name') || field.id.includes('name')) {
            if (field.id.includes('firstName') || field.id === 'firstName') {
              value = 'John';
            } else if (field.id.includes('lastName') || field.id === 'lastName') {
              value = 'Smith';
            } else if (field.id.includes('partner') || field.id === 'partnerFullName') {
              value = 'Jane Smith';
            } else if (field.id.includes('middle') || field.id === 'middleName') {
              value = 'Michael';
            } else if (field.id.includes('knownAs')) {
              value = 'Johnny';
            } else if (field.id.includes('alias')) {
              value = '';
            } else {
              value = 'Test Name';
            }
          } else if (field.id.includes('email')) {
            value = 'john.smith@example.com';
          } else if (field.id.includes('mobile') || field.id.includes('tel')) {
            value = '07123456789';
          } else if (field.id.includes('address') || field.id.includes('Address')) {
            // Use realistic UK addresses - different addresses for different people
            if (field.id.includes('partner') || field.id.includes('Partner') || field.id.includes('spouse')) {
              // Partner/Spouse address
              if (field.id.includes('address1') || field.id === 'partnerAddress1' || field.id === 'spouseAddress1') {
                value = '456 Park Lane';
              } else if (field.id.includes('address2') || field.id === 'partnerAddress2' || field.id === 'spouseAddress2') {
                value = 'Mayfair';
              } else if (field.id.includes('address3') || field.id === 'partnerAddress3' || field.id === 'spouseAddress3') {
                value = 'London';
              } else {
                value = '456 Park Lane, Mayfair, London, W1K 6HP';
              }
            } else if (field.id.includes('executor') || field.id.includes('Executor')) {
              // Executor address
              if (field.id.includes('address1') || field.id === 'executorAddress1') {
                value = '789 Oxford Street';
              } else if (field.id.includes('address2') || field.id === 'executorAddress2') {
                value = 'Marylebone';
              } else if (field.id.includes('address3') || field.id === 'executorAddress3') {
                value = 'London';
              } else {
                value = '789 Oxford Street, Marylebone, London, W1D 2HX';
              }
            } else if (field.id.includes('witness') || field.id.includes('Witness')) {
              // Witness address
              if (field.id.includes('address1')) {
                value = '321 Baker Street';
              } else if (field.id.includes('address2')) {
                value = 'Marylebone';
              } else if (field.id.includes('address3')) {
                value = 'London';
              } else {
                value = '321 Baker Street, Marylebone, London, NW1 6XE';
              }
            } else {
              // Default/Testator address
              if (field.id.includes('address1') || field.id === 'address1' || field.id === 'testatorAddress1') {
                value = '123 High Street';
              } else if (field.id.includes('address2') || field.id === 'address2' || field.id === 'testatorAddress2') {
                value = 'Westminster';
              } else if (field.id.includes('address3') || field.id === 'address3' || field.id === 'testatorAddress3') {
                value = 'London';
              } else {
                value = '123 High Street, Westminster, London, SW1A 1AA';
              }
            }
            console.log(`[AUTOFILL]     🏠 UK Address field "${field.id}" - Value: "${value}"`);
          } else if (field.id.includes('postcode') || field.id === 'postcode' || field.id.includes('Postcode') || field.id.includes('PostCode')) {
            // Use realistic UK postcodes - different postcodes for different people
            const ukPostcodes = {
              default: 'SW1A 1AA',      // Westminster (famous - 10 Downing Street)
              partner: 'W1K 6HP',       // Mayfair, London
              executor: 'W1D 2HX',      // Marylebone, London
              witness: 'NW1 6XE',       // Marylebone, London (Baker Street area)
              testator: 'SW1A 1AA',     // Westminster
            };
            
            let postcodeKey = 'default';
            if (field.id.includes('partner') || field.id.includes('Partner') || field.id.includes('spouse')) {
              postcodeKey = 'partner';
            } else if (field.id.includes('executor') || field.id.includes('Executor')) {
              postcodeKey = 'executor';
            } else if (field.id.includes('witness') || field.id.includes('Witness')) {
              postcodeKey = 'witness';
            } else if (field.id.includes('testator') || field.id === 'postcode') {
              postcodeKey = 'testator';
            }
            
            value = ukPostcodes[postcodeKey];
            console.log(`[AUTOFILL]     📮 UK Postcode field "${field.id}" - Generated: "${value}" (${postcodeKey})`);
          } else if (field.id.includes('occupation')) {
            value = 'Software Developer';
          } else if (field.id.includes('Schedule') || field.id.includes('schedule') || field.id.includes('ScheduleNumber')) {
            // Generate a realistic schedule number (6-7 digits)
            value = String(Math.floor(Math.random() * 9000000) + 1000000);
            console.log(`[AUTOFILL]     📋 Schedule number field - Generated: "${value}"`);
          } else if (field.id.includes('language') || field.id.includes('Language')) {
            value = 'English';
          } else if (field.id.includes('location') || field.id.includes('Location')) {
            value = 'London, United Kingdom';
          } else if (field.id.includes('amount') || field.id.includes('Amount')) {
            // For amount fields, use a realistic number (as string for text inputs)
            if (field.id.includes('pet') || field.id.includes('Pet') || field.id.includes('petCarer')) {
              value = '5000'; // Pet care amount
            } else if (field.id.includes('iht') || field.id.includes('IHT') || field.id.includes('inheritance') || field.id.includes('tax')) {
              value = '100000'; // Inheritance tax amount
            } else {
              value = '10000'; // Generic amount
            }
          } else if (field.id.includes('charity') || field.id.includes('Charity')) {
            value = 'The British Red Cross (Charity No. 220949); Cancer Research UK (Charity No. 1089464)';
          } else if (field.id.includes('debtor') || field.id.includes('Debtor')) {
            value = 'John Debtor Smith';
          } else if (field.id === 'specificOrgansToDonate' || field.id.includes('specificOrgansToDonate')) {
            value = 'eyes, heart, and brain';
            console.log(`[AUTOFILL]     🫀 Organ donation field - Value: "${value}"`);
          } else if (field.id === 'specificOrgansToExclude' || field.id.includes('specificOrgansToExclude')) {
            value = 'eyes';
            console.log(`[AUTOFILL]     🫀 Organ exclusion field - Value: "${value}"`);
          } else {
            // For any other text field, use a more descriptive value instead of "Dummy [label]"
            const fieldLabel = (field.label || field.id).toLowerCase();
            if (fieldLabel.includes('name')) {
              value = 'John Smith';
            } else if (fieldLabel.includes('description') || fieldLabel.includes('detail')) {
              value = 'Standard details as required for this field.';
            } else if (fieldLabel.includes('note') || fieldLabel.includes('comment')) {
              value = 'Additional notes and comments relevant to this section.';
            } else if (fieldLabel.includes('what is') || fieldLabel.includes('amount')) {
              // Handle "What is the amount?" type fields
              value = '100000';
            } else {
              // Last resort: use a generic but meaningful value (NOT "Dummy [label]")
              value = 'Standard value';
            }
          }
          console.log(`[AUTOFILL]     ✅ Text field - Value: "${value}"`);
          break;

        case 'textarea':
          // Handle all the textarea fields that show "test test test"
          if (field.id.includes('charity') || field.id.includes('Charity') || field.id === 'charityDetails') {
            value = 'The British Red Cross (Charity No. 220949); Cancer Research UK (Charity No. 1089464); The Salvation Army (Charity No. 214779)';
            console.log(`[AUTOFILL]     ✅ Charity details field - Value: "${value.substring(0, 80)}..."`);
          } else if (field.id.includes('monetaryGiftsDetails') || field.id === 'monetaryGiftsDetails') {
            value = 'I give £10,000 to my son John Smith when he reaches the age of 25. I give £5,000 to my daughter Sarah Smith when she reaches the age of 21.';
          } else if (field.id.includes('specificGiftsDetails') || field.id === 'specificGiftsDetails') {
            value = 'I give my vintage watch collection to my son John Smith. I give my art collection to my daughter Sarah Smith.';
          } else if (field.id.includes('propertyGiftsDetails') || field.id === 'propertyGiftsDetails') {
            value = 'I give my property at 123 Main Street, London to my wife Jane Smith. I give my holiday home in Cornwall to my son John Smith.';
          } else if (field.id.includes('propertyTrustDetails') || field.id === 'propertyTrustDetails') {
            value = 'My property at 1 Melk Bos Place, London shall be held in trust for my son until he reaches the age of 25, at which point full ownership shall transfer to him.';
          } else if (field.id.includes('propertyTrustTerms') || field.id === 'propertyTrustTerms') {
            value = 'The trustees shall have full power to manage, maintain, and if necessary sell the property. The income from the property shall be used for the benefit of my son until he reaches the age of 25.';
          } else if (field.id.includes('bprTrustDetails') || field.id === 'bprTrustDetails') {
            value = 'My business interests in ABC Company Ltd shall be held in trust. The trustees shall manage the business and distribute income as appropriate.';
          } else if (field.id.includes('bprTrustTerms') || field.id === 'bprTrustTerms') {
            value = 'The business property relief trust shall operate according to standard terms. Trustees have full discretion to manage the business assets.';
          } else if (field.id.includes('furtherResidualGiftsDetails') || field.id === 'furtherResidualGiftsDetails') {
            value = 'If any of the above gifts fail, I give the failed share equally to my siblings: Mary Smith and Peter Smith.';
          } else if (field.id.includes('residualGiftsDetails') || field.id === 'residualGiftsDetails') {
            value = 'I give 50% of my residuary estate to my wife Jane Smith, 25% to my son John Smith, and 25% to my daughter Sarah Smith.';
          } else if (field.id.includes('specifyLoansGiftsText') || field.id === 'specifyLoansGiftsText') {
            value = 'I loaned £5,000 to my son John Smith in 2020. I gave £2,000 to my daughter Sarah Smith in 2021.';
          } else if (field.id.includes('wishes') || field.id.includes('Wishes')) {
            value = 'I wish for a simple and peaceful ceremony. Please ensure all my loved ones are informed. I prefer a cremation with my ashes scattered at sea.';
          } else if (field.id.includes('requirements') || field.id.includes('Requirements')) {
            value = 'Standard requirements apply. Please follow all legal procedures. Ensure all beneficiaries are notified in a timely manner.';
          } else if (field.id.includes('details') || field.id.includes('Details')) {
            value = 'All relevant details have been provided. Please refer to the main documentation for complete information. This includes all necessary legal requirements and personal preferences.';
          } else if (field.id.includes('description') || field.id.includes('Description')) {
            value = 'The testator is in good health and of sound mind. All necessary medical information has been provided to the solicitors.';
          } else {
            value = `This is comprehensive dummy text for ${field.label || field.id}. It contains sufficient detail to replace any placeholder text like "test test test". Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.`;
          }
          console.log(`[AUTOFILL]     ✅ Textarea field - Value length: ${value.length} chars`);
          console.log(`[AUTOFILL]     ✅ Textarea preview: "${value.substring(0, 80)}..."`);
          break;

        case 'date':
          if (field.id.includes('Birth') || field.id.includes('birth')) {
            value = '1980-01-15';
          } else if (field.id.includes('Execution') || field.id.includes('execution') || field.id.includes('Signing') || field.id.includes('signing')) {
            value = new Date().toISOString().split('T')[0]; // Today's date
          } else {
            value = '2020-01-01';
          }
          console.log(`[AUTOFILL]     ✅ Date field - Value: "${value}"`);
          break;

        case 'number':
          if (field.id.includes('age') || field.id.includes('Age')) {
            value = 35;
          } else if (field.id.includes('pet') && (field.id.includes('amount') || field.id.includes('Amount') || field.id.includes('care'))) {
            value = 5000; // Pet care amount
          } else if (field.id.includes('iht') || field.id.includes('IHT') || field.id.includes('inheritance') || field.id.includes('tax')) {
            value = 100000; // Inheritance tax amount
          } else if (field.id.includes('amount') || field.id.includes('Amount') || field.id.includes('gift') || field.id.includes('Gift')) {
            value = 10000;
          } else if (field.id.includes('percentage') || field.id.includes('Percentage')) {
            value = 50;
          } else {
            value = 1000;
          }
          console.log(`[AUTOFILL]     ✅ Number field - Value: ${value}`);
          break;

        case 'checkbox':
          // For checkbox groups, select all options
          if (field.options) {
            value = field.options.map(opt => opt.value);
          } else {
            value = true;
          }
          console.log(`[AUTOFILL]     ✅ Checkbox field - Value:`, value);
          break;

        case 'checkboxGroup':
          // For checkbox groups (like organPurposeGroup), select all options by ID
          if (field.id === 'organPurposeGroup') {
            // Select both purposes for comprehensive testing
            value = field.options ? field.options.map(opt => opt.id || opt.value).filter(Boolean) : [];
            console.log(`[AUTOFILL]     ✅ Organ purpose checkbox group - Selected:`, value);
          } else if (field.options) {
            // For other checkbox groups, select all options
            value = field.options.map(opt => opt.id || opt.value).filter(Boolean);
            console.log(`[AUTOFILL]     ✅ Checkbox group - Selected:`, value);
          } else {
            value = [];
          }
          break;

        case 'select':
          value = getYesOption(field) || getFirstOption(field);
          console.log(`[AUTOFILL]     ✅ Select field - Selected: "${value}"`);
          break;

        case 'section':
          // For section fields, we need to handle the subFields
          if (field.subFields) {
            console.log(`[AUTOFILL]     📦 Section field with ${field.subFields.length} subFields`);
            field.subFields.forEach(subField => {
              if (subField.type === 'hidden' && subField.id) {
                // Handle data fields like guardianData, executorData, etc.
                if (subField.id.includes('guardianData')) {
                  value = 'Sarah Johnson';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('substituteGuardianData')) {
                  value = 'Michael Brown; Emma Williams';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('executorData')) {
                  value = 'David Thompson';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('substituteExecutorData')) {
                  value = 'Lisa Anderson';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('trusteeData')) {
                  value = 'James Wilson';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('substituteTrusteeData')) {
                  value = 'Patricia Martinez';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('witness1Data')) {
                  value = 'Alice Witness';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('witness2Data')) {
                  value = 'Bob Witness';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('petCarerData')) {
                  value = 'Charlie Pet Carer';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('substitutePetCarerData')) {
                  value = 'Diana Pet Helper';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('excludedPersonData')) {
                  value = 'Excluded Person Name';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('digitalExecutorData')) {
                  value = 'Digital Executor Name';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('separateTrusteeData')) {
                  value = 'Separate Trustee Name';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('chattelRecipientData')) {
                  value = 'Chattel Recipient Name';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                } else if (subField.id.includes('debtorData') || subField.id.includes('debtRelief')) {
                  value = 'John Debtor Smith';
                  dummyData[subField.id] = value;
                  console.log(`[AUTOFILL]       ✅ Set ${subField.id} = "${value}"`);
                }
              }
            });
          }
          // Don't set value for section itself, only for subFields
          value = null;
          break;

        default:
          console.warn(`[AUTOFILL]     ⚠️  Unknown field type: ${field.type}`);
      }

      if (value !== null && value !== undefined && field.id) {
        dummyData[field.id] = value;
        console.log(`[AUTOFILL]     ✅✅✅ SET ${field.id} =`, typeof value === 'string' && value.length > 50 ? `${value.substring(0, 50)}...` : value);
      } else if (field.id && !dummyData[field.id]) {
        console.log(`[AUTOFILL]     ⚠️  Skipped ${field.id} (no value generated)`);
      }
    });
  });

  // Add special handling for fields that might not be in the form structure but are used
  // These are critical fields that often show "test test test" placeholders
  const specialFields = {
    // Person data fields (these show as "test test" in the UI)
    'guardianData': 'Sarah Johnson',
    'substituteGuardianData': 'Michael Brown; Emma Williams',
    'executorData': 'David Thompson',
    'substituteExecutorData': 'Lisa Anderson',
    'trusteeData': 'James Wilson',
    'substituteTrusteeData': 'Patricia Martinez',
    'witness1Data': 'Alice Witness',
    'witness2Data': 'Bob Witness',
    'petCarerData': 'Charlie Pet Carer',
    'substitutePetCarerData': 'Diana Pet Helper',
    'excludedPersonData': 'Excluded Person Name',
    'digitalExecutorData': 'Digital Executor Name',
    'separateTrusteeData': 'Separate Trustee Name',
    'chattelRecipientData': 'Chattel Recipient Name',
    'debtorData': 'John Debtor Smith',
    
    // Textarea fields that show "test test test" (CRITICAL - these are the main offenders)
    'monetaryGiftsDetails': 'I give £10,000 to my son John Smith when he reaches the age of 25. I give £5,000 to my daughter Sarah Smith when she reaches the age of 21.',
    'specificGiftsDetails': 'I give my vintage watch collection to my son John Smith. I give my art collection to my daughter Sarah Smith.',
    'propertyGiftsDetails': 'I give my property at 123 Main Street, London to my wife Jane Smith. I give my holiday home in Cornwall to my son John Smith.',
    'propertyTrustDetails': 'My property at 1 Melk Bos Place, London shall be held in trust for my son until he reaches the age of 25, at which point full ownership shall transfer to him.',
    'propertyTrustTerms': 'The trustees shall have full power to manage, maintain, and if necessary sell the property. The income from the property shall be used for the benefit of my son until he reaches the age of 25.',
    'bprTrustDetails': 'My business interests in ABC Company Ltd shall be held in trust. The trustees shall manage the business and distribute income as appropriate.',
    'bprTrustTerms': 'The business property relief trust shall operate according to standard terms. Trustees have full discretion to manage the business assets.',
    'furtherResidualGiftsDetails': 'If any of the above gifts fail, I give the failed share equally to my siblings: Mary Smith and Peter Smith.',
    'residualGiftsDetails': 'I give 50% of my residuary estate to my wife Jane Smith, 25% to my son John Smith, and 25% to my daughter Sarah Smith.',
    'specifyLoansGiftsText': 'I loaned £5,000 to my son John Smith in 2020. I gave £2,000 to my daughter Sarah Smith in 2021.',
    'charityDetails': 'The British Red Cross (Charity No. 220949); Cancer Research UK (Charity No. 1089464); The Salvation Army (Charity No. 214779)',
    
    // Amount fields (these need proper numbers, not "test" or "Dummy [label]")
    'ihtAmount': '100000',
    'petCarerGift': '5000',
    'amountToLeaveForPetCare': '5000',
    'minimumCharityAmountValue': '100000',
    
    // Schedule numbers (these need to be proper numbers, not "test")
    'propertyTrustScheduleNumber': String(Math.floor(Math.random() * 9000000) + 1000000),
    'bprTrustScheduleNumber': String(Math.floor(Math.random() * 9000000) + 1000000),
    
    // Organ donation fields (to test organ donation clause rendering)
    'organDonationPreference': 'YesButOnly', // Select "Yes, but only..." to test specific organs
    'specificOrgansToDonate': 'eyes, heart, and brain', // Specific organs for testing (shown when YesButOnly)
    'specificOrgansToExclude': 'eyes', // Excluded organs for "YesAllExcept" option (shown when YesAllExcept)
    'organPurposeGroup': ['purposeMedicalResearch', 'purposeTherapeutic'], // Select both purposes for testing
    
    // Ensure Property Trust is enabled and has schedule content (to test schedule validation)
    'includePropertyTrust': 'Yes',
    'includeBPRTrust': 'Yes',
    
    // FLIT (Flexible Life Interest Trust) fields
    'lifeTenantDetails': 'Jane Smith',
    'beneficiariesDetails': 'John Smith; Sarah Smith',
    'trustEndDistributionDetails': 'Upon the death of the life tenant, the trust property shall pass equally to John Smith and Sarah Smith.',
    'flitLifeTenant': 'Jane Smith',
    'flitFinalBeneficiaries': 'John Smith and Sarah Smith',
    
    // UK Address fields (ensure all address components are filled with realistic UK addresses)
    // Testator/Default address
    'address1': '123 High Street',
    'address2': 'Westminster',
    'address3': 'London',
    'postcode': 'SW1A 1AA',
    'testatorAddress1': '123 High Street',
    'testatorAddress2': 'Westminster',
    'testatorAddress3': 'London',
    'testatorPostcode': 'SW1A 1AA',
    
    // Partner/Spouse address
    'partnerAddress1': '456 Park Lane',
    'partnerAddress2': 'Mayfair',
    'partnerAddress3': 'London',
    'partnerPostcode': 'W1K 6HP',
    'spouseAddress1': '456 Park Lane',
    'spouseAddress2': 'Mayfair',
    'spouseAddress3': 'London',
    'spousePostcode': 'W1K 6HP',
    
    // Executor address
    'executorAddress1': '789 Oxford Street',
    'executorAddress2': 'Marylebone',
    'executorAddress3': 'London',
    'executorPostcode': 'W1D 2HX',
    
    // Witness addresses
    'witness1Address1': '321 Baker Street',
    'witness1Address2': 'Marylebone',
    'witness1Address3': 'London',
    'witness1Postcode': 'NW1 6XE',
    'witness2Address1': '654 Regent Street',
    'witness2Address2': 'Soho',
    'witness2Address3': 'London',
    'witness2Postcode': 'W1B 2HQ',
  };

  console.log('[AUTOFILL] ========== ADDING SPECIAL FIELDS ==========');
  Object.entries(specialFields).forEach(([key, val]) => {
    if (!dummyData[key]) {
      dummyData[key] = val;
      console.log(`[AUTOFILL] ✅ Added special field ${key} =`, typeof val === 'string' && val.length > 50 ? `${val.substring(0, 50)}...` : val);
    } else {
      console.log(`[AUTOFILL] ⏭️  Skipped ${key} (already set)`);
    }
  });

  console.log('[AUTOFILL] ========== DUMMY DATA GENERATION COMPLETE ==========');
  console.log('[AUTOFILL] Total fields filled:', Object.keys(dummyData).length);
  console.log('[AUTOFILL] Sample of filled fields:', Object.keys(dummyData).slice(0, 20));
  console.log('[AUTOFILL] Full dummy data object:', dummyData);
  
  return dummyData;
};

/**
 * Auto-fill form with dummy data
 * This function will be called from the browser console or a button
 */
export const autoFillForm = (setFormValues, formData) => {
  console.log('[AUTOFILL] ========== STARTING AUTO-FILL PROCESS ==========');
  console.log('[AUTOFILL] Form data available:', !!formData);
  
  if (!formData) {
    console.error('[AUTOFILL] No form data provided');
    return;
  }

  const dummyData = generateDummyFormData(formData);
  
  console.log('[AUTOFILL] Applying dummy data to form...');
  setFormValues(dummyData);
  
  console.log('[AUTOFILL] ========== AUTO-FILL COMPLETE ==========');
  console.log('[AUTOFILL] Form should now be filled with dummy data');
  
  return dummyData;
};
