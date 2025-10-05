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
* **Per‑user history** – When authenticated, users can save each draft purchase order to their personal
  history.  Only the creator sees their own drafts unless they explicitly share them for review.
* **Review workflow & notifications** – Drafts can be sent to other registered users for review.  The
  reviewer receives an in‑app notification, can open the draft, and mark it as “approved” or
  “needs changes”.  The owner is notified of the outcome, and status changes (pending, in review,
  changes requested, approved, finalized, canceled) are tracked automatically.
* **Access control** – All PO records and associated files are protected by row‑level security when
  using Supabase or Firebase.  In the local storage fallback, only the current browser session
  can read its own saved drafts.
* **Optional backend integration** – By providing `SUPABASE_URL` and `SUPABASE_KEY` (or configuring
  Firebase), the wizard will use a cloud backend for authentication, data storage, and file
  attachments.  Without these variables it falls back to local storage, still offering
  basic functionality.

## Structure

- **index.html** – The main application page containing all HTML, CSS, and JavaScript.
- **template/** – Contains `po-noban.template.docx`, the Word template used for
  generating the final document.  The template uses mustache tags and loops to merge
  data from the wizard (items, attachments, delivery documents, supplier signatories,
  etc.).  See “Template considerations” below for details.

## Development

The application is a static HTML file.  To preview locally, serve the project folder
with any static file server (e.g. `python -m http.server`).  Open `index.html` in a
browser to use the wizard.

## Backend & Authentication

The wizard works out‑of‑the‑box without any backend by storing data in
`localStorage` and `sessionStorage`.  However, to enable multi‑user history,
access control, notifications, and file uploads, you can configure a
backend such as **Supabase** or **Firebase**.  At runtime the script looks for
global variables `SUPABASE_URL` and `SUPABASE_KEY` on `window` to determine if
Supabase should be used.  If they are present, the following features become
available:

- **Email/password authentication** – Sign up and sign in users.  Users are
  persisted via Supabase Auth.  OAuth providers can be added easily via the
  Supabase dashboard.
- **Row‑level security** – The `po_records` and `notifications` tables use
  policies so that users can only read their own records or records they’ve
  been assigned to review.
- **File storage** – Generated Word documents are uploaded to the
  `po-files` storage bucket under a folder named after the record ID.
- **Notifications** – A `notifications` table stores review requests and
  feedback.  A bell icon in the UI shows unread notifications.

To enable these features:

1. Create a Supabase project and add tables `po_records` and
   `notifications` with the columns described in `api.js` (see code for
   details).  Enable RLS and create policies so that a row is visible if
   `owner_uid = auth.uid()` or the current user’s ID appears in the
   `assignees` array.
2. Create a storage bucket called `po-files` with public access disabled.
3. Expose your project’s URL and anon API key as global variables in the
   HTML, for example:

   ```html
   <script>
     window.SUPABASE_URL = 'https://xyzcompany.supabase.co';
     window.SUPABASE_KEY = 'public-anon-key-goes-here';
   </script>
   ```

4. Serve `index.html` from a secure origin (GitHub Pages works fine).  When
   visiting the site, users will be prompted to sign up or sign in.  If no
   Supabase variables are defined, the wizard silently falls back to local
   storage and history/notifications are only available to that browser.

If you prefer Firebase, you can swap the Supabase client calls in
`api.js` with equivalent Firebase Auth, Firestore, and Storage calls.  The
API abstraction layer has been kept small to make this switch simple.

## Template considerations

The default template (`template/po-noban.template.docx`) has been cleaned
to avoid conditional blocks that break easily.  Instead of complex
Mustache conditionals, the wizard computes plain‑text fields such as
`leadtimeTriggerText` and `fxSettlementText` which the template inserts
directly.  If you edit the template, ensure that:

- Each Mustache tag (`{{placeholder}}`) is contained in a single Word run.
- Loop markers (`{#items}…{/items}`, `{#attachments}…{/attachments}`) are not
  split across runs or nested incorrectly.
- You accept all tracked changes in Word before saving, because proofing
  marks can split tags across runs and Docxtemplater will throw errors.

You can test your template by clicking “پیش‌نمایش” (Preview).  If the
preview fails, open the browser console to see the precise error.  For
instance, mis‑ordered blocks like `{^flag}{#flag}…{/flag}{/flag}` must be
reordered to the canonical `{#flag}…{/flag}{^flag}…{/flag}`.