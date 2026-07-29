/**
 * readout.js
 * ---------------------------------------------------------------
 * Reusable textual-readout custom element: <dpad-readout>
 *
 * Drop this element into any HTML (or shadow root) and it will
 * render a single line of text inside a small, theme-aware pill:
 *
 *   ┌─────────────────────────────────────────┐
 *   │  Ready                                  │
 *   └─────────────────────────────────────────┘
 *
 * The readout is a passive display \u2014 it never modifies the
 * thing it describes. Consumers update it through one of:
 *
 *   - The `setText(text)` method (synchronous):
 *
 *         const el = document.querySelector('dpad-readout');
 *         el.setText('Up pressed');
 *
 *   - The `subscribe(dpadElement)` convenience method that
 *     wires a <dpad-control>'s `dpad-press` / `dpad-release` /
 *     `dpad-toggle` events to a friendly text description
 *     automatically:
 *
 *         const dpad  = document.querySelector('dpad-control');
 *         const read  = document.querySelector('dpad-readout');
 *         const off   = read.subscribe(dpad);
 *         // later: off() to disconnect
 *
 *   - Listening to the `readout-text` CustomEvent that fires
 *     on the host every time the text changes (composed:true,
 *     bubbles, so it crosses shadow boundaries).
 *
 * The element is fully self-contained:
 *   - Shadow DOM for style isolation
 *   - Native HA design tokens (auto-themes light/dark/custom)
 *   - No coupling to card.js, controller.js, dpad.js, or any
 *     other module in this project \u2014 copy this file into
 *     another project and use <dpad-readout> as-is.
 * ---------------------------------------------------------------
 */

// ----------------------------------------------------------------
// Class hooks & custom event name
// ----------------------------------------------------------------

const READOUT_CLASS = 'dpad-readout';
const READOUT_TEXT_CLASS = 'dpad-readout__text';
const READOUT_ICON_CLASS = 'dpad-readout__icon';

const EVT_TEXT = 'readout-text';

// Default text shown before the consumer ever calls setText.
const DEFAULT_TEXT = 'Ready';

// Friendly text labels for each dpad action. Consumers can
// override these by passing a custom `labels` object to
// subscribe().
const DEFAULT_LABELS = Object.freeze({
  press: Object.freeze({
    up: 'Up pressed',
    down: 'Down pressed',
    left: 'Left pressed',
    right: 'Right pressed',
  }),
  release: Object.freeze({
    up: 'Up released',
    down: 'Down released',
    left: 'Left released',
    right: 'Right released',
  }),
  toggle: (active) => (active ? 'Microphone ON' : 'Microphone OFF'),
});

// ----------------------------------------------------------------
// Styles \u2014 self-contained, uses only HA design tokens for theming
// ----------------------------------------------------------------

const READOUT_STYLES = `
  :host {
    display: block;
  }

  .${READOUT_CLASS} {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 36px;
    padding: 8px 14px;
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
    color: var(--primary-text-color);
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
    font-family: var(--ha-font-family, Roboto, 'Helvetica Neue', sans-serif);
    font-size: 0.95rem;
    line-height: 1.3;
    text-align: center;
    transition: background-color 120ms ease, color 120ms ease,
                border-color 120ms ease;
  }

  .${READOUT_CLASS}--active {
    /* Slight emphasis when the readout is showing a non-default message. */
    color: var(--primary-color, #03a9f4);
    border-color: var(--primary-color, #03a9f4);
  }

  .${READOUT_ICON_CLASS} {
    --mdc-icon-size: 18px;
    flex: 0 0 auto;
    opacity: 0.7;
  }

  .${READOUT_TEXT_CLASS} {
    flex: 1 1 auto;
    min-width: 0;
    word-break: break-word;
  }
`;

// ----------------------------------------------------------------
// The custom element
// ----------------------------------------------------------------

/**
 * <dpad-readout> \u2014 a self-contained textual readout pill.
 *
 * Public API:
 *   - setText(text)         update the displayed text
 *   - getText()             read the current text
 *   - clear()               reset to the default "Ready" text
 *   - subscribe(dpadEl, [labels])  auto-update from a <dpad-control>
 *   - addEventListener('readout-text', fn)  fires on every change
 */
