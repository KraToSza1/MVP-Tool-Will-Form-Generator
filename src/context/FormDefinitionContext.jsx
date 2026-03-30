import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getFormDefinition } from '../lib/formDefinition.js';
import { qLog } from '../lib/questionnaireLog.js';
import staticFormData from '../data/Complete-WillSuite-Form-Data.json';

const FormDefinitionContext = createContext({
  formData: staticFormData,
  loading: false,
  isCustom: false,
  refresh: () => {},
});

export function FormDefinitionProvider({ children }) {
  const [formData, setFormData] = useState(staticFormData);
  const [loading, setLoading] = useState(true);
  const [isCustom, setIsCustom] = useState(false);

  /**
   * Reload questionnaire from Supabase.
   * @param {{ silent?: boolean }} opts - If silent, do not set global loading (avoids blocking the editor after save).
   */
  const refresh = useCallback(async (opts = {}) => {
    const silent = opts.silent === true;
    qLog('refresh_start', { silent });
    if (!silent) setLoading(true);
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    try {
      const { data, error } = await getFormDefinition();
      const ms = t0 && typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
      if (error || !data) {
        qLog('refresh_complete', { silent, isCustom: false, usedStatic: true, error: error || null, getMs: ms });
        setFormData(staticFormData);
        setIsCustom(false);
        return;
      }
      /*
       * Supabase `form_definitions` replaces the bundled questionnaire at runtime.
       * If the DB row is older than this deploy's bundle (no/missing _schemaRevision), clients
       * would see stale questions — "changes disappeared" after a publish or session change.
       */
      const bundledRev = Number(staticFormData._schemaRevision) || 0;
      const remoteRev = Number(data._schemaRevision) || 0;
      if (remoteRev < bundledRev) {
        qLog('refresh_complete', {
          silent,
          isCustom: false,
          usedStatic: true,
          reason: 'remote_questionnaire_older_than_bundle',
          bundledRev,
          remoteRev,
          getMs: ms,
        });
        setFormData(staticFormData);
        setIsCustom(false);
        return;
      }
      qLog('refresh_complete', { silent, isCustom: true, sectionCount: data.formSections?.length, getMs: ms });
      setFormData(data);
      setIsCustom(true);
    } catch (e) {
      qLog('refresh_failed', { silent, message: e?.message || String(e) });
      throw e;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = {
    formData,
    loading,
    isCustom,
    refresh,
  };

  return (
    <FormDefinitionContext.Provider value={value}>
      {children}
    </FormDefinitionContext.Provider>
  );
}

export function useFormDefinition() {
  const ctx = useContext(FormDefinitionContext);
  if (!ctx) {
    return {
      formData: staticFormData,
      loading: false,
      isCustom: false,
      refresh: () => {},
    };
  }
  return ctx;
}
