import API from './api'
import type {
  Conversation,
  ConversationListResponse,
  Message,
  MessageListResponse,
} from '../types/chat'

export const chatService = {
  /** Buyer: mo hoac lay conversation voi shop */
  openConversation: (shopId: number) =>
    API.post<Conversation>('/api/v1/chat/conversations/' + shopId),

  /** Buyer: danh sach tat ca conversation cua minh */
  getMyConversations: () =>
    API.get<ConversationListResponse>('/api/v1/chat/conversations'),

  /** Shop: inbox */
  getShopConversations: () =>
    API.get<ConversationListResponse>('/api/v1/chat/shop/conversations'),

  /** Lich su tin nhan (cursor-based) */
  getMessages: (convId: number, beforeId?: number, limit = 30) =>
    API.get<MessageListResponse>('/api/v1/chat/conversations/' + convId + '/messages', {
      params: { before_id: beforeId, limit },
    }),

  /** Gui tin nhan */
  sendMessage: (convId: number, content: string, imageUrl?: string) =>
    API.post<Message>('/api/v1/chat/conversations/' + convId + '/messages', {
      content,
      image_url: imageUrl,
    }),

  /** Danh dau da doc */
  markRead: (convId: number) =>
    API.put('/api/v1/chat/conversations/' + convId + '/read'),

  /** Employee: inbox (chua assign + assign cho minh) */
  getEmployeeConversations: () =>
    API.get<ConversationListResponse>('/api/v1/chat/employee/conversations'),

  /** Employee: nhan phu trach conversation */
  assignConversation: (convId: number) =>
    API.post('/api/v1/chat/conversations/' + convId + '/assign'),
}
