import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import FormRenderer from '../components/FormRenderer.jsx';
import { getMatterDetail, saveSolicitorMatter, updateMatterStatus, MATTER_STATUS } from '../lib/matters.js';

export default function MatterEditorPage() {
  const { matterId } = useParams();
  const location = useLocation();
  const [matter, setMatter] = useState(null);
  const [initialValues, setInitialValues] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const openAtSection = location.state?.openAtSection;
    console.log('[WillTool Flow] Solicitor opening matter editor', { matterId, openAtSection, phase: 'solicitor_editor_open_start' });

    getMatterDetail(matterId).then((result) => {
      if (!active) return;
      if (result.error) {
        console.warn('[WillTool Flow] Matter editor load failed', { matterId, error: result.error });
        toast.error('Could not open matter', { description: result.error });
      } else {
        setMatter(result.matter || null);
        const stepFromMatter = result.matter?.current_step ?? 0;
        const initialStep = typeof openAtSection === 'number' && openAtSection >= 0 ? openAtSection : stepFromMatter;
        setInitialValues({
          formValues: result.mergedPayload || {},
          currentIndex: initialStep,
          referenceNumber: result.matter?.client_reference || result.matter?.session_ref || 'SOLICITOR',
        });
        console.log('[WillTool Flow] Matter editor loaded; form ready for solicitor', { matterId, clientRef: result.matter?.client_reference, currentStep: initialStep, openAtSection: openAtSection ?? '(none)' });
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [matterId, location.state]);

  const persistenceAdapter = useMemo(() => {
    if (!matter) return null;

    return {
      type: 'matter',
      shareEnabled: false,
      save: async ({ formValues, currentIndex, saveType }) => {
        const result = await saveSolicitorMatter(matter.id, formValues, currentIndex);
        if (saveType === 'manual') {
          if (result.error) {
            toast.error('Could not save solicitor draft', { description: result.error });
          } else {
            toast.success('Solicitor draft saved', { description: 'Matter updates have been written to Supabase.' });
          }
        }
        return result;
      },
      submit: async ({ formValues, currentIndex }) => {
        const saveResult = await saveSolicitorMatter(matter.id, formValues, currentIndex);
        if (saveResult.error) {
          return saveResult;
        }

        const statusResult = await updateMatterStatus(matter.id, MATTER_STATUS.IN_REVIEW, {
          reviewed_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        });

        if (statusResult.error) {
          return statusResult;
        }

        toast.success('Matter saved for review', {
          description: 'Solicitor-only changes were stored and the matter is now marked in review.',
        });
        return { ok: true };
      },
    };
  }, [matter]);

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading solicitor editor...</div>;
  }

  if (!matter || !initialValues || !persistenceAdapter) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Matter not found.</div>;
  }

  return (
    <div className="space-y-4">
      <Link to={`/solicitor/matters/${matter.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} />
        Back to matter overview
      </Link>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h1 className="text-xl font-bold text-slate-900">Edit questionnaire</h1>
          <p className="text-sm text-slate-600 mt-1">
            You can change any client answers, complete Testamentary Capacity, and add or correct information. Use the steps on the left to move between sections. Save often; your changes are stored on the matter.
          </p>
        </div>

        <div className="p-4 sm:p-6">
          <FormRenderer
            initialFormState={initialValues}
            externalPersistence={persistenceAdapter}
          />
        </div>
      </div>
    </div>
  );
}
