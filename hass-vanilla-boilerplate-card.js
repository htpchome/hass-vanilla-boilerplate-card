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
  const CARD_VERSION = '0.1.1';
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
      // Pass the user's `tap_action` config (e.g.
      // { action: 'navigate', navigation_path: '/lovelace/0' }).
      // Falls back to { action: 'none' } in the helper.
      fireHassAction(node, 'tap', this._config.tap_action);
    }

    /**
     * Default hold handler.
     *
     * @param {HTMLElement} node
     * @param {MouseEvent} ev
     */
    handleHold(node, ev) {
      fireHassAction(node, 'hold', this._config.hold_action);
    }

    /**
     * Default double-tap handler.
     *
     * @param {HTMLElement} node
     * @param {MouseEvent} ev
     */
    handleDoubleClick(node, ev) {
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
   * factory.js
   * ---------------------------------------------------------------
   * Creational factory pattern.
   *
   * The factory takes a `view-model` (a plain object emitted by the
   * controller) and produces the HTML string that the card inserts
   * into its shadow DOM. It pulls in:
   *   - icons.js   for any decorative <ha-icon> elements
   *   - helpers.js for safety (escapeHtml, etc.)
   *   - styles.js  indirectly — the card injects styles itself;
   *                the factory only emits *class* hooks
   *
   * The factory never touches `hass` or `this`. It is a pure
   * function of its input — easy to test and easy to reason about.
   * ---------------------------------------------------------------
   */


  // ----------------------------------------------------------------
  // Section builders
  // ----------------------------------------------------------------

  /**
   * Build the card header (title + optional subtitle).
   *
   * @param {{title:string, subtitle:string}} vm
   * @returns {string} raw HTML
   */
  const buildHeader = (vm) => {
    const hasTitle = Boolean(vm.title);
    const hasSubtitle = Boolean(vm.subtitle);
    if (!hasTitle && !hasSubtitle) return '';
    return `
    <div class="${REGIONS.HEADER}">
      ${hasTitle ? `<h2 class="${REGIONS.TITLE}">${escapeHtml(vm.title)}</h2>` : ''}
      ${hasSubtitle ? `<p class="${REGIONS.SUBTITLE}">${escapeHtml(vm.subtitle)}</p>` : ''}
    </div>
  `;
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
    return `
    <div class="${REGIONS.CONTENT}">
      ${html}
    </div>
  `;
  };

  /**
   * Build the card footer (currently just the version string).
   *
   * @param {{version:string}} vm
   * @returns {string} raw HTML
   */
  const buildFooter = (vm) => `
  <div class="${REGIONS.FOOTER}">
    v${escapeHtml(vm.version)}
  </div>
`;

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
    // The single-page card is always LAYOUTS.MAIN today, but the
    // factory is structured so additional views can be added by
    // switching on `vm.view`.
    switch (vm.view) {
      case LAYOUTS.DETAIL:
      case LAYOUTS.SETTINGS:
        // Reserved for future expansion. Fall through to a minimal
        // placeholder so the card never renders an empty body.
        return `
        <ha-card>
          <div class="${REGIONS.CARD_WRAPPER}">
            ${buildHeader(vm)}
            <div class="${REGIONS.CONTENT}">
              <p>Coming soon.</p>
            </div>
            ${buildFooter(vm)}
          </div>
        </ha-card>
      `;
      case LAYOUTS.MAIN:
      default:
        return `
        <ha-card>
          <div class="${REGIONS.CARD_WRAPPER}">
            ${buildHeader(vm)}
            ${buildContent(vm)}
            ${buildFooter(vm)}
          </div>
        </ha-card>
      `;
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
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 16px 16px 8px 16px;
    border-bottom: 1px solid var(--divider-color, transparent);
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
      if (!root.querySelector('[data-card-host]')) {
        const host = document.createElement('div');
        host.setAttribute('data-card-host', '');
        // All interaction events delegate to the controller, which
        // knows how to translate them into a properly-shaped
        // `hass-action` event (with detail.config holding the user's
        // tap_action / hold_action / double_tap_action object).
        host.addEventListener('click', (ev) => {
          this._controller.handleClick(this, ev);
        });
        host.addEventListener('contextmenu', (ev) => {
          ev.preventDefault();
          this._controller.handleHold(this, ev);
        });
        host.addEventListener('dblclick', (ev) => {
          this._controller.handleDoubleClick(this, ev);
        });
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
