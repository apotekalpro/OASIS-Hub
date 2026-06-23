import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser, getCachedProfile, getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { PillarTemplatesClient } from '@/components/pillar/pillar-templates-client'
import type { UserRole } from '@/types/database'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PillarTemplatesPage() {
  const admin = createAdminClient()
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getCachedProfile(user.id)
  const orgId = (profile?.org_id ?? '') as string
  const role = (profile?.role ?? 'member') as UserRole
  const featurePermissions = await getCachedFeaturePermissions(orgId)

  if (!canManagePillarTemplates(role, featurePermissions)) redirect('/dashboard')

  const [templatesRes, outletsRes, usersRes, amRes, deptsRes] = await Promise.all([
    admin.from('pillar_templates').select('*, departments(name), pillar_kr_templates(*)').eq('org_id', orgId).order('created_at', { ascending: false }),
    admin.from('outlets').select('id, name, code, dept_id, area_manager_id').eq('org_id', orgId).ilike('name', '%Apotek Alpro%').order('name'),
    admin.from('profiles').select('id, full_name, email, avatar_url, dept_id, role').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('role', 'area_manager').eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Alpro Pillar Templates</h1>
        <p className="text-gray-500 text-sm mt-0.5">Build reusable Pillar templates and assign them to outlets, area managers, departments, roles, or people</p>
      </div>
      <PillarTemplatesClient
        initialTemplates={templatesRes.data ?? []}
        outlets={outletsRes.data ?? []}
        users={usersRes.data ?? []}
        areaManagers={amRes.data ?? []}
        departments={deptsRes.data ?? []}
      />
    </div>
  )
}
