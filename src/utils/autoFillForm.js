/**
 * Auto-fill utility for the Will Form
 * Fills ALL form fields with dummy data for testing - literally everything possible
 * Handles ALL field types, section subFields, conditional fields, and array data
 */

import { CONTACT_REGISTRY_KEY } from '../lib/personRegistry.js';
import { getAristoneEstateRecommendationState } from '../constants/clientMode.js';
import {
  buildGuardianshipDetailsClause,
  buildGuardianshipDetailsClauseSameGuardians,
  normalizeSourceToGuardianModalForm,
} from './guardianFlowSync.js';
import { formatMonetaryGiftsDetailsFromList } from './monetaryGiftsFormat.js';
import { formatSpecificGiftsDetailsFromList } from './specificGiftsFormat.js';
import { formatPropertyGiftsDetailsFromList } from './propertyGiftsFormat.js';
import { formatPropertyTrustClientSummaryFromState } from './propertyTrustFormat.js';
import { getMissingIdVerificationDocs } from '../lib/matterOutstanding.js';

/**
 * Recursively collect every field `id` from the form definition (including nested sections
 * and option-level fields). Used so autofill can replace form state without leaving stale keys.
 */
function collectFormFieldIdsRecursive(fields, out) {
  for (const field of fields || []) {
    if (!field) continue;
    if (field.id) out.add(field.id);
    if (field.type === 'section' && field.subFields) {
      collectFormFieldIdsRecursive(field.subFields, out);
    }
    if (Array.isArray(field.options)) {
      for (const opt of field.options) {
        if (opt?.fields) collectFormFieldIdsRecursive(opt.fields, out);
      }
    }
  }
}

/**
 * Keys that live in `formValues` but are not a standalone `id` in Complete-WillSuite-Form-Data.json
 * (guided components, person registry, ID uploads, FLIT name lines, business-trustee capture).
 */
const AUTOFILL_NON_FIELD_STATE_KEYS = new Set([
  CONTACT_REGISTRY_KEY,
  'identityVerification',
  'identityVerificationFileNames',
  'guardianshipDetailsData',
  'propertyTrustClientSummary',
  'flitLifeTenantName',
  'flitLifeTenantRel',
  'flitTrustEndMode',
  '_flitTrustEndMode',
  'furtherResidualFallbackRows',
  'businessSeparateTrusteeRecordId',
  'businessSeparateTrusteeFirstName',
  'businessSeparateTrusteeLastName',
  'businessSeparateTrusteeEmail',
  'businessSeparateTrusteeRelationship',
  'businessSeparateTrusteeAddress1',
  'businessSeparateTrusteeTown',
  'businessSeparateTrusteePostcode',
]);

export function collectAllFormStateKeys(formData) {
  const keys = new Set(AUTOFILL_NON_FIELD_STATE_KEYS);
  for (const sec of formData?.formSections || []) {
    collectFormFieldIdsRecursive(sec.fields, keys);
  }
  return keys;
}

/**
 * Keep only keys that belong to the current form schema (plus non-field state above).
 * Prevents "Auto-Fill" from leaving deprecated fields from older sessions in React state.
 */
export function filterAutofillPayloadToFormSchema(payload, formData) {
  if (!payload || typeof payload !== 'object') return {};
  const allowed = collectAllFormStateKeys(formData);
  const out = {};
  for (const k of Object.keys(payload)) {
    if (allowed.has(k)) out[k] = payload[k];
  }
  return out;
}

/** Walk every field in the form definition (including nested sections and option-level fields). */
function forEachFormField(formData, fn) {
  for (const section of formData?.formSections || []) {
    const walk = (fields) => {
      for (const field of fields || []) {
        if (!field) continue;
        fn(field, section);
        if (field.type === 'section' && field.subFields) walk(field.subFields);
        if (Array.isArray(field.options)) {
          for (const opt of field.options) {
            if (opt?.fields) walk(opt.fields);
          }
        }
      }
    };
    walk(section.fields);
  }
}

function buildFieldByIdMap(formData) {
  const map = new Map();
  forEachFormField(formData, (field) => {
    if (field.id) map.set(field.id, field);
  });
  return map;
}

function autofillValueNeedsTopUp(v) {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '' || t === 'Standard value') return true;
  }
  return false;
}

/** Must match `Complete-WillSuite-Form-Data.json` appointGuardians option value. */
const APPOINT_GUARDIANS_DIFFERENT = 'Yes, but appoint different guardians for children';

const ARISTONE_EXECUTOR_LINE =
  'Aristone Limited (trading as Aristone Solicitors), SRA No. 649717, of Ground Floor, 12 Cardiff Road, Luton, LU1 1QG';

/**
 * Suffix for generated demo prose. Do not use `[` or `]` here — PDF completeness checks treat
 * square brackets as unresolved placeholders.
 */
/** Em dash + NBSP before "demo" so PDF line break cannot merge "Tool" and "demo". */
const DEMO_TEXT_TAG = ' \u2014 Will Tool\u00A0demo data';

/**
 * Distinct demo identities so every role is visibly different in the UI (names, emails, phones, streets).
 * Update this block when refreshing public demo names (keep one coherent "family" for clauses).
 */
const DEMO = {
  testator: {
    title: 'Mr',
    firstName: 'Marcus',
    middleName: 'Julian',
    lastName: 'Ellwood',
    knownAs: 'Jim',
    email: 'marcus.ellwood.demo@example.com',
    mobile: '07700999101',
    address1: '42 Meridian Wharf',
    address2: 'Canary Wharf',
    address3: 'London',
    postcode: 'E14 9WT',
    occupation: 'Software architect — Will Tool demo',
  },
  partner: {
    fullName: 'Elena Voss',
    title: 'Mrs',
    firstName: 'Elena',
    middleName: 'Rina',
    lastName: 'Voss',
    knownAs: '',
    email: 'elena.voss.demo@example.com',
    mobile: '07700999102',
    tel2: '020 7946 1102',
    dateOfBirth: '1980-09-22',
    gender: 'Female',
    occupation: 'Nurse — Will Tool demo',
    nationalityCountry: 'United Kingdom',
    countryOfResidence: 'United Kingdom',
    address1: '42 Meridian Wharf',
    address2: 'Canary Wharf',
    address3: 'London',
    postcode: 'E14 9WT',
  },
  /** Children / siblings named in gift & residue demo paragraphs */
  children: {
    son: { firstName: 'Leo', lastName: 'Ellwood' },
    daughter: { firstName: 'Maya', lastName: 'Ellwood' },
  },
  siblings: {
    brother: { firstName: 'Noah', lastName: 'Ellwood' },
    sister: { firstName: 'Iris', lastName: 'Ellwood' },
  },
  guardian1: 'Rowan Blake — Guardian 1 — Will Tool demo',
  guardian2: 'Sienna Blake — Guardian 2 — Will Tool demo',
  guardianSub: 'Theo Marsh — Substitute guardian — Will Tool demo',
  digitalExecutor: 'Dana Reyes — Digital executor — Will Tool demo',
  trustee: 'Tracy Okonkwo — Trustee — Will Tool demo',
  trusteeSub: 'Uma Patel — Substitute trustee — Will Tool demo',
  witness1: 'Wendy Wainwright — Witness 1 — Will Tool demo',
  witness2: 'Winston White — Witness 2 — Will Tool demo',
  executorIndiv1: 'David Day — Individual executor 1 — Will Tool demo',
  executorIndiv2: 'Laura Lake — Individual executor 2 — Will Tool demo',
  substituteExecIndiv: 'Robert Rook — Substitute executor individual — Will Tool demo',
  excluded: 'Evan Excluded — Deliberate exclusion — Will Tool demo',
  debtor: 'Darren Debtor — Debt released — Will Tool demo',
  signingOnBehalf: 'Sally Signer — Signs on behalf — Will Tool demo',
  interpreter: 'Ingrid Interpreter — Interpreter — Will Tool demo',
  chattelRecipient: 'Chloe Chattels — Chattels recipient — Will Tool demo',
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
  /** Separate business trustee (BusinessInterestsGuided modal) — `_businessGuidedCapture` row in separateTrusteeData */
  businessTrusteeGuided: {
    recordId: 'biz-trustee-autofill-demo',
    firstName: 'Harriet',
    lastName: 'Morgan',
    email: 'harriet.morgan.biz.demo@example.com',
    relationship: 'Accountant',
    address1: 'Unit 4, Business Park House',
    town: 'Reading',
    postcode: 'RG1 1AA',
  },
};

