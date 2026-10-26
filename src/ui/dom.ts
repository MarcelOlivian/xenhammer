type Attrs = Record<string, string | number | boolean | undefined>;
type Child = Node | string | null | undefined | false;

/**
 * Tiny hyperscript helper: `el('div.pane.active', { title: 'x' }, child, ...)`.
 * Boolean attributes are set when true and omitted when false/undefined.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tagAndClasses: K | `${K}.${string}`,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const [tag, ...classes] = tagAndClasses.split('.') as [K, ...string[]];
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child) node.append(child);
  }
  return node;
}

/** Inline 16×16 SVG icon from path data (stroked with currentColor). */
export function icon(paths: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = paths;
  return svg;
}

/** Renders "&File" as "File" with the mnemonic letter underlined. */
export function mnemonicLabel(label: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const i = label.indexOf('&');
  if (i < 0 || i === label.length - 1) {
    frag.append(label.replace('&', ''));
    return frag;
  }
  frag.append(label.slice(0, i), el('u', {}, label[i + 1]!), label.slice(i + 2));
  return frag;
}
