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
  const CARD_VERSION = '0.1.5';
  const CARD_TYPE = 'hass-vanilla-boilerplate-card';
  const CARD_NAME = 'HASS Vanilla Boilerplate Card';
  const CARD_DESCRIPTION =
    'A production-ready vanilla JS Home Assistant Lovelace card boilerplate.';

  // ---------- Editor schema (used for getStubConfig + editor UI) ----------
  const CONFIG_KEYS = Object.freeze({
    TITLE: 'title',
    SUBTITLE: 'subtitle',
    CONTENT: 'content',
  });

  // ---------- Defaults (used by setConfig + getStubConfig) ----------
  const DEFAULTS = Object.freeze({
    title: 'Vanilla Boilerplate',
    subtitle: 'A modular Home Assistant card',
    content: '<p>Hello, <strong>Home Assistant</strong>!</p>',
  });

  // ---------- Layout / view identifiers (used by router.js) ----------
  const LAYOUTS = Object.freeze({
    MAIN: 'main',
    // Reserved for future tabs/views added via router.js
    DETAIL: 'detail',
    SETTINGS: 'settings',
  });

  // ---------- Selector regions in the card DOM ----------
  const REGIONS = Object.freeze({
    CARD_WRAPPER: 'card-wrapper',
    HEADER: 'card-header',
    TITLE: 'card-title',
    SUBTITLE: 'card-subtitle',
    CONTENT: 'card-content',
    FOOTER: 'card-footer',
  });

  // ---------- CSS class names (mirror of REGIONS where needed) ----------
  Object.freeze({
    ...REGIONS,
  });

  // ---------- Safety / error message keys ----------
  const ERROR_KEYS = Object.freeze({
    MISSING_CONFIG: 'missing_config',
    INVALID_CONFIG: 'invalid_config',
    MISSING_HASS: 'missing_hass',
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

  const escapeHtml = (value) => {
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

  /**
   * Convenience wrapper for the editor's `config-changed` event.
   *
   * @param {HTMLElement} node
   * @param {object} config
   */
  const fireConfigChanged = (node, config) => {
    fireEvent(node, 'config-changed', { config });
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
    <span>${escapeHtml(message)}</span>
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

  // ----------------------------------------------------------------
  // Misc small utilities
  // ----------------------------------------------------------------

  /**
   * Debounce — used by the editor to throttle config-changed events.
   *
   * @param {(...args: any[]) => void} fn
   * @param {number} wait
   * @returns {(...args: any[]) => void}
   */
  const debounce = (fn, wait = 150) => {
    let timer = null;
    return (...args) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
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


  /**
   * Thin pub/sub used by the card to re-render on view change.
   * Returns an `unsubscribe()` function.
   *
   * @param {string} event
   * @param {(payload:any) => void} fn
   */
  const subscribe = (event, fn) => {
    document.addEventListener(event, (e) => fn(e.detail));
    return () => document.removeEventListener(event, fn);
  };

  const emit = (event, detail) => {
    document.dispatchEvent(new CustomEvent(event, { detail }));
  };

  class Router {
    constructor(initial = LAYOUTS.MAIN) {
      this._current = initial;
      this._history = [initial];
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
      emit('card-view-changed', { view: id, payload });
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
      emit('card-view-changed', { view: previous, payload: null });
      return true;
    }

    /**
     * Subscribe to view-change events.
     * @param {(payload:any) => void} fn
     * @returns {() => void} unsubscribe
     */
    onViewChange(fn) {
      return subscribe('card-view-changed', fn);
    }
  }

  // Singleton — the card and controller share one router instance.
  const router = new Router(LAYOUTS.MAIN);

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
    constructor() {
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
          console.error('[controller] listener threw', err);
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
      return router.current;
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
      if (!hass || typeof hass !== 'object') {
        warnOnce(ERROR_KEYS.MISSING_HASS, 'No hass object provided to card');
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
      fireHassAction(node, 'tap', this._config.tap_action);
    }

      /**
       * Default hold handler.
       *
       * @param {HTMLElement} node
       * @param {MouseEvent} ev
       */
      handleHold(node, ev) {
        if (!this._config.hold_action) return;
        fireHassAction(node, 'hold', this._config.hold_action);
      }

      /**
       * Default double-tap handler.
       *
       * @param {HTMLElement} node
       * @param {MouseEvent} ev
       */
      handleDoubleClick(node, ev) {
        if (!this._config.double_tap_action) return;
        fireHassAction(node, 'double_tap', this._config.double_tap_action);
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
   * icons.js
   * ---------------------------------------------------------------
   * Centralized dictionary of Material Design Icons (MDI) used by
   * the card and its editor. We store *names*, not raw SVG paths,
   * because Home Assistant ships <ha-icon> natively which resolves
   * the MDI glyph set automatically. That keeps the card bundle
   * tiny and ensures icons match the rest of the HA UI.
   *
   * If you ever need to render an SVG path manually, drop a path
   * string into the SVG_PATHS map below and call `getIconPath()`.
   * ---------------------------------------------------------------
   */

  // MDI icon *names* (used with <ha-icon icon="mdi:...">)
  const ICON_NAMES = Object.freeze({
    CARD: 'mdi:card-outline',
    EDIT: 'mdi:pencil',
    ALERT: 'mdi:alert-circle',
    CHECK: 'mdi:check-circle',
    HOME: 'mdi:home',
    SETTINGS: 'mdi:cog',
    REFRESH: 'mdi:refresh',
    // Internal-card navigation arrows (used by the header nav
    // buttons the factory renders to switch between views).
    ARROW_RIGHT: 'mdi:chevron-right',
    ARROW_LEFT: 'mdi:chevron-left',
    // D-pad arrow icons (for the on-card touchpad). Distinct key
    // names from the header nav arrows so consumers can tell them
    // apart at a glance.
    DPAD_UP: 'mdi:chevron-up',
    DPAD_DOWN: 'mdi:chevron-down',
    DPAD_LEFT: 'mdi:chevron-left',
    DPAD_RIGHT: 'mdi:chevron-right',
    // Microphone icons (off + on). The card toggles between these
    // on the D-pad's center button.
    MICROPHONE: 'mdi:microphone',
    MICROPHONE_OFF: 'mdi:microphone-off',
  });

  // Inline SVG path data — only used if you need a fully offline
  // render. The strings are deliberately simple to keep this
  // module readable; expand as your card needs grow.
  Object.freeze({
    [ICON_NAMES.CARD]:
      'M2 4h20v16H2z M4 8h16 M4 12h16 M4 16h10', // card outline
    [ICON_NAMES.ALERT]:
      'M12 2 L22 20 L2 20 Z M12 9v5 M12 17h.01', // triangle exclamation
    [ICON_NAMES.CHECK]:
      'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M7 12l3 3 7-7', // circle check
  });

  /**
   * Convenience accessor — return the MDI name for a logical key.
   *
   * @param {string} key
   * @returns {string|undefined}
   */
  const getIcon = (key) => ICON_NAMES[key];

  /**
   * Render an <ha-icon> element for the given logical key.
   * Returned as a raw string for easy template interpolation.
   *
   * @param {string} key
   * @param {object} [opts]
   * @param {string} [opts.className]
   * @param {Record<string,string>} [opts.attrs] extra HTML attrs
   *        (e.g. `{ 'data-card-nav': 'main' }`).
   * @returns {string}
   */
  const renderIcon = (key, opts = {}) => {
    const name = getIcon(key);
    if (!name) return '';
    const cls = opts.className ? ` class="${opts.className}"` : '';
    const attrs = opts.attrs
      ? ' ' + Object.entries(opts.attrs)
          .map(([k, v]) => `${k}="${String(v).replace(/"/g, '"')}"`)
          .join(' ')
      : '';
    return `<ha-icon icon="${name}"${cls}${attrs}></ha-icon>`;
  };

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
   * element (`<dpad-control>`) defined in dpad.js. The factory just
   * drops a `<dpad-control>` element into the detail view's
   * content area; it has no knowledge of the D-pad's internals.
   * ---------------------------------------------------------------
   */


  // CSS class hook + data attribute for the header nav arrow
  // buttons. The card wires up click handlers via event delegation
  // on the host, using [data-card-nav="<target-view>"].
  const NAV_CLASS = 'card-nav-arrow';
  const NAV_DATA_TARGET = 'data-card-nav';

  // ----------------------------------------------------------------
  // Section builders
  // ----------------------------------------------------------------

  /**
   * Build a navigation arrow button for the header. The arrow points
   * forward (right) on the main view, and back (left) on any other
   * view. Clicking it asks the router to navigate to `targetView`.
   *
   * The button is rendered as a bare <ha-icon> wrapped in a <button>
   * so it's keyboard-focusable and announces its role correctly.
   *
   * @param {string} targetView  one of LAYOUTS.MAIN | LAYOUTS.DETAIL
   * @returns {string} raw HTML
   */
  const buildNavArrow = (targetView) => {
    const isBack = targetView === LAYOUTS.MAIN;
    const iconKey = isBack ? 'ARROW_LEFT' : 'ARROW_RIGHT';
    const label = isBack ? 'Back' : 'Next';
    return (
      '<button type="button" class="' + NAV_CLASS + '" ' +
        NAV_DATA_TARGET + '="' + escapeHtml(targetView) + '" ' +
        'aria-label="' + label + '">' +
        renderIcon(iconKey, { className: NAV_CLASS + '__icon' }) +
      '</button>'
    );
  };

  /**
   * Build the card header (title + subtitle + optional nav arrow).
   *
   * @param {{title:string, subtitle:string, view:string}} vm
   * @returns {string} raw HTML
   */
  const buildHeader = (vm) => {
    const hasTitle = Boolean(vm.title);
    const hasSubtitle = Boolean(vm.subtitle);
    if (!hasTitle && !hasSubtitle) return '';

    // Decide which arrow to show based on the current view:
    //   - LAYOUTS.MAIN     -> right arrow pointing to LAYOUTS.DETAIL
    //   - LAYOUTS.DETAIL   -> left arrow pointing back to LAYOUTS.MAIN
    //   - LAYOUTS.SETTINGS -> left arrow pointing back to LAYOUTS.MAIN
    //     (settings is reserved for future use; behaves like detail)
    let navArrow = '';
    if (vm.view === LAYOUTS.MAIN) {
      navArrow = buildNavArrow(LAYOUTS.DETAIL);
    } else if (vm.view === LAYOUTS.DETAIL || vm.view === LAYOUTS.SETTINGS) {
      navArrow = buildNavArrow(LAYOUTS.MAIN);
    }

    return (
      '<div class="' + REGIONS.HEADER + '">' +
        '<div class="' + REGIONS.HEADER + '__row">' +
          '<div class="' + REGIONS.HEADER + '__text">' +
            (hasTitle ? '<h2 class="' + REGIONS.TITLE + '">' + escapeHtml(vm.title) + '</h2>' : '') +
            (hasSubtitle ? '<p class="' + REGIONS.SUBTITLE + '">' + escapeHtml(vm.subtitle) + '</p>' : '') +
          '</div>' +
          navArrow +
        '</div>' +
      '</div>'
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
    const html = typeof vm.content === 'string' ? vm.content : '';
    return (
      '<div class="' + REGIONS.CONTENT + '">' +
        html +
      '</div>'
    );
  };

  /**
   * Build the D-pad content area. The D-pad is implemented as its
   * own custom element (`<dpad-control>`, defined in dpad.js) which
   * encapsulates its own shadow DOM, styles, and pointer logic.
   * Here we just drop a single element into the content area.
   *
   * @returns {string} raw HTML
   */
  const buildDpadContent = () =>
    '<div class="' + REGIONS.CONTENT + ' ' + REGIONS.CONTENT + '--dpad">' +
      '<dpad-control></dpad-control>' +
    '</div>';

  /**
   * Build the card footer (currently just the version string).
   *
   * @param {{version:string}} vm
   * @returns {string} raw HTML
   */
  const buildFooter = (vm) =>
    '<div class="' + REGIONS.FOOTER + '">v' + escapeHtml(vm.version) + '</div>';

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
        // Static secondary page: same header + footer as the main
        // view, but the content area holds a <dpad-control>.
        return (
          '<ha-card>' +
            '<div class="' + REGIONS.CARD_WRAPPER + '">' +
              buildHeader(vm) +
              buildDpadContent() +
              buildFooter(vm) +
            '</div>' +
          '</ha-card>'
        );
      case LAYOUTS.SETTINGS:
        // Reserved for a future settings view. For now, treat it
        // identically to the detail view.
        return (
          '<ha-card>' +
            '<div class="' + REGIONS.CARD_WRAPPER + '">' +
              buildHeader(vm) +
              buildDpadContent() +
              buildFooter(vm) +
            '</div>' +
          '</ha-card>'
        );
      case LAYOUTS.MAIN:
      default:
        return (
          '<ha-card>' +
            '<div class="' + REGIONS.CARD_WRAPPER + '">' +
              buildHeader(vm) +
              buildContent(vm) +
              buildFooter(vm) +
            '</div>' +
          '</ha-card>'
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
    align-items: center;
    justify-content: center;
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

  // Header nav arrow button — used to switch between internal views.
  const navStyles = `
  .card-nav-arrow {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    margin: 0;
    background: transparent;
    border: none;
    border-radius: 50%;
    color: var(--secondary-text-color);
    cursor: pointer;
    transition: background-color 120ms ease, color 120ms ease;
  }

  .card-nav-arrow:hover,
  .card-nav-arrow:focus-visible {
    background: var(--divider-color, rgba(127, 127, 127, 0.12));
    color: var(--primary-text-color);
    outline: none;
  }

  .card-nav-arrow:active {
    background: var(--divider-color, rgba(127, 127, 127, 0.2));
  }

  .card-nav-arrow__icon {
    --mdc-icon-size: 24px;
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

  // Editor styles — mimic HA's editor chrome.
  const editorStyles = `
  :host {
    display: block;
    padding: 12px 0;
  }

  .editor-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 16px;
  }

  .editor-row label {
    font-size: 0.875rem;
    color: var(--secondary-text-color);
    font-weight: 500;
  }

  .editor-row ha-input,
  .editor-row ha-textarea {
    width: 100%;
    --mdc-theme-primary: var(--primary-color);
    --mdc-text-field-fill-color: var(--card-background-color);
    --mdc-text-field-ink-color: var(--primary-text-color);
    --mdc-text-field-label-ink-color: var(--secondary-text-color);
  }

  .editor-help {
    margin-top: -8px;
    margin-bottom: 16px;
    font-size: 0.75rem;
    color: var(--secondary-text-color);
  }
`;

  /**
   * Master style block injected into every card shadow root.
   * Exported as a single tagged-template-friendly array of strings so
   * downstream code can `join('')` or stream into a <style> tag.
   */
  const allStyles = [
    baseStyles,
    cardStyles,
    navStyles,
    statusStyles,
  ].join('\n');

  const allEditorStyles = [baseStyles, editorStyles, statusStyles].join('\n');

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
   *   - a Router             (view state, via the singleton)
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
      this.attachShadow({ mode: 'open' });

      // 2. Controller (logic) and a render-scheduler reference.
      this._controller = new CardController();
      this._renderScheduled = false;
      this._unsubRouter = null;
      this._unsubController = null;
    }

    // -----------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------

    connectedCallback() {
      this._mount();
      this._unsubController = this._controller.subscribe(() => this._scheduleRender());
      this._unsubRouter = router.onViewChange(() => this._scheduleRender());
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
      if (!this._controller.config || Object.keys(this._controller.config).length === 0) {
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
     * Reference to the editor element. Lovelace calls this when
     * the user opens the visual editor for our card.
     *
     * @returns {Promise<HTMLElement>}
     */
    static async getConfigElement() {
      // Lazy import — the editor pulls in ha-form controls that
      // are only needed inside the edit dialog.
      await Promise.resolve().then(function () { return editor; });
      const el = document.createElement('hass-vanilla-boilerplate-card-editor');
      // Create the editor's shadow DOM and mount its form.
      if (typeof el._init === 'function') el._init();
      return el;
    }

    // -----------------------------------------------------------
    // Internal: mount + render
    // -----------------------------------------------------------

    _mount() {
      const root = this.shadowRoot;
      if (!root) return;

      // Inject styles once.
      if (!root.querySelector('style[data-card-styles]')) {
        const style = document.createElement('style');
        style.setAttribute('data-card-styles', '');
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
      //      These route through `router.navigate()` and never
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
      if (!root.querySelector('[data-card-host]')) {
        const host = document.createElement('div');
        host.setAttribute('data-card-host', '');

        // (1) Internal header-nav arrow click delegation.
        //     Triggered by factory.js's <button data-card-nav="...">
        //     elements in the header.
        host.addEventListener('click', (ev) => {
          const target = ev.target;
          if (!(target instanceof Element)) return;
          const btn = target.closest('[data-card-nav]');
          if (!btn || !host.contains(btn)) return;
          const view = btn.getAttribute('data-card-nav');
          if (view) router.navigate(view);
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
          host.addEventListener('click', (ev) => {
            const target = ev.target;
            if (target instanceof Element && target.closest('[data-card-nav]')) {
              return; // nav arrow click — handled above
            }
            this._controller.handleClick(this, ev);
          });
        }
        if (cfg.hold_action) {
          host.addEventListener('contextmenu', (ev) => {
            ev.preventDefault();
            this._controller.handleHold(this, ev);
          });
        }
        if (cfg.double_tap_action) {
          host.addEventListener('dblclick', (ev) => {
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
      const host = this.shadowRoot.querySelector('[data-card-host]');
      if (!host) return;

      try {
        const vm = this._controller.getViewModel();
        host.innerHTML = buildCardHtml(vm);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[${CARD_TYPE}] render failed`, err);
        host.innerHTML = renderErrorMessage(`Render error: ${String(err.message || err)}`);
      }
    }
  }

  // -----------------------------------------------------------
  // Registration
  // -----------------------------------------------------------

  if (!customElements.get('hass-vanilla-boilerplate-card')) {
    customElements.define('hass-vanilla-boilerplate-card', HassVanillaBoilerplateCard);
  }

  // Register for the HA card picker dialog.
  if (typeof window !== 'undefined') {
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
  if (typeof window !== 'undefined' && !window.__HASS_VANILLA_BOOTSTRAP_LOGGED__) {
    window.__HASS_VANILLA_BOOTSTRAP_LOGGED__ = true;
    // eslint-disable-next-line no-console
    console.info(
      `%c[${CARD_TYPE}]`,
      'color: #03a9f4; font-weight: bold;',
      `${CARD_NAME} registered.`,
    );
  }

  /**
   * editor.js
   * ---------------------------------------------------------------
   * Visual configuration element for <hass-vanilla-boilerplate-card>.
   *
   * Exposed as a custom element `hass-vanilla-boilerplate-card-editor`
   * and surfaced to Home Assistant via the main card's static
   * `getConfigElement()` method.
   *
   * Whenever a form input changes, the editor dispatches the native
   * `config-changed` event with the new full config object. HA then
   * re-renders the live dashboard preview using that new config.
   * ---------------------------------------------------------------
   */


  class HassVanillaBoilerplateCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = { ...DEFAULTS };
      this._initialized = false;
      this._emitConfigChanged = debounce(
        this._emitConfigChanged.bind(this),
        200,
      );
    }

    // -----------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------

    connectedCallback() {
      if (!this._initialized) this._init();
    }

    /**
     * Public initialization hook — the main card calls this from
     * its static `getConfigElement()` so the editor is ready to
     * receive a `setConfig` call as soon as it's inserted.
     */
    _init() {
      if (this._initialized) return;
      this._initialized = true;

      const root = this.shadowRoot;
      if (!root) return;

      // Inject styles.
      const style = document.createElement('style');
      style.setAttribute('data-editor-styles', '');
      style.textContent = allEditorStyles;
      root.appendChild(style);

      // Build the form skeleton. We render once and then bind
      // listeners — no innerHTML thrash on every input.
      const form = document.createElement('div');
      form.setAttribute('data-editor-form', '');
      form.innerHTML = `
      <div class="editor-row">
        <label for="cfg-title">Title</label>
        <ha-input id="cfg-title" name="title" label="Title"></ha-input>
      </div>
      <div class="editor-row">
        <label for="cfg-subtitle">Subtitle</label>
        <ha-input id="cfg-subtitle" name="subtitle" label="Subtitle"></ha-input>
      </div>
      <div class="editor-row">
        <label for="cfg-content">Content (HTML markup)</label>
        <ha-textarea id="cfg-content" name="content" label="Content" autogrow></ha-textarea>
      </div>
      <p class="editor-help">
        The Content field accepts HTML markup. The card renders it inside its
        shadow DOM, so your styles are isolated from the dashboard.
      </p>
    `;
      root.appendChild(form);

      // Wire up change handlers.
      this._bindInput('cfg-title', 'title');
      this._bindInput('cfg-subtitle', 'subtitle');
      this._bindInput('cfg-content', 'content');

      // Populate initial values (if any were set before insertion).
      this._syncFromConfig();
    }

    // -----------------------------------------------------------
    // Standard HA editor API
    // -----------------------------------------------------------

    /**
     * Called by Home Assistant to push the current card config
     * into the editor.
     *
     * @param {object} config
     */
    setConfig(config) {
      this._config = { ...DEFAULTS, ...(config || {}) };
      if (this._initialized) this._syncFromConfig();
    }

    // -----------------------------------------------------------
    // Internal: input wiring
    // -----------------------------------------------------------

    /**
     * Bind a `<ha-input>` or `<ha-textarea>` so its `value` updates
     * `this._config[key]` and emits `config-changed` on every edit.
     *
     * @param {string} elementId
     * @param {keyof typeof DEFAULTS} key
     */
    _bindInput(elementId, key) {
      const el = this.shadowRoot && this.shadowRoot.getElementById(elementId);
      if (!el) return;

      // `input` event for ha-textarea / ha-input
      el.addEventListener('input', (ev) => {
        this._config = { ...this._config, [key]: ev.target.value };
        this._emitConfigChanged();
      });
      // `change` as a final safety net
      el.addEventListener('change', (ev) => {
        this._config = { ...this._config, [key]: ev.target.value };
        this._emitConfigChanged();
      });
    }

    _syncFromConfig() {
      const root = this.shadowRoot;
      if (!root) return;
      const titleEl = root.getElementById('cfg-title');
      const subtitleEl = root.getElementById('cfg-subtitle');
      const contentEl = root.getElementById('cfg-content');
      if (titleEl) titleEl.value = this._config[CONFIG_KEYS.TITLE] || '';
      if (subtitleEl) subtitleEl.value = this._config[CONFIG_KEYS.SUBTITLE] || '';
      if (contentEl) contentEl.value = this._config[CONFIG_KEYS.CONTENT] || '';
    }

    _emitConfigChanged() {
      fireConfigChanged(this, { ...this._config });
    }
  }

  // -----------------------------------------------------------
  // Registration
  // -----------------------------------------------------------

  if (!customElements.get('hass-vanilla-boilerplate-card-editor')) {
    customElements.define(
      'hass-vanilla-boilerplate-card-editor',
      HassVanillaBoilerplateCardEditor,
    );
  }

  var editor = /*#__PURE__*/Object.freeze({
    __proto__: null
  });

})();
//# sourceMappingURL=hass-vanilla-boilerplate-card.js.map
