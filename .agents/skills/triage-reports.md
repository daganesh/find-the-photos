# Skill: triage-reports

Query the Railway PostgreSQL database directly for open bug reports and feature
requests, then help turn them into GitHub issues.

## Trigger

Invoke this skill when the user asks to:
- triage reports / bugs / feature requests
- see what's open / actionable
- create GitHub issues from reports
- review user feedback

---

## Steps

### 1. Query the database

Use the `railway-db` MCP server (already configured in `.claude/settings.json`).
Run this query:

```sql
SELECT data
FROM reports
WHERE data->>'status' NOT IN ('done', 'dismissed')
ORDER BY (data->>'severity')::int DESC, (data->>'createdAt') ASC;
```

### 2. Parse and display

Split the results into two lists.

**BUGS** — `data->>'type' = 'bug'`

For each bug, show:
```
[severity: High/Med/Low]  [status: new | in_progress]
Description: <text>
Reporters: <name>, <name>  (N total)
Created: <date>
ID: <uuid>
```

**FEATURE REQUESTS** — `data->>'type' = 'feature'`

Same format.

Sort each list: High severity first, then by reporter count descending (most-wanted first).

### 3. Offer GitHub issue creation

After displaying both lists, ask:
> "Would you like me to create GitHub issues for any of these? I can do all
> actionable ones, or you can pick by number."

For each item turned into a GitHub issue, use this format:

**Title:** `[Bug] <short description>` or `[Feature] <short description>`

**Body:**
```
## Description
<full description from report>

## Details
- **Severity:** High / Medium / Low
- **Status:** new / in_progress
- **Reporters:** N user(s) — <names>
- **First reported:** <date>
- **Report ID:** <uuid>

## Acceptance criteria
<!-- Fill in before starting work -->
- [ ] ...
```

**Labels:** `bug` or `enhancement`, plus `severity: high` / `severity: medium` / `severity: low`

### 4. After creating issues

For each GitHub issue created, offer to immediately start implementing it using
the `new-feature` or `bug-fix` skill as appropriate.

---

## Notes

- The `railway-db` MCP provides direct read/write access to the production
  database. Only read (`SELECT`) unless the user explicitly asks you to update
  a report's status.
- To mark a report as `in_progress` after creating a GitHub issue:
  ```sql
  UPDATE reports
  SET data = jsonb_set(data, '{status}', '"in_progress"')
  WHERE id = '<uuid>';
  ```
- Status values: `new` | `in_progress` | `done` | `dismissed`
- Severity values: `1` (low) | `2` (medium) | `3` (high)
