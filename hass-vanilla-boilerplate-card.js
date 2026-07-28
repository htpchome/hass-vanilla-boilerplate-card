/*!
 * HASS Vanilla Boilerplate Card v0.1.0
 * ---------------------------------------------------------------
 * A production-ready vanilla JavaScript Home Assistant Lovelace
 * card. Bundled entry point served by HACS.
 *
 * Source modules (under /src):
 *   - constants.js
 *   - helpers.js
 *   - styles.js
 *   - icons.js
 *   - router.js
 *   - controller.js
 *   - factory.js
 *   - card.js
 *   - editor.js
 *
 * Build with:  npm run build
 * ---------------------------------------------------------------
 */
(function () {
  'use strict';

  // ============================================================
  // src/constants.js
  // ============================================================
  const CARD_VERSION = '0.1.0';
  const CARD_TYPE = 'hass-vanilla-boilerplate-card';
  const CARD_NAME = 'HASS Vanilla Boilerplate Card';
  const CARD_DESCRIPTION =
    'A production-ready vanilla JS Home Assistant Lovelace card boilerplate.';

  const CONFIG_KEYS = Object.freeze({
    TITLE: 'title',
    SUBTITLE: 'subtitle',
    CONTENT: 'content',
  });

  const DEFAULTS = Object.freeze({
    title: 'Vanilla Boilerplate',
    subtitle: 'A modular Home Assistant card',
    content: '<p>Hello, <strong>Home Assistant</strong>!</p>',
  });

  const ACTIONS = Object.freeze({
    HASS_ACTION: 'hass-action',
    CONFIG_CHANGED: 'config-changed',
    TAB_CHANGED: 'card-tab-changed',
  });

  const LAYOUTS = Object.freeze({
    MAIN: 'main',
    DETAIL: 'detail',
    SETTINGS: 'settings',
  });

  const REGIONS = Object.freeze({
    CARD_WRAPPER: 'card-wrapper',
    HEADER: 'card-header',
    TITLE: 'card-title',
    SUBTITLE: 'card-subtitle',
    CONTENT: 'card-content',
    FOOTER: 'card-footer',
  });

  const CLASS_NAMES = Object.freeze({ ...REGIONS });

  const ERROR_KEYS = Object.freeze({
    MISSING_CONFIG: 'missing_config',
    INVALID_CONFIG: 'invalid_config',
    MISSING_HASS: 'missing_hass',
  });

  // ============================================================
  // src/helpers.js
  // ============================================================
  const formatDateTime = (date = new Date(), locale = 'en-US') => {
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (_err) {
      return date.toISOString().replace('T', ' ').slice(0, 16);
    }
  };

  // Entity lookup table built from String.fromCharCode so the source
  // never needs to contain literal HTML entity sequences.
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

  const unsafeHTML = (html) => ({
    __html: typeof html === 'string' ? html : '',
    __unsafe: true,
  });

  const isValidConfig = (config) =>
    config !== null && typeof config === 'object' && !Array.isArray(config);

  const mergeDefaults = (config) => ({
    ...DEFAULTS,
    ...(isValidConfig(config) ? config : {}),
  });

  const hasEntity = (hass, entityId) =>
    Boolean(
      hass &&
        hass.states &&
        Object.prototype.hasOwnProperty.call(hass.states, entityId),
    );

  const getEntityState = (hass, entityId) => {
    if (!hasEntity(hass, entityId)) return null;
    return hass.states[entityId] || null;
  };

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

  const fireHassAction = (node, action, data = {}) => {
    fireEvent(node, 'hass-action', { action, data });
  };

  const fireConfigChanged = (node, config) => {
    fireEvent(node, 'config-changed', { config });
  };

  const renderErrorMessage = (message) => `
    <div class="error-message" role="alert">
      <ha-icon icon="mdi:alert-circle"></ha-icon>
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  const _warned = new Set();
  const warnOnce = (key, ...args) => {
    if (_warned.has(key)) return;
    _warned.add(key);
    // eslint-disable-next-line no-console
    console.warn(`[${CARD_TYPE}]`, ...args);
  };

  const assertValidConfig = (config) => {
    if (!isValidConfig(config)) {
      warnOnce(ERROR_KEYS.INVALID_CONFIG, 'Invalid card config received:', config);
      return false;
    }
    return true;
  };

  const debounce = (fn, wait = 150) => {
    let timer = null;
    return (...args) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const clone = (obj) => {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.slice();
    return { ...obj };
  };

  // ============================================================
  // src/styles.js
  // ============================================================
  const baseStyles = `
    :host {
      display: block;
      font-family: var(--ha-font-family, Roboto, 'Helvetica Neue', sans-serif);
      font-size: 14px;
      line-height: 1.4;
      color: var(--primary-text-color);
      box-sizing: border-box;
    }
    *, *::before, *::after { box-sizing: inherit; }
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

  const cardStyles = `
    .card-wrapper { display: flex; flex-direction: column; width: 100%; }
    .card-header {
      display: flex; flex-direction: column; gap: 4px;
      padding: 16px 16px 8px 16px;
      border-bottom: 1px solid var(--divider-color, transparent);
    }
    .card-title { margin: 0; font-size: 1.25rem; font-weight: 500; color: var(--primary-text-color); line-height: 1.2; }
    .card-subtitle { margin: 0; font-size: 0.875rem; color: var(--secondary-text-color); line-height: 1.3; }
    .card-content { padding: 16px; color: var(--primary-text-color); }
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

  const statusStyles = `
    .error-message {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      color: var(--error-color, #b71c1c);
      background: var(--ha-card-background, var(--card-background-color));
      border: 1px solid var(--error-color, #b71c1c);
      border-radius: var(--ha-card-border-radius, 12px);
      font-size: 0.875rem;
    }
    .error-message ha-icon { --mdc-icon-size: 20px; color: var(--error-color, #b71c1c); }
  `;

  const editorStyles = `
    :host { display: block; padding: 12px 0; }
    .editor-row { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
    .editor-row label { font-size: 0.875rem; color: var(--secondary-text-color); font-weight: 500; }
    .editor-row ha-input,
    .editor-row ha-textarea {
      width: 100%;
      --mdc-theme-primary: var(--primary-color);
      --mdc-text-field-fill-color: var(--card-background-color);
      --mdc-text-field-ink-color: var(--primary-text-color);
      --mdc-text-field-label-ink-color: var(--secondary-text-color);
    }
    .editor-help { margin-top: -8px; margin-bottom: 16px; font-size: 0.75rem; color: var(--secondary-text-color); }
  `;

  const allStyles = [baseStyles, cardStyles, statusStyles].join('\n');
  const allEditorStyles = [baseStyles, editorStyles, statusStyles].join('\n');

  // ============================================================
  // src/icons.js
  // ============================================================
  const ICON_NAMES = Object.freeze({
    CARD: 'mdi:card-outline',
    EDIT: 'mdi:pencil',
    ALERT: 'mdi:alert-circle',
    CHECK: 'mdi:check-circle',
    HOME: 'mdi:home',
    SETTINGS: 'mdi:cog',
    REFRESH: 'mdi:refresh',
  });

  const SVG_PATHS = Object.freeze({
    [ICON_NAMES.CARD]: 'M2 4h20v16H2z M4 8h16 M4 12h16 M4 16h10',
    [ICON_NAMES.ALERT]: 'M12 2 L22 20 L2 20 Z M12 9v5 M12 17h.01',
    [ICON_NAMES.CHECK]: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z M7 12l3 3 7-7',
  });

  const getIcon = (key) => ICON_NAMES[key];
  const getIconPath = (key) => SVG_PATHS[key];
  const renderIcon = (key, opts = {}) => {
    const name = getIcon(key);
    if (!name) return '';
    const cls = opts.className ? ' class="' + opts.className + '"' : '';
    return '<ha-icon icon="' + name + '"' + cls + '></ha-icon>';
  };

  // ============================================================
  // src/router.js
  // ============================================================
  const _routerSubscribe = (event, fn) => {
    document.addEventListener(event, (e) => fn(e.detail));
    return () => document.removeEventListener(event, fn);
  };
  const _routerEmit = (event, detail) => {
    document.dispatchEvent(new CustomEvent(event, { detail }));
  };

  class Router {
    constructor(initial = LAYOUTS.MAIN) {
      this._current = initial;
      this._history = [initial];
    }
    get current() { return this._current; }
    get history() { return this._history.slice(); }
    navigate(id, payload = null) {
      if (!Object.values(LAYOUTS).includes(id)) {
        // eslint-disable-next-line no-console
        console.warn('[router] navigate() ignored unknown view: ' + id);
        return false;
      }
      if (id === this._current) return false;
      this._current = id;
      this._history.push(id);
      if (this._history.length > 20) this._history.shift();
      _routerEmit('card-view-changed', { view: id, payload });
      return true;
    }
    back() {
      if (this._history.length <= 1) return false;
      this._history.pop();
      const previous = this._history[this._history.length - 1];
      this._current = previous;
      _routerEmit('card-view-changed', { view: previous, payload: null });
      return true;
    }
    onViewChange(fn) {
      return _routerSubscribe('card-view-changed', fn);
    }
  }

  const router = new Router(LAYOUTS.MAIN);

  // ============================================================
  // src/controller.js
  // ============================================================
  class CardController {
    constructor() {
      this._config = mergeDefaults(null);
      this._hass = null;
      this._listeners = new Set();
    }
    subscribe(fn) {
      this._listeners.add(fn);
      return () => this._listeners.delete(fn);
    }
    _notify() {
      this._listeners.forEach((fn) => {
        try { fn(); }
        catch (err) {
          // eslint-disable-next-line no-console
          console.error('[controller] listener threw', err);
        }
      });
    }
    get config() { return this._config; }
    get hass() { return this._hass; }
    get currentView() { return router.current; }
    get version() { return CARD_VERSION; }

    setConfig(config) {
      if (!assertValidConfig(config)) {
        this._config = mergeDefaults(null);
        this._notify();
        return;
      }
      this._config = mergeDefaults(config);
      this._notify();
    }

    setHass(hass) {
      if (!hass || typeof hass !== 'object') {
        warnOnce(ERROR_KEYS.MISSING_HASS, 'No hass object provided to card');
        return;
      }
      this._hass = hass;
      this._notify();
    }

    getViewModel() {
      const { title, subtitle, content } = this._config;
      return Object.freeze({
        title, subtitle, content,
        version: this.version,
        view: this.currentView,
        hasHass: this._hass !== null,
      });
    }

    handleClick(node, ev) {
      fireHassAction(node, 'tap', { config: this._config });
    }
    handleHold(node, ev) {
      fireHassAction(node, 'hold', { config: this._config });
    }

    readEntity(entityId) {
      if (!this._hass) return null;
      if (!hasEntity(this._hass, entityId)) {
        warnOnce('missing-entity:' + entityId, 'Entity not found in hass.states: ' + entityId);
        return null;
      }
      return this._hass.states[entityId] || null;
    }

    static getStubConfig() {
      return { ...DEFAULTS };
    }
  }

  // ============================================================
  // src/factory.js
  // ============================================================
  const buildHeader = (vm) => {
    const hasTitle = Boolean(vm.title);
    const hasSubtitle = Boolean(vm.subtitle);
    if (!hasTitle && !hasSubtitle) return '';
    return (
      '<div class="' + REGIONS.HEADER + '">' +
      (hasTitle ? '<h2 class="' + REGIONS.TITLE + '">' + escapeHtml(vm.title) + '</h2>' : '') +
      (hasSubtitle ? '<p class="' + REGIONS.SUBTITLE + '">' + escapeHtml(vm.subtitle) + '</p>' : '') +
      '</div>'
    );
  };

  const buildContent = (vm) => {
    const html = typeof vm.content === 'string' ? vm.content : '';
    return (
      '<div class="' + REGIONS.CONTENT + '">' +
      html +
      '</div>'
    );
  };

  const buildFooter = (vm) =>
    '<div class="' + REGIONS.FOOTER + '">v' + escapeHtml(vm.version) + '</div>';

  const buildStatusPill = (label, value, tone = 'ok') =>
    '<span class="status-pill status-pill--' + escapeHtml(tone) + '">' +
      '<span class="status-pill__label">' + escapeHtml(label) + '</span>' +
      '<span class="status-pill__value">' + escapeHtml(value) + '</span>' +
    '</span>';

  const buildCardHtml = (vm) => {
    switch (vm.view) {
      case LAYOUTS.DETAIL:
      case LAYOUTS.SETTINGS:
        return (
          '<ha-card>' +
            '<div class="' + REGIONS.CARD_WRAPPER + '">' +
              buildHeader(vm) +
              '<div class="' + REGIONS.CONTENT + '"><p>Coming soon.</p></div>' +
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

  // ============================================================
  // src/card.js
  // ============================================================
  class HassVanillaBoilerplateCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._controller = new CardController();
      this._renderScheduled = false;
      this._unsubRouter = null;
      this._unsubController = null;
    }

    connectedCallback() {
      this._mount();
      this._unsubController = this._controller.subscribe(() => this._scheduleRender());
      this._unsubRouter = router.onViewChange(() => this._scheduleRender());
      this._scheduleRender();
    }

    disconnectedCallback() {
      if (this._unsubController) { this._unsubController(); this._unsubController = null; }
      if (this._unsubRouter) { this._unsubRouter(); this._unsubRouter = null; }
    }

    setConfig(config) {
      this._controller.setConfig(config);
    }

    set hass(hass) {
      this._controller.setHass(hass);
    }

    getCardSize() { return 2; }

    async getPreviewCard() {
      if (!this._controller.config || Object.keys(this._controller.config).length === 0) {
        this._controller.setConfig(Object.assign({}, DEFAULTS));
      }
      this._render();
      return this;
    }

    static getStubConfig() {
      return CardController.getStubConfig();
    }

    static getConfigElement() {
      const el = document.createElement('hass-vanilla-boilerplate-card-editor');
      if (typeof el._init === 'function') el._init();
      return Promise.resolve(el);
    }

    _mount() {
      const root = this.shadowRoot;
      if (!root) return;

      if (!root.querySelector('style[data-card-styles]')) {
        const style = document.createElement('style');
        style.setAttribute('data-card-styles', '');
        style.textContent = allStyles;
        root.appendChild(style);
      }

      if (!root.querySelector('[data-card-host]')) {
        const host = document.createElement('div');
        host.setAttribute('data-card-host', '');
        host.addEventListener('click', () => {
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
        console.error('[' + CARD_TYPE + '] render failed', err);
        host.innerHTML = renderErrorMessage('Render error: ' + String((err && err.message) || err));
      }
    }
  }

  // ============================================================
  // src/editor.js
  // ============================================================
  class HassVanillaBoilerplateCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = Object.assign({}, DEFAULTS);
      this._initialized = false;
      this._emitConfigChanged = debounce(this._emitConfigChanged.bind(this), 200);
    }

    connectedCallback() {
      if (!this._initialized) this._init();
    }

    _init() {
      if (this._initialized) return;
      this._initialized = true;
      const root = this.shadowRoot;
      if (!root) return;

      const style = document.createElement('style');
      style.setAttribute('data-editor-styles', '');
      style.textContent = allEditorStyles;
      root.appendChild(style);

      const form = document.createElement('div');
      form.setAttribute('data-editor-form', '');
      form.innerHTML =
        '<div class="editor-row">' +
          '<label for="cfg-title">Title</label>' +
          '<ha-input id="cfg-title" name="title" label="Title"></ha-input>' +
        '</div>' +
        '<div class="editor-row">' +
          '<label for="cfg-subtitle">Subtitle</label>' +
          '<ha-input id="cfg-subtitle" name="subtitle" label="Subtitle"></ha-input>' +
        '</div>' +
        '<div class="editor-row">' +
          '<label for="cfg-content">Content (HTML markup)</label>' +
          '<ha-textarea id="cfg-content" name="content" label="Content" autogrow></ha-textarea>' +
        '</div>' +
        '<p class="editor-help">The Content field accepts HTML markup. The card renders it inside its shadow DOM, so your styles are isolated from the dashboard.</p>';
      root.appendChild(form);

      this._bindInput('cfg-title', 'title');
      this._bindInput('cfg-subtitle', 'subtitle');
      this._bindInput('cfg-content', 'content');

      this._syncFromConfig();
    }

    setConfig(config) {
      this._config = Object.assign({}, DEFAULTS, config || {});
      if (this._initialized) this._syncFromConfig();
    }

    _bindInput(elementId, key) {
      const el = this.shadowRoot && this.shadowRoot.getElementById(elementId);
      if (!el) return;
      el.addEventListener('input', (ev) => {
        this._config = Object.assign({}, this._config, (function () {
          const o = {}; o[key] = ev.target.value; return o;
        })());
        this._emitConfigChanged();
      });
      el.addEventListener('change', (ev) => {
        this._config = Object.assign({}, this._config, (function () {
          const o = {}; o[key] = ev.target.value; return o;
        })());
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
      fireConfigChanged(this, Object.assign({}, this._config));
    }
  }

  // ============================================================
  // Registration
  // ============================================================
  if (!customElements.get('hass-vanilla-boilerplate-card')) {
    customElements.define('hass-vanilla-boilerplate-card', HassVanillaBoilerplateCard);
  }

  if (!customElements.get('hass-vanilla-boilerplate-card-editor')) {
    customElements.define('hass-vanilla-boilerplate-card-editor', HassVanillaBoilerplateCardEditor);
  }

  if (typeof window !== 'undefined') {
    window.customCards = window.customCards || [];
    if (!window.customCards.some((c) => c && c.type === CARD_TYPE)) {
      window.customCards.push({
        type: CARD_TYPE,
        name: CARD_NAME,
        description: CARD_DESCRIPTION,
        preview: true,
      });
    }
  }

  if (typeof window !== 'undefined' && !window.__HASS_VANILLA_BOOTSTRAP_LOGGED__) {
    window.__HASS_VANILLA_BOOTSTRAP_LOGGED__ = true;
    // eslint-disable-next-line no-console
    console.info(
      '%c[' + CARD_TYPE + ']',
      'color: #03a9f4; font-weight: bold;',
      CARD_NAME + ' registered.'
    );
  }
})();
