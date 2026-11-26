---
title: ssh logins on dev02
---

# ssh logins on dev02

Plan [container/20261126-0740](../plans/container/20261126-0740-an-ssh-login-is-a-connector/plan.md) was checked with a stand-in for `ssh`, `ssh-agent` and `ssh-add`. These are the checks over a real ssh, on a daemon built from the merge, with dev02 reached as the ssh alias `dev02`.

1. Remove `ssh.machines` from the computer plugin's options, and restart the daemon.
   Pass: the log has one `ssh.machines.<name> is no longer read` line per old entry, and none holds a key path. Fail: the plugin does not load.
2. Run `ahpd doctor`. Pass with the option still there: `warn Plugins: computer: ssh.machines is not an option`. Fail: `ok`.
3. In ahpw, make an `ssh` connector `dev02` owned by the host, with destination `dev02` and auth `ssh agent`.
   Pass: its check is `ok` and names a `SHA256:` host key. Fail: `denied` or `unreachable`.
4. Make a second connector `dev02-vault` with destination `dev02`, auth `Key in the vault`, and a private key with no passphrase that dev02 accepts.
   Pass: its check is `ok`, and `ls /tmp/ahpd-ssh-*` shows one `agent.sock`. Fail: `its key was not loaded into its agent`.
5. Create a computer with runtime `ssh box`, name `dev02`, and ssh login `dev02-vault`.
   Pass: `computer://ssh.dev02` is listed as running. Fail: the create is refused.
6. Start a cofold session in `computer://ssh.dev02` and send a prompt. Pass: it is answered. Fail: the session is refused.
7. Remove `computer://ssh.dev02`. Pass: it is gone from the list, and the box is as it was. Fail: an error.
8. Remove the connector `dev02-vault`. Pass: `ls /tmp/ahpd-ssh-*` shows nothing for it. Fail: its `agent.sock` is still there.
9. Point a libvirt profile's `server` at `dev02-vault`, and make a VM from it. Pass: the VM is made and a session in it answers. Fail: a refusal that names the login.
