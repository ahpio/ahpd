---
title: A busy folder is tried again
status: done
depends: []
layer: "tools"
---

## Objective

`removeFolder` tries again after an `EBUSY`, `EPERM` or `ENOTEMPTY`, with a pause between tries, for up to 5 s. A failure after that names the tries, the time waited and what is left.

## Files

- `UPDATE: tools/holders.ts:82-107` - the retry loop in `removeFolder`, with `remove` and `ms` parameters.
- `UPDATE: packages/sdk/test/teardown-clear.test.ts` - the retry cases.

## Steps

1. Give `removeFolder` a `remove` parameter, `rmSync` with `recursive` and `force` by default.
2. Give it an `ms` parameter, 5000 by default.
3. Catch `EBUSY`, `EPERM` and `ENOTEMPTY` from `remove`, and call `pause` before the next try.
4. Start the pause at 50 ms, double it each time, and stop at the limit.
5. Throw any other error at once.
6. Add the count of tries and the time waited to the message of a failure.

## Validation

- A remover that throws `EBUSY` twice and then removes the folder leaves no error.
- A remover that always throws `EBUSY` fails after `ms`, and the message names the tries.
- A remover that throws `EACCES` fails after one try.
- `teardown-clear.test.ts` and `teardown-check.test.ts` pass.

## Resume

Built on 2026-11-27. `pause` moved above `removeFolder`, which calls it now.
