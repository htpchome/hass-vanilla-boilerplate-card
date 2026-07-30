/**
 * dpad-8way.js
 * ---------------------------------------------------------------
 * Reusable D-pad touchpad custom element: <dpad-8way-control>
 *
 * Drop this element into any HTML (or shadow root) and it will
 * render an 8-way circular touchpad with center mic:
 *
 *   [ ↖ ] [ ▲ ] [ ↗ ]
 *   [ ◄ ] [ 🎙 ] [ ► ]
 *   [ ↙ ] [ ▼ ] [ ↘ ]
 *
 * (Currently a 1:1 clone of dpad.js with renamed internals so
 * the two dpad elements can coexist on the same page without
 * colliding. The 8-way layout — 4 cardinals + 4 diagonals + 1
 * mic — is the next iteration. Names are namespaced with the
 * `8way` infix throughout: custom-element tag, root class,
 * button BEM modifiers, data attribute, event names, exports.)
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
 * use <dpad-8way-control> as-is.
 * ---------------------------------------------------------------
 */

// ----------------------------------------------------------------
// Internal class hooks & data attributes (kept private to the module)
// ----------------------------------------------------------------

const DPAD_8WAY_CLASS = "dpad-8way";
const DPAD_8WAY_BTN_CLASS = "dpad-8way__btn";
const DPAD_8WAY_BTN_UP = "dpad-8way__btn--up";
const DPAD_8WAY_BTN_DOWN = "dpad-8way__btn--down";
const DPAD_8WAY_BTN_LEFT = "dpad-8way__btn--left";
const DPAD_8WAY_BTN_RIGHT = "dpad-8way__btn--right";
const DPAD_8WAY_BTN_UP_LEFT = "dpad-8way__btn--up-left";
const DPAD_8WAY_BTN_UP_RIGHT = "dpad-8way__btn--up-right";
const DPAD_8WAY_BTN_DOWN_LEFT = "dpad-8way__btn--down-left";
const DPAD_8WAY_BTN_DOWN_RIGHT = "dpad-8way__btn--down-right";
const DPAD_8WAY_BTN_MIC = "dpad-8way__btn--mic";
const DPAD_8WAY_DATA_ACTION = "data-dpad-8way-action";
const DPAD_8WAY_ACTIONS = Object.freeze({
  UP: "up",
  UP_LEFT: "up-left",
  UP_RIGHT: "up-right",
  DOWN: "down",
  DOWN_LEFT: "down-left",
  DOWN_RIGHT: "down-right",
  LEFT: "left",
  RIGHT: "right",
  MIC: "mic",
});

// Custom events dispatched on the host element. Use 8way-infixed
// event names so a single page can have both a <dpad-control>
// and a <dpad-8way-control> without event name collisions.
const EVT_PRESS = "dpad-8way-press";
const EVT_RELEASE = "dpad-8way-release";
const EVT_TOGGLE = "dpad-8way-toggle";

// Local icon map keeps this module self-contained so it can be
// copied into any HA card without importing project files.
const DPAD_8WAY_ICON_NAMES = Object.freeze({
  DPAD_UP: "mdi:chevron-up",
  DPAD_DOWN: "mdi:chevron-down",
  DPAD_LEFT: "mdi:chevron-left",
  DPAD_RIGHT: "mdi:chevron-right",
  DPAD_DIAGONAL: "mdi:chevron-up",
  MICROPHONE: "mdi:microphone",
  MICROPHONE_OFF: "mdi:microphone-off",
});

const renderDpadIcon = (key, opts = {}) => {
  const name = DPAD_8WAY_ICON_NAMES[key];
  if (!name) return "";
  const cls = opts.className ? ' class="' + opts.className + '"' : "";
  return '<ha-icon icon="' + name + '"' + cls + "></ha-icon>";
};

