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

import { CONFIG_KEYS, DEFAULTS } from './constants.js';
import { debounce, fireConfigChanged } from './helpers.js';
import { allEditorStyles } from './styles.js';

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
