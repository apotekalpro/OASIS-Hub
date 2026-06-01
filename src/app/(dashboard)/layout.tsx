import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ProfileProvider } from '@/components/layout/profile-provider'
import { NotificationProvider } from '@/components/notifications/notification-provider'
import { Toaster } from 'sonner'
import { getAuthUser, getCachedProfile, getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getCachedProfile(user.id)
  if (!profile) redirect('/login')
  if (profile.must_change_password) redirect('/change-password')

  const featurePermissions = await getCachedFeaturePermissions(profile.org_id ?? '')

  return (
    <ProfileProvider profile={profile} featurePermissions={featurePermissions}>
      <NotificationProvider>
        <div className="flex h-screen bg-gradient-to-br from-slate-100 via-indigo-50/40 to-blue-50/50 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pt-14 pb-16 md:pt-0 md:pb-0">
            {children}
          </main>
        </div>
        <Toaster position="top-right" richColors />
      </NotificationProvider>
    </ProfileProvider>
  )
}
