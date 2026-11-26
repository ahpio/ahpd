---
title: An ssh login is a connector, and an ssh box is a computer made by create - deferred
date: 2026-11-26
---

These wait on a box to try them on, or on a choice the build did not make.

| What | Why it waits | Where it goes |
| --- | --- | --- |
| A `vault` login with its own agent on Windows | No Windows box was at hand to check whether `ssh-agent -a` runs under the daemon's user; it is refused there by platform | unplanned |
| The checks by hand on dev02: a login with each of `agent`, `file` and `vault`, and a VM through a `vault` server | They need dev02 and Softov's keys | `.project/pending/` |
| The host key of a profile server's jump and of `qemu+ssh://` | `ssh -J` and libvirt read the daemon user's own `known_hosts` for the server, not the login's file | unplanned |
| A server whose Docker is the plugin's own `DOCKER_HOST` | The skip that kept its machines from being listed twice needs the address at load, and a login opens after it | unplanned |
