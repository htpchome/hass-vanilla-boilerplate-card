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

import {
  CARD_DESCRIPTION,
  CARD_NAME,
  CARD_TYPE,
  DEFAULTS,
} from './constants.js';
import { CardController } from './controller.js';
import { buildCardHtml } from './factory.js';
import {
  fireHassAction,
  renderErrorMessage,
  warnOnce,
} from './helpers.js';
import { router } from './router.js';
import { allStyles } from './styles.js';

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
    const mod = await import('./editor.js');
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
      host.addEventListener('click', (ev) => {
        // Surface a tap event up to HA via the standard helper.
        fireHassAction(this, 'tap', { config: this._controller.config });
      });
      host.addEventListener('contextmenu', (ev) => {
        ev.preventDefault();
        fireHassAction(this, 'hold', { config: this._controller.config });
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

// Silence "unused import" warnings for utilities reserved for
// future expansion of the boilerplate.
void warnOnce;
