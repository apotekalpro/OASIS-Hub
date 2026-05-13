import { createClient } from '@/lib/supabase/server'
import { NotificationsClient } from '@/components/notifications/notifications-client'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, data, is_read, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  type Notif = { id: string; type: string; title: string; body: string | null; data: Record<string, unknown>; is_read: boolean; created_at: string }

  return <NotificationsClient notifications={(data as Notif[]) ?? []} />
}
