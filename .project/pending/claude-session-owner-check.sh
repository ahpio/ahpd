#!/usr/bin/env bash
# Restart the test daemon of test-daemon.sh with a wire log, for
# claude-session-owner-checks.md. It needs ~/ahpd-check from an earlier
# test-daemon.sh run, with users alice (admin) and bob (member).
set -eu
CHECK=/github/ahpd.worktrees/pending-check
HOME_CHECK=$HOME/ahpd-check
export XDG_CONFIG_HOME=$HOME_CHECK/config XDG_STATE_HOME=$HOME_CHECK/state XDG_DATA_HOME=$HOME_CHECK/data
ahpd() { node "$CHECK/packages/server/dist/main.js" "$@"; }

[ -f "$HOME_CHECK/alice.token" ] || { echo "No ~/ahpd-check/alice.token: run test-daemon.sh and add alice first."; exit 1; }
if ss -ltn | grep -q ':39200 '; then ahpd stop >/dev/null 2>&1 || true; fi
rm -f "$HOME_CHECK/wire.jsonl"
ahpd start --port 39200 --connection-token-file "$HOME_CHECK/token" --wire "$HOME_CHECK/wire.jsonl"
echo
echo "Add this to VS Code's chat.remoteAgentHosts, with the contents of ~/ahpd-check/alice.token as connectionToken:"
echo '  { "name": "ahpd-check", "address": "ws://127.0.0.1:39200", "connectionToken": "<~/ahpd-check/alice.token>" }'
