<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ship a feature everywhere, not just where you started

A change is not done when the new screen works. It is done when everything that depended on
the old shape has been updated. This app has already shipped a bug this way: adding a
`visibility` field to onboarding left `updateGoal` reusing the same schema, so **every** Save
on /settings crashed with "This page couldn't load" until a user reported it.

Before calling a change done, walk this list and say which ones you checked:

1. **Schema → migration.** A new/changed column in `src/db/schema.ts` needs a matching
   `migrations/NNNN_*.sql` (idempotent: `IF NOT EXISTS`). `drizzle-kit push` does not run in
   production — `scripts/migrate.ts` does, during `next build`.
2. **Every reader of that table.** Grep the table and column names. `src/lib/data.ts`
   (`loadUserState`), `src/lib/social.ts` (`sharedStats` — decide if it is shareable), the
   page that renders it, and `src/lib/coach.ts` (`facts()` — the coach should know about it).
3. **Every writer.** Actions that insert or update the row, plus `src/lib/dev-seed.ts` and
   `src/lib/plan-generator.ts` if the row is generated.
4. **Shared validation.** Schemas in `src/lib/forms.ts` are reused by more than one action.
   Adding a field to one flow must not make another flow's form incomplete — extend a schema,
   don't widen a shared one. Every form field in the UI must exist in the schema and vice versa.
5. **Client limits === server limits.** Steppers, `maxLength` and `min`/`max` must clamp to
   exactly what the action accepts (`SECTION_META[k].max`, `WEEKLY_MAX`). A UI that can submit
   a rejected value is a crash waiting to happen.
6. **Expected errors are return values, not throws.** Anything a normal user can trigger
   (taken username, out-of-range number) returns `FormResult` and shows next to the button.
   Only real bugs should throw — those land in `src/app/(app)/error.tsx`.
7. **Announce it.** Bump `WHATS_NEW.id` in `src/lib/whats-new.ts` when users should see it.
8. **Prove it.** `npx tsc --noEmit`, `npm test`, `npx eslint src`, then run `npm run dev` and
   click the actual flow. Types and tests pass happily while a zod schema rejects every save —
   that is exactly how the bug above reached production.
