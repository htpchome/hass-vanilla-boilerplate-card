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

const SLICE_DEFS = Object.freeze([
  {
    action: CIRCLE_PAD_ACTIONS.RIGHT,
    label: "Right",
    wedgePath:
      "m 139.38408,44.790631 a 47.849998,47.849998 0 0 1 0,44.189339 L 96.940613,66.8853 Z",
    chevronPath: "M 131.0 64.88 L 133.0 66.88 L 131.0 68.88",
  },
  {
    action: CIRCLE_PAD_ACTIONS.DOWN_RIGHT,
    label: "Down-right",
    wedgePath:
      "m 139.38408,88.97997 a 47.849998,47.849998 0 0 1 -20.3488,20.3488 L 96.940613,66.8853 Z",
    chevronPath: "M 116.5 88.5 L 118.5 88.5 L 118.5 86.5",
  },
  {
    action: CIRCLE_PAD_ACTIONS.DOWN,
    label: "Down",
    wedgePath:
      "m 119.03528,109.32877 a 47.849998,47.849998 0 0 1 -44.189339,0 L 96.940613,66.8853 Z",
    chevronPath: "M 98.94 103.5 L 96.94 105.5 L 94.94 103.5",
  },
  {
    action: CIRCLE_PAD_ACTIONS.UP_RIGHT,
    label: "Up-right",
    wedgePath:
      "m 119.03528,24.441832 a 47.849998,47.849998 0 0 1 20.3488,20.348799 L 96.940613,66.8853 Z",
    chevronPath: "M 116.5 45.26 L 118.5 45.26 L 118.5 47.26",
  },
  {
    action: CIRCLE_PAD_ACTIONS.UP,
    label: "Up",
    wedgePath:
      "m 74.845941,24.441833 a 47.849998,47.849998 0 0 1 44.189339,-10e-7 L 96.940613,66.8853 Z",
    chevronPath: "M 94.94 30.26 L 96.94 28.26 L 98.94 30.26",
  },
  {
    action: CIRCLE_PAD_ACTIONS.UP_LEFT,
    label: "Up-left",
    wedgePath:
      "M 54.497146,44.790629 A 47.849998,47.849998 0 0 1 74.845941,24.441833 L 96.940613,66.8853 Z",
    chevronPath: "M 77.38 45.26 L 75.38 45.26 L 75.38 47.26",
  },
  {
    action: CIRCLE_PAD_ACTIONS.DOWN_LEFT,
    label: "Down-left",
    wedgePath:
      "M 74.845941,109.32877 A 47.849998,47.849998 0 0 1 54.497146,88.979971 L 96.940613,66.8853 Z",
    chevronPath: "M 77.38 88.5 L 75.38 88.5 L 75.38 86.5",
  },
  {
    action: CIRCLE_PAD_ACTIONS.LEFT,
    label: "Left",
    wedgePath:
      "m 54.497146,88.979971 a 47.849998,47.849998 0 0 1 0,-44.189342 L 96.940613,66.8853 Z",
    chevronPath: "M 62.88 68.88 L 60.88 66.88 L 62.88 64.88",
  },
]);

const renderSliceButtons = () =>
  SLICE_DEFS.map(
    (slice) =>
      '<g class="wheel-button slice-button" role="button" tabindex="0" aria-label="' +
      slice.label +
      '" ' +
      CIRCLE_PAD_DATA_ACTION +
      '="' +
      slice.action +
      '">' +
      '<path d="' +
      slice.wedgePath +
      '"></path>' +
      '<path class="slice-chevron" d="' +
      slice.chevronPath +
      '" fill="none" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round"></path>' +
      "</g>",
  ).join("");

const DEFAULT_OPTIONS = Object.freeze({
  minHeight: 220,
  pressInMs: 70,
  releaseMs: 140,
});

