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
 *   - The center microphone button is a toggle. By default it
 *     shows mdi:microphone-off (the mic is muted); when active
 *     it shows mdi:microphone (recording in progress) and the
 *     central disc gets a green ring. Each toggle fires
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

// Visual design matches the reference image:
//   - Four arrow icons at the cardinal points (transparent
//     backgrounds; just the icon shows on the plate).
//   - Four diagonal "spoke" lines connecting the center disc to
//     each arrow icon (rendered as a single CSS background using
//     repeating-linear-gradient on the .dpad container).
//   - A darker raised disc in the center holding the mic button.
//
// The colors are intentionally dark (not theme-aware) to match
// the reference. If you want the D-pad to follow the active HA
// theme, swap the gradient stops and the icon color to use
// HA design tokens (--primary-text-color, --secondary-background-color, etc.).
const DPAD_STYLES = `
  :host {
    display: block;
    --dpad-size: 220px;
    --dpad-arrow-icon-size: 42px;   /* 150% larger than original 28px */
    --dpad-mic-size: 96px;          /* 150% larger than original 64px */
    --dpad-mic-icon-size: 54px;     /* 150% larger than original 36px */
    --dpad-bg-1: var(--secondary-background-color);
    --dpad-bg-2: var(--primary-background-color);
    --dpad-text-1: var(--primary-text-color);
    --dpad-text-2: var(--secondary-text-color);
    --dpad-text-3: var(--disabled-text-color);
    --dpad-text-4: var(--text-primary-color);
  }

  .${DPAD_CLASS} {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    column-gap: 0;
    row-gap: 0;
    width: var(--dpad-size);
    height: var(--dpad-size);
    max-width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    /* Plate gradient (no decorative overlay). */
    /* background: radial-gradient(circle at top left, #202020 15%, #303030 100%); */
    background-image: 
      radial-gradient(circle 95% at top left, var(--dpad-bg-1) 15%, var(--dpad-bg-2) 100%),
      radial-gradient(circle 100% at top left, #202020 15%, #303030 100%);
    border: 1px solid var(--dpad-text-3);
    box-shadow: inset 0 0 12px var(--dpad-text-3);
    overflow: hidden;
  }

  .${DPAD_BTN_CLASS} {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    padding: 0;
    margin: 0;
    background: transparent;
    color: var(--dpad-text-2); /* muted icon color */
    border: none;
    border-radius: 0;
    cursor: pointer;
    transition: color 80ms ease, transform 80ms ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  /* Hover effect is scoped to devices with a real pointing
     device (mouse, trackpad, stylus). On touch screens the
     hover state would otherwise stick after a tap because the
     finger remains over the button at the last tap location
     until the user touches elsewhere. The press state is still
     driven by the is-pressed class (JS), which works correctly
     on both touch and mouse. */
  @media (hover: hover) {
    .${DPAD_BTN_CLASS}:hover {
      color: var(--dpad-text-1);
    }
  }

  .${DPAD_BTN_CLASS}:focus-visible {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: -4px;
  }

  .${DPAD_BTN_CLASS} ha-icon {
    --mdc-icon-size: var(--dpad-arrow-icon-size);
    pointer-events: none;
  }

  .${DPAD_BTN_UP}    { grid-area: 1 / 2; }
  .${DPAD_BTN_DOWN}  { grid-area: 3 / 2; }
  .${DPAD_BTN_LEFT}  { grid-area: 2 / 1; }
  .${DPAD_BTN_RIGHT} { grid-area: 2 / 3; }
  .${DPAD_BTN_MIC}   {
    grid-area: 2 / 2;
    width: var(--dpad-mic-size);
    height: var(--dpad-mic-size);
    align-self: center;
    justify-self: center;
    margin: auto;
    /* The raised dark disc around the mic. */
    background: radial-gradient(circle at top left, var(--dpad-bg-1) 15%, var(--dpad-bg-2) 100%);
    border: 1px solid var(--dpad-text-1);
    border-radius: 50%;
    color: var(--dpad-text-2);
  }

  .${DPAD_BTN_MIC} ha-icon {
    --mdc-icon-size: var(--dpad-mic-icon-size);
  }

  /* Momentary pressed state for arrow buttons — just brighten
     the icon, no background change (the plate is the background). */
  .${DPAD_BTN_CLASS}.is-pressed {
    color: var(--dpad-text-1);
    transform: scale(0.92);
  }

  /* Mic toggle: when active, show a subtle green ring around
     the central disc. (Background stays dark per the reference.) */
  .${DPAD_BTN_MIC}.is-active {
    box-shadow:
      inset 0 0 0 2px var(--success-color),
      inset 0 0 12px var(--success-color);
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
  // Mic button icon swap:
  //   - default (off): show mdi:microphone-off
  //   - active  (on):  show mdi:microphone (recording in progress)
  // The first iconKey is the default; the second is the active.
  const mic = buildButtonHtml(
    DPAD_ACTIONS.MIC,
    DPAD_BTN_MIC,
    'MICROPHONE_OFF',
    'Toggle microphone',
    'MICROPHONE',
  );
  // Each button is a direct grid child. The grid is 3x3 and each
  // button uses its own `grid-area` to position itself:
  //   - up     -> row 1, col 2
  //   - left   -> row 2, col 1
  //   - mic    -> row 2, col 2 (the center, slightly larger)
  //   - right  -> row 2, col 3
  //   - down   -> row 3, col 2
  // No slot wrappers \u2014 putting multiple buttons in one grid cell
  // would cause them to overlap (the bug we just fixed).
  return (
    '<div class="' + DPAD_CLASS + '" role="group" aria-label="D-pad control">' +
      up + left + mic + right + down +
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
