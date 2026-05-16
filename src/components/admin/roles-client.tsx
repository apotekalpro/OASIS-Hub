'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Edit2, Trash2, KeyRound } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createCustomRole, updateCustomRole, deleteCustomRole } from '@/lib/auth/actions'
import { toast } from 'sonner'
import type { Role } from '@/types/database'

const COLOR_PRESETS = [
  'bg-gray-100 text-gray-800',
  'bg-red-100 text-red-800',
  'bg-orange-100 text-orange-800',
  'bg-yellow-100 text-yellow-800',
  'bg-green-100 text-green-800',
  'bg-teal-100 text-teal-800',
  'bg-blue-100 text-blue-800',
  'bg-indigo-100 text-indigo-800',
  'bg-purple-100 text-purple-800',
  'bg-pink-100 text-pink-800',
  'bg-cyan-100 text-cyan-800',
  'bg-slate-100 text-slate-600',
]

// Extract the swatch background color from a color class pair
function swatchBg(color: string): string {
  const bg = color.split(' ').find(c => c.startsWith('bg-'))
  return bg ?? 'bg-gray-100'
}

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/[\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

const roleSchema = z.object({
  label: z.string().min(2, 'Label must be at least 2 characters'),
  levelStr: z.string().regex(/^\d+$/, 'Must be a whole number between 1 and 79'),
  color: z.string().min(1, 'Select a color'),
})

type RoleFormData = z.infer<typeof roleSchema>

interface Props {
  roles: Role[]
  roleCounts: Record<string, number>
  orgId: string
  currentUserRole: string
}

export function RolesClient({ roles, roleCounts, orgId, currentUserRole }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editRole, setEditRole] = useState<Role | null>(null)
  const [deleteRole, setDeleteRole] = useState<Role | null>(null)
  const [deleting, setDeleting] = useState(false)

  const systemRoles = roles.filter(r => r.is_system)
  const customRoles = roles.filter(r => !r.is_system)

  const canManage = ['super_admin', 'org_admin'].includes(currentUserRole)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Role Management</h1>
          </div>
          <p className="text-gray-500 text-sm mt-0.5">
            Define roles and permission levels for your organization. System roles cannot be modified.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Role
          </Button>
        )}
      </div>

      {/* System Roles */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">System Roles</h2>
          <p className="text-xs text-gray-400 mt-0.5">Built-in roles that cannot be edited or deleted</p>
        </div>
        <RolesTable
          roles={systemRoles}
          roleCounts={roleCounts}
          canManage={false}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </div>

      {/* Custom Roles */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Custom Roles</h2>
          <p className="text-xs text-gray-400 mt-0.5">Organization-specific roles you have defined</p>
        </div>
        {customRoles.length === 0 ? (
          <div className="px-6 py-10 text-center text-gray-400 text-sm">
            No custom roles yet.{canManage && ' Click "Add Role" to create one.'}
          </div>
        ) : (
          <RolesTable
            roles={customRoles}
            roleCounts={roleCounts}
            canManage={canManage}
            onEdit={setEditRole}
            onDelete={setDeleteRole}
          />
        )}
      </div>

      {/* Add Role Dialog */}
      <Dialog.Root open={addOpen} onOpenChange={setAddOpen}>
        <RoleFormDialog
          title="Add Custom Role"
          orgId={orgId}
          onSuccess={() => { setAddOpen(false); router.refresh() }}
        />
      </Dialog.Root>

      {/* Edit Role Dialog */}
      <Dialog.Root open={!!editRole} onOpenChange={open => { if (!open) setEditRole(null) }}>
        {editRole && (
          <RoleFormDialog
            title="Edit Role"
            orgId={orgId}
            editSlug={editRole.slug}
            defaultValues={{ label: editRole.label, level: editRole.level, color: editRole.color }}
            onSuccess={() => { setEditRole(null); router.refresh() }}
          />
        )}
      </Dialog.Root>

      {/* Delete Confirmation Dialog */}
      <Dialog.Root open={!!deleteRole} onOpenChange={open => { if (!open) setDeleteRole(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-6">
            <Dialog.Title className="text-lg font-semibold mb-1 text-red-600">Delete Role</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-4">
              This action cannot be undone. Any users with this role must be reassigned first.
            </Dialog.Description>
            {deleteRole && (
              <div className="bg-gray-50 rounded-lg p-3 mb-4 flex items-center gap-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${deleteRole.color}`}>
                  {deleteRole.label}
                </span>
                <code className="text-xs text-gray-500 font-mono">{deleteRole.slug}</code>
                {roleCounts[deleteRole.slug] ? (
                  <span className="ml-auto text-xs text-red-600 font-medium">
                    {roleCounts[deleteRole.slug]} user{roleCounts[deleteRole.slug] === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Dialog.Close asChild>
                <Button variant="outline" disabled={deleting}>Cancel</Button>
              </Dialog.Close>
              <Button
                variant="destructive"
                loading={deleting}
                onClick={async () => {
                  if (!deleteRole) return
                  setDeleting(true)
                  try {
                    await deleteCustomRole(deleteRole.slug)
                    toast.success('Role deleted')
                    setDeleteRole(null)
                    router.refresh()
                  } catch (err) {
                    toast.error((err as Error).message)
                  } finally {
                    setDeleting(false)
                  }
                }}
              >
                Delete Role
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}

function RolesTable({
  roles,
  roleCounts,
  canManage,
  onEdit,
  onDelete,
}: {
  roles: Role[]
  roleCounts: Record<string, number>
  canManage: boolean
  onEdit: (role: Role) => void
  onDelete: (role: Role) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-6 py-3 font-medium text-gray-500 w-8"></th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Slug</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Label</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Level</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Users</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
            {canManage && <th className="text-right px-6 py-3 font-medium text-gray-500">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {roles.map(role => (
            <tr key={role.slug} className="hover:bg-gray-50 transition-colors">
              <td className="px-6 py-3">
                <span className={`inline-block h-4 w-4 rounded-full ${swatchBg(role.color)} border border-white shadow-sm ring-1 ring-gray-200`} />
              </td>
              <td className="px-4 py-3">
                <code className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{role.slug}</code>
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${role.color}`}>
                  {role.label}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700 w-7 text-right shrink-0">{role.level}</span>
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${Math.min(100, role.level)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                {roleCounts[role.slug] ? (
                  <Badge variant="secondary">{roleCounts[role.slug]}</Badge>
                ) : (
                  <span className="text-xs text-gray-300">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                {role.is_system ? (
                  <Badge variant="outline" className="text-xs">System</Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700">Custom</Badge>
                )}
              </td>
              {canManage && (
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onEdit(role)}
                      title="Edit role"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onDelete(role)}
                      title="Delete role"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RoleFormDialog({
  title,
  orgId,
  editSlug,
  defaultValues,
  onSuccess,
}: {
  title: string
  orgId: string
  editSlug?: string
  defaultValues?: { label: string; level: number; color: string }
  onSuccess: () => void
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting }, reset } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: defaultValues
      ? { label: defaultValues.label, levelStr: String(defaultValues.level ?? 20), color: defaultValues.color }
      : { color: COLOR_PRESETS[0], levelStr: '20' },
  })

  const watchedLabel = watch('label') ?? ''
  const watchedColor = watch('color') ?? COLOR_PRESETS[0]
  const derivedSlug = editSlug ?? slugify(watchedLabel)

  async function onSubmit(data: RoleFormData) {
    const level = parseInt(data.levelStr, 10)
    if (isNaN(level) || level < 1 || level > 79) {
      toast.error('Level must be between 1 and 79')
      return
    }
    const payload = { label: data.label, level, color: data.color }
    try {
      if (editSlug) {
        await updateCustomRole(editSlug, payload)
        toast.success('Role updated')
      } else {
        await createCustomRole({ ...payload, slug: derivedSlug, org_id: orgId })
        toast.success('Role created')
        reset()
      }
      onSuccess()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-xl shadow-xl p-6">
        <Dialog.Title className="text-lg font-semibold mb-1">{title}</Dialog.Title>
        <Dialog.Description className="text-sm text-gray-500 mb-4">
          Custom roles can be assigned to users in your organization. Level range: 1–79.
        </Dialog.Description>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Label *</label>
            <Input placeholder="Senior Pharmacist" error={errors.label?.message} {...register('label')} />
          </div>

          {/* Auto slug preview */}
          {!editSlug && (
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Slug (auto-generated)</label>
              <code className="block text-xs font-mono text-gray-600 bg-gray-100 px-3 py-2 rounded-md min-h-[2rem]">
                {derivedSlug || <span className="text-gray-300">slug will appear here</span>}
              </code>
            </div>
          )}

          {/* Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Level *
              <span className="ml-1 text-xs font-normal text-gray-400">(1–79; system roles use 80–100)</span>
            </label>
            <Input
              type="number"
              min={1}
              max={79}
              placeholder="20"
              error={errors.levelStr?.message}
              {...register('levelStr')}
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setValue('color', preset)}
                  className={`h-7 w-7 rounded-full border-2 transition-all ${swatchBg(preset)} ${
                    watchedColor === preset
                      ? 'border-indigo-500 scale-110 shadow-sm'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  title={preset}
                />
              ))}
            </div>
            {errors.color && <p className="text-xs text-red-500 mt-1">{errors.color.message}</p>}
          </div>

          {/* Badge preview */}
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Preview</label>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${watchedColor}`}>
              {watchedLabel || 'Role Label'}
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {editSlug ? 'Save Changes' : 'Create Role'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
