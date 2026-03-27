/**
 * Auto-fill utility for the Will Form
 * Fills ALL form fields with dummy data for testing - literally everything possible
 * Handles ALL field types, section subFields, conditional fields, and array data
 */

const ARISTONE_EXECUTOR_LINE =
  'Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG';

/**
 * Distinct demo identities so every role is visibly different in the UI (names, emails, phones, streets).
 * Tag suffix "(demo autofill)" makes test data obvious in lists and PDFs.
 */
const DEMO = {
  testator: {
    title: 'Mr',
    firstName: 'James',
    middleName: 'Oliver',
    lastName: 'Hartwell',
    knownAs: 'Jim',
    email: 'james.hartwell.demo@example.com',
    mobile: '07700111101',
    address1: '10 Testator Terrace',
    address2: 'Kensington',
    address3: 'London',
    postcode: 'W8 4AA',
    occupation: 'Chartered surveyor',
  },
  partner: {
    fullName: 'Priya Hartwell',
    title: 'Mrs',
    firstName: 'Priya',
    middleName: 'Anita',
    lastName: 'Hartwell',
    knownAs: '',
    email: 'priya.hartwell.demo@example.com',
    mobile: '07700111102',
    tel2: '020 7946 0001',
    dateOfBirth: '1978-07-14',
    gender: 'Female',
    occupation: 'GP (demo autofill)',
    nationalityCountry: 'United Kingdom',
    countryOfResidence: 'United Kingdom',
    address1: '10 Testator Terrace',
    address2: 'Kensington',
    address3: 'London',
    postcode: 'W8 4AA',
  },
  guardian1: 'Gavin Green — Guardian 1 (demo autofill)',
  guardian2: 'Greta Green — Guardian 2 (demo autofill)',
  guardianSub: 'Hugo Hayes — Substitute guardian (demo autofill)',
  digitalExecutor: 'Dana Reyes — Digital executor (demo autofill)',
  trustee: 'Tracy Okonkwo — Trustee (demo autofill)',
  trusteeSub: 'Uma Patel — Substitute trustee (demo autofill)',
  witness1: 'Wendy Wainwright — Witness 1 (demo autofill)',
  witness2: 'Winston White — Witness 2 (demo autofill)',
  executorIndiv1: 'David Day — Individual executor 1 (demo autofill)',
  executorIndiv2: 'Laura Lake — Individual executor 2 (demo autofill)',
  substituteExecIndiv: 'Robert Rook — Substitute executor individual (demo autofill)',
  excluded: 'Evan Excluded — Deliberate exclusion (demo autofill)',
  debtor: 'Darren Debtor — Debt released (demo autofill)',
  signingOnBehalf: 'Sally Signer — Signs on behalf (demo autofill)',
  interpreter: 'Ingrid Interpreter — Interpreter (demo autofill)',
  chattelRecipient: 'Chloe Chattels — Chattels recipient (demo autofill)',
  petCarer: {
    title: 'Ms',
    firstName: 'Penny',
    lastName: 'Parker',
    relationship: 'Friend',
    address1: '1 Petcarer Lane',
    address2: 'Richmond',
    address3: 'Surrey',
    city: 'Richmond',
    postcode: 'TW9 1PC',
    mobile: '07700222201',
    email: 'penny.parker.pet.demo@example.com',
    dateOfBirth: '1984-04-12',
    gender: 'Female',
  },
  petCarerSub: {
    title: 'Mr',
    firstName: 'Quinn',
    lastName: 'Quimby',
    relationship: 'Brother',
    address1: '2 Substitute Close',
    address2: 'Windsor',
    address3: 'Berkshire',
    city: 'Windsor',
    postcode: 'SL4 2PS',
    mobile: '07700222202',
    email: 'quinn.quimby.pet.demo@example.com',
    dateOfBirth: '1986-11-03',
    gender: 'Male',
  },
  flitTrusteeA: {
    title: 'Mr',
    firstName: 'Felix',
    lastName: 'Flint',
    relationship: 'Friend',
    relationshipToTestator: 'Friend',
    address1: '77 FLIT Row',
    address2: 'Hampstead',
    address3: 'London',
    city: 'London',
    postcode: 'NW3 5FL',
    mobile: '07700333301',
    email: 'felix.flint.flit.demo@example.com',
    dateOfBirth: '1978-04-15',
    gender: 'Male',
  },
  flitTrusteeB: {
    title: 'Mrs',
    firstName: 'Fiona',
    lastName: 'Flint',
    relationship: 'Sister',
    relationshipToTestator: 'Sister',
    address1: '88 FLIT Avenue',
    address2: 'St John\'s Wood',
    address3: 'London',
    city: 'London',
    postcode: 'NW8 6FL',
    mobile: '07700333302',
    email: 'fiona.flint.flit.demo@example.com',
    dateOfBirth: '1981-11-08',
    gender: 'Female',
  },
};

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
    gender: 'Male',
    executorAgeClause: '25',
    estateGrossValueRange: 'Range500_1m',
    estateLiabilityValueRange: 'Range100_250',
    estatePropertyValueRange: 'Range500_1m',
    partnerTitle: 'Mrs',
    partnerGender: 'Female',
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
        if (field.id === 'partnerTitle') return DEMO.partner.title;
        if (field.id === 'partnerGender') return DEMO.partner.gender;
        if (field.id === 'organDonationPreference') return 'YesButOnly';
        return getYesOption(field) || getFirstOption(field);

      case 'text':
        if (field.id === 'firstName') return DEMO.testator.firstName;
        if (field.id === 'lastName') return DEMO.testator.lastName;
        if (field.id === 'middleName') return DEMO.testator.middleName;
        if (field.id === 'knownAs') return DEMO.testator.knownAs;
        if (field.id === 'alias') return 'J. O. Hartwell';
        if (field.id === 'partnerFullName') return DEMO.partner.fullName;
        if (field.id === 'partnerFirstName') return DEMO.partner.firstName;
        if (field.id === 'partnerMiddleName') return DEMO.partner.middleName;
        if (field.id === 'partnerLastName') return DEMO.partner.lastName;
        if (field.id === 'partnerKnownAs') return DEMO.partner.knownAs || 'Pri';
        if (field.id === 'partnerOccupation') return DEMO.partner.occupation;
        if (field.id === 'partnerNationalityCountry') return DEMO.partner.nationalityCountry;
        if (field.id === 'partnerCountryOfResidence') return DEMO.partner.countryOfResidence;
        if (field.id === 'partnerTel2') return DEMO.partner.tel2;
        if (field.id === 'email') return DEMO.testator.email;
        if (field.id.includes('partner') && field.id.includes('email')) return DEMO.partner.email;
        if (field.id.includes('Name') || field.id.includes('name')) {
          if (field.id.includes('firstName')) return DEMO.testator.firstName;
          if (field.id.includes('lastName')) return DEMO.testator.lastName;
          if (field.id === 'chattelsGiftBeneficiaryName') return DEMO.chattelRecipient.split(' — ')[0];
          if (field.id === 'foreignWillLocation') return 'Spain';
          if (field.id === 'nativeLanguage') return 'English';
          return `${DEMO.testator.firstName} ${DEMO.testator.lastName}`;
        }
        if (field.id.includes('email')) return DEMO.testator.email;
        if (field.id === 'mobile') return DEMO.testator.mobile;
        if (field.id.includes('partner') && (field.id.includes('mobile') || field.id.includes('tel'))) return DEMO.partner.mobile;
        if (field.id.includes('mobile') || field.id.includes('tel')) return DEMO.testator.mobile;
        if (field.id === 'address1' || (field.id.includes('address1') && !field.id.includes('partner'))) return DEMO.testator.address1;
        if (field.id === 'address2' || (field.id.includes('address2') && !field.id.includes('partner'))) return DEMO.testator.address2;
        if (field.id === 'address3' || (field.id.includes('address3') && !field.id.includes('partner'))) return DEMO.testator.address3;
        if (field.id === 'postcode' || (field.id.includes('postcode') && !field.id.includes('partner'))) return DEMO.testator.postcode;
        if (field.id.includes('partnerAddress1') || (field.id.includes('address1') && field.id.includes('partner'))) return DEMO.partner.address1;
        if (field.id.includes('partnerAddress2') || (field.id.includes('address2') && field.id.includes('partner'))) return DEMO.partner.address2;
        if (field.id.includes('partnerAddress3') || (field.id.includes('address3') && field.id.includes('partner'))) return DEMO.partner.address3;
        if (field.id.includes('partnerPostcode') || (field.id.includes('postcode') && field.id.includes('partner'))) return DEMO.partner.postcode;
        if (field.id.startsWith('witness1')) return field.id.includes('Address1') ? '11 Witness-One Way' : field.id.includes('Address2') ? 'Fulham' : field.id.includes('Address3') ? 'London' : field.id.includes('Postcode') ? 'SW6 1W1' : field.id.includes('Phone') ? '020 7001 0001' : field.id.includes('Occupation') ? 'Solicitor (demo W1)' : DEMO.witness1;
        if (field.id.startsWith('witness2')) return field.id.includes('Address1') ? '22 Witness-Two Road' : field.id.includes('Address2') ? 'Putney' : field.id.includes('Address3') ? 'London' : field.id.includes('Postcode') ? 'SW15 2W2' : field.id.includes('Phone') ? '020 7002 0002' : field.id.includes('Occupation') ? 'Teacher (demo W2)' : DEMO.witness2;
        if (field.id === 'executorAddress1') return '101 Executor Lane';
        if (field.id === 'executorAddress2') return 'Hampstead';
        if (field.id === 'executorAddress3') return 'London';
        if (field.id === 'executorPostcode') return 'NW3 9EX';
        if (field.id === 'tel2') return '020 7946 0000';
        if (field.id.includes('occupation')) return DEMO.testator.occupation;
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
        if (field.id.includes('monetaryGiftsDetails')) return 'I give £25,000 to my son Thomas Hartwell when he reaches 25. I give £15,000 to my daughter Charlotte Hartwell when she reaches 21. [demo autofill — distinct beneficiaries]';
        if (field.id.includes('specificGiftsDetails')) return 'I give my grandfather\'s gold pocket watch to Thomas Hartwell. I give my oil paintings to Charlotte Hartwell. [demo autofill]';
        if (field.id.includes('propertyGiftsDetails')) return `I give my property at ${DEMO.testator.address1}, ${DEMO.testator.postcode} to my wife ${DEMO.partner.fullName} absolutely. [demo autofill]`;
        if (field.id.includes('propertyTrustDetails')) return `my property at ${DEMO.testator.address1}, ${DEMO.testator.postcode}`;
        if (field.id.includes('propertyTrustTerms')) return 'The trustees shall have full power to manage, maintain, repair, improve, and if necessary sell the property. All rental income shall be paid to the life tenant during their lifetime.';
        if (field.id.includes('bprTrustDetails')) return 'My business interests in Mitchell & Associates Ltd (Company No. 12345678) shall be held in trust.';
        if (field.id.includes('bprTrustTerms')) return 'The business property relief trust shall operate according to standard terms. The trustees shall have full power to manage the business or sell the business interests as they see fit.';
        if (field.id.includes('furtherResidualGiftsDetails')) return 'If any of the above gifts fail, I give the failed share equally to my siblings David Hartwell and Helen Hartwell. [demo autofill]';
        if (field.id.includes('residualGiftsDetails')) return `I give 50% of my residuary estate to ${DEMO.partner.fullName} absolutely, 25% to Thomas Hartwell, 25% to Charlotte Hartwell. [demo autofill]`;
        if (field.id.includes('specifyLoansGiftsText')) return 'I loaned £10,000 to Thomas Hartwell in January 2022 for a house purchase. [demo autofill]';
        if (field.id.includes('lifeTenantDetails')) return `My wife ${DEMO.partner.fullName}`;
        if (field.id.includes('beneficiariesDetails')) return 'Thomas Hartwell and Charlotte Hartwell';
        if (field.id.includes('trustEndDistributionDetails')) return 'Upon the death of the life tenant, the trust passes equally to Thomas Hartwell and Charlotte Hartwell. [demo autofill]';
        if (field.id.includes('funeralWishes')) return 'I wish for a simple cremation service. Please ensure all family members and close friends are informed in advance.';
        if (field.id.includes('otherFuneralRequirements')) return 'My ashes are to be scattered in the garden of remembrance at Golders Green Crematorium.';
        if (field.id.includes('physicalHealthDescription')) return 'The testator is in good physical and mental health and fully understands the nature and effect of this Will.';
        if (field.id === 'estateAdditionalNotes') return 'Autofill test: approximate figures for solicitor review only; not for the Will text.';
        return `Please provide details for ${field.label || field.id}.`;

      case 'date':
        if (field.id === 'partnerDateOfBirth') return DEMO.partner.dateOfBirth;
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
              dummyData[sub.id] = [DEMO.guardian1, DEMO.guardian2];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 2 items`);
            }
            else if (sub.id === 'substituteGuardianData') {
              dummyData[sub.id] = [DEMO.guardianSub];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'digitalExecutorData') {
              dummyData[sub.id] = [DEMO.digitalExecutor];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'substituteExecutorData') {
              dummyData[sub.id] =
                dummyData.chooseAristoneSubstituteExecutor === 'Aristone'
                  ? [ARISTONE_EXECUTOR_LINE]
                  : [DEMO.substituteExecIndiv];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array (substitute executor)`);
            }
            else if (sub.id === 'executorData') {
              dummyData[sub.id] =
                dummyData.chooseAristoneExecutor === 'Aristone'
                  ? [ARISTONE_EXECUTOR_LINE]
                  : [DEMO.executorIndiv1, DEMO.executorIndiv2];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array (executor)`);
            }
            else if (sub.id === 'substituteTrusteeData') {
              dummyData[sub.id] = [DEMO.trusteeSub];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = substitute trustee`);
            }
            else if (sub.id === 'trusteeData') {
              dummyData[sub.id] = [DEMO.trustee];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = trustee`);
            }
            else if (sub.id === 'witness1Data') {
              dummyData[sub.id] = [DEMO.witness1];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'witness2Data') {
              dummyData[sub.id] = [DEMO.witness2];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'substitutePetCarerData') {
              dummyData[sub.id] = [{ ...DEMO.petCarerSub }];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 object (substitute pet carer)`);
            }
            else if (sub.id === 'petCarerData') {
              dummyData[sub.id] = [{ ...DEMO.petCarer }];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 object (pet carer)`);
            }
            else if (sub.id === 'excludedPersonData') {
              dummyData[sub.id] = [DEMO.excluded];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'separateTrusteeData') {
              dummyData[sub.id] = [{ ...DEMO.flitTrusteeA }, { ...DEMO.flitTrusteeB }];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 2 objects (separate trustees)`);
            }
            else if (sub.id === 'chattelRecipientData') {
              dummyData[sub.id] = [DEMO.chattelRecipient];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'debtorData') {
              dummyData[sub.id] = [DEMO.debtor];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'signingOnBehalfData') {
              dummyData[sub.id] = [DEMO.signingOnBehalf];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = array with 1 item`);
            }
            else if (sub.id === 'interpreterData') {
              dummyData[sub.id] = [DEMO.interpreter];
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
    guardianData: [DEMO.guardian1, DEMO.guardian2],
    substituteGuardianData: [DEMO.guardianSub],
    executorData: [ARISTONE_EXECUTOR_LINE],
    substituteExecutorData: [ARISTONE_EXECUTOR_LINE],
    trusteeData: [DEMO.trustee],
    substituteTrusteeData: [DEMO.trusteeSub],
    witness1Data: [DEMO.witness1],
    witness2Data: [DEMO.witness2],
    excludedPersonData: [DEMO.excluded],
    digitalExecutorData: [DEMO.digitalExecutor],
    separateTrusteeData: [{ ...DEMO.flitTrusteeA }, { ...DEMO.flitTrusteeB }],
    chattelRecipientData: [DEMO.chattelRecipient],
    debtorData: [DEMO.debtor],
    signingOnBehalfData: [DEMO.signingOnBehalf],
    interpreterData: [DEMO.interpreter],

    petCarerData: [{ ...DEMO.petCarer }],
    substitutePetCarerData: [{ ...DEMO.petCarerSub }],

    chattelsGiftBeneficiaryName: DEMO.chattelRecipient.split(' — ')[0],

    address1: DEMO.testator.address1,
    address2: DEMO.testator.address2,
    address3: DEMO.testator.address3,
    postcode: DEMO.testator.postcode,
    partnerAddress1: DEMO.partner.address1,
    partnerAddress2: DEMO.partner.address2,
    partnerAddress3: DEMO.partner.address3,
    partnerPostcode: DEMO.partner.postcode,
    executorAddress1: '101 Executor Lane',
    executorAddress2: 'Hampstead',
    executorAddress3: 'London',
    executorPostcode: 'NW3 9EX',
    witness1Address1: '11 Witness-One Way',
    witness1Address2: 'Fulham',
    witness1Address3: 'London',
    witness1Postcode: 'SW6 1W1',
    witness1Phone: '020 7001 0001',
    witness1Occupation: 'Solicitor (demo W1)',
    witness2Address1: '22 Witness-Two Road',
    witness2Address2: 'Putney',
    witness2Address3: 'London',
    witness2Postcode: 'SW15 2W2',
    witness2Phone: '020 7002 0002',
    witness2Occupation: 'Teacher (demo W2)',

    monetaryGiftsDetails: 'I give £25,000 to Thomas Hartwell when he reaches 25. I give £15,000 to Charlotte Hartwell when she reaches 21. [demo autofill]',
    specificGiftsDetails: 'Pocket watch to Thomas Hartwell; paintings to Charlotte Hartwell. [demo autofill]',
    propertyGiftsDetails: `I give my property at ${DEMO.testator.address1} to ${DEMO.partner.fullName} absolutely. [demo autofill]`,
    propertyTrustDetails: `my property at ${DEMO.testator.address1}, ${DEMO.testator.postcode}`,
    propertyTrustTerms: 'The trustees shall have full power to manage, maintain, repair, improve, and if necessary sell the property. All rental income shall be paid to the life tenant during their lifetime.',
    bprTrustDetails: 'My business interests in Mitchell & Associates Ltd (Company No. 12345678) shall be held in trust.',
    bprTrustTerms: 'The business property relief trust shall operate according to standard terms. The trustees shall have full power to manage the business or sell the business interests as they see fit.',
    furtherResidualGiftsDetails: 'If gifts fail, failed share to David Hartwell and Helen Hartwell. [demo autofill]',
    residualGiftsDetails: `50% residue to ${DEMO.partner.fullName}, 25% Thomas Hartwell, 25% Charlotte Hartwell. [demo autofill]`,
    specifyLoansGiftsText: 'Loan £10,000 to Thomas Hartwell (Jan 2022). [demo autofill]',
    charityBenefitDetails: 'Cancer Research UK (Charity No. 1089464); British Heart Foundation (Charity No. 225971); Macmillan Cancer Support (Charity No. 261017)',
    lifeTenantDetails: `My wife ${DEMO.partner.fullName}`,
    beneficiariesDetails: 'Thomas Hartwell and Charlotte Hartwell',
    trustEndDistributionDetails: 'Trust ends: equal split to Thomas Hartwell and Charlotte Hartwell. [demo autofill]',
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
    let defaultVal = 'Standard value';
    if (id === 'firstName') defaultVal = DEMO.testator.firstName;
    else if (id === 'lastName') defaultVal = DEMO.testator.lastName;
    else if (id.startsWith('witness1')) {
      defaultVal = id.includes('Address1') ? '11 Witness-One Way' : id.includes('Postcode') ? 'SW6 1W1' : DEMO.witness1;
    } else if (id.startsWith('witness2')) {
      defaultVal = id.includes('Address1') ? '22 Witness-Two Road' : id.includes('Postcode') ? 'SW15 2W2' : DEMO.witness2;
    } else if (id.includes('Name')) defaultVal = `${DEMO.testator.firstName} ${DEMO.testator.lastName}`;
    else if (id.includes('email')) defaultVal = DEMO.testator.email;
    else if (id.includes('mobile') || id.includes('tel')) defaultVal = DEMO.testator.mobile;
    else if (id.includes('address')) defaultVal = DEMO.testator.address1;
    else if (id.includes('postcode')) defaultVal = DEMO.testator.postcode;
    else if (id.includes('date') || id.includes('Date')) defaultVal = new Date().toISOString().split('T')[0];
    else if (id.includes('amount') || id.includes('Amount')) defaultVal = '25000';
    else if (id.includes('Details') || id.includes('details')) defaultVal = 'Please provide details as required for this field. [demo autofill]';
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
