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

import {
  ACTIONS,
  CARD_VERSION,
  CONFIG_KEYS,
  DEFAULTS,
  ERROR_KEYS,
  REGIONS,
} from './constants.js';
import {
  assertValidConfig,
  fireHassAction,
  hasEntity,
  mergeDefaults,
  warnOnce,
} from './helpers.js';
import { Router } from './router.js';

/**
 * Controller — pure logic, no DOM. Created per-card-instance.
 */
export class CardController {
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

// Re-exports for convenience (so card.js has a single import path).
export { ACTIONS, CONFIG_KEYS, REGIONS };
