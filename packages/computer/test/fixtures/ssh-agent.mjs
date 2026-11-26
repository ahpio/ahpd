/**
 * A scripted `ssh-agent`: `-D -a <socket>` listens on the socket until it is
 * killed, and writes one line to `SSH_AGENT_FAKE_LOG` when it starts and one
 * when it ends. `SSH_AGENT_FAKE_FAIL` makes it exit at once, as an agent that
 * cannot start does.
 */
import { appendFileSync } from 'node:fs';
import { createServer } from 'node:net';

const args = process.argv.slice(2);
const socket = args[args.indexOf('-a') + 1];
const log = process.env.SSH_AGENT_FAKE_LOG;
const note = (event) => { if (log !== undefined) appendFileSync(log, `${JSON.stringify({ event, socket })}\n`); };

if (process.env.SSH_AGENT_FAKE_FAIL !== undefined || socket === undefined) {
  process.stderr.write('ssh-agent: cannot start\n');
  process.exit(1);
}
const server = createServer(() => {});
server.listen(socket, () => { note('started'); });
const end = () => { note('stopped'); server.close(); process.exit(0); };
process.on('SIGTERM', end);
process.on('SIGINT', end);
