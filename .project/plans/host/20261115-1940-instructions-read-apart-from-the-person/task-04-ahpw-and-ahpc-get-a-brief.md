---
title: ahpw and ahpc each hold a brief for the push of artifactTools
status: done
depends: []
layer: "docs"
refs:
  - https://github.com/ahpio/ahpd/pull/344 - the gate the clients answer
  - file:///home/softov/projects/ahp-analis/ahpd-config-defaults-report.md - the defaults report, whose `artifactTools` row is corrected here
---

## Objective

ahpw and ahpc each have a brief that says to push `artifactTools: true` at connect when the root holds no value for it.
The defaults report says what ahpd does with `artifactTools`.

## Files

- `CREATE: /github/ahpw/.project/briefs/the-client-turns-on-the-artifact-tools.md` - the brief for ahpw.
- `CREATE: /github/ahpc/.project/briefs/the-client-turns-on-the-artifact-tools.md` - the brief for ahpc.
- `UPDATE: /home/softov/projects/ahp-analis/ahpd-config-defaults-report.md` - the `artifactTools` row.

## Steps

1. Read where each client handles a root snapshot and dispatches `root/configChanged`.
2. Write each brief from the do-spec template, with the Answers rows of this plan as its facts.
3. Name in each brief the gap until it ships: the client's users have no artifact tools.
4. Correct the report's `artifactTools` row: ahpd has the tools, behind the key since #344.
5. Commit each brief on a branch in its repository, without a pull request.

## Validation

- `lint-prose.mjs` passes on both briefs.
- Each brief's `code://` links resolve in its repository.

## Resume


Done 2026-11-15. ahpw `b71f1c5` and ahpc `ae08b2f`, each on branch `brief/the-client-turns-on-the-artifact-tools`, not pushed. The report's `artifactTools` row is corrected.
