import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ageFromIsoDob,
  addRecommendedType,
  guardianFlowHasMinorChild,
  hasGuardianshipDetails,
  hasMeaningfulPartner,
  normalizeLpaState,
  setPriority,
  shouldTriggerBusiness,
  shouldTriggerPropertyTrust,
  shouldTriggerSingleNoPartner,
} from '../lib/lpaOpportunityLogic.js';
import {
  LpaFinalBanner,
  LpaSeedMedium,
  LpaSeedSoft,
  LpaSeedTooltip,
  LpaSeedUrgent,
  useLpaFinalBannerCopy,
} from './LpaOpportunityUI.jsx';

const TITLE_PERSONAL = 'Personal Information';
const TITLE_GUARDIANS = 'Guardians';
const TITLE_PROPERTY = 'Property Trust';
const TITLE_BUSINESS = 'Business Interests';

/**
 * Client-only LPA nudges + final banner; persists on `formValues.lpa_opportunity` for autosave + matter submit.
 */
export default function LpaOpportunityClient({
  solicitorMode,
  formValues,
  setFormValues,
  currentSectionTitle,
  actualSectionIndex,
  showPreSubmitBanner,
  submitted,
}) {
  const stepNo = (typeof actualSectionIndex === 'number' ? actualSectionIndex : 0) + 1;

  const lpa = useMemo(() => normalizeLpaState(formValues?.lpa_opportunity), [formValues?.lpa_opportunity]);

  const fb = useLpaFinalBannerCopy({ triggers: lpa.lpa_triggers });

  const respond = useCallback(
    (r) => {
      setFormValues((prev) => {
        const s = normalizeLpaState(prev.lpa_opportunity);
        return { ...prev, lpa_opportunity: { ...s, lpa_client_response: r } };
      });
    },
    [setFormValues],
  );

  // DOB (Personal Information)
  useEffect(() => {
    if (solicitorMode || currentSectionTitle !== TITLE_PERSONAL) return;
    const age = ageFromIsoDob(formValues?.dateOfBirth);
    if (age == null || age < 18) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (s.lpa_seeds_shown.includes('dob')) return prev;
      let next = {
        ...s,
        lpa_triggers: { ...s.lpa_triggers, age },
        lpa_seeds_shown: [...s.lpa_seeds_shown, 'dob'],
        lpa_shown_at_step: s.lpa_shown_at_step.includes(stepNo)
          ? s.lpa_shown_at_step
          : [...s.lpa_shown_at_step, stepNo],
      };
      next = addRecommendedType(next, 'property_financial');
      next = addRecommendedType(next, 'health_welfare');
      next = setPriority(next, age >= 65 ? 'high' : 'standard');
      return { ...prev, lpa_opportunity: next };
    });
  }, [solicitorMode, currentSectionTitle, formValues?.dateOfBirth, setFormValues, stepNo]);

  // Minor child (Guardians)
  useEffect(() => {
    if (solicitorMode || currentSectionTitle !== TITLE_GUARDIANS) return;
    if (!guardianFlowHasMinorChild(formValues)) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (s.lpa_triggers.minorChild) return prev;
      let next = {
        ...s,
        lpa_triggers: { ...s.lpa_triggers, minorChild: true },
        lpa_seeds_shown: s.lpa_seeds_shown.includes('child')
          ? s.lpa_seeds_shown
          : [...s.lpa_seeds_shown, 'child'],
        lpa_shown_at_step:
          s.lpa_seeds_shown.includes('child') || s.lpa_shown_at_step.includes(stepNo)
            ? s.lpa_shown_at_step
            : [...s.lpa_shown_at_step, stepNo],
      };
      next = setPriority(next, 'high');
      next = addRecommendedType(next, 'health_welfare');
      return { ...prev, lpa_opportunity: next };
    });
  }, [solicitorMode, currentSectionTitle, formValues, setFormValues, stepNo]);

  // Guardian named (same section, after details exist)
  useEffect(() => {
    if (solicitorMode || currentSectionTitle !== TITLE_GUARDIANS) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (!s.lpa_triggers.minorChild) return prev;
      if (!hasGuardianshipDetails(prev)) return prev;
      if (s.lpa_seeds_shown.includes('guardian')) return prev;
      return {
        ...prev,
        lpa_opportunity: {
          ...s,
          lpa_seeds_shown: [...s.lpa_seeds_shown, 'guardian'],
          lpa_shown_at_step: s.lpa_shown_at_step.includes(stepNo)
            ? s.lpa_shown_at_step
            : [...s.lpa_shown_at_step, stepNo],
        },
      };
    });
  }, [
    solicitorMode,
    currentSectionTitle,
    formValues?.guardianshipDetailsData,
    formValues?.guardianFlowState,
    setFormValues,
    stepNo,
  ]);

  // Property trust
  useEffect(() => {
    if (solicitorMode || currentSectionTitle !== TITLE_PROPERTY) return;
    if (!shouldTriggerPropertyTrust(formValues)) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (s.lpa_seeds_shown.includes('property_trust')) return prev;
      let next = {
        ...s,
        lpa_triggers: { ...s.lpa_triggers, propertyTrust: true },
        lpa_seeds_shown: [...s.lpa_seeds_shown, 'property_trust'],
        lpa_shown_at_step: s.lpa_shown_at_step.includes(stepNo)
          ? s.lpa_shown_at_step
          : [...s.lpa_shown_at_step, stepNo],
      };
      next = setPriority(next, 'high');
      next = addRecommendedType(next, 'property_financial');
      return { ...prev, lpa_opportunity: next };
    });
  }, [
    solicitorMode,
    currentSectionTitle,
    formValues?.includePropertyTrust,
    formValues?.pt_wants_trust,
    setFormValues,
    stepNo,
  ]);

  // Business
  useEffect(() => {
    if (solicitorMode || currentSectionTitle !== TITLE_BUSINESS) return;
    if (!shouldTriggerBusiness(formValues)) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (s.lpa_seeds_shown.includes('business')) return prev;
      let next = {
        ...s,
        lpa_triggers: { ...s.lpa_triggers, businessInterests: true },
        lpa_seeds_shown: [...s.lpa_seeds_shown, 'business'],
        lpa_shown_at_step: s.lpa_shown_at_step.includes(stepNo)
          ? s.lpa_shown_at_step
          : [...s.lpa_shown_at_step, stepNo],
      };
      next = setPriority(next, 'urgent');
      next = addRecommendedType(next, 'property_financial');
      next = addRecommendedType(next, 'health_welfare');
      return { ...prev, lpa_opportunity: next };
    });
  }, [solicitorMode, currentSectionTitle, formValues?.biz_has_interests, setFormValues, stepNo]);

  // Single / widowed / divorced + no partner (no visible seed — feeds final banner)
  useEffect(() => {
    if (solicitorMode) return;
    if (!shouldTriggerSingleNoPartner(formValues)) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (s.lpa_triggers.singleNoPartner) return prev;
      let next = { ...s, lpa_triggers: { ...s.lpa_triggers, singleNoPartner: true } };
      next = setPriority(next, 'high');
      next = addRecommendedType(next, 'health_welfare');
      next = addRecommendedType(next, 'property_financial');
      return { ...prev, lpa_opportunity: next };
    });
  }, [
    solicitorMode,
    formValues?.maritalStatus,
    formValues?.partnerFullName,
    formValues?.partnerFirstName,
    formValues?.partnerLastName,
    setFormValues,
  ]);

  // Married/civil/cohabiting with partner clears “singleNoPartner” style risk (optional tightening)
  useEffect(() => {
    if (solicitorMode) return;
    if (shouldTriggerSingleNoPartner(formValues)) return;
    if (!hasMeaningfulPartner(formValues)) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (!s.lpa_triggers.singleNoPartner) return prev;
      const { singleNoPartner: _omit, ...restTriggers } = s.lpa_triggers;
      const next = {
        ...s,
        lpa_triggers: restTriggers,
      };
      return { ...prev, lpa_opportunity: next };
    });
  }, [
    solicitorMode,
    formValues?.maritalStatus,
    formValues?.partnerFullName,
    formValues?.partnerFirstName,
    formValues?.partnerLastName,
    setFormValues,
  ]);

  useEffect(() => {
    if (solicitorMode || !showPreSubmitBanner || submitted) return;
    setFormValues((prev) => {
      const s = normalizeLpaState(prev.lpa_opportunity);
      if (s.lpa_final_banner_shown) return prev;
      return { ...prev, lpa_opportunity: { ...s, lpa_final_banner_shown: true } };
    });
  }, [solicitorMode, showPreSubmitBanner, submitted, setFormValues]);

  if (solicitorMode) return null;

  const age = ageFromIsoDob(formValues?.dateOfBirth);
  const dobTooltipText =
    age != null && age >= 65
      ? "Your will covers what happens when you die. A Lasting Power of Attorney covers what happens if you can't make decisions yourself. Both are worth arranging at the same time — ask your solicitor at your appointment."
      : age != null && age >= 18
        ? "Your will covers what happens when you die. A Lasting Power of Attorney covers what happens if you can't make decisions yourself. Your solicitor can advise on both at your appointment."
        : null;

  return (
    <div className="lpa-opportunity-root min-w-0">
      {currentSectionTitle === TITLE_PERSONAL && lpa.lpa_seeds_shown.includes('dob') && dobTooltipText ? (
        <LpaSeedTooltip text={dobTooltipText} />
      ) : null}

      {currentSectionTitle === TITLE_GUARDIANS && lpa.lpa_seeds_shown.includes('child') ? (
        <LpaSeedSoft
          text={
            'Your will names a guardian to care for your children if you die. But if you’re alive and unable to make decisions — through illness or an accident — it’s a Lasting Power of Attorney that gives someone legal authority to act for you, including decisions about your care and welfare.'
          }
          why="Your solicitor can explain the difference between a guardian (will) and an attorney (LPA) at your appointment. No decisions needed now."
        />
      ) : null}

      {currentSectionTitle === TITLE_GUARDIANS && lpa.lpa_seeds_shown.includes('guardian') ? (
        <LpaSeedSoft
          text={
            "You’ve named a guardian for your children — good. Remember: your guardian’s role only begins after your death. If you were alive but incapacitated, it’s a Health & Welfare LPA that appoints someone to make decisions about your care — not the guardian."
          }
          why="Your solicitor will advise on both at your appointment."
        />
      ) : null}

      {currentSectionTitle === TITLE_PROPERTY && lpa.lpa_seeds_shown.includes('property_trust') ? (
        <LpaSeedMedium
          title="Your property trust and an LPA work together"
          text={
            'Your property trust protects this property after your death. But without a Property & Financial Affairs LPA, you wouldn’t be able to manage, sell, or remortgage it if you lost capacity during your lifetime — even as the owner. The trust covers death; the LPA covers incapacity. Your solicitor can advise on both at your appointment.'
          }
        />
      ) : null}

      {currentSectionTitle === TITLE_BUSINESS && lpa.lpa_seeds_shown.includes('business') ? (
        <LpaSeedUrgent
          title='Your will protects your business when you die — but what if you can’t act?'
          body={
            'Without a Property & Financial Affairs LPA, if you lost capacity tomorrow — through a stroke, an accident, or illness — nobody would have legal authority to run your business, access accounts, sign contracts, or make decisions. Not a spouse. Not a co-director. Your business could be at serious risk within days. A Lasting Power of Attorney gives a trusted person that authority immediately.'
          }
          clientResponse={lpa.lpa_client_response}
          disabled={!!lpa.lpa_client_response}
          onRespond={respond}
        />
      ) : null}

      {showPreSubmitBanner && !submitted && lpa.lpa_final_banner_shown ? (
        <LpaFinalBanner
          priority={fb.priority}
          title={fb.title}
          body={fb.body}
          note={fb.note}
          clientResponse={lpa.lpa_client_response}
          onRespond={respond}
        />
      ) : null}
    </div>
  );
}
