/** `querySelector` that throws a clear error if `index.html` is missing an element the UI depends on. */
export function requireElement<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required interface element is missing: ${selector}`);
  return element;
}
