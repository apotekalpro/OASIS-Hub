import type { UserRole } from '@/types/database'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  org_admin: 80,
  dept_head: 60,
  team_leader: 40,
  auditor: 35,
  member: 20,
  viewer: 10,
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
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

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Organization Admin',
  dept_head: 'Department Head',
  team_leader: 'Team Leader',
  auditor: 'Auditor',
  member: 'Member',
  viewer: 'Viewer',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  super_admin: 'bg-red-100 text-red-800',
  org_admin: 'bg-purple-100 text-purple-800',
  dept_head: 'bg-blue-100 text-blue-800',
  team_leader: 'bg-green-100 text-green-800',
  auditor: 'bg-yellow-100 text-yellow-800',
  member: 'bg-gray-100 text-gray-800',
  viewer: 'bg-slate-100 text-slate-600',
}
