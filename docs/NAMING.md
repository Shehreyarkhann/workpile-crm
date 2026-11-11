# Workpile naming standard

Identity is assigned by the system, never improvised — so any record can be
found, attached, printed, and proven later.

- **Proposals** are `PROP-<number>` (sequential per workspace from 1001).
  The DOCX is `PROP-<number>-<service>-v<version>.docx`.
- **Invoices** are `INV-<number>` (sequential per workspace from 0001).
  The DOCX is `INV-<number>.docx`, and the public page is `/invoice/<token>`.
- **Uploaded files** keep a human name AND, for company documents, a
  **type**: `w9`, `insurance`, `license`, `other` — set at upload in the
  Library vault (the upload flow pre-fills a clean name and suggests the
  type from the filename; a human confirms). Any file can be renamed or
  reclassified later. The document matcher trusts the type first and the
  filename second, so a scanner-named file still works once classified.
- Record files (job photos, lead files) live on their record; their
  findability comes from the record, and the client file (dossier) lists
  them all in one place.
