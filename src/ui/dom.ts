/** `querySelector` that throws a clear error if `index.html` is missing an element the UI depends on. */
export function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required interface element is missing: ${selector}`);
  return element;
}

/** Escapes text for use inside `innerHTML` (saves and summaries are data, not markup). */
export function escapeHtml(text: unknown): string {
  return String(text).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

/** True when `element` is shown and can take keyboard focus (not hidden, disabled or inside an inert panel). */
export function canFocus(element: HTMLElement | null | undefined): element is HTMLElement {
  if (!element || !element.isConnected || element.offsetParent === null) return false;
  if ((element as HTMLButtonElement).disabled) return false;
  return !element.closest("[inert]");
}

/**
 * Focuses the first candidate that can take focus, so focus never falls back
 * to the page body when a dialog closes while the controls are folded away.
 */
export function focusFirst(...candidates: Array<HTMLElement | string | null | undefined>): void {
  for (const candidate of candidates) {
    const element = typeof candidate === "string" ? document.querySelector<HTMLElement>(candidate) : candidate;
    if (canFocus(element)) { element.focus({ preventScroll: true }); return; }
  }
}

/** Keeps Tab and Shift+Tab inside `container` (for modal dialogs). */
export function trapTab(event: KeyboardEvent, container: HTMLElement): void {
  if (event.key !== "Tab") return;
  const focusable = [...container.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(canFocus);
  if (focusable.length === 0) { event.preventDefault(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const inside = container.contains(document.activeElement);
  if (!inside) { event.preventDefault(); first.focus(); }
  else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