/** Minimal 1×1 PNG data URL — autofill only; submit still runs image compression. */
const AUTOFILL_DEMO_ID_IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Populate all four ID slots so client final step and matter submit see “complete” demo attachments. */
function applyIdentityVerificationAutofill(dummyData) {
  dummyData.identityVerification = {
    identityVerificationPhotoId: AUTOFILL_DEMO_ID_IMAGE_DATA_URL,
    identityVerificationProofOfAddress1: AUTOFILL_DEMO_ID_IMAGE_DATA_URL,
    identityVerificationProofOfAddress2: AUTOFILL_DEMO_ID_IMAGE_DATA_URL,
    identityVerificationSelfieWithId: AUTOFILL_DEMO_ID_IMAGE_DATA_URL,
  };
  dummyData.identityVerificationFileNames = {
    identityVerificationPhotoId: 'demo-photo-id.png',
    identityVerificationProofOfAddress1: 'demo-proof-of-address-1.png',
    identityVerificationProofOfAddress2: 'demo-proof-of-address-2.png',
    identityVerificationSelfieWithId: 'demo-selfie-with-id.png',
  };
}

/**
 * Estate Overview — used by autofill so checkbox/radio/text stay consistent
 * (including "Other" assets so the conditional other-assets field is visible).
 *
 * Default bands: gross `Range500_1m` vs liabilities `Range100_250` → net-positive over £50k
 * (`shouldRecommendAristoneFromEstate` / `getAristoneEstateRecommendationState`).
 */
const ESTATE_DEMO = {
  approxValue: '£1,000,001 – £3,000,000',
  approxLiabilities: 'Under £50,000',
  ownProperty: 'Yes',
  /** Aligns with unlockEverything.hasBusinessInterests + Business Interests guided autofill */
  businessInterests: 'Yes',
  feesAck: ['ack'],
};

/**
 * Final pass: contactRegistry + rich person rows matching PersonRecordModal / PDF (objects with _personRecordId).
 * Runs after specialFields / unlock / missing-id defaults so demo data always wins for people arrays.
 */
