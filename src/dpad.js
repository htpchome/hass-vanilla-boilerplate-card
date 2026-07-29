/**
 * dpad.js
 * ---------------------------------------------------------------
 * Reusable D-pad touchpad custom element: <dpad-control>
 *
 * Drop this element into any HTML (or shadow root) and it will
 * render a 5-button circular touchpad:
 *
 *        [ ▲ ]
 *  [ ◄ ]  [ 🎙 ]  [ ► ]
 *        [ ▼ ]
 *
 *   - 4 arrow buttons are momentary. While held they show
 *     --primary-color. On release they fire `dpad-release`.
 *   - The center microphone button is a toggle. When active it
 *     shows green (--ha-color-green) and the icon swaps from
 *     mdi:microphone to mdi:microphone-off. Each toggle fires
 *     `dpad-toggle` with detail `{ active: boolean }`.
 *
 * The element is fully self-contained:
 *   - Shadow DOM for style isolation
 *   - Native HA design tokens (auto-themes light/dark/custom)
 *   - Owns its own pointer event handling (mouse + touch)
 *   - Dispatches standard CustomEvents that bubble+compose, so
 *     consumers in any shadow root can listen for them.
 *
 * No coupling to card.js, controller.js, or any other module in
 * this project — you can copy this file into another project and
 * use <dpad-control> as-is.
 * ---------------------------------------------------------------
 */

import { renderIcon } from './icons.js';

// ----------------------------------------------------------------
// Internal class hooks & data attributes (kept private to the module)
// ----------------------------------------------------------------

const DPAD_CLASS = 'dpad';
const DPAD_BTN_CLASS = 'dpad__btn';
const DPAD_BTN_UP = 'dpad__btn--up';
const DPAD_BTN_DOWN = 'dpad__btn--down';
const DPAD_BTN_LEFT = 'dpad__btn--left';
const DPAD_BTN_RIGHT = 'dpad__btn--right';
const DPAD_BTN_MIC = 'dpad__btn--mic';
const DPAD_DATA_ACTION = 'data-dpad-action';
const DPAD_ACTIONS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  MIC: 'mic',
});

// Custom events dispatched on the host element.
const EVT_PRESS = 'dpad-press';
const EVT_RELEASE = 'dpad-release';
const EVT_TOGGLE = 'dpad-toggle';

// ----------------------------------------------------------------
// Styles \u2014 self-contained, uses only HA design tokens for theming
// ----------------------------------------------------------------

const DPAD_STYLES = `
  :host {
    display: block;
    --dpad-size: 220px;
    --dpad-btn-size: 64px;
    --dpad-mic-size: 72px;
  }

  .${DPAD_CLASS} {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 4px;
    width: var(--dpad-size);
    height: var(--dpad-size);
    max-width: 100%;
    aspect-ratio: 1 / 1;
  }

  .${DPAD_CLASS}__slot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
  }

  .${DPAD_BTN_CLASS} {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    max-width: var(--dpad-btn-size);
    max-height: var(--dpad-btn-size);
    aspect-ratio: 1 / 1;
    padding: 0;
    margin: 0;
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
    color: var(--primary-text-color);
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
    border-radius: 50%;
    cursor: pointer;
    transition: background-color 80ms ease, color 80ms ease,
                border-color 80ms ease, transform 80ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .${DPAD_BTN_CLASS}:hover {
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.16));
  }

  .${DPAD_BTN_CLASS}:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .${DPAD_BTN_CLASS} ha-icon {
    --mdc-icon-size: 28px;
    pointer-events: none;
  }

  .${DPAD_BTN_UP}    { grid-area: 1 / 2; }
  .${DPAD_BTN_DOWN}  { grid-area: 3 / 2; }
  .${DPAD_BTN_LEFT}  { grid-area: 2 / 1; }
  .${DPAD_BTN_RIGHT} { grid-area: 2 / 3; }
  .${DPAD_BTN_MIC}   {
    grid-area: 2 / 2;
    max-width: var(--dpad-mic-size);
    max-height: var(--dpad-mic-size);
  }

  /* Momentary pressed state for arrow buttons. */
  .${DPAD_BTN_CLASS}.is-pressed {
    background: var(--primary-color);
    color: var(--card-background-color, #fff);
    border-color: var(--primary-color);
    transform: scale(0.95);
  }

  /* Mic toggle: when active, green background. */
  .${DPAD_BTN_MIC}.is-active {
    background: var(--ha-color-green, #4caf50);
    color: #fff;
    border-color: var(--ha-color-green, #4caf50);
  }

  /* Mic icon swap: hide default when active, show "off" icon. */
  .${DPAD_BTN_MIC} .dpad__icon--active { display: none; }
  .${DPAD_BTN_MIC}.is-active .dpad__icon--default { display: none; }
  .${DPAD_BTN_MIC}.is-active .dpad__icon--active  { display: inline-flex; }
`;

