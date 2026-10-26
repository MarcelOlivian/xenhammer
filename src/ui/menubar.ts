import { el, mnemonicLabel } from './dom';

export interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
}

export type MenuEntry = MenuItem | 'separator';

export interface Menu {
  label: string;
  items: MenuEntry[];
}

/**
 * Win9x-style menu bar: click to open, hover to switch while open, click
 * outside or Escape to close. Items without an action render disabled.
 */
export function createMenuBar(menus: Menu[]): HTMLElement {
  const bar = el('nav.menubar', { role: 'menubar' });
  let open: HTMLElement | null = null;

  const closeAll = () => {
    open?.classList.remove('open');
    open = null;
  };
  const openMenu = (m: HTMLElement) => {
    if (open === m) return;
    closeAll();
    m.classList.add('open');
    open = m;
  };

  for (const menu of menus) {
    const dropdown = el('div.menu-dropdown.window', { role: 'menu' });
    for (const entry of menu.items) {
      if (entry === 'separator') {
        dropdown.append(el('div.menu-separator', { role: 'separator' }));
        continue;
      }
      const item = el(
        'button.menu-item',
        { type: 'button', role: 'menuitem', disabled: !entry.action },
        el('span', {}, mnemonicLabel(entry.label)),
        el('span.menu-shortcut', {}, entry.shortcut ?? ''),
      );
      item.addEventListener('click', () => {
        closeAll();
        entry.action?.();
      });
      dropdown.append(item);
    }

    const title = el(
      'button.menu-title',
      { type: 'button', 'aria-haspopup': 'true' },
      mnemonicLabel(menu.label),
    );
    const wrapper = el('div.menu', {}, title, dropdown);
    title.addEventListener('click', () => (open === wrapper ? closeAll() : openMenu(wrapper)));
    title.addEventListener('pointerenter', () => open && openMenu(wrapper));
    bar.append(wrapper);
  }

  document.addEventListener('pointerdown', (e) => {
    if (open && !open.contains(e.target as Node)) closeAll();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });
  return bar;
}
