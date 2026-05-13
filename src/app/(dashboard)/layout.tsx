import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { ProfileProvider } from '@/components/layout/profile-provider'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { Toaster } from 'sonner'
import type { Profile } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = rawProfile as Profile | null
  if (!profile) redirect('/login')
  if (profile.must_change_password) redirect('/change-password')

  return (
    <ProfileProvider profile={profile}>
      <NotificationProvider>
        <div className="flex h-screen bg-gray-50 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </NotificationProvider>
    </ProfileProvider>
  )
}
