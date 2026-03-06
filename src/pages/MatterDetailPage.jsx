import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, FilePenLine, Save } from 'lucide-react';
import MatterStatusBadge from '../components/solicitor/MatterStatusBadge.jsx';
import { assignMatter, getMatterDetail, listStaffProfiles, MATTER_STATUS, updateMatterStatus, updateSolicitorNotes } from '../lib/matters.js';

function formatDate(value) {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString();
}

export default function MatterDetailPage() {
  const { matterId } = useParams();
  const [matter, setMatter] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solicitorNotes, setSolicitorNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getMatterDetail(matterId), listStaffProfiles()]).then(([detailResult, staffResult]) => {
      if (!active) return;
      if (detailResult.error) {
        toast.error('Could not load matter', { description: detailResult.error });
      } else {
        setMatter(detailResult.matter || null);
        setActivity(detailResult.activity || []);
        setSolicitorNotes(detailResult.matter?.solicitor_notes || '');
      }

      if (staffResult.error) {
        toast.error('Could not load staff list', { description: staffResult.error });
      } else {
        setStaffProfiles(staffResult.data || []);
      }

      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [matterId]);

  const clientSnapshot = useMemo(() => matter?.client_snapshot || {}, [matter]);

  const handleStatusChange = async (nextStatus) => {
    if (!matter) return;

    const changes = {
      reviewed_at: nextStatus === MATTER_STATUS.IN_REVIEW ? new Date().toISOString() : matter.reviewed_at,
      completed_at: nextStatus === MATTER_STATUS.COMPLETED ? new Date().toISOString() : matter.completed_at,
      verification_completed_at: nextStatus === MATTER_STATUS.VERIFICATION_PENDING
        ? null
        : matter.verification_completed_at,
      outstanding_verification: nextStatus === MATTER_STATUS.VERIFICATION_PENDING,
      last_activity_at: new Date().toISOString(),
    };

    const result = await updateMatterStatus(matter.id, nextStatus, changes);
    if (result.error) {
      toast.error('Status update failed', { description: result.error });
      return;
    }

    setMatter((prev) => prev ? { ...prev, ...result.data } : prev);
    toast.success('Matter updated', { description: `Status set to ${nextStatus.replaceAll('_', ' ')}.` });
  };

  const handleSaveNotes = async () => {
    if (!matter) return;
    setSavingNotes(true);
    const result = await updateSolicitorNotes(matter.id, solicitorNotes);
    setSavingNotes(false);
    if (result.error) {
      toast.error('Could not save notes', { description: result.error });
      return;
    }
    setMatter((prev) => prev ? { ...prev, solicitor_notes: result.data?.solicitor_notes || solicitorNotes } : prev);
    toast.success('Notes saved', { description: 'Solicitor notes updated for this matter.' });
  };

  const handleAssignmentChange = async (event) => {
    if (!matter) return;
    const assignedSolicitorId = event.target.value || null;
    const result = await assignMatter(matter.id, assignedSolicitorId);
    if (result.error) {
      toast.error('Could not assign matter', { description: result.error });
      return;
    }
    setMatter((prev) => prev ? { ...prev, assigned_solicitor_id: result.data?.assigned_solicitor_id || null } : prev);
    toast.success('Assignment updated', { description: assignedSolicitorId ? 'Matter reassigned successfully.' : 'Matter unassigned.' });
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading matter...</div>;
  }

  if (!matter) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Matter not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/solicitor" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <Link
          to={`/solicitor/matters/${matter.id}/form`}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <FilePenLine size={16} />
          Continue in solicitor mode
        </Link>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Matter</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{matter.client_reference}</h1>
              <p className="mt-1 text-sm text-slate-600">Submitted {formatDate(matter.submitted_at)}</p>
            </div>
            <MatterStatusBadge status={matter.status} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client name</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.client_name || clientSnapshot.fullName || 'Unknown client'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.client_email || clientSnapshot.email || 'Not captured'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.client_phone || clientSnapshot.phoneNumber || 'Not captured'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.outstanding_verification ? 'Outstanding' : 'Complete'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned solicitor</p>
              <select
                value={matter.assigned_solicitor_id || ''}
                onChange={handleAssignmentChange}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {staffProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name || profile.email} ({profile.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Workflow actions</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.SUBMITTED)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400">Mark submitted</button>
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.VERIFICATION_PENDING)} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 hover:border-amber-400">Verification pending</button>
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.IN_REVIEW)} className="rounded-xl border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-900 hover:border-indigo-400">Mark in review</button>
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.COMPLETED)} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 hover:border-emerald-400">Mark completed</button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Solicitor notes</p>
          <p className="text-sm text-slate-600 mt-1">Internal notes remain outside the client-facing intake workflow.</p>
          <textarea
            value={solicitorNotes}
            onChange={(event) => setSolicitorNotes(event.target.value)}
            rows={12}
            className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Record review notes, missing instructions, verification follow-up, or execution reminders."
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
          >
            <Save size={16} />
            {savingNotes ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Activity history</h2>
        <div className="mt-4 space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-600">No activity has been recorded yet.</p>
          ) : activity.map((item) => (
            <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{item.action}</p>
                <p className="text-xs text-slate-500">{formatDate(item.created_at)}</p>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{item.actor_type}</p>
              {item.metadata && Object.keys(item.metadata).length > 0 ? (
                <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-700 border border-slate-200">{JSON.stringify(item.metadata, null, 2)}</pre>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
