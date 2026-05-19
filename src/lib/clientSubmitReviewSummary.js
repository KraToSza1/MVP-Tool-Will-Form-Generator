/**
 * Plain-English client review summary before final submit (intake only — no TC, no ID images).
 */
import { getMissingIdVerificationDocs } from './matterOutstanding.js';
import { normalizePersonEntry } from './formPeopleSummary.js';
import { getPropertyTrustClientIntent } from './propertyTrustClientIntent.js';

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

function formatPersonList(arr, max = 6) {
  if (!Array.isArray(arr) || arr.length === 0) return ['None recorded'];
  return arr.slice(0, max).map((item) => {
    const { title } = normalizePersonEntry(item);
    return title && title !== '(unnamed)' ? title : 'Unnamed person';
  });
}

function testatorLine(formValues) {
  const parts = [formValues?.title, formValues?.firstName, formValues?.lastName].map(trim).filter(Boolean);
  const name = parts.join(' ') || 'Not provided';
  const email = trim(formValues?.email);
  const mobile = trim(formValues?.mobile || formValues?.phoneNumber);
  const contact = [email, mobile].filter(Boolean).join(' · ');
  return contact ? `${name} (${contact})` : name;
}

function residueSummary(formValues) {
  const dist = trim(formValues?.howResidueDistributed);
  if (!dist) return ['Not yet chosen'];
  const labels = {
    AsShares: 'Split between named beneficiaries (shares)',
    IntoFLIT: 'Life interest trust (FLIT)',
    ToSpouse: 'To spouse / civil partner',
    ToChildren: 'To children',
  };
  const main = labels[dist] || dist;
  const lines = [main];
  if (dist === 'AsShares' && trim(formValues?.residualGiftsDetails)) {
    lines.push(trim(formValues.residualGiftsDetails).slice(0, 200));
  }
  return lines;
}

function exclusionsSummary(formValues) {
  const arr = formValues?.excludedPersonData;
  if (!Array.isArray(arr) || arr.length === 0) return ['None recorded'];
  return formatPersonList(arr);
}

function funeralSummary(formValues) {
  const wishes = trim(formValues?.funeralWishes || formValues?.funeralArrangements);
  const burial = trim(formValues?.burialOrCremation);
  const parts = [burial, wishes].filter(Boolean);
  if (parts.length === 0) return ['Not specified'];
  return parts.map((p) => (p.length > 160 ? `${p.slice(0, 157)}…` : p));
}

/**
 * @param {Record<string, unknown> | null | undefined} formValues
 * @returns {{ id: string, title: string, lines: string[] }[]}
 */
export function buildClientSubmitReviewSections(formValues) {
  const v = formValues && typeof formValues === 'object' ? formValues : {};
  const missingId = getMissingIdVerificationDocs(v);
  const idStatus =
    missingId.length === 0
      ? 'All required ID documents uploaded'
      : `${missingId.length} document(s) still to upload`;

  const propertyIntent = getPropertyTrustClientIntent(v);
  const propertyLine =
    propertyIntent === 'Yes'
      ? 'Property trust requested — solicitor will complete trust wording'
      : propertyIntent === 'Unsure'
        ? 'Property trust — to discuss with solicitor'
        : propertyIntent === 'No'
          ? 'No property trust'
          : 'Not specified';

  return [
    {
      id: 'testator',
      title: 'You (testator)',
      lines: [testatorLine(v)],
    },
    {
      id: 'executors',
      title: 'Your executors',
      lines: formatPersonList(v.executorData),
    },
    {
      id: 'guardians',
      title: 'Your guardians',
      lines: formatPersonList(v.guardianData),
    },
    {
      id: 'beneficiaries',
      title: 'Main beneficiaries / residue',
      lines: residueSummary(v),
    },
    {
      id: 'property_trust',
      title: 'Property trust',
      lines: [propertyLine],
    },
    {
      id: 'exclusions',
      title: 'Deliberate exclusions',
      lines: exclusionsSummary(v),
    },
    {
      id: 'funeral',
      title: 'Funeral wishes',
      lines: funeralSummary(v),
    },
    {
      id: 'id',
      title: 'ID upload status',
      lines: [idStatus],
    },
  ];
}
