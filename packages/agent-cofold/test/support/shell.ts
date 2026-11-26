import { DEFAULT_SHELL } from '@cofold/tools';
import type { ShellSpec } from '@cofold/tools';

/*
 * The shell a case runs its shell calls through.
 *
 * cofold's own shell on Windows is PowerShell, which a busy CI runner can take
 * more than `WAIT_MS` to start, so a case waiting for its turn to end failed
 * for no fault of the agent. cmd starts in milliseconds. The language a
 * question names is none for cmd, so a case that checks it runs the default
 * shell and refuses the call. Elsewhere this is cofold's own `sh -c`.
 */
export const FAST_SHELL: ShellSpec = process.platform === 'win32'
  ? { command: 'cmd.exe', args: ['/d', '/s', '/c'] }
  : DEFAULT_SHELL;
