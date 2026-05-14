'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, MessageSquare, FileText,
  Calendar, FolderOpen, Bell, Settings, Users, Building2,
  LogOut, Shield, BookUser, BarChart3, ClipboardCheck, MapPin, CalendarDays
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth'
import { useNotificationStore } from '@/store/notifications'
import { canAccessAdminPanel, canAccessFeature, hasRole } from '@/lib/auth/permissions'
import type { FeatureName } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'
import { signOut } from '@/lib/auth/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/messages', icon: MessageSquare, label: 'Messages' },
  { href: '/teams', icon: Shield, label: 'Teams' },
  { href: '/directory', icon: BookUser, label: 'Directory' },
  { href: '/inspections', icon: ClipboardCheck, label: 'Inspections' },
  { href: '/forms', icon: FileText, label: 'Forms' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/files', icon: FolderOpen, label: 'Files' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
]

const ADMIN_NAV_ITEMS = [
  { href: '/admin/users', icon: Users, label: 'Users', minRole: 'org_admin' as UserRole },
  { href: '/admin/departments', icon: Building2, label: 'Departments', minRole: 'org_admin' as UserRole },
  { href: '/admin/teams', icon: Shield, label: 'Teams', feature: 'teams' as FeatureName },
  { href: '/admin/outlets', icon: MapPin, label: 'Outlets', feature: 'outlets' as FeatureName },
  { href: '/admin/inspection-templates', icon: ClipboardCheck, label: 'Checklists', feature: 'checklists' as FeatureName },
  { href: '/admin/inspection-schedules', icon: CalendarDays, label: 'Schedules', feature: 'schedules' as FeatureName },
  { href: '/admin/analytics', icon: BarChart3, label: 'Analytics', feature: 'analytics' as FeatureName },
  { href: '/admin/settings', icon: Settings, label: 'Settings', minRole: 'org_admin' as UserRole },
]


export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useAuthStore(s => s.profile)
  const featurePermissions = useAuthStore(s => s.featurePermissions)
  const unreadCount = useNotificationStore(s => s.unreadCount)
  const [signingOut, setSigningOut] = useState(false)

  function canSeeAdminItem(item: typeof ADMIN_NAV_ITEMS[0]): boolean {
    if (!profile) return false
    if (item.feature) return canAccessFeature(profile.role, item.feature, featurePermissions)
    if (item.minRole) return hasRole(profile.role, item.minRole)
    return canAccessAdminPanel(profile.role)
  }

  const visibleAdminItems = ADMIN_NAV_ITEMS.filter(canSeeAdminItem)
  const showAdminSection = visibleAdminItems.length > 0

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-60 flex-col bg-gradient-to-b from-indigo-950 via-indigo-900 to-blue-950 border-r-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
        <Image
          src="/alpro-logo.jpg"
          alt="Alpro Pharmacy"
          width={80}
          height={32}
          className="h-8 w-auto object-contain shrink-0"
          priority
        />
        <span className="font-bold text-white text-base leading-tight">OASIS Hub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-white/15 text-white rounded-lg font-medium'
                  : 'text-indigo-200 hover:bg-white/10 hover:text-white rounded-lg'
              )}
            >
              <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-indigo-300 group-hover:text-white')} />
              <span className="flex-1">{item.label}</span>
              {item.label === 'Notifications' && unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[1.2rem] justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Link>
          )
        })}

        {/* Admin Section */}
        {showAdminSection && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Administration
              </p>
            </div>
            {visibleAdminItems.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-white/15 text-white rounded-lg font-medium'
                      : 'text-indigo-200 hover:bg-white/10 hover:text-white rounded-lg'
                  )}
                >
                  <item.icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-indigo-300 group-hover:text-white')} />
                  {item.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User footer */}
      {profile && (
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.full_name}</p>
              <p className="text-xs text-indigo-300 truncate">{profile.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="text-indigo-300 hover:text-red-400 transition-colors disabled:opacity-50"
              title="Sign out"
            >
              {signingOut
                ? <span className="text-xs text-indigo-300 whitespace-nowrap">Logging out...</span>
                : <LogOut className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
