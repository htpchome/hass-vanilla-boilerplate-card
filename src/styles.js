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
export const baseStyles = `
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
export const cardStyles = `
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

// D-pad touchpad — used as the content body of the detail view.
// Neutral colors that adapt to the active theme; arrow buttons
// flash to --primary-color when held; the center mic toggle
// turns green when active.
export const dpadStyles = `
  .card-content--dpad {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
  }

  .dpad {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
    gap: 4px;
    width: 220px;
    height: 220px;
    max-width: 100%;
    aspect-ratio: 1 / 1;
  }

  .dpad__slot {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    min-height: 0;
  }

  /* D-pad button base — circular, neutral background */
  .dpad__btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    max-width: 64px;
    max-height: 64px;
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

  .dpad__btn:hover {
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.16));
  }

  .dpad__btn:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .dpad__btn ha-icon {
    --mdc-icon-size: 28px;
    pointer-events: none;
  }

  /* Direction modifiers shift each button into its grid cell */
  .dpad__btn--up    { grid-area: 1 / 2; }
  .dpad__btn--down  { grid-area: 3 / 2; }
  .dpad__btn--left  { grid-area: 2 / 1; }
  .dpad__btn--right { grid-area: 2 / 3; }
  .dpad__btn--mic   { grid-area: 2 / 2; max-width: 72px; max-height: 72px; }

  /* Momentary pressed state for arrow buttons */
  .dpad__btn.is-pressed {
    background: var(--primary-color);
    color: var(--card-background-color, #fff);
    border-color: var(--primary-color);
    transform: scale(0.95);
  }

  /* Mic toggle: when active, green background */
  .dpad__btn--mic.is-active {
    background: #4caf50;          /* fallback green */
    background: var(--ha-color-green, #4caf50);
    color: #fff;
    border-color: var(--ha-color-green, #4caf50);
  }

  /* Mic icon swap: hide default icon when active, show off icon */
  .dpad__btn--mic .dpad__icon--active { display: none; }
  .dpad__btn--mic.is-active .dpad__icon--default { display: none; }
  .dpad__btn--mic.is-active .dpad__icon--active  { display: inline-flex; }
`;

// Header nav arrow button — used to switch between internal views.
export const navStyles = `
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
export const statusStyles = `
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
export const editorStyles = `
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
export const allStyles = [
  baseStyles,
  cardStyles,
  navStyles,
  dpadStyles,
  statusStyles,
].join('\n');

export const allEditorStyles = [baseStyles, editorStyles, statusStyles].join('\n');
