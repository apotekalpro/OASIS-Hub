import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/api/auth']
const SUPERADMIN_ROUTES = ['/admin/settings', '/admin/roles']
const ORG_ADMIN_ROUTES = ['/admin/users', '/admin/departments']

// Routes that use configurable feature permissions
const CONFIGURABLE_ROUTES: Record<string, string> = {
  '/admin/teams': 'teams',
  '/admin/outlets': 'outlets',
  '/admin/inspection-templates': 'checklists',
  '/admin/inspection-schedules': 'schedules',
  '/admin/analytics': 'analytics',
}

const ROLE_LEVELS: Record<string, number> = {
  super_admin: 100, org_admin: 80, dept_head: 60, chief: 60, lead: 50, area_manager: 55,
  team_leader: 40, auditor: 35, member: 20, viewer: 10, outlet: 5,
}

const DEFAULT_FEATURE_MIN: Record<string, string> = {
  teams: 'team_leader', outlets: 'dept_head', checklists: 'dept_head', schedules: 'area_manager', analytics: 'team_leader',
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    if (user) return NextResponse.redirect(new URL('/dashboard', request.url))
    return supabaseResponse
  }

  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const isAdminRoute = pathname.startsWith('/admin')
  const isSuperAdminRoute = SUPERADMIN_ROUTES.some(r => pathname.startsWith(r))
  const isOrgAdminRoute = ORG_ADMIN_ROUTES.some(r => pathname.startsWith(r))
  const configurableFeature = Object.entries(CONFIGURABLE_ROUTES).find(([prefix]) => pathname.startsWith(prefix))?.[1]

  if (!isAdminRoute) return supabaseResponse

  // Fetch profile for all admin routes
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, org_id, must_change_password')
    .eq('id', user.id)
    .single()

  if (profile?.must_change_password && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url))
  }

  if (!profile) return NextResponse.redirect(new URL('/login', request.url))

  const userLevel = ROLE_LEVELS[profile.role] ?? 0

  if (isSuperAdminRoute) {
    if (userLevel < ROLE_LEVELS.org_admin) return NextResponse.redirect(new URL('/dashboard', request.url))
    return supabaseResponse
  }

  if (isOrgAdminRoute) {
    if (userLevel < ROLE_LEVELS.org_admin) return NextResponse.redirect(new URL('/dashboard', request.url))
    return supabaseResponse
  }

  if (configurableFeature) {
    // Fetch feature permission for this org
    const { data: fp } = await supabase
      .from('feature_permissions')
      .select('min_role')
      .eq('org_id', profile.org_id)
      .eq('feature', configurableFeature)
      .single()
    const minRole = fp?.min_role ?? DEFAULT_FEATURE_MIN[configurableFeature] ?? 'dept_head'
    if (userLevel < (ROLE_LEVELS[minRole] ?? 60)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return supabaseResponse
  }

  // Remaining /admin/* routes — require dept_head+
  if (userLevel < ROLE_LEVELS.dept_head) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
