import { io, Socket } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
let socket: Socket | null = null

export const getSocket = (userId: number): Socket => {
  if (!socket || !socket.connected) {
    socket = io(SOCKET_URL, {
      auth: { user_id: userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    socket.on('connect', () => console.log('Socket connected'))
    socket.on('disconnect', () => console.log('Socket disconnected'))
  }
  return socket
}

export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null }
}

export const joinRoom = (room: string) => socket?.emit('join_room', { room })
export const leaveRoom = (room: string) => socket?.emit('leave_room', { room })
