(function () {
  'use strict';

  /**
   * constants.js
   * ---------------------------------------------------------------
   * Centralized configuration defaults, action strings, and internal
   * layout types. All static keys and magic strings used across the
   * card live here to prevent drift and enable safe refactors.
   * ---------------------------------------------------------------
   */

  // ---------- Card identity ----------
  const CARD_VERSION = "0.1.84";
  const CARD_TYPE = "hass-vanilla-boilerplate-card";
  const CARD_NAME = "HASS Vanilla Boilerplate Card";
  const CARD_DESCRIPTION =
    "A production-ready vanilla JS Home Assistant Lovelace card boilerplate.";

  // ---------- Defaults (used by setConfig + getStubConfig) ----------
  const DEFAULTS = Object.freeze({
    title: "Vanilla Boilerplate",
    subtitle: "A modular Home Assistant card",
    content: "<p>Hello, <strong>Home Assistant</strong>!</p>",
  });

  // ---------- Layout / view identifiers (used by router.js) ----------
  const LAYOUTS = Object.freeze({
    MAIN: "main",
    // Reserved for future tabs/views added via router.js
    DETAIL: "detail",
    // Third view: the 8-way dpad. See src/dpad-8way.js.
    DETAIL_8WAY: "detail-8way",
    // Fourth view: the circle pad. See src/circle-pad.js.
    DETAIL_CIRCLE: "detail-circle",
    SETTINGS: "settings",
  });

  // ---------- Selector regions in the card DOM ----------
  const REGIONS = Object.freeze({
    CARD_WRAPPER: "card-wrapper",
    HEADER: "card-header",
    TITLE: "card-title",
    SUBTITLE: "card-subtitle",
    CONTENT: "card-content",
    FOOTER: "card-footer",
  });

  // ---------- CSS class names (mirror of REGIONS where needed) ----------
  Object.freeze({
    ...REGIONS,
  });

  // ---------- Safety / error message keys ----------
  const ERROR_KEYS = Object.freeze({
    MISSING_CONFIG: "missing_config",
    INVALID_CONFIG: "invalid_config",
    MISSING_HASS: "missing_hass",
  });

  /**
   * helpers.js
   * ---------------------------------------------------------------
   * Common utility functions used across the card lifecycle.
   * Covers:
   *  - text localization / formatting
   *  - safety state checks (entity existence, config validity)
   *  - custom click action dispatching (fireEvent)
   *  - error boundaries / warnings when an entity or config is missing
   *  - small DOM / template utilities
   * ---------------------------------------------------------------
   */


  /**
   * Safe HTML escape — used whenever user-supplied text must be
   * inserted into a template literal as text content.
   *
   * @param {unknown} value
   * @returns {string}
   */
  // Entity lookup table built from String.fromCharCode to avoid any
  // tool that might mangle literal HTML entities in source files.
  const HTML_ENTITIES = {
    '&': String.fromCharCode(38, 97, 109, 112, 59),   // &
    '<': String.fromCharCode(38, 108, 116, 59),        // <
    '>': String.fromCharCode(38, 103, 116, 59),        // >
    '"': String.fromCharCode(38, 113, 117, 111, 116, 59), // "
    "'": String.fromCharCode(38, 35, 51, 57, 59),      // &#39;
  };
  const ESCAPE_PATTERN = /[&<>"']/g;

  const escapeHtml$1 = (value) => {
    if (value === null || value === undefined) return '';
    return String(value).replace(ESCAPE_PATTERN, (ch) => HTML_ENTITIES[ch]);
  };

  // ----------------------------------------------------------------
  // Safety / state checks
  // ----------------------------------------------------------------

  /**
   * Check whether a config object looks like a valid card config.
   * Currently a permissive shallow check; expand as needed.
   *
   * @param {unknown} config
   * @returns {boolean}
   */
  const isValidConfig = (config) =>
    config !== null && typeof config === 'object' && !Array.isArray(config);

  /**
   * Merge a partial config with defaults so downstream code can rely
   * on every field being defined.
   *
   * @param {Partial<typeof DEFAULTS>|null|undefined} config
   * @returns {typeof DEFAULTS}
   */
  const mergeDefaults = (config) => ({
    ...DEFAULTS,
    ...(isValidConfig(config) ? config : {}),
  });

  /**
   * Verify that an entity id exists on the supplied hass object.
   *
   * @param {{states: Record<string, unknown>}|null|undefined} hass
   * @param {string} entityId
   * @returns {boolean}
   */
  const hasEntity = (hass, entityId) =>
    Boolean(
      hass &&
        hass.states &&
        Object.prototype.hasOwnProperty.call(hass.states, entityId),
    );

  // ----------------------------------------------------------------
  // fireEvent — standard Home Assistant event dispatcher
  // ----------------------------------------------------------------

  /**
   * Dispatch a CustomEvent on a node with composed:true so the event
   * crosses the shadow DOM boundary. This is the standard pattern
   * used by HA cards to invoke `hass-action` and `config-changed`.
   *
   * @param {HTMLElement} node
   * @param {string} type
   * @param {object} [detail]
   * @param {boolean} [bubbles=true]
   */
  const fireEvent = (node, type, detail = {}, bubbles = true) => {
    if (!node) return;
    const event = new CustomEvent(type, {
      detail,
      bubbles,
      composed: true,
      cancelable: Boolean(detail && detail.cancelable),
    });
    node.dispatchEvent(event);
  };

  /**
   * Convenience wrapper for the standard `hass-action` event.
   *
   * IMPORTANT — event detail shape:
   *   Home Assistant's `handle-action` mixin (handle-action.ts:39)
   *   reads `e.detail.action` and then `e.detail.config[action]`
   *   to find the user's `tap_action` / `hold_action` etc. So the
   *   detail MUST be:
   *     { action: 'tap', config: { tap_action: { ...user's... } } }
   *   NOT:
   *     { action: 'tap', data: { config: ... } }
   *
   * @param {HTMLElement} node
   * @param {string} action        e.g. 'tap', 'hold', 'double_tap'
   * @param {object} [actionConfig] the user's action config object
   *                               (the value of `tap_action` in YAML).
   *                               Defaults to `{ action: 'none' }` so
   *                               HA doesn't crash if the user has
   *                               not configured one.
   */
  const fireHassAction = (node, action, actionConfig) => {
    const config =
      actionConfig && typeof actionConfig === 'object'
        ? actionConfig
        : { action: 'none' };
    fireEvent(node, 'hass-action', { action, config });
  };

  // ----------------------------------------------------------------
  // Error boundaries / warnings
  // ----------------------------------------------------------------

  /**
   * Render a small, themed warning block. Used when config is
   * missing/invalid or when a referenced entity does not exist.
   *
   * @param {string} message
   * @returns {string} raw HTML string
   */
  const renderErrorMessage = (message) => `
  <div class="error-message" role="alert">
    <ha-icon icon="mdi:alert-circle"></ha-icon>
    <span>${escapeHtml$1(message)}</span>
  </div>
`;

  /**
   * Warn-once helper. Calls console.warn the first time a given key
   * is seen; subsequent calls are silent to avoid log spam.
   *
   * @param {string} key
   * @param {...any} args
   */
  const _warned = new Set();
  const warnOnce = (key, ...args) => {
    if (_warned.has(key)) return;
    _warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[${CARD_TYPE}]`, ...args);
  };

  /**
   * Assert a config is valid; log a warning and return false if not.
   *
   * @param {unknown} config
   * @returns {boolean}
   */
  const assertValidConfig = (config) => {
    if (!isValidConfig(config)) {
      warnOnce(ERROR_KEYS.INVALID_CONFIG, 'Invalid card config received:', config);
      return false;
    }
    return true;
  };

  /**
   * router.js
   * ---------------------------------------------------------------
   * Lightweight internal router / state machine.
   *
   * The card currently has a single "main" view, but the router
   * abstraction is in place so that additional tabs (detail,
   * settings, etc.) can be added without touching the card element.
   *
   * The router is intentionally framework-free:
   *   - it holds a `current` view identifier
   *   - it exposes `navigate(id)` to switch views
   *   - it notifies subscribers via a tiny pub/sub
   * ---------------------------------------------------------------
   */


  class Router {
    constructor(initial = LAYOUTS.MAIN) {
      this._current = initial;
      this._history = [initial];
      this._listeners = new Set();
    }

    /** Current view identifier. */
    get current() {
      return this._current;
    }

    /** Read-only view history (most recent last). */
    get history() {
      return this._history.slice();
    }

    /**
     * Navigate to a new view. No-op if the id is unknown.
     *
     * @param {string} id
     * @param {object} [payload] arbitrary data passed to subscribers
     * @returns {boolean} true if the view changed
     */
    navigate(id, payload = null) {
      if (!Object.values(LAYOUTS).includes(id)) {
        // Unknown view — log but don't throw.
        // eslint-disable-next-line no-console
        console.warn(`[router] navigate() ignored unknown view: ${id}`);
        return false;
      }
      if (id === this._current) return false;

      this._current = id;
      this._history.push(id);
      if (this._history.length > 20) this._history.shift();
      this._notify({ view: id, payload });
      return true;
    }

    /**
     * Return to the previous view if one exists.
     * @returns {boolean} true if the view changed
     */
    back() {
      if (this._history.length <= 1) return false;
      this._history.pop(); // remove current
      const previous = this._history[this._history.length - 1];
      this._current = previous;
      this._notify({ view: previous, payload: null });
      return true;
    }

    /**
     * Register a listener for router view changes.
     * @param {(payload:any) => void} fn
     * @returns {() => void} unsubscribe
     */
    onViewChange(fn) {
      if (typeof fn !== "function") return () => {};
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    }

    /**
     * Notify all listeners of the latest view state.
     * @param {object} detail
     */
    _notify(detail) {
      this._listeners.forEach((fn) => {
        try {
          fn(detail);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[router] listener threw", err);
        }
      });
    }
  }

  /**
   * controller.js
   * ---------------------------------------------------------------
   * Business logic, click/interaction events, and processing of
   * updates from Home Assistant's `hass` object.
   *
   * The controller is intentionally *framework-free*. It doesn't
   * touch the DOM directly. Instead it exposes clean methods that
   * the card (or any view) can call to ask "what should I render?"
   * or "what should I do when the user clicks?".
   * ---------------------------------------------------------------
   */


  /**
   * Controller — pure logic, no DOM. Created per-card-instance.
   */
  class CardController {
    constructor(router = new Router()) {
      this._router = router;
      this._config = mergeDefaults(null);
      this._hass = null;
      this._listeners = new Set();
    }

    // ------------------- subscription -------------------

    /**
     * Register a listener to be invoked whenever the controller's
     * derived state changes. The listener receives no arguments —
     * pull state via the getters below.
     *
     * @param {() => void} fn
     * @returns {() => void} unsubscribe
     */
    subscribe(fn) {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    }

    _notify() {
      this._listeners.forEach((fn) => {
        try {
          fn();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error("[controller] listener threw", err);
        }
      });
    }

    // ------------------- state accessors -------------------

    /** Resolved config (always has all keys defined). */
    get config() {
      return this._config;
    }

    /** Last seen hass object (or null). */
    get hass() {
      return this._hass;
    }

    /** Currently active view id (delegated to router). */
    get currentView() {
      return this._router.current;
    }

    /** Card version string, for the footer. */
    get version() {
      return CARD_VERSION;
    }

    // ------------------- lifecycle hooks -------------------

    /**
     * Store the user-supplied configuration. Should be called by
     * the card's `setConfig()` lifecycle method.
     *
     * @param {object|null|undefined} config
     */
    setConfig(config) {
      if (!assertValidConfig(config)) {
        this._config = mergeDefaults(null);
        this._notify();
        return;
      }
      this._config = mergeDefaults(config);
      this._notify();
    }

    /**
     * Receive the latest hass object. Called by the card's
     * `set hass` lifecycle. We prefer reading from `hass.states`
     * directly (per project rules) but only store the reference;
     * no async work is required here, but a try/catch wraps the
     * notification in case a subscriber throws.
     *
     * @param {{states: Record<string, any>}} hass
     */
    setHass(hass) {
      if (!hass || typeof hass !== "object") {
        warnOnce(ERROR_KEYS.MISSING_HASS, "No hass object provided to card");
        return;
      }
      this._hass = hass;
      this._notify();
    }

    // ------------------- derived view-model -------------------

    /**
     * Return a simple, immutable snapshot of everything a view
     * needs to render. This is the single source of truth used by
     * `factory.js` to build the card's HTML.
     */
    getViewModel() {
      const { title, subtitle, content } = this._config;
      return Object.freeze({
        title,
        subtitle,
        content,
        version: this.version,
        view: this.currentView,
        hasHass: this._hass !== null,
      });
    }

    // ------------------- interaction handlers -------------------

    /**
     * Default click handler. Dispatches a standard `hass-action`
     * event so the user's dashboard tap-action (if any) fires.
     *
     * @param {HTMLElement} node
     * @param {MouseEvent} ev
     */
    handleClick(node, ev) {
      // No-op if the user hasn't set a tap_action. This card is
      // a content display, not a button — we only act on user
      // clicks when explicitly configured to do so.
      if (!this._config.tap_action) return;
      // Pass the user's `tap_action` config (e.g.
      // { action: 'navigate', navigation_path: '/lovelace/0' }).
      fireHassAction(node, "tap", this._config.tap_action);
    }

    /**
     * Default hold handler.
     *
     * @param {HTMLElement} node
     * @param {MouseEvent} ev
     */
    handleHold(node, ev) {
      if (!this._config.hold_action) return;
      fireHassAction(node, "hold", this._config.hold_action);
    }

    /**
     * Default double-tap handler.
     *
     * @param {HTMLElement} node
     * @param {MouseEvent} ev
     */
    handleDoubleClick(node, ev) {
      if (!this._config.double_tap_action) return;
      fireHassAction(node, "double_tap", this._config.double_tap_action);
    }

    /**
     * Convenience: safely read a state value from hass, returning
     * `null` if the entity is missing (used by entity-aware
     * variants of this card).
     *
     * @param {string} entityId
     * @returns {any|null}
     */
    readEntity(entityId) {
      if (!this._hass) return null;
      if (!hasEntity(this._hass, entityId)) {
        warnOnce(
          `missing-entity:${entityId}`,
          `Entity not found in hass.states: ${entityId}`,
        );
        return null;
      }
      return this._hass.states[entityId] || null;
    }

    // ------------------- internal helpers -------------------

    /**
     * Used by the editor to generate the default config block that
     * shows up in the card picker.
     */
    static getStubConfig() {
      return { ...DEFAULTS };
    }
  }

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

  // ----------------------------------------------------------------
  // Internal class hooks & data attributes (kept private to the module)
  // ----------------------------------------------------------------

  const DPAD_CLASS = "dpad";
  const DPAD_BTN_CLASS = "dpad__btn";
  const DPAD_BTN_UP = "dpad__btn--up";
  const DPAD_BTN_DOWN = "dpad__btn--down";
  const DPAD_BTN_LEFT = "dpad__btn--left";
  const DPAD_BTN_RIGHT = "dpad__btn--right";
  const DPAD_BTN_MIC = "dpad__btn--mic";
  const DPAD_DATA_ACTION = "data-dpad-action";
  const DPAD_ACTIONS = Object.freeze({
    UP: "up",
    DOWN: "down",
    LEFT: "left",
    RIGHT: "right",
    MIC: "mic",
  });

  // Custom events dispatched on the host element.
  const EVT_PRESS$2 = "dpad-press";
  const EVT_RELEASE$2 = "dpad-release";
  const EVT_TOGGLE$2 = "dpad-toggle";

  // Local icon map keeps this module self-contained so it can be
  // copied into any HA card without importing project files.
  const DPAD_ICON_NAMES = Object.freeze({
    DPAD_UP: "mdi:chevron-up",
    DPAD_DOWN: "mdi:chevron-down",
    DPAD_LEFT: "mdi:chevron-left",
    DPAD_RIGHT: "mdi:chevron-right",
    MICROPHONE: "mdi:microphone",
    MICROPHONE_OFF: "mdi:microphone-off",
  });

  const renderDpadIcon$1 = (key, opts = {}) => {
    const name = DPAD_ICON_NAMES[key];
    if (!name) return "";
    const cls = opts.className ? ' class="' + opts.className + '"' : "";
    return '<ha-icon icon="' + name + '"' + cls + "></ha-icon>";
  };

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
  const buildButtonHtml$1 = (action, extraClass, iconKey, label, activeIconKey) => {
    let inner = renderDpadIcon$1(iconKey, {
      className: DPAD_BTN_CLASS + "__icon dpad__icon--default",
    });
    if (activeIconKey) {
      inner += renderDpadIcon$1(activeIconKey, {
        className: DPAD_BTN_CLASS + "__icon dpad__icon--active",
      });
    }
    return (
      '<button type="button" ' +
      'class="' +
      DPAD_BTN_CLASS +
      " " +
      extraClass +
      '" ' +
      DPAD_DATA_ACTION +
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
  const buildDpadHtml$1 = () => {
    const up = buildButtonHtml$1(DPAD_ACTIONS.UP, DPAD_BTN_UP, "DPAD_UP", "Up");
    const down = buildButtonHtml$1(
      DPAD_ACTIONS.DOWN,
      DPAD_BTN_DOWN,
      "DPAD_DOWN",
      "Down",
    );
    const left = buildButtonHtml$1(
      DPAD_ACTIONS.LEFT,
      DPAD_BTN_LEFT,
      "DPAD_LEFT",
      "Left",
    );
    const right = buildButtonHtml$1(
      DPAD_ACTIONS.RIGHT,
      DPAD_BTN_RIGHT,
      "DPAD_RIGHT",
      "Right",
    );
    // Mic button icon swap:
    //   - default (off): show mdi:microphone-off
    //   - active  (on):  show mdi:microphone (recording in progress)
    // The first iconKey is the default; the second is the active.
    const mic = buildButtonHtml$1(
      DPAD_ACTIONS.MIC,
      DPAD_BTN_MIC,
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
    // No slot wrappers \u2014 putting multiple buttons in one grid cell
    // would cause them to overlap (the bug we just fixed).
    return (
      '<div class="' +
      DPAD_CLASS +
      '" role="group" aria-label="D-pad control">' +
      up +
      left +
      mic +
      right +
      down +
      "</div>"
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
      this.attachShadow({ mode: "open" });
      // State: which buttons are currently pressed / active.
      this._pressed = new Set();
      this._pressedByPointer = new Map();
      this._activeMic = false;
      // Guard against re-mounting the shadow content if the element
      // is moved or recycled in the DOM (e.g. when Home Assistant's
      // card editor re-parents the live card during dialog open/
      // close). Without this, each connectedCallback appends another
      // <style> + <div class="dpad"> to the shadow root, which
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
      // Idempotent: only build the shadow content once per element
      // instance. connectedCallback can fire multiple times if the
      // element is moved in the DOM (e.g. by Home Assistant's card
      // editor re-parenting the live card during dialog open/close);
      // without this guard, each re-connection would append another
      // <style> + <div class="dpad"> to the same shadow root, which
      // visually stacks the dpad UI on top of itself.
      if (this._mounted) return;
      this._mounted = true;

      const style = document.createElement("style");
      style.textContent = DPAD_STYLES;

      const host = document.createElement("div");
      host.innerHTML = buildDpadHtml$1();

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(host.firstElementChild);
    }

    _wirePointerEvents() {
      const root = this.shadowRoot;
      if (!root) return;

      const findBtn = (target) =>
        target instanceof Element
          ? target.closest("[" + DPAD_DATA_ACTION + "]")
          : null;

      const clearPressed = (btn) => {
        if (!btn) return;
        const action = btn.getAttribute(DPAD_DATA_ACTION);
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
        this._dispatch(EVT_RELEASE$2, { action: state.action });
        return true;
      };

      // pointerdown: start a press for any D-pad button
      root.addEventListener("pointerdown", (ev) => {
        const btn = findBtn(ev.target);
        if (!btn) return;
        const action = btn.getAttribute(DPAD_DATA_ACTION);
        if (action === DPAD_ACTIONS.MIC) return; // mic is a click toggle, not a press
        this._pressed.add(action);
        if (ev.pointerId !== null && ev.pointerId !== undefined) {
          this._pressedByPointer.set(ev.pointerId, { action, btn });
        }
        btn.classList.add("is-pressed");
        this._dispatch(EVT_PRESS$2, { action });
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
        const action = btn.getAttribute(DPAD_DATA_ACTION);
        if (!this._pressed.has(action)) return;
        clearPressed(btn);
        this._dispatch(EVT_RELEASE$2, { action });
      };
      root.addEventListener("pointerup", release);
      root.addEventListener("pointercancel", release);

      // pointerleave: clear if the pointer truly leaves the button
      root.addEventListener("pointerleave", (ev) => {
        if (releaseByPointer(ev)) return;
        const btn = findBtn(ev.target);
        if (!btn) return;
        if (ev.relatedTarget && btn.contains(ev.relatedTarget)) return;
        const action = btn.getAttribute(DPAD_DATA_ACTION);
        clearPressed(btn);
        this._dispatch(EVT_RELEASE$2, { action });
      });

      // click: toggle the mic button
      root.addEventListener("click", (ev) => {
        const btn = findBtn(ev.target);
        if (!btn) return;
        if (btn.getAttribute(DPAD_DATA_ACTION) !== DPAD_ACTIONS.MIC) return;
        this._activeMic = !this._activeMic;
        this._applyMicState();
        this._dispatch(EVT_TOGGLE$2, {
          action: DPAD_ACTIONS.MIC,
          active: this._activeMic,
        });
      });
    }

    _applyMicState() {
      const root = this.shadowRoot;
      if (!root) return;
      const mic = root.querySelector("." + DPAD_BTN_MIC);
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
    !customElements.get("dpad-control")
  ) {
    customElements.define("dpad-control", DpadControl);
  }

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
  const EVT_PRESS$1 = "dpad-8way-press";
  const EVT_RELEASE$1 = "dpad-8way-release";
  const EVT_TOGGLE$1 = "dpad-8way-toggle";

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
        this._dispatch(EVT_RELEASE$1, { action: state.action });
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
        this._dispatch(EVT_PRESS$1, { action });
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
        this._dispatch(EVT_RELEASE$1, { action });
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
        this._dispatch(EVT_RELEASE$1, { action });
      });

      // click: toggle the mic button
      root.addEventListener("click", (ev) => {
        const btn = findBtn(ev.target);
        if (!btn) return;
        if (btn.getAttribute(DPAD_8WAY_DATA_ACTION) !== DPAD_8WAY_ACTIONS.MIC)
          return;
        this._activeMic = !this._activeMic;
        this._applyMicState();
        this._dispatch(EVT_TOGGLE$1, {
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

  /**
   * circle-pad.js
   * ---------------------------------------------------------------
   * Reusable SVG wheel custom element: <circle-pad-control>
   *
   * This module adapts the control surface from circle-pad.html
   * (wheel-responsive-wrapper + svg), ignoring that file's external
   * parent panel wrapper.
   *
   * Direction slices are momentary buttons:
   *   - dispatch circle-pad-press on press
   *   - dispatch circle-pad-release on release
   *
   * Center mic is a toggle button:
   *   - dispatch circle-pad-toggle { action: 'mic', active }
   * ---------------------------------------------------------------
   */

  const CIRCLE_PAD_CLASS = "circle-pad";
  const CIRCLE_PAD_DATA_ACTION = "data-circle-pad-action";

  const CIRCLE_PAD_ACTIONS = Object.freeze({
    UP: "up",
    UP_RIGHT: "up-right",
    RIGHT: "right",
    DOWN_RIGHT: "down-right",
    DOWN: "down",
    DOWN_LEFT: "down-left",
    LEFT: "left",
    UP_LEFT: "up-left",
    MIC: "mic",
  });

  const DIRECTION_ACTIONS = Object.freeze(
    new Set([
      CIRCLE_PAD_ACTIONS.UP,
      CIRCLE_PAD_ACTIONS.UP_RIGHT,
      CIRCLE_PAD_ACTIONS.RIGHT,
      CIRCLE_PAD_ACTIONS.DOWN_RIGHT,
      CIRCLE_PAD_ACTIONS.DOWN,
      CIRCLE_PAD_ACTIONS.DOWN_LEFT,
      CIRCLE_PAD_ACTIONS.LEFT,
      CIRCLE_PAD_ACTIONS.UP_LEFT,
    ]),
  );

  const EVT_PRESS = "circle-pad-press";
  const EVT_RELEASE = "circle-pad-release";
  const EVT_TOGGLE = "circle-pad-toggle";
  const INPUT_MODE_TOUCH = "touch";
  const INPUT_MODE_MOUSE = "mouse";
  const ACTION_SELECTOR = "[" + CIRCLE_PAD_DATA_ACTION + "]";
  const CENTER_BUTTON_SELECTOR = ".center-button";

  const ROOT_EVENT_BINDINGS = Object.freeze([
    ["pointerdown", "_onPointerDown"],
    ["pointerup", "_onPointerUp"],
    ["pointercancel", "_onPointerCancel"],
    ["pointerleave", "_onPointerLeave"],
    ["click", "_onClick"],
  ]);

  const CIRCLE_PAD_STYLES = `
  :host {
    display: block;
    --circle-pad-bg-1: var(--primary-background-color);
    --circle-pad-bg-2: var(--card-background-color);
    --circle-pad-bg-3: var(--secondary-background-color);
    --circle-pad-dark-primary: var(--dark-primary-color);
    --circle-pad-primary: var(--primary-color);
    --circle-pad-accent: var(--accent-color);
    --circle-pad-light-primary: var(--light-primary-color);
    --circle-pad-text-1: var(--primary-text-color);
    --circle-pad-text-2: var(--secondary-text-color);
    --circle-pad-text-3: var(--disabled-text-color);
    --circle-pad-text-4: var(--state-inactive-color);
    --circle-pad-text-5: var(--text-primary-color);
    --circle-pad-success: var(--success-color);
  }

  .${CIRCLE_PAD_CLASS}__wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: visible;
    aspect-ratio: 1 / 1;
    min-height: 220px;
  }

  .${CIRCLE_PAD_CLASS}__wrapper::before {
    content: "";
    position: absolute;
    width: 99.6%;
    height: 99.6%;
    border-radius: 50%;
    box-shadow:
      0 14px 28px rgba(0, 0, 0, 0.06),
      0 4px 10px rgba(0, 0, 0, 0.04);
    z-index: 0;
    pointer-events: none;
  }

  .${CIRCLE_PAD_CLASS}__wrapper svg {
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    position: relative;
    z-index: 1;
    overflow: visible;
  }

  .wheel-button {
    cursor: pointer;
    outline: none;
  }

  .wheel-button path,
  .wheel-button circle {
    transition: fill 0.2s ease, stroke 0.2s ease, filter 0.2s ease;
  }

.slice-button path { fill: var(--circle-pad-bg-1) }

.slice-button.is-pressed path,
.slice-button:active path { fill: var(--circle-pad-dark-primary) }

@media (hover: hover) {
  .${CIRCLE_PAD_CLASS}:not([data-input-mode="touch"]) .slice-button:hover path {
    fill: var(--circle-pad-primary);
  }
}

/* Center Hub Base + Hover */
.center-button #path9 { fill: #bababa; }
.center-button #circle9 { fill: url(#dome-gradient);   }
.center-button:hover #path9 { fill: var(--circle-pad-success); }
.center-button:active #path9 { fill: var(--circle-pad-success); }

@media (hover: hover) {
  .${CIRCLE_PAD_CLASS}:not([data-input-mode="touch"]) .center-button:hover #circle9 {
    filter: url(#button-shadow-hover);
  }
}

/* Persistent mic-on visuals driven by component state */
.center-button.is-active #circle9 {
  fill: url(#dome-gradient-green);
}

.center-button.is-active #path9 {
  fill: var(--circle-pad-success);
}

.center-button.is-active .mic-icon path {
  fill: var(--circle-pad-text-1) !important;
}

.center-button.is-active {
  filter: url(#green-glow-matrix);
}

.main-circle {filter: url(#outside-shadow);}
.main-circle circle {
  shape-rendering: geometricPrecision;
}

/* Green Dome Focus State (Keyboard Navigation) */
.center-button:focus-visible #circle9 {
  outline: none; /* Clears default browser ring if you are using your own filters */
}

/* Green Dome Active State (Pressed Click) */
.center-button:active #circle9 { 
  filter: brightness(0.92) url(#button-shadow-hover); /* Pressed visual without forcing active green state */
}

/* Standalone shadow layer applied exclusively over the center button structure in base state */
.center-button {
  box-shadow: 
    0px 4px 8px rgba(0, 0, 0, 0.12),          /* Your original outer drop shadow */
    inset 0px 2px 4px rgba(0, 0, 0, 0.15);    /* New subtle inset shadow */
}

/* The inner shadow overlay styling */
.inner-shadow-overlay {
  fill: none;
  stroke: #000000;
  stroke-width: 2;          /* Thickness of the shadow */
  opacity: 0.15;            /* Softness/transparency of the shadow */
  filter: url(#simple-blur); /* Applies the blur effect */
}

/* Keyboard Accessibility Focus Rings - Set to none to prevent extra lines when active */
.wheel-button:focus path,
.wheel-button:focus circle {
  stroke: none; 
}

/* --- Fixed Microphone State Handling --- */
.mic-icon path {
  fill: var(--circle-pad-text-2); /* Gray base state */
  transition: fill 0.2s ease;
}

/* Forces the icon to turn pure black when hovered, focused, or active */
.center-button:focus-visible .mic-icon path,
.center-button:active .mic-icon path {
  fill: var(--circle-pad-text-1) !important; 
}

@media (hover: hover) {
  .${CIRCLE_PAD_CLASS}:not([data-input-mode="touch"]) .center-button:hover .mic-icon path {
    fill: var(--circle-pad-text-1) !important;
  }
}

/* --- Fixed Chevron State Handling --- */
.slice-chevron {
  stroke: #555555;
  transition: stroke 0.15s ease;
}

/* Keep chevrons bright while a slice is actively pressed. */
.slice-button.is-pressed .slice-chevron {
  stroke: #ffffff !important;
}

@media (hover: hover) {
  .${CIRCLE_PAD_CLASS}:not([data-input-mode="touch"]) .slice-button:hover .slice-chevron {
    stroke: #ffffff !important;
  }

  .${CIRCLE_PAD_CLASS}:not([data-input-mode="touch"]) .slice-button:not(:hover):not(.is-pressed) .slice-chevron {
    stroke: #555555 !important;
  }
}

/* Touch-mode override: ignore sticky pseudo-classes and drive visual state via .is-pressed only. */
.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-button path {
  fill: var(--circle-pad-bg-1) !important;
}

.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-button .slice-chevron {
  stroke: #555555 !important;
}

.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-button.is-pressed path {
  fill: var(--circle-pad-dark-primary) !important;
}

.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-button.is-pressed .slice-chevron {
  stroke: #ffffff !important;
}

/* Touch-mode override: prevent center hover/focus visuals from sticking between taps. */
.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .center-button:not(.is-active) #circle9 {
  fill: url(#dome-gradient) !important;
  filter: url(#button-shadow) !important;
}

.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .center-button:not(.is-active):not(.is-pressed) #path9 {
  fill: #bababa !important;
}

.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .center-button.is-active #path9,
.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .center-button.is-pressed #path9 {
  fill: var(--circle-pad-success) !important;
}

.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .center-button.is-active #circle9 {
  fill: url(#dome-gradient-green) !important;
  filter: url(#button-shadow-hover) !important;
}

.${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .center-button:not(.is-active) .mic-icon path {
  fill: var(--circle-pad-text-2) !important;
}
`;

  const CIRCLE_PAD_SVG = `
  <div class="${CIRCLE_PAD_CLASS}__wrapper">
    <svg viewBox="0 0 96 96" version="1.1" aria-label="Circle pad" role="group">
      <defs>
        <filter id="green-glow-matrix" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="blur"></feGaussianBlur>
          <feColorMatrix type="matrix" values="0 0 0 0 0.18
                                             0 0 0 0 0.80
                                             0 0 0 0 0.44
                                             0 0 0 1 0" in="blur" result="green-color"></feColorMatrix>
          <feMorphology radius="0.5" operator="dilate" in="green-color" result="thick-glow"></feMorphology>
          <feGaussianBlur stdDeviation="2.5" in="thick-glow" result="soft-outer-glow"></feGaussianBlur>
          <feMerge>
            <feMergeNode in="soft-outer-glow"></feMergeNode>
            <feMergeNode in="green-color"></feMergeNode>
            <feMergeNode in="SourceGraphic"></feMergeNode>
          </feMerge>
        </filter>

        <radialGradient id="dome-gradient" cx="50%" cy="50%" r="50%" fx="48%" fy="44%">
          <stop offset="0%" stop-color="#ffffff"></stop>
          <stop offset="85%" stop-color="#ffffff"></stop>
          <stop offset="95%" stop-color="#f8f8f8"></stop>
          <stop offset="100%" stop-color="#eeeeee"></stop>
        </radialGradient>

        <radialGradient id="dome-gradient-green" cx="50%" cy="50%" r="50%" fx="48%" fy="44%">
          <stop offset="0%" stop-color="#4ade80"></stop>
          <stop offset="85%" stop-color="#4ade80"></stop>
          <stop offset="95%" stop-color="#42cf76"></stop>
          <stop offset="100%" stop-color="#3bc26d"></stop>
        </radialGradient>

        <filter id="simple-blur">
          <feGaussianBlur stdDeviation="1.8"></feGaussianBlur>
        </filter>

        <clipPath id="circle-clip">
          <circle cx="96.940613" cy="66.8853" r="19.75"></circle>
        </clipPath>

        <filter id="button-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.2" dy="0.2" stdDeviation="2" flood-color="#333333" flood-opacity="0.25"></feDropShadow>
        </filter>
        <!--  Outer shadow on the center button -->
         <filter id="button-shadow-hover" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.2" dy="0.2" stdDeviation="2" flood-color="var(--circle-pad-success)" flood-opacity="0.25"/>
        </filter>  
        <filter id="outside-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.2" dy="0.2" stdDeviation="2" flood-color="#333333" flood-opacity="0.25"></feDropShadow>
        </filter>
      </defs>

      <g id="main-circle" class="main-circle" transform="translate(-48.940613,-18.8853)">
        <circle style="fill:#646464;" id="circle2" cx="96.940613" cy="66.8853" r="47.85"></circle>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Right" ${CIRCLE_PAD_DATA_ACTION}="right">
          <path d="m 139.38408,44.790631 a 47.849998,47.849998 0 0 1 0,44.189339 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 131.0 64.88 L 133.0 66.88 L 131.0 68.88" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Down-right" ${CIRCLE_PAD_DATA_ACTION}="down-right">
          <path d="m 139.38408,88.97997 a 47.849998,47.849998 0 0 1 -20.3488,20.3488 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 116.5 88.5 L 118.5 88.5 L 118.5 86.5" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Down" ${CIRCLE_PAD_DATA_ACTION}="down">
          <path d="m 119.03528,109.32877 a 47.849998,47.849998 0 0 1 -44.189339,0 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 98.94 103.5 L 96.94 105.5 L 94.94 103.5" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Up-right" ${CIRCLE_PAD_DATA_ACTION}="up-right">
          <path d="m 119.03528,24.441832 a 47.849998,47.849998 0 0 1 20.3488,20.348799 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 116.5 45.26 L 118.5 45.26 L 118.5 47.26" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Up" ${CIRCLE_PAD_DATA_ACTION}="up">
          <path d="m 74.845941,24.441833 a 47.849998,47.849998 0 0 1 44.189339,-10e-7 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 94.94 30.26 L 96.94 28.26 L 98.94 30.26" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Up-left" ${CIRCLE_PAD_DATA_ACTION}="up-left">
          <path d="M 54.497146,44.790629 A 47.849998,47.849998 0 0 1 74.845941,24.441833 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 77.38 45.26 L 75.38 45.26 L 75.38 47.26" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Down-left" ${CIRCLE_PAD_DATA_ACTION}="down-left">
          <path d="M 74.845941,109.32877 A 47.849998,47.849998 0 0 1 54.497146,88.979971 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 77.38 88.5 L 75.38 88.5 L 75.38 86.5" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>

        <g class="wheel-button slice-button" role="button" tabindex="0" aria-label="Left" ${CIRCLE_PAD_DATA_ACTION}="left">
          <path d="m 54.497146,88.979971 a 47.849998,47.849998 0 0 1 0,-44.189342 L 96.940613,66.8853 Z"></path>
          <path class="slice-chevron" d="M 62.88 68.88 L 60.88 66.88 L 62.88 64.88" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </g>
      </g>

      <g id="mic-button" transform="translate(-48.940613,-18.8853)">
        <g class="wheel-button center-button" role="button" tabindex="0" aria-label="Toggle microphone" ${CIRCLE_PAD_DATA_ACTION}="mic">
          <circle id="path9" cx="96.940613" cy="66.8853" r="20"></circle>
          <circle id="circle9" cx="96.940613" cy="66.8853" r="19.75" fill="url(#dome-gradient)" filter="url(#button-shadow)"></circle>
          <g clip-path="url(#circle-clip)">
            <circle class="inner-shadow-overlay" cx="96.940613" cy="68.8853" r="19.75"></circle>
          </g>
          <g class="mic-icon" transform="translate(90.440613, 60.3853) scale(0.55)">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.34 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"></path>
          </g>
        </g>
      </g>
    </svg>
  </div>
`;

  class CirclePadControl extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._pressed = new Set();
      this._pressedByPointer = new Map();
      this._activeMic = false;
      this._mounted = false;
      this._wired = false;
      this._resetRootHandlers();
    }

    connectedCallback() {
      this._mount();
      this._wireControlEvents();
    }

    disconnectedCallback() {
      this._pressed.clear();
      this._unbindRootEvents();
      this._wired = false;
      this._resetRootHandlers();
    }

    setActive(action, active) {
      if (action !== CIRCLE_PAD_ACTIONS.MIC) return;
      this._activeMic = Boolean(active);
      this._applyMicState();
    }

    getState() {
      return { mic: this._activeMic };
    }

    _mount() {
      if (this._mounted) return;
      this._mounted = true;

      const style = document.createElement("style");
      style.textContent = CIRCLE_PAD_STYLES;

      const root = document.createElement("div");
      root.className = CIRCLE_PAD_CLASS;
      root.innerHTML = CIRCLE_PAD_SVG;
      this._rootEl = root;

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(root);
      this._applyMicState();
    }

    _applyMicState() {
      if (!this.shadowRoot) return;
      const mic = this.shadowRoot.querySelector(CENTER_BUTTON_SELECTOR);
      if (!mic) return;
      mic.classList.toggle("is-active", this._activeMic);
      mic.setAttribute("aria-pressed", String(this._activeMic));
    }

    _setInputMode(mode) {
      if (!this._rootEl) return;
      this._rootEl.setAttribute("data-input-mode", mode);
    }

    _trySetPointerCapture(btn, pointerId) {
      if (!btn || typeof btn.setPointerCapture !== "function") return;
      if (!this._hasPointerId(pointerId)) return;
      try {
        btn.setPointerCapture(pointerId);
      } catch (_e) {
        /* ignore */
      }
    }

    _hasPointerId(pointerId) {
      return pointerId !== null && pointerId !== undefined;
    }

    _resetRootHandlers() {
      this._onPointerDown = null;
      this._onPointerUp = null;
      this._onPointerCancel = null;
      this._onPointerLeave = null;
      this._onClick = null;
    }

    _bindRootEvents() {
      if (!this.shadowRoot) return;
      for (const [eventName, handlerKey] of ROOT_EVENT_BINDINGS) {
        const handler = this[handlerKey];
        if (handler) {
          this.shadowRoot.addEventListener(eventName, handler);
        }
      }
    }

    _unbindRootEvents() {
      if (!this.shadowRoot) return;
      for (const [eventName, handlerKey] of ROOT_EVENT_BINDINGS) {
        const handler = this[handlerKey];
        if (handler) {
          this.shadowRoot.removeEventListener(eventName, handler);
        }
      }
    }

    _findActionButton(target) {
      if (!(target instanceof Element)) return null;
      return target.closest(ACTION_SELECTOR);
    }

    _getButtonAction(btn) {
      return btn ? btn.getAttribute(CIRCLE_PAD_DATA_ACTION) : null;
    }

    _isMicAction(action) {
      return action === CIRCLE_PAD_ACTIONS.MIC;
    }

    _setMicPressed(btn, pressed) {
      if (!btn) return;
      btn.classList.toggle("is-pressed", Boolean(pressed));
    }

    _clearDirectionPressed(btn) {
      if (!btn) return;
      const action = this._getButtonAction(btn);
      if (!action || !this._pressed.has(action)) return;
      this._pressed.delete(action);
      btn.classList.remove("is-pressed");
    }

    _releaseDirectionByPointer(ev) {
      if (!ev || ev.pointerId === null || ev.pointerId === undefined) {
        return false;
      }
      const state = this._pressedByPointer.get(ev.pointerId);
      if (!state) return false;
      this._pressedByPointer.delete(ev.pointerId);
      this._clearDirectionPressed(state.btn);
      this._dispatch(EVT_RELEASE, { action: state.action });
      return true;
    }

    _setInputModeFromPointer(ev) {
      this._setInputMode(
        ev.pointerType === INPUT_MODE_TOUCH ? INPUT_MODE_TOUCH : INPUT_MODE_MOUSE,
      );
    }

    _handleDirectionPointerDown(btn, action, pointerId) {
      if (!DIRECTION_ACTIONS.has(action)) return;
      if (this._pressed.has(action)) return;

      this._pressed.add(action);
      if (this._hasPointerId(pointerId)) {
        this._pressedByPointer.set(pointerId, { action, btn });
      }
      btn.classList.add("is-pressed");
      this._dispatch(EVT_PRESS, { action });
      this._trySetPointerCapture(btn, pointerId);
    }

    _handleMicToggleClick(btn) {
      this._activeMic = !this._activeMic;
      this._applyMicState();
      this._setMicPressed(btn, false);
      this._dispatch(EVT_TOGGLE, {
        action: CIRCLE_PAD_ACTIONS.MIC,
        active: this._activeMic,
      });

      const activeEl = this.shadowRoot && this.shadowRoot.activeElement;
      if (
        this._rootEl &&
        this._rootEl.getAttribute("data-input-mode") === INPUT_MODE_TOUCH &&
        activeEl &&
        typeof activeEl.blur === "function"
      ) {
        activeEl.blur();
      }
    }

    _handlePointerEnd(ev, ignoreRelatedTarget = false) {
      if (this._releaseDirectionByPointer(ev)) return;

      const btn = this._findActionButton(ev.target);
      if (!btn) return;
      if (
        ignoreRelatedTarget &&
        ev.relatedTarget &&
        btn.contains(ev.relatedTarget)
      ) {
        return;
      }

      const action = this._getButtonAction(btn);
      if (this._isMicAction(action)) {
        this._setMicPressed(btn, false);
        return;
      }

      if (!DIRECTION_ACTIONS.has(action) || !this._pressed.has(action)) return;
      this._clearDirectionPressed(btn);
      this._dispatch(EVT_RELEASE, { action });
    }

    _handlePointerRelease(ev) {
      this._handlePointerEnd(ev, false);
    }

    _handlePointerLeave(ev) {
      this._handlePointerEnd(ev, true);
    }

    _wireControlEvents() {
      if (this._wired || !this.shadowRoot) return;
      this._wired = true;

      this._onPointerDown = (ev) => {
        const btn = this._findActionButton(ev.target);
        if (!btn) return;

        this._setInputModeFromPointer(ev);

        const action = this._getButtonAction(btn);
        if (this._isMicAction(action)) {
          this._setMicPressed(btn, true);
          this._trySetPointerCapture(btn, ev.pointerId);
          return;
        }

        this._handleDirectionPointerDown(btn, action, ev.pointerId);
      };

      this._onPointerUp = (ev) => this._handlePointerRelease(ev);
      this._onPointerCancel = (ev) => this._handlePointerRelease(ev);
      this._onPointerLeave = (ev) => this._handlePointerLeave(ev);

      this._onClick = (ev) => {
        const btn = this._findActionButton(ev.target);
        if (!btn) return;
        if (!this._isMicAction(this._getButtonAction(btn))) return;
        this._handleMicToggleClick(btn);
      };

      this._bindRootEvents();
    }

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

  if (
    typeof customElements !== "undefined" &&
    !customElements.get("circle-pad-control")
  ) {
    customElements.define("circle-pad-control", CirclePadControl);
  }

  /**
   * readout.js
   * ---------------------------------------------------------------
   * Reusable scrolling event-log custom element: <dpad-readout>
   *
   * Drop this element into any HTML (or shadow root) and it will
   * render a vertically-scrolling list of action lines with a
   * "clear" button in the corner:
   *
   *   \u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
   *   \u2502  [left]                    [Clear]  \u2502
   *   \u2502  [up]                              \u2502
   *   \u2502  [right]                           \u2502
   *   \u2502  [left]                             \u2502
   *   \u2502                                     \u2502
   *   \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
   *
   * Behavior (when subscribed to a <dpad-control>):
   *
   *   - Direction buttons (up/down/left/right):
   *       \u2022 On dpad-press:   append a new line "[<action>]"
   *       \u2022 While held:      keep appending "[<action>]"
   *                              lines on a short interval until
   *                              the user releases
   *       \u2022 On dpad-release: stop appending
   *   - Microphone button: logged on toggle as [mic:on]/[mic:off].
   *   - Clear button:        empties the log.
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
  // Class hooks & custom event names
  // ----------------------------------------------------------------

  const READOUT_CLASS = "dpad-readout";
  const READOUT_LOG_CLASS = "dpad-readout__log";
  const READOUT_LINE_CLASS = "dpad-readout__line";
  const READOUT_CLEAR_CLASS = "dpad-readout__clear";
  const READOUT_EMPTY_CLASS = "dpad-readout__empty";

  const EVT_LOG = "readout-log";

  // Direction actions the readout cares about. The microphone is
  // intentionally excluded per the user spec.
  const TRACKED_ACTIONS = Object.freeze(
    new Set([
      "up",
      "up-right",
      "right",
      "down-right",
      "down",
      "down-left",
      "left",
      "up-left",
    ]),
  );

  const PRESS_EVENTS = Object.freeze([
    "dpad-press",
    "dpad-8way-press",
    "circle-pad-press",
  ]);
  const RELEASE_EVENTS = Object.freeze([
    "dpad-release",
    "dpad-8way-release",
    "circle-pad-release",
  ]);
  const TOGGLE_EVENTS = Object.freeze([
    "dpad-toggle",
    "dpad-8way-toggle",
    "circle-pad-toggle",
  ]);

  // Repeater interval (ms) for "keep printing while held".
  const REPEAT_INTERVAL_MS = 150;

  // Maximum number of log lines kept in memory. Older lines are
  // dropped to keep the DOM small and scrolling smooth.
  const MAX_LOG_LINES = 500;

  // Default labels per action. The default appends "[<action>]"
  // which the user explicitly asked for. Override via subscribe().
  const DEFAULT_FORMAT = (action) => "[" + action + "]";

  // ----------------------------------------------------------------
  // Styles \u2014 self-contained, uses only HA design tokens for theming
  // ----------------------------------------------------------------

  const READOUT_STYLES = `
  :host {
    display: block;
  }

  .${READOUT_CLASS} {
    display: flex;
    flex-direction: column;
    border-radius: var(--ha-card-border-radius, 12px);
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
    color: var(--primary-text-color);
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
    font-family: var(--ha-font-family, Roboto, 'Helvetica Neue', sans-serif);
    font-size: 0.9rem;
    line-height: 1.4;
    overflow: hidden;
  }

  .${READOUT_CLASS}__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.18));
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.04));
  }

  .${READOUT_CLASS}__title {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--secondary-text-color);
    margin: 0;
  }

  .${READOUT_CLEAR_CLASS} {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    margin: 0;
    background: transparent;
    color: var(--secondary-text-color);
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
    border-radius: var(--ha-card-border-radius, 8px);
    font: inherit;
    font-size: 0.75rem;
    cursor: pointer;
    transition: color 120ms ease, background-color 120ms ease, border-color 120ms ease;
  }

  /* Hover effect is scoped to devices with a real pointing
     device (mouse, trackpad, stylus). On touch screens the
     hover state would otherwise stick after a tap because the
     finger remains over the button at the last tap location
     until the user touches elsewhere. The focus-visible state
     is left unscoped so keyboard users still get a visible
     focus ring. */
  @media (hover: hover) {
    .${READOUT_CLEAR_CLASS}:hover {
      color: var(--primary-text-color);
      background: var(--divider-color, rgba(127, 127, 127, 0.12));
      border-color: var(--divider-color, rgba(127, 127, 127, 0.35));
    }
  }
  .${READOUT_CLEAR_CLASS}:focus-visible {
    color: var(--primary-text-color);
    background: var(--divider-color, rgba(127, 127, 127, 0.12));
    border-color: var(--divider-color, rgba(127, 127, 127, 0.35));
    outline: none;
  }

  .${READOUT_CLEAR_CLASS} ha-icon {
    --mdc-icon-size: 14px;
  }

  .${READOUT_LOG_CLASS} {
    flex: 1 1 auto;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 10px;
    margin: 0;
    /* Give the scrollable region a sensible default height even
       if the host has no explicit height. */
    min-height: 96px;
    max-height: 200px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.85rem;
    line-height: 1.5;
  }

  .${READOUT_LINE_CLASS} {
    display: block;
    padding: 1px 0;
    color: var(--primary-text-color);
    word-break: break-all;
  }

  .${READOUT_LINE_CLASS}--pressed {
    color: var(--primary-color, #03a9f4);
    font-weight: 600;
  }

  .${READOUT_EMPTY_CLASS} {
    color: var(--secondary-text-color);
    font-style: italic;
    font-family: var(--ha-font-family, Roboto, 'Helvetica Neue', sans-serif);
  }
`;

  // ----------------------------------------------------------------
  // The custom element
  // ----------------------------------------------------------------

  /**
   * <dpad-readout> \u2014 a self-contained scrolling event-log pill.
   *
   * Public API:
   *   - append(text)            add a line to the log
   *   - clear()                 empty the log
   *   - getLog()                return a copy of the current log
   *   - subscribe(dpadEl, [opts])  auto-update from a <dpad-control>
   *   - addEventListener('readout-log', fn)  fires on every append
   *
   * The microphone button is logged on toggle with explicit state.
   */
  class DpadReadout extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      /** @type {string[]} newest line last */
      this._log = [];
      /** @type {Map<string, number>} action -> interval id */
      this._repeaters = new Map();
      this._unsubscribers = [];
      this._format = DEFAULT_FORMAT;
      // Guard against re-mounting the shadow content if the element
      // is moved or recycled in the DOM (e.g. when Home Assistant's
      // card editor re-parents the live card during dialog open/
      // close). Without this, each connectedCallback appends another
      // <style> + readout frame to the shadow root, which stacks
      // the activity log on top of itself.
      this._mounted = false;
    }

    // ---- lifecycle ----

    connectedCallback() {
      this._mount();
      this._render();
    }

    disconnectedCallback() {
      // Clean up any active event subscriptions and repeat timers.
      this._unsubscribers.forEach((off) => {
        try {
          off();
        } catch (_e) {
          /* ignore */
        }
      });
      this._unsubscribers = [];
      this._stopAllRepeaters();
      // Do NOT reset _mounted here. The element is still the same
      // instance; on re-connection we want _mount to be a no-op.
      // If the element is genuinely destroyed (GC), the flag goes
      // with it. If HA ever does a true element replace, the new
      // element gets a fresh _mounted=false in its constructor.
    }

    // ---- public API ----

    /**
     * Append a line to the log. Trims old lines past MAX_LOG_LINES.
     * Fires `readout-log` with `{ lines }` (full log copy) so
     * consumers can mirror the state elsewhere.
     *
     * @param {string} text
     */
    append(text) {
      const line = text == null ? "" : String(text);
      if (!line) return;
      this._log.push(line);
      if (this._log.length > MAX_LOG_LINES) {
        // Drop from the front so newest is always at the bottom.
        this._log.splice(0, this._log.length - MAX_LOG_LINES);
      }
      this._render();
      this._dispatch(EVT_LOG, { lines: this.getLog() });
    }

    /**
     * Empty the log.
     */
    clear() {
      if (this._log.length === 0) return;
      this._log = [];
      this._stopAllRepeaters();
      this._render();
      this._dispatch(EVT_LOG, { lines: this.getLog() });
    }

    /**
     * Return a copy of the current log lines (newest last).
     *
     * @returns {string[]}
     */
    getLog() {
      return this._log.slice();
    }

    /**
     * Convenience: subscribe to a <dpad-control>'s events and
     * append direction-button events to the log automatically.
     *
     *   - On dpad-press {action}:  append "[action]" + start a
     *     short-interval repeater so the log keeps growing while
     *     the user holds the button.
     *   - On dpad-release:          stop the repeater for that action.
     *   - On *-toggle { action:'mic', active }: append
     *     "[mic:on]" or "[mic:off]".
     *
     * @param {HTMLElement} dpadEl   a <dpad-control>, <dpad-8way-control>, or <circle-pad-control> element
     * @param {object} [opts]
     * @param {(action: string) => string} [opts.format]
     *        override the default line formatter. Receives the
     *        action ("up"/"down"/"left"/"right") and returns the
     *        line to append. Default: `(a) => "[" + a + "]"`.
     * @returns {() => void}         unsubscribe function
     */
    subscribe(dpadEl, opts = {}) {
      if (!dpadEl || typeof dpadEl.addEventListener !== "function") {
        // eslint-disable-next-line no-console
        console.warn("[dpad-readout] subscribe() needs a valid element");
        return () => {};
      }

      if (typeof opts.format === "function") this._format = opts.format;

      const onPress = (ev) => {
        const action = ev.detail && ev.detail.action;
        if (!action || !TRACKED_ACTIONS.has(action)) return;
        // Add the first line and start a repeater for as long as
        // the user holds the button.
        this.append(this._format(action));
        this._startRepeater(action);
      };
      const onRelease = (ev) => {
        const action = ev.detail && ev.detail.action;
        if (!action) return;
        this._stopRepeater(action);
      };
      const onToggle = (ev) => {
        const detail = ev.detail || {};
        if (detail.action !== "mic") return;
        this.append(detail.active ? "[mic:on]" : "[mic:off]");
      };

      PRESS_EVENTS.forEach((evt) => dpadEl.addEventListener(evt, onPress));
      RELEASE_EVENTS.forEach((evt) => dpadEl.addEventListener(evt, onRelease));
      TOGGLE_EVENTS.forEach((evt) => dpadEl.addEventListener(evt, onToggle));

      const off = () => {
        PRESS_EVENTS.forEach((evt) => dpadEl.removeEventListener(evt, onPress));
        RELEASE_EVENTS.forEach((evt) =>
          dpadEl.removeEventListener(evt, onRelease),
        );
        TOGGLE_EVENTS.forEach((evt) => dpadEl.removeEventListener(evt, onToggle));
        this._stopAllRepeaters();
      };
      this._unsubscribers.push(off);
      return off;
    }

    // ---- internals ----

    _startRepeater(action) {
      // Don't double-start.
      if (this._repeaters.has(action)) return;
      const id = setInterval(() => {
        // If the action was somehow released between intervals,
        // stop cleanly.
        if (!this._repeaters.has(action)) return;
        this.append(this._format(action));
      }, REPEAT_INTERVAL_MS);
      this._repeaters.set(action, id);
    }

    _stopRepeater(action) {
      const id = this._repeaters.get(action);
      if (id !== undefined) {
        clearInterval(id);
        this._repeaters.delete(action);
      }
    }

    _stopAllRepeaters() {
      this._repeaters.forEach((id) => clearInterval(id));
      this._repeaters.clear();
    }

    _mount() {
      // Idempotent: only build the shadow content once per element
      // instance. connectedCallback can fire multiple times if the
      // element is moved in the DOM (e.g. by Home Assistant's card
      // editor re-parenting the live card during dialog open/close);
      // without this guard, each re-connection would append another
      // <style> + readout frame to the same shadow root, which
      // visually stacks the activity log on top of itself.
      if (this._mounted) return;
      this._mounted = true;

      const style = document.createElement("style");
      style.textContent = READOUT_STYLES;

      const host = document.createElement("div");
      host.className = READOUT_CLASS;
      host.innerHTML =
        '<div class="' +
        READOUT_CLASS +
        '__header">' +
        '<span class="' +
        READOUT_CLASS +
        '__title">Activity</span>' +
        '<button type="button" class="' +
        READOUT_CLEAR_CLASS +
        '" aria-label="Clear log">' +
        '<ha-icon icon="mdi:delete-sweep"></ha-icon>' +
        "<span>Clear</span>" +
        "</button>" +
        "</div>" +
        '<div class="' +
        READOUT_LOG_CLASS +
        '" role="log" aria-live="polite"></div>';

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(host);

      // Wire the clear button. The button is inside the shadow root,
      // so we bind the listener to the host element (composed
      // events bubble across the shadow boundary).
      const clearBtn = this.shadowRoot.querySelector("." + READOUT_CLEAR_CLASS);
      if (clearBtn) {
        clearBtn.addEventListener("click", () => this.clear());
      }
    }

    _render() {
      const logEl =
        this.shadowRoot && this.shadowRoot.querySelector("." + READOUT_LOG_CLASS);
      if (!logEl) return;

      if (this._log.length === 0) {
        logEl.innerHTML =
          '<div class="' +
          READOUT_EMPTY_CLASS +
          '">No activity yet \u2014 push a direction button.</div>';
        return;
      }

      // Re-render as a string. Newest at the bottom. Each line is
      // textContent-safe (no innerHTML) so user-influenced strings
      // (if any) can never inject markup.
      const lines = this._log.map(
        (line) =>
          '<div class="' +
          READOUT_LINE_CLASS +
          '">' +
          escapeHtml(line) +
          "</div>",
      );
      logEl.innerHTML = lines.join("");

      // Auto-scroll to the bottom so the newest line is always
      // visible. (No-op if the user has scrolled up to read older
      // lines, which is fine — they'll see the new line appear at
      // the bottom of the visible area.)
      logEl.scrollTop = logEl.scrollHeight;
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

  // Lightweight HTML-escape used when rendering log lines. We
  // import lazily to keep this module dependency-free.
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, String.fromCharCode(38, 97, 109, 112, 59))
      .replace(/</g, String.fromCharCode(38, 108, 116, 59))
      .replace(/>/g, String.fromCharCode(38, 103, 116, 59))
      .replace(/"/g, String.fromCharCode(38, 113, 117, 111, 116, 59))
      .replace(/'/g, String.fromCharCode(38, 35, 51, 57, 59));
  }

  // Register the custom element. Guard against double-registration
  // (e.g. if this module is imported more than once).
  if (
    typeof customElements !== "undefined" &&
    !customElements.get("dpad-readout")
  ) {
    customElements.define("dpad-readout", DpadReadout);
  }

  /**
   * factory.js
   * ---------------------------------------------------------------
   * Creational factory pattern.
   *
   * The factory takes a `view-model` (a plain object emitted by the
   * controller) and produces the HTML string that the card inserts
   * into its shadow DOM. It pulls in:
   *   - icons.js   for decorative <ha-icon> elements (incl. nav arrows)
   *   - helpers.js for safety (escapeHtml, etc.)
   *   - styles.js  indirectly — the card injects styles itself;
   *                the factory only emits *class* hooks
   *
   * The factory never touches `hass` or `this`. It is a pure
   * function of its input — easy to test and easy to reason about.
   *
   * Note: the D-pad touchpad is a separate self-contained custom
   * element. The 4-way <dpad-control> is defined in dpad.js; the
   * 8-way <dpad-8way-control> is defined in dpad-8way.js. The
   * factory just drops one of those elements into the relevant
   * view's content area; it has no knowledge of the dpad internals.
   * ---------------------------------------------------------------
   */


  // Numeric page navigation rendered in the top-left of every
  // card header. Four buttons labeled (1) (2) (3) (4). The button
  // for the current view is marked .is-active and is not clickable
  // — you can't navigate to the page you're already on. The card
  // wires up click handlers via event delegation on the host,
  // using [data-page-nav="<view-id>"].
  const PAGE_NAV_CLASS = "card-page-nav";
  const PAGE_NAV_ITEM_CLASS = "card-page-nav__item";
  const PAGE_NAV_DATA = "data-page-nav";
  // Index of each page in the 1-based nav. Used as the label.
  const PAGE_NAV_INDEX = Object.freeze({
    [LAYOUTS.MAIN]: 1,
    [LAYOUTS.DETAIL]: 2,
    [LAYOUTS.DETAIL_8WAY]: 3,
    [LAYOUTS.DETAIL_CIRCLE]: 4,
  });
  // Ordered list of view ids in the nav, for rendering left-to-right.
  const PAGE_NAV_ORDER = [
    LAYOUTS.MAIN,
    LAYOUTS.DETAIL,
    LAYOUTS.DETAIL_8WAY,
    LAYOUTS.DETAIL_CIRCLE,
  ];

  // ----------------------------------------------------------------
  // Section builders
  // ----------------------------------------------------------------

  /**
   * Build the numeric page-nav strip (1) (2) (3) (4). Always rendered
   * regardless of whether the current view has a title/subtitle, so
   * the user always has a way to navigate between pages.
   *
   * The button for the current view is marked .is-active and is not
   * clickable (you can't navigate to the page you're on). The other
   * two are real buttons; the card catches clicks via event
   * delegation using [data-page-nav="<view-id>"].
   *
   * @param {string} currentView  one of LAYOUTS.MAIN | LAYOUTS.DETAIL | LAYOUTS.DETAIL_8WAY | LAYOUTS.DETAIL_CIRCLE
   * @returns {string} raw HTML
   */
  const buildPageNav = (currentView) => {
    const items = PAGE_NAV_ORDER.map((view) => {
      const isActive = view === currentView;
      const index = PAGE_NAV_INDEX[view];
      // Active page is a non-interactive label, not a button.
      if (isActive) {
        return (
          '<span class="' +
          PAGE_NAV_ITEM_CLASS +
          " " +
          PAGE_NAV_ITEM_CLASS +
          '--active" ' +
          'aria-current="page" aria-label="Current page (' +
          index +
          ')">' +
          "(" +
          index +
          ")" +
          "</span>"
        );
      }
      return (
        '<button type="button" class="' +
        PAGE_NAV_ITEM_CLASS +
        '" ' +
        PAGE_NAV_DATA +
        '="' +
        escapeHtml$1(view) +
        '" ' +
        'aria-label="Go to page ' +
        index +
        '">' +
        "(" +
        index +
        ")" +
        "</button>"
      );
    });
    return (
      '<div class="' +
      PAGE_NAV_CLASS +
      '" role="navigation" ' +
      'aria-label="Card pages">' +
      items.join("") +
      "</div>"
    );
  };

  /**
   * Build the card header (page nav + title + subtitle).
   *
   * The page nav is always rendered (top-left) so the user always
   * has a way to switch between pages. The title/subtitle block is
   * only rendered when at least one of them has content.
   *
   * @param {{title:string, subtitle:string, view:string}} vm
   * @returns {string} raw HTML
   */
  const buildHeader = (vm) => {
    const hasTitle = Boolean(vm.title);
    const hasSubtitle = Boolean(vm.subtitle);
    return (
      '<div class="' +
      REGIONS.HEADER +
      '">' +
      '<div class="' +
      REGIONS.HEADER +
      '__row">' +
      buildPageNav(vm.view) +
      (hasTitle || hasSubtitle
        ? '<div class="' +
          REGIONS.HEADER +
          '__text">' +
          (hasTitle
            ? '<h2 class="' +
              REGIONS.TITLE +
              '">' +
              escapeHtml$1(vm.title) +
              "</h2>"
            : "") +
          (hasSubtitle
            ? '<p class="' +
              REGIONS.SUBTITLE +
              '">' +
              escapeHtml$1(vm.subtitle) +
              "</p>"
            : "") +
          "</div>"
        : "") +
      "</div>" +
      "</div>"
    );
  };

  /**
   * Build the card content area. `content` is user-supplied
   * markup; we trust it (same model as HA's built-in markdown card)
   * but only after escaping the surrounding boundaries.
   *
   * @param {{content:string}} vm
   * @returns {string} raw HTML
   */
  const buildContent = (vm) => {
    const html = typeof vm.content === "string" ? vm.content : "";
    return '<div class="' + REGIONS.CONTENT + '">' + html + "</div>";
  };

  /**
   * Build the 4-way D-pad + readout content area. Both the D-pad and
   * the readout are self-contained custom elements (defined in
   * dpad.js and readout.js respectively). The factory just drops
   * both elements into the content area and lets the consumer wire
   * them up via:
   *
   *   const dpad  = card.querySelector('dpad-control');
   *   const read  = card.querySelector('dpad-readout');
   *   read.subscribe(dpad);
   *
   * @returns {string} raw HTML
   */
  const buildDpadContent = () =>
    '<div class="' +
    REGIONS.CONTENT +
    " " +
    REGIONS.CONTENT +
    '--dpad">' +
    "<dpad-control></dpad-control>" +
    "<dpad-readout></dpad-readout>" +
    "</div>";

  /**
   * Build the 8-way D-pad + readout content area. Same shape as
   * buildDpadContent but uses the 8-way custom element. The 8-way
   * dpad is the next iteration; for now it renders the same 5
   * buttons (it is a 1:1 clone of dpad.js with renamed internals).
   *
   * @returns {string} raw HTML
   */
  const buildDpad8wayContent = () =>
    '<div class="' +
    REGIONS.CONTENT +
    " " +
    REGIONS.CONTENT +
    '--dpad">' +
    "<dpad-8way-control></dpad-8way-control>" +
    "<dpad-readout></dpad-readout>" +
    "</div>";

  /**
   * Build the circle-pad + readout content area.
   *
   * @returns {string} raw HTML
   */
  const buildCirclePadContent = () =>
    '<div class="' +
    REGIONS.CONTENT +
    " " +
    REGIONS.CONTENT +
    '--dpad">' +
    "<circle-pad-control></circle-pad-control>" +
    "<dpad-readout></dpad-readout>" +
    "</div>";

  /**
   * Build the card footer (currently just the version string).
   *
   * @param {{version:string}} vm
   * @returns {string} raw HTML
   */
  const buildFooter = (vm) =>
    '<div class="' + REGIONS.FOOTER + '">v' + escapeHtml$1(vm.version) + "</div>";

  // ----------------------------------------------------------------
  // Top-level factory
  // ----------------------------------------------------------------

  /**
   * Render the entire card from a view-model.
   *
   * @param {ReturnType<import('./controller.js').CardController['getViewModel']>} vm
   * @returns {string} raw HTML
   */
  const buildCardHtml = (vm) => {
    switch (vm.view) {
      case LAYOUTS.DETAIL:
        // Second page: 4-way D-pad view.
        return (
          "<ha-card>" +
          '<div class="' +
          REGIONS.CARD_WRAPPER +
          '">' +
          buildHeader(vm) +
          buildDpadContent() +
          buildFooter(vm) +
          "</div>" +
          "</ha-card>"
        );
      case LAYOUTS.DETAIL_8WAY:
        // Third page: 8-way D-pad view.
        return (
          "<ha-card>" +
          '<div class="' +
          REGIONS.CARD_WRAPPER +
          '">' +
          buildHeader(vm) +
          buildDpad8wayContent() +
          buildFooter(vm) +
          "</div>" +
          "</ha-card>"
        );
      case LAYOUTS.DETAIL_CIRCLE:
        // Fourth page: circle-pad view.
        return (
          "<ha-card>" +
          '<div class="' +
          REGIONS.CARD_WRAPPER +
          '">' +
          buildHeader(vm) +
          buildCirclePadContent() +
          buildFooter(vm) +
          "</div>" +
          "</ha-card>"
        );
      case LAYOUTS.SETTINGS:
        // Reserved for a future settings view. For now, treat it
        // identically to the detail view.
        return (
          "<ha-card>" +
          '<div class="' +
          REGIONS.CARD_WRAPPER +
          '">' +
          buildHeader(vm) +
          buildDpadContent() +
          buildFooter(vm) +
          "</div>" +
          "</ha-card>"
        );
      case LAYOUTS.MAIN:
      default:
        return (
          "<ha-card>" +
          '<div class="' +
          REGIONS.CARD_WRAPPER +
          '">' +
          buildHeader(vm) +
          buildContent(vm) +
          buildFooter(vm) +
          "</div>" +
          "</ha-card>"
        );
    }
  };

  /**
   * styles.js
   * ---------------------------------------------------------------
   * Native CSS template literals for component styling.
   *
   * MANDATORY:
   *   All values must come from Home Assistant's own CSS custom
   *   properties / design tokens. This guarantees automatic theme
   *   synchronization (light, dark, and any user-defined theme).
   *
   *   Tokens used:
   *     - --primary-text-color
   *     - --secondary-text-color
   *     - --card-background-color
   *     - --ha-card-background
   *     - --ha-card-border-radius
   *     - --ha-card-border-width
   *     - --primary-color
   *     - --divider-color (supplementary)
   *     - --error-color   (supplementary)
   * ---------------------------------------------------------------
   */

  // Card root — wraps everything and inherits HA surface colors.
  const baseStyles = `
  :host {
    display: block;
    /* Inherit HA font stack + sizing */
    font-family: var(--ha-font-family, Roboto, 'Helvetica Neue', sans-serif);
    font-size: 14px;
    line-height: 1.4;
    color: var(--primary-text-color);
    box-sizing: border-box;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  ha-card {
    display: block;
    background: var(--ha-card-background, var(--card-background-color));
    border-radius: var(--ha-card-border-radius, 12px);
    border-width: var(--ha-card-border-width, 1px);
    border-style: solid;
    border-color: var(--divider-color, transparent);
    padding: 0;
    overflow: hidden;
  }
`;

  // Card wrapper — the grid that holds header / content / footer.
  const cardStyles = `
  .card-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .card-header {
    display: block;
    padding: 16px 16px 8px 16px;
    border-bottom: 1px solid var(--divider-color, transparent);
  }

  .card-header__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .card-header__text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 auto;
    min-width: 0;
  }

  .card-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 500;
    color: var(--primary-text-color);
    line-height: 1.2;
  }

  .card-subtitle {
    margin: 0;
    font-size: 0.875rem;
    color: var(--secondary-text-color);
    line-height: 1.3;
  }

  .card-content {
    padding: 16px;
    color: var(--primary-text-color);
    /* Allow user-supplied HTML to be styled by its own CSS */
  }

  .card-content--dpad {
    display: flex;
    flex-direction: column;   /* stack dpad on top, readout below */
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  /* Keep circle-pad.js portable: size it from the card layout,
     not from the component's internal :host defaults. */
  .card-content--dpad > circle-pad-control {
    width: 100%;
    align-self: stretch;
  }

  .card-content p:first-child { margin-top: 0; }
  .card-content p:last-child  { margin-bottom: 0; }

  .card-footer {
    padding: 8px 16px 12px 16px;
    font-size: 0.75rem;
    color: var(--secondary-text-color);
    text-align: right;
    border-top: 1px solid var(--divider-color, transparent);
  }
`;

  // Header page-nav strip — three numeric buttons (1) (2) (3) in
  // the top-left of the card header, used to switch between
  // internal views. The active page is rendered as a non-button
  // <span> with a distinct background; the other two are real
  // buttons that fire dpad-press-like events handled by card.js.
  const navStyles = `
  .card-page-nav {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 6px;
  }

  .card-page-nav__item {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    margin: 0;
    padding: 0;
    background: transparent;
    border: 1px solid var(--divider-color, transparent);
    border-radius: 4px;
    color: var(--secondary-text-color);
    font: inherit;
    font-size: 0.875rem;
    line-height: 1;
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease,
      border-color 120ms ease;
  }

  .card-page-nav__item:hover,
  .card-page-nav__item:focus-visible {
    background: var(--divider-color, rgba(127, 127, 127, 0.12));
    color: var(--primary-text-color);
    outline: none;
  }

  .card-page-nav__item:active {
    background: var(--divider-color, rgba(127, 127, 127, 0.2));
  }

  .card-page-nav__item--active {
    /* The current page is rendered as a <span> with this class.
       Visually mark it as the selected item: filled background,
       accent border, bold weight. Cursor is default (not a
       button) since clicking it would be a no-op. */
    background: var(--primary-color, #03a9f4);
    border-color: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    font-weight: 600;
    cursor: default;
  }
`;

  // Error / status messaging.
  const statusStyles = `
  .error-message {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    color: var(--error-color, #b71c1c);
    background: var(--ha-card-background, var(--card-background-color));
    border: 1px solid var(--error-color, #b71c1c);
    border-radius: var(--ha-card-border-radius, 12px);
    font-size: 0.875rem;
  }

  .error-message ha-icon {
    --mdc-icon-size: 20px;
    color: var(--error-color, #b71c1c);
  }
`;

  /**
   * Master style block injected into every card shadow root.
   * Exported as a single tagged-template-friendly array of strings so
   * downstream code can `join('')` or stream into a <style> tag.
   */
  const allStyles = [baseStyles, cardStyles, navStyles, statusStyles].join(
    "\n",
  );

  /**
   * card.js
   * ---------------------------------------------------------------
   * The primary custom element: <hass-vanilla-boilerplate-card>
   *
   * Implements the standard Lovelace card lifecycle:
   *   - setConfig(config)    — once, when the card loads / YAML changes
   *   - set hass(hass)        — continuously, on every state change
   *   - getCardSize()         — returns the card's grid size
   *
   * Internally it owns:
   *   - a CardController     (logic)
   *   - a Router             (view state, per card instance)
   *   - a Factory            (HTML rendering)
   *
   * It also registers itself on `window.customCards` so it appears
   * in the HA card picker dialog with a preview.
   * ---------------------------------------------------------------
   */


  class HassVanillaBoilerplateCard extends HTMLElement {
    constructor() {
      super();

      // 1. Shadow DOM (required for style isolation).
      this.attachShadow({ mode: "open" });

      // 2. Controller (logic) and a render-scheduler reference.
      this._router = new Router();
      this._controller = new CardController(this._router);
      this._renderScheduled = false;
      this._unsubRouter = null;
      this._unsubController = null;
    }

    // -----------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------

    connectedCallback() {
      this._mount();
      this._unsubController = this._controller.subscribe(() =>
        this._scheduleRender(),
      );
      this._unsubRouter = this._router.onViewChange(() => this._scheduleRender());
      this._scheduleRender();
    }

    disconnectedCallback() {
      if (this._unsubController) {
        this._unsubController();
        this._unsubController = null;
      }
      if (this._unsubRouter) {
        this._unsubRouter();
        this._unsubRouter = null;
      }
    }

    // -----------------------------------------------------------
    // Standard Lovelace API
    // -----------------------------------------------------------

    /**
     * Called by Home Assistant once when the card is created or
     * when the YAML configuration changes. We delegate to the
     * controller and schedule a render.
     *
     * @param {object} config
     */
    setConfig(config) {
      this._controller.setConfig(config);
    }

    /**
     * Called by Home Assistant on every state change.
     *
     * @param {{states: Record<string, any>}} hass
     */
    set hass(hass) {
      this._controller.setHass(hass);
    }

    /**
     * Lovelace grid size hint. Returns 2 for a comfortably-sized
     * card; adjust as your real content demands.
     *
     * @returns {number}
     */
    getCardSize() {
      return 2;
    }

    /**
     * Provide a static preview for the card picker. The picker
     * instantiates the element in a sandbox, so this is safe.
     *
     * @returns {Promise<HTMLElement>}
     */
    async getPreviewCard() {
      // Ensure a default config is loaded before rendering.
      if (
        !this._controller.config ||
        Object.keys(this._controller.config).length === 0
      ) {
        this._controller.setConfig({ ...DEFAULTS });
      }
      // Re-render synchronously.
      this._render();
      return this;
    }

    /**
     * Default config for the card picker ("Add card" → our card).
     *
     * @returns {object}
     */
    static getStubConfig() {
      return CardController.getStubConfig();
    }

    /**
     * Schema-driven form definition for the card's visual editor.
     *
     * Home Assistant calls this when the user opens the visual
     * editor and renders an <ha-form> internally from the schema.
     * This is the recommended modern pattern (see
     * https://developers.home-assistant.io/docs/frontend/custom-ui/custom-card).
     *
     * Why this and not a custom `getConfigElement()` editor:
     *   - HA owns the form rendering and the resulting config
     *     object, so `type: custom:hass-vanilla-boilerplate-card`
     *     stays pinned to the top of the saved YAML.
     *   - No hand-rolled <ha-input>/<ha-textarea> shadow DOM, so
     *     the Content textbox is reliably present and editable.
     *   - All field validation, helpers, and labels come from HA.
     *
     * @returns {{schema: Array, computeLabel?: Function, computeHelper?: Function, assertConfig?: Function}}
     */
    static getConfigForm() {
      return {
        schema: [
          { name: "title", selector: { text: {} } },
          { name: "subtitle", selector: { text: {} } },
          {
            name: "content",
            selector: { text: { multiline: true } },
          },
        ],
        computeLabel: (schema) => {
          switch (schema.name) {
            case "title":
              return "Title";
            case "subtitle":
              return "Subtitle";
            case "content":
              return "Content (HTML markup)";
            default:
              return undefined;
          }
        },
        computeHelper: (schema) => {
          if (schema.name === "content") {
            return (
              "Accepts HTML markup. The card renders it inside its " +
              "shadow DOM, so your styles are isolated from the dashboard."
            );
          }
          return undefined;
        },
        assertConfig: (config) => {
          // No hard requirements — all three fields are optional
          // and fall back to DEFAULTS at render time.
        },
      };
    }

    // -----------------------------------------------------------
    // Internal: mount + render
    // -----------------------------------------------------------

    _mount() {
      const root = this.shadowRoot;
      if (!root) return;

      // Inject styles once.
      if (!root.querySelector("style[data-card-styles]")) {
        const style = document.createElement("style");
        style.setAttribute("data-card-styles", "");
        style.textContent = allStyles;
        root.appendChild(style);
      }

      // Mount container for re-rendered content.
      //
      // IMPORTANT: this card is a content display, not a button. By
      // default we attach NO tap-action listeners at all — that way
      // Home Assistant doesn't intercept clicks with its own
      // "more-info" dialog or treat the card as a tap target.
      //
      // Two kinds of listeners may be attached:
      //   1. Internal header-nav arrow clicks (always wired up).
      //      These route through this card instance's router and never
      //      dispatch hass-action events. The D-pad is also
      //      fully self-contained (see dpad.js) — it dispatches its
      //      own `dpad-press` / `dpad-release` / `dpad-toggle`
      //      events on its host element, which cross the shadow
      //      boundary via composed:true, so this card can listen
      //      to them too if it ever needs to.
      //   2. Optional tap_action / hold_action / double_tap_action
      //      listeners (only attached when the user has configured
      //      them in YAML). The controller's handlers are no-ops
      //      if the corresponding action isn't set.
      if (!root.querySelector("[data-card-host]")) {
        const host = document.createElement("div");
        host.setAttribute("data-card-host", "");

        // (1) Internal page-nav click delegation.
        //     Triggered by factory.js's <button data-page-nav="...">
        //     elements in the header. The active page (the one
        //     we're currently viewing) is rendered as a non-button
        //     <span> and is not clickable, so the closest("[data-page-nav]")
        //     check naturally filters it out.
        host.addEventListener("click", (ev) => {
          const target = ev.target;
          if (!(target instanceof Element)) return;
          const btn = target.closest("[data-page-nav]");
          if (!btn || !host.contains(btn)) return;
          const view = btn.getAttribute("data-page-nav");
          if (view) this._router.navigate(view);
        });

        // (2) Optional user-configured tap actions.
        const cfg = this._controller.config || {};
        if (cfg.tap_action) {
          // Tap action is added at the host level so the user can tap
          // anywhere on the card. We skip the nav arrow buttons so
          // a tap on the arrow navigates internally, not to the
          // tap_action. (D-pad taps don't bubble here because the
          // dpad-control lives in its own shadow root; the user's
          // tap_action will only fire for taps on the card's own
          // chrome outside the dpad.)
          host.addEventListener("click", (ev) => {
            const target = ev.target;
            if (target instanceof Element && target.closest("[data-page-nav]")) {
              return; // page nav click — handled above
            }
            this._controller.handleClick(this, ev);
          });
        }
        if (cfg.hold_action) {
          host.addEventListener("contextmenu", (ev) => {
            ev.preventDefault();
            this._controller.handleHold(this, ev);
          });
        }
        if (cfg.double_tap_action) {
          host.addEventListener("dblclick", (ev) => {
            this._controller.handleDoubleClick(this, ev);
          });
        }

        root.appendChild(host);
      }
    }

    _scheduleRender() {
      if (this._renderScheduled) return;
      this._renderScheduled = true;
      // Use a microtask so multiple state changes batch into one paint.
      Promise.resolve().then(() => {
        this._renderScheduled = false;
        this._render();
      });
    }

    _render() {
      if (!this.shadowRoot) return;
      const host = this.shadowRoot.querySelector("[data-card-host]");
      if (!host) return;

      try {
        const vm = this._controller.getViewModel();
        const nextHtml = buildCardHtml(vm);

        // CRITICAL: do NOT replace host.innerHTML on every hass
        // update. Every hass change would recreate the
        // <dpad-control> and <dpad-readout> elements, wiping the
        // mic toggle state and the activity log. Instead, only
        // re-render when the rendered HTML actually changes (e.g.
        // when the view changes via this card instance's router,
        // or when the
        // config updates).
        if (host.innerHTML !== nextHtml) {
          host.innerHTML = nextHtml;
        }

        // Re-wire dpad→readout whenever the elements are present.
        // (This is cheap and idempotent; the wiring helper tracks
        // whether the same instances are already connected.)
        this._wireDpadReadout(host);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[${CARD_TYPE}] render failed`, err);
        host.innerHTML = renderErrorMessage(
          `Render error: ${String(err.message || err)}`,
        );
      }
    }

    /**
     * If both <dpad-control> and <dpad-readout> exist in the rendered
     * host, subscribe the readout to the dpad. Idempotent: stores
     * the unsubscriber on the element and reuses it across renders
     * (or replaces it if the elements changed).
     *
     * @param {HTMLElement} host
     * @private
     */
    _wireDpadReadout(host) {
      if (!host) return;
      const dpad = host.querySelector(
        "dpad-control, dpad-8way-control, circle-pad-control",
      );
      const readout = host.querySelector("dpad-readout");
      if (!dpad || !readout) return;

      // If we already wired these exact instances, nothing to do.
      if (
        this._dpadReadoutWired &&
        this._dpadReadoutWired.dpad === dpad &&
        this._dpadReadoutWired.readout === readout
      ) {
        return;
      }

      // Otherwise (re-)subscribe. Disconnect any previous subscription first.
      if (
        this._dpadReadoutWired &&
        typeof this._dpadReadoutWired.off === "function"
      ) {
        try {
          this._dpadReadoutWired.off();
        } catch (_e) {
          /* ignore */
        }
      }

      const off = readout.subscribe(dpad);
      this._dpadReadoutWired = { dpad, readout, off };
    }
  }

  // -----------------------------------------------------------
  // Registration
  // -----------------------------------------------------------

  if (!customElements.get("hass-vanilla-boilerplate-card")) {
    customElements.define(
      "hass-vanilla-boilerplate-card",
      HassVanillaBoilerplateCard,
    );
  }

  // Register for the HA card picker dialog.
  if (typeof window !== "undefined") {
    window.customCards = window.customCards || [];
    if (!window.customCards.some((c) => c && c.type === CARD_TYPE)) {
      window.customCards.push({
        type: CARD_TYPE,
        name: CARD_NAME,
        description: CARD_DESCRIPTION,
        preview: true, // requests getPreviewCard() in the picker
      });
    }
  }

  // Surface a single info message on first load to confirm install.
  if (
    typeof window !== "undefined" &&
    !window.__HASS_VANILLA_BOOTSTRAP_LOGGED__
  ) {
    window.__HASS_VANILLA_BOOTSTRAP_LOGGED__ = true;
    // eslint-disable-next-line no-console
    console.info(
      `%c[${CARD_TYPE}]`,
      "color: #03a9f4; font-weight: bold;",
      `${CARD_NAME} registered.`,
    );
  }

})();
