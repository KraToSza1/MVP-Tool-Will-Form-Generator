import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, Edit3, Loader2, Mail, Phone, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_APPOINTMENT_RULES,
  buildSlotsForDay,
  buildWorkingDayList,
  cancelAppointmentBySession,
  formatDurationMinutes,
  formatSlotLabel,
  getSessionAppointmentContext,
  listTakenAppointmentSlots,
  localDateKey,
  requestAppointment,
  rescheduleAppointmentBySession,
} from '../lib/appointments.js';
import { getAristoneContactDetails, ARISTONE_PROFILE } from '../constants/aristoneSolicitors.js';

const DAYS_AHEAD = 21;

function buildMailtoFallback({ contact, referenceNumber, clientName }) {
  if (!contact?.email) return '';
  const subject = encodeURIComponent(
    `Will signing appointment request${referenceNumber ? ` (Ref ${referenceNumber})` : ''}`,
  );
  const lines = [
    `Hello ${ARISTONE_PROFILE.firmName},`,
    '',
    `${clientName ? `My name is ${clientName}.\n` : ''}I would like to book a will signing appointment.`,
    referenceNumber ? `Reference: ${referenceNumber}` : '',
    '',
    'Please confirm a suitable date/time.',
    '',
    'Thank you.',
  ].filter((line) => line !== null);
  const body = encodeURIComponent(lines.join('\n'));
  return `mailto:${contact.email}?subject=${subject}&body=${body}`;
}

/**
 * Public client-facing booking modal. Shown after submission so the client
 * can pick an appointment slot directly. Uses anon Supabase RPCs verified
 * via (ref, secret) so it works without a logged-in user.
 *
 * Cross-device notes:
 * - All sizing is rem/% so it works the same on Mac/Win Chrome, Safari, FF.
 * - Slots use locale time formatting so the user always sees their tz.
 * - Touch targets are min-h-[44px] (Apple HIG / WCAG).
 * - Backdrop scroll lock relies on adding `overflow-hidden` to <html>.
 */
