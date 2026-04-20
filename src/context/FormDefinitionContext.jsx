/* eslint-disable react-refresh/only-export-components -- provider + hook pattern */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getFormDefinition } from '../lib/formDefinition.js';
import { mattersLoadTrace } from '../lib/mattersLoadTrace.js';
import { qLog } from '../lib/questionnaireLog.js';
import staticFormData from '../data/Complete-WillSuite-Form-Data.json';
import { mergeFormDefinitions } from '../utils/mergeFormDefinitions.js';

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
    if (!silent) {
      mattersLoadTrace('FormDefinition refresh start (parallel with matters list — same tab network)', {});
      setLoading(true);
    }
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
       * Supabase always wins when it has valid data — solicitor edits persist
       * across code deploys. Any sections or fields added by a developer in the
       * bundled JSON that are missing from Supabase are merged in automatically.
       */
      const merged = mergeFormDefinitions(data, staticFormData);
      qLog('refresh_complete', {
        silent,
        isCustom: true,
        sectionCount: merged.formSections?.length,
        remoteSections: data.formSections?.length,
        bundleSections: staticFormData.formSections?.length,
        getMs: ms,
      });
      setFormData(merged);
      setIsCustom(true);
    } catch (e) {
      qLog('refresh_failed', { silent, message: e?.message || String(e) });
      if (!silent) {
        mattersLoadTrace('FormDefinition refresh FAILED', { message: e?.message || String(e) });
      }
      throw e;
    } finally {
      if (!silent) {
        const ms = t0 && typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
        mattersLoadTrace('FormDefinition refresh finished (questionnaire JSON)', { getMs: ms });
        setLoading(false);
      }
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
