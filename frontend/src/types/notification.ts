export interface Notification {
  notification_id: number
  title: string
  message: string
  type?: string
  is_read: boolean
  action_url?: string
  related_entity_type?: string
  related_entity_id?: number
  created_at?: string
}
