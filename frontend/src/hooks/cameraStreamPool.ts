/** One MediaStream per deviceId — several panels can share without reopening. */

type Entry = {
  stream: MediaStream;
  refs: number;
};

const pool = new Map<string, Entry>();

export async function acquireCameraStream(
  deviceId: string,
): Promise<MediaStream> {
  const existing = pool.get(deviceId);
  if (existing) {
    existing.refs += 1;
    return existing.stream;
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { ideal: deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });
  pool.set(deviceId, { stream, refs: 1 });
  return stream;
}

export function releaseCameraStream(deviceId: string): void {
  const entry = pool.get(deviceId);
  if (!entry) return;
  entry.refs -= 1;
  if (entry.refs <= 0) {
    entry.stream.getTracks().forEach((t) => t.stop());
    pool.delete(deviceId);
  }
}
