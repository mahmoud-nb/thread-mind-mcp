# Writing ThreadMind summaries

A summary is what the next session starts from. It has to be short enough to load every time, and precise enough to continue the work without the conversation that produced it.

## Structure

Write summaries with these sections:

```markdown
## Decisions
- Auth with JWT access tokens (15 min) and refresh tokens (7 days), stored in httpOnly cookies
- PostgreSQL through Prisma; no raw SQL outside src/db/

## Constraints
- Must run on Node.js 18
- The public API stays backward compatible until v2

## State
- Login and refresh routes done and tested
- Logout doesn't revoke refresh tokens yet

## Open questions
- Rate limiting: per IP or per account?

## Next steps
- Revoke refresh tokens on logout
- Add rate limiting to /auth/login
```

| Section | Write | Avoid |
|---------|-------|-------|
| Decisions | The choice and its reason, in one line | The discussion that led to it |
| Constraints | Rules that must stay true | Wishes, or things already enforced by the code |
| State | What is done and what isn't, right now | A log of every step |
| Open questions | What still needs a decision | Questions already answered |
| Next steps | The next concrete actions | Long-term ideas |

French headings (`## Décisions`, `## Contraintes`, `## État`, `## Questions ouvertes`, `## Prochaines étapes`) are recognized too.

## Inheritance

Child threads inherit only the **Decisions** and **Constraints** of their ancestors. State, Open questions and Next steps belong to the thread itself. Put what every sub-topic must respect in Decisions and Constraints of the higher thread, and keep the rest in the thread where the work happens.

## Updating

- Add one decision: `summary_update` with `section: "decisions"` and the new line as `content`.
- Refresh where the work stands: `summary_update` with `section: "state"`, `replaceSection: true`.
- Rewrite everything: `summary_update` without `section`. The new content replaces the old one, so carry over everything that is still true.
- Pass `paths`, such as `["src/auth"]`, so that the context warns once later commits change those files.

## When to save

- Right after a decision, or after finding a constraint
- When a task is done: update State and Next steps
- Before the conversation ends or gets cleared
- Before switching to another thread

## Keep it lean

- One line per entry; drop entries that are no longer true
- No code blocks longer than a few lines: point to the file instead
- No secrets, tokens or personal data: summaries are often committed to git
