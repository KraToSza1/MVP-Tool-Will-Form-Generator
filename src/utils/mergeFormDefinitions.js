/**
 * Guardians: always use bundled field definitions so deploys fix structure
 * (hidden appointGuardians, guided-only flow, client-hidden legacy sections)
 * even when Supabase still has an older radio + labels. Custom fields in this
 * section (e.g. custom_*) are preserved after the pinned block.
 */
const GUARDIAN_SCHEMA_PINNED_IDS = new Set([
  'appointGuardians',
  'guardianGuidedFlow',
  'guardianFlowState',
  'guardiansSection',
  'substituteGuardiansSection',
]);

const SPECIFIC_GIFTS_PINNED_IDS = new Set(['leaveSpecificGifts', 'specificGiftsSection', 'failedSpecificGiftPassProportionately']);

function pinGuardianFieldsFromBundle(merged, bundle) {
  const bundleSec = bundle.formSections?.find((s) => s.formSection === 'Guardians');
  const mergedIdx = merged.formSections?.findIndex((s) => s.formSection === 'Guardians');
  if (!bundleSec?.fields || mergedIdx < 0) return;

  const mergedSec = merged.formSections[mergedIdx];
  const mergedFields = mergedSec.fields || [];

  const pinnedFromBundle = bundleSec.fields
    .filter((f) => f.id && GUARDIAN_SCHEMA_PINNED_IDS.has(f.id))
    .map((f) => JSON.parse(JSON.stringify(f)));

  const tail = mergedFields.filter((f) => f.id && !GUARDIAN_SCHEMA_PINNED_IDS.has(f.id));

  mergedSec.fields = [...pinnedFromBundle, ...tail];
}

function pinSpecificGiftsFieldsFromBundle(merged, bundle) {
  const bundleSec = bundle.formSections?.find((s) => s.formSection === 'Specific Gifts');
  const mergedIdx = merged.formSections?.findIndex((s) => s.formSection === 'Specific Gifts');
  if (!bundleSec?.fields || mergedIdx < 0) return;

  const mergedSec = merged.formSections[mergedIdx];
  const mergedFields = mergedSec.fields || [];

  const pinnedFromBundle = bundleSec.fields
    .filter((f) => f.id && SPECIFIC_GIFTS_PINNED_IDS.has(f.id))
    .map((f) => JSON.parse(JSON.stringify(f)));

  const tail = mergedFields.filter((f) => f.id && !SPECIFIC_GIFTS_PINNED_IDS.has(f.id));

  mergedSec.fields = [...pinnedFromBundle, ...tail];
}

/**
 * Merge a Supabase-saved questionnaire with the bundled factory default.
 *
 * Priority: Supabase wins for everything it already has (labels, placeholders,
 * options, help text, section order). The bundle fills in any sections or
 * fields the Supabase version is missing (e.g. a developer added a new
 * Estate Overview section in code — it appears automatically without
 * overwriting the solicitor's other edits).
 *
 * @param {object} remote  - The questionnaire from Supabase (user-customised).
 * @param {object} bundle  - The bundled JSON shipped with the deploy.
 * @returns {object}         Merged questionnaire (deep-cloned, safe to mutate).
 */
export function mergeFormDefinitions(remote, bundle) {
  if (!remote || !Array.isArray(remote?.formSections)) return bundle;
  if (!bundle || !Array.isArray(bundle?.formSections)) return remote;

  const merged = JSON.parse(JSON.stringify(remote));

  const allRemoteFieldIds = new Set();
  merged.formSections.forEach((s) =>
    (s.fields || []).forEach((f) => {
      if (f.id) allRemoteFieldIds.add(f.id);
    })
  );

  const remoteSectionNames = new Map();
  merged.formSections.forEach((s, i) => {
    remoteSectionNames.set(s.formSection, i);
  });

  for (const bundleSec of bundle.formSections) {
    const idx = remoteSectionNames.get(bundleSec.formSection);

    if (idx == null) {
      const cloned = JSON.parse(JSON.stringify(bundleSec));
      cloned._mergedFromBundle = true;
      merged.formSections.push(cloned);
      (cloned.fields || []).forEach((f) => {
        if (f.id) allRemoteFieldIds.add(f.id);
      });
      continue;
    }

    const remoteSec = merged.formSections[idx];
    const secFieldIds = new Set((remoteSec.fields || []).map((f) => f.id));
    remoteSec.fields = remoteSec.fields || [];

    for (const bundleField of bundleSec.fields || []) {
      if (!bundleField.id) continue;
      if (secFieldIds.has(bundleField.id) || allRemoteFieldIds.has(bundleField.id)) continue;
      remoteSec.fields.push(JSON.parse(JSON.stringify(bundleField)));
      allRemoteFieldIds.add(bundleField.id);
    }
  }

  // Strip fields from the remote that were intentionally removed from the bundle.
  // Collect every field id in the bundle (top-level only, matching the merge granularity).
  const allBundleFieldIds = new Set();
  bundle.formSections.forEach((s) =>
    (s.fields || []).forEach((f) => { if (f.id) allBundleFieldIds.add(f.id); })
  );
  for (const sec of merged.formSections) {
    if (!Array.isArray(sec.fields)) continue;
    sec.fields = sec.fields.filter((f) => {
      if (!f.id) return true;
      if (f.id.startsWith('custom_')) return true;
      return allBundleFieldIds.has(f.id);
    });
  }

  merged._schemaRevision = Math.max(
    Number(remote._schemaRevision) || 0,
    Number(bundle._schemaRevision) || 0
  );

  pinGuardianFieldsFromBundle(merged, bundle);
  pinSpecificGiftsFieldsFromBundle(merged, bundle);

  return merged;
}
