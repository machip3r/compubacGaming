# Agent instructions

## Project

CompuBac Gaming is a Spanish-language, offline-first console-session manager built with React, TypeScript, Vite, and Dexie/IndexedDB. Keep the dashboard focused on fast daily operation. The existing IndexedDB database name is a compatibility contract; do not rename it or discard stored records without a migration plan.

## Working agreements

- Use **pnpm** for package management and scripts. Keep `pnpm-lock.yaml` in sync when dependencies change.
- Do not commit, push, or open pull requests unless the user explicitly asks.
- Read and follow this file before changing the project. Keep code, symbols, types, and comments in English; write user-facing copy in clear, natural Mexican Spanish.
- Reuse existing UI patterns and shared components. Avoid adding controls that look interactive but do nothing, redundant badges, decorative filler, and generic AI-sounding copy.
- Preserve the CompuBac identity: Poppins with system fallbacks, navy `#142648`, turquoise `#51d7dd`, and the light/dark themes already in the app.

## Dialogs and validation

- Never use browser `alert()`, `confirm()`, or `prompt()` in product UI. Use accessible in-app dialogs with clear titles, actions, keyboard dismissal, visible focus, and appropriate destructive styling.
- Use confirmation dialogs before deleting or replacing records. State which related records are affected and whether the action can be undone.
- Validate user-edited values before persistence. Explain the specific invalid field and how to correct it; do not fail silently or expose raw storage errors.
- Label form controls and provide accessible names for icon-only buttons.

## Data and persistence

- Store business records in IndexedDB through Dexie. Persist related mutations in a single transaction and preserve historical values such as the rate captured by a session.
- Keep exports and imports aligned with the database schema. Validate backup format/version before replacing data, and confirm destructive replacement.
- Do not introduce remote databases, analytics, authentication, or external services; this app is designed to work offline.

## Verification

- Do not add or run tests unless the user asks for testing/verification. Avoid production builds for routine edits unless requested or needed to diagnose a build problem.
- For a UI change, review responsive behavior, visible text, focus states, and contrast. Report any verification limitation clearly.
