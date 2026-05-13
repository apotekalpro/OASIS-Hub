'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormBuilderDialog } from './form-builder-dialog'
import { AssignFormDialog } from './assign-form-dialog'
import { createClient } from '@/lib/supabase/client'
import {
  ClipboardList, Plus, Calendar, CheckCircle2, Clock,
  AlertCircle, Eye, Edit2, Users, MoreHorizontal, Trash2
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'

type Template = {
  id: string; title: string; description: string | null; is_active: boolean
  passing_score: number | null; created_at: string; dept_id: string | null
  departments?: { name: string } | null
}
type Assignment = {
  id: string; due_date: string | null; is_recurring: boolean; form_id: string
  form_templates?: { id: string; title: string; description: string | null } | null
  form_submissions?: Array<{ id: string; status: string; score: number | null; submitted_at: string | null }>
}

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary', submitted: 'default', in_review: 'warning', approved: 'success', rejected: 'destructive',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected',
}

const isManager = (role: string) => ['super_admin', 'org_admin', 'dept_head'].includes(role)

interface Props {
  templates: Template[]
  assignments: Assignment[]
  orgId: string
  currentUserId: string
  userRole: string
  departments: Array<{ id: string; name: string }>
  teams: Array<{ id: string; name: string }>
}

export function FormsClient({ templates: initialTemplates, assignments, orgId, currentUserId, userRole, departments, teams }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [templates, setTemplates] = useState(initialTemplates)
  const [tab, setTab] = useState<'library' | 'assigned'>(isManager(userRole) ? 'library' : 'assigned')

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this form template? All submissions will be lost.')) return
    const { error } = await supabase.from('form_templates').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      setTemplates(prev => prev.filter(t => t.id !== id))
      toast.success('Template deleted')
    }
  }

  async function toggleActive(t: Template) {
    const { error } = await supabase.from('form_templates').update({ is_active: !t.is_active }).eq('id', t.id)
    if (error) toast.error(error.message)
    else setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspection Forms</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isManager(userRole)
              ? `${templates.length} templates · ${templates.filter(t => t.is_active).length} active`
              : `${assignments.length} assigned to you`}
          </p>
        </div>
        {isManager(userRole) && (
          <FormBuilderDialog
            orgId={orgId}
            currentUserId={currentUserId}
            departments={departments}
            onCreated={(tmpl) => setTemplates(prev => [tmpl, ...prev])}
            trigger={<Button size="sm"><Plus className="h-4 w-4" /> New Form</Button>}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {isManager(userRole) && (
          <button
            onClick={() => setTab('library')}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-all', tab === 'library' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            Form Library
          </button>
        )}
        <button
          onClick={() => setTab('assigned')}
          className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-all', tab === 'assigned' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}
        >
          My Assignments
          {assignments.filter(a => {
            const sub = a.form_submissions?.[0]
            return !sub || sub.status === 'draft'
          }).length > 0 && (
            <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {assignments.filter(a => { const s = a.form_submissions?.[0]; return !s || s.status === 'draft' }).length}
            </span>
          )}
        </button>
      </div>

      {/* Form Library */}
      {tab === 'library' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3 hover:shadow-md hover:border-indigo-200 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 truncate">{t.title}</h3>
                    {!t.is_active && <Badge variant="secondary">Inactive</Badge>}
                  </div>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button className="text-gray-400 hover:text-gray-600 shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="z-50 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[160px]" align="end">
                      <DropdownMenu.Item asChild>
                        <Link href={`/forms/${t.id}`} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                          <Eye className="h-4 w-4" /> View Submissions
                        </Link>
                      </DropdownMenu.Item>
                      <DropdownMenu.Item asChild>
                        <FormBuilderDialog
                          orgId={orgId}
                          currentUserId={currentUserId}
                          departments={departments}
                          template={t}
                          onCreated={(updated) => setTemplates(prev => prev.map(x => x.id === updated.id ? updated : x))}
                          trigger={
                            <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer w-full text-left">
                              <Edit2 className="h-4 w-4" /> Edit
                            </button>
                          }
                        />
                      </DropdownMenu.Item>
                      <DropdownMenu.Item asChild>
                        <AssignFormDialog
                          formId={t.id}
                          formTitle={t.title}
                          orgId={orgId}
                          currentUserId={currentUserId}
                          teams={teams}
                          trigger={
                            <button className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer w-full text-left">
                              <Users className="h-4 w-4" /> Assign
                            </button>
                          }
                        />
                      </DropdownMenu.Item>
                      <DropdownMenu.Item onClick={() => toggleActive(t)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                        {t.is_active ? 'Deactivate' : 'Activate'}
                      </DropdownMenu.Item>
                      <DropdownMenu.Separator className="my-1 border-t border-gray-100" />
                      <DropdownMenu.Item onClick={() => deleteTemplate(t.id)} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu.Root>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                {t.departments?.name && <span>{t.departments.name}</span>}
                {t.passing_score && <span>Pass: {t.passing_score}%</span>}
                <span className="ml-auto">{formatDate(t.created_at)}</span>
              </div>

              <div className="flex gap-2 pt-1 border-t border-gray-100">
                <Link href={`/forms/${t.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="h-3.5 w-3.5" /> Submissions
                  </Button>
                </Link>
                <AssignFormDialog
                  formId={t.id}
                  formTitle={t.title}
                  orgId={orgId}
                  currentUserId={currentUserId}
                  teams={teams}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                  }
                />
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No form templates yet. Create your first form.</p>
            </div>
          )}
        </div>
      )}

      {/* My Assignments */}
      {tab === 'assigned' && (
        <div className="space-y-3">
          {assignments.map(a => {
            const form = a.form_templates
            const latestSub = a.form_submissions?.[0]
            const overdue = a.due_date && new Date(a.due_date) < new Date() && (!latestSub || latestSub.status === 'draft')

            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-4">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                    latestSub?.status === 'approved' ? 'bg-green-100' :
                    latestSub?.status === 'rejected' ? 'bg-red-100' :
                    latestSub?.status === 'submitted' || latestSub?.status === 'in_review' ? 'bg-blue-100' :
                    overdue ? 'bg-red-100' : 'bg-indigo-100'
                  )}>
                    {latestSub?.status === 'approved' ? <CheckCircle2 className="h-5 w-5 text-green-600" /> :
                     latestSub?.status === 'rejected' ? <AlertCircle className="h-5 w-5 text-red-600" /> :
                     overdue ? <AlertCircle className="h-5 w-5 text-red-600" /> :
                     <ClipboardList className="h-5 w-5 text-indigo-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900 truncate">{form?.title ?? 'Untitled Form'}</h3>
                      {latestSub && (
                        <Badge variant={STATUS_VARIANT[latestSub.status] ?? 'secondary'}>
                          {STATUS_LABEL[latestSub.status]}
                        </Badge>
                      )}
                      {!latestSub && <Badge variant="secondary">Not Started</Badge>}
                    </div>
                    {form?.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{form.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {a.due_date && (
                        <span className={cn('flex items-center gap-1', overdue && 'text-red-600 font-medium')}>
                          <Calendar className="h-3 w-3" />
                          {overdue ? 'Overdue · ' : 'Due '}
                          {formatDate(a.due_date)}
                        </span>
                      )}
                      {latestSub?.score != null && (
                        <span className="flex items-center gap-1">
                          Score: <strong>{latestSub.score}%</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {(!latestSub || latestSub.status === 'draft') && form ? (
                      <Link href={`/forms/${form.id}/submit?assignment=${a.id}${latestSub ? `&submission=${latestSub.id}` : ''}`}>
                        <Button size="sm" variant={overdue ? 'destructive' : 'default'}>
                          {latestSub ? 'Continue' : 'Start'}
                        </Button>
                      </Link>
                    ) : latestSub && form ? (
                      <Link href={`/forms/${form.id}/submissions/${latestSub.id}`}>
                        <Button size="sm" variant="outline">View</Button>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}

          {assignments.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No forms assigned to you</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
