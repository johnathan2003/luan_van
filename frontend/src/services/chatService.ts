import API from './api'
import type {
  Conversation,
  ConversationListResponse,
  Message,
  MessageListResponse,
} from '../types/chat'

export const chatService = {
  /** Buyer: mở hoặc lấy conversation với shop */
  openConversation: (shopId: number) =>
    API.post<Conversation>(`/api/v1/chat/conversations/${shopId}`),

  /** Buyer: danh sách tất cả conversation của mình */
  getMyConversations: () =>
    API.get<ConversationListResponse>('/api/v1/chat/conversations'),

  /** Shop: inbox */
  getShopConversations: () =>
    API.get<ConversationListResponse>('/api/v1/chat/shop/conversations'),

  /** Lịch sử tin nhắn (cursor-based) */
  getMessages: (convId: number, beforeId?: number, limit = 30) =>
    API.get<MessageListResponse>(`/api/v1/chat/conversations/${convId}/messages`, {
      params: { before_id: beforeId, limit },
    }),

  /** Gửi tin nhắn */
  sendMessage: (convId: number, content: string, imageUrl?: string) =>
    API.post<Message>(`/api/v1/chat/conversations/${convId}/messages`, {
      content,
      image_url: imageUrl,
    }),

  /** Đánh dấu đã đọc */
  markRead: (convId: number) =>
    API.put(`/api/v1/chat/conversations/${convId}/read`),

  /** Employee: inbox (chưa assign + assign cho mình) */
  getEmployeeConversations: () =>
    API.get<ConversationListResponse>('/api/v1/chat/employee/conversations'),

  /** Employee: nhận phụ trách conversation */
  assignConversation: (convId: number) =>
    API.post(`/api/v1/chat/conversations/${convId}/assign`),
}
