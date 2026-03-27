/**
 * Auto-fill utility for the Will Form
 * Fills ALL form fields with dummy data for testing - literally everything possible
 * Handles ALL field types, section subFields, conditional fields, and array data
 */

const ARISTONE_EXECUTOR_LINE =
  'Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG';

export const generateDummyFormData = (formData) => {
  console.log('[AUTOFILL GENERATE] ========== GENERATING DUMMY DATA ==========');
  const dummyData = {};

  if (!formData || !formData.formSections) {
    console.error('[AUTOFILL GENERATE] ❌ Invalid form data structure:', {
      hasFormData: !!formData,
      hasFormSections: !!(formData && formData.formSections)
    });
    return dummyData;
  }
  
  console.log('[AUTOFILL GENERATE] 📊 Form structure:', {
    sectionsCount: formData.formSections.length,
    firstSection: formData.formSections[0]?.formSection || 'N/A'
  });

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
      const yesOpt = field.options.find(opt =>
        opt.value === 'Yes' || opt.label === 'Yes' ||
        (typeof opt.label === 'string' && opt.label.toLowerCase().includes('yes'))
      );
      return yesOpt ? yesOpt.value : getFirstOption(field);
    }
    return null;
  };

  // Options that UNLOCK and FILL everything - select values that show the most sections
  // Mariyam / Aristone workflow: Aristone as executor → same as trustees (no separate trustee pick); estate intake test data when Aristone executor.
  const unlockEverything = {
    title: 'Mr',
    maritalStatus: 'Married',
    contemplation: 'No',
    assetsAbroad: 'Yes',
    propertyInEU: 'Yes',
    englishLawGovernsEUAssets: 'Yes',
    testatorUKNationalOrHabitual: 'UK National',
    foreignWillNotRevoked: 'No',
    willAppliesToUK: 'Yes - England and Wales',
    appointGuardians: 'Yes',
    chooseAristoneExecutor: 'Aristone',
    chooseAristoneSubstituteExecutor: 'Aristone',
    appointProfessionalExecutor: 'Yes',
    professionalExecutorSelection: 'Aristone',
    substituteProfessionalExecutorSelection: 'Aristone',
    includeProfessionalRemuneration: 'Yes',
    appointDigitalAssetsExecutor: 'Yes',
    appointSeparateDigitalExecutor: 'Yes',
    appointDifferentTrustees: 'No',
    includeBPRTrust: 'Yes',
    leaveMoneyGifts: 'Yes',
    leaveSpecificGifts: 'Yes',
    leavePropertyGifts: 'Yes',
    includePropertyTrust: 'Yes',
    unspecifiedChattelsAction: 'SpecificRecipient',
    chattelsInheritanceTax: 'PaidByEstate',
    produceMemorandum: 'Yes',
    personalChattelsGift: 'Beneficiary',
    forgiveDebt: 'Yes',
    deliberatelyExcludingAnyone: 'Yes',
    provisionsForPets: 'Yes',
    substitutePetCarer: 'Yes',
    petsCaredForByRSPCA: 'No',
    petCarerOptions: 'Yes',
    relieveDebts: 'Yes',
    includeReceiptByMinors: 'Yes',
    includeCypresClause: 'Yes',
    bringLifetimeGiftsIntoAccount: 'Yes',
    specifyLifetimeLoansGifts: 'Yes',
    howResidueDistributed: 'IntoFLIT', // Changed from 'AsShares' to unlock FLIT fields
    specifyFurtherResidualGiftsOnFail: 'Yes',
    failedResiduePassProportionately: 'Yes',
    give10PercentToCharity: 'Yes',
    charityGiftOnlyIfIHTDue: 'No',
    splitCharitableGift: 'No',
    minimumCharityAmount: 'Yes',
    howIHTDealtWithSplitting: 'BeforeTax',
    capacityConcerns: 'No',
    hasTestamentaryCapacity: 'Yes',
    satisfiedUnderstandsInstructions: 'Yes',
    satisfiedAwareOfClaims: 'Yes',
    otherPeoplePresent: 'No',
    satisfiedNotUndulyInfluenced: 'Yes',
    hasDisabilityImpactingSignRead: 'No',
    includeWitnessDetails: 'Yes',
    organDonationPreference: 'YesButOnly',
    specifyFuneralArrangements: 'Yes',
    burialOrCremation: 'Cremated',
    hasBusinessInterests: 'Yes',
    trusteePowerCarryOnBusiness: 'Yes',
    appointSeparateBusinessTrustee: 'Yes',
    failedMoneyGiftPassProportionately: 'Yes',
    failedSpecificGiftPassProportionately: 'Yes',
    failedPropertyGiftPassProportionately: 'Yes',
    spouseBenefitOnDivorce: 'No',
    stopGiftToChildrenOnFail: 'Yes',
    stepProvisionsApply: 'AllStandardSpecialInclude',
    excludeSpecificStepProvisions: 'No',
    powerToRevokeLifeInterest: 'Yes',
    appointSeparateTrusteesFLIT: 'Yes', // Changed from 'No' to unlock separate trustees FLIT section
    executorAgeClause: '25',
    estateGrossValueRange: 'Range500_1m',
    estateLiabilityValueRange: 'Range100_250',
    estatePropertyValueRange: 'Range500_1m',
  };

  // Get value for a field - used in recursive processing
  const getFieldValue = (field, dummyDataSoFar) => {
    const values = { ...dummyDataSoFar };
    const getVal = (k) => values[k];

    if (unlockEverything[field.id] !== undefined) {
      return unlockEverything[field.id];
    }

    switch (field.type) {
      case 'radio':
      case 'select':
        if (field.id === 'organDonationPreference') return 'YesButOnly';
        return getYesOption(field) || getFirstOption(field);

      case 'text':
        if (field.id.includes('Name') || field.id.includes('name')) {
          if (field.id.includes('firstName') || field.id === 'firstName') return 'James';
          if (field.id.includes('lastName') || field.id === 'lastName') return 'Mitchell';
          if (field.id.includes('partner') || field.id === 'partnerFullName') return 'Sarah Mitchell';
          if (field.id.includes('middle') || field.id === 'middleName') return 'Robert';
          if (field.id.includes('knownAs')) return 'Jim';
          if (field.id === 'chattelsGiftBeneficiaryName') return 'Emily Watson';
          if (field.id === 'foreignWillLocation') return 'Spain';
          if (field.id === 'nativeLanguage') return 'English';
          return 'James Mitchell';
        }
        if (field.id.includes('email')) return 'james.mitchell@email.co.uk';
        if (field.id.includes('mobile') || field.id.includes('tel')) return '07700 900123';
        if (field.id.includes('address1') || field.id === 'address1') return field.id?.includes('partner') ? '42 Oakwood Drive' : '15 Victoria Road';
        if (field.id.includes('address2') || field.id === 'address2') return field.id?.includes('partner') ? 'Chelsea' : 'Kensington';
        if (field.id.includes('address3') || field.id === 'address3') return 'London';
        if (field.id.includes('postcode') || field.id === 'postcode') return field.id?.includes('partner') ? 'SW3 2AB' : 'W8 5RT';
        if (field.id.includes('occupation')) return 'Accountant';
        if (field.id.includes('Schedule') || field.id.includes('schedule')) return String(Math.floor(Math.random() * 9000000) + 1000000);
        if (field.id.includes('amount') || field.id.includes('Amount')) return field.id?.includes('pet') ? '5000' : '100000';
        if (field.id === 'specificOrgansToDonate') return 'kidneys, liver, and corneas';
        if (field.id === 'specificOrgansToExclude') return 'heart';
        if (field.id === 'estateAssetOther') return 'Overseas rental (approx.)';
        if (field.id === 'minimumCharityAmountValue') return '50000';
        if (field.id === 'stepProvisionToExcludeOne') return '1';
        if (field.id === 'stepProvisionsToExcludeMultiple') return '1, 2 & 3';
        return 'Standard value';

      case 'textarea':
        if (field.id.includes('charity') || field.id === 'charityBenefitDetails') return 'Cancer Research UK (Charity No. 1089464); British Heart Foundation (Charity No. 225971); Macmillan Cancer Support (Charity No. 261017)';
        if (field.id.includes('monetaryGiftsDetails')) return 'I give £25,000 to my son Thomas Mitchell when he reaches the age of 25. I give £15,000 to my daughter Charlotte Mitchell when she reaches the age of 21.';
        if (field.id.includes('specificGiftsDetails')) return 'I give my grandfather\'s gold pocket watch to my son Thomas Mitchell. I give my collection of oil paintings to my daughter Charlotte Mitchell.';
        if (field.id.includes('propertyGiftsDetails')) return 'I give my property at 15 Victoria Road, Kensington, London W8 5RT to my wife Sarah Mitchell absolutely.';
        if (field.id.includes('propertyTrustDetails')) return 'my property at 15 Victoria Road, Kensington, London W8 5RT';
        if (field.id.includes('propertyTrustTerms')) return 'The trustees shall have full power to manage, maintain, repair, improve, and if necessary sell the property. All rental income shall be paid to the life tenant during their lifetime.';
        if (field.id.includes('bprTrustDetails')) return 'My business interests in Mitchell & Associates Ltd (Company No. 12345678) shall be held in trust.';
        if (field.id.includes('bprTrustTerms')) return 'The business property relief trust shall operate according to standard terms. The trustees shall have full power to manage the business or sell the business interests as they see fit.';
        if (field.id.includes('furtherResidualGiftsDetails')) return 'If any of the above gifts fail, I give the failed share equally to my siblings David Mitchell and Helen Mitchell.';
        if (field.id.includes('residualGiftsDetails')) return 'I give 50% of my residuary estate to my wife Sarah Mitchell absolutely, 25% to my son Thomas Mitchell absolutely, and 25% to my daughter Charlotte Mitchell absolutely.';
        if (field.id.includes('specifyLoansGiftsText')) return 'I loaned £10,000 to my son Thomas Mitchell in January 2022 to assist with his house purchase.';
        if (field.id.includes('lifeTenantDetails')) return 'My wife Sarah Mitchell';
        if (field.id.includes('beneficiariesDetails')) return 'Thomas Mitchell and Charlotte Mitchell';
        if (field.id.includes('trustEndDistributionDetails')) return 'Upon the death of the life tenant, the trust property shall pass equally to Thomas Mitchell and Charlotte Mitchell absolutely.';
        if (field.id.includes('funeralWishes')) return 'I wish for a simple cremation service. Please ensure all family members and close friends are informed in advance.';
        if (field.id.includes('otherFuneralRequirements')) return 'My ashes are to be scattered in the garden of remembrance at Golders Green Crematorium.';
        if (field.id.includes('physicalHealthDescription')) return 'The testator is in good physical and mental health and fully understands the nature and effect of this Will.';
        if (field.id === 'estateAdditionalNotes') return 'Autofill test: approximate figures for solicitor review only; not for the Will text.';
        return `Please provide details for ${field.label || field.id}.`;

      case 'date':
        if (field.id.includes('Birth') || field.id.includes('birth')) return '1975-03-22';
        if (field.id.includes('Execution') || field.id.includes('execution') || field.id.includes('Signing') || field.id.includes('signing') || field.id === 'willExecutionDate') return new Date().toISOString().split('T')[0];
        return '2020-01-01';

      case 'number':
      case 'currency':
        if (field.id.includes('age')) return 49;
        if (field.id.includes('pet') && (field.id.includes('amount') || field.id.includes('Gift') || field.id.includes('gift'))) return 5000;
        if (field.id.includes('executorSpecifyAge')) return 25;
        if (field.id.includes('amount') || field.id.includes('Amount')) return field.id?.includes('pet') ? 5000 : 25000;
        return 25000;

      case 'checkboxGroup':
        if (field.id === 'organPurposeGroup') {
          return field.options ? field.options.map((o) => o.id || o.value).filter(Boolean) : [];
        }
        if (field.id === 'aristoneProfessionalFeesAck') return ['ack'];
        if (field.id === 'estateAssetTypes') {
          return ['PropertyUK', 'PropertyOverseas', 'Cash', 'Savings', 'Investments', 'Pensions', 'Business'];
        }
        if (field.id === 'estateLiabilityTypes') {
          return ['Mortgage', 'CreditCards', 'Tax'];
        }
        return field.options ? field.options.map((o) => o.id || o.value).filter(Boolean) : [];

      default:
        return null;
    }
  };

  // Process fields recursively (including section subFields)
  const processFields = (fields, sectionName = '') => {
    if (!fields || !Array.isArray(fields)) {
      console.warn('[AUTOFILL GENERATE] ⚠️ processFields: Invalid fields array', { sectionName });
      return;
    }
    
    let processedCount = 0;
    let skippedCount = 0;
    
    fields.forEach((field) => {
      if (!field || !field.id) {
        skippedCount++;
        return;
      }
      if (field.type === 'display' || field.type === 'button') {
        skippedCount++;
        return;
      }
      if (field.type === 'hidden') {
        skippedCount++;
        return;
      }

      let value = null;

      if (field.type === 'section' && field.subFields) {
        console.log(`[AUTOFILL GENERATE] 📦 Processing section field: ${field.id} (${field.label || 'no label'}) with ${field.subFields.length} subFields`);
        processFields(field.subFields, field.label);
        field.subFields.forEach((sub) => {
          if (sub.type === 'hidden' && sub.id) {
            if (sub.id === 'guardianData') {
              dummyData[sub.id] = ['Sarah Johnson', 'Michael Brown'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 2 items`);
            }
            else if (sub.id === 'substituteGuardianData') {
              dummyData[sub.id] = ['Emma Williams'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'digitalExecutorData') {
              dummyData[sub.id] = ['Sarah Wilson'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'substituteExecutorData') {
              dummyData[sub.id] =
                dummyData.chooseAristoneSubstituteExecutor === 'Aristone' ? [ARISTONE_EXECUTOR_LINE] : ['Robert Taylor'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array (substitute executor)`);
            }
            else if (sub.id === 'executorData') {
              dummyData[sub.id] =
                dummyData.chooseAristoneExecutor === 'Aristone' ? [ARISTONE_EXECUTOR_LINE] : ['David Thompson', 'Lisa Anderson'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array (executor)`);
            }
            else if (sub.id.includes('trusteeData')) {
              dummyData[sub.id] = ['James Wilson'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('substituteTrusteeData')) {
              dummyData[sub.id] = ['Patricia Martinez'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('witness1Data')) {
              dummyData[sub.id] = ['Alice Witness'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('witness2Data')) {
              dummyData[sub.id] = ['Bob Witness'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('petCarerData')) {
              dummyData[sub.id] = [{
                title: 'Mr', firstName: 'Robert', lastName: 'Anderson', relationship: 'Friend',
                address1: '28 Elm Grove', address2: 'Richmond', address3: 'Surrey', city: 'Richmond', postcode: 'TW10 5HJ',
                mobile: '07700 900456', email: 'robert.anderson@email.co.uk', dateOfBirth: '1982-06-20', gender: 'Male'
              }];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 object (pet carer)`);
            }
            else if (sub.id.includes('substitutePetCarerData')) {
              dummyData[sub.id] = [{
                title: 'Mrs', firstName: 'Jennifer', lastName: 'Mitchell', relationship: 'Sister',
                address1: '52 High Street', address2: 'Windsor', address3: 'Berkshire', city: 'Windsor', postcode: 'SL4 1LD',
                mobile: '07700 900789', email: 'jennifer.mitchell@email.co.uk', dateOfBirth: '1985-09-12', gender: 'Female'
              }];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 object (substitute pet carer)`);
            }
            else if (sub.id.includes('excludedPersonData')) {
              dummyData[sub.id] = ['Robert Brown'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('separateTrusteeData')) {
              dummyData[sub.id] = [{
                title: 'Mr', firstName: 'Michael', lastName: 'Thompson', relationship: 'Friend',
                address1: '67 Church Road', address2: 'Hampstead', address3: 'London', city: 'London', postcode: 'NW3 6BJ',
                mobile: '07700 900234', email: 'michael.thompson@email.co.uk', dateOfBirth: '1978-04-15', gender: 'Male'
              }, {
                title: 'Mrs', firstName: 'Emma', lastName: 'Wilson', relationship: 'Sister',
                address1: '93 Park Avenue', address2: 'St John\'s Wood', address3: 'London', city: 'London', postcode: 'NW8 7HY',
                mobile: '07700 900567', email: 'emma.wilson@email.co.uk', dateOfBirth: '1981-11-08', gender: 'Female'
              }];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 2 objects (separate trustees)`);
            }
            else if (sub.id.includes('chattelRecipientData')) {
              dummyData[sub.id] = ['Emma Wilson'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('debtorData')) {
              dummyData[sub.id] = ['James Smith'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('signingOnBehalfData')) {
              dummyData[sub.id] = ['Margaret Harris'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id.includes('interpreterData')) {
              dummyData[sub.id] = ['Thomas Clark'];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
          } else if (sub.type === 'text' || sub.type === 'textarea' || sub.type === 'number' || sub.type === 'date') {
            value = getFieldValue(sub, dummyData);
            if (value != null) {
              dummyData[sub.id] = value;
              processedCount++;
            }
          } else if (sub.type === 'radio' || sub.type === 'select') {
            value = unlockEverything[sub.id] ?? getYesOption(sub) ?? getFirstOption(sub);
            if (value != null) {
              dummyData[sub.id] = value;
              processedCount++;
            }
          } else if (sub.type === 'checkboxGroup') {
            value = getFieldValue(sub, dummyData);
            if (value != null) {
              dummyData[sub.id] = value;
              processedCount++;
            }
          }
        });
        return;
      }

      value = getFieldValue(field, dummyData);
      if (value !== null && value !== undefined) {
        dummyData[field.id] = value;
        processedCount++;
      }
    });
    
    if (sectionName) {
      console.log(`[AUTOFILL GENERATE] 📊 Section "${sectionName}": Processed ${processedCount} fields, skipped ${skippedCount}`);
    }
  };

  // Main: process all sections
  console.log('[AUTOFILL GENERATE] 🔄 Processing all form sections...');
  formData.formSections.forEach((section, index) => {
    console.log(`[AUTOFILL GENERATE] 📋 Processing section ${index + 1}/${formData.formSections.length}: "${section.formSection}"`);
    if (section.fields) {
      processFields(section.fields, section.formSection);
    } else {
      console.warn(`[AUTOFILL GENERATE] ⚠️ Section "${section.formSection}" has no fields`);
    }
  });
  console.log('[AUTOFILL GENERATE] ✅ Finished processing all sections');

  // COMPREHENSIVE special fields - fill EVERYTHING that might be missed
  const specialFields = {
    // Person/array data - must be ARRAYS for fullDetails interpolation (use REAL names, not placeholders)
    guardianData: ['David Mitchell', 'Helen Mitchell'],
    substituteGuardianData: ['Peter Mitchell'],
    executorData: [ARISTONE_EXECUTOR_LINE],
    substituteExecutorData: [ARISTONE_EXECUTOR_LINE],
    trusteeData: ['Jennifer Mitchell'],
    substituteTrusteeData: ['Thomas Mitchell'],
    witness1Data: ['Andrew Parker'],
    witness2Data: ['Susan Parker'],
    excludedPersonData: ['Richard Mitchell'],
    digitalExecutorData: ['Charlotte Mitchell'],
    separateTrusteeData: [{
      title: 'Mr', 
      firstName: 'Michael', 
      lastName: 'Thompson', 
      relationship: 'Friend',
      relationshipToTestator: 'Friend',
      address1: '67 Church Road', 
      address2: 'Hampstead', 
      address3: 'London', 
      city: 'London',
      postcode: 'NW3 6BJ',
      mobile: '07700 900234', 
      email: 'michael.thompson@email.co.uk', 
      dateOfBirth: '1978-04-15', 
      gender: 'Male'
    }, {
      title: 'Mrs', 
      firstName: 'Emma', 
      lastName: 'Wilson', 
      relationship: 'Sister',
      relationshipToTestator: 'Sister',
      address1: '93 Park Avenue', 
      address2: 'St John\'s Wood', 
      address3: 'London', 
      city: 'London',
      postcode: 'NW8 7HY',
      mobile: '07700 900567', 
      email: 'emma.wilson@email.co.uk', 
      dateOfBirth: '1981-11-08', 
      gender: 'Female'
    }],
    chattelRecipientData: ['Emily Watson'],
    debtorData: ['Daniel Mitchell'],
    signingOnBehalfData: ['Margaret Thompson'],
    interpreterData: ['Thomas Wilson'],

    petCarerData: [{
      title: 'Mr', firstName: 'Robert', lastName: 'Anderson', relationship: 'Friend',
      address1: '28 Elm Grove', address2: 'Richmond', address3: 'Surrey', city: 'Richmond', postcode: 'TW10 5HJ',
      mobile: '07700 900456', email: 'robert.anderson@email.co.uk', dateOfBirth: '1982-06-20', gender: 'Male'
    }],
    substitutePetCarerData: [{
      title: 'Mrs', firstName: 'Jennifer', lastName: 'Mitchell', relationship: 'Sister',
      address1: '52 High Street', address2: 'Windsor', address3: 'Berkshire', city: 'Windsor', postcode: 'SL4 1LD',
      mobile: '07700 900789', email: 'jennifer.mitchell@email.co.uk', dateOfBirth: '1985-09-12', gender: 'Female'
    }],

    chattelsGiftBeneficiaryName: 'Emily Watson',

    address1: '15 Victoria Road',
    address2: 'Kensington',
    address3: 'London',
    postcode: 'W8 5RT',
    partnerAddress1: '42 Oakwood Drive',
    partnerAddress2: 'Chelsea',
    partnerAddress3: 'London',
    partnerPostcode: 'SW3 2AB',
    executorAddress1: '67 Church Road',
    executorAddress2: 'Hampstead',
    executorAddress3: 'London',
    executorPostcode: 'NW3 6BJ',
    witness1Address1: '12 Garden Close',
    witness1Address2: 'Fulham',
    witness1Address3: 'London',
    witness1Postcode: 'SW6 3XY',
    witness1Phone: '020 7736 1234',
    witness1Occupation: 'Solicitor',
    witness2Address1: '8 Manor Way',
    witness2Address2: 'Putney',
    witness2Address3: 'London',
    witness2Postcode: 'SW15 2AB',
    witness2Phone: '020 8789 5678',
    witness2Occupation: 'Teacher',

    monetaryGiftsDetails: 'I give £25,000 to my son Thomas Mitchell when he reaches the age of 25. I give £15,000 to my daughter Charlotte Mitchell when she reaches the age of 21.',
    specificGiftsDetails: 'I give my grandfather\'s gold pocket watch to my son Thomas Mitchell. I give my collection of oil paintings to my daughter Charlotte Mitchell.',
    propertyGiftsDetails: 'I give my property at 15 Victoria Road, Kensington, London W8 5RT to my wife Sarah Mitchell absolutely.',
    propertyTrustDetails: 'my property at 15 Victoria Road, Kensington, London W8 5RT',
    propertyTrustTerms: 'The trustees shall have full power to manage, maintain, repair, improve, and if necessary sell the property. All rental income shall be paid to the life tenant during their lifetime.',
    bprTrustDetails: 'My business interests in Mitchell & Associates Ltd (Company No. 12345678) shall be held in trust.',
    bprTrustTerms: 'The business property relief trust shall operate according to standard terms. The trustees shall have full power to manage the business or sell the business interests as they see fit.',
    furtherResidualGiftsDetails: 'If any of the above gifts fail, I give the failed share equally to my siblings David Mitchell and Helen Mitchell.',
    residualGiftsDetails: 'I give 50% of my residuary estate to my wife Sarah Mitchell absolutely, 25% to my son Thomas Mitchell absolutely, and 25% to my daughter Charlotte Mitchell absolutely.',
    specifyLoansGiftsText: 'I loaned £10,000 to my son Thomas Mitchell in January 2022 to assist with his house purchase.',
    charityBenefitDetails: 'Cancer Research UK (Charity No. 1089464); British Heart Foundation (Charity No. 225971); Macmillan Cancer Support (Charity No. 261017)',
    lifeTenantDetails: 'My wife Sarah Mitchell',
    beneficiariesDetails: 'Thomas Mitchell and Charlotte Mitchell',
    trustEndDistributionDetails: 'Upon the death of the life tenant, the trust property shall pass equally to Thomas Mitchell and Charlotte Mitchell absolutely.',
    funeralWishes: 'I wish for a simple cremation service. Please ensure all family members and close friends are informed in advance.',
    otherFuneralRequirements: 'My ashes are to be scattered in the garden of remembrance at Golders Green Crematorium.',
    physicalHealthDescription: 'The testator is in good physical and mental health and fully understands the nature and effect of this Will.',

    propertyTrustScheduleNumber: String(Math.floor(Math.random() * 9000000) + 1000000),
    bprTrustScheduleNumber: String(Math.floor(Math.random() * 9000000) + 1000000),

    organDonationPreference: 'YesButOnly',
    specificOrgansToDonate: 'kidneys, liver, and corneas',
    specificOrgansToExclude: 'heart',
    organPurposeGroup: ['purposeMedicalResearch', 'purposeTherapeutic'],

    petCarerGift: '5000',
    amountToLeaveForPetCare: '5000',
    minimumCharityAmountValue: '100000',
    willExecutionDate: new Date().toISOString().split('T')[0],
    nativeLanguage: 'English',
    foreignWillLocation: 'France',
    stepProvisionToExcludeOne: '1',
    stepProvisionsToExcludeMultiple: '1, 2 & 3',
    executorSpecifyAge: 25,
    aristoneProfessionalFeesAck: ['ack'],
    estateAssetTypes: ['PropertyUK', 'PropertyOverseas', 'Cash', 'Savings', 'Investments', 'Pensions', 'Business'],
    estateLiabilityTypes: ['Mortgage', 'CreditCards', 'Tax'],
    estateGrossValueRange: 'Range500_1m',
    estateLiabilityValueRange: 'Range100_250',
    estatePropertyValueRange: 'Range500_1m',
    estateAdditionalNotes: 'Autofill test: approximate figures for solicitor review only; not for the Will text.',
  };

  console.log('[AUTOFILL GENERATE] 🔄 Applying special fields...');
  let specialFieldsApplied = 0;
  Object.entries(specialFields).forEach(([key, val]) => {
    if (dummyData[key] === undefined || dummyData[key] === null || dummyData[key] === '') {
      dummyData[key] = val;
      specialFieldsApplied++;
      if (key.includes('separateTrustee') || key.includes('petCarer') || key.includes('executor') || key.includes('trustee')) {
        console.log(`[AUTOFILL GENERATE] ✅ Applied special field: ${key}`, Array.isArray(val) ? `(array with ${val.length} items)` : `(value: ${val})`);
      }
    }
  });
  console.log(`[AUTOFILL GENERATE] ✅ Applied ${specialFieldsApplied} special fields`);

  // Apply unlockEverything for any radio/select not yet set
  console.log('[AUTOFILL GENERATE] 🔄 Applying unlockEverything values...');
  let unlockFieldsApplied = 0;
  Object.entries(unlockEverything).forEach(([key, val]) => {
    if (dummyData[key] === undefined || dummyData[key] === null) {
      dummyData[key] = val;
      unlockFieldsApplied++;
      if (key.includes('FLIT') || key.includes('Residue') || key.includes('Trustee')) {
        console.log(`[AUTOFILL GENERATE] ✅ Applied unlock field: ${key} = ${val}`);
      }
    }
  });
  console.log(`[AUTOFILL GENERATE] ✅ Applied ${unlockFieldsApplied} unlock fields`);

  // FINAL PASS: Collect every fillable field ID from the entire form and fill any we missed
  const collectAllFieldIds = (fields, ids = new Set()) => {
    if (!fields || !Array.isArray(fields)) return ids;
    fields.forEach((f) => {
      if (!f?.id) return;
      if (['display', 'button', 'hidden', 'signature'].includes(f.type)) return;
      ids.add(f.id);
      if (f.type === 'section' && f.subFields) collectAllFieldIds(f.subFields, ids);
    });
    return ids;
  };
  const allIds = new Set();
  formData.formSections?.forEach((s) => collectAllFieldIds(s.fields, allIds));
  const missingIds = [...allIds].filter((id) => dummyData[id] === undefined || dummyData[id] === null || dummyData[id] === '');
  console.log(`[AUTOFILL GENERATE] 🔍 Found ${missingIds.length} missing field IDs, filling with defaults...`);
  missingIds.forEach((id) => {
    const defaultVal = id.includes('Name') ? 'James Mitchell'
      : id.includes('email') ? 'james.mitchell@email.co.uk'
      : id.includes('mobile') || id.includes('tel') ? '07700 900123'
      : id.includes('address') ? '15 Victoria Road'
      : id.includes('postcode') ? 'W8 5RT'
      : id.includes('date') || id.includes('Date') ? new Date().toISOString().split('T')[0]
      : id.includes('amount') || id.includes('Amount') ? '25000'
      : id.includes('Details') || id.includes('details') ? 'Please provide details as required for this field.'
      : 'Standard value';
    dummyData[id] = defaultVal;
  });
  console.log(`[AUTOFILL GENERATE] ✅ Filled ${missingIds.length} missing fields with defaults`);

  console.log('[AUTOFILL GENERATE] 📊 Final summary:', {
    totalFields: Object.keys(dummyData).length,
    hasSeparateTrusteeData: !!dummyData.separateTrusteeData,
    separateTrusteeDataType: Array.isArray(dummyData.separateTrusteeData) ? 'array' : typeof dummyData.separateTrusteeData,
    separateTrusteeDataLength: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 'N/A',
    howResidueDistributed: dummyData.howResidueDistributed,
    appointSeparateTrusteesFLIT: dummyData.appointSeparateTrusteesFLIT
  });
  console.log('[AUTOFILL GENERATE] ========== GENERATION COMPLETE ==========');

  return dummyData;
};

export const autoFillForm = (setFormValues, formData) => {
  console.log('[AUTOFILL] ========== AUTO-FILL STARTED ==========');
  
  if (!formData) {
    console.error('[AUTOFILL] ❌ No form data provided');
    return;
  }
  
  console.log('[AUTOFILL] 📋 Form data structure:', {
    sectionsCount: formData.formSections?.length || 0,
    hasFormSections: !!formData.formSections
  });
  
  try {
    console.log('[AUTOFILL] 🔄 Generating dummy form data...');
    const dummyData = generateDummyFormData(formData);
    
    console.log('[AUTOFILL] ✅ Generated dummy data:', {
      totalFields: Object.keys(dummyData).length,
      sampleFields: Object.keys(dummyData).slice(0, 10),
      hasSeparateTrusteeData: !!dummyData.separateTrusteeData,
      separateTrusteeDataLength: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 0,
      howResidueDistributed: dummyData.howResidueDistributed,
      appointSeparateTrusteesFLIT: dummyData.appointSeparateTrusteesFLIT
    });
    
    if (dummyData.separateTrusteeData) {
      console.log('[AUTOFILL] 🔍 Separate trustee data structure:', {
        isArray: Array.isArray(dummyData.separateTrusteeData),
        length: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 'N/A',
        firstItem: Array.isArray(dummyData.separateTrusteeData) && dummyData.separateTrusteeData.length > 0 
          ? dummyData.separateTrusteeData[0] 
          : 'N/A'
      });
    }
    
    console.log('[AUTOFILL] 🔄 Setting form values...');
    setFormValues(dummyData);
    
    console.log('[AUTOFILL] ✅ Auto-fill completed successfully');
    console.log('[AUTOFILL] ========== AUTO-FILL FINISHED ==========');
    
    return dummyData;
  } catch (error) {
    console.error('[AUTOFILL] ❌ Error during auto-fill:', error);
    console.error('[AUTOFILL] Error stack:', error.stack);
    throw error;
  }
};
