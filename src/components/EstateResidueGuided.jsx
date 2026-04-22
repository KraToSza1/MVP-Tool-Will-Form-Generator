/**
 * Estate Administration / Residue — guided intake (Apr 2026 handoff).
 * Maps to existing form value keys for PDF / clauses; client-facing only.
 */
import React, { useCallback, useId, useMemo, useState } from 'react';
import { FileText, Info, Landmark, Plus, Trash2, CircleHelp } from 'lucide-react';
import { getContactCandidates, personDisplayNameForGift } from '../lib/personRegistry.js';
import { emptyPersonRecord } from '../utils/personRecordSpecs.js';
import { TRUST_END, textForTrustEnd } from '../utils/estateResidueGuidedShared.js';

const uid = () => `er-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

function fmtFurtherDetails(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  return rows
    .map((r, i) => {
      const n = String(r.name || '').trim();
      if (!n) return null;
      const rel = String(r.relationship || '').trim();
      const sh = String(r.share || '').trim();
      return `${i + 1}) ${n}${rel ? ` — ${rel}` : ''}${sh ? `; ${sh}` : ''}`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * @param {{ field: object, formValues: object, setFormValues: function }} props
 */
function EstateResidueGuided({ field: _field, formValues, setFormValues }) {
  const id = useId();
  const card = 'rounded-xl border p-3 sm:p-4 md:p-5 min-w-0';
  const cardC = 'border-slate-200 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-800/80 dark:text-slate-100';

  const dist = formValues.howResidueDistributed;
  const isShares = dist === 'AsShares';
  const isFlit = dist === 'IntoFLIT';
  const charity = formValues.give10PercentToCharity === 'Yes';
  const furtherYes = formValues.specifyFurtherResidualGiftsOnFail === 'Yes';
  const sepYes = formValues.appointSeparateTrusteesFLIT === 'Yes';
  const furtherRows = useMemo(
    () =>
      Array.isArray(formValues.furtherResidualFallbackRows)
        ? formValues.furtherResidualFallbackRows
        : [],
    [formValues.furtherResidualFallbackRows]
  );
  const [furtherName, setFurtherName] = useState('');
  const [furtherRel, setFurtherRel] = useState('');
  const [furtherShare, setFurtherShare] = useState('');

  const contactOpts = useMemo(() => {
    return getContactCandidates(formValues).filter((c) => personDisplayNameForGift(c.data) !== '');
  }, [formValues]);

  const apply = useCallback(
    (patch) => {
      setFormValues((prev) => ({ ...prev, ...patch }));
    },
    [setFormValues]
  );

  const setTrustEndMode = (mode) => {
    apply({
      flitTrustEndMode: mode,
      _flitTrustEndMode: mode,
      trustEndDistributionDetails: textForTrustEnd(mode),
    });
  };

  const syncLifeTenant = useCallback(
    (lt) => {
      const name = String(lt.name || '').trim();
      const rel = String(lt.rel || '').trim();
      const line = [name, rel ? `(${rel})` : ''].filter(Boolean).join(' ');
      apply({ lifeTenantDetails: line, flitLifeTenantName: name, flitLifeTenantRel: rel });
    },
    [apply]
  );

  const onLifetimeExisting = (which, e) => {
    const v = e.target.value;
    if (!v) return;
    const opt = contactOpts.find((c) => c.id === v);
    if (opt?.data) {
      const d = opt.data;
      const name = [d.title, d.firstName, d.lastName].filter(Boolean).join(' ').trim() || personDisplayNameForGift(d);
      if (which === 'lt') {
        syncLifeTenant({ name, rel: d.relationship || '' });
      }
    }
  };

  const setDistribution = (key) => {
    const next = { howResidueDistributed: key === 'shares' ? 'AsShares' : 'IntoFLIT' };
    if (key === 'shares') {
      Object.assign(next, {
        powerToRevokeLifeInterest: '',
        appointSeparateTrusteesFLIT: '',
        lifeTenantDetails: '',
        beneficiariesDetails: '',
        trustEndDistributionDetails: '',
        flitTrustEndMode: '',
        flitLifeTenantName: '',
        flitLifeTenantRel: '',
        separateTrusteeData: undefined,
        failedResiduePassProportionately: formValues.failedResiduePassProportionately || 'No',
      });
    } else {
      Object.assign(next, { residualGiftsDetails: '', failedResiduePassProportionately: '' });
    }
    apply(next);
  };

  const separateRows = Array.isArray(formValues.separateTrusteeData) ? formValues.separateTrusteeData : [];

  const addSeparateTrustee = () => {
    const row = { ...emptyPersonRecord(), _personRecordId: uid(), title: 'Mr', firstName: '', lastName: '' };
    apply({ separateTrusteeData: [...separateRows, row] });
  };
  const removeSeparateTrustee = (idx) => {
    apply({ separateTrusteeData: separateRows.filter((_, i) => i !== idx) });
  };
  const patchTrustee = (idx, p) => {
    const n = separateRows.map((r, i) => (i === idx ? { ...r, ...p } : r));
    apply({ separateTrusteeData: n });
  };

  const addFurtherRow = () => {
    const n = String(furtherName || '').trim();
    if (!n) return;
    const row = { name: n, relationship: String(furtherRel || '').trim(), share: String(furtherShare || '').trim() };
    const list = [...furtherRows, row];
    apply({
      furtherResidualFallbackRows: list,
      furtherResidualGiftsDetails: fmtFurtherDetails(list),
    });
    setFurtherName('');
    setFurtherRel('');
    setFurtherShare('');
  };
  const removeFurtherRow = (idx) => {
    const list = furtherRows.filter((_, i) => i !== idx);
    apply({ furtherResidualFallbackRows: list, furtherResidualGiftsDetails: fmtFurtherDetails(list) });
  };

  return (
    <div className="min-w-0 max-w-3xl space-y-6" data-field-id={_field.id}>
      <div className="flex min-h-0 flex-col gap-2 rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-3 sm:flex-row sm:items-start sm:gap-3 dark:border-amber-500/30 dark:bg-amber-950/20">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" aria-hidden="true" />
        <p className="min-w-0 text-sm text-amber-950 dark:text-amber-100">
          <span className="block font-bold">Residue of your estate</span>
          <span className="mt-0.5 block text-xs sm:text-sm leading-relaxed break-words">
            This is what remains after any specific cash gifts, property, and chattels are dealt with. The choices here are binding for your will — your
            solicitor will check them at your instruction-taking appointment.
          </span>
        </p>
      </div>

      {/* Q1 */}
      <div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">How would you like the remainder of your estate to be distributed?</h3>
        <p className="mt-1.5 text-xs sm:text-sm italic text-slate-500 dark:text-slate-400 flex gap-2 break-words">
          <CircleHelp className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          The residue is everything left after specific gifts. You can share it out directly, or use a life-interest trust to protect a spouse/partner
          and then pass to others (e.g. children).
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setDistribution('shares')}
            className={`min-h-[44px] rounded-xl border-2 p-4 text-left transition-colors ${
              isShares
                ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/60'
            }`}
          >
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">As shares — distribute outright</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Divide the residuary estate between named people in set shares. Most common for straightforward estates.</p>
          </button>
          <button
            type="button"
            onClick={() => setDistribution('flit')}
            className={`min-h-[44px] rounded-xl border-2 p-4 text-left transition-colors ${
              isFlit
                ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/60'
            }`}
          >
            <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Into a Flexible Life Interest Trust (FLIT)</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">Someone benefits for their lifetime, then the trust passes to your final beneficiaries — useful for blended families.</p>
          </button>
        </div>
      </div>

      {isFlit ? (
        <div className={`${card} border-orange-200 bg-orange-50/90 dark:border-orange-500/30 dark:bg-orange-950/20`}>
          <p className="text-sm font-bold text-orange-900 dark:text-orange-200">Solicitor action (FLIT)</p>
          <p className="mt-1 text-xs sm:text-sm text-orange-800 dark:text-orange-100/90 break-words">
            You have chosen a life-interest trust. Your solicitor will use your answers to draft the full trust wording, residual gift clause, and
            trustee powers. The PDF may show placeholders where formal drafting is still required in some firm workflows.
          </p>
        </div>
      ) : null}

      {/* As shares: residual text */}
      {isShares ? (
        <div className={`${card} ${cardC}`}>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Who should share your residuary estate, and in what proportions?</h4>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Describe the shares in your own words. Your solicitor will put this into the formal will clause.</p>
          <label htmlFor={`${id}-resid`} className="mt-2 block text-xs font-semibold text-slate-700 dark:text-slate-200">
            Residuary gift details
          </label>
          <textarea
            id={`${id}-resid`}
            rows={5}
            className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            value={formValues.residualGiftsDetails || ''}
            onChange={(e) => apply({ residualGiftsDetails: e.target.value })}
            placeholder="e.g. 50% to my wife Jane, 25% to each of my two children in equal shares…"
          />
        </div>
      ) : null}

      {/* FLIT block */}
      {isFlit ? (
        <div className="space-y-6 border-t border-slate-200 pt-6 dark:border-slate-600">
          <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-300">Flexible life interest trust</h4>

          <div>
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Should the trustees be able to reduce or end the life interest during the life tenant&apos;s lifetime?</h5>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This allows flexibility to advance capital to other beneficiaries (e.g. children) when appropriate. Usually recommended.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {[
                { v: 'Yes', l: 'Yes (recommended) — flexible' },
                { v: 'No', l: 'No — life interest is fixed until death' },
              ].map((o) => (
                <label
                  key={o.v}
                  className={`flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    formValues.powerToRevokeLifeInterest === o.v
                      ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    className="h-4 w-4 accent-indigo-600"
                    name={`${id}-revoke`}
                    checked={formValues.powerToRevokeLifeInterest === o.v}
                    onChange={() => apply({ powerToRevokeLifeInterest: o.v })}
                  />
                  <span className="min-w-0 break-words">{o.l}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Appoint separate trustees for this trust only?</h5>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {[
                { v: 'No', l: 'No — my executors will be trustees' },
                { v: 'Yes', l: 'Yes — I want different trustees' },
              ].map((o) => (
                <label
                  key={o.v}
                  className={`flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    formValues.appointSeparateTrusteesFLIT === o.v
                      ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    className="h-4 w-4 accent-indigo-600"
                    name={`${id}-sep`}
                    checked={formValues.appointSeparateTrusteesFLIT === o.v}
                    onChange={() =>
                      apply({
                        appointSeparateTrusteesFLIT: o.v,
                        separateTrusteeData: o.v === 'No' ? [] : formValues.separateTrusteeData || [],
                      })
                    }
                  />
                  <span className="min-w-0 break-words">{o.l}</span>
                </label>
              ))}
            </div>
          </div>

          {sepYes ? (
            <div className={`${card} border-indigo-200 bg-slate-50 dark:border-indigo-500/40 dark:bg-slate-800/50`}>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Name your separate trustees</p>
              {separateRows.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">Add at least one trustee (same person as elsewhere on the form, or a new name).</p>
              ) : null}
              {separateRows.map((row, i) => (
                <div key={row._personRecordId || i} className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-2">
                    <label className="text-xs text-slate-600 dark:text-slate-300">Title</label>
                    <input
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      value={row.title || ''}
                      onChange={(e) => patchTrustee(i, { title: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-xs text-slate-600 dark:text-slate-300">First name</label>
                    <input
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      value={row.firstName || ''}
                      onChange={(e) => patchTrustee(i, { firstName: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="text-xs text-slate-600 dark:text-slate-300">Last name</label>
                    <input
                      className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      value={row.lastName || ''}
                      onChange={(e) => patchTrustee(i, { lastName: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2 flex sm:justify-end">
                    <button
                      type="button"
                      className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      onClick={() => removeSeparateTrustee(i)}
                      aria-label="Remove trustee"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addSeparateTrustee}
                className="mt-1 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" /> Add trustee
              </button>
            </div>
          ) : null}

            <div>
              <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">Life tenant — from people already in this form (optional)</label>
            <select
              className="mt-1 w-full max-w-md rounded-lg border-2 border-indigo-200 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-indigo-500/40 dark:bg-slate-900 dark:text-slate-100"
              value=""
              key={`${dist}-lt-pick`}
              onChange={(e) => onLifetimeExisting('lt', e)}
            >
              <option value="">Select someone…</option>
              {contactOpts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200" htmlFor={`${id}-ltname`}>
                  Full name
                </label>
                <input
                  id={`${id}-ltname`}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={String(formValues.flitLifeTenantName ?? '').trim() ? formValues.flitLifeTenantName : (String(formValues.lifeTenantDetails || '').split('(')[0] || '').trim()}
                  onChange={(e) =>
                    syncLifeTenant({
                      name: e.target.value,
                      rel: formValues.flitLifeTenantRel || '',
                    })
                  }
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-200" htmlFor={`${id}-ltrel`}>
                  Relationship (optional)
                </label>
                <input
                  id={`${id}-ltrel`}
                  className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={formValues.flitLifeTenantRel || ''}
                  onChange={(e) =>
                    syncLifeTenant({
                      name: formValues.flitLifeTenantName || String(formValues.lifeTenantDetails || '').split('(')[0].trim() || '',
                      rel: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-100" htmlFor={`${id}-bene`}>
              Final beneficiaries (when the life interest ends)
            </label>
            <p className="text-xs text-slate-500 dark:text-slate-400">Name who should inherit the trust fund after the life tenant — your solicitor will fix exact shares.</p>
            <textarea
              id={`${id}-bene`}
              rows={3}
              className="mt-1 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={formValues.beneficiariesDetails || ''}
              onChange={(e) => apply({ beneficiariesDetails: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">When the life interest ends, how should assets be distributed?</label>
            <select
              className="mt-1 w-full max-w-lg rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              value={formValues.flitTrustEndMode || formValues._flitTrustEndMode || ''}
              onChange={(e) => setTrustEndMode(e.target.value)}
            >
              <option value="">Select…</option>
              <option value={TRUST_END.toBeneficiaries}>Equally to the named beneficiaries above</option>
              <option value={TRUST_END.perStirpes}>To named beneficiaries, per stirpes if a beneficiary dies first</option>
              <option value={TRUST_END.solicitor}>My solicitor will specify at my appointment</option>
            </select>
            {formValues.trustEndDistributionDetails ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 italic break-words">{formValues.trustEndDistributionDetails}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Q5 */}
      <div className="border-t border-slate-200 pt-6 dark:border-slate-600">
        <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">If all main residuary gifts fail, name a last-resort backup?</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">This is unusual — if every main residuary beneficiary dies before you, your estate can otherwise fall into intestacy.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {['No', 'Yes'].map((o) => (
            <label
              key={o}
              className={`flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                formValues.specifyFurtherResidualGiftsOnFail === o
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                  : 'border-slate-200 dark:border-slate-600'
              }`}
            >
              <input
                type="radio"
                className="h-4 w-4 accent-indigo-600"
                name={`${id}-further`}
                checked={formValues.specifyFurtherResidualGiftsOnFail === o}
                onChange={() => {
                  if (o === 'No') {
                    apply({ specifyFurtherResidualGiftsOnFail: 'No', furtherResidualGiftsDetails: '', furtherResidualFallbackRows: [] });
                  } else {
                    apply({ specifyFurtherResidualGiftsOnFail: 'Yes' });
                  }
                }}
              />
              <span className="min-w-0">{o === 'No' ? 'No further backup' : 'Yes — I want a fallback'}</span>
            </label>
          ))}
        </div>
        {furtherYes ? (
          <div className="mt-4">
            {furtherYes && !String(formValues.furtherResidualGiftsDetails || '').trim() ? (
              <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-500/30 dark:bg-orange-950/20 dark:text-orange-100">
                <strong>Solicitor will draft the clause.</strong> Add who should inherit if every main residuary gift fails. Your list below is for your
                instructions only.
              </div>
            ) : null}
            {furtherRows.length > 0 ? (
              <ul className="mb-3 space-y-2">
                {furtherRows.map((r, i) => (
                  <li
                    key={i}
                    className="flex min-w-0 items-start justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/80"
                  >
                    <span className="min-w-0 break-words">
                      {r.name}
                      {r.relationship ? ` — ${r.relationship}` : ''}
                      {r.share ? ` — ${r.share}` : ''}
                    </span>
                    <button type="button" className="shrink-0 text-red-600 dark:text-red-400" onClick={() => removeFurtherRow(i)} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300">Full name *</label>
                <input
                  className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={furtherName}
                  onChange={(e) => setFurtherName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-slate-600 dark:text-slate-300">Relationship</label>
                <input
                  className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={furtherRel}
                  onChange={(e) => setFurtherRel(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-xs text-slate-600 dark:text-slate-300">Share / instruction (optional)</label>
              <input
                className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                value={furtherShare}
                onChange={(e) => setFurtherShare(e.target.value)}
                placeholder="e.g. equally, 100%"
              />
            </div>
            <button
              type="button"
              onClick={addFurtherRow}
              className="mt-2 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" /> Add fallback person
            </button>
          </div>
        ) : null}
      </div>

      {/* Q6 — shares only */}
      {isShares ? (
        <div className="border-t border-slate-200 pt-6 dark:border-slate-600">
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">If a share of residue fails, should it go to the other residuary shares proportionally?</h4>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {['No', 'Yes'].map((o) => (
              <label
                key={o}
                className={`flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  formValues.failedResiduePassProportionately === o
                    ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                    : 'border-slate-200 dark:border-slate-600'
                }`}
              >
                <input
                  type="radio"
                  className="h-4 w-4 accent-indigo-600"
                  name={`${id}-lapse`}
                  checked={formValues.failedResiduePassProportionately === o}
                  onChange={() => apply({ failedResiduePassProportionately: o })}
                />
                <span>{o}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {/* Charity + IHT */}
      <div className="border-t border-slate-200 pt-6 dark:border-slate-600">
        <div className="mb-2 flex items-center gap-2">
          <Landmark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">10% to charity (reduced IHT rate)</h4>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">Gifts of at least 10% of the net estate to charity can reduce the IHT rate on the rest. There is extra work for your executors.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          {['No', 'Yes'].map((o) => (
            <label
              key={o}
              className={`flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                formValues.give10PercentToCharity === o
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                  : 'border-slate-200 dark:border-slate-600'
              }`}
            >
              <input
                type="radio"
                className="h-4 w-4 accent-indigo-600"
                name={`${id}-ch10`}
                checked={formValues.give10PercentToCharity === o}
                    onChange={() =>
                  apply({
                    give10PercentToCharity: o,
                    ...(o === 'No'
                      ? {
                          charityGiftOnlyIfIHTDue: '',
                          splitCharitableGift: '',
                          charityBenefitDetails: '',
                          minimumCharityAmount: '',
                          minimumCharityAmountValue: '',
                        }
                      : {}),
                  })
                }
              />
              <span>{o === 'No' ? 'No charitable gift' : 'Yes — I want to explore 10%+'}</span>
            </label>
          ))}
        </div>

        {charity ? (
          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Only if inheritance tax is actually due?</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                {[
                  { v: 'No', t: 'No — the gift is in the will in any case' },
                  { v: 'Yes', t: 'Yes — only if IHT is due' },
                ].map((x) => (
                  <label
                    key={x.v}
                    className={`flex min-h-[44px] flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      formValues.charityGiftOnlyIfIHTDue === x.v
                        ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      className="h-4 w-4 accent-indigo-600"
                      name={`${id}-ihto`}
                      checked={formValues.charityGiftOnlyIfIHTDue === x.v}
                      onChange={() => apply({ charityGiftOnlyIfIHTDue: x.v })}
                    />
                    <span className="min-w-0 break-words">{x.t}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Split between different charities?</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                {['No', 'Yes'].map((o) => (
                  <label
                    key={o}
                    className={`flex min-h-[44px] flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      formValues.splitCharitableGift === o
                        ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      className="h-4 w-4 accent-indigo-600"
                      name={`${id}-splt`}
                      checked={formValues.splitCharitableGift === o}
                      onChange={() => apply({ splitCharitableGift: o })}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </div>
            {formValues.splitCharitableGift === 'Yes' ? (
              <div>
                <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor={`${id}-chdeet`}>
                  Charity names and (if you can) numbers
                </label>
                <textarea
                  id={`${id}-chdeet`}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={formValues.charityBenefitDetails || ''}
                  onChange={(e) => apply({ charityBenefitDetails: e.target.value })}
                />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor={`${id}-chone`}>
                  Which charity(ies) should benefit?
                </label>
                <textarea
                  id={`${id}-chone`}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={formValues.charityBenefitDetails || ''}
                  onChange={(e) => apply({ charityBenefitDetails: e.target.value })}
                />
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Minimum amount/percentage in any case?</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                {['No', 'Yes'].map((o) => (
                  <label
                    key={o}
                    className={`flex min-h-[44px] flex-1 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      formValues.minimumCharityAmount === o
                        ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      className="h-4 w-4 accent-indigo-600"
                      name={`${id}-minch`}
                      checked={formValues.minimumCharityAmount === o}
                      onChange={() => apply({ minimumCharityAmount: o, minimumCharityAmountValue: o === 'No' ? '' : formValues.minimumCharityAmountValue })}
                    />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            </div>
            {formValues.minimumCharityAmount === 'Yes' ? (
              <div>
                <label className="text-sm font-medium text-slate-800 dark:text-slate-100" htmlFor={`${id}-chmin`}>
                  Minimum amount
                </label>
                <input
                  id={`${id}-chmin`}
                  className="mt-1 w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  value={formValues.minimumCharityAmountValue || ''}
                  onChange={(e) => apply({ minimumCharityAmountValue: e.target.value })}
                  placeholder="e.g. £5,000 or 5% of my net estate"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* IHT Benham / Ratcliffe */}
      <div className="border-t border-slate-200 pt-6 dark:border-slate-600">
        <div className="mb-1 flex items-start gap-2">
          <Info className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
          <div>
            <h4 className="text-base font-bold text-slate-900 dark:text-slate-100">IHT and exempt / non-exempt residuary shares</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Only relevant where the residue is split between exempt and non-exempt beneficiaries. If unsure, the usual default is Ratcliffe.</p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { v: 'NA', t: 'N / A', d: 'Not applicable' },
            { v: 'AfterTax', t: 'After tax (Benham)', d: 'Tax taken before working out shares' },
            { v: 'BeforeTax', t: 'Before tax (Ratcliffe)', d: 'Usual default — borne by non-exempt shares' },
          ].map((x) => (
            <button
              key={x.v}
              type="button"
              onClick={() => apply({ howIHTDealtWithSplitting: x.v })}
              className={`min-h-[44px] rounded-xl border-2 p-3 text-left text-sm transition-colors ${
                formValues.howIHTDealtWithSplitting === x.v
                  ? 'border-indigo-500 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-950/30'
                  : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/40'
              }`}
            >
              <p className="font-bold text-slate-900 dark:text-slate-100">{x.t}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{x.d}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default EstateResidueGuided;