class DpadReadout extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._text = DEFAULT_TEXT;
    this._isActive = false;     // becomes true once the user pushes any non-default text
    this._unsubscribers = [];   // cleanup list returned by subscribe()
  }

  // ---- lifecycle ----

  connectedCallback() {
    this._mount();
    this._render();
  }

  disconnectedCallback() {
    // Clean up any active event subscriptions so we don't leak.
    this._unsubscribers.forEach((off) => {
      try { off(); } catch (_e) { /* ignore */ }
    });
    this._unsubscribers = [];
  }

  // ---- public API ----

  /**
   * Update the displayed text. Fires a `readout-text` event with
   * detail `{ text }` so consumers can mirror the change elsewhere.
   *
   * @param {string} text
   */
  setText(text) {
    const next = text == null ? '' : String(text);
    if (next === this._text) return;
    this._text = next;
    this._isActive = next.length > 0 && next !== DEFAULT_TEXT;
    this._render();
    this._dispatch(EVT_TEXT, { text: this._text });
  }

  /**
   * Read the current text. Returns the default text if no
   * setText() call has been made yet.
   *
   * @returns {string}
   */
  getText() {
    return this._text;
  }

  /**
   * Reset the readout to its default "Ready" text.
   */
  clear() {
    this.setText(DEFAULT_TEXT);
  }

  /**
   * Convenience: subscribe to a <dpad-control>'s events and
   * automatically update the readout text.
   *
   * @param {HTMLElement} dpadEl  a <dpad-control> element
   * @param {object} [labels]      optional override of the default
   *                               press/release/toggle labels
   * @returns {() => void}         an unsubscribe function
   */
  subscribe(dpadEl, labels = {}) {
    if (!dpadEl || typeof dpadEl.addEventListener !== 'function') {
      // eslint-disable-next-line no-console
      console.warn('[dpad-readout] subscribe() needs a valid element');
      return () => {};
    }

    const L = {
      press: { ...DEFAULT_LABELS.press, ...(labels.press || {}) },
      release: { ...DEFAULT_LABELS.release, ...(labels.release || {}) },
      toggle: labels.toggle || DEFAULT_LABELS.toggle,
    };

    const onPress = (ev) => {
      const action = ev.detail && ev.detail.action;
      if (!action) return;
      this.setText(L.press[action] || `${action} pressed`);
    };
    const onRelease = (ev) => {
      const action = ev.detail && ev.detail.action;
      if (!action) return;
      this.setText(L.release[action] || `${action} released`);
    };
    const onToggle = (ev) => {
      const active = !!(ev.detail && ev.detail.active);
      const text =
        typeof L.toggle === 'function' ? L.toggle(active) : L.toggle;
      this.setText(text);
    };

    dpadEl.addEventListener('dpad-press', onPress);
    dpadEl.addEventListener('dpad-release', onRelease);
    dpadEl.addEventListener('dpad-toggle', onToggle);

    const off = () => {
      dpadEl.removeEventListener('dpad-press', onPress);
      dpadEl.removeEventListener('dpad-release', onRelease);
      dpadEl.removeEventListener('dpad-toggle', onToggle);
    };
    this._unsubscribers.push(off);
    return off;
  }

  // ---- internals ----

  _mount() {
    const style = document.createElement('style');
    style.textContent = READOUT_STYLES;

    const host = document.createElement('div');
    host.className = READOUT_CLASS;
    host.innerHTML =
      '<span class="' + READOUT_ICON_CLASS + '">' +
        '<ha-icon icon="mdi:gesture-tap"></ha-icon>' +
      '</span>' +
      '<span class="' + READOUT_TEXT_CLASS + '"></span>';

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(host);
  }

  _render() {
    const textEl = this.shadowRoot && this.shadowRoot.querySelector('.' + READOUT_TEXT_CLASS);
    if (textEl) textEl.textContent = this._text;
    const root = this.shadowRoot && this.shadowRoot.querySelector('.' + READOUT_CLASS);
    if (root) root.classList.toggle(READOUT_CLASS + '--active', this._isActive);
  }

  /**
   * Dispatch a CustomEvent on the host with composed:true so it
   * crosses the shadow DOM boundary.
   *
   * @param {string} type
   * @param {object} detail
   */
  _dispatch(type, detail) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { ...detail },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

// Register the custom element. Guard against double-registration
// (e.g. if this module is imported more than once).
if (typeof customElements !== 'undefined' && !customElements.get('dpad-readout')) {
  customElements.define('dpad-readout', DpadReadout);
}

export { DpadReadout, DEFAULT_LABELS, EVT_TEXT };
