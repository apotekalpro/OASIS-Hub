'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Target, Trash2, Pencil, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { PillarTemplateForm } from './pillar-template-form'
import { PillarAssignModal } from './pillar-assign-modal'
import type { PickerOutlet, PickerPerson } from '@/components/ui/pillar-target-picker'

type KRTemplate = { id: string; title: string; metric_type: string; start_value: number; target_value: number; unit: string | null }
type SubtaskTemplate = { id: string; title: string }
type Department = { id: string; name: string }

type Template = {
  id: string
  title: string
  description: string | null
  dept_id: string | null
  is_active: boolean
  departments: { name: string } | null
  pillar_kr_templates: KRTemplate[]
  pillar_subtask_templates: SubtaskTemplate[]
}

interface Props {
  initialTemplates: Template[]
  outlets: PickerOutlet[]
  users: PickerPerson[]
  areaManagers: PickerPerson[]
  departments: Department[]
}

export function PillarTemplatesClient({ initialTemplates, outlets, users, areaManagers, departments }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState(initialTemplates)
  useEffect(() => { setTemplates(initialTemplates) }, [initialTemplates])

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template? Existing assignments made from it will keep their data.')) return
    const res = await fetch(`/api/pillar/templates/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTemplates(prev => prev.filter(t => t.id !== id))
      router.refresh()
    } else {
      toast.error('Failed to delete template')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">{templates.length} template{templates.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <PillarAssignModal
            templateId={null}
            outlets={outlets}
            users={users}
            areaManagers={areaManagers}
            departments={departments}
            trigger={<Button variant="outline"><Send className="h-4 w-4" /> Create Adhoc Pillar</Button>}
          />
          <PillarTemplateForm
            departments={departments}
            trigger={<Button><Plus className="h-4 w-4" /> New Template</Button>}
          />
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No Pillar templates yet</p>
          <p className="text-sm mt-1">Create your first template to start assigning Pillars.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm">{t.title}</h3>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
                {t.departments?.name && <Badge variant="secondary" className="shrink-0">{t.departments.name}</Badge>}
              </div>

              {t.pillar_kr_templates.length > 0 && (
                <div className="text-xs text-gray-500">
                  {t.pillar_kr_templates.length} Key Result{t.pillar_kr_templates.length !== 1 ? 's' : ''}: {t.pillar_kr_templates.map(kr => kr.title).join(', ')}
                </div>
              )}

              <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
                <PillarAssignModal
                  templateId={t.id}
                  defaultTitle={t.title}
                  outlets={outlets}
                  users={users}
                  areaManagers={areaManagers}
                  departments={departments}
                  trigger={<Button size="sm"><Send className="h-3.5 w-3.5" /> Assign</Button>}
                />
                <PillarTemplateForm
                  departments={departments}
                  template={t}
                  trigger={<Button size="sm" variant="outline"><Pencil className="h-3.5 w-3.5" /></Button>}
                />
                <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)} className="text-red-500 hover:text-red-600 ml-auto">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
