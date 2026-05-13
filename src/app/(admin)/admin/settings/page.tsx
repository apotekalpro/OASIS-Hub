import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Shield, Bell, Database, Key } from 'lucide-react'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileRes, orgRes, statsRes] = await Promise.all([
    supabase.from('profiles').select('org_id, role, full_name').eq('id', user.id).single(),
    supabase.from('organizations').select('id, name, created_at').limit(1).single(),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ])

  const profile = profileRes.data as { org_id: string; role: string; full_name: string } | null
  const org = orgRes.data as { id: string; name: string; created_at: string } | null
  const userCount = statsRes.count ?? 0

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">System configuration and environment info</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Organisation */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-indigo-500" /> Organisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{org?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Org ID</span>
              <span className="font-mono text-xs text-gray-400 truncate max-w-[180px]">{org?.id ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Active Members</span>
              <span className="font-medium text-gray-900">{userCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span className="text-gray-600">{org?.created_at ? new Date(org.created_at).toLocaleDateString() : '—'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Your account */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-indigo-500" /> Your Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Name</span>
              <span className="font-medium text-gray-900">{profile?.full_name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Role</span>
              <Badge variant="default">{profile?.role ?? '—'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">User ID</span>
              <span className="font-mono text-xs text-gray-400 truncate max-w-[180px]">{user.id}</span>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-500" /> Notifications & Reminders
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600">
            <p>In-app notifications are delivered in real-time via Supabase Realtime.</p>
            <p>Email notifications require a Resend API key configured in <code className="bg-gray-100 px-1 rounded text-xs">.env.local</code>.</p>
            <p>Reminder processing runs via <code className="bg-gray-100 px-1 rounded text-xs">POST /api/reminders/process</code> — schedule this endpoint every 5 minutes using a cron service.</p>
          </CardContent>
        </Card>

        {/* Supabase setup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-500" /> Supabase Setup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>Enable <strong>Realtime</strong> in your Supabase dashboard for these tables:</p>
            <ul className="list-disc pl-4 space-y-0.5 text-xs font-mono">
              <li>notifications</li>
              <li>messages</li>
              <li>task_comments</li>
            </ul>
            <p className="pt-1">Create a storage bucket named <code className="bg-gray-100 px-1 rounded text-xs">org-files</code> for the file manager.</p>
          </CardContent>
        </Card>

        {/* Migrations */}
        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4 text-indigo-500" /> Migration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { file: '001_initial_schema', label: 'Initial Schema' },
                { file: '002_rls_policies', label: 'RLS Policies' },
                { file: '003_functions', label: 'Functions & Triggers' },
                { file: '004_seed', label: 'Seed SuperAdmin' },
                { file: '005_phase2_teams', label: 'Phase 2 — Teams' },
                { file: '006_phase3_tasks', label: 'Phase 3 — Tasks' },
                { file: '007_phase4_messaging', label: 'Phase 4 — Messages' },
                { file: '008_phase5_forms', label: 'Phase 5 — Forms' },
                { file: '009_phase6_analytics', label: 'Phase 6 — Analytics' },
                { file: '010_phase7_calendar', label: 'Phase 7 — Calendar/Files' },
              ].map(m => (
                <div key={m.file} className="text-xs rounded-lg border border-gray-200 px-3 py-2">
                  <p className="font-medium text-gray-700">{m.label}</p>
                  <p className="text-gray-400 mt-0.5 font-mono">{m.file.split('_')[0]}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
