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
    try {
      const { data, error } = await getFormDefinition();
      if (error || !data) {
        qLog('refresh_complete', { silent, isCustom: false, usedStatic: true, error: error || null });
        setFormData(staticFormData);
        setIsCustom(false);
        return;
      }
      qLog('refresh_complete', { silent, isCustom: true, sectionCount: data.formSections?.length });
      setFormData(data);
      setIsCustom(true);
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
