/**
 * Aristone Business Interests — guided section (April 2026 handoff).
 * Wires to: hasBusinessInterests, trusteePowerCarryOnBusiness, appointSeparateBusinessTrustee,
 * separateTrusteeData, and intake-only detail fields.
 */
import React, { useCallback, useId, useMemo, useRef, useState } from 'react';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import '../styles/aristone-business-interests.css';

const TRUSTEE_REL_OPTIONS = [
  { value: '', label: 'Select…' },
  { value: 'Partner', label: 'Partner / spouse' },
  { value: 'Sibling', label: 'Sibling' },
  { value: 'Professional adviser', label: 'Professional adviser' },
  { value: 'Solicitor', label: 'Solicitor' },
  { value: 'Accountant', label: 'Accountant' },
  { value: 'Business partner', label: 'Business partner' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Other', label: 'Other' },
];

function stripGuidedTrusteeRows(data) {
  if (!Array.isArray(data)) return [];
  return data.filter((x) => x && typeof x === 'object' && !x._businessGuidedCapture);
}

function buildGuidedTrusteeRow(v, recordId) {
  const firstName = String(v.businessSeparateTrusteeFirstName ?? '').trim();
  const lastName = String(v.businessSeparateTrusteeLastName ?? '').trim();
  const address1 = String(v.businessSeparateTrusteeAddress1 ?? '').trim();
  const town = String(v.businessSeparateTrusteeTown ?? '').trim();
  const postcode = String(v.businessSeparateTrusteePostcode ?? '').trim();
  if (!firstName || !lastName || !address1 || !town || !postcode) return null;
  const rid = String(recordId || v.businessSeparateTrusteeRecordId || '').trim() || 'biz-trustee-guided';
  return {
    title: '',
    firstName,
    middleName: '',
    lastName,
    email: String(v.businessSeparateTrusteeEmail ?? '').trim(),
    relationship: String(v.businessSeparateTrusteeRelationship ?? '').trim(),
    address1,
    address2: '',
    address3: town,
    postcode,
    gender: '',
    dateOfBirth: '',
    occupation: '',
    mobile: '',
    _businessGuidedCapture: true,
    _personRecordId: rid,
  };
}

function reconcileSeparateTrustees(prevList, appointYes, guidedRow) {
  const base = stripGuidedTrusteeRows(prevList);
  if (appointYes !== 'Yes') return base;
  if (guidedRow) return [...base, guidedRow];
  return base;
}

function trimVal(v) {
  if (v == null) return '';
  return String(v).trim();
}

/** Map a contact-candidate record into the guided separate trustee text fields. */
function mapContactToBusinessTrusteeFields(c) {
  const d = c?.data;
  if (!d || typeof d !== 'object') return null;
  let firstName = trimVal(d.firstName);
  let lastName = trimVal(d.lastName);
  if (!firstName && !lastName) {
    const full = trimVal(d.fullName) || personDisplayNameForGift(d);
    if (full) {
      const parts = full.split(/\s+/).filter(Boolean);
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ') || '';
    }
  }
  return {
    businessSeparateTrusteeFirstName: firstName,
    businessSeparateTrusteeLastName: lastName,
    businessSeparateTrusteeEmail: trimVal(d.email),
    businessSeparateTrusteeAddress1: trimVal(d.address1),
    businessSeparateTrusteeTown: trimVal(d.address3) || trimVal(d.city),
    businessSeparateTrusteePostcode: trimVal(d.postcode),
  };
}

function mapRelationshipToTrusteeSelect(rel) {
  const r = (rel || '').toLowerCase();
  if (!r) return '';
  for (const o of TRUSTEE_REL_OPTIONS) {
    if (!o.value) continue;
    if (r.includes(o.value.toLowerCase())) return o.value;
  }
  if (r.includes('spouse') || r.includes('partner') || r.includes('wife') || r.includes('husband')) return 'Partner';
  if (r.includes('sibling') || r.includes('brother') || r.includes('sister')) return 'Sibling';
  if (r.includes('solicitor')) return 'Solicitor';
  if (r.includes('accountant')) return 'Accountant';
  if (r.includes('friend')) return 'Friend';
  if (r.includes('professional')) return 'Professional adviser';
  if (r.includes('business') && r.includes('partner')) return 'Business partner';
  return 'Other';
}

const DEFAULT_BPR_REQUESTED = 'BPR trust requested';
const DEFAULT_BPR_UNSURE =
  'Flagged for discussion. Your solicitor will talk this through with you. A draft PDF can still be produced; any BPR trust section stays blank until you agree the approach.';

/** @param {{ field?: object, formValues: object, setFormValues: Function }} props */
export default function BusinessInterestsGuided({ field, formValues, setFormValues }) {
  const uid = useId();
  const recordIdRef = useRef(formValues.businessSeparateTrusteeRecordId || null);
  const [businessTrusteePickId, setBusinessTrusteePickId] = useState('');

  const idFirst = `ari-trustee-firstname-${uid}`;
  const idLast = `ari-trustee-lastname-${uid}`;
  const idEmail = `ari-trustee-email-${uid}`;
  const idAddr = `ari-trustee-addr-${uid}`;
  const idTown = `ari-trustee-town-${uid}`;
  const idPc = `ari-trustee-pc-${uid}`;

  const hasBiz = formValues.hasBusinessInterests;
  const showDetails = hasBiz === 'Yes';
  const showTrusteeForm = showDetails && formValues.appointSeparateBusinessTrustee === 'Yes';

  const businessTrusteeContactOptions = useMemo(
    () => getContactCandidates(formValues || {}),
    [formValues]
  );

  const applyPatch = useCallback((updater) => {
    setFormValues((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
  }, [setFormValues]);

  const syncTrusteeIntoState = (base) => {
    const appoint = base.appointSeparateBusinessTrustee;
    if (appoint !== 'Yes') {
      return {
        ...base,
        separateTrusteeData: stripGuidedTrusteeRows(base.separateTrusteeData),
      };
    }
    if (!recordIdRef.current) {
      recordIdRef.current = `biz-trustee-${Math.random().toString(36).slice(2, 11)}`;
    }
    const rid = recordIdRef.current;
    const row = buildGuidedTrusteeRow({ ...base, businessSeparateTrusteeRecordId: rid }, rid);
    return {
      ...base,
      businessSeparateTrusteeRecordId: rid,
      separateTrusteeData: reconcileSeparateTrustees(base.separateTrusteeData, 'Yes', row),
    };
  };

  const clearBusinessDetailFields = {
    businessInterestType: '',
    businessInterestValueRange: '',
    shareholderAgreementInPlace: '',
    trusteePowerCarryOnBusiness: '',
    appointSeparateBusinessTrustee: '',
    businessSeparateTrusteeFirstName: '',
    businessSeparateTrusteeLastName: '',
    businessSeparateTrusteeRelationship: '',
    businessSeparateTrusteeEmail: '',
    businessSeparateTrusteeAddress1: '',
    businessSeparateTrusteeTown: '',
    businessSeparateTrusteePostcode: '',
    businessSeparateTrusteeRecordId: '',
    bprTrustClientIntent: '',
  };

  const setQ1 = (val) => {
    const mapped = val === 'yes' ? 'Yes' : val === 'no' ? 'No' : 'Unsure';
    recordIdRef.current = null;
    setBusinessTrusteePickId('');
    if (mapped !== 'Yes') {
      applyPatch((prev) => {
        const next = {
          ...prev,
          hasBusinessInterests: mapped,
          ...clearBusinessDetailFields,
          separateTrusteeData: stripGuidedTrusteeRows(prev.separateTrusteeData),
        };
        delete next.includeBPRTrust;
        return next;
      });
      return;
    }
    applyPatch((prev) => {
      const next = { ...prev, hasBusinessInterests: 'Yes' };
      delete next.includeBPRTrust;
      return next;
    });
  };

  const setQ2 = (val) => {
    const mapped = val === 'yes' ? 'Yes' : val === 'no' ? 'No' : 'Unsure';
    applyPatch({ trusteePowerCarryOnBusiness: mapped });
  };

  const trusteeOnlyClears = {
    businessSeparateTrusteeFirstName: '',
    businessSeparateTrusteeLastName: '',
    businessSeparateTrusteeRelationship: '',
    businessSeparateTrusteeEmail: '',
    businessSeparateTrusteeAddress1: '',
    businessSeparateTrusteeTown: '',
    businessSeparateTrusteePostcode: '',
    businessSeparateTrusteeRecordId: '',
  };

  const setQ3 = (val) => {
    const mapped = val === 'yes' ? 'Yes' : val === 'no' ? 'No' : 'Unsure';
    if (mapped !== 'Yes') {
      setBusinessTrusteePickId('');
      recordIdRef.current = null;
      applyPatch((prev) => ({
        ...prev,
        appointSeparateBusinessTrustee: mapped,
        ...trusteeOnlyClears,
        separateTrusteeData: stripGuidedTrusteeRows(prev.separateTrusteeData),
      }));
      return;
    }
    applyPatch((prev) => {
      const draft = { ...prev, appointSeparateBusinessTrustee: 'Yes' };
      return syncTrusteeIntoState(draft);
    });
  };

  const setQ4 = (val) => {
    const mapped = val === 'yes' ? 'Yes' : val === 'no' ? 'No' : 'Unsure';
    applyPatch((prev) => {
      const next = { ...prev, bprTrustClientIntent: mapped };
      delete next.includeBPRTrust;
      return next;
    });
  };

  const onDetailChange = (key, value) => {
    applyPatch({ [key]: value });
  };

  const applyBusinessTrusteeFromContact = (id) => {
    setBusinessTrusteePickId(id);
    if (!id) return;
    const c = businessTrusteeContactOptions.find((x) => x.id === id);
    if (!c) return;
    const mapped = mapContactToBusinessTrusteeFields(c);
    if (!mapped) return;
    const rel = mapRelationshipToTrusteeSelect(c.data?.relationship);
    applyPatch((prev) => {
      const next = {
        ...prev,
        ...mapped,
        businessSeparateTrusteeRelationship: rel || prev.businessSeparateTrusteeRelationship,
      };
      if (next.appointSeparateBusinessTrustee !== 'Yes') return next;
      return syncTrusteeIntoState(next);
    });
  };

  const onTrusteeFieldChange = (key, value) => {
    setBusinessTrusteePickId('');
    applyPatch((prev) => {
      const draft = { ...prev, [key]: value };
      if (draft.appointSeparateBusinessTrustee !== 'Yes') return draft;
      return syncTrusteeIntoState(draft);
    });
  };

  const agreementVal = formValues.shareholderAgreementInPlace || '';

  const radioQ1 = {
    no: hasBiz === 'No',
    yes: hasBiz === 'Yes',
    unsure: hasBiz === 'Unsure',
  };

  const q2 = formValues.trusteePowerCarryOnBusiness;
  const radioQ2 = {
    no: q2 === 'No',
    yes: q2 === 'Yes',
    unsure: q2 === 'Unsure',
  };

  const q3 = formValues.appointSeparateBusinessTrustee;
  const radioQ3 = {
    no: q3 === 'No',
    yes: q3 === 'Yes',
    unsure: q3 === 'Unsure',
  };

  const q4 = formValues.bprTrustClientIntent;
  const radioQ4 = {
    no: q4 === 'No',
    yes: q4 === 'Yes',
    unsure: q4 === 'Unsure',
  };
  const showBprConfirm = q4 === 'Yes' || q4 === 'Unsure';

  const bprRequestedCopy =
    typeof field?.bprTrustRequestedMessage === 'string' && field.bprTrustRequestedMessage.trim() !== ''
      ? field.bprTrustRequestedMessage.trim()
      : DEFAULT_BPR_REQUESTED;
  const bprUnsureCopy =
    typeof field?.bprTrustUnsureMessage === 'string' && field.bprTrustUnsureMessage.trim() !== ''
      ? field.bprTrustUnsureMessage.trim()
      : DEFAULT_BPR_UNSURE;

  return (
    <div className="ari-wrap min-w-0">
      {/* Section title comes from FormRenderer — avoid duplicating "Business Interests" heading */}

      <div className="ari-q-header">
        <div className="ari-badge-sm" aria-hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        </div>
        <h3>Do you have any ownership or involvement in a business?</h3>
      </div>

      <div className="ari-why">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p>
          WHY WE ASK THIS: If you own part of a business, it can be one of the most valuable things you leave behind —
          and one of the most complicated to handle without proper planning. Telling us now means your solicitor can make
          sure your will protects it correctly.
        </p>
      </div>

      <p className="ari-helper break-words">
        Answer yes if any of the following apply — even if the business is small, dormant, or you&apos;re no longer actively
        involved:
      </p>

      <div className="ari-examples">
        <div className="ari-tile">
          <p className="t-title">✓ Shares in a limited company</p>
          <p className="t-sub">Even a small percentage counts</p>
        </div>
        <div className="ari-tile">
          <p className="t-title">✓ Sole trader or self-employed</p>
          <p className="t-sub">Any self-employed income or trading</p>
        </div>
        <div className="ari-tile">
          <p className="t-title">✓ Business partnership</p>
          <p className="t-sub">LLP or traditional partnership</p>
        </div>
        <div className="ari-tile">
          <p className="t-title">✓ Director of a company</p>
          <p className="t-sub">Including family or dormant companies</p>
        </div>
      </div>
      <p className="ari-hint">Not sure? Select &quot;I&apos;m not sure&quot; and your solicitor will help you work it out.</p>

      <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Business interests">
        <label className="ari-radio-opt" htmlFor={`ari-biz-no-${uid}`} onClick={() => setQ1('no')}>
          <input id={`ari-biz-no-${uid}`} type="radio" name={`ari-biz-${uid}`} checked={radioQ1.no} onChange={() => setQ1('no')} />
          <div>
            <div className="ari-opt-label">No, I don&apos;t have any business interests</div>
            <div className="ari-opt-sub">I&apos;m not a business owner, shareholder, partner, or company director</div>
          </div>
        </label>
        <label className="ari-radio-opt" htmlFor={`ari-biz-yes-${uid}`} onClick={() => setQ1('yes')}>
          <input id={`ari-biz-yes-${uid}`} type="radio" name={`ari-biz-${uid}`} checked={radioQ1.yes} onChange={() => setQ1('yes')} />
          <div>
            <div className="ari-opt-label">Yes, I own or have an interest in a business</div>
            <div className="ari-opt-sub">I&apos;ll provide a few details so my solicitor can advise properly</div>
          </div>
        </label>
        <label className="ari-radio-opt" htmlFor={`ari-biz-unsure-${uid}`} onClick={() => setQ1('unsure')}>
          <input id={`ari-biz-unsure-${uid}`} type="radio" name={`ari-biz-${uid}`} checked={radioQ1.unsure} onChange={() => setQ1('unsure')} />
          <div>
            <div className="ari-opt-label">I&apos;m not sure</div>
            <div className="ari-opt-sub">My solicitor will check this with me before the will is drafted</div>
          </div>
        </label>
      </div>

      {showDetails ? (
        <div id="ari-biz-details" className="min-w-0">
          <div className="ari-callout">
            <p>
              <strong>A few quick details about your business.</strong> Don&apos;t worry about being exact — your solicitor
              will go through this with you.
            </p>
          </div>

          <div className="ari-field">
            <label className="ari-label" htmlFor={`ari-biz-type-${uid}`}>
              What type of business interest is it?
            </label>
            <select
              id={`ari-biz-type-${uid}`}
              className="ari-select"
              value={formValues.businessInterestType || ''}
              onChange={(e) => onDetailChange('businessInterestType', e.target.value)}
            >
              <option value="">Select one...</option>
              <option value="ltd-shares">Shares in a limited company</option>
              <option value="sole-trader">Sole trader / self-employed</option>
              <option value="partnership">Business partnership or LLP</option>
              <option value="directorship">Directorship (no ownership)</option>
              <option value="multiple">More than one of the above</option>
              <option value="unsure">Not sure</option>
            </select>
          </div>

          <div className="ari-field">
            <label className="ari-label" htmlFor={`ari-biz-value-${uid}`}>
              Roughly what is your share worth?
            </label>
            <select
              id={`ari-biz-value-${uid}`}
              className="ari-select"
              value={formValues.businessInterestValueRange || ''}
              onChange={(e) => onDetailChange('businessInterestValueRange', e.target.value)}
            >
              <option value="">Select a range...</option>
              <option value="under-50k">Under £50,000</option>
              <option value="50k-250k">£50,000 – £250,000</option>
              <option value="250k-1m">£250,000 – £1 million</option>
              <option value="over-1m">Over £1 million</option>
              <option value="unknown">I don&apos;t know</option>
            </select>
            <p className="ari-hint" style={{ marginTop: 5 }}>
              This helps us check whether Business Property Relief (BPR) could reduce inheritance tax on your estate.
            </p>
          </div>

          <div className="ari-field">
            <span className="ari-label">Is there a shareholder or partnership agreement in place?</span>
            <div className="ari-inline-radios relative z-[1]" role="radiogroup">
              <label className="ari-inline-radio" htmlFor={`ari-agreement-yes-${uid}`} onClick={() => onDetailChange('shareholderAgreementInPlace', 'Yes')}>
                <input
                  id={`ari-agreement-yes-${uid}`}
                  type="radio"
                  name={`ari-agreement-${uid}`}
                  checked={agreementVal === 'Yes'}
                  onChange={() => onDetailChange('shareholderAgreementInPlace', 'Yes')}
                />
                Yes
              </label>
              <label className="ari-inline-radio" htmlFor={`ari-agreement-no-${uid}`} onClick={() => onDetailChange('shareholderAgreementInPlace', 'No')}>
                <input
                  id={`ari-agreement-no-${uid}`}
                  type="radio"
                  name={`ari-agreement-${uid}`}
                  checked={agreementVal === 'No'}
                  onChange={() => onDetailChange('shareholderAgreementInPlace', 'No')}
                />
                No
              </label>
              <label className="ari-inline-radio" htmlFor={`ari-agreement-unsure-${uid}`} onClick={() => onDetailChange('shareholderAgreementInPlace', 'Unsure')}>
                <input
                  id={`ari-agreement-unsure-${uid}`}
                  type="radio"
                  name={`ari-agreement-${uid}`}
                  checked={agreementVal === 'Unsure'}
                  onChange={() => onDetailChange('shareholderAgreementInPlace', 'Unsure')}
                />
                Not sure
              </label>
            </div>
            <p className="ari-hint" style={{ marginTop: 6 }}>
              These agreements sometimes restrict who you can leave your shares to — your solicitor needs to review them.
            </p>
          </div>

          <hr className="ari-sep" />

          <div className="ari-q-header">
            <div className="ari-badge-sm" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <h3>Should your trustees be allowed to keep running your business after you die?</h3>
          </div>

          <div className="ari-why">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>
              WHY WE ASK THIS: By default, trustees must wind down a business as quickly as possible after someone dies. If
              you&apos;d like them to have the option to continue running it — to protect its value, find a buyer, or keep it
              going for your family — you need to say so here.
            </p>
          </div>

          <div className="ari-guidance">
            <div className="ari-guidance-box">
              <p className="ari-g-title">Say yes if...</p>
              <p className="ari-g-item">✓ You own a trading business with staff or contracts</p>
              <p className="ari-g-item">✓ Your family depends on the income it generates</p>
              <p className="ari-g-item">✓ A forced quick sale would significantly reduce its value</p>
            </div>
            <div className="ari-guidance-box">
              <p className="ari-g-title">Say no if...</p>
              <p className="ari-g-item">✗ You hold shares passively as an investor</p>
              <p className="ari-g-item">✗ The business would naturally end when you&apos;re gone (e.g. sole trader, no staff)</p>
            </div>
          </div>

          <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Trustees carry on business">
            <label className="ari-radio-opt" htmlFor={`ari-carry-no-${uid}`} onClick={() => setQ2('no')}>
              <input id={`ari-carry-no-${uid}`} type="radio" name={`ari-carry-${uid}`} checked={radioQ2.no} onChange={() => setQ2('no')} />
              <div>
                <div className="ari-opt-label">No — wind it down as usual</div>
                <div className="ari-opt-sub">My trustees should close or sell the business in the normal way</div>
              </div>
            </label>
            <label className="ari-radio-opt" htmlFor={`ari-carry-yes-${uid}`} onClick={() => setQ2('yes')}>
              <input id={`ari-carry-yes-${uid}`} type="radio" name={`ari-carry-${uid}`} checked={radioQ2.yes} onChange={() => setQ2('yes')} />
              <div>
                <div className="ari-opt-label">Yes — give my trustees the power to keep it running</div>
                <div className="ari-opt-sub">
                  They can continue operating the business while deciding the best course of action
                </div>
              </div>
            </label>
            <label className="ari-radio-opt" htmlFor={`ari-carry-unsure-${uid}`} onClick={() => setQ2('unsure')}>
              <input id={`ari-carry-unsure-${uid}`} type="radio" name={`ari-carry-${uid}`} checked={radioQ2.unsure} onChange={() => setQ2('unsure')} />
              <div>
                <div className="ari-opt-label">I&apos;m not sure — I&apos;d like to discuss this with my solicitor</div>
                <div className="ari-opt-sub">We&apos;ll flag this for review before your will is drafted</div>
              </div>
            </label>
          </div>

          <hr className="ari-sep" />

          <div className="ari-q-header">
            <div className="ari-badge-sm" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <h3>Do you want a separate trustee dedicated to your business?</h3>
          </div>

          <div className="ari-why">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p>
              WHY WE ASK THIS: Usually your executors handle everything in your estate, including your business. But if your
              business is complex or valuable, you can appoint a separate person — such as an accountant, solicitor, or
              business partner — to manage only the business side of your estate.
            </p>
          </div>

          <div className="ari-guidance ari-guidance-full">
            <div className="ari-guidance-box">
              <p className="ari-g-title">A separate business trustee might make sense if...</p>
              <p className="ari-g-item">✓ Your executors are family members with no business experience</p>
              <p className="ari-g-item">✓ The business has co-owners who need to be involved in decisions</p>
              <p className="ari-g-item">✓ You want a professional (e.g. accountant or solicitor) to manage it</p>
              <p className="ari-g-item">✓ The business is worth significantly more than the rest of your estate</p>
            </div>
          </div>

          <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Separate business trustee" style={{ marginTop: '1rem' }}>
            <label className="ari-radio-opt" htmlFor={`ari-sep-no-${uid}`} onClick={() => setQ3('no')}>
              <input id={`ari-sep-no-${uid}`} type="radio" name={`ari-sep-${uid}`} checked={radioQ3.no} onChange={() => setQ3('no')} />
              <div>
                <div className="ari-opt-label">No — my executors can handle everything</div>
                <div className="ari-opt-sub">The same people managing my estate will look after the business too</div>
              </div>
            </label>
            <label className="ari-radio-opt" htmlFor={`ari-sep-yes-${uid}`} onClick={() => setQ3('yes')}>
              <input id={`ari-sep-yes-${uid}`} type="radio" name={`ari-sep-${uid}`} checked={radioQ3.yes} onChange={() => setQ3('yes')} />
              <div>
                <div className="ari-opt-label">Yes — I want a dedicated trustee for the business</div>
                <div className="ari-opt-sub">I&apos;ll name this person or professional below</div>
              </div>
            </label>
            <label className="ari-radio-opt" htmlFor={`ari-sep-unsure-${uid}`} onClick={() => setQ3('unsure')}>
              <input id={`ari-sep-unsure-${uid}`} type="radio" name={`ari-sep-${uid}`} checked={radioQ3.unsure} onChange={() => setQ3('unsure')} />
              <div>
                <div className="ari-opt-label">I&apos;m not sure — I&apos;d like my solicitor&apos;s advice on this</div>
                <div className="ari-opt-sub">We&apos;ll discuss this before your will is finalised</div>
              </div>
            </label>
          </div>

          {showTrusteeForm ? (
            <div id="ari-trustee-form" className="ari-trustee-box min-w-0">
              <h4>Details of your separate business trustee</h4>
              <p className="ari-helper text-sm">
                Address fields are needed so your will can name them correctly. You can refine this with your solicitor
                later.
              </p>
              <div className="ari-field min-w-0">
                <label className="ari-label" htmlFor={`ari-biz-trustee-pick-${uid}`}>
                  Choose someone you&apos;ve already entered <span className="text-slate-500 dark:text-slate-400 font-normal">(optional)</span>
                </label>
                <select
                  id={`ari-biz-trustee-pick-${uid}`}
                  className="ari-select w-full min-h-[44px] min-w-0"
                  value={businessTrusteePickId}
                  onChange={(e) => applyBusinessTrusteeFromContact(e.target.value)}
                >
                  <option value="">— Type details manually below —</option>
                  {businessTrusteeContactOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 m-0 leading-snug break-words">
                  {businessTrusteeContactOptions.length > 0
                    ? 'Copies name, email and address when we have them from your form — edit before continuing.'
                    : 'Add executors, partners or other people elsewhere in the form to pick them here, or type manually below.'}
                </p>
              </div>
              <div className="ari-field-grid">
                <div className="ari-field">
                  <label className="ari-label" htmlFor={idFirst}>
                    First name
                  </label>
                  <input
                    id={idFirst}
                    className="ari-input"
                    value={formValues.businessSeparateTrusteeFirstName || ''}
                    onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeFirstName', e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="ari-field">
                  <label className="ari-label" htmlFor={idLast}>
                    Last name
                  </label>
                  <input
                    id={idLast}
                    className="ari-input"
                    value={formValues.businessSeparateTrusteeLastName || ''}
                    onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeLastName', e.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="ari-field">
                <label className="ari-label" htmlFor={`ari-trustee-rel-${uid}`}>
                  Relationship to you
                </label>
                <select
                  id={`ari-trustee-rel-${uid}`}
                  className="ari-select"
                  value={formValues.businessSeparateTrusteeRelationship || ''}
                  onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeRelationship', e.target.value)}
                >
                  {TRUSTEE_REL_OPTIONS.map((o) => (
                    <option key={o.value || 'empty'} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ari-field">
                <label className="ari-label" htmlFor={idEmail}>
                  Email <span className="ari-optional">(optional)</span>
                </label>
                <input
                  id={idEmail}
                  type="email"
                  className="ari-input"
                  value={formValues.businessSeparateTrusteeEmail || ''}
                  onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeEmail', e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="ari-field">
                <label className="ari-label" htmlFor={idAddr}>
                  Address line 1
                </label>
                <input
                  id={idAddr}
                  className="ari-input"
                  value={formValues.businessSeparateTrusteeAddress1 || ''}
                  onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeAddress1', e.target.value)}
                  autoComplete="street-address"
                />
              </div>
              <div className="ari-field-grid">
                <div className="ari-field">
                  <label className="ari-label" htmlFor={idTown}>
                    Town / city
                  </label>
                  <input
                    id={idTown}
                    className="ari-input"
                    value={formValues.businessSeparateTrusteeTown || ''}
                    onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteeTown', e.target.value)}
                    autoComplete="address-level2"
                  />
                </div>
                <div className="ari-field">
                  <label className="ari-label" htmlFor={idPc}>
                    Postcode
                  </label>
                  <input
                    id={idPc}
                    className="ari-input"
                    value={formValues.businessSeparateTrusteePostcode || ''}
                    onChange={(e) => onTrusteeFieldChange('businessSeparateTrusteePostcode', e.target.value)}
                    autoComplete="postal-code"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <hr className="ari-sep" />

          <div className="ari-q-header">
            <div className="ari-badge-sm" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
            <h3>Do you want your will to include a Business Property Relief (BPR) trust?</h3>
          </div>

          <div className="ari-bpr-explainer">
            <h4>Plain-English summary</h4>
            <p>
              A BPR trust can sometimes help reduce inheritance tax on qualifying business assets. The exact wording is legal
              work — your solicitor drafts the trust terms. Here we only need to know what you want to explore.
            </p>
            <div className="ari-bpr-example">
              <p>
                <strong>Example.</strong> You might say yes if you want your solicitor to build in a BPR trust for your company
                shares; you might say no if you already know you do not need one; or &quot;I&apos;m not sure&quot; if you want
                advice on the call first.
              </p>
            </div>
          </div>

          <div className="ari-radio-group relative z-[1]" role="radiogroup" aria-label="Business Property Relief trust">
            <label className="ari-radio-opt" htmlFor={`ari-bpr-no-${uid}`} onClick={() => setQ4('no')}>
              <input id={`ari-bpr-no-${uid}`} type="radio" name={`ari-bpr-${uid}`} checked={radioQ4.no} onChange={() => setQ4('no')} />
              <div>
                <div className="ari-opt-label">No — I do not want a BPR trust in my will</div>
                <div className="ari-opt-sub">My solicitor will not add BPR trust wording unless we discuss it later</div>
              </div>
            </label>
            <label className="ari-radio-opt" htmlFor={`ari-bpr-yes-${uid}`} onClick={() => setQ4('yes')}>
              <input id={`ari-bpr-yes-${uid}`} type="radio" name={`ari-bpr-${uid}`} checked={radioQ4.yes} onChange={() => setQ4('yes')} />
              <div>
                <div className="ari-opt-label">Yes — please include a BPR trust</div>
                <div className="ari-opt-sub">I want my solicitor to prepare the trust terms and schedules</div>
              </div>
            </label>
            <label className="ari-radio-opt" htmlFor={`ari-bpr-unsure-${uid}`} onClick={() => setQ4('unsure')}>
              <input id={`ari-bpr-unsure-${uid}`} type="radio" name={`ari-bpr-${uid}`} checked={radioQ4.unsure} onChange={() => setQ4('unsure')} />
              <div>
                <div className="ari-opt-label">I&apos;m not sure — I need advice first</div>
                <div className="ari-opt-sub">Flag this for discussion; my solicitor will help me decide</div>
              </div>
            </label>
          </div>

          {showBprConfirm ? (
            <div id={`ari-bpr-confirm-${uid}`} className="ari-bpr-confirm-box">
              {q4 === 'Yes' ? <p>{bprRequestedCopy}</p> : <p>{bprUnsureCopy}</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
