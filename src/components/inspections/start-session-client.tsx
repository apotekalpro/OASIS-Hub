'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Props {
  outletId: string
  scheduleId: string
  templateId: string
  templateTitle: string
  conductedBy: string
}

export function StartSessionClient({ outletId, scheduleId, templateId, templateTitle, conductedBy }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function startSession() {
    setLoading(true)
    const supabase = createClient()

    const profileRes = await supabase.from('profiles').select('org_id').eq('id', conductedBy).single()
    const orgId = profileRes.data?.org_id
    if (!orgId) { toast.error('Could not determine organisation'); setLoading(false); return }

    const { data, error } = await supabase
      .from('inspection_sessions')
      .insert({
        org_id: orgId,
        schedule_id: scheduleId,
        template_id: templateId,
        outlet_id: outletId,
        conducted_by: conductedBy,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        scheduled_for: new Date().toISOString(),
      })
      .select('id')
      .single()

    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Starting: ${templateTitle}`)
    router.push(`/inspections/${outletId}/sessions/${(data as { id: string }).id}`)
  }

  return (
    <Button size="sm" onClick={startSession} loading={loading}>
      <Play className="h-3.5 w-3.5" /> Start
    </Button>
  )
}
