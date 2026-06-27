export interface Message {
  message_id: number
  conversation_id: number
  sender_id: number
  sender_role: 'user' | 'shop'
  sender_name?: string
  sender_avatar?: string
  content: string
  image_url?: string
  is_read: boolean
  read_at?: string
  created_at: string
}

export interface Conversation {
  conversation_id: number
  user_id: number
  shop_id: number
  partner_name?: string
  partner_avatar?: string
  last_message?: string
  last_message_at?: string
  unread_count: number
  // assignment
  assigned_employee_id?: number | null
  assigned_employee_name?: string | null
  owner_notified?: boolean
  created_at: string
}

export interface ConversationListResponse {
  conversations: Conversation[]
  total: number
}

export interface MessageListResponse {
  messages: Message[]
  total: number
  has_more: boolean
}
