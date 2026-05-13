import { createClient } from '@/lib/supabase/server'
import { FilesClient } from '@/components/files/files-client'

export default async function FilesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
  const orgId = (profileRes.data as { org_id: string } | null)?.org_id ?? ''

  const [filesRes, teamsRes, deptsRes] = await Promise.all([
    supabase.from('files').select(`
      id, name, storage_path, mime_type, size_bytes, is_folder,
      created_at, parent_folder_id, team_id, dept_id,
      profiles!uploaded_by(id, full_name, avatar_url)
    `).eq('org_id', orgId).order('is_folder', { ascending: false }).order('name'),
    supabase.from('teams').select('id, name').eq('org_id', orgId).order('name'),
    supabase.from('departments').select('id, name').eq('org_id', orgId).order('name'),
  ])

  type RawFile = {
    id: string; name: string; storage_path: string | null; mime_type: string | null
    size_bytes: number | null; is_folder: boolean; created_at: string
    parent_folder_id: string | null; team_id: string | null; dept_id: string | null
    profiles?: { id: string; full_name: string; avatar_url: string | null } | null
  }

  const files = (filesRes.data as unknown as RawFile[]) ?? []
  const teams = (teamsRes.data as Array<{ id: string; name: string }>) ?? []
  const depts = (deptsRes.data as Array<{ id: string; name: string }>) ?? []

  return (
    <FilesClient
      initialFiles={files.map(f => ({ ...f, uploader: f.profiles ?? null }))}
      orgId={orgId}
      currentUserId={user.id}
      teams={teams}
      departments={depts}
    />
  )
}
