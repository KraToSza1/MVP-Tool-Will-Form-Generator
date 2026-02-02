/**
 * Auto-fill utility for the Will Form
 * Fills ALL form fields with dummy data for testing - literally everything possible
 * Handles ALL field types, section subFields, conditional fields, and array data
 */

export const generateDummyFormData = (formData) => {
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
      const yesOpt = field.options.find(opt =>
        opt.value === 'Yes' || opt.label === 'Yes' ||
        (typeof opt.label === 'string' && opt.label.toLowerCase().includes('yes'))
      );
      return yesOpt ? yesOpt.value : getFirstOption(field);
    }
    return null;
  };

  // Options that UNLOCK and FILL everything - select values that show the most sections
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
    appointDifferentTrustees: 'Yes',
    professionalTrusteeSelection: 'Aristone',
    substituteProfessionalTrusteeSelection: 'Aristone',
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
    howResidueDistributed: 'AsShares',
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
    appointSeparateTrusteesFLIT: 'No',
    executorAgeClause: '25',
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
          if (field.id.includes('firstName') || field.id === 'firstName') return 'John';
          if (field.id.includes('lastName') || field.id === 'lastName') return 'Smith';
          if (field.id.includes('partner') || field.id === 'partnerFullName') return 'Jane Smith';
          if (field.id.includes('middle') || field.id === 'middleName') return 'Michael';
          if (field.id.includes('knownAs')) return 'Johnny';
          if (field.id === 'chattelsGiftBeneficiaryName') return 'Emma Thompson';
          if (field.id === 'foreignWillLocation') return 'France';
          if (field.id === 'nativeLanguage') return 'English';
          return 'John Smith';
        }
        if (field.id.includes('email')) return 'john.smith@example.com';
        if (field.id.includes('mobile') || field.id.includes('tel')) return '07123456789';
        if (field.id.includes('address1') || field.id === 'address1') return field.id?.includes('partner') ? '456 Park Lane' : '123 High Street';
        if (field.id.includes('address2') || field.id === 'address2') return field.id?.includes('partner') ? 'Mayfair' : 'Westminster';
        if (field.id.includes('address3') || field.id === 'address3') return 'London';
        if (field.id.includes('postcode') || field.id === 'postcode') return field.id?.includes('partner') ? 'W1K 6HP' : 'SW1A 1AA';
        if (field.id.includes('occupation')) return 'Software Developer';
        if (field.id.includes('Schedule') || field.id.includes('schedule')) return String(Math.floor(Math.random() * 9000000) + 1000000);
        if (field.id.includes('amount') || field.id.includes('Amount')) return field.id?.includes('pet') ? '5000' : '100000';
        if (field.id === 'specificOrgansToDonate') return 'eyes, heart, and brain';
        if (field.id === 'specificOrgansToExclude') return 'eyes';
        if (field.id === 'minimumCharityAmountValue') return '100000';
        if (field.id === 'stepProvisionToExcludeOne') return '1';
        if (field.id === 'stepProvisionsToExcludeMultiple') return '1, 2 & 3';
        return 'Standard value';

      case 'textarea':
        if (field.id.includes('charity') || field.id === 'charityBenefitDetails') return 'The British Red Cross (Charity No. 220949); Cancer Research UK (Charity No. 1089464); The Salvation Army (Charity No. 214779)';
        if (field.id.includes('monetaryGiftsDetails')) return 'I give £10,000 to my son John Smith when he reaches 25. I give £5,000 to my daughter Sarah Smith when she reaches 21.';
        if (field.id.includes('specificGiftsDetails')) return 'I give my vintage watch collection to my son John Smith. I give my art collection to my daughter Sarah Smith.';
        if (field.id.includes('propertyGiftsDetails')) return 'I give my property at 123 Main Street, London to my wife Jane Smith.';
        if (field.id.includes('propertyTrustDetails')) return 'my property at 1 Melk Bos Place, London';
        if (field.id.includes('propertyTrustTerms')) return 'The trustees shall have full power to manage, maintain, and if necessary sell the property.';
        if (field.id.includes('bprTrustDetails')) return 'My business interests in ABC Company Ltd shall be held in trust.';
        if (field.id.includes('bprTrustTerms')) return 'The business property relief trust shall operate according to standard terms.';
        if (field.id.includes('furtherResidualGiftsDetails')) return 'If any gifts fail, I give the failed share equally to my siblings Mary Smith and Peter Smith.';
        if (field.id.includes('residualGiftsDetails')) return 'I give 50% to my wife Jane Smith, 25% to my son John Smith, 25% to my daughter Sarah Smith.';
        if (field.id.includes('specifyLoansGiftsText')) return 'I loaned £5,000 to my son John Smith in 2020.';
        if (field.id.includes('lifeTenantDetails')) return 'My wife Jane Smith';
        if (field.id.includes('beneficiariesDetails')) return 'John Smith and Sarah Smith';
        if (field.id.includes('trustEndDistributionDetails')) return 'Upon the death of the life tenant, the trust property shall pass equally to John Smith and Sarah Smith.';
        if (field.id.includes('funeralWishes')) return 'I wish for a simple cremation. Please ensure all loved ones are informed.';
        if (field.id.includes('otherFuneralRequirements')) return 'Ashes to be scattered at sea.';
        if (field.id.includes('physicalHealthDescription')) return 'The testator is in good health and of sound mind.';
        return `Comprehensive dummy text for ${field.label || field.id}. All necessary details provided for testing.`;

      case 'date':
        if (field.id.includes('Birth') || field.id.includes('birth')) return '1980-01-15';
        if (field.id.includes('Execution') || field.id.includes('execution') || field.id.includes('Signing') || field.id.includes('signing') || field.id === 'willExecutionDate') return new Date().toISOString().split('T')[0];
        return '2020-01-01';

      case 'number':
      case 'currency':
        if (field.id.includes('age')) return 35;
        if (field.id.includes('pet') && (field.id.includes('amount') || field.id.includes('Gift') || field.id.includes('gift'))) return 5000;
        if (field.id.includes('executorSpecifyAge')) return 25;
        if (field.id.includes('amount') || field.id.includes('Amount')) return field.id?.includes('pet') ? 5000 : 10000;
        return 10000;

      case 'checkboxGroup':
        if (field.id === 'organPurposeGroup') return field.options ? field.options.map(o => o.id || o.value).filter(Boolean) : [];
        return field.options ? field.options.map(o => o.id || o.value).filter(Boolean) : [];

      default:
        return null;
    }
  };

  // Process fields recursively (including section subFields)
  const processFields = (fields, sectionName = '') => {
    if (!fields || !Array.isArray(fields)) return;
    fields.forEach((field) => {
      if (!field || !field.id) return;
      if (field.type === 'display' || field.type === 'button') return;
      if (field.type === 'hidden') return;

      let value = null;

      if (field.type === 'section' && field.subFields) {
        processFields(field.subFields, field.label);
        field.subFields.forEach((sub) => {
          if (sub.type === 'hidden' && sub.id) {
            if (sub.id.includes('guardianData')) dummyData[sub.id] = ['Sarah Johnson', 'Michael Brown'];
            else if (sub.id.includes('substituteGuardianData')) dummyData[sub.id] = ['Emma Williams'];
            else if (sub.id.includes('executorData')) dummyData[sub.id] = ['David Thompson', 'Lisa Anderson'];
            else if (sub.id.includes('substituteExecutorData')) dummyData[sub.id] = ['Robert Taylor'];
            else if (sub.id.includes('trusteeData')) dummyData[sub.id] = ['James Wilson'];
            else if (sub.id.includes('substituteTrusteeData')) dummyData[sub.id] = ['Patricia Martinez'];
            else if (sub.id.includes('witness1Data')) dummyData[sub.id] = ['Alice Witness'];
            else if (sub.id.includes('witness2Data')) dummyData[sub.id] = ['Bob Witness'];
            else if (sub.id.includes('petCarerData')) dummyData[sub.id] = [{
              title: 'Mr', firstName: 'Charlie', lastName: 'Pet Carer', relationship: 'Friend',
              address1: '789 Pet Street', address2: 'Animal District', address3: 'London', postcode: 'SW1A 2BB',
              mobile: '07123456789', email: 'charlie.petcarer@example.com', dateOfBirth: '1985-05-15', gender: 'Male'
            }];
            else if (sub.id.includes('substitutePetCarerData')) dummyData[sub.id] = [{
              title: 'Mrs', firstName: 'Diana', lastName: 'Pet Helper', relationship: 'Sister',
              address1: '321 Helper Lane', address2: 'Care District', address3: 'London', postcode: 'SW1A 3CC',
              mobile: '07987654321', email: 'diana.pethelper@example.com', dateOfBirth: '1988-08-20', gender: 'Female'
            }];
            else if (sub.id.includes('excludedPersonData')) dummyData[sub.id] = ['Robert Brown'];
            else if (sub.id.includes('digitalExecutorData')) dummyData[sub.id] = ['Sarah Wilson'];
            else if (sub.id.includes('separateTrusteeData')) dummyData[sub.id] = ['Christopher Davis'];
            else if (sub.id.includes('chattelRecipientData')) dummyData[sub.id] = ['Emma Wilson'];
            else if (sub.id.includes('debtorData')) dummyData[sub.id] = ['James Smith'];
            else if (sub.id.includes('signingOnBehalfData')) dummyData[sub.id] = ['Margaret Harris'];
            else if (sub.id.includes('interpreterData')) dummyData[sub.id] = ['Thomas Clark'];
          } else if (sub.type === 'text' || sub.type === 'textarea' || sub.type === 'number' || sub.type === 'date') {
            value = getFieldValue(sub, dummyData);
            if (value != null) dummyData[sub.id] = value;
          } else if (sub.type === 'radio' || sub.type === 'select') {
            value = unlockEverything[sub.id] ?? getYesOption(sub) ?? getFirstOption(sub);
            if (value != null) dummyData[sub.id] = value;
          } else if (sub.type === 'checkboxGroup') {
            value = sub.options ? sub.options.map(o => o.id || o.value).filter(Boolean) : [];
            dummyData[sub.id] = value;
          }
        });
        return;
      }

      value = getFieldValue(field, dummyData);
      if (value !== null && value !== undefined) {
        dummyData[field.id] = value;
      }
    });
  };

  // Main: process all sections
  formData.formSections.forEach((section) => {
    if (section.fields) processFields(section.fields, section.formSection);
  });

  // COMPREHENSIVE special fields - fill EVERYTHING that might be missed
  const specialFields = {
    // Person/array data - must be ARRAYS for fullDetails interpolation (use REAL names, not placeholders)
    guardianData: ['Sarah Johnson', 'Michael Brown'],
    substituteGuardianData: ['Emma Williams'],
    executorData: ['David Thompson', 'Lisa Anderson'],
    substituteExecutorData: ['Robert Taylor'],
    trusteeData: ['James Wilson'],
    substituteTrusteeData: ['Patricia Martinez'],
    witness1Data: ['Alice Cooper'],
    witness2Data: ['Bob Mitchell'],
    excludedPersonData: ['Robert Brown'],
    digitalExecutorData: ['Sarah Wilson'],
    separateTrusteeData: ['Christopher Davis'],
    chattelRecipientData: ['Emma Wilson'],
    debtorData: ['James Smith'],
    signingOnBehalfData: ['Margaret Harris'],
    interpreterData: ['Thomas Clark'],

    petCarerData: [{
      title: 'Mr', firstName: 'Charlie', lastName: 'Pet Carer', relationship: 'Friend',
      address1: '789 Pet Street', address2: 'Animal District', address3: 'London', postcode: 'SW1A 2BB',
      mobile: '07123456789', email: 'charlie.petcarer@example.com', dateOfBirth: '1985-05-15', gender: 'Male'
    }],
    substitutePetCarerData: [{
      title: 'Mrs', firstName: 'Diana', lastName: 'Pet Helper', relationship: 'Sister',
      address1: '321 Helper Lane', address2: 'Care District', address3: 'London', postcode: 'SW1A 3CC',
      mobile: '07987654321', email: 'diana.pethelper@example.com', dateOfBirth: '1988-08-20', gender: 'Female'
    }],

    chattelsGiftBeneficiaryName: 'Emma Thompson',

    address1: '123 High Street',
    address2: 'Westminster',
    address3: 'London',
    postcode: 'SW1A 1AA',
    partnerAddress1: '456 Park Lane',
    partnerAddress2: 'Mayfair',
    partnerAddress3: 'London',
    partnerPostcode: 'W1K 6HP',
    executorAddress1: '789 Oxford Street',
    executorAddress2: 'Marylebone',
    executorAddress3: 'London',
    executorPostcode: 'W1D 2HX',
    witness1Address1: '321 Baker Street',
    witness1Address2: 'Marylebone',
    witness1Address3: 'London',
    witness1Postcode: 'NW1 6XE',
    witness1Phone: '020 7946 0958',
    witness1Occupation: 'Accountant',
    witness2Address1: '654 Regent Street',
    witness2Address2: 'Soho',
    witness2Address3: 'London',
    witness2Postcode: 'W1B 2HQ',
    witness2Phone: '020 7946 0123',
    witness2Occupation: 'Teacher',

    monetaryGiftsDetails: 'I give £10,000 to my son John Smith when he reaches 25. I give £5,000 to my daughter Sarah Smith when she reaches 21.',
    specificGiftsDetails: 'I give my vintage watch collection to my son John Smith. I give my art collection to my daughter Sarah Smith.',
    propertyGiftsDetails: 'I give my property at 123 Main Street, London to my wife Jane Smith.',
    propertyTrustDetails: 'my property at 1 Melk Bos Place, London',
    propertyTrustTerms: 'The trustees shall have full power to manage, maintain, and if necessary sell the property.',
    bprTrustDetails: 'My business interests in ABC Company Ltd shall be held in trust.',
    bprTrustTerms: 'The business property relief trust shall operate according to standard terms.',
    furtherResidualGiftsDetails: 'If any gifts fail, I give the failed share equally to my siblings Mary Smith and Peter Smith.',
    residualGiftsDetails: 'I give 50% to my wife Jane Smith, 25% to my son John Smith, 25% to my daughter Sarah Smith.',
    specifyLoansGiftsText: 'I loaned £5,000 to my son John Smith in 2020.',
    charityBenefitDetails: 'The British Red Cross (Charity No. 220949); Cancer Research UK (Charity No. 1089464); The Salvation Army (Charity No. 214779)',
    lifeTenantDetails: 'My wife Jane Smith',
    beneficiariesDetails: 'John Smith and Sarah Smith',
    trustEndDistributionDetails: 'Upon the death of the life tenant, the trust property shall pass equally to John Smith and Sarah Smith.',
    funeralWishes: 'I wish for a simple cremation. Please ensure all loved ones are informed.',
    otherFuneralRequirements: 'Ashes to be scattered at sea.',
    physicalHealthDescription: 'The testator is in good health and of sound mind.',

    propertyTrustScheduleNumber: String(Math.floor(Math.random() * 9000000) + 1000000),
    bprTrustScheduleNumber: String(Math.floor(Math.random() * 9000000) + 1000000),

    organDonationPreference: 'YesButOnly',
    specificOrgansToDonate: 'eyes, heart, and brain',
    specificOrgansToExclude: 'eyes',
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
  };

  Object.entries(specialFields).forEach(([key, val]) => {
    if (dummyData[key] === undefined || dummyData[key] === null || dummyData[key] === '') {
      dummyData[key] = val;
    }
  });

  // Apply unlockEverything for any radio/select not yet set
  Object.entries(unlockEverything).forEach(([key, val]) => {
    if (dummyData[key] === undefined || dummyData[key] === null) {
      dummyData[key] = val;
    }
  });

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
  missingIds.forEach((id) => {
    const defaultVal = id.includes('Name') ? 'John Smith'
      : id.includes('email') ? 'john.smith@example.com'
      : id.includes('mobile') || id.includes('tel') ? '07123456789'
      : id.includes('address') ? '123 High Street'
      : id.includes('postcode') ? 'SW1A 1AA'
      : id.includes('date') || id.includes('Date') ? new Date().toISOString().split('T')[0]
      : id.includes('amount') || id.includes('Amount') ? '10000'
      : id.includes('Details') || id.includes('details') ? 'Standard details as required for this field.'
      : 'Standard value';
    dummyData[id] = defaultVal;
  });

  return dummyData;
};

export const autoFillForm = (setFormValues, formData) => {
  if (!formData) {
    console.error('[AUTOFILL] No form data provided');
    return;
  }
  const dummyData = generateDummyFormData(formData);
  setFormValues(dummyData);
  return dummyData;
};
