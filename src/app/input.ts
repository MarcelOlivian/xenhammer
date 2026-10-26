type KeyHandler = (code: string, e: KeyboardEvent) => boolean;

/** True when keystrokes belong to a text field rather than the editor. */
function isTyping(e: KeyboardEvent): boolean {
  const t = e.target;
  return (
    t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
  );
}

/**
 * Global keyboard state keyed by `KeyboardEvent.code` (layout-independent, so
 * WASD stays WASD on AZERTY). Handlers return true when they consumed a key.
 */
class Input {
  private readonly down = new Set<string>();
  private readonly handlers: KeyHandler[] = [];

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (isTyping(e)) return;
      this.down.add(e.code);
      if (e.repeat) return;
      for (const handler of this.handlers) {
        if (handler(e.code, e)) {
          e.preventDefault();
          return;
        }
      }
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  onKeyDown(handler: KeyHandler): void {
    this.handlers.push(handler);
  }
}

export const input = new Input();
