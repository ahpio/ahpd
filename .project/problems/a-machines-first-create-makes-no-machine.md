---
title: A machine's first create makes no machine while its part is built
status: open
date: 2026-11-27
severity: minor
refs:
  - git://5f50448f0 - the commit `v0.16.0-rc.1` is on
---

## Symptom

On 2026-11-27, a host installed from `0.16.0-rc.1` was given `resourceWrite` of `computer://rc1box`, a `docker` machine with a profile whose agents are `["cofold"]`, and `createOnly`.
The answer was `{}`. The `ahpd-part/ahpd` image `0.16.0-rc.1-298e35213dcb-a034c743b014` was built after it, but no container was made, and the daemon log said nothing.
A cofold session in it then failed with `There is no computer called computer://rc1box`.
The same create, sent again once the image was there, answered in 1.4 s and made the machine.

## Cause

Unknown. The first create may answer before the part image is built, and lose the container when the build ends or the client goes away. The client was `rpc.mjs`, which closes once it has the answer.

## Impact

On a host with no part image yet, a create can answer as done and make no machine. The log says nothing of it.

## Workaround

Create the machine again.
