import { createClient } from '@/lib/supabase/server'
import { NotificationsClient } from '@/components/notifications/notifications-client'
import type { AppNotification } from '@/types/database'

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

  return <NotificationsClient notifications={(data as AppNotification[]) ?? []} />
}
