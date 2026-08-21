# Design system

Primacy's interface is the **Nullthrone Design System**, dark mode.

```
styles.css              app chrome — composes tokens, declares no raw values
styles/tokens/*.css     vendored verbatim from the Nullthrone Design System
assets/fonts/*.woff2    the system's webfonts, vendored (no runtime downloads)
```

## The rules the chrome follows

- **Dark is the brand inverted, not a second palette.** `ink` and `paper` swap
  roles: ink becomes the light value, paper the warm near-black ground
  (`#17161A`). Brass (`#C89E4A`) is the single accent — state, never decoration.
- **Surfaces are opaque.** No blur, no glass, no transparency. Over a star field
  that is also the only way text stays readable.
- **Corners are square** (`--radius-0`), structure is 1px hairlines, and
  **elevation is shadow — never a lighter plane.**
- **Letterspaced caps** (Jost, `--track-caps`) are for structural labels: buttons,
  nav items, eyebrows. Body copy is Public Sans; numbers are JetBrains Mono.
- **Motion** is fades and small translates on one curve (`--ease`), at
  120 / 200 / 320 ms. No bounces.

`<html data-theme="dark">` in `index.html` pins the theme, so the app looks the
same whatever the OS prefers. The token files still carry the light palette
verbatim — they are copied unmodified so they can be re-synced — but nothing in
the app selects it.

## Layout

Panels offset themselves against the two fixed bars via `--topbar-h` and
`--timebar-h`. Those are **measured** at runtime by `src/ui/ChromeMetrics.js`
and written back onto `<html>`; the stylesheet only declares minimums
(`--topbar-min`, `--timebar-min`) for the first paint. A wrapped top bar or a
larger touch target therefore can never leave a panel offset against a stale
number.

Breakpoints: the top bar folds its system switch onto a second row at
≤ 1180px; the left tree yields and the encyclopedia becomes a bottom sheet at
≤ 720px; a phone in landscape (`max-height: 560px`) gets short bars and a side
panel again. `env(safe-area-inset-*)` is honoured throughout.

`tools/verify/milestones/m11-responsive.mjs` walks seven device viewports and
fails on any element whose content spills out of its box, leaves the viewport,
or collides with a bar. Run it with `npm run verify`.

## Re-syncing

Copy the design system's `tokens/*.css` over `styles/tokens/` — except
`fonts.css`, which is generated locally so the fonts load from the repo instead
of a CDN:

```bash
npm run fetch-fonts    # rewrites assets/fonts/ + styles/tokens/fonts.css
```
