# HASS Vanilla Boilerplate Card

A production-ready **vanilla JavaScript** Home Assistant Lovelace card
boilerplate. No frameworks — just modern ES6 classes, Shadow DOM, and
custom elements. Use this as a clean starting point for building your
own HACS-installable custom card.

## Features

- **100% vanilla JS** (ES6 modules, no Lit, no React, no runtime deps)
- **Shadow DOM** style isolation
- **Native HA design tokens** for automatic theme synchronization
  (light, dark, and any user-defined theme)
- **Modular `/src` layout** with clean separation of concerns
- **Visual editor** with `<ha-input>` / `<ha-textarea>` controls
- **Registered with `window.customCards`** so it appears in the HA
  card picker
- **Standard Lovelace lifecycle** (`setConfig`, `set hass`, `fireEvent`)

## Project Structure

```
hass-vanilla-boilerplate-card/
├── hacs.json                                  # HACS metadata
├── README.md                                  # This file
├── package.json                               # Dev tooling
├── rollup.config.js                           # Bundler config
├── hass-vanilla-boilerplate-card.js           # Built bundle (HACS entry point)
└── src/
    ├── card.js                                # Main custom element
    ├── editor.js                              # Visual editor element
    ├── controller.js                          # Business logic
    ├── factory.js                             # HTML rendering
    ├── router.js                              # Internal view router
    ├── styles.js                              # CSS template literals
    ├── icons.js                               # MDI icon dictionary
    ├── helpers.js                             # Common utilities
    └── constants.js                           # Static keys & defaults
```

## Module Responsibilities

| Module         | Responsibility                                                                 |
| -------------- | ------------------------------------------------------------------------------ |
| `constants.js` | Centralized config keys, defaults, action names, layout types.                 |
| `helpers.js`   | `escapeHtml`, `fireEvent`, `hasEntity`, `formatDateTime`, `debounce`, etc.     |
| `styles.js`    | CSS template literals that reference only HA design tokens.                     |
| `icons.js`     | MDI icon name dictionary + `<ha-icon>` render helper.                          |
| `router.js`    | Lightweight pub/sub router for switching between internal views.                |
| `controller.js`| Pure logic. No DOM. Exposes `setConfig`, `setHass`, `getViewModel`, handlers. |
| `factory.js`   | Pure functions that turn a view-model into HTML.                               |
| `card.js`      | The custom element. Owns the controller, the factory, the shadow root.        |
| `editor.js`    | The visual editor custom element. Dispatches `config-changed` on every edit.   |

## Installation (HACS — recommended)

1. Add this repository as a **Custom Repository** in HACS.
2. Install **HASS Vanilla Boilerplate Card**.
3. Reload your browser.
4. In your dashboard, click **+ Add Card** and search for
   "HASS Vanilla Boilerplate Card".

## Manual Installation

1. Download `hass-vanilla-boilerplate-card.js` from the latest release.
2. Copy it into your `config/www/` directory.
3. Add the following to your Lovelace **Resources**:

   ```yaml
   resources:
     - url: /local/hass-vanilla-boilerplate-card.js
       type: module
   ```

4. Reload your browser and add the card from the picker.

## Card Configuration

```yaml
type: hass-vanilla-boilerplate-card
title: My Card
subtitle: A subtitle goes here
content: |
  <p>Hello, <strong>Home Assistant</strong>!</p>
  <p>You can use any HTML markup here.</p>
```

| Option    | Type   | Required | Default                                 | Description                              |
| --------- | ------ | -------- | --------------------------------------- | ---------------------------------------- |
| `type`    | string | yes      | `hass-vanilla-boilerplate-card`         | Card type identifier.                    |
| `title`   | string | no       | `Vanilla Boilerplate`                   | Card title (rendered in the header).     |
| `subtitle`| string | no       | `A modular Home Assistant card`         | Card subtitle (rendered under title).    |
| `content` | string | no       | `Hello, Home Assistant!` example HTML   | HTML markup for the card body.           |

## Tap Action

By default the card is a content display and does **not** dispatch any
action events when clicked. To enable a click action, set `tap_action`
exactly like any built-in card:

```yaml
type: hass-vanilla-boilerplate-card
title: Weather
content: "<p>Tap me!</p>"
tap_action:
  action: navigate
  navigation_path: /lovelace/weather
```

You can also set `hold_action` and `double_tap_action` for richer
interactions.

## Development

```bash
# Install dev dependencies
npm install

# Build the bundle once
npm run build

# Build and watch for changes
npm run build:watch

# Lint
npm run lint

# Run tests
npm test
```

The output is written to `hass-vanilla-boilerplate-card.js` at the
repo root. That's the file HACS serves.

## Theming

Every visual token in `src/styles.js` references HA design variables
like `--primary-text-color`, `--ha-card-background`, and
`--ha-card-border-radius`. You do **not** need to define any custom
colors — your card automatically adopts the active theme.

## Releasing (HACS)

This project ships a release script that produces a clean zip
containing only the files HACS needs to install:

  - `hass-vanilla-boilerplate-card.js` — the bundle
  - `hacs.json` — HACS metadata

Dev-only files (`rollup.config.js`, `src/`, `package.json`,
`node_modules/`, `.github/`, `*.map`, etc.) are excluded so the
end user's `config/www/community/hass-vanilla-boilerplate-card/`
directory stays clean and small.

### One-shot build

```bash
npm run build                       # produces hass-vanilla-boilerplate-card.js
node scripts/make-release-zip.js     # -> dist/hass-vanilla-boilerplate-card.zip
```

### Combined build + zip

```bash
npm run release
# -> dist/hass-vanilla-boilerplate-card.zip
```

### GitHub Actions

The workflow at `.github/workflows/release.yml` runs automatically
whenever you push a tag matching `v*` (e.g. `v0.1.0`):

1. Installs dependencies
2. Runs `npm run build` to produce the bundle
3. Runs `node scripts/make-release-zip.js` to produce the clean zip
4. Creates a GitHub release and attaches the zip

HACS prefers release-asset zips over default-branch downloads
whenever a release with an asset exists, so this is what makes
the user-facing installation clean.

### Cutting a release

```bash
# Bump the version in package.json, then:
git tag v0.1.0
git push origin v0.1.0
# -> GitHub Actions runs the workflow and attaches the zip
```

## License

MIT
