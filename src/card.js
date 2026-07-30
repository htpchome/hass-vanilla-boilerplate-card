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

import {
  CARD_DESCRIPTION,
  CARD_NAME,
  CARD_TYPE,
  DEFAULTS,
} from "./constants.js";
import { CardController } from "./controller.js";
// Importing dpad.js and readout.js for their side effects:
// they register the <dpad-control> and <dpad-readout> custom
// elements when these modules are loaded. The factory renders
// both elements into the detail view's content area; each
// module is a fully self-contained unit.
// Importing dpad.js and readout.js for their side effects:
// they register the <dpad-control> and <dpad-readout> custom
// elements when these modules are loaded. The factory renders
// the 4-way dpad view; dpad-8way.js registers the <dpad-8way-control>
// element used by the third (8-way) view.
import "./dpad.js";
import "./dpad-8way.js";
import "./circle-pad.js";
import "./readout.js";
import { buildCardHtml } from "./factory.js";
import { renderErrorMessage, warnOnce } from "./helpers.js";
import { Router } from "./router.js";
import { allStyles } from "./styles.js";

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

// Silence "unused import" warnings for utilities reserved for
// future expansion of the boilerplate.
void warnOnce;
