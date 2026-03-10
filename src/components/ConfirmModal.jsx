import React, { useEffect } from 'react';

/**
 * In-app confirmation modal that respects light/dark theme.
 * Use instead of window.confirm() so the dialog matches the app theme.
 */
export default function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
}) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  const isDanger = variant === 'danger';

  return (
    <div
      className="confirm-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      onClick={onClose}
    >
      <div
        className="confirm-modal rounded-2xl shadow-2xl w-full max-w-md overflow-hidden bg-white border border-slate-200 ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-modal-body px-6 py-5">
          <h2 id="confirm-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          {children && (
            <div className="mt-3 text-sm text-slate-700">
              {children}
            </div>
          )}
        </div>
        <div className="confirm-modal-footer px-6 py-4 flex flex-wrap gap-3 justify-end border-t border-slate-200 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="confirm-modal-cancel rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={
              isDanger
                ? 'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
                : 'rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
