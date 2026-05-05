import React, { useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import FormRenderer from '../components/FormRenderer.jsx';
import {
  BROWSER_CLIENT_DRAFT_STORAGE_KEYS,
  shouldClearBrowserDraftForFreshIntake,
} from '../lib/clientIntakeFresh.js';

export default function PublicIntakePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [draftPurgeHandled, setDraftPurgeHandled] = useState(
    () => !shouldClearBrowserDraftForFreshIntake(location.search),
  );

  useLayoutEffect(() => {
    if (!shouldClearBrowserDraftForFreshIntake(location.search)) {
      setDraftPurgeHandled(true);
      return;
    }
    BROWSER_CLIENT_DRAFT_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
    navigate('/', { replace: true });
    setDraftPurgeHandled(true);
  }, [location.search, navigate]);

  if (!draftPurgeHandled) {
    return (
      <div
        className="flex min-h-48 flex-col items-center justify-center gap-2 px-4 py-10"
        aria-busy="true"
      >
        <p className="text-center text-sm text-gray-600">Preparing a new questionnaire…</p>
      </div>
    );
  }

  return <FormRenderer />;
}
