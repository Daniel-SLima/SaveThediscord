import { isValidRoomId } from '../shared/room-id';
export { Room } from './room';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const roomId = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/)?.[1];

    if (!roomId || !isValidRoomId(roomId) || request.method !== 'GET') {
      return new Response('Not found', { status: 404 });
    }

    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('Expected WebSocket upgrade', { status: 400 });
    }

    return env.ROOM.get(env.ROOM.idFromName(roomId)).fetch(request);
  },
} satisfies ExportedHandler<Env>;
