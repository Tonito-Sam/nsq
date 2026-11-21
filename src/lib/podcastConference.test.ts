import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPodcastPeerConnection } from './podcastConference';

describe('createPodcastPeerConnection', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses a prefixed constructor when the standard API is not constructable', () => {
    let usedConfiguration: RTCConfiguration | undefined;
    class PrefixedPeerConnection {
      constructor(configuration: RTCConfiguration) {
        usedConfiguration = configuration;
      }
    }

    vi.stubGlobal('RTCPeerConnection', () => undefined);
    vi.stubGlobal('webkitRTCPeerConnection', PrefixedPeerConnection);

    const configuration = { iceServers: [] };
    const connection = createPodcastPeerConnection(configuration);

    expect(connection).toBeInstanceOf(PrefixedPeerConnection);
    expect(usedConfiguration).toBe(configuration);
  });

  it('reports an actionable error when no browser constructor exists', () => {
    vi.stubGlobal('RTCPeerConnection', undefined);
    vi.stubGlobal('webkitRTCPeerConnection', undefined);
    vi.stubGlobal('mozRTCPeerConnection', undefined);

    expect(() => createPodcastPeerConnection({ iceServers: [] }))
      .toThrow('WebRTC is not supported in this browser. Use a current browser over HTTPS.');
  });
});
