const BASE64_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{21}[AQgw]$/;

export function createRoomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let roomId = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];

    roomId += BASE64_URL[first >> 2];
    roomId += BASE64_URL[((first & 0b11) << 4) | ((second ?? 0) >> 4)];

    if (second !== undefined) roomId += BASE64_URL[((second & 0b1111) << 2) | ((third ?? 0) >> 6)];
    if (third !== undefined) roomId += BASE64_URL[third & 0b111111];
  }

  return roomId;
}

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_PATTERN.test(id);
}
