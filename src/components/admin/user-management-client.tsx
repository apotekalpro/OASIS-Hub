'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Upload, RotateCcw, UserX, UserCheck, Edit2, MoreHorizontal } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ROLE_LABELS } from '@/lib/auth/permissions'
import { createUser, importUsers, resetUserPassword, toggleUserActive, updateUserProfile } from '@/lib/auth/actions'
import { parseCSV } from '@/lib/utils'
import { toast } from 'sonner'
import type { UserRole, Profile, Department } from '@/types/database'

const ASSIGNABLE_ROLES: UserRole[] = ['org_admin', 'dept_head', 'lead', 'team_leader', 'member', 'auditor', 'viewer']

const userSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  role: z.enum(['org_admin', 'dept_head', 'lead', 'team_leader', 'member', 'auditor', 'viewer']),
  dept_id: z.string().optional(),
  employee_id: z.string().optional(),
  job_title: z.string().optional(),
  phone: z.string().optional(),
})

type UserFormData = z.infer<typeof userSchema>

interface Props {
  departments: Pick<Department, 'id' | 'name'>[]
  orgId: string
  userId?: string
  user?: Partial<Profile>
  mode?: 'create' | 'actions'
}

export function UserManagementClient({ departments, orgId, userId, user, mode = 'create' }: Props) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importResults, setImportResults] = useState<{ email: string; success: boolean; error?: string }[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: user ? {
      email: user.email,
      full_name: user.full_name,
      role: user.role as UserFormData['role'],
      dept_id: user.dept_id ?? undefined,
      employee_id: user.employee_id ?? undefined,
      job_title: user.job_title ?? undefined,
    } : undefined,
  })

  async function onCreateUser(data: UserFormData) {
    try {
      if (userId) {
        await updateUserProfile(userId, data)
        toast.success('User updated successfully')
      } else {
        await createUser({ ...data, org_id: orgId })
        toast.success(`User created. Default password: Alpro@123`)
      }
      setCreateOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      const users = rows.map(r => ({
        email: r.email || r.Email,
        full_name: r.full_name || r['Full Name'] || r.name,
        role: (r.role || r.Role || 'member') as UserRole,
        dept_id: r.dept_id || r.department_id || undefined,
        employee_id: r.employee_id || r['Employee ID'] || undefined,
        job_title: r.job_title || r['Job Title'] || undefined,
      }))
      const results = await importUsers(users, orgId)
      setImportResults(results)
      router.refresh()
    } catch (err) {
      toast.error('Failed to parse CSV: ' + (err as Error).message)
    } finally {
      setImporting(false)
    }
  }

  async function handleReset() {
    if (!userId) return
    try {
      await resetUserPassword(userId)
      toast.success('Password reset to Alpro@123')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  async function handleToggleActive() {
    if (!userId || !user) return
    try {
      await toggleUserActive(userId, !user.is_active)
      toast.success(user.is_active ? 'User deactivated' : 'User activated')
      router.refresh()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  // ── Action menu for existing users ───────────────────────────────────────────
  if (mode === 'actions') {
    return (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon-sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[160px] bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-sm"
            align="end"
          >
            <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
              <Dialog.Trigger asChild>
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-50 cursor-pointer outline-none">
                  <Edit2 className="h-4 w-4" /> Edit User
                </DropdownMenu.Item>
              </Dialog.Trigger>
              <UserFormDialog
                title="Edit User"
                departments={departments}
                register={register}
                handleSubmit={handleSubmit}
                onSubmit={onCreateUser}
                errors={errors}
                isSubmitting={isSubmitting}
                open={createOpen}
                onOpenChange={setCreateOpen}
              />
            </Dialog.Root>

            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 text-amber-600 hover:bg-amber-50 cursor-pointer outline-none"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" /> Reset Password
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className="flex items-center gap-2 px-3 py-2 cursor-pointer outline-none"
              onClick={handleToggleActive}
            >
              {user?.is_active ? (
                <><UserX className="h-4 w-4 text-red-600" /><span className="text-red-600">Deactivate</span></>
              ) : (
                <><UserCheck className="h-4 w-4 text-green-600" /><span className="text-green-600">Activate</span></>
              )}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  // ── Create / Import buttons ────────────────────────────────────────────────
  return (
    <div className="flex items-center gap-2">
      {/* Import CSV */}
      <Dialog.Root open={importOpen} onOpenChange={setImportOpen}>
        <Dialog.Trigger asChild>
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6">
            <Dialog.Title className="text-lg font-semibold mb-2">Import Users from CSV</Dialog.Title>
            <Dialog.Description className="text-sm text-gray-500 mb-4">
              CSV must have columns: <code className="bg-gray-100 px-1 rounded text-xs">email, full_name, role, dept_id (optional), employee_id (optional), job_title (optional)</code>
            </Dialog.Description>

            <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center mb-4">
              <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSVImport} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} loading={importing}>
                <Upload className="h-4 w-4" /> Choose CSV File
              </Button>
              <p className="text-xs text-gray-400 mt-2">All imported users get password: Alpro@123</p>
            </div>

            {importResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {importResults.map(r => (
                  <div key={r.email} className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    <span>{r.success ? '✓' : '✗'}</span>
                    <span className="font-medium">{r.email}</span>
                    {r.error && <span className="text-red-500">— {r.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Create User */}
      <Dialog.Root open={createOpen} onOpenChange={setCreateOpen}>
        <Dialog.Trigger asChild>
          <Button size="sm">
            <Plus className="h-4 w-4" /> Add User
          </Button>
        </Dialog.Trigger>
        <UserFormDialog
          title="Create New User"
          departments={departments}
          register={register}
          handleSubmit={handleSubmit}
          onSubmit={onCreateUser}
          errors={errors}
          isSubmitting={isSubmitting}
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      </Dialog.Root>
    </div>
  )
}

// Shared form dialog component
function UserFormDialog({
  title, departments, register, handleSubmit, onSubmit, errors, isSubmitting, open, onOpenChange
}: {
  title: string
  departments: Pick<Department, 'id' | 'name'>[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleSubmit: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: any
  isSubmitting: boolean
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl p-6">
        <Dialog.Title className="text-lg font-semibold mb-1">{title}</Dialog.Title>
        <Dialog.Description className="text-sm text-gray-500 mb-4">
          Default password: <code className="bg-gray-100 px-1 rounded text-xs font-mono">Alpro@123</code> — user must change on first login.
        </Dialog.Description>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <Input placeholder="Ahmad Razif" error={errors.full_name?.message} {...register('full_name')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <Input type="email" placeholder="ahmad@company.com" error={errors.email?.message} {...register('email')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('role')}>
                {ASSIGNABLE_ROLES.map(r => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" {...register('dept_id')}>
                <option value="">— None —</option>
                {departments.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Employee ID</label>
              <Input placeholder="EMP-001" {...register('employee_id')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <Input placeholder="Senior Manager" {...register('job_title')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <Input placeholder="+60 12-345 6789" {...register('phone')} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Dialog.Close asChild>
              <Button type="button" variant="outline">Cancel</Button>
            </Dialog.Close>
            <Button type="submit" loading={isSubmitting}>
              {title.startsWith('Edit') ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  )
}
