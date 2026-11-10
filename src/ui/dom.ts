/** Crea un elemento con clase y texto opcionales. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = '',
  text = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Escribe texto solo si cambió, para no tocar el DOM en cada fotograma. */
export function setText(node: HTMLElement, text: string): void {
  if (node.textContent !== text) node.textContent = text;
}

let fieldCounter = 0;
export const nextFieldId = (): string => `campo-${++fieldCounter}`;
