import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, X, Copy, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../../context/ThemeContext.jsx';
import { sendSolicitorClientEmailViaGraph } from '../../lib/solicitorClientEmail.js';

/**
 * In-app client chase email composer — avoids disruptive mailto-handoff.
 */
export default function ClientEmailDraftModal({ open, onClose, draft }) {
  const { isDark } = useTheme();
  const closeBtnRef = useRef(null);
  const [bodyEdit, setBodyEdit] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) {
      setSending(false);
      return;
    }
    if (draft?.bodyText !== undefined) setBodyEdit(draft.bodyText);
  }, [open, draft?.bodyText]);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus?.();
    const prev = typeof document !== 'undefined' ? document.documentElement.style.overflow : '';
    if (typeof document !== 'undefined') document.documentElement.style.overflow = 'hidden';
    return () => {
      if (typeof document !== 'undefined') document.documentElement.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !draft) return null;

  const messageBody = bodyEdit;
  const fullText = `To: ${draft.to}\nSubject: ${draft.subjectText}\n\n${messageBody}`;

  const sendNow = async () => {
    if (!draft.matterId) {
      toast.error('Cannot send', { description: 'Matter reference missing. Reload the page and try again.' });
      return;
    }
    setSending(true);
    try {
      const result = await sendSolicitorClientEmailViaGraph({
        matterId: draft.matterId,
        to: draft.to,
        subject: draft.subjectText,
        body: messageBody,
        recipientName: draft.recipientName,
      });
      if (!result.ok) {
        toast.error('Email was not sent', { description: result.error });
        return;
      }
      toast.success('Email sent', {
        description: 'Sent from your firm mailbox via Microsoft 365. Check Sent items in Outlook.',
      });
      onClose?.();
    } finally {
      setSending(false);
    }
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      toast.success('Draft copied', { description: 'Paste into Outlook desktop or web.' });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy to clipboard.' });
    }
  };

  const copyBody = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      toast.success('Message copied', { description: 'Email body copied to clipboard.' });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy to clipboard.' });
    }
  };

  const openOutlookWeb = () => {
    window.open(draft.outlookWebHref, '_blank', 'noopener,noreferrer');
    toast.success('Outlook opened', { description: 'A new browser tab loads Microsoft Outlook compose.' });
  };

  const panelClass = isDark
    ? 'border border-slate-600 bg-slate-900 shadow-2xl ring-1 ring-white/10'
    : 'border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5';
  const headerBorder = isDark ? 'border-slate-700' : 'border-slate-200';
  const titleClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const labelClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const valueClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const closeBtnClass = isDark
    ? 'text-slate-400 hover:bg-slate-800 hover:text-white focus:ring-indigo-400'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:ring-indigo-500';
  const textareaClass = isDark
    ? 'border-slate-600 bg-slate-950/80 text-slate-100 focus:ring-indigo-500'
    : 'border-slate-300 bg-slate-50 text-slate-900 focus:ring-indigo-500';
  const footerClass = isDark ? 'border-slate-700 bg-slate-950/90' : 'border-slate-200 bg-slate-50';
  const secondaryBtnClass = isDark
    ? 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700 focus:ring-indigo-400'
    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus:ring-indigo-500';
  const ghostBtnClass = isDark
    ? 'border-slate-600 text-slate-300 hover:bg-slate-800 focus:ring-indigo-400'
    : 'border-slate-300 text-slate-700 hover:bg-slate-100 focus:ring-indigo-500';

  return (
    <div
      className="fixed inset-0 z-[125] flex items-end justify-center bg-slate-900/65 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-6 sm:py-6 dark:bg-black/70"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-email-draft-title"
        className={`flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl sm:max-h-[90vh] ${panelClass}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={`flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4 ${headerBorder}`}>
          <div className="min-w-0">
            <h2 id="client-email-draft-title" className={`text-base font-semibold sm:text-lg ${titleClass}`}>
              Email client
            </h2>
            <p className={`mt-1 text-xs leading-snug sm:text-sm ${mutedClass}`}>
              Edit the message if needed. <strong>Send now</strong> delivers from your firm Microsoft 365 mailbox when
              the server is configured. Or open Outlook on the web, or copy for desktop Outlook.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className={`-m-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg focus:outline-none focus:ring-2 ${closeBtnClass}`}
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <div>
            <label className={`text-[11px] font-semibold uppercase tracking-wide ${labelClass}`} htmlFor="ced-to">
              To
            </label>
            <p id="ced-to" className={`mt-1 break-all wrap-break-word text-sm ${valueClass}`}>
              {draft.to}
            </p>
          </div>
          <div>
            <label className={`text-[11px] font-semibold uppercase tracking-wide ${labelClass}`} htmlFor="ced-subject">
              Subject
            </label>
            <p id="ced-subject" className={`mt-1 text-sm font-medium wrap-break-word ${valueClass}`}>
              {draft.subjectText}
            </p>
          </div>
          <div>
            <label className={`text-[11px] font-semibold uppercase tracking-wide ${labelClass}`} htmlFor="ced-body">
              Message
            </label>
            <textarea
              id="ced-body"
              rows={10}
              value={bodyEdit}
              onChange={(e) => setBodyEdit(e.target.value)}
              disabled={sending}
              className={`mt-2 w-full min-h-[12rem] resize-y rounded-xl border px-3 py-2.5 font-sans text-sm leading-relaxed shadow-inner outline-none focus:ring-2 ${textareaClass}`}
            />
          </div>
        </div>

        <footer className={`flex shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-4 ${footerClass}`}>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-1 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={sendNow}
              disabled={sending || !draft.matterId || !messageBody.trim()}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-55 disabled:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950 focus:ring-offset-slate-100 sm:w-auto"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 shrink-0" aria-hidden />
                  Send now
                </>
              )}
            </button>
            <button
              type="button"
              onClick={openOutlookWeb}
              disabled={sending}
              className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0078d4] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#106ebe] disabled:opacity-55 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950 focus:ring-offset-slate-100 sm:w-auto"
            >
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
              Open Outlook on the web
            </button>
            <button
              type="button"
              onClick={copyAll}
              disabled={sending}
              className={`inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950 focus:ring-offset-slate-100 disabled:opacity-55 sm:w-auto ${secondaryBtnClass}`}
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Copy full draft
            </button>
            <button
              type="button"
              onClick={copyBody}
              disabled={sending}
              className={`inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950 focus:ring-offset-slate-100 disabled:opacity-55 sm:w-auto ${ghostBtnClass}`}
            >
              Copy message only
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className={`inline-flex min-h-[44px] w-full shrink-0 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950 focus:ring-offset-slate-100 disabled:opacity-55 sm:w-auto ${ghostBtnClass}`}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