// ----------------------------------------------------------------
// DOM construction
// ----------------------------------------------------------------

/**
 * Build the inner DOM tree for a D-pad button.
 *
 * @param {string} action     one of DPAD_ACTIONS.*
 * @param {string} extraClass BEM modifier
 * @param {string} iconKey    key into ICON_NAMES (default icon)
 * @param {string} label      aria-label
 * @param {string} [activeIconKey] optional alt icon for toggles
 * @returns {string} raw HTML
 */
const buildButtonHtml = (action, extraClass, iconKey, label, activeIconKey) => {
  let inner = renderIcon(iconKey, {
    className: DPAD_BTN_CLASS + '__icon dpad__icon--default',
  });
  if (activeIconKey) {
    inner += renderIcon(activeIconKey, {
      className: DPAD_BTN_CLASS + '__icon dpad__icon--active',
    });
  }
  return (
    '<button type="button" ' +
      'class="' + DPAD_BTN_CLASS + ' ' + extraClass + '" ' +
      DPAD_DATA_ACTION + '="' + action + '" ' +
      'aria-label="' + label + '" ' +
      'aria-pressed="false">' +
      inner +
    '</button>'
  );
};

/**
 * Render the full D-pad markup.
 * @returns {string} raw HTML
 */
const buildDpadHtml = () => {
  const up = buildButtonHtml(DPAD_ACTIONS.UP, DPAD_BTN_UP, 'DPAD_UP', 'Up');
  const down = buildButtonHtml(DPAD_ACTIONS.DOWN, DPAD_BTN_DOWN, 'DPAD_DOWN', 'Down');
  const left = buildButtonHtml(DPAD_ACTIONS.LEFT, DPAD_BTN_LEFT, 'DPAD_LEFT', 'Left');
  const right = buildButtonHtml(DPAD_ACTIONS.RIGHT, DPAD_BTN_RIGHT, 'DPAD_RIGHT', 'Right');
  const mic = buildButtonHtml(
    DPAD_ACTIONS.MIC,
    DPAD_BTN_MIC,
    'MICROPHONE',
    'Toggle microphone',
    'MICROPHONE_OFF',
  );
  return (
    '<div class="' + DPAD_CLASS + '" role="group" aria-label="D-pad control">' +
      '<div class="' + DPAD_CLASS + '__slot">' + up + '</div>' +
      '<div class="' + DPAD_CLASS + '__slot">' + left + mic + right + '</div>' +
      '<div class="' + DPAD_CLASS + '__slot">' + down + '</div>' +
    '</div>'
  );
};

// ----------------------------------------------------------------
// The custom element
// ----------------------------------------------------------------

/**
 * <dpad-control> \u2014 a reusable D-pad touchpad custom element.
 *
 * Public API:
 *   - setActive(action, active)  programmatically toggle a button
 *   - getState()                 returns { mic: boolean }
 *   - addEventListener('dpad-press', fn)     { action, originalEvent }
 *   - addEventListener('dpad-release', fn)   { action, originalEvent }
 *   - addEventListener('dpad-toggle', fn)    { action, active, originalEvent }
 *
 * All events bubble and are composed, so they cross shadow
 * boundaries. Consumers in any shadow root can listen to them.
 */
class DpadControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    // State: which buttons are currently pressed / active.
    this._pressed = new Set();
    this._activeMic = false;
  }

  // ---- lifecycle ----

  connectedCallback() {
    this._mount();
    this._wirePointerEvents();
  }

  disconnectedCallback() {
    // Best-effort: clear any pressed state when the element is
    // removed from the DOM so we don't leak listeners.
    this._pressed.clear();
  }

  // ---- public API ----

  /**
   * Programmatically set the active state of a button.
   *
   * @param {string} action one of DPAD_ACTIONS.*
   * @param {boolean} active true to activate, false to deactivate
   */
  setActive(action, active) {
    if (action === DPAD_ACTIONS.MIC) {
      this._activeMic = Boolean(active);
      this._applyMicState();
    }
    // Arrow buttons are momentary; programmatic setActive on them
    // is a no-op. Use dispatchEvent via setPressed() if you need
    // to simulate a press.
  }

  /**
   * Read the current persistent state of the D-pad.
   * (Momentary press state is not exposed \u2014 only toggles.)
   *
   * @returns {{ mic: boolean }}
   */
  getState() {
    return { mic: this._activeMic };
  }

  // ---- internals ----

  _mount() {
    const style = document.createElement('style');
    style.textContent = DPAD_STYLES;

    const host = document.createElement('div');
    host.innerHTML = buildDpadHtml();

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(host.firstElementChild);
  }

  _wirePointerEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    const findBtn = (target) =>
      target instanceof Element ? target.closest('[' + DPAD_DATA_ACTION + ']') : null;

    const clearPressed = (btn) => {
      if (!btn) return;
      const action = btn.getAttribute(DPAD_DATA_ACTION);
      if (!this._pressed.has(action)) return;
      this._pressed.delete(action);
      btn.classList.remove('is-pressed');
    };

    // pointerdown: start a press for any D-pad button
    root.addEventListener('pointerdown', (ev) => {
      const btn = findBtn(ev.target);
      if (!btn) return;
      const action = btn.getAttribute(DPAD_DATA_ACTION);
      if (action === DPAD_ACTIONS.MIC) return; // mic is a click toggle, not a press
      this._pressed.add(action);
      btn.classList.add('is-pressed');
      this._dispatch(EVT_PRESS, { action });
      // Capture pointer so we still receive pointerup if the user
      // drags off the button (common on touch).
      if (typeof btn.setPointerCapture === 'function' && ev.pointerId !== null) {
        try { btn.setPointerCapture(ev.pointerId); } catch (_e) { /* ignore */ }
      }
    });

    // pointerup / pointercancel: release the press
    const release = (ev) => {
      const btn = findBtn(ev.target);
      if (!btn) return;
      const action = btn.getAttribute(DPAD_DATA_ACTION);
      if (!this._pressed.has(action)) return;
      clearPressed(btn);
      this._dispatch(EVT_RELEASE, { action });
    };
    root.addEventListener('pointerup', release);
    root.addEventListener('pointercancel', release);

    // pointerleave: clear if the pointer truly leaves the button
    root.addEventListener('pointerleave', (ev) => {
      const btn = findBtn(ev.target);
      if (!btn) return;
      if (ev.relatedTarget && btn.contains(ev.relatedTarget)) return;
      clearPressed(btn);
    });

    // click: toggle the mic button
    root.addEventListener('click', (ev) => {
      const btn = findBtn(ev.target);
      if (!btn) return;
      if (btn.getAttribute(DPAD_DATA_ACTION) !== DPAD_ACTIONS.MIC) return;
      this._activeMic = !this._activeMic;
      this._applyMicState();
      this._dispatch(EVT_TOGGLE, {
        action: DPAD_ACTIONS.MIC,
        active: this._activeMic,
      });
    });
  }

  _applyMicState() {
    const root = this.shadowRoot;
    if (!root) return;
    const mic = root.querySelector('.' + DPAD_BTN_MIC);
    if (!mic) return;
    mic.classList.toggle('is-active', this._activeMic);
    mic.setAttribute('aria-pressed', String(this._activeMic));
  }

  /**
   * Dispatch a CustomEvent on the host with composed:true so it
   * crosses the shadow DOM boundary. Listeners on the host (or
   * any ancestor) will see it.
   *
   * @param {string} type
   * @param {object} detail
   */
  _dispatch(type, detail) {
    this.dispatchEvent(
      new CustomEvent(type, {
        detail: { ...detail, originalEvent: undefined },
        bubbles: true,
        composed: true,
      }),
    );
  }
}

// Register the custom element. Guard against double-registration
// (e.g. if this module is imported more than once).
if (typeof customElements !== 'undefined' && !customElements.get('dpad-control')) {
  customElements.define('dpad-control', DpadControl);
}

export { DpadControl, DPAD_ACTIONS, EVT_PRESS, EVT_RELEASE, EVT_TOGGLE };
