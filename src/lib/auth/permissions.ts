import type { UserRole } from '@/types/database'

export const ROLE_HIERARCHY: Record<string, number> = {
  super_admin: 100,
  org_admin: 80,
  dept_head: 60,
  chief: 60,
  lead: 50,
  area_manager: 55,
  team_leader: 40,
  auditor: 35,
  member: 20,
  viewer: 10,
  outlet: 5,
}

/** Alias for consumers that want the explicit name */
export const SYSTEM_ROLE_HIERARCHY = ROLE_HIERARCHY

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 0
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0)
}

export function canManageUsers(role: UserRole): boolean {
  return hasRole(role, 'org_admin')
}

export function canManageDepartments(role: UserRole): boolean {
  return hasRole(role, 'org_admin')
}

export function canManageTeams(role: UserRole): boolean {
  return hasRole(role, 'dept_head')
}

export function canCreateTasks(role: UserRole): boolean {
  return hasRole(role, 'member')
}

export function canAssignTasks(role: UserRole): boolean {
  return hasRole(role, 'team_leader')
}

export function canDeleteTasks(role: UserRole): boolean {
  return hasRole(role, 'dept_head')
}

export function canManageForms(role: UserRole): boolean {
  return hasRole(role, 'dept_head')
}

export function canReviewSubmissions(role: UserRole): boolean {
  return hasRole(role, 'dept_head')
}

export function canViewAuditLogs(role: UserRole): boolean {
  return hasRole(role, 'org_admin')
}

export function canImportUsers(role: UserRole): boolean {
  return hasRole(role, 'org_admin')
}

export function canResetPasswords(role: UserRole): boolean {
  return hasRole(role, 'org_admin')
}

export function canAccessAdminPanel(role: UserRole): boolean {
  return hasRole(role, 'dept_head')
}

/** Deadlines on tasks/OKRs/ATEM items may only be changed by the creator/owner or dept_head+. */
export function canEditDeadline(userId: string, userRole: UserRole, ownerId: string): boolean {
  return userId === ownerId || hasRole(userRole, 'dept_head')
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organization Admin',
  dept_head: 'Department Head',
  chief: 'Chief',
  lead: 'Lead / Supervisor',
  area_manager: 'Area Manager',
  team_leader: 'Team Leader',
  auditor: 'Auditor',
  member: 'Member',
  viewer: 'Viewer',
  outlet: 'Outlet',
}

export const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800',
  org_admin: 'bg-purple-100 text-purple-800',
  dept_head: 'bg-blue-100 text-blue-800',
  chief: 'bg-indigo-100 text-indigo-800',
  lead: 'bg-cyan-100 text-cyan-800',
  area_manager: 'bg-teal-100 text-teal-800',
  team_leader: 'bg-green-100 text-green-800',
  auditor: 'bg-yellow-100 text-yellow-800',
  member: 'bg-gray-100 text-gray-800',
  viewer: 'bg-slate-100 text-slate-600',
  outlet: 'bg-orange-100 text-orange-800',
}

export type FeatureName = 'teams' | 'outlets' | 'checklists' | 'schedules' | 'analytics' | 'pillar'

export const FEATURE_DEFINITIONS: { feature: FeatureName; label: string; description: string; defaultMin: UserRole; locked?: boolean }[] = [
  { feature: 'analytics', label: 'Analytics', description: 'View analytics dashboards', defaultMin: 'team_leader' },
  { feature: 'teams', label: 'Teams', description: 'Manage teams and members', defaultMin: 'team_leader' },
  { feature: 'outlets', label: 'Outlets', description: 'Manage outlet locations', defaultMin: 'dept_head' },
  { feature: 'checklists', label: 'Checklists', description: 'Manage inspection templates', defaultMin: 'dept_head' },
  { feature: 'schedules', label: 'Schedules', description: 'Manage inspection schedules', defaultMin: 'area_manager' },
  { feature: 'pillar', label: 'Alpro Pillar', description: 'Create and manage Pillar templates', defaultMin: 'dept_head' },
]

/** Pillar templates may be built/assigned only by dept_head+. */
export function canManagePillarTemplates(role: UserRole): boolean {
  return hasRole(role, 'dept_head')
}

export type FeaturePermissions = Partial<Record<FeatureName, UserRole>>

export function canAccessFeature(
  userRole: UserRole,
  feature: FeatureName,
  permissions: FeaturePermissions
): boolean {
  const minRole = permissions[feature] ?? FEATURE_DEFINITIONS.find(f => f.feature === feature)?.defaultMin ?? 'dept_head'
  return hasRole(userRole, minRole)
}
