/**
 * A scripted `ssh-add`. `-` reads the key on its stdin and writes the socket
 * it was given and the key to `SSH_AGENT_FAKE_LOG`; `-L` prints one public key
 * line, as an agent holding one key answers. `SSH_ADD_FAKE_FAIL` makes `-`
 * refuse the key, as `ssh-add` does with one it cannot read.
 */
import { appendFileSync } from 'node:fs';

/** The public key line `-L` answers. */
const PUBLIC = 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl ahpd-test';

if (process.argv.includes('-L')) {
  process.stdout.write(`${PUBLIC}\n`);
  process.exit(0);
}

let key = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { key += chunk; });
process.stdin.on('end', () => {
  if (process.env.SSH_ADD_FAKE_FAIL !== undefined) {
    process.stderr.write('Error loading key "(stdin)": invalid format\n');
    process.exit(1);
  }
  const log = process.env.SSH_AGENT_FAKE_LOG;
  if (log !== undefined) appendFileSync(log, `${JSON.stringify({ event: 'added', socket: process.env.SSH_AUTH_SOCK, key })}\n`);
  process.exit(0);
});
