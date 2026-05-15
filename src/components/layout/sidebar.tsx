'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, CheckSquare, MessageSquare, FileText,
  Calendar, FolderOpen, Bell, Settings, Users, Building2,
  LogOut, Shield, BookUser, BarChart3, ClipboardCheck, MapPin,
  CalendarDays, Menu, X,
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

const MOBILE_BOTTOM_NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Home' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/messages', icon: MessageSquare, label: 'Chat' },
  { href: '/inspections', icon: ClipboardCheck, label: 'Inspect' },
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

function NavLink({ href, icon: Icon, label, isActive, onClick, badge }: {
  href: string; icon: React.ElementType; label: string; isActive: boolean; onClick?: () => void; badge?: number
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 text-sm transition-colors rounded-lg',
        isActive
          ? 'bg-white/15 text-white font-medium'
          : 'text-indigo-200 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-indigo-300')} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="destructive" className="text-xs px-1.5 py-0 min-w-[1.2rem] justify-center">
          {badge > 99 ? '99+' : badge}
        </Badge>
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const profile = useAuthStore(s => s.profile)
  const featurePermissions = useAuthStore(s => s.featurePermissions)
  const unreadCount = useNotificationStore(s => s.unreadCount)
  const [signingOut, setSigningOut] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  const navContent = (onNavClick?: () => void) => (
    <>
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-4 px-3 space-y-0.5">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
            onClick={onNavClick}
            badge={item.label === 'Notifications' ? unreadCount : undefined}
          />
        ))}

        {showAdminSection && (
          <>
            <div className="pt-4 pb-1">
              <p className="px-3 text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                Administration
              </p>
            </div>
            {visibleAdminItems.map(item => (
              <NavLink
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                isActive={pathname === item.href || pathname.startsWith(item.href + '/')}
                onClick={onNavClick}
              />
            ))}
          </>
        )}
      </nav>

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
              className="text-indigo-300 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
              title="Sign out"
            >
              {signingOut
                ? <span className="text-[10px] text-indigo-300">Out…</span>
                : <LogOut className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────── */}
      <aside className="hidden md:flex h-screen w-60 flex-col bg-gradient-to-b from-indigo-950 via-indigo-900 to-blue-950 shrink-0">
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
        {navContent()}
      </aside>

      {/* ── Mobile top header ────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-indigo-950 flex items-center justify-between px-4 shadow-md">
        <div className="flex items-center gap-2">
          <Image src="/alpro-logo.jpg" alt="Alpro" width={60} height={24} className="h-6 w-auto object-contain" priority />
          <span className="font-bold text-white text-sm">OASIS Hub</span>
        </div>
        <div className="flex items-center gap-1">
          <Link href="/notifications" className="relative p-2">
            <Bell className="h-5 w-5 text-indigo-200" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-3.5 w-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <button onClick={() => setDrawerOpen(true)} className="p-2 text-white">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* ── Mobile bottom navigation bar ─────────────────────── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-indigo-950 border-t border-white/10 flex">
        {MOBILE_BOTTOM_NAV.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors',
                isActive ? 'text-white' : 'text-indigo-400'
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] text-indigo-400"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </div>

      {/* ── Mobile slide-in drawer ────────────────────────────── */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative ml-auto w-72 max-w-[85vw] h-full flex flex-col bg-gradient-to-b from-indigo-950 via-indigo-900 to-blue-950">
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <Image src="/alpro-logo.jpg" alt="Alpro" width={60} height={24} className="h-6 w-auto object-contain" />
                <span className="font-bold text-white text-sm">OASIS Hub</span>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-indigo-300 hover:text-white p-1">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navContent(() => setDrawerOpen(false))}
          </div>
        </div>
      )}
    </>
  )
}
