---
title: Publish @ahpio/sandbox-runtime 0.0.83-rc.0, and set its trusted publisher
plans:
  - plans/container/20261121-2250-the-sandbox-runtime-is-ahpios-fork/plan.md
---

# Publish @ahpio/sandbox-runtime 0.0.83-rc.0, and set its trusted publisher

npm sets up trusted publishing only for a package that exists, so the first publish needs your npm login. The tarball is the one CI built and verified on ahpio/sandbox-runtime PR #1, run 44989520168, merged as `5ec7d8a2a`.

## Steps

1. Check the tarball:

   ```bash
   ls -la ~/sandbox-runtime-rc0/ahpio-sandbox-runtime-0.0.83-rc.0.tgz
   sha256sum ~/sandbox-runtime-rc0/ahpio-sandbox-runtime-0.0.83-rc.0.tgz
   ```

   Pass: 4961734 bytes, and a sha256 that starts with `0389f65886d3ee00`.
2. Sign in to npm as the owner of the `@ahpio` scope: `npm login`.
3. Publish it under `next`:

   ```bash
   npm publish ~/sandbox-runtime-rc0/ahpio-sandbox-runtime-0.0.83-rc.0.tgz --access public --tag next
   ```

   Pass: npm prints `+ @ahpio/sandbox-runtime@0.0.83-rc.0`.
4. On npmjs.com, open `@ahpio/sandbox-runtime`, *Settings*, *Trusted Publisher*, and add GitHub Actions with:
   - Organization or user: `ahpio`
   - Repository: `sandbox-runtime`
   - Workflow filename: `release.yml`
   - Environment name: `npm`
5. Check: `npm view @ahpio/sandbox-runtime@0.0.83-rc.0 version`.
   Pass: it prints `0.0.83-rc.0`.

## Reply

Write "published" when step 5 passes. The computer plugin then moves to the fork in task 03 of the plan, and the sandbox CA plan can start.
