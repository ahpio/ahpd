import { expect, it, vi } from 'vitest';
import { notFound, sdkService } from '../src/service.js';

/*
 * A Dev Tunnel the service no longer has, at a start.
 *
 * The SDK's `getTunnel` throws on a 404 rather than answering `null`, so the
 * management client stands in here: the kept tunnel is gone, and the service
 * finds none of its name either, so a start makes one again and keeps its id.
 */

/** What the stand-in was asked. */
const asked = { got: 0, made: 0 };

/** The error the SDK throws for a tunnel it does not have, as axios shapes one. */
const gone = (): Error => Object.assign(new Error('Tunnel service error: Not Found'), { response: { status: 404 } });

vi.mock('@microsoft/dev-tunnels-management', () => ({
  ManagementApiVersions: { Version20230927preview: '2023-09-27-preview' },
  TunnelManagementHttpClient: class {
    async getTunnel(): Promise<never> { asked.got += 1; throw gone(); }
    async listTunnels(): Promise<unknown[]> { return []; }
    async createTunnel(tunnel: { labels: string[] }): Promise<unknown> {
      asked.made += 1;
      return { tunnelId: 'made-again', clusterId: 'brs', labels: tunnel.labels };
    }
    async updateTunnel(tunnel: unknown): Promise<unknown> { return tunnel; }
    async createOrUpdateTunnelPort(_tunnel: unknown, port: { portNumber: number }): Promise<unknown> {
      return { ...port, portForwardingUris: [`https://made-again-${String(port.portNumber)}.brs.example.test/`] };
    }
  },
}));

vi.mock('@microsoft/dev-tunnels-connections', () => ({
  TunnelRelayTunnelHost: class {
    forwardConnectionsToLocalPorts = true;
    forwardedPortConnecting(): void {}
    async connect(): Promise<void> {}
    async refreshPorts(): Promise<void> {}
    async dispose(): Promise<void> {}
  },
}));

it('reads a 404 from the service as a tunnel it does not have', () => {
  expect(notFound(gone())).toBe(true);
  expect(notFound(Object.assign(new Error('Forbidden'), { response: { status: 403 } }))).toBe(false);
  expect(notFound(new Error('socket hang up'))).toBe(false);
});

it('makes a tunnel again at a start when the service no longer has the kept one, and keeps its id', async () => {
  const kept: { id: string; cluster?: string; name: string }[] = [];
  const service = sdkService({
    name: 'soft-sandbox',
    token: async () => ({ token: 'not-a-real-token' }),
    kept: {
      read: async () => ({ id: 'swift-fog-zm4rwhl', cluster: 'brs', name: 'soft-sandbox' }),
      write: async (_connector, value) => { kept.push(value); },
    },
  });

  const served = await service.add('devtunnel', 31546, false);

  expect(asked.got).toBe(1);
  expect(asked.made).toBe(1);
  expect(served.remote.id).toBe('made-again');
  expect(served.url).toBe('https://made-again-31546.brs.example.test/');
  expect(kept).toEqual([{ id: 'made-again', cluster: 'brs', name: 'soft-sandbox' }]);
});