function applyRichPersonDemoOverrides(dummyData) {
  let seq = 0;
  /** Rich rows aligned with PersonRecordModal (title, name, address + intake fields). */
  const row = (fields) => ({
    middleName: '',
    gender: 'Male',
    dateOfBirth: '15/06/1975',
    occupation: 'Professional — Will Tool demo',
    relationship: 'Friend',
    ...fields,
    _personRecordId: `autofill-demo-${++seq}`,
  });
  const ts = new Date().toISOString();

  dummyData[CONTACT_REGISTRY_KEY] = [
    {
      id: 'demo-reg-testator',
      savedAt: ts,
      title: DEMO.testator.title,
      firstName: DEMO.testator.firstName,
      middleName: DEMO.testator.middleName,
      lastName: DEMO.testator.lastName,
      email: DEMO.testator.email,
      mobile: DEMO.testator.mobile,
      address1: DEMO.testator.address1,
      address2: DEMO.testator.address2,
      address3: DEMO.testator.address3,
      postcode: DEMO.testator.postcode,
      occupation: DEMO.testator.occupation,
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
    },
    {
      id: 'demo-reg-partner',
      savedAt: ts,
      title: DEMO.partner.title,
      firstName: DEMO.partner.firstName,
      middleName: DEMO.partner.middleName,
      lastName: DEMO.partner.lastName,
      email: DEMO.partner.email,
      mobile: DEMO.partner.mobile,
      address1: DEMO.partner.address1,
      address2: DEMO.partner.address2,
      address3: DEMO.partner.address3,
      postcode: DEMO.partner.postcode,
      occupation: DEMO.partner.occupation,
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Partner / spouse (from intake)',
    },
    {
      id: 'demo-reg-rowan',
      savedAt: ts,
      title: 'Mr',
      firstName: 'Rowan',
      lastName: 'Blake',
      email: 'rowan.blake.demo@example.com',
      mobile: '07700999110',
      address1: '7 Guardian Grove',
      address2: 'Rotherhithe',
      address3: 'London',
      postcode: 'SE16 7GG',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Friend (demo guardian)',
    },
    {
      id: 'demo-reg-catherine-nancy',
      savedAt: ts,
      title: 'Mrs',
      firstName: 'Catherine',
      middleName: '',
      lastName: 'Nancy',
      email: 'catherine.nancy.demo@example.com',
      mobile: '07700988101',
      address1: 'Flat 12, Cedar Ridge',
      address2: '',
      address3: 'Birmingham',
      postcode: 'B16 0RP',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Sister (demo guardian)',
    },
    {
      id: 'demo-reg-charlie-nancy',
      savedAt: ts,
      title: 'Mr',
      firstName: 'Charlie',
      middleName: 'Scott',
      lastName: 'Nancy',
      email: 'charlie.nancy.demo@example.com',
      mobile: '07700988102',
      address1: 'Flat 12, Cedar Ridge',
      address2: '',
      address3: 'Birmingham',
      postcode: 'B16 0RP',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Brother-in-law (demo guardian)',
    },
  ];

  const guardianRowRowan = row({
    title: 'Mr',
    firstName: 'Rowan',
    middleName: 'Kai',
    lastName: 'Blake',
    dateOfBirth: '01/06/1981',
    gender: 'Male',
    mobile: '07700999110',
    email: 'rowan.blake.demo@example.com',
    address1: '7 Guardian Grove',
    address2: 'Rotherhithe',
    address3: 'London',
    postcode: 'SE16 7GG',
    occupation: 'Teacher — Will Tool demo',
    nationalityCountry: 'United Kingdom',
    countryOfResidence: 'United Kingdom',
    relationship: 'Friend',
  });
  const guardianRowSienna = row({
    title: 'Ms',
    firstName: 'Sienna',
    lastName: 'Blake',
    dateOfBirth: '15/08/1983',
    gender: 'Female',
    mobile: '07700999111',
    email: 'sienna.blake.demo@example.com',
    address1: '8 Guardian Grove',
    address2: 'Rotherhithe',
    address3: 'London',
    postcode: 'SE16 7GH',
    occupation: 'Architect — Will Tool demo',
    nationalityCountry: 'United Kingdom',
    countryOfResidence: 'United Kingdom',
    relationship: 'Friend',
  });
  const guardianRowCatherine = row({
    title: 'Mrs',
    firstName: 'Catherine',
    lastName: 'Nancy',
    dateOfBirth: '11/07/1982',
    gender: 'Female',
    mobile: '07700988101',
    email: 'catherine.nancy.demo@example.com',
    address1: 'Flat 12, Cedar Ridge',
    address2: '',
    address3: 'Birmingham',
    postcode: 'B16 0RP',
    occupation: 'Teacher — Will Tool demo',
    nationalityCountry: 'United Kingdom',
    countryOfResidence: 'United Kingdom',
    relationship: 'Sister',
  });
  const guardianRowCharlie = row({
    title: 'Mr',
    firstName: 'Charlie',
    middleName: 'Scott',
    lastName: 'Nancy',
    dateOfBirth: '03/05/1980',
    gender: 'Male',
    mobile: '07700988102',
    email: 'charlie.nancy.demo@example.com',
    address1: 'Flat 12, Cedar Ridge',
    address2: '',
    address3: 'Birmingham',
    postcode: 'B16 0RP',
    occupation: 'Engineer — Will Tool demo',
    nationalityCountry: 'United Kingdom',
    countryOfResidence: 'United Kingdom',
    relationship: 'Brother-in-law',
  });

  const guidedFlowChildrenSame = [
    {
      childFirstName: DEMO.children.son.firstName,
      childLastName: DEMO.children.son.lastName,
      dob: '2020-03-10',
      guardians: [],
    },
    {
      childFirstName: DEMO.children.daughter.firstName,
      childLastName: DEMO.children.daughter.lastName,
      dob: '2022-01-25',
      guardians: [],
    },
  ];

  const guidedFlowChildrenDifferent = [
    {
      childFirstName: DEMO.children.son.firstName,
      childLastName: DEMO.children.son.lastName,
      dob: '2020-03-10',
      guardians: [
        normalizeSourceToGuardianModalForm(guardianRowCatherine),
        normalizeSourceToGuardianModalForm(guardianRowCharlie),
      ],
    },
    {
      childFirstName: DEMO.children.daughter.firstName,
      childLastName: DEMO.children.daughter.lastName,
      dob: '2022-01-25',
      guardians: [
        normalizeSourceToGuardianModalForm(guardianRowRowan),
        normalizeSourceToGuardianModalForm(guardianRowSienna),
      ],
    },
  ];

  if (dummyData.appointGuardians === APPOINT_GUARDIANS_DIFFERENT) {
    dummyData.guardianData = [];
    dummyData.guardianshipDetailsData = buildGuardianshipDetailsClause(guidedFlowChildrenDifferent);
    dummyData.guardianFlowState = JSON.stringify({
      sameGuardians: [],
      children: guidedFlowChildrenDifferent,
      step: 2,
    });
  } else {
    dummyData.guardianData = [guardianRowRowan, guardianRowSienna];
    const sameModals = dummyData.guardianData.map((g) => normalizeSourceToGuardianModalForm(g));
    dummyData.guardianshipDetailsData = buildGuardianshipDetailsClauseSameGuardians(
      sameModals,
      guidedFlowChildrenSame,
    );
    dummyData.guardianFlowState = JSON.stringify({
      sameGuardians: sameModals,
      children: guidedFlowChildrenSame,
      step: 2,
    });
  }

  dummyData.substituteGuardianData = [
    row({
      title: 'Mr',
      firstName: 'Theo',
      lastName: 'Marsh',
      gender: 'Male',
      dateOfBirth: '20/04/1979',
      mobile: '07700999112',
      email: 'theo.marsh.demo@example.com',
      address1: '9 Substitute Street',
      address2: 'Deptford',
      address3: 'London',
      postcode: 'SE8 4HU',
      occupation: 'Engineer — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Uncle',
    }),
  ];

  /** Rich primary executors: ~22yo (1824 age-flow tier) + ~50yo (25+ — no per-row age questions). UK dd/mm/yyyy DOBs for executor age logic. */
  dummyData.chooseAristoneExecutor = 'Individual';
  dummyData.executorData = [
    row({
      title: 'Mr',
      firstName: 'David',
      lastName: 'Day',
      dateOfBirth: '15/06/2003',
      address1: '101 Executor Lane',
      address2: 'Hampstead',
      address3: 'London',
      postcode: 'NW3 9EX',
      mobile: '07700999199',
      email: 'david.day.demo@example.com',
      occupation: 'Teacher — Will Tool demo',
      relationship: 'Friend',
    }),
    row({
      title: 'Ms',
      firstName: 'Laura',
      lastName: 'Lake',
      dateOfBirth: '15/06/1975',
      address1: '102 Executor Lane',
      address2: 'Hampstead',
      address3: 'London',
      postcode: 'NW3 9EY',
      mobile: '07700999198',
      email: 'laura.lake.demo@example.com',
      occupation: 'Accountant — Will Tool demo',
      relationship: 'Sister',
    }),
  ];
  dummyData.substituteExecutorData = [ARISTONE_EXECUTOR_LINE];
  dummyData.professionalExecutorData = [ARISTONE_EXECUTOR_LINE];
  dummyData.substituteProfessionalExecutorData = [ARISTONE_EXECUTOR_LINE];
  dummyData.professionalTrusteeData = [ARISTONE_EXECUTOR_LINE];
  dummyData.substituteProfessionalTrusteeData = [ARISTONE_EXECUTOR_LINE];

  dummyData.digitalExecutorData = [
    row({
      title: 'Ms',
      firstName: 'Dana',
      lastName: 'Reyes',
      gender: 'Female',
      dateOfBirth: '03/09/1982',
      mobile: '07700111120',
      email: 'dana.reyes.demo@example.com',
      address1: '9 Digital Drive',
      address2: 'Croydon',
      address3: 'London',
      postcode: 'CR0 9DE',
      occupation: 'IT consultant — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Friend',
    }),
  ];
  dummyData.trusteeData = [
    row({
      title: 'Ms',
      firstName: 'Tracy',
      lastName: 'Okonkwo',
      gender: 'Female',
      dateOfBirth: '18/01/1976',
      mobile: '07700111121',
      email: 'tracy.okonkwo.demo@example.com',
      address1: '10 Trustee Terrace',
      address2: 'Ealing',
      address3: 'London',
      postcode: 'W5 1TR',
      occupation: 'Accountant — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Friend',
    }),
  ];
  dummyData.substituteTrusteeData = [
    row({
      title: 'Ms',
      firstName: 'Uma',
      lastName: 'Patel',
      gender: 'Female',
      dateOfBirth: '07/12/1979',
      mobile: '07700111122',
      email: 'uma.patel.demo@example.com',
      address1: '11 Trustee Terrace',
      address2: 'Ealing',
      address3: 'London',
      postcode: 'W5 1TS',
      occupation: 'Solicitor — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Sister',
    }),
  ];
  dummyData.witness1Data = [
    row({
      title: 'Ms',
      firstName: 'Wendy',
      lastName: 'Wainwright',
      gender: 'Female',
      dateOfBirth: '30/04/1968',
      mobile: '07700111130',
      email: 'wendy.w.demo@example.com',
      address1: '11 Witness-One Way',
      address2: 'Fulham',
      address3: 'London',
      postcode: 'SW6 1W1',
      occupation: 'Solicitor (demo W1)',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Friend',
    }),
  ];
  dummyData.witness2Data = [
    row({
      title: 'Mr',
      firstName: 'Winston',
      lastName: 'White',
      gender: 'Male',
      dateOfBirth: '12/02/1970',
      mobile: '07700111131',
      email: 'winston.w.demo@example.com',
      address1: '22 Witness-Two Road',
      address2: 'Putney',
      address3: 'London',
      postcode: 'SW15 2W2',
      occupation: 'Teacher (demo W2)',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Friend',
    }),
  ];
  {
    const exD = row({
      title: 'Mr',
      firstName: 'Evan',
      lastName: 'Excluded',
      middleName: '',
      knownAs: '',
      gender: 'Male',
      dateOfBirth: '25/11/1988',
      address1: '99 Excluded Lane',
      address2: 'Tooting',
      address3: 'London',
      postcode: 'SW17 9EX',
      mobile: '07700111140',
      email: 'evan.excluded.demo@example.com',
      occupation: 'Consultant — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Former partner',
    });
    exD.exclusionReason = 'No contact for several years — Will Tool demo';
    dummyData.excludedPersonData = [exD];
  }
  dummyData.chattelRecipientData = [
    row({
      title: 'Ms',
      firstName: 'Chloe',
      lastName: 'Chattels',
      gender: 'Female',
      dateOfBirth: '05/05/1985',
      mobile: '07700111141',
      email: 'chloe.chattels.demo@example.com',
      address1: '12 Chattels Close',
      address2: 'Richmond',
      address3: 'Surrey',
      postcode: 'TW9 1CH',
      occupation: 'Designer — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Friend',
    }),
  ];
  {
    const debtRow = row({
      title: 'Mr',
      firstName: 'Darren',
      lastName: 'Debtor',
      gender: 'Male',
      dateOfBirth: '14/08/1974',
      mobile: '07700111142',
      email: 'darren.debtor.demo@example.com',
      address1: '13 Debtor Street',
      address2: 'Wimbledon',
      address3: 'London',
      postcode: 'SW19 1DB',
      occupation: 'Contractor — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Former colleague',
    });
    debtRow._debtId = 'demo-pch-debt-1';
    debtRow.debtAmount = '£2,500';
    debtRow.debtNotes = 'Informal loan — Will Tool demo';
    dummyData.debtorData = [debtRow];
  }

  // Personal chattels guided UI + clauses — always set after chattel/debt person rows
  dummyData.unspecifiedChattelsAction = 'SpecificRecipient';
  dummyData.chattelGuidedRecipientName = 'Chloe Chattels';
  dummyData.chattelGuidedRecipientRelationship = 'Friend';
  dummyData.chattelGuidedPick = '';
  dummyData.chattelsInheritanceTax = 'PaidByEstate';
  dummyData.produceMemorandum = 'Yes';
  dummyData.personalChattelsGift = 'Beneficiary';
  dummyData.chattelsGiftBeneficiaryName = 'Chloe Chattels';
  dummyData.chattelsGiftBeneficiaryRelationship = 'Friend';
  dummyData.chattelGiftPick = '';
  dummyData.forgiveDebt = 'Yes';
  dummyData.relieveDebts = 'Yes';
  dummyData.deliberatelyExcludingAnyone = 'Yes';
  dummyData.spouseBenefitOnDivorce = 'No';
  dummyData.stopGiftToChildrenOnFail = 'No';
  dummyData.signingOnBehalfData = [
    row({
      title: 'Ms',
      firstName: 'Sally',
      lastName: 'Signer',
      gender: 'Female',
      dateOfBirth: '03/11/1965',
      mobile: '07700111143',
      email: 'sally.signer.demo@example.com',
      address1: '14 Signer Place',
      address2: 'Hammersmith',
      address3: 'London',
      postcode: 'W6 1SG',
      occupation: 'Attorney — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Attorney',
    }),
  ];
  dummyData.interpreterData = [
    row({
      title: 'Ms',
      firstName: 'Ingrid',
      lastName: 'Interpreter',
      gender: 'Female',
      dateOfBirth: '19/07/1980',
      mobile: '07700111144',
      email: 'ingrid.interpreter.demo@example.com',
      address1: '15 Interpreter Inn',
      address2: 'Acton',
      address3: 'London',
      postcode: 'W3 1IN',
      occupation: 'Interpreter — Will Tool demo',
      nationalityCountry: 'United Kingdom',
      countryOfResidence: 'United Kingdom',
      relationship: 'Friend',
    }),
  ];

  dummyData.petCarerData = [
    row({
      ...DEMO.petCarer,
      middleName: '',
      occupation: 'Retail manager — Will Tool demo',
  }),
  ];
  dummyData.substitutePetCarerData = [
    row({
      ...DEMO.petCarerSub,
      middleName: '',
      occupation: 'Engineer — Will Tool demo',
    }),
  ];
  dummyData.separateTrusteeData = [
    row({
      title: DEMO.flitTrusteeA.title,
      firstName: DEMO.flitTrusteeA.firstName,
      middleName: '',
      lastName: DEMO.flitTrusteeA.lastName,
      gender: DEMO.flitTrusteeA.gender,
      dateOfBirth: DEMO.flitTrusteeA.dateOfBirth,
      mobile: DEMO.flitTrusteeA.mobile,
      email: DEMO.flitTrusteeA.email,
      address1: DEMO.flitTrusteeA.address1,
      address2: DEMO.flitTrusteeA.address2,
      address3: DEMO.flitTrusteeA.address3,
      postcode: DEMO.flitTrusteeA.postcode,
      occupation: 'Director — Will Tool demo',
      relationship: DEMO.flitTrusteeA.relationship,
      relationshipToTestator: DEMO.flitTrusteeA.relationshipToTestator,
    }),
    row({
      title: DEMO.flitTrusteeB.title,
      firstName: DEMO.flitTrusteeB.firstName,
      middleName: '',
      lastName: DEMO.flitTrusteeB.lastName,
      gender: DEMO.flitTrusteeB.gender,
      dateOfBirth: DEMO.flitTrusteeB.dateOfBirth,
      mobile: DEMO.flitTrusteeB.mobile,
      email: DEMO.flitTrusteeB.email,
      address1: DEMO.flitTrusteeB.address1,
      address2: DEMO.flitTrusteeB.address2,
      address3: DEMO.flitTrusteeB.address3,
      postcode: DEMO.flitTrusteeB.postcode,
      occupation: 'Analyst — Will Tool demo',
      relationship: DEMO.flitTrusteeB.relationship,
      relationshipToTestator: DEMO.flitTrusteeB.relationshipToTestator,
    }),
  ];

  if (dummyData.hasBusinessInterests === 'Yes' && dummyData.appointSeparateBusinessTrustee === 'Yes') {
    const g = DEMO.businessTrusteeGuided;
    dummyData.businessSeparateTrusteeRecordId = g.recordId;
    dummyData.businessSeparateTrusteeFirstName = g.firstName;
    dummyData.businessSeparateTrusteeLastName = g.lastName;
    dummyData.businessSeparateTrusteeEmail = g.email;
    dummyData.businessSeparateTrusteeRelationship = g.relationship;
    dummyData.businessSeparateTrusteeAddress1 = g.address1;
    dummyData.businessSeparateTrusteeTown = g.town;
    dummyData.businessSeparateTrusteePostcode = g.postcode;
    dummyData.separateTrusteeData = [
      ...(dummyData.separateTrusteeData || []),
      {
        title: '',
        firstName: g.firstName,
        middleName: '',
        lastName: g.lastName,
        email: g.email,
        relationship: g.relationship,
        address1: g.address1,
        address2: '',
        address3: g.town,
        postcode: g.postcode,
        gender: '',
        dateOfBirth: '',
        occupation: '',
        mobile: '',
        _businessGuidedCapture: true,
        _personRecordId: g.recordId,
      },
    ];
  }

  if (dummyData.nationalityCountry == null || dummyData.nationalityCountry === '' || dummyData.nationalityCountry === 'Standard value') {
    dummyData.nationalityCountry = 'United Kingdom';
  }
  if (dummyData.countryOfResidence == null || dummyData.countryOfResidence === '' || dummyData.countryOfResidence === 'Standard value') {
    dummyData.countryOfResidence = 'United Kingdom';
  }

  if (dummyData.hasBusinessInterests === 'Yes') {
    dummyData.businessInterestType = dummyData.businessInterestType || 'ltd-shares';
    dummyData.businessInterestValueRange = dummyData.businessInterestValueRange || '250k-1m';
    dummyData.shareholderAgreementInPlace = dummyData.shareholderAgreementInPlace || 'Unsure';
  }

  console.log('[AUTOFILL GENERATE] 🧑‍🤝‍🧑 Rich person demo pass:', {
    contactRegistryEntries: dummyData[CONTACT_REGISTRY_KEY]?.length ?? 0,
    appointGuardians: dummyData.appointGuardians,
    guardianFlowStateBytes: typeof dummyData.guardianFlowState === 'string' ? dummyData.guardianFlowState.length : 0,
    guardianshipDetailsPreview:
      typeof dummyData.guardianshipDetailsData === 'string'
        ? `${dummyData.guardianshipDetailsData.slice(0, 120)}…`
        : dummyData.guardianshipDetailsData,
    guardianRows: Array.isArray(dummyData.guardianData) ? dummyData.guardianData.length : 0,
    executorRows: Array.isArray(dummyData.executorData) ? dummyData.executorData.length : 0,
    professionalExecutorRows: Array.isArray(dummyData.professionalExecutorData) ? dummyData.professionalExecutorData.length : 0,
    witnessRows: (Array.isArray(dummyData.witness1Data) ? dummyData.witness1Data.length : 0) + (Array.isArray(dummyData.witness2Data) ? dummyData.witness2Data.length : 0),
  });
}

