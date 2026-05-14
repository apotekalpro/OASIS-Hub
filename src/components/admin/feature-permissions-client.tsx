'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FEATURE_DEFINITIONS, ROLE_LABELS, type FeatureName, type FeaturePermissions } from '@/lib/auth/permissions'
import { toast } from 'sonner'
import type { UserRole } from '@/types/database'

const CONFIGURABLE_ROLES: UserRole[] = ['org_admin', 'dept_head', 'lead', 'team_leader', 'auditor', 'member']

export function FeaturePermissionsClient({
  orgId,
  initial,
  canEdit,
}: {
  orgId: string
  initial: FeaturePermissions
  canEdit: boolean
}) {
  const [permissions, setPermissions] = useState<FeaturePermissions>(initial)
  const [saving, setSaving] = useState<FeatureName | null>(null)
  const supabase = createClient()

  async function handleChange(feature: FeatureName, minRole: UserRole) {
    if (!canEdit) return
    setPermissions(prev => ({ ...prev, [feature]: minRole }))
    setSaving(feature)
    const { error } = await supabase
      .from('feature_permissions')
      .upsert({ org_id: orgId, feature, min_role: minRole }, { onConflict: 'org_id,feature' })
    setSaving(null)
    if (error) toast.error('Failed to save')
    else toast.success('Access updated')
  }

  return (
    <div className="divide-y divide-gray-100">
      {FEATURE_DEFINITIONS.map(def => {
        const current = permissions[def.feature] ?? def.defaultMin
        return (
          <div key={def.feature} className="flex items-center justify-between py-3 gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900">{def.label}</p>
              <p className="text-xs text-gray-500">{def.description}</p>
            </div>
            <select
              disabled={!canEdit || saving === def.feature}
              value={current}
              onChange={e => handleChange(def.feature, e.target.value as UserRole)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {CONFIGURABLE_ROLES.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]} and above</option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}
