import type { HaLink } from './ha';

// Live camera video over WebRTC, negotiated through Home Assistant's websocket, the same way
// HA's own frontend plays Nest cameras (which have no snapshots or MJPEG stream).

interface ClientConfig {
  configuration: RTCConfiguration;
  dataChannel?: string;
}

type OfferEvent =
  | { type: 'session'; session_id: string }
  | { type: 'answer'; answer: string }
  | { type: 'candidate'; candidate: RTCIceCandidateInit }
  | { type: 'error'; code: string; message: string };

export interface CameraStream {
  stop(): void;
}

/** Demo mode only (see demo.ts): the looping clip a camera plays instead of a live stream. */
interface DemoCameras {
  clip?: (entityId: string) => string;
}

export const demoCameras: DemoCameras = {};

function playClip(url: string, video: HTMLVideoElement): CameraStream {
  video.loop = true;
  video.src = url;
  video.play().catch(() => {});

  return {
    stop() {
      video.removeAttribute('src');
      video.load();
    },
  };
}

export async function playCamera(
  conn: HaLink,
  entityId: string,
  video: HTMLVideoElement,
  onError: (msg: string) => void,
): Promise<CameraStream> {
  const clip = demoCameras.clip?.(entityId);

  if (clip) return playClip(clip, video);
  let stopped = false;
  let unsub: (() => Promise<void>) | null = null;
  const cfg = await conn.sendMessagePromise<ClientConfig>({ type: 'camera/webrtc/get_client_config', entity_id: entityId });
  const pc = new RTCPeerConnection(cfg.configuration);
  // Nest wants audio, video, then a data channel, in that order.
  pc.addTransceiver('audio', { direction: 'recvonly' });
  pc.addTransceiver('video', { direction: 'recvonly' });

  if (cfg.dataChannel) pc.createDataChannel(cfg.dataChannel);

  const stream = new MediaStream();
  pc.ontrack = (e) => {
    stream.addTrack(e.track);
    video.srcObject = stream;
    video.play().catch(() => {});
  };

  let sessionId: string | null = null;
  const early: RTCIceCandidateInit[] = [];

  const sendCandidate = (c: RTCIceCandidateInit) =>
    conn
      .sendMessagePromise({ type: 'camera/webrtc/candidate', entity_id: entityId, session_id: sessionId, candidate: c })
      .catch(() => {});

  pc.onicecandidate = (e) => {
    if (!e.candidate) return;
    const c = e.candidate.toJSON();

    if (sessionId) sendCandidate(c);
    else early.push(c);
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  unsub = await conn.subscribeMessage<OfferEvent>(
    async (ev) => {
      if (stopped) return;

      if (ev.type === 'session') {
        sessionId = ev.session_id;
        early.splice(0).forEach(sendCandidate);
      } else if (ev.type === 'answer') {
        await pc.setRemoteDescription({ type: 'answer', sdp: ev.answer });
      } else if (ev.type === 'candidate') {
        await pc.addIceCandidate(ev.candidate).catch(() => {});
      } else if (ev.type === 'error') {
        onError(ev.message);
      }
    },
    { type: 'camera/webrtc/offer', entity_id: entityId, offer: offer.sdp },
  );

  return {
    stop() {
      stopped = true;
      unsub?.().catch(() => {});
      pc.close();
      video.srcObject = null;
    },
  };
}
