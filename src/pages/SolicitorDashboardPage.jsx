import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldAlert, ClipboardCheck, BriefcaseBusiness, FileClock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { listMatters, MATTER_STATUS } from '../lib/matters.js';
import MatterStatusBadge from '../components/solicitor/MatterStatusBadge.jsx';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All matters' },
  { value: MATTER_STATUS.SUBMITTED, label: 'Submitted' },
  { value: MATTER_STATUS.VERIFICATION_PENDING, label: 'Verification pending' },
  { value: MATTER_STATUS.IN_REVIEW, label: 'In review' },
  { value: MATTER_STATUS.COMPLETED, label: 'Completed' },
];

function formatDate(value) {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString();
}

export default function SolicitorDashboardPage() {
  const { user } = useAuth();
  const [matters, setMatters] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [assignedOnly, setAssignedOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listMatters({ search, status, assignedOnly, userId: user?.id }).then((result) => {
      if (!active) return;
      if (result.error) {
        toast.error('Could not load matters', { description: result.error });
        setMatters([]);
      } else {
        setMatters(result.data || []);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [assignedOnly, search, status, user?.id]);

  const stats = useMemo(() => {
    return matters.reduce((acc, matter) => {
      acc.total += 1;
      acc[matter.status] = (acc[matter.status] || 0) + 1;
      if (matter.outstanding_verification) acc.outstandingVerification += 1;
      return acc;
    }, {
      total: 0,
      submitted: 0,
      verification_pending: 0,
      in_review: 0,
      completed: 0,
      outstandingVerification: 0,
    });
  }, [matters]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3 text-slate-600">
            <BriefcaseBusiness size={18} />
            <span className="text-sm font-medium">Total matters</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-blue-800">
            <FileClock size={18} />
            <span className="text-sm font-medium">Submitted</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-blue-900">{stats.submitted}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-amber-800">
            <ShieldAlert size={18} />
            <span className="text-sm font-medium">Verification pending</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-amber-900">{stats.verification_pending}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-indigo-800">
            <ClipboardCheck size={18} />
            <span className="text-sm font-medium">In review</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-indigo-900">{stats.in_review}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-3 text-emerald-800">
            <ClipboardCheck size={18} />
            <span className="text-sm font-medium">Completed</span>
          </div>
          <p className="mt-4 text-3xl font-bold text-emerald-900">{stats.completed}</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Matter dashboard</h1>
            <p className="text-sm text-slate-600 mt-1">
              Search by client reference, name, email, or phone. Review status, verification, and next action.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Search</span>
              <div className="mt-2 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Reference, name, email, phone"
                  className="w-full rounded-xl border border-slate-300 px-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={assignedOnly}
                onChange={(event) => setAssignedOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Assigned to me
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Verification</th>
                <th className="px-5 py-3">Last activity</th>
                <th className="px-5 py-3">Next step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-slate-600" colSpan={6}>Loading matters...</td>
                </tr>
              ) : matters.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-slate-600" colSpan={6}>No matters match the current filters.</td>
                </tr>
              ) : matters.map((matter) => (
                <tr key={matter.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link to={`/solicitor/matters/${matter.id}`} className="font-semibold text-indigo-700 hover:text-indigo-900">
                      {matter.client_reference}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">{matter.client_name || matter.client_snapshot?.fullName || 'Unknown client'}</p>
                    <p>{matter.client_email || matter.client_snapshot?.email || 'No email captured'}</p>
                    <p>{matter.client_phone || matter.client_snapshot?.phoneNumber || 'No phone captured'}</p>
                  </td>
                  <td className="px-5 py-4"><MatterStatusBadge status={matter.status} /></td>
                  <td className="px-5 py-4 text-sm text-slate-700">
                    {matter.outstanding_verification ? 'Outstanding' : 'Complete'}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-700">{formatDate(matter.last_activity_at)}</td>
                  <td className="px-5 py-4 text-sm text-slate-700">
                    <Link to={`/solicitor/matters/${matter.id}`} className="font-semibold text-slate-900 hover:text-indigo-700">
                      Review matter
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
