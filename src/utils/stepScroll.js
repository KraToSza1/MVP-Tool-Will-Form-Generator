/**
 * Scrolling helpers for moving between questionnaire steps on phones and desktops.
 */

/** Below this width the mobile "Current section" bar is shown and the sidebar is a drawer (Tailwind `lg`). */
const MOBILE_LAYOUT_MAX_WIDTH = 1023;

export const STEP_HEADING_ID = 'will-step-heading';

export function isTouchDevice() {
  if (typeof window === 'undefined') return false;
  try {
    return window.matchMedia?.('(hover: none) and (pointer: coarse)').matches === true;
  } catch {
    return false;
  }
}

function isMobileLayout() {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_LAYOUT_MAX_WIDTH;
}

/**
 * After a step change: on phones/tablets put the new step's heading just under the sticky
 * "Current section" bar, so the first question is in view instead of the repeated page header.
 * On desktop keep the old behaviour (top of page, where progress is visible).
 */
export function scrollToStepStart() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!isMobileLayout()) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  const target =
    document.getElementById(STEP_HEADING_ID) || document.querySelector('.will-form-section-card');
  if (!target) {
    window.scrollTo({ top: 0, behavior: 'auto' });
    return;
  }
  const stickyBar = document.querySelector('[data-will-sticky-bar]');
  const offset = stickyBar ? stickyBar.getBoundingClientRect().height : 0;
  const top = target.getBoundingClientRect().top + window.scrollY - offset - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
}

function isVisible(el) {
  return !!el && (el.offsetParent !== null || el.getClientRects().length > 0);
}

/**
 * Inside a guided block (long multi-question step), find the first visible question the user has not
 * answered yet: a radio group with nothing checked, or an empty required input. Returns null if none.
 */
export function findFirstUnansweredInside(container) {
  if (!container?.querySelectorAll) return null;

  const radiosByName = new Map();
  for (const radio of container.querySelectorAll('input[type="radio"]')) {
    if (!isVisible(radio) && !isVisible(radio.closest('label'))) continue;
    const name = radio.name || '';
    if (!name) continue;
    if (!radiosByName.has(name)) radiosByName.set(name, []);
    radiosByName.get(name).push(radio);
  }
  let firstRadioGroup = null;
  for (const radios of radiosByName.values()) {
    if (radios.some((r) => r.checked)) continue;
    const first = radios[0];
    const group = first.closest('[role="radiogroup"], fieldset') || first.closest('label')?.parentElement || first;
    if (!firstRadioGroup || (group.compareDocumentPosition(firstRadioGroup) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      firstRadioGroup = group;
    }
  }

  // Button-style choices marked up as role="radiogroup" / role="radio" (e.g. the residue IHT cards).
  for (const group of container.querySelectorAll('[role="radiogroup"]')) {
    const options = group.querySelectorAll('[role="radio"]');
    if (!options.length || !isVisible(group)) continue;
    if ([...options].some((o) => o.getAttribute('aria-checked') === 'true')) continue;
    if (!firstRadioGroup || (group.compareDocumentPosition(firstRadioGroup) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      firstRadioGroup = group;
    }
  }

  let firstEmptyInput = null;
  for (const input of container.querySelectorAll('input[required], textarea[required], select[required]')) {
    if (input.type === 'radio' || input.type === 'checkbox') continue;
    if (!isVisible(input) || String(input.value || '').trim()) continue;
    firstEmptyInput = input;
    break;
  }

  if (firstRadioGroup && firstEmptyInput) {
    return firstRadioGroup.compareDocumentPosition(firstEmptyInput) & Node.DOCUMENT_POSITION_FOLLOWING
      ? firstRadioGroup
      : firstEmptyInput;
  }
  return firstRadioGroup || firstEmptyInput;
}