export const generateDummyFormData = (formData) => {
  if (import.meta.env.DEV) {
    console.log(
      '[AUTOFILL GENERATE] start — this runs only when FormRenderer autofill is triggered (home / or matter form). It does not run from /solicitor dashboard matters list.',
      { phase: 'autofill_generate_start' },
    );
  }
  console.log('[AUTOFILL GENERATE] ========== GENERATING DUMMY DATA ==========');
  const dummyData = {};

  if (!formData || !formData.formSections) {
    console.error('[AUTOFILL GENERATE] ❌ Invalid form data structure:', {
      hasFormData: !!formData,
      hasFormSections: !!(formData && formData.formSections)
    });
    return dummyData;
  }

  const fieldById = buildFieldByIdMap(formData);
  
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
    /** Exercises GuardianFlow step 1→2 + per-child lists (matches Mariyam review scenario). */
    appointGuardians: APPOINT_GUARDIANS_DIFFERENT,
    /** Primary executors = individuals (rich rows + DOB) so executor age flow can render; professional Aristone remains via appointProfessionalExecutor below. */
    chooseAristoneExecutor: 'Individual',
    chooseAristoneSubstituteExecutor: 'Aristone',
    appointProfessionalExecutor: 'Yes',
    professionalExecutorSelection: 'Aristone',
    substituteProfessionalExecutorSelection: 'Aristone',
    digitalAssetsWantManagement: 'Yes',
    digitalAssetsWhoManages: 'MyExecutors',
    appointDifferentTrustees: 'No',
    bprTrustClientIntent: 'Yes',
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
    leavePetCareFund: 'Yes',
    personalGiftToPetCarer: 'Yes',
    relieveDebts: 'Yes',
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
    powerToRevokeLifeInterest: 'Yes',
    appointSeparateTrusteesFLIT: 'Yes', // Changed from 'No' to unlock separate trustees FLIT section
    gender: 'Male',
    estateApproxValue: ESTATE_DEMO.approxValue,
    estateApproxLiabilities: ESTATE_DEMO.approxLiabilities,
    estateOwnProperty: ESTATE_DEMO.ownProperty,
    estateBusinessInterests: ESTATE_DEMO.businessInterests,
    partnerTitle: 'Mrs',
    partnerGender: 'Female',
    /** Personal chattels (guided) — same as personalChattelsGuided + applyRichPersonDemoOverrides */
    chattelGuidedRecipientName: 'Chloe Chattels',
    chattelGuidedRecipientRelationship: 'Friend',
    chattelGuidedPick: '',
    chattelsGiftBeneficiaryName: 'Chloe Chattels',
    chattelsGiftBeneficiaryRelationship: 'Friend',
    chattelGiftPick: '',
  };

  // Get value for a field - used in recursive processing
  const getFieldValue = (field) => {
    if (unlockEverything[field.id] !== undefined) {
      return unlockEverything[field.id];
    }

    switch (field.type) {
      case 'radio':
      case 'select':
        if (field.id === 'estateApproxValue') return ESTATE_DEMO.approxValue;
        if (field.id === 'estateApproxLiabilities') return ESTATE_DEMO.approxLiabilities;
        if (field.id === 'estateOwnProperty') return ESTATE_DEMO.ownProperty;
        if (field.id === 'estateBusinessInterests') return ESTATE_DEMO.businessInterests;
        if (field.id === 'partnerTitle') return DEMO.partner.title;
        if (field.id === 'partnerGender') return DEMO.partner.gender;
        if (field.id === 'organDonationPreference') return 'YesButOnly';
        return getYesOption(field) || getFirstOption(field);

      case 'text':
        if (field.id === 'firstName') return DEMO.testator.firstName;
        if (field.id === 'lastName') return DEMO.testator.lastName;
        if (field.id === 'middleName') return DEMO.testator.middleName;
        if (field.id === 'knownAs') return DEMO.testator.knownAs;
        if (field.id === 'alias') return 'M. J. Ellwood';
        if (field.id === 'partnerFullName') return DEMO.partner.fullName;
        if (field.id === 'partnerFirstName') return DEMO.partner.firstName;
        if (field.id === 'partnerMiddleName') return DEMO.partner.middleName;
        if (field.id === 'partnerLastName') return DEMO.partner.lastName;
        if (field.id === 'partnerKnownAs') return DEMO.partner.knownAs || 'Ellie';
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
        if (field.id === 'estateApproxValue') return ESTATE_DEMO.approxValue;
        if (field.id === 'estateApproxLiabilities') return ESTATE_DEMO.approxLiabilities;
        if (field.id === 'minimumCharityAmountValue') return '50000';
        if (field.id === 'stepProvisionToExcludeOne') return '1';
        if (field.id === 'stepProvisionsToExcludeMultiple') return '1, 2 & 3';
        {
          const lab = (field.label || field.id || 'field').replace(/[[\]]/g, '');
          return `Demo autofill: ${lab}.${DEMO_TEXT_TAG}`;
        }

      case 'textarea':
        if (field.id.includes('charity') || field.id === 'charityBenefitDetails') return 'Cancer Research UK (Charity No. 1089464); British Heart Foundation (Charity No. 225971); Macmillan Cancer Support (Charity No. 261017)';
        if (field.id.includes('monetaryGiftsDetails')) {
          return `I give £25,000 to my son ${DEMO.children.son.firstName} ${DEMO.children.son.lastName} when he reaches 25. I give £15,000 to my daughter ${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName} when she reaches 21.${DEMO_TEXT_TAG}`;
        }
        if (field.id.includes('specificGiftsDetails')) {
          return `I give my grandfather's gold pocket watch to ${DEMO.children.son.firstName} ${DEMO.children.son.lastName}. I give my oil paintings to ${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName}.${DEMO_TEXT_TAG}`;
        }
        if (field.id.includes('propertyGiftsDetails')) {
          return `I give my property at ${DEMO.testator.address1}, ${DEMO.testator.postcode} to my wife ${DEMO.partner.fullName} absolutely.${DEMO_TEXT_TAG}`;
        }
        if (field.id.includes('propertyTrustDetails')) return `my property at ${DEMO.testator.address1}, ${DEMO.testator.postcode}`;
        if (field.id.includes('propertyTrustTerms')) return 'The trustees shall have full power to manage, maintain, repair, improve, and if necessary sell the property. All rental income shall be paid to the life tenant during their lifetime.';
        if (field.id.includes('bprTrustDetails')) return 'My business interests in Mitchell & Associates Ltd (Company No. 12345678) shall be held in trust.';
        if (field.id.includes('bprTrustTerms')) return 'The business property relief trust shall operate according to standard terms. The trustees shall have full power to manage the business or sell the business interests as they see fit.';
        if (field.id.includes('furtherResidualGiftsDetails')) {
          return `If any of the above gifts fail, I give the failed share equally to my siblings ${DEMO.siblings.brother.firstName} ${DEMO.siblings.brother.lastName} and ${DEMO.siblings.sister.firstName} ${DEMO.siblings.sister.lastName}.${DEMO_TEXT_TAG}`;
        }
        if (field.id.includes('residualGiftsDetails')) {
          return `I give 50% of my residuary estate to ${DEMO.partner.fullName} absolutely, 25% to ${DEMO.children.son.firstName} ${DEMO.children.son.lastName}, 25% to ${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName}.${DEMO_TEXT_TAG}`;
        }
        if (field.id.includes('specifyLoansGiftsText')) {
          return `I loaned £10,000 to ${DEMO.children.son.firstName} ${DEMO.children.son.lastName} in January 2022 for a house purchase.${DEMO_TEXT_TAG}`;
        }
        if (field.id.includes('lifeTenantDetails')) return `My wife ${DEMO.partner.fullName}`;
        if (field.id.includes('beneficiariesDetails')) {
          return `${DEMO.children.son.firstName} ${DEMO.children.son.lastName} and ${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName}`;
        }
        if (field.id.includes('trustEndDistributionDetails')) {
          return `Upon the death of the life tenant, the trust passes equally to ${DEMO.children.son.firstName} ${DEMO.children.son.lastName} and ${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName}.${DEMO_TEXT_TAG}`;
        }
        if (field.id.includes('funeralWishes')) return 'I wish for a simple cremation service. Please ensure all family members and close friends are informed in advance.';
        if (field.id.includes('otherFuneralRequirements')) return 'My ashes are to be scattered in the garden of remembrance at Golders Green Crematorium.';
        if (field.id.includes('physicalHealthDescription')) return 'The testator is in good physical and mental health and fully understands the nature and effect of this Will.';
        {
          const lab = (field.label || field.id || 'field').replace(/[[\]]/g, '');
          return `Demo autofill: ${lab}.${DEMO_TEXT_TAG}`;
        }

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
        if (field.id === 'aristoneProfessionalFeesAck') return [...ESTATE_DEMO.feesAck];
        return field.options ? field.options.map((o) => o.id || o.value).filter(Boolean) : [];

      case 'signature':
        return AUTOFILL_DEMO_ID_IMAGE_DATA_URL;

      default:
        return null;
    }
  };

  /** Rich person rows for processFields (e.g. personalChattelsGuided). Matches applyRichPersonDemoOverrides / PersonRecord shape. */
  let autofillPersonSeq = 0;
  const row = (fields) => ({
    middleName: '',
    gender: 'Male',
    dateOfBirth: '15/06/1975',
    occupation: 'Professional — Will Tool demo',
    relationship: 'Friend',
    ...fields,
    _personRecordId: `autofill-demo-${++autofillPersonSeq}`,
  });

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
      if (field._hiddenFromClient) {
        skippedCount++;
        return;
      }
      if (field.type === 'monetaryGiftsList') {
        const list = [
          {
            id: 'demo-mg-1',
            recipientName: `${DEMO.children.son.firstName} ${DEMO.children.son.lastName}`,
            recipientRelationship: 'son',
            amount: 25000,
            conditionKey: 'age-25',
            conditionLabel: 'Only when they reach the age of 25',
            lapseKey: 'residue',
            lapseLabel: 'Falls into the residue of my estate (default)',
          },
          {
            id: 'demo-mg-2',
            recipientName: `${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName}`,
            recipientRelationship: 'daughter',
            amount: 15000,
            conditionKey: 'age-21',
            conditionLabel: 'Only when they reach the age of 21',
            lapseKey: 'residue',
            lapseLabel: 'Falls into the residue of my estate (default)',
          },
        ];
        dummyData.monetaryGiftsList = list;
        dummyData.monetaryGiftsDetails = `${formatMonetaryGiftsDetailsFromList(list)}${DEMO_TEXT_TAG}`;
        processedCount += 2;
        return;
      }
      if (field.type === 'specificGiftsList') {
        const list = [
          {
            id: 'demo-sg-1',
            itemDescription: "my grandfather's gold pocket watch",
            itemType: 'jewellery',
            itemTypeLabel: 'Jewellery or watches',
            itemLocation: 'At my home in the bedroom safe',
            recipientName: `${DEMO.children.son.firstName} ${DEMO.children.son.lastName}`,
            recipientRelationship: 'son',
            conditionKey: '',
            conditionLabel: 'None',
            lapseKey: 'residue',
            lapseLabel: 'Falls into the residue of my estate (default)',
          },
          {
            id: 'demo-sg-2',
            itemDescription: 'my collection of family oil paintings (listed in schedule to be provided)',
            itemType: 'artwork',
            itemTypeLabel: 'Artwork or antiques',
            itemLocation: '',
            recipientName: `${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName}`,
            recipientRelationship: 'daughter',
            conditionKey: '',
            conditionLabel: 'None',
            lapseKey: 'residue',
            lapseLabel: 'Falls into the residue of my estate (default)',
          },
        ];
        dummyData.specificGiftsList = list;
        dummyData.specificGiftsDetails = `${formatSpecificGiftsDetailsFromList(list)}${DEMO_TEXT_TAG}`;
        processedCount += 2;
        return;
      }
      if (field.type === 'propertyGiftsGuided') {
        const list = [
          {
            id: 'demo-pg-1',
            addressLine1: DEMO.testator.address1,
            addressLine2: DEMO.testator.address2 || '',
            town: DEMO.testator.address3 || '',
            postcode: DEMO.testator.postcode,
            tenure: 'freehold',
            hasMortgage: 'no',
            mortgageInstruction: '',
            recipientName: DEMO.partner.fullName,
            recipientRelationship: 'Partner / spouse',
            conditionKey: '',
            conditionLabel: 'None',
            lapseKey: 'residue',
            lapseLabel: 'Falls into the residue of my estate (default)',
          },
        ];
        dummyData.leavePropertyGifts = 'Yes';
        dummyData.failedPropertyGiftPassProportionately = 'Yes';
        dummyData.propertyGiftsList = list;
        dummyData.propertyGiftsDetails = `${formatPropertyGiftsDetailsFromList(list)}${DEMO_TEXT_TAG}`;
        processedCount += 4;
        return;
      }
      if (field.type === 'propertyTrustGuided') {
        const props = [
          {
            id: 'demo-pt-1',
            addressLine1: DEMO.testator.address1,
            addressLine2: DEMO.testator.address2 || '',
            town: DEMO.testator.address3 || '',
            postcode: DEMO.testator.postcode,
            tenure: 'freehold',
          },
        ];
        dummyData.includePropertyTrust = 'Yes';
        dummyData.propertyTrustType = 'life-interest';
        dummyData.propertyTrustLifeTenantFirstName = DEMO.partner.firstName;
        dummyData.propertyTrustLifeTenantLastName = DEMO.partner.lastName;
        dummyData.propertyTrustLifeTenantName = `${DEMO.partner.firstName} ${DEMO.partner.lastName}`.trim();
        dummyData.propertyTrustLifeTenantRelationship = 'spouse';
        dummyData.propertyTrustPropertiesList = props;
        const summaryBase = formatPropertyTrustClientSummaryFromState({
          ...dummyData,
          includePropertyTrust: 'Yes',
          propertyTrustType: 'life-interest',
          propertyTrustLifeTenantFirstName: DEMO.partner.firstName,
          propertyTrustLifeTenantLastName: DEMO.partner.lastName,
          propertyTrustLifeTenantRelationship: 'spouse',
          propertyTrustPropertiesList: props,
        });
        dummyData.propertyTrustClientSummary = `${summaryBase}${DEMO_TEXT_TAG}`;
        processedCount += 6;
        return;
      }
      if (field.type === 'personalChattelsGuided') {
        dummyData.unspecifiedChattelsAction = 'SpecificRecipient';
        dummyData.chattelGuidedRecipientName = 'Chloe Chattels';
        dummyData.chattelGuidedRecipientRelationship = 'Friend';
        dummyData.chattelGuidedPick = '';
        dummyData.chattelRecipientData = [
          row({
            title: 'Ms',
            firstName: 'Chloe',
            lastName: 'Chattels',
            gender: 'Female',
            dateOfBirth: '05/05/1985',
            mobile: '07700111141',
            email: 'chloe.chattels.demo@example.com',
            address1: '12 Chattels Close',
            address2: 'Richmond',
            address3: 'Surrey',
            postcode: 'TW9 1CH',
            occupation: 'Designer — Will Tool demo',
            nationalityCountry: 'United Kingdom',
            countryOfResidence: 'United Kingdom',
            relationship: 'Friend',
          }),
        ];
        dummyData.chattelsInheritanceTax = 'PaidByEstate';
        dummyData.produceMemorandum = 'Yes';
        dummyData.personalChattelsGift = 'Beneficiary';
        dummyData.chattelsGiftBeneficiaryName = 'Chloe Chattels';
        dummyData.chattelsGiftBeneficiaryRelationship = 'Friend';
        dummyData.chattelGiftPick = '';
        dummyData.forgiveDebt = 'Yes';
        dummyData.relieveDebts = 'Yes';
        const debt = row({
          title: 'Mr',
          firstName: 'Darren',
          lastName: 'Debtor',
          gender: 'Male',
          dateOfBirth: '14/08/1974',
          mobile: '07700111142',
          email: 'darren.debtor.demo@example.com',
          address1: '13 Debtor Street',
          address2: 'Wimbledon',
          address3: 'London',
          postcode: 'SW19 1DB',
          occupation: 'Contractor — Will Tool demo',
          nationalityCountry: 'United Kingdom',
          countryOfResidence: 'United Kingdom',
          relationship: 'Former colleague',
        });
        debt._debtId = 'demo-pch-debt-1';
        debt.debtAmount = '£2,500';
        debt.debtNotes = 'Informal loan — Will Tool demo';
        dummyData.debtorData = [debt];
        processedCount += 12;
        return;
      }
      if (field.type === 'deliberateExclusionsGuided') {
        const ex = row({
          title: 'Mr',
          firstName: 'Evan',
          lastName: 'Excluded',
          middleName: '',
          knownAs: '',
          gender: 'Male',
          dateOfBirth: '25/11/1988',
          address1: '99 Excluded Lane',
          address2: 'Tooting',
          address3: 'London',
          postcode: 'SW17 9EX',
          mobile: '07700111140',
          email: 'evan.excluded.demo@example.com',
          occupation: 'Consultant — Will Tool demo',
          nationalityCountry: 'United Kingdom',
          countryOfResidence: 'United Kingdom',
          relationship: 'Former partner',
        });
        ex.exclusionReason = 'No contact for several years — Will Tool demo';
        dummyData.deliberatelyExcludingAnyone = 'Yes';
        dummyData.excludedPersonData = [ex];
        dummyData.spouseBenefitOnDivorce = 'No';
        dummyData.stopGiftToChildrenOnFail = 'No';
        processedCount += 4;
        return;
      }
      if (field.type === 'otherProvisionsGuided') {
        /** Mariyam / Aristone — full “Other Provisions” guided path: pets + care fund + gift to carer + RSPCA + debts released (PersonRecord-shaped rows). */
        dummyData.provisionsForPets = 'Yes';
        dummyData.petCarerData = [
          row({
            title: DEMO.petCarer.title,
            firstName: DEMO.petCarer.firstName,
            lastName: DEMO.petCarer.lastName,
            relationship: DEMO.petCarer.relationship,
            address1: DEMO.petCarer.address1,
            address2: DEMO.petCarer.address2,
            address3: DEMO.petCarer.address3,
            postcode: DEMO.petCarer.postcode,
            mobile: DEMO.petCarer.mobile,
            email: DEMO.petCarer.email,
            dateOfBirth: DEMO.petCarer.dateOfBirth,
            gender: DEMO.petCarer.gender,
            middleName: '',
            occupation: 'Retail manager — Will Tool demo',
            nationalityCountry: 'United Kingdom',
            countryOfResidence: 'United Kingdom',
          }),
        ];
        dummyData.substitutePetCarer = 'Yes';
        dummyData.substitutePetCarerData = [
          row({
            title: DEMO.petCarerSub.title,
            firstName: DEMO.petCarerSub.firstName,
            lastName: DEMO.petCarerSub.lastName,
            relationship: DEMO.petCarerSub.relationship,
            address1: DEMO.petCarerSub.address1,
            address2: DEMO.petCarerSub.address2,
            address3: DEMO.petCarerSub.address3,
            postcode: DEMO.petCarerSub.postcode,
            mobile: DEMO.petCarerSub.mobile,
            email: DEMO.petCarerSub.email,
            dateOfBirth: DEMO.petCarerSub.dateOfBirth,
            gender: DEMO.petCarerSub.gender,
            middleName: '',
            occupation: 'Engineer — Will Tool demo',
            nationalityCountry: 'United Kingdom',
            countryOfResidence: 'United Kingdom',
          }),
        ];
        dummyData.petsCaredForByRSPCA = 'No';
        dummyData.leavePetCareFund = 'Yes';
        dummyData.amountToLeaveForPetCare = '5000';
        dummyData.petCarerGift = '5000';
        dummyData.personalGiftToPetCarer = 'Yes';
        dummyData.petCarerPersonalGift = '500';
        dummyData.relieveDebts = 'Yes';
        dummyData.forgiveDebt = 'Yes';
        {
          const debt = row({
            title: 'Mr',
            firstName: 'Darren',
            lastName: 'Debtor',
            gender: 'Male',
            dateOfBirth: '14/08/1974',
            mobile: '07700111142',
            email: 'darren.debtor.demo@example.com',
            address1: '13 Debtor Street',
            address2: 'Wimbledon',
            address3: 'London',
            postcode: 'SW19 1DB',
            occupation: 'Contractor — Will Tool demo',
            nationalityCountry: 'United Kingdom',
            countryOfResidence: 'United Kingdom',
            relationship: 'Former colleague',
          });
          debt._debtId = 'opg-demo-debt-1';
          debt.debtAmount = '£2,500';
          debt.debtNotes = 'Informal loan noted for executors — Will Tool demo.';
          dummyData.debtorData = [debt];
        }
        processedCount += 18;
        return;
      }
      if (field.type === 'administrativeProvisionsGuided') {
        /** Mariyam handoff — all five questions + same strings used for will/PDF. */
        dummyData.includeReceiptByMinors = 'Yes';
        dummyData.includeCypresClause = 'Yes';
        dummyData.bringLifetimeGiftsIntoAccount = 'Yes';
        dummyData.specifyLifetimeLoansGifts = 'Yes';
        dummyData.specifyLoansGiftsText = `I wish my executors to be aware of a loan of £10,000 to ${DEMO.children.son.firstName} ${DEMO.children.son.lastName} in March 2019 for a house purchase; not repaid. Bring into account for residue if appropriate.${DEMO_TEXT_TAG}`;
        dummyData.stepProvisionsApply = 'AllStandardSpecialInclude';
        dummyData.excludeSpecificStepProvisions = 'No';
        dummyData.stepProvisionToExcludeOne = '';
        dummyData.stepProvisionsToExcludeMultiple = '';
        processedCount += 9;
        return;
      }
      if (field.type === 'estateResidueGuided') {
        /** FLIT path: align with `unlockEverything` (separate FLIT trustees) + `applyRichPersonDemoOverrides` trustee rows. */
        dummyData.howResidueDistributed = 'IntoFLIT';
        dummyData.powerToRevokeLifeInterest = 'Yes';
        dummyData.appointSeparateTrusteesFLIT = 'Yes';
        dummyData.flitLifeTenantName = `${DEMO.partner.firstName} ${DEMO.partner.lastName}`.trim();
        dummyData.flitLifeTenantRel = 'spouse / civil partner — Will Tool demo';
        dummyData.lifeTenantDetails = `${dummyData.flitLifeTenantName} (${dummyData.flitLifeTenantRel})`;
        dummyData.beneficiariesDetails = `${DEMO.children.son.firstName} ${DEMO.children.son.lastName} and ${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName} in equal shares.`;
        dummyData.flitTrustEndMode = 'to-beneficiaries';
        dummyData._flitTrustEndMode = 'to-beneficiaries';
        dummyData.trustEndDistributionDetails =
          'Equally to the trust beneficiaries named above (or as my solicitor shall confirm in the will).';
        dummyData.residualGiftsDetails = '';
        dummyData.specifyFurtherResidualGiftsOnFail = 'No';
        dummyData.furtherResidualGiftsDetails = '';
        dummyData.furtherResidualFallbackRows = [];
        dummyData.failedResiduePassProportionately = '';
        dummyData.give10PercentToCharity = 'No';
        dummyData.charityGiftOnlyIfIHTDue = '';
        dummyData.splitCharitableGift = '';
        dummyData.charityBenefitDetails = '';
        dummyData.minimumCharityAmount = '';
        dummyData.minimumCharityAmountValue = '';
        dummyData.howIHTDealtWithSplitting = 'BeforeTax';
        processedCount += 18;
        return;
      }
      if (field.type === 'guardianFlow') {
        return;
      }
      if (field.type === 'businessInterestsGuided') {
        dummyData.hasBusinessInterests = dummyData.hasBusinessInterests || 'Yes';
        dummyData.trusteePowerCarryOnBusiness = dummyData.trusteePowerCarryOnBusiness || 'Yes';
        dummyData.appointSeparateBusinessTrustee = dummyData.appointSeparateBusinessTrustee || 'Yes';
        dummyData.businessInterestType = dummyData.businessInterestType || 'ltd-shares';
        dummyData.businessInterestValueRange = dummyData.businessInterestValueRange || '250k-1m';
        dummyData.shareholderAgreementInPlace = dummyData.shareholderAgreementInPlace || 'Unsure';
        dummyData.bprTrustClientIntent = dummyData.bprTrustClientIntent || 'Yes';
        processedCount += 1;
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
            else if (sub.id === 'professionalExecutorData' || sub.id === 'substituteProfessionalExecutorData' || sub.id === 'professionalTrusteeData' || sub.id === 'substituteProfessionalTrusteeData') {
              dummyData[sub.id] = [ARISTONE_EXECUTOR_LINE];
              console.log(`[AUTOFILL GENERATE] ✅ Set ${sub.id} = Aristone professional line`);
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
    /** Overwritten by applyRichPersonDemoOverrides with rich rows + Individual quick pick */
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

    professionalExecutorData: [ARISTONE_EXECUTOR_LINE],
    substituteProfessionalExecutorData: [ARISTONE_EXECUTOR_LINE],
    professionalTrusteeData: [ARISTONE_EXECUTOR_LINE],
    substituteProfessionalTrusteeData: [ARISTONE_EXECUTOR_LINE],

    nationalityCountry: 'United Kingdom',
    countryOfResidence: 'United Kingdom',

    chattelsGiftBeneficiaryName: 'Chloe Chattels',

    address1: DEMO.testator.address1,
    address2: DEMO.testator.address2,
    address3: DEMO.testator.address3,
    postcode: DEMO.testator.postcode,
    partnerAddress1: DEMO.partner.address1,
    partnerAddress2: DEMO.partner.address2,
    partnerAddress3: DEMO.partner.address3,
    partnerPostcode: DEMO.partner.postcode,
    partnerTitle: DEMO.partner.title,
    partnerFirstName: DEMO.partner.firstName,
    partnerMiddleName: DEMO.partner.middleName,
    partnerLastName: DEMO.partner.lastName,
    partnerKnownAs: DEMO.partner.knownAs || '',
    partnerDateOfBirth: DEMO.partner.dateOfBirth,
    partnerGender: DEMO.partner.gender,
    partnerMobile: DEMO.partner.mobile,
    partnerTel2: DEMO.partner.tel2,
    partnerEmail: DEMO.partner.email,
    partnerOccupation: DEMO.partner.occupation,
    partnerNationalityCountry: DEMO.partner.nationalityCountry,
    partnerCountryOfResidence: DEMO.partner.countryOfResidence,
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

    specificGiftsDetails: `I give my grandfather's gold pocket watch to ${DEMO.children.son.firstName} ${DEMO.children.son.lastName}. I give my oil paintings to ${DEMO.children.daughter.firstName} ${DEMO.children.daughter.lastName}.${DEMO_TEXT_TAG}`,
    propertyGiftsDetails: `I give my property at ${DEMO.testator.address1}, ${DEMO.testator.postcode} to my wife ${DEMO.partner.fullName} absolutely.${DEMO_TEXT_TAG}`,
    propertyTrustDetails: `my property at ${DEMO.testator.address1}, ${DEMO.testator.postcode}`,
    propertyTrustTerms: 'The trustees shall have full power to manage, maintain, repair, improve, and if necessary sell the property. All rental income shall be paid to the life tenant during their lifetime.',
    bprTrustDetails: 'My business interests in Mitchell & Associates Ltd (Company No. 12345678) shall be held in trust.',
    bprTrustTerms: 'The business property relief trust shall operate according to standard terms. The trustees shall have full power to manage the business or sell the business interests as they see fit.',
    /** Residuary / FLIT / charity gift details — owned by `estateResidueGuided` autofill when that block runs. */
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
    petCarerPersonalGift: '500',
    leavePetCareFund: 'Yes',
    personalGiftToPetCarer: 'Yes',
    minimumCharityAmountValue: '100000',
    willExecutionDate: new Date().toISOString().split('T')[0],
    nativeLanguage: 'English',
    foreignWillLocation: 'France',
    executorSpecifyAge: 25,
    aristoneProfessionalFeesAck: [...ESTATE_DEMO.feesAck],
    estateApproxValue: ESTATE_DEMO.approxValue,
    estateApproxLiabilities: ESTATE_DEMO.approxLiabilities,
    estateOwnProperty: ESTATE_DEMO.ownProperty,
    estateBusinessInterests: ESTATE_DEMO.businessInterests,
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
  const GUIDED_SHELL_FIELD_TYPES = new Set([
    'propertyGiftsGuided',
    'propertyTrustGuided',
    'personalChattelsGuided',
    'deliberateExclusionsGuided',
    'otherProvisionsGuided',
    'administrativeProvisionsGuided',
    'estateResidueGuided',
    'businessInterestsGuided',
    'guardianFlow',
  ]);
  const collectAllFieldIds = (fields, ids = new Set()) => {
    if (!fields || !Array.isArray(fields)) return ids;
    fields.forEach((f) => {
      if (!f?.id) return;
      if (f._hiddenFromClient) return;
      if (['display', 'button', 'hidden', 'signature'].includes(f.type)) return;
      if (GUIDED_SHELL_FIELD_TYPES.has(f.type)) return;
      ids.add(f.id);
      if (f.type === 'section' && f.subFields) collectAllFieldIds(f.subFields, ids);
    });
    return ids;
  };
  const allIds = new Set();
  formData.formSections?.forEach((s) => {
    if (s?._hiddenFromClient) return;
    collectAllFieldIds(s.fields, allIds);
  });
  const missingIds = [...allIds].filter((id) => dummyData[id] === undefined || dummyData[id] === null || dummyData[id] === '');
  console.log(`[AUTOFILL GENERATE] 🔍 Found ${missingIds.length} missing field IDs, filling with defaults...`);
  missingIds.forEach((id) => {
    const f = fieldById.get(id);
    if (f) {
      const fromGetter = getFieldValue(f, dummyData);
      if (fromGetter != null && fromGetter !== '') {
        dummyData[id] = fromGetter;
        return;
      }
    }
    let defaultVal = `Questionnaire demo: ${id}.${DEMO_TEXT_TAG}`;
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
    else if (id === 'aristoneProfessionalFeesAck') defaultVal = [...ESTATE_DEMO.feesAck];
    else if (id === 'estateApproxValue') defaultVal = ESTATE_DEMO.approxValue;
    else if (id === 'estateApproxLiabilities') defaultVal = ESTATE_DEMO.approxLiabilities;
    else if (id === 'estateOwnProperty') defaultVal = ESTATE_DEMO.ownProperty;
    else if (id === 'estateBusinessInterests') defaultVal = ESTATE_DEMO.businessInterests;
    else if (id.includes('Details') || id.includes('details')) {
      defaultVal = `Demo details for this field.${DEMO_TEXT_TAG}`;
    }
    dummyData[id] = defaultVal;
  });
  console.log(`[AUTOFILL GENERATE] ✅ Filled ${missingIds.length} missing fields with defaults`);

  applyRichPersonDemoOverrides(dummyData);
  applyIdentityVerificationAutofill(dummyData);

  const SHELL_TYPES_NO_TOPUP = new Set(GUIDED_SHELL_FIELD_TYPES);
  SHELL_TYPES_NO_TOPUP.add('guardianFlow');
  SHELL_TYPES_NO_TOPUP.add('businessInterestsGuided');
  let topUpApplied = 0;
  for (const f of fieldById.values()) {
    if (!f.id) continue;
    if (SHELL_TYPES_NO_TOPUP.has(f.type) || f.type === 'section' || f.type === 'display' || f.type === 'button' || f.type === 'hidden') {
      continue;
    }
    if (!autofillValueNeedsTopUp(dummyData[f.id])) continue;
    const v = getFieldValue(f, dummyData);
    if (v != null && v !== '') {
      dummyData[f.id] = v;
      topUpApplied++;
    }
  }
  if (import.meta.env.DEV) {
    console.log('[AUTOFILL GENERATE] schema top-up pass:', { topUpApplied });
  }

  const estRec = getAristoneEstateRecommendationState(dummyData);
  const ex = dummyData.executorData;
  console.log('[AUTOFILL_VERIFY] Mariyam harness — estate + executor age', {
    estateApproxValue: dummyData.estateApproxValue,
    estateApproxLiabilities: dummyData.estateApproxLiabilities,
    aristoneEstateRecommendationEligible: estRec.eligible,
    chooseAristoneExecutor: dummyData.chooseAristoneExecutor,
    appointProfessionalExecutor: dummyData.appointProfessionalExecutor,
    professionalExecutorSelection: dummyData.professionalExecutorSelection,
    executorDataRowCount: Array.isArray(ex) ? ex.length : 0,
    executorRows: Array.isArray(ex)
      ? ex.map((r, i) => ({
          index: i,
          typeof: typeof r,
          keys: r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r).slice(0, 14) : null,
          dateOfBirth: r && typeof r === 'object' ? r.dateOfBirth : undefined,
          namePreview:
            r && typeof r === 'object' && !Array.isArray(r)
              ? [r.title, r.firstName, r.lastName].filter(Boolean).join(' ')
              : String(r).slice(0, 80),
        }))
      : [],
    note: 'Estate bands should qualify Aristone recommendation on Executors step. Primary executors: rich rows + UK DOB. David ~22 (1824 — age flow radios); Laura 25+ (no age-choice block). Open Trustees/Executors to see ExecutorIndividualAgeFlow.',
  });

  const debt0 = Array.isArray(dummyData.debtorData) ? dummyData.debtorData[0] : null;
  console.log('[AUTOFILL GENERATE] 📊 Final summary:', {
    totalFields: Object.keys(dummyData).length,
    contactRegistryEntries: dummyData[CONTACT_REGISTRY_KEY]?.length ?? 0,
    hasSeparateTrusteeData: !!dummyData.separateTrusteeData,
    separateTrusteeDataType: Array.isArray(dummyData.separateTrusteeData) ? 'array' : typeof dummyData.separateTrusteeData,
    separateTrusteeDataLength: Array.isArray(dummyData.separateTrusteeData) ? dummyData.separateTrusteeData.length : 'N/A',
    howResidueDistributed: dummyData.howResidueDistributed,
    appointSeparateTrusteesFLIT: dummyData.appointSeparateTrusteesFLIT,
    samplePersonKeys: dummyData.guardianData?.[0] ? Object.keys(dummyData.guardianData[0]).filter((k) => !k.startsWith('_')).slice(0, 8) : [],
    personalChattelsGuidedKeys: {
      unspecifiedChattelsAction: dummyData.unspecifiedChattelsAction,
      chattelGuidedRecipientName: dummyData.chattelGuidedRecipientName,
      personalChattelsGift: dummyData.personalChattelsGift,
      chattelsGiftBeneficiaryName: dummyData.chattelsGiftBeneficiaryName,
      forgiveDebt: dummyData.forgiveDebt,
      debtorDataDebtFields: debt0
        ? { _debtId: debt0._debtId, debtAmount: debt0.debtAmount, hasNotes: !!debt0.debtNotes }
        : null,
    },
    identityVerificationDemoSlotsOk:
      getMissingIdVerificationDocs({ identityVerification: dummyData.identityVerification }).length === 0,
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
      contactRegistryEntries: Array.isArray(dummyData.contactRegistry) ? dummyData.contactRegistry.length : 0,
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