const normalizeOptions = (nextOptions = {}, baseOptions = DEFAULT_OPTIONS) => {
  const normalized = { ...baseOptions };

  if (
    Object.prototype.hasOwnProperty.call(nextOptions, "minHeight") &&
    Number.isFinite(nextOptions.minHeight) &&
    nextOptions.minHeight > 0
  ) {
    normalized.minHeight = Math.round(nextOptions.minHeight);
  }

  if (
    Object.prototype.hasOwnProperty.call(nextOptions, "pressInMs") &&
    Number.isFinite(nextOptions.pressInMs) &&
    nextOptions.pressInMs >= 0
  ) {
    normalized.pressInMs = Math.round(nextOptions.pressInMs);
  }

  if (
    Object.prototype.hasOwnProperty.call(nextOptions, "releaseMs") &&
    Number.isFinite(nextOptions.releaseMs) &&
    nextOptions.releaseMs >= 0
  ) {
    normalized.releaseMs = Math.round(nextOptions.releaseMs);
  }

  return normalized;
};

const buildCirclePadStyles = ({ minHeight, pressInMs, releaseMs }) => `
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
    min-height: ${minHeight}px;
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

  .slice-button path {
    fill: var(--circle-pad-bg-1);
    /* Default (release) fade-out speed */
    transition: fill ${releaseMs}ms ease-out;
  }

  @media (hover: hover) {
    .${CIRCLE_PAD_CLASS}:not([data-input-mode="touch"]) .slice-button.is-hovered path {
      fill: var(--circle-pad-primary);
    }
  }

  .slice-button.is-pressed path {
    fill: var(--circle-pad-dark-primary);
    /* Faster press-in so taps feel immediate */
    transition-duration: ${pressInMs}ms;
    transition-timing-function: ease-in;
  }

  .slice-chevron {
    stroke: #555555;
    /* Default (release) fade-out speed */
    transition: stroke ${releaseMs}ms ease-out;
  }

  
  .slice-chevron.is-hovered {
    stroke: #ffffff !important;
  }

  .slice-chevron.is-pressed {
    /* Faster press-in so taps feel immediate */
    transition-duration: ${pressInMs}ms;
    transition-timing-function: ease-in;
  }

  /* Touch safety override: some mobile browsers leave pseudo
     hover/active artifacts. Force base visuals unless JS marks
     the slice as actively pressed. */
  .${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-button path {
    fill: var(--circle-pad-bg-1) !important;
  }

  .${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-button .slice-chevron {
    stroke: #555555 !important;
  }

  .${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-button.is-pressed path {
    fill: var(--circle-pad-dark-primary) !important;
  }

  .${CIRCLE_PAD_CLASS}[data-input-mode="touch"] .slice-chevron.is-pressed {
    stroke: #ffffff !important;
  }

  .center-button #path9 {
    fill: #bababa;
  }

  .center-button #circle9 {
    fill: url(#dome-gradient);
  }

  .center-button.is-active #circle9 {
    fill: url(#dome-gradient-green);
  }

  .center-button.is-active #path9 {
    fill: var(--circle-pad-success);
  }

  .center-button {
    box-shadow:
      0 4px 8px rgba(0, 0, 0, 0.12),
      inset 0 2px 4px rgba(0, 0, 0, 0.15);
  }

  .center-button.is-active {
    filter: url(#green-glow-matrix);
  }

  /* Hover-only accent ring on desktop/trackpad without changing
     the mic's fill state. Toggle state remains class-driven. */
  @media (hover: hover) {
    .${CIRCLE_PAD_CLASS}:not([data-input-mode="touch"]) .center-button:hover {
      filter: url(#green-glow-matrix);
    }
  }

  .wheel-button:focus path,
  .wheel-button:focus circle {
    stroke: none;
  }

  .mic-icon path {
    fill: var(--circle-pad-text-2);
    transition: fill 0.2s ease;
  }

  .center-button.is-active .mic-icon path {
    fill: var(--circle-pad-text-1) !important;
  }

  .inner-shadow-overlay {
    fill: none;
    stroke: #000000;
    stroke-width: 2;
    opacity: 0.15;
    filter: url(#simple-blur);
  }

  .main-circle {
    filter: url(#outside-shadow);
  }
`;