export default function BookAppointmentModal({
  open,
  onClose,
  referenceNumber = '',
  sessionSecret = '',
  clientName = '',
  clientEmail = '',
  matterId = null,
  rules: rulesProp,
  onAppointmentChange,
}) {
  const contact = useMemo(() => getAristoneContactDetails(), []);

  // The active rules are loaded from the server (solicitor's saved
  // availability) when the modal opens; the prop is only used as a temporary
  // seed before the RPC resolves.
  const [rules, setRules] = useState(() => ({
    ...DEFAULT_APPOINTMENT_RULES,
    ...(rulesProp || {}),
  }));
  const [rulesSource, setRulesSource] = useState('firm_default');
  const [solicitor, setSolicitor] = useState(null);
  const [existingAppointment, setExistingAppointment] = useState(null);

  // mode: 'view' shows manage UI for an existing booking,
  //       'pick' shows the slot picker (new booking or reschedule),
  // The mode is computed from `existingAppointment` + an explicit
  // `manualReschedule` flag so the user can hop into reschedule mode.
  const [manualReschedule, setManualReschedule] = useState(false);

  const slotMinutes = rules.slot_minutes || DEFAULT_APPOINTMENT_RULES.slot_minutes;
  const bufferMinutes = rules.buffer_minutes ?? DEFAULT_APPOINTMENT_RULES.buffer_minutes;

  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [featureMissing, setFeatureMissing] = useState(false);
  const [taken, setTaken] = useState([]);
  const [now, setNow] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [notes, setNotes] = useState('');
  const [contactEmail, setContactEmail] = useState(clientEmail || '');
  const [bookedSlot, setBookedSlot] = useState(null);
  const [bookingMode, setBookingMode] = useState('book'); // 'book' | 'reschedule'
  const dialogRef = useRef(null);
  const closeBtnRef = useRef(null);

  const hasFutureAppointment = !!(existingAppointment && existingAppointment.start && existingAppointment.start.getTime() > Date.now());
  const showManageView = hasFutureAppointment && !manualReschedule && !bookedSlot;

  const days = useMemo(() => buildWorkingDayList(rules, DAYS_AHEAD, now), [rules, now]);

  const slotsByDay = useMemo(() => {
    const map = new Map();
    days.forEach((day) => {
      map.set(localDateKey(day), buildSlotsForDay(day, rules, taken, now));
    });
    return map;
  }, [days, rules, taken, now]);

  const selectedDay = useMemo(() => {
    if (!selectedDayKey) return days[0] || null;
    const found = days.find((d) => localDateKey(d) === selectedDayKey);
    return found || days[0] || null;
  }, [days, selectedDayKey]);

  const slotsForSelected = useMemo(() => {
    if (!selectedDay) return [];
    return slotsByDay.get(localDateKey(selectedDay)) || [];
  }, [selectedDay, slotsByDay]);

  /**
   * Stable fetcher: depends only on (ref, secret) so it does NOT change when
   * we update local UI state. Earlier versions read `now` from state, which
   * combined with `setNow(new Date())` inside the open-effect caused an
   * infinite render loop (visible as the modal "flickering" on every press).
   * We just compute a fresh `now` each call instead.
   */
  const refreshTaken = useCallback(async () => {
    if (!referenceNumber || !sessionSecret) {
      setErrorMessage('We could not verify your reference. Please reload the page.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    const baseNow = new Date();
    const fromIso = new Date(baseNow.getTime() - 60 * 60 * 1000).toISOString();
    const toIso = new Date(baseNow.getTime() + (DAYS_AHEAD + 2) * 24 * 60 * 60 * 1000).toISOString();
    const { data, error, featureMissing: missing } = await listTakenAppointmentSlots({
      ref: referenceNumber,
      secret: sessionSecret,
      fromIso,
      toIso,
    });
    setTaken(data || []);
    setFeatureMissing(Boolean(missing));
    if (missing) {
      setErrorMessage(
        'Online booking is not yet enabled. Run the migration `supabase/migrations/20260429000000_appointments.sql` in Supabase to turn it on, or use the email button below to request a slot.',
      );
    } else if (error) {
      setErrorMessage(error);
    }
    setLoading(false);
  }, [referenceNumber, sessionSecret]);

  /**
   * Pulls solicitor availability rules + any existing future appointment for
   * this session from the server. Without this we previously fell back to the
   * firm-wide default (60-min slots, 09:00–17:00) which did not match what the
   * solicitor had saved in their staff availability page.
   */
  const refreshContext = useCallback(async () => {
    if (!referenceNumber || !sessionSecret) return;
    setContextLoading(true);
    const ctx = await getSessionAppointmentContext({
      ref: referenceNumber,
      secret: sessionSecret,
    });
    setContextLoading(false);
    if (ctx?.rules) {
      setRules({ ...DEFAULT_APPOINTMENT_RULES, ...ctx.rules });
      setRulesSource(ctx.rules.source || 'firm_default');
    }
    setSolicitor(ctx?.solicitor || null);
    setExistingAppointment(ctx?.appointment || null);
    if (ctx?.featureMissing) {
      setFeatureMissing(true);
    }
  }, [referenceNumber, sessionSecret]);

  useEffect(() => {
    if (!open) return undefined;
    setBookedSlot(null);
    setSelectedSlot(null);
    setNotes('');
    setContactEmail(clientEmail || '');
    setManualReschedule(false);
    setBookingMode('book');
    setNow(new Date());
    void refreshContext();
    void refreshTaken();
    return undefined;
  }, [open, clientEmail, refreshContext, refreshTaken]);

  useEffect(() => {
    if (!open) return undefined;
    if (typeof document === 'undefined') return undefined;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    if (!selectedDayKey && days[0]) {
      setSelectedDayKey(localDateKey(days[0]));
    }
  }, [days, open, selectedDayKey]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus?.();
  }, [open]);

  const handleSelectSlot = (slot) => {
    if (slot?.disabled) return;
    setSelectedSlot(slot);
  };

  const handleConfirm = async () => {
    if (!selectedSlot || submitting) return;
    setSubmitting(true);
    setErrorMessage('');
    const isReschedule = bookingMode === 'reschedule' && existingAppointment?.id;
    const result = isReschedule
      ? await rescheduleAppointmentBySession({
          ref: referenceNumber,
          secret: sessionSecret,
          appointmentId: existingAppointment.id,
          startIso: selectedSlot.start.toISOString(),
          durationMinutes: slotMinutes,
          notes: notes.trim() || undefined,
        })
      : await requestAppointment({
          ref: referenceNumber,
          secret: sessionSecret,
          startIso: selectedSlot.start.toISOString(),
          durationMinutes: slotMinutes,
          notes: notes.trim(),
          email: contactEmail.trim() || clientEmail || '',
          name: clientName || '',
        });
    setSubmitting(false);
    if (result.error) {
      if (result.conflict) {
        toast.error('That time was just booked', {
          description: 'We refreshed the list. Please pick another slot.',
        });
        setSelectedSlot(null);
        await refreshTaken();
        return;
      }
      if (result.featureMissing) {
        setFeatureMissing(true);
      }
      setErrorMessage(result.error);
      toast.error('Could not save appointment', { description: result.error });
      return;
    }
    setBookedSlot({
      start: selectedSlot.start,
      end: selectedSlot.end,
      id: result.data?.id,
      rescheduled: !!isReschedule,
    });
    setBookingMode('book');
    setManualReschedule(false);
    onAppointmentChange?.();
    void refreshContext();
    toast.success(isReschedule ? 'Appointment rescheduled' : 'Appointment requested', {
      description: `${formatSlotLabel(selectedSlot.start)} · confirmation email sent.`,
    });
  };

  /**
   * Cancels the existing appointment via the secured session-helpers RPC.
   * Returns silently if there's nothing to cancel.
   */
  const handleCancelExisting = async () => {
    if (!existingAppointment?.id || cancelling) return;
    setCancelling(true);
    setErrorMessage('');
    const result = await cancelAppointmentBySession({
      ref: referenceNumber,
      secret: sessionSecret,
      appointmentId: existingAppointment.id,
    });
    setCancelling(false);
    if (result.error) {
      if (result.featureMissing) setFeatureMissing(true);
      setErrorMessage(result.error);
      toast.error('Could not cancel appointment', { description: result.error });
      return;
    }
    toast.success('Appointment cancelled', {
      description: 'You can book a new slot whenever you are ready.',
    });
    setExistingAppointment(null);
    setBookedSlot(null);
    setManualReschedule(false);
    setBookingMode('book');
    onAppointmentChange?.();
    void refreshContext();
    void refreshTaken();
  };

  /**
   * Switch to reschedule mode: re-uses the slot picker but Confirm fires the
   * reschedule RPC instead of request_appointment.
   */
  const handleStartReschedule = () => {
    setManualReschedule(true);
    setBookingMode('reschedule');
    setSelectedSlot(null);
    setBookedSlot(null);
  };

  const handleBackToManage = () => {
    setManualReschedule(false);
    setBookingMode('book');
    setSelectedSlot(null);
  };

  const goPrevDay = () => {
    if (!selectedDay) return;
    const idx = days.findIndex((d) => localDateKey(d) === localDateKey(selectedDay));
    if (idx > 0) setSelectedDayKey(localDateKey(days[idx - 1]));
  };
  const goNextDay = () => {
    if (!selectedDay) return;
    const idx = days.findIndex((d) => localDateKey(d) === localDateKey(selectedDay));
    if (idx >= 0 && idx < days.length - 1) setSelectedDayKey(localDateKey(days[idx + 1]));
  };

  if (!open) return null;

  const mailHref = buildMailtoFallback({ contact, referenceNumber, clientName });

  /**
   * Compute the actual duration from a booked/existing appointment's
   * start/end pair. Falls back to the loaded `slotMinutes` if the
   * end is missing. This keeps the displayed duration truthful even when
   * rules are out of sync (e.g. an older 60-min booking exists but the
   * solicitor has since moved to 30-min slots).
   */
  const minutesBetween = (start, end) => {
    if (!(start instanceof Date) || !(end instanceof Date)) return slotMinutes;
    const diff = Math.round((end.getTime() - start.getTime()) / 60000);
    return diff > 0 ? diff : slotMinutes;
  };
  const bookedDurationMinutes = bookedSlot
    ? minutesBetween(bookedSlot.start, bookedSlot.end)
    : slotMinutes;
  const existingDurationMinutes = existingAppointment
    ? minutesBetween(existingAppointment.start, existingAppointment.end)
    : slotMinutes;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm px-3 py-3 sm:items-center sm:px-6 sm:py-6 dark:bg-black/70 animate-fadeIn"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-appointment-title"
        className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl ring-1 ring-slate-200 animate-slideIn dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-600 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:px-6 sm:py-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200 sm:inline-flex">
              <CalendarCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 id="book-appointment-title" className="text-lg font-semibold leading-tight sm:text-xl">
                {showManageView
                  ? 'Manage your appointment'
                  : bookingMode === 'reschedule'
                    ? 'Reschedule your appointment'
                    : 'Book your signing appointment'}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 break-words">
                {bookedSlot
                  ? bookedSlot.rescheduled
                    ? 'Your appointment has been moved.'
                    : 'Your slot has been requested. The firm will confirm shortly.'
                  : showManageView
                    ? 'Change the time or cancel without leaving this page.'
                    : `${formatDurationMinutes(slotMinutes)} appointment with ${ARISTONE_PROFILE.firmName}${
                      solicitor?.display_name ? ` · ${solicitor.display_name}` : ''
                    }.`}
              </p>
            </div>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className="-m-1 inline-flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Close booking dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {bookedSlot ? (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-500/60 dark:bg-emerald-600/15 dark:text-emerald-100">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-7 w-7" />
                <div>
                  <p className="text-base font-semibold">{bookedSlot.rescheduled ? 'Appointment rescheduled' : 'Appointment requested'}</p>
                  <p className="text-sm">
                    {formatSlotLabel(bookedSlot.start)} ({formatDurationMinutes(bookedDurationMinutes)})
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm">
                We will email{' '}
                <span className="font-medium break-all">
                  {contactEmail || clientEmail || 'your contact email'}
                </span>{' '}
                to confirm. Reference{referenceNumber ? `: ${referenceNumber}` : ''}.
              </p>
              {solicitor?.email ? (
                <p className="mt-2 text-xs text-emerald-900/80 dark:text-emerald-100/80 break-all">
                  Your solicitor <span className="font-medium">{solicitor.display_name || solicitor.email}</span> ({solicitor.email}) has been notified by the system.
                </p>
              ) : null}
              <p className="mt-2 text-xs text-emerald-900/80 dark:text-emerald-100/80">
                Need to change this later? Open the questionnaire link again — the booking modal lets you change or cancel without contacting the firm.
              </p>
            </div>
          ) : showManageView ? (
            <div className="space-y-4">
              {errorMessage ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100">
                  {errorMessage}
                </div>
              ) : null}
              <div className="rounded-2xl border border-indigo-300 bg-indigo-50 p-5 text-indigo-900 dark:border-indigo-500/60 dark:bg-indigo-600/15 dark:text-indigo-100">
                <div className="flex items-start gap-3">
                  <CalendarCheck className="mt-0.5 h-7 w-7 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-base font-semibold">You already have an appointment</p>
                    <p className="text-sm break-words">
                      {formatSlotLabel(existingAppointment.start)}
                      {existingAppointment.end ? (
                        <>
                          {' – '}
                          {existingAppointment.end.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </>
                      ) : null}
                      {' '}
                      ({formatDurationMinutes(existingDurationMinutes)})
                    </p>
                    {solicitor?.display_name ? (
                      <p className="mt-1 text-xs text-indigo-900/80 dark:text-indigo-100/80 break-all">
                        With <span className="font-medium">{solicitor.display_name}</span>
                        {solicitor.email ? <> · {solicitor.email}</> : null}
                      </p>
                    ) : null}
                    {existingAppointment.notes ? (
                      <p className="mt-2 text-xs text-indigo-900/80 dark:text-indigo-100/80 break-words">
                        Notes: {existingAppointment.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="button"
                    onClick={handleStartReschedule}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-offset-slate-900"
                  >
                    <Edit3 className="h-4 w-4" /> Change appointment
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCancelExisting()}
                    disabled={cancelling}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-400/60 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/20"
                  >
                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {cancelling ? 'Cancelling…' : 'Cancel appointment'}
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                <p>
                  Cancelling instantly frees the slot for other clients. Changing the time will move you to a new slot — no double-booking.
                </p>
                {rulesSource === 'firm_default' ? (
                  <p className="mt-1.5">
                    Showing the firm-wide default availability because no solicitor has published availability rules yet.
                  </p>
                ) : rulesSource === 'fallback_staff' ? (
                  <p className="mt-1.5">
                    No solicitor is assigned yet, so we're showing the firm's currently published availability.
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <>
              {errorMessage ? (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/10 dark:text-amber-100">
                  {errorMessage}
                </div>
              ) : null}

              {contextLoading ? (
                <div className="mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your solicitor's availability…
                </div>
              ) : null}

              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Choose a day</h3>
                    <div className="flex items-center gap-1 sm:hidden">
                      <button
                        type="button"
                        aria-label="Previous day"
                        onClick={goPrevDay}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Next day"
                        onClick={goNextDay}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div
                    className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible"
                    role="tablist"
                    aria-label="Available days"
                  >
                    {days.map((day) => {
                      const key = localDateKey(day);
                      const slotsForDay = slotsByDay.get(key) || [];
                      const openCount = slotsForDay.filter((s) => !s.disabled).length;
                      const isSelected = key === (selectedDayKey || (days[0] && localDateKey(days[0])));
                      const dayLabel = day.toLocaleDateString(undefined, {
                        weekday: 'short',
                      });
                      const dateLabel = day.toLocaleDateString(undefined, {
                        day: '2-digit',
                        month: 'short',
                      });
                      return (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={isSelected}
                          onClick={() => setSelectedDayKey(key)}
                          className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-center transition min-w-[72px] min-h-[64px] focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                              : openCount === 0
                                ? 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-[11px] font-semibold uppercase tracking-wide">
                            {dayLabel}
                          </span>
                          <span className="text-sm font-semibold">{dateLabel}</span>
                          <span className="text-[10px] leading-none opacity-80">
                            {openCount === 0 ? 'Full' : `${openCount} open`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Choose a time
                  </h3>
                  {loading ? (
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading available slots…
                    </div>
                  ) : slotsForSelected.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      No slots on this day. Try another day or email{' '}
                      <a className="underline" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                      .
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                      {slotsForSelected.map((slot) => {
                        const key = slot.start.toISOString();
                        const isSelected =
                          selectedSlot && selectedSlot.start.getTime() === slot.start.getTime();
                        const label = slot.start.toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        });
                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={slot.disabled}
                            aria-pressed={isSelected}
                            onClick={() => handleSelectSlot(slot)}
                            className={`min-h-[44px] rounded-xl border px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              isSelected
                                ? 'border-indigo-500 bg-indigo-600 text-white shadow-sm'
                                : slot.disabled
                                  ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500'
                                  : 'border-slate-300 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                            }`}
                            title={
                              slot.reason === 'taken'
                                ? 'This slot is already booked'
                                : slot.reason === 'past'
                                  ? 'This time has already passed'
                                  : ''
                            }
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                      Contact email
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium text-slate-700 dark:text-slate-200">
                      Optional notes
                    </span>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value.slice(0, 240))}
                      maxLength={240}
                      placeholder="Anything we should know?"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </label>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDurationMinutes(slotMinutes)} block
                      {bufferMinutes ? ` · ${bufferMinutes} min buffer` : ''}
                      {' · '}
                      {rules.start_time}–{rules.end_time}
                    </span>
                    <span className="inline-flex items-center gap-1.5 break-all">
                      <Mail className="h-3.5 w-3.5" /> {solicitor?.email || contact.email}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> {contact.phone}
                    </span>
                  </div>
                  <p className="mt-1.5">
                    Times shown in your local timezone. Already-booked slots are hidden so there are no
                    double bookings.
                    {rulesSource === 'firm_default' ? (
                      <>
                        {' '}
                        Showing firm-wide default availability — no solicitor has published availability rules yet.
                      </>
                    ) : rulesSource === 'fallback_staff' ? (
                      <>
                        {' '}
                        No solicitor is assigned to this matter yet — showing the firm's currently published availability.
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 text-sm">
            {bookedSlot ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" /> {formatSlotLabel(bookedSlot.start)}
              </span>
            ) : showManageView ? (
              <span className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                <CalendarCheck className="h-4 w-4" /> Currently booked: {formatSlotLabel(existingAppointment.start)}
              </span>
            ) : selectedSlot ? (
              <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                <CalendarCheck className="h-4 w-4" /> {formatSlotLabel(selectedSlot.start)}
              </span>
            ) : (
              <span className="text-slate-500 dark:text-slate-400">
                {bookingMode === 'reschedule'
                  ? 'Pick a new day and time to move your appointment.'
                  : 'Pick a day and time to continue.'}
              </span>
            )}
          </div>
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
            {!bookedSlot && featureMissing && mailHref ? (
              <a
                href={mailHref}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-emerald-500/60 dark:bg-emerald-600/20 dark:text-emerald-100 dark:hover:bg-emerald-600/30"
              >
                Email the firm instead
              </a>
            ) : null}
            <button
              type="button"
              onClick={bookingMode === 'reschedule' && existingAppointment ? handleBackToManage : onClose}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {bookedSlot
                ? 'Done'
                : showManageView
                  ? 'Close'
                  : bookingMode === 'reschedule' && existingAppointment
                    ? 'Back'
                    : 'Cancel'}
            </button>
            {!bookedSlot && !showManageView ? (
              <button
                type="button"
                disabled={!selectedSlot || submitting || featureMissing}
                onClick={() => void handleConfirm()}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus:ring-offset-slate-900"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
                {submitting
                  ? bookingMode === 'reschedule' ? 'Saving…' : 'Booking…'
                  : bookingMode === 'reschedule' ? 'Confirm new time' : 'Confirm booking'}
              </button>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
