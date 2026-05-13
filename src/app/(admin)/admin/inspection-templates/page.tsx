import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Plus, ClipboardList, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { TemplateListClient } from '@/components/inspections/template-list-client'
import { formatDate } from '@/lib/utils'

export default async function InspectionTemplatesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = profileRes.data?.org_id ?? ''

  const [templatesRes, deptsRes] = await Promise.all([
    supabase
      .from('inspection_templates')
      .select('*, profiles!inspection_templates_created_by_fkey(full_name), departments(name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false }),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type TemplateRow = {
    id: string; title: string; description: string | null; category: string | null
    is_mystery_shopper: boolean; is_active: boolean; version: number
    passing_score: number | null; created_at: string
    profiles?: { full_name: string } | null
    departments?: { name: string } | null
  }

  const templates = (templatesRes.data ?? []) as TemplateRow[]
  const departments = deptsRes.data ?? []

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))] as string[]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspection Templates</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Build checklists and questionnaires for outlet inspections.
          </p>
        </div>
        <TemplateListClient orgId={orgId} departments={departments} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold">{templates.length}</p>
          <p className="text-sm text-gray-500">Total Templates</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-green-600">{templates.filter(t => t.is_active).length}</p>
          <p className="text-sm text-gray-500">Active</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-purple-600">{templates.filter(t => t.is_mystery_shopper).length}</p>
          <p className="text-sm text-gray-500">Mystery Shopper</p>
        </CardContent></Card>
      </div>

      {/* Template list */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center gap-3 text-center">
            <ClipboardList className="h-10 w-10 text-gray-300" />
            <p className="font-medium text-gray-500">No templates yet</p>
            <p className="text-sm text-gray-400">Create your first checklist template to begin scheduling inspections.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map(template => (
            <Card key={template.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900">{template.title}</p>
                          {template.is_mystery_shopper && (
                            <Badge variant="default" className="text-xs">Mystery Shopper</Badge>
                          )}
                          {!template.is_active && (
                            <Badge variant="secondary" className="text-xs flex items-center gap-1">
                              <EyeOff className="h-3 w-3" /> Inactive
                            </Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{template.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          {template.category && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{template.category}</span>}
                          {template.departments && <span>{template.departments.name}</span>}
                          {template.passing_score && <span>Pass: {template.passing_score}%</span>}
                          <span>v{template.version}</span>
                          <span>{formatDate(template.created_at)}</span>
                          {template.profiles && <span>by {template.profiles.full_name}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/admin/inspection-templates/${template.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Edit
                        </Link>
                        <TemplateListClient
                          orgId={orgId}
                          departments={departments}
                          template={template}
                          mode="actions"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
