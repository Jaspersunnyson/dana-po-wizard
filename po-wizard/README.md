# PO Wizard

This repository contains a minimal purchase order generator for right‑to‑left
Persian documents. It uses an HTML template populated with data via Mustache
and then exports the result to both PDF (via Playwright/Chromium) and DOCX
(via `html-to-docx`).

## Setup

1. Install the project dependencies:

   ```bash
   npm install
   # Playwright requires a one‑time browser download
   npx playwright install chromium
   ```

2. Replace the company logo:

   A 1×1 transparent placeholder is supplied at `assets/logo.png`. To use your
   own logo, drop a PNG or SVG file into `assets/` and name it `logo.png` or
   `logo.svg`. If both formats exist, the build script will prefer the SVG.

3. (Optional) Improve the typography:

   You can add your own Persian web fonts to `assets/fonts/` and adjust
   `templates/po.css` accordingly. See `assets/fonts/README.md` for
   guidance.

## Usage

To generate a PDF or DOCX using the sample data in `data/sample-po.json`:

```bash
npm run pdf   # produces output/po.pdf
npm run docx  # produces output/po.docx
```

To produce both formats at once:

```bash
npm run build
```

The generated documents will appear in the `output/` directory. When
integrating this into your own system, write your runtime data into a
JSON file matching the structure of `data/sample-po.json` and adapt
`scripts/render-po.mjs` to read it.

## RTL and Mixed Direction Notes

The template declares `dir="rtl"` on the `<html>` element so that the
layout flows from right to left. If you need to include Latin text (such
as IBANs, Incoterms or email addresses) within the Persian document, wrap
those segments in a span with the `.ltr` class. This forces left‑to‑right
ordering and resets bidirectional text behaviour:

```html
<span class="ltr">DDP Tehran</span>
```

The sample data uses Persian numerals. You can choose to convert numbers to
Persian digits before passing them into the template or simply use Latin
digits if preferred.

## Continuous Integration

You can automate PDF generation in your CI pipeline. For example, in GitHub
Actions you might add the following step:

```yaml
- name: Build purchase order PDF
  run: |
    npm ci
    npx playwright install chromium
    npm run pdf
  # The generated PDF can then be uploaded as an artifact
```

This builds the PDF on every push and makes it available for review.
