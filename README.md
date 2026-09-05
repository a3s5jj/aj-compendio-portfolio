# AJ Compendio Portfolio Site

Personal portfolio for **Al John Compendio**, freelance automation engineer.

Plain HTML, CSS and JavaScript. No build step, no `npm install`, no framework. Every
animation is hand rolled, the same way the reference site does it.

## Run it

Double click `index.html`. That works for everything except the contact form, which needs
a real host.

For a proper local server:

```bash
npx serve .
```

## Layout

```
index.html      the whole page, all copy lives here
404.html        not-found page, Netlify serves it automatically
robots.txt      crawler rules + sitemap pointer
sitemap.xml     single URL, needs the real domain
css/tokens.css  palette, fonts, spacing, motion timings
css/main.css    layout and every section style
js/main.js      preloader, nav, clock, reveals, typewriter, canvas, counters, form
assets/         favicon, portrait, resume PDF + source, OG image + source
netlify.toml    security headers and caching
```

## Editing content

All copy lives in `index.html` as plain text. There is no CMS and no data file, so change
the words in place.

Section IDs match the nav: `#hero`, `#about`, `#work`, `#experience`, `#skills`,
`#education`, `#notes`, `#certs`, `#contact`.

### Changing colors

Almost everything comes from `css/tokens.css`: Deep Navy `#1D2545` and Slate Navy
`#2E3969` on a cool off-white ground (`#F5F7FA`), with white cards and `#12161C` /
`#55606F` / `#68707E` text. The muted grey and the success green are both pinned at the
4.5:1 AA floor for 11px labels: lighten either and axe-core starts failing.

The accent family works in three steps:

- `--accent` (`#1D2545`) for fills, borders and type at any size. It measures 14:1 on the
  background, so unlike the old dark build there is no separate token for small text
  (`--accent-text` is kept as an alias so existing rules keep working).
- `--accent-soft` (`#2E3969`) is the hover / active step. On a light ground this goes
  *lighter* than `--accent`, the opposite of what a dark theme wants.
- `--accent-glow` (`rgba(29,37,69,.09)`) is the chip and badge tint. It is deliberately
  too faint for a focus ring, which is why `--focus-ring` exists separately.

Four places carry color that a token edit will **not** reach, so change them together:

- `css/main.css` — the `rgba()` scrims on `.header.is-stuck`, the mobile `.nav` drawer,
  `.portrait__frame` and `.quote`, plus the portrait vignette on
  `.portrait.has-photo .portrait__frame::after`.
- `js/main.js` — two literals in `heroCanvas()` (`strokeStyle`, `fillStyle`) that paint
  the node field. They mirror `--accent` by hand.
- `index.html` — the `theme-color` meta, and `assets/favicon.svg`. Bump the `?v=` on the
  favicon link in both `index.html` and `404.html` or the 30-day asset cache in
  `netlify.toml` will keep serving the old one.
- `assets/og-source.html` and `assets/cv-source.html` — standalone copies of the palette.
  Both need re-rendering after an edit (see below).

### Changing the surfaces

Radii and the frosted-glass look are tokens in `css/tokens.css`:

- `--radius-card` (20px) for cards and panels, `--radius-nested` (12px) for a box that
  sits *inside* a card, `--radius-field` (14px) for form inputs, `--radius-pill` (999px)
  for buttons, chips and badges. `--radius` (2px) survives only on `.nav__link`, where
  nothing paints.
- `--glass-bg` is a translucent gradient, `--glass-flat` a translucent fill, and
  `--shadow-card` a four-layer soft shadow whose first layer is the white inset
  edge-light.

Three things to know before editing surfaces:

- **`backdrop-filter` is only on `.portrait__frame` and `.btn`.** It blurs what is behind
  an element, and the page is a flat colour everywhere except the hero, so on any other
  card it renders zero different pixels while still costing a composited layer. If you
  ever give the page a textured or image background, that is when to widen it.
- **Three grids use a `gap: 1px` + `background: var(--border)` hairline trick**
  (`.about__facts`, `.metrics`, `.pipe`). The container paints the dividers and
  the opaque children cover the rest. Round the *container* and give it `overflow: hidden`;
  rounding the children puts a dark notch at every corner intersection.
- **Every state shadow is composed, not standalone.** `.btn:hover`, `.project.is-open`,
  `.note:hover` and the input focus ring each start with the resting shadow and stack the
  state on top. Drop the first value and the card loses its lift exactly while you are
  interacting with it.

### Changing the rotating hero text

`ROLES` at the top of `js/main.js`.

## Swapping the photo and the resume

To replace the headshot, drop a new `assets/portrait.jpg` in. The script detects it,
swaps out the placeholder and switches the frame to photo mode on its own. Portrait or
square both work, the frame is 3:4 and crops from the centre.