const buildCirclePadSvg = () => `
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

        <filter id="outside-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0.2" dy="0.2" stdDeviation="2" flood-color="#333333" flood-opacity="0.25"></feDropShadow>
        </filter>
      </defs>

      <g id="main-circle" class="main-circle" transform="translate(-48.940613,-18.8853)">
        <circle style="fill:#646464;" id="circle2" cx="96.940613" cy="66.8853" r="47.85"></circle>
        ${renderSliceButtons()}
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
  #activeDirectionBtn = null;
  #activeDirectionAction = null;
  #activePointerId = null;
  #activeMic = false;
  #mounted = false;
  #eventsAbort = null;
  #rootEl = null;
  #styleEl = null;
  #options = { ...DEFAULT_OPTIONS };
  #lastPointerState = null;

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._mount();
    this._wireEvents();
  }

  disconnectedCallback() {
    this.#activeDirectionBtn = null;
    this.#activeDirectionAction = null;
    this.#activePointerId = null;
    if (this.#eventsAbort) {
      this.#eventsAbort.abort();
      this.#eventsAbort = null;
    }
  }

  setOptions(nextOptions = {}) {
    const merged = normalizeOptions(nextOptions, this.#options);
    const changed =
      merged.minHeight !== this.#options.minHeight ||
      merged.pressInMs !== this.#options.pressInMs ||
      merged.releaseMs !== this.#options.releaseMs;

    if (!changed) return;
    this.#options = merged;
    if (this.#styleEl) {
      this.#styleEl.textContent = buildCirclePadStyles(this.#options);
    }
  }

  getOptions() {
    return { ...this.#options };
  }

  setActive(action, active) {
    if (action !== CIRCLE_PAD_ACTIONS.MIC) return;
    this.#activeMic = Boolean(active);
    this._applyMicState();
  }

  getState() {
    return { mic: this.#activeMic };
  }

  _mount() {
    if (this.#mounted) return;
    this.#mounted = true;

    const style = document.createElement("style");
    style.textContent = buildCirclePadStyles(this.#options);
    this.#styleEl = style;

    const root = document.createElement("div");
    root.className = CIRCLE_PAD_CLASS;
    root.innerHTML = buildCirclePadSvg();
    this.#rootEl = root;

    this.shadowRoot.appendChild(style);
    this.shadowRoot.appendChild(root);
    this._applyMicState();
  }

  _wireEvents() {
    if (this.#eventsAbort || !this.shadowRoot) return;
    this.#eventsAbort = new AbortController();
    const listenerOpts = { signal: this.#eventsAbort.signal };

    const findBtn = (target) =>
      target instanceof Element
        ? target.closest("[" + CIRCLE_PAD_DATA_ACTION + "]")
        : null;

    const getChevron = (btn) => btn?.querySelector(".slice-chevron") ?? null;

    const setPressedVisual = (btn, pressed) => {
      if (!btn) return;
      btn.classList.toggle("is-pressed", pressed);
      getChevron(btn)?.classList.toggle("is-pressed", pressed);
    };

    const setHoveredVisual = (btn, hovered) => {
      if (!btn) return;
      btn.classList.toggle("is-hovered", hovered);
      getChevron(btn)?.classList.toggle("is-hovered", hovered);
    };

    const clearPressed = (btn) => {
      if (!btn) return;
      const isActive = btn === this.#activeDirectionBtn;
      setPressedVisual(btn, false);
      if (!isActive) return false;
      this.#activeDirectionBtn = null;
      this.#activeDirectionAction = null;
      this.#activePointerId = null;
      return true;
    };

    const clearHovered = (btn) => {
      if (!btn) return;
      setHoveredVisual(btn, false);
    };

    const clearAllPressed = (emitRelease = true) => {
      const action = this.#activeDirectionAction;
      const btn = this.#activeDirectionBtn;
      if (!btn && !action) {
        if (!this.shadowRoot) return;
        this.shadowRoot
          .querySelectorAll(".slice-button.is-pressed")
          .forEach((el) => setPressedVisual(el, false));
        return;
      }

      if (btn) {
        setPressedVisual(btn, false);
      }
      this.#activeDirectionBtn = null;
      this.#activeDirectionAction = null;
      this.#activePointerId = null;

      if (emitRelease && action) {
        this._dispatch(EVT_RELEASE, { action });
      }
    };

    const clearAllHovered = () => {
      if (!this.shadowRoot) return;
      this.shadowRoot
        .querySelectorAll(".slice-button.is-hovered")
        .forEach((el) => setHoveredVisual(el, false));
    };

    const syncHoveredFromPoint = (ev) => {
      if (!ev) {
        clearAllHovered();
        return;
      }
      if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
      if (
        !this.shadowRoot ||
        typeof this.shadowRoot.elementFromPoint !== "function"
      ) {
        clearAllHovered();
        return;
      }

      const hit = this.shadowRoot.elementFromPoint(ev.clientX, ev.clientY);
      const hoveredBtn = findBtn(hit);
      clearAllHovered();
      if (!hoveredBtn) return;

      const hoveredAction = hoveredBtn.getAttribute(CIRCLE_PAD_DATA_ACTION);
      if (!DIRECTION_ACTIONS.has(hoveredAction)) return;
      setHoveredVisual(hoveredBtn, true);
    };

    const syncHoveredFromLastPointer = () => {
      if (!this.#lastPointerState) {
        clearAllHovered();
        return;
      }
      syncHoveredFromPoint(this.#lastPointerState);
    };

    const rememberPointerState = (ev) => {
      if (!ev) return;
      if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
      this.#lastPointerState = {
        pointerType: ev.pointerType,
        clientX: ev.clientX,
        clientY: ev.clientY,
      };
    };

    const releaseByPointer = (ev) => {
      if (!ev || ev.pointerId === null || ev.pointerId === undefined) {
        return false;
      }
      if (ev.pointerId !== this.#activePointerId || !this.#activeDirectionBtn) {
        return false;
      }
      const action = this.#activeDirectionAction;
      const released = clearPressed(this.#activeDirectionBtn);
      if (released) {
        this._dispatch(EVT_RELEASE, { action });
      }
      syncHoveredFromPoint(ev);
      return true;
    };

    const pressDirection = (btn, pointerId) => {
      const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
      if (!DIRECTION_ACTIONS.has(action)) return;
      if (
        btn === this.#activeDirectionBtn &&
        action === this.#activeDirectionAction
      ) {
        this.#activePointerId = pointerId ?? null;
        return;
      }

      clearAllPressed(true);
      this.#activeDirectionBtn = btn;
      this.#activeDirectionAction = action;
      this.#activePointerId = pointerId ?? null;
      setPressedVisual(btn, true);
      this._dispatch(EVT_PRESS, { action });
    };

    this.shadowRoot.addEventListener(
      "pointerdown",
      (ev) => {
        rememberPointerState(ev);
        if (ev.pointerType === "touch") {
          this._setInputMode("touch");
          clearAllHovered();
        } else if (ev.pointerType === "mouse" || ev.pointerType === "pen") {
          this._setInputMode("mouse");
          if (
            this.#activeDirectionBtn &&
            this.#activePointerId !== null &&
            this.#activePointerId !== ev.pointerId
          ) {
            clearAllPressed(true);
          }
        }

        const btn = findBtn(ev.target);
        if (!btn) return;
        const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
        if (action === CIRCLE_PAD_ACTIONS.MIC) return;
        pressDirection(btn, ev.pointerId);
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
      },
      listenerOpts,
    );

    this.shadowRoot.addEventListener(
      "pointermove",
      (ev) => {
        if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
        rememberPointerState(ev);
        if (ev.buttons !== 0) return;

        if (this.#activeDirectionBtn) {
          // Safety net: if a release event was missed, recover immediately.
          clearAllPressed(true);
        }
        syncHoveredFromPoint(ev);
      },
      listenerOpts,
    );

    this.shadowRoot.addEventListener(
      "pointerover",
      (ev) => {
        if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
        rememberPointerState(ev);
        const btn = findBtn(ev.target);
        if (!btn) return;
        const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
        if (!DIRECTION_ACTIONS.has(action)) return;
        btn.classList.add("is-hovered");
        btn.querySelector(".slice-chevron")?.classList.add("is-hovered");
      },
      listenerOpts,
    );

    this.shadowRoot.addEventListener(
      "pointerout",
      (ev) => {
        if (ev.pointerType !== "mouse" && ev.pointerType !== "pen") return;
        rememberPointerState(ev);
        const btn = findBtn(ev.target);
        if (!btn) return;
        if (ev.relatedTarget && btn.contains(ev.relatedTarget)) return;
        clearHovered(btn);
      },
      listenerOpts,
    );

    const release = (ev) => {
      if (releaseByPointer(ev)) return;
      const btn = findBtn(ev.target);
      if (!btn) return;
      const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
      const released = clearPressed(btn);
      if (!released) return;
      this._dispatch(EVT_RELEASE, { action });
      syncHoveredFromPoint(ev);
    };
    this.shadowRoot.addEventListener("pointerup", release, listenerOpts);
    this.shadowRoot.addEventListener("pointercancel", release, listenerOpts);
    this.shadowRoot.addEventListener(
      "lostpointercapture",
      (ev) => {
        syncHoveredFromPoint(ev);
      },
      listenerOpts,
    );
    this.shadowRoot.addEventListener(
      "pointerleave",
      (ev) => {
        rememberPointerState(ev);
        clearAllPressed(true);
        clearAllHovered();
      },
      listenerOpts,
    );

    const hostWindow = this.ownerDocument?.defaultView;
    if (hostWindow) {
      hostWindow.addEventListener(
        "blur",
        () => {
          clearAllPressed(true);
          clearAllHovered();
        },
        listenerOpts,
      );
    }

    this.shadowRoot.addEventListener(
      "pointerleave",
      (ev) => {
        if (releaseByPointer(ev)) return;
        const btn = findBtn(ev.target);
        if (!btn) return;
        if (ev.relatedTarget && btn.contains(ev.relatedTarget)) return;
        const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
        const released = clearPressed(btn);
        if (!released) return;
        this._dispatch(EVT_RELEASE, { action });
      },
      listenerOpts,
    );

    this.shadowRoot.addEventListener(
      "keydown",
      (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const btn = findBtn(ev.target);
        if (!btn) return;
        const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
        if (action === CIRCLE_PAD_ACTIONS.MIC) return;
        ev.preventDefault();
        pressDirection(btn, null);
      },
      listenerOpts,
    );

    this.shadowRoot.addEventListener(
      "keyup",
      (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const btn = findBtn(ev.target);
        if (!btn) return;
        const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
        const released = clearPressed(btn);
        if (!released) return;
        this._dispatch(EVT_RELEASE, { action });
      },
      listenerOpts,
    );

    this.shadowRoot.addEventListener(
      "click",
      (ev) => {
        const btn = findBtn(ev.target);
        if (!btn) return;
        const action = btn.getAttribute(CIRCLE_PAD_DATA_ACTION);
        if (action !== CIRCLE_PAD_ACTIONS.MIC) {
          clearAllPressed(false);
          syncHoveredFromLastPointer();
          return;
        }
        this.#activeMic = !this.#activeMic;
        this._applyMicState();
        this._dispatch(EVT_TOGGLE, {
          action: CIRCLE_PAD_ACTIONS.MIC,
          active: this.#activeMic,
        });
      },
      listenerOpts,
    );
  }

  _applyMicState() {
    if (!this.shadowRoot) return;
    const mic = this.shadowRoot.querySelector(".center-button");
    if (!mic) return;
    mic.classList.toggle("is-active", this.#activeMic);
    mic.setAttribute("aria-pressed", String(this.#activeMic));
  }

  _setInputMode(mode) {
    if (!this.#rootEl) return;
    this.#rootEl.setAttribute("data-input-mode", mode);
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

export {
  CirclePadControl,
  CIRCLE_PAD_ACTIONS,
  EVT_PRESS,
  EVT_RELEASE,
  EVT_TOGGLE,
};
