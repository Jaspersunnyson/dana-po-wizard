# Dana PO Wizard

This repository hosts the Dana Energy Purchase Order/Contract Wizard single‑page application.  It
provides an interactive interface for drafting purchase orders and contracts in Persian
(Farsi) with a right‑to‑left (RTL) layout.  Users can enter item details, attach
documents, define clauses, toggle dark mode, and export the final form as a Word
document using the included template under `template/po-noban.template.docx`.

## Features

* **RTL‑friendly UI** – Designed for Persian text with a dark/light mode switch.
* **Dynamic items table** – Add, edit, and remove line items without losing focus; totals
  update automatically.
* **Attachments and clauses** – Manage related documents and contract clauses directly
  within the wizard.
* **Template‑based export** – Generate a polished Word document based on the provided
  template file via docxtemplater.
* **State persistence** – Export and import JSON data to save and restore drafts.

## Structure

- **index.html** – The main application page containing all HTML, CSS, and JavaScript.
- **template/** – Contains `po-noban.template.docx`, the Word template used for
  generating the final document.

## Development

The application is a static HTML file.  To preview locally, serve the project folder
with any static file server (e.g. `python -m http.server`).  Open `index.html` in a
browser to use the wizard.