If the file is ever missing, the hero falls back to a marked placeholder slot rather than
a broken image, and the Download Resume button falls back to "Resume on request".

### Regenerating the resume PDF

`assets/AJ-Compendio-CV.pdf` is rendered from `assets/cv-source.html`. That source is the
public copy of the resume: **no phone number**, and the employer shown as Independent. Edit
the HTML and re-render:

```bash
npx playwright pdf --format=A4 assets/cv-source.html assets/AJ-Compendio-CV.pdf
```

It is tuned to fit exactly one A4 page. If you add content, check the page count after
re-rendering.

### Regenerating the social card

`assets/og-image.png` is the link preview (1200x630). It is rendered from
`assets/og-source.html`, so to change it edit that file and screenshot it at exactly
1200 by 630. Any headless browser works, for example:

```bash
npx playwright screenshot --viewport-size=1200,630 assets/og-source.html assets/og-image.png
```

## Deploying to Netlify

### The live site

Deployed at **https://ajcompendio-portfolio.netlify.app/**, auto-deploying from the `main`
branch of `a3s5jj/aj-compendio-portfolio`. Push to `main` and Netlify rebuilds on its own.

That domain is hard-coded in four absolute URLs. If the site ever moves, change all three
files together or the share preview and canonical URL will point at the old address:

- `index.html` (canonical, `og:url`, `og:image`, and the JSON-LD block)
- `robots.txt`
- `sitemap.xml`

Two Netlify settings are **not** in this repo and have to be set in the dashboard:

- **Make public.** New Netlify sites are private by default and answer every request with a
  401 login redirect until you click *Make public* on the project overview.
- **Enable form detection.** Off by default. The contact form is inert without it, and it
  only takes effect on the *next* deploy after enabling, not retroactively. The deploy log
  says `Skipping form detection` when it is off.

**`og:image` has to be an absolute URL.** LinkedIn does not resolve relative paths, so a
relative one means your link previews render with no image at all. If you skip this step the
share card silently breaks.

Check it afterwards with the LinkedIn Post Inspector or the Facebook Sharing Debugger, both
of which force a re-scrape.

### Then

1. Drag the `portfolio_site` folder onto https://app.netlify.com/drop, or connect a repo
   and set the publish directory to the folder root. There is no build command.
2. The contact form uses Netlify Forms. It works automatically on deploy because the form
   carries `data-netlify="true"` and a `company` honeypot field. Submissions appear under
   **Forms** in the Netlify dashboard.
3. Set up form notifications so submissions land in your inbox, otherwise they only sit in
   the dashboard.

The form does nothing when opened from the filesystem. That is expected, and the page says
so rather than pretending it sent.

## Performance and accessibility notes

These were measured, not assumed. Worth knowing before changing them.

**The intro plays once per session.** The preloader is what gates Largest Contentful Paint.
Measured on localhost, LCP was 3160ms before and is now a median of 2128ms on a first visit
and 1164ms on repeat visits, both inside Google's 2500ms "good" threshold. The skip is a
`sessionStorage` flag (`aj_intro_seen`) in `js/main.js`. Lengthening `DURATION` there puts
the time straight back onto LCP.

**Only 5 font faces are loaded**, checked against computed styles rather than guessed: IBM
Plex Sans 400, JetBrains Mono 400 and 500, Space Grotesk 600 and 700. That is 74.5KB, down
from 97KB. If you add a bold or a light anywhere, add the weight to the Google Fonts URL in
`index.html` or the browser will fake it.

The pull quote in About is deliberately `font-weight: 600`. It was the only element wanting
Space Grotesk 400, and pinning it to 600 let us drop a whole font face.

**axe-core reports zero violations** (41 checks pass). If you restructure the project cards,
keep the `<h3 class="project__heading">` wrapper around each accordion button. That is the
WAI-ARIA Authoring Practices pattern and it is what keeps the heading order valid.

## Privacy decisions baked in

- **No phone number.** The site publishes email, LinkedIn, GitHub and Tableau only.
- **No home address.** The HUD strip shows Taguig city level coordinates, nothing finer.
- **Public numbers only.** Where the private build and the public export disagree, for
  example 65 nodes versus 78, the site quotes the public figure, so it never states
  something the sanitized export chose to withhold.

## Version control

This folder gets its own git repository. Run `git init` **inside** `portfolio_site/`, never
in the parent folder, which already holds other repositories.

`assets/portrait.jpg` and `assets/AJ-Compendio-CV.pdf` are deliberately tracked, not
ignored. Both ship with the site, and the PDF is the public-safe copy. Ignoring them would
deploy a broken download button and an empty portrait frame.
