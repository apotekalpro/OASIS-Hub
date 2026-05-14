import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAdminPanel } from '@/lib/auth/permissions'
import { Sidebar } from '@/components/layout/sidebar'
import { ProfileProvider } from '@/components/layout/profile-provider'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { Toaster } from 'sonner'
import type { Profile } from '@/types/database'
import type { FeaturePermissions } from '@/lib/auth/permissions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
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
  if (!canAccessAdminPanel(profile.role)) redirect('/dashboard')

  const fpRes = await supabase
    .from('feature_permissions')
    .select('feature, min_role')
    .eq('org_id', profile.org_id)

  const featurePermissions: FeaturePermissions = {}
  for (const row of (fpRes.data ?? []) as { feature: string; min_role: string }[]) {
    (featurePermissions as Record<string, string>)[row.feature] = row.min_role
  }

  return (
    <ProfileProvider profile={profile as Profile} featurePermissions={featurePermissions}>
      <NotificationProvider>
        <div className="flex h-screen bg-gradient-to-br from-slate-100 via-indigo-50/40 to-blue-50/50 overflow-hidden">
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
