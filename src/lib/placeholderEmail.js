/**
 * Emails that will bounce when Graph/outbox tries to deliver (demo RFC domains,
 * Will Tool autofill pattern *.demo@example.com, etc.).
 */
export function isUndeliverablePlaceholderEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e.includes('@')) return false;
  const domain = e.split('@').pop()?.trim() || '';
  if (!domain) return false;

  if (domain === 'example.com' || domain === 'example.org' || domain === 'example.net') return true;
  if (domain.endsWith('.example')) return true;

  const local = e.slice(0, Math.max(0, e.lastIndexOf('@')));
  if (local.endsWith('.demo')) return true;

  return false;
}