// ----------------------------------------------------------------
// Styles — self-contained, uses only HA design tokens for theming
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
const DPAD_8WAY_STYLES = `
  :host {
    display: block;
    --dpad-size: 220px;
    --dpad-arrow-icon-size: 42px;   /* 150% larger than original 28px */
    --dpad-arrow-diag-icon-size: 24px;
    --dpad-mic-size: 96px;          /* 150% larger than original 64px */
    --dpad-mic-icon-size: 54px;     /* 150% larger than original 36px */
    --dpad-bg-1: var(--secondary-background-color);
    --dpad-bg-2: var(--primary-background-color);
    --dpad-text-1: var(--primary-text-color);
    --dpad-text-2: var(--secondary-text-color);
    --dpad-text-3: var(--disabled-text-color);
    --dpad-text-4: var(--text-primary-color);
  }

  .${DPAD_8WAY_CLASS} {
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

  .${DPAD_8WAY_BTN_CLASS} {
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
    .${DPAD_8WAY_BTN_CLASS}:hover {
      color: var(--dpad-text-1);
    }
  }

  .${DPAD_8WAY_BTN_CLASS}:focus-visible {
    outline: 2px solid var(--primary-color, #03a9f4);
    outline-offset: -4px;
  }

  .${DPAD_8WAY_BTN_CLASS} ha-icon {
    --mdc-icon-size: var(--dpad-arrow-icon-size);
    pointer-events: none;
  }

  .${DPAD_8WAY_BTN_UP}    { grid-area: 1 / 2; }
  .${DPAD_8WAY_BTN_UP_LEFT} {
    grid-area: 1 / 1;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
  }
  .${DPAD_8WAY_BTN_UP_RIGHT} {
    grid-area: 1 / 3;
    display: flex;
    justify-content: flex-start;
    align-items: flex-end;
  }
  .${DPAD_8WAY_BTN_DOWN}  { grid-area: 3 / 2; }
  .${DPAD_8WAY_BTN_DOWN_LEFT} {
    grid-area: 3 / 1;
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
  }
  .${DPAD_8WAY_BTN_DOWN_RIGHT} {
    grid-area: 3 / 3;
    display: flex;
    justify-content: flex-start;
    align-items: flex-start;
  }
  .${DPAD_8WAY_BTN_LEFT}  { grid-area: 2 / 1; }
  .${DPAD_8WAY_BTN_RIGHT} { grid-area: 2 / 3; }
  .${DPAD_8WAY_BTN_MIC}   {
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

  .${DPAD_8WAY_BTN_MIC} ha-icon {
    --mdc-icon-size: var(--dpad-mic-icon-size);
  }

  .${DPAD_8WAY_BTN_UP_LEFT} ha-icon,
  .${DPAD_8WAY_BTN_UP_RIGHT} ha-icon,
  .${DPAD_8WAY_BTN_DOWN_LEFT} ha-icon,
  .${DPAD_8WAY_BTN_DOWN_RIGHT} ha-icon {
    --mdc-icon-size: var(--dpad-arrow-diag-icon-size);
  }

  .${DPAD_8WAY_BTN_UP_LEFT} ha-icon { transform: rotate(-45deg); }
  .${DPAD_8WAY_BTN_UP_RIGHT} ha-icon { transform: rotate(45deg); }
  .${DPAD_8WAY_BTN_DOWN_LEFT} ha-icon { transform: rotate(-135deg); }
  .${DPAD_8WAY_BTN_DOWN_RIGHT} ha-icon { transform: rotate(135deg); }

  /* Momentary pressed state for arrow buttons — just brighten
     the icon, no background change (the plate is the background). */
  .${DPAD_8WAY_BTN_CLASS}.is-pressed {
    color: var(--dpad-text-1);
    transform: scale(0.92);
  }

  /* Mic toggle: when active, show a subtle green ring around
     the central disc. (Background stays dark per the reference.) */
  .${DPAD_8WAY_BTN_MIC}.is-active {
    box-shadow:
      inset 0 0 0 2px var(--success-color),
      inset 0 0 12px var(--success-color);
  }

  /* Mic icon swap: hide default when active, show "off" icon. */
  .${DPAD_8WAY_BTN_MIC} .dpad-8way__icon--active { display: none; }
  .${DPAD_8WAY_BTN_MIC}.is-active .dpad-8way__icon--default { display: none; }
  .${DPAD_8WAY_BTN_MIC}.is-active .dpad-8way__icon--active  { display: inline-flex; }
`;

