'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, MessageSquare, FileText,
  Calendar, FolderOpen, Bell, Settings, Users, Building2,
  ChevronDown, LogOut, Shield
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/auth'
import { useNotificationStore } from '@/store/notifications'
import { canAccessAdminPanel } from '@/lib/auth/permissions'
import { signOut } from '@/lib/auth/actions'
import { useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/messages', icon: MessageSquare, label: 'Messages' },
  { href: '/forms', icon: FileText, label: 'Forms' },
  { href: '/calendar', icon: Calendar, label: 'Calendar' },
  { href: '/files', icon: FolderOpen, label: 'Files' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
]

const ADMIN_NAV_ITEMS = [
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/departments', icon: Building2, label: 'Departments' },
  { href: '/admin/teams', icon: Shield, label: 'Teams' },
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useAuthStore(s => s.profile)
  const unreadCount = useNotificationStore(s => s.unreadCount)

  const isAdmin = profile && canAccessAdminPanel(profile.role)

  async function handleSignOut() {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
          <Building2 className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">OASIS Hub</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              pathname === item.href || pathname.startsWith(item.href + '/')
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.label === 'Notifications' && unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[1.2rem] justify-center">
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Link>
        ))}

        {/* Admin Section */}
        {isAdmin && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Administration
              </p>
            </div>
            {ADMIN_NAV_ITEMS.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  pathname === item.href || pathname.startsWith(item.href + '/')
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      {profile && (
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <UserAvatar name={profile.full_name} avatarUrl={profile.avatar_url} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{profile.full_name}</p>
              <p className="text-xs text-gray-500 truncate">{profile.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="text-gray-400 hover:text-red-600 transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
