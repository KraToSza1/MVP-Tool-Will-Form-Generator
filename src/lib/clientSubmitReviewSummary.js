/**
 * Plain-English client review summary before final submit (intake only — no TC, no ID images).
 */
import { ARISTONE_PROFILE } from '../constants/aristoneSolicitors.js';
import { getMissingIdVerificationDocs } from './matterOutstanding.js';
import { normalizePersonEntry } from './formPeopleSummary.js';
import { getPropertyTrustClientIntent } from './propertyTrustClientIntent.js';

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

function formatPersonList(arr, max = 6) {
  if (!Array.isArray(arr) || arr.length === 0) return [];
  return arr.slice(0, max).map((item) => {
    const { title } = normalizePersonEntry(item);
    return title && title !== '(unnamed)' ? title : 'Unnamed person';
  });
}

function guardianFlowPersonLabel(g) {
  if (!g || typeof g !== 'object') return '';
  const { title } = normalizePersonEntry({
    title: g.title,
    firstName: g.firstName,
    middleName: g.middleNames ?? g.middleName,
    lastName: g.lastName,
  });
  return title && title !== '(unnamed)' ? title : '';
}

function executorsSummary(formValues) {
  const lines = [];
  const individual = formatPersonList(formValues?.executorData, 4);
  individual.forEach((name) => {
    if (name && name !== 'Unnamed person') lines.push(`Individual executor: ${name}`);
  });

  const prof = formatPersonList(formValues?.professionalExecutorData, 2);
  if (prof.length > 0) {
    prof.forEach((name) => lines.push(`Professional executor: ${name}`));
  } else if (
    formValues?.appointProfessionalExecutor === 'Yes' &&
    (formValues?.professionalExecutorSelection === 'Aristone' ||
      formValues?.chooseAristoneSubstituteExecutor === 'Aristone')
  ) {
    lines.push(`Professional executor: ${ARISTONE_PROFILE.fullLegalFormat}`);
  }

  const substitute = formatPersonList(formValues?.substituteExecutorData, 2);
  if (substitute.length > 0) {
    substitute.forEach((name) => lines.push(`Substitute executor: ${name}`));
  } else if (formValues?.chooseAristoneSubstituteExecutor === 'Aristone') {
    lines.push(`Substitute executor: ${ARISTONE_PROFILE.fullLegalFormat}`);
  }

  if (lines.length === 0) return ['None recorded'];
  return lines;
}

function guardiansSummary(formValues) {
  const fromGuardianData = formatPersonList(formValues?.guardianData, 8);
  if (fromGuardianData.length > 0) {
    return fromGuardianData.map((name) => `Guardian: ${name}`);
  }

  const raw = formValues?.guardianFlowState;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const state = JSON.parse(raw);
      const lines = [];
      const seen = new Set();

      const pushName = (g, prefix = '') => {
        const name = guardianFlowPersonLabel(g);
        if (!name || seen.has(name)) return;
        seen.add(name);
        lines.push(prefix ? `${prefix}${name}` : `Guardian: ${name}`);
      };

      if (Array.isArray(state.sameGuardians) && state.sameGuardians.length > 0) {
        state.sameGuardians.forEach((g) => pushName(g));
      }

      if (Array.isArray(state.children) && state.children.length > 0) {
        state.children.forEach((ch) => {
          const childName = [ch?.childFirstName, ch?.childLastName].map(trim).filter(Boolean).join(' ');
          const guardians = Array.isArray(ch?.guardians) ? ch.guardians : [];
          if (!childName) {
            guardians.forEach((g) => pushName(g));
            return;
          }
          const names = guardians.map(guardianFlowPersonLabel).filter(Boolean);
          if (names.length > 0) {
            const label = `For ${childName}: ${names.join('; ')}`;
            if (!seen.has(label)) {
              seen.add(label);
              lines.push(label);
            }
          }
        });
      }

      if (lines.length > 0) return lines;
    } catch {
      /* ignore invalid JSON */
    }
  }

  const clause = trim(formValues?.guardianshipDetailsData);
  if (clause) {
    return [clause.length > 220 ? `${clause.slice(0, 217)}…` : clause];
  }

  const appoint = trim(formValues?.appointGuardians);
  if (appoint === 'No') return ['No guardians appointed'];
  if (appoint) return ['Guardians appointed — see questionnaire for full details'];

  return ['None recorded'];
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
      lines: executorsSummary(v),
    },
    {
      id: 'guardians',
      title: 'Your guardians',
      lines: guardiansSummary(v),
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
