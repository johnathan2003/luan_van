import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
let socket: Socket | null = null

export const getSocket = (userId: number): Socket => {
  // Chỉ tạo socket mới nếu chưa có hoặc đã bị disconnect hoàn toàn.
  // KHÔNG tạo mới khi đang "connecting" (socket != null nhưng connected = false)
  // vì nếu tạo mới → mỗi useEffect() gọi getSocket() trong cùng render cycle
  // sẽ tạo socket riêng → join_conversation và listener nằm ở 2 socket khác nhau.
  if (!socket) {
    console.log(`[Socket] Creating socket → ${SOCKET_URL} as user_id=${userId}`)
    socket = io(SOCKET_URL, {
      auth: { user_id: userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socket.on('connect', () =>
      console.log(`[Socket] ✅ Connected  sid=${socket?.id}  user=${userId}`)
    )
    socket.on('disconnect', (reason) =>
      console.warn(`[Socket] ❌ Disconnected: ${reason}`)
    )
    socket.on('connect_error', (err) =>
      console.error(`[Socket] ⚠️ Error: ${err.message}`)
    )
    // Log tất cả events nhận về để debug
    socket.onAny((event, ...args) =>
      console.log(`[Socket] ← ${event}`, args)
    )
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null }
}

export const joinRoom = (room: string) => socket?.emit('join_room', { room })
export const leaveRoom = (room: string) => socket?.emit('leave_room', { room })
