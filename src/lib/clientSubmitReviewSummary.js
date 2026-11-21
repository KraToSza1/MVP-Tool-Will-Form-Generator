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

function childrenSummary(v) {
  const kids = Array.isArray(v?.guardianFlowState?.children) ? v.guardianFlowState.children : [];
  const names = kids
    .map((c) => [trim(c?.childFirstName || c?.firstName), trim(c?.childLastName || c?.lastName)].filter(Boolean).join(' '))
    .filter(Boolean);
  return names.length ? names : ['None recorded'];
}

function giftsSummary(v) {
  const lines = [];
  const money = Array.isArray(v?.monetaryGiftsList) ? v.monetaryGiftsList : [];
  money.forEach((g) => {
    const who = trim(g?.recipientName);
    const amt = trim(g?.amount);
    if (who || amt) lines.push(`Cash: ${amt ? (amt.startsWith('£') ? amt : `£${amt}`) : 'amount not given'} to ${who || 'recipient not given'}`);
  });
  const items = Array.isArray(v?.specificGiftsList) ? v.specificGiftsList : [];
  items.forEach((g) => {
    const what = trim(g?.itemDescription);
    const who = trim(g?.recipientName);
    if (what || who) lines.push(`Item: ${what || 'item not described'} to ${who || 'recipient not given'}`);
  });
  const props = Array.isArray(v?.propertyGiftsList) ? v.propertyGiftsList : [];
  props.forEach((g) => {
    const where = [trim(g?.addressLine1 || g?.addressLine), trim(g?.town), trim(g?.postcode)].filter(Boolean).join(', ');
    const who = trim(g?.recipientName);
    if (where || who) lines.push(`Property: ${where || 'address not given'} to ${who || 'recipient not given'}`);
  });
  return lines.length ? lines.map((l) => (l.length > 160 ? `${l.slice(0, 157)}…` : l)) : ['No specific gifts'];
}

function businessSummary(v) {
  const has = trim(v?.biz_has_interests).toLowerCase();
  if (has === 'no' || (!has && trim(v?.hasBusinessInterests) !== 'Yes')) return ['No business interests'];
  if (has === 'unsure') return ['Business interests — to discuss with your solicitor'];
  const type = trim(v?.biz_type) || trim(v?.businessInterestType);
  return [`Business interests recorded${type ? ` (${type.replace(/_/g, ' ')})` : ''}`];
}

function organSummary(v) {
  const pref = trim(v?.organDonationPreference);
  if (!pref) return ['Not specified'];
  const specific = trim(v?.specificOrgansToDonate);
  return [specific ? `${pref}: ${specific}` : pref];
}

function petsSummary(v) {
  if (trim(v?.provisionsForPets) !== 'Yes') return ['No pet provisions'];
  const carers = Array.isArray(v?.petCarerData) ? formatPersonList(v.petCarerData) : [];
  return carers.length ? carers.map((c) => `Carer: ${c}`) : ['Pet provisions requested'];
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
      title: 'You',
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
      id: 'children',
      title: 'Your children',
      lines: childrenSummary(v),
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
      id: 'gifts',
      title: 'Gifts',
      lines: giftsSummary(v),
    },
    {
      id: 'business',
      title: 'Business interests',
      lines: businessSummary(v),
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
      id: 'organ',
      title: 'Organ donation',
      lines: organSummary(v),
    },
    {
      id: 'pets',
      title: 'Pets',
      lines: petsSummary(v),
    },
    {
      id: 'id',
      title: 'ID upload status',
      lines: [idStatus],
    },
  ];
}
