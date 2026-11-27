---
title: The ahpd part of a release
---

# The ahpd part of a release

Plan [container/20261125-0130](../plans/container/20261125-0130-the-ahpd-part-is-the-releases-own/plan.md) needs one rc to show that npm serves the bytes the release run staged.
Run it after the next rc tag, once every package of it is approved. Replace `0.16.0-rc.1` with that rc.

1. Compare what npm serves with the lock that `@ahpd/computer` carries:

   ```bash
   cd "$(mktemp -d)" && npm pack --silent @ahpd/computer@0.16.0-rc.1 && tar -xzf ahpd-computer-*.tgz
   node -e "
   const { execSync } = require('child_process');
   for (const f of ['parts/ahpd', 'parts/ahpd/plugins']) {
     const held = require('./package/images/' + f + '/package-lock.json').packages;
     for (const at of Object.keys(held).filter((one) => one.startsWith('node_modules/@ahpd/'))) {
       const name = at.slice('node_modules/'.length) + '@' + held[at].version;
       const served = execSync('npm view ' + name + ' dist.integrity').toString().trim();
       console.log(served === held[at].integrity ? 'PASS' : 'FAIL', name);
     }
   }"
   ```

   Pass: five lines, each `PASS` and each at the rc's version (`@ahpd/sdk` is in both locks). Fail: a `FAIL` line, or another version.

2. On a host that runs the rc, start a cofold session on an ssh box. Pass: the log says `ahpd 0.16.0-rc.1 was installed on <box>`. Fail: another version, or a refusal.
3. On the same host, start a cofold session in a container machine. Run `docker image ls 'ahpd-part/ahpd'`. Pass: a tag that starts with `0.16.0-rc.1-`. Fail: no such tag.

## Results

- Step 1 passed on 2026-11-27 for `0.16.0-rc.1`: five `PASS` lines, for `@ahpd/sdk`, `@ahpd/server`, `@ahpd/agent-cofold`, `@ahpd/agent-pi` and `@ahpd/sdk` again.
- Step 2 passed on 2026-11-27: `computer: ahpd 0.16.0-rc.1 was installed on dev02 at /home/softov/.local/share/ahpd/server/0.16.0-rc.1-59e6a63c9977/bin/ahpd`. The session then failed, as [a box whose own ahpd has httpApi](../problems/a-box-whose-own-ahpd-has-httpapi-takes-no-session.md) says.
- Step 3 passed on 2026-11-27: the tag `0.16.0-rc.1-298e35213dcb-a034c743b014`, and `cofold runs in computer://rc1box as cofold through @ahpd/agent-cofold`. The first create made no machine, as [a machine's first create](../problems/a-machines-first-create-makes-no-machine.md) says.
- The host was `@ahpd/server@0.16.0-rc.1` from npm, with its plugins put in by `ahpd plugin install`. A plugin named by a file path is told to the host in a machine by that path, which is not there.