// ----------------------------------------------------------------
// DOM construction
// ----------------------------------------------------------------

/**
 * Build the inner DOM tree for a D-pad button.
 *
 * @param {string} action     one of DPAD_8WAY_ACTIONS.*
 * @param {string} extraClass BEM modifier
 * @param {string} iconKey    key into ICON_NAMES (default icon)
 * @param {string} label      aria-label
 * @param {string} [activeIconKey] optional alt icon for toggles
 * @returns {string} raw HTML
 */
const buildButtonHtml = (action, extraClass, iconKey, label, activeIconKey) => {
  let inner = renderDpadIcon(iconKey, {
    className: DPAD_8WAY_BTN_CLASS + "__icon dpad-8way__icon--default",
  });
  if (activeIconKey) {
    inner += renderDpadIcon(activeIconKey, {
      className: DPAD_8WAY_BTN_CLASS + "__icon dpad-8way__icon--active",
    });
  }
  return (
    '<button type="button" ' +
    'class="' +
    DPAD_8WAY_BTN_CLASS +
    " " +
    extraClass +
    '" ' +
    DPAD_8WAY_DATA_ACTION +
    '="' +
    action +
    '" ' +
    'aria-label="' +
    label +
    '" ' +
    'aria-pressed="false">' +
    inner +
    "</button>"
  );
};

/**
 * Render the full D-pad markup.
 * @returns {string} raw HTML
 */
const buildDpadHtml = () => {
  const upLeft = buildButtonHtml(
    DPAD_8WAY_ACTIONS.UP_LEFT,
    DPAD_8WAY_BTN_UP_LEFT,
    "DPAD_DIAGONAL",
    "Up-left",
  );
  const up = buildButtonHtml(
    DPAD_8WAY_ACTIONS.UP,
    DPAD_8WAY_BTN_UP,
    "DPAD_UP",
    "Up",
  );
  const upRight = buildButtonHtml(
    DPAD_8WAY_ACTIONS.UP_RIGHT,
    DPAD_8WAY_BTN_UP_RIGHT,
    "DPAD_DIAGONAL",
    "Up-right",
  );
  const down = buildButtonHtml(
    DPAD_8WAY_ACTIONS.DOWN,
    DPAD_8WAY_BTN_DOWN,
    "DPAD_DOWN",
    "Down",
  );
  const downLeft = buildButtonHtml(
    DPAD_8WAY_ACTIONS.DOWN_LEFT,
    DPAD_8WAY_BTN_DOWN_LEFT,
    "DPAD_DIAGONAL",
    "Down-left",
  );
  const downRight = buildButtonHtml(
    DPAD_8WAY_ACTIONS.DOWN_RIGHT,
    DPAD_8WAY_BTN_DOWN_RIGHT,
    "DPAD_DIAGONAL",
    "Down-right",
  );
  const left = buildButtonHtml(
    DPAD_8WAY_ACTIONS.LEFT,
    DPAD_8WAY_BTN_LEFT,
    "DPAD_LEFT",
    "Left",
  );
  const right = buildButtonHtml(
    DPAD_8WAY_ACTIONS.RIGHT,
    DPAD_8WAY_BTN_RIGHT,
    "DPAD_RIGHT",
    "Right",
  );
  // Mic button icon swap:
  //   - default (off): show mdi:microphone-off
  //   - active  (on):  show mdi:microphone (recording in progress)
  // The first iconKey is the default; the second is the active.
  const mic = buildButtonHtml(
    DPAD_8WAY_ACTIONS.MIC,
    DPAD_8WAY_BTN_MIC,
    "MICROPHONE_OFF",
    "Toggle microphone",
    "MICROPHONE",
  );
  // Each button is a direct grid child. The grid is 3x3 and each
  // button uses its own `grid-area` to position itself:
  //   - up     -> row 1, col 2
  //   - left   -> row 2, col 1
  //   - mic    -> row 2, col 2 (the center, slightly larger)
  //   - right  -> row 2, col 3
  //   - down   -> row 3, col 2
  // No slot wrappers — putting multiple buttons in one grid cell
  // would cause them to overlap (the bug we just fixed).
  return (
    '<div class="' +
    DPAD_8WAY_CLASS +
    '" role="group" aria-label="D-pad control">' +
    upLeft +
    up +
    upRight +
    left +
    mic +
    right +
    downLeft +
    down +
    downRight +
    "</div>"
  );
};

