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

  merged._schemaRevision = Math.max(
    Number(remote._schemaRevision) || 0,
    Number(bundle._schemaRevision) || 0
  );

  return merged;
}
