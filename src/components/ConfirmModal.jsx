import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext.jsx';

/**
 * In-app confirmation modal with theme-aware styling and motion.
 * Prefer over window.confirm() so the dialog matches the app and animates smoothly.
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
  const { isDark } = useTheme();

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  const isDanger = variant === 'danger';

  const panelClass = isDark
    ? 'border border-slate-600 bg-slate-900 shadow-2xl ring-1 ring-white/10'
    : 'border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5';

  const titleClass = isDark ? 'text-lg font-semibold text-slate-100' : 'text-lg font-semibold text-slate-900';

  const bodyTextClass = isDark ? 'text-sm text-slate-300' : 'text-sm text-slate-700';

  const footerClass = isDark
    ? 'border-t border-slate-700 bg-slate-950/80'
    : 'border-t border-slate-200 bg-slate-50/50';

  const cancelBtnClass = isDark
    ? 'rounded-xl border border-slate-500 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900'
    : 'rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';

  const confirmBtnClass = isDanger
    ? isDark
      ? 'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-slate-900'
      : 'rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2'
    : isDark
      ? 'rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/40 hover:bg-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900'
      : 'rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2';

  const handlePrimary = async () => {
    try {
      await Promise.resolve(onConfirm?.());
    } finally {
      onClose();
    }
  };

  return (
    <AnimatePresence mode="sync">
      {open && (
        <motion.div
          key="confirm-backdrop"
          role="presentation"
          className="confirm-modal-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            key="confirm-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            className={`confirm-modal w-full max-w-md overflow-hidden rounded-2xl ${panelClass}`}
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-modal-body px-6 py-5">
              <h2 id="confirm-modal-title" className={titleClass}>
                {title}
              </h2>
              {children && <div className={`mt-3 space-y-2 ${bodyTextClass}`}>{children}</div>}
            </div>
            <div className={`confirm-modal-footer flex flex-wrap justify-end gap-3 px-6 py-4 ${footerClass}`}>
              <button type="button" onClick={onClose} className={cancelBtnClass}>
                {cancelLabel}
              </button>
              <button type="button" onClick={() => void handlePrimary()} className={confirmBtnClass}>
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