// ----------------------------------------------------------------
// The custom element
// ----------------------------------------------------------------

/**
 * <dpad-8way-control> — a reusable D-pad touchpad custom element.
 *
 * Public API:
 *   - setActive(action, active)  programmatically toggle a button
 *   - getState()                 returns { mic: boolean }
 *   - addEventListener('dpad-8way-press',   fn) { action, originalEvent }
 *   - addEventListener('dpad-8way-release', fn) { action, originalEvent }
 *   - addEventListener('dpad-8way-toggle',  fn) { action, active, originalEvent }
 *
 * Press/release actions:
 *   up, up-right, right, down-right, down, down-left, left, up-left
 *
 * Toggle actions:
 *   mic
 *
 * All events bubble and are composed, so they cross shadow
 * boundaries. Consumers in any shadow root can listen to them.
 */
class Dpad8wayControl extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    // State: which buttons are currently pressed / active.
    this._pressed = new Set();
    this._pressedByPointer = new Map();
    this._activeMic = false;
    // Guard against re-mounting the shadow content if the element
    // is moved or recycled in the DOM (e.g. when Home Assistant's
    // card editor re-parents the live card during dialog open/
    // close). Without this, each connectedCallback appends another
    // <style> + <div class="dpad-8way"> to the shadow root, which
    // stacks the dpad UI on top of itself.
    this._mounted = false;
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
    // Do NOT reset _mounted here. The element is still the same
    // instance; on re-connection we want _mount to be a no-op.
    // If the element is genuinely destroyed (GC), the flag goes
    // with it. If HA ever does a true element replace, the new
    // element gets a fresh _mounted=false in its constructor.
  }

  // ---- public API ----

  /**
   * Programmatically set the active state of a button.
   *
   * @param {string} action one of DPAD_8WAY_ACTIONS.*
   * @param {boolean} active true to activate, false to deactivate
   */
  setActive(action, active) {
    if (action === DPAD_8WAY_ACTIONS.MIC) {
      this._activeMic = Boolean(active);
      this._applyMicState();
    }
    // Arrow buttons are momentary; programmatic setActive on them
    // is a no-op. Use dispatchEvent via setPressed() if you need
    // to simulate a press.
  }

  /**
   * Read the current persistent state of the D-pad.
   * (Momentary press state is not exposed — only toggles.)
   *
   * @returns {{ mic: boolean }}
   */
  getState() {
    return { mic: this._activeMic };
  }

  // ---- internals ----

  _mount() {
    // Idempotent: only build the shadow content once per element
    // instance. connectedCallback can fire multiple times if the
    // element is moved in the DOM (e.g. by Home Assistant's card
    // editor re-parenting the live card during dialog open/close);
    // without this guard, each re-connection would append another
    // <style> + <div class="dpad-8way"> to the same shadow root, which
    // visually stacks the dpad UI on top of itself.
    if (this._mounted) return;
    this._mounted = true;

    const style = document.createElement("style");
    style.textContent = DPAD_8WAY_STYLES;

    const host = document.createElement("div");
    host.innerHTML = buildDpadHtml();

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(host.firstElementChild);
  }

  _wirePointerEvents() {
    const root = this.shadowRoot;
    if (!root) return;

    const findBtn = (target) =>
      target instanceof Element
        ? target.closest("[" + DPAD_8WAY_DATA_ACTION + "]")
        : null;

    const clearPressed = (btn) => {
      if (!btn) return;
      const action = btn.getAttribute(DPAD_8WAY_DATA_ACTION);
      if (!this._pressed.has(action)) return;
      this._pressed.delete(action);
      btn.classList.remove("is-pressed");
    };

    const releaseByPointer = (ev) => {
      if (!ev || ev.pointerId === null || ev.pointerId === undefined)
        return false;
      const state = this._pressedByPointer.get(ev.pointerId);
      if (!state) return false;
      this._pressedByPointer.delete(ev.pointerId);
      clearPressed(state.btn);
      this._dispatch(EVT_RELEASE, { action: state.action });
      return true;
    };

    // pointerdown: start a press for any D-pad button
    root.addEventListener("pointerdown", (ev) => {
      const btn = findBtn(ev.target);
      if (!btn) return;
      const action = btn.getAttribute(DPAD_8WAY_DATA_ACTION);
      if (action === DPAD_8WAY_ACTIONS.MIC) return; // mic is a click toggle, not a press
      this._pressed.add(action);
      if (ev.pointerId !== null && ev.pointerId !== undefined) {
        this._pressedByPointer.set(ev.pointerId, { action, btn });
      }
      btn.classList.add("is-pressed");
      this._dispatch(EVT_PRESS, { action });
      // Capture pointer so we still receive pointerup if the user
      // drags off the button (common on touch).
      if (
        typeof btn.setPointerCapture === "function" &&
        ev.pointerId !== null
      ) {
        try {
          btn.setPointerCapture(ev.pointerId);
        } catch (_e) {
          /* ignore */
        }
      }
    });

    // pointerup / pointercancel: release the press
    const release = (ev) => {
      if (releaseByPointer(ev)) return;
      const btn = findBtn(ev.target);
      if (!btn) return;
      const action = btn.getAttribute(DPAD_8WAY_DATA_ACTION);
      if (!this._pressed.has(action)) return;
      clearPressed(btn);
      this._dispatch(EVT_RELEASE, { action });
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);

    // pointerleave: clear if the pointer truly leaves the button
    root.addEventListener("pointerleave", (ev) => {
      if (releaseByPointer(ev)) return;
      const btn = findBtn(ev.target);
      if (!btn) return;
      if (ev.relatedTarget && btn.contains(ev.relatedTarget)) return;
      const action = btn.getAttribute(DPAD_8WAY_DATA_ACTION);
      clearPressed(btn);
      this._dispatch(EVT_RELEASE, { action });
    });

    // click: toggle the mic button
    root.addEventListener("click", (ev) => {
      const btn = findBtn(ev.target);
      if (!btn) return;
      if (btn.getAttribute(DPAD_8WAY_DATA_ACTION) !== DPAD_8WAY_ACTIONS.MIC)
        return;
      this._activeMic = !this._activeMic;
      this._applyMicState();
      this._dispatch(EVT_TOGGLE, {
        action: DPAD_8WAY_ACTIONS.MIC,
        active: this._activeMic,
      });
    });
  }

  _applyMicState() {
    const root = this.shadowRoot;
    if (!root) return;
    const mic = root.querySelector("." + DPAD_8WAY_BTN_MIC);
    if (!mic) return;
    mic.classList.toggle("is-active", this._activeMic);
    mic.setAttribute("aria-pressed", String(this._activeMic));
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
if (
  typeof customElements !== "undefined" &&
  !customElements.get("dpad-8way-control")
) {
  customElements.define("dpad-8way-control", Dpad8wayControl);
}

export {
  Dpad8wayControl,
  DPAD_8WAY_ACTIONS,
  EVT_PRESS,
  EVT_RELEASE,
  EVT_TOGGLE,
};
