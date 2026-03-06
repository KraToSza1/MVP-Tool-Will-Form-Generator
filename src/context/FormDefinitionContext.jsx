import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getFormDefinition } from '../lib/formDefinition.js';
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

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await getFormDefinition();
    setLoading(false);
    if (error || !data) {
      setFormData(staticFormData);
      setIsCustom(false);
      return;
    }
    setFormData(data);
    setIsCustom(true);
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
