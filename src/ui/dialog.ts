import { el } from './dom';

/**
 * A classic modal message box. Resolves when dismissed. Pass `closable: false`
 * for fatal states (no OK button).
 */
export function showMessageBox(
  title: string,
  body: (string | Node)[],
  { closable = true }: { closable?: boolean } = {},
): Promise<void> {
  return new Promise((resolve) => {
    const close = () => {
      overlay.remove();
      resolve();
    };
    const ok = el('button.button', { type: 'button' }, 'OK');
    ok.addEventListener('click', close);

    const overlay = el(
      'div.modal-overlay',
      {},
      el(
        'div.window.dialog',
        { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        el('div.titlebar', {}, el('span', {}, title)),
        el('div.dialog-body', {}, ...body.map((b) => (typeof b === 'string' ? el('p', {}, b) : b))),
        closable && el('div.dialog-buttons', {}, ok),
      ),
    );
    overlay.addEventListener('keydown', (e) => {
      if (closable && (e.key === 'Escape' || e.key === 'Enter')) close();
    });
    document.body.append(overlay);
    if (closable) ok.focus();
  });
}
