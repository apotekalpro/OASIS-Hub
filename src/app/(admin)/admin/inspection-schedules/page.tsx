import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Building2 } from 'lucide-react'
import { ScheduleManagementClient } from '@/components/inspections/schedule-management-client'

const FREQ_LABELS: Record<string, string> = {
  once: 'Once', daily: 'Daily', weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly',
}

export default async function InspectionSchedulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const profileRes = await admin.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profileRes.data?.org_id ?? ''
  const role = profileRes.data?.role ?? ''
  const isAreaManager = role === 'area_manager'

  // For area managers, restrict outlets to only the ones they manage
  let amOutletIds: string[] = []
  if (isAreaManager) {
    const { data: amOutlets } = await admin
      .from('outlets')
      .select('id')
      .eq('area_manager_id', user.id)
      .eq('status', 'active')
    amOutletIds = (amOutlets ?? []).map(o => o.id)
  }

  let schedulesQ = admin
    .from('inspection_schedules')
    .select('*, inspection_templates(title, category), outlets(name, code), profiles!inspection_schedules_assigned_to_fkey(full_name)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  // Area managers only see schedules for their outlets
  if (isAreaManager && amOutletIds.length > 0) {
    schedulesQ = schedulesQ.in('outlet_id', amOutletIds)
  }

  let outletsQ = admin.from('outlets').select('id, name, code').eq('org_id', orgId).eq('status', 'active').order('name')
  // Area managers can only create schedules for their own outlets
  if (isAreaManager && amOutletIds.length > 0) {
    outletsQ = outletsQ.in('id', amOutletIds)
  }

  // For AM: only show outlet/member users as assignable; full orgs for admins
  const usersRoleFilter = isAreaManager ? ['outlet', 'area_manager', 'member'] : null

  const [schedulesRes, templatesRes, outletsRes, usersRes, deptsRes] = await Promise.all([
    schedulesQ,
    admin.from('inspection_templates').select('id, title, category').eq('org_id', orgId).eq('is_active', true).order('title'),
    outletsQ,
    usersRoleFilter
      ? admin.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).in('role', usersRoleFilter).order('full_name')
      : admin.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
    admin.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type ScheduleRow = {
    id: string; frequency: string; scheduled_time: string | null; is_active: boolean; starts_at: string
    template_id?: string; outlet_id?: string | null; assigned_to?: string | null
    outlet_scope?: string; assign_type?: string; assigned_role?: string | null; assigned_dept_id?: string | null
    due_hours?: number | null
    inspection_templates?: { title: string; category: string | null } | null
    outlets?: { name: string; code: string | null } | null
    profiles?: { full_name: string } | null
  }

  const schedules = (schedulesRes.data ?? []) as ScheduleRow[]
  const templates = templatesRes.data ?? []
  const outlets = outletsRes.data ?? []
  const orgUsers = usersRes.data ?? []
  const departments = deptsRes.data ?? []

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspection Schedules</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Assign checklists to outlets on a recurring schedule.
          </p>
        </div>
        <ScheduleManagementClient
          orgId={orgId}
          templates={templates}
          outlets={outlets}
          users={orgUsers}
          departments={departments}
          mode="create"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold">{schedules.length}</p>
          <p className="text-sm text-gray-500">Total Schedules</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-green-600">{schedules.filter(s => s.is_active).length}</p>
          <p className="text-sm text-gray-500">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-indigo-600">{schedules.filter(s => s.frequency === 'daily').length}</p>
          <p className="text-sm text-gray-500">Daily</p>
        </CardContent></Card>
      </div>

      {schedules.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No schedules yet</p>
          <p className="text-sm text-gray-400 mt-1">Assign a checklist template to an outlet to create a schedule.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {schedules.map(schedule => (
            <Card key={schedule.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{schedule.inspection_templates?.title}</p>
                      <Badge variant={schedule.is_active ? 'success' : 'secondary'} className="text-xs">
                        {schedule.is_active ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {schedule.outlet_scope === 'all' && 'All Outlets'}
                        {schedule.outlet_scope === 'assignee_area' && "Assignee's Area"}
                        {(!schedule.outlet_scope || schedule.outlet_scope === 'specific') && schedule.outlets && (
                          <>{schedule.outlets.name}{schedule.outlets.code && <span className="font-mono text-gray-400"> ({schedule.outlets.code})</span>}</>
                        )}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {FREQ_LABELS[schedule.frequency] ?? schedule.frequency}
                        {schedule.scheduled_time && ` at ${schedule.scheduled_time.slice(0, 5)}`}
                        {schedule.due_hours && ` · due in ${schedule.due_hours}h`}
                      </span>
                      <span>
                        {schedule.assign_type === 'user' && schedule.profiles && `→ ${schedule.profiles.full_name}`}
                        {schedule.assign_type === 'role' && schedule.assigned_role && `→ Role: ${schedule.assigned_role}`}
                        {(!schedule.assign_type || schedule.assign_type === 'any') && '→ Any Staff'}
                      </span>
                    </div>
                  </div>
                  <ScheduleManagementClient
                    orgId={orgId}
                    templates={templates}
                    outlets={outlets}
                    users={orgUsers}
                    departments={departments}
                    schedule={schedule}
                    scheduleId={schedule.id}
                    mode="actions"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
