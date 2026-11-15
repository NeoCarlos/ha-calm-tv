/**
 * The element matching `selector` inside `root`, checked to be a `kind` (HTMLElement by default).
 * The screens build their own markup, so a miss means that markup changed: fail loudly at start-up
 * rather than later, somewhere less obvious.
 */
export function find<T extends Element>(root: ParentNode, selector: string, kind: abstract new () => T): T {
  const found = root.querySelector(selector);

  if (found instanceof kind) return found;

  throw new Error(`Calm TV: expected ${kind.name} for "${selector}"`);
}

/** The HTML element matching `selector` inside `root`. */
export function child(root: ParentNode, selector: string): HTMLElement {
  return find(root, selector, HTMLElement);
}

/** The nearest element with `data-item` around an event's target, if any (for mouse hover and clicks). */
export function itemAt(target: EventTarget | null): HTMLElement | null {
  const item = target instanceof Element ? target.closest('[data-item]') : null;

  return item instanceof HTMLElement ? item : null;
}
