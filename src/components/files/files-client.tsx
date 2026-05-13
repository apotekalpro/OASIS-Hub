'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import {
  Folder, File, FileText, FileImage, FileVideo, FileArchive,
  Upload, FolderPlus, Download, Trash2, Search, ChevronRight,
  LayoutGrid, List, MoreHorizontal
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { formatDate, cn } from '@/lib/utils'
import { toast } from 'sonner'

type FileItem = {
  id: string; name: string; storage_path: string | null; mime_type: string | null
  size_bytes: number | null; is_folder: boolean; created_at: string
  parent_folder_id: string | null; team_id: string | null; dept_id: string | null
  uploader: { id: string; full_name: string; avatar_url: string | null } | null
}

interface Props {
  initialFiles: FileItem[]
  orgId: string
  currentUserId: string
  teams: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function FileIcon({ mime, isFolder, className }: { mime: string | null; isFolder: boolean; className?: string }) {
  if (isFolder) return <Folder className={cn('text-amber-500', className)} />
  if (!mime) return <File className={cn('text-gray-400', className)} />
  if (mime.startsWith('image/')) return <FileImage className={cn('text-purple-500', className)} />
  if (mime.startsWith('video/')) return <FileVideo className={cn('text-blue-500', className)} />
  if (mime.includes('pdf') || mime.includes('text') || mime.includes('document')) return <FileText className={cn('text-red-500', className)} />
  if (mime.includes('zip') || mime.includes('archive') || mime.includes('compressed')) return <FileArchive className={cn('text-orange-500', className)} />
  return <File className={cn('text-gray-400', className)} />
}

export function FilesClient({ initialFiles, orgId, currentUserId, teams, departments }: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<FileItem[]>(initialFiles)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([{ id: null, name: 'Files' }])
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [uploading, setUploading] = useState(false)

  const inView = files.filter(f => f.parent_folder_id === currentFolder)
  const filtered = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : inView

  const sorted = [...filtered].sort((a, b) => {
    if (a.is_folder !== b.is_folder) return a.is_folder ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  function openFolder(folder: FileItem) {
    setCurrentFolder(folder.id)
    setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }])
    setSearch('')
  }

  function navigateTo(crumb: { id: string | null; name: string }, idx: number) {
    setCurrentFolder(crumb.id)
    setBreadcrumbs(prev => prev.slice(0, idx + 1))
    setSearch('')
  }

  async function createFolder() {
    if (!newFolderName.trim()) return
    setCreatingFolder(true)
    const { data, error } = await supabase.from('files').insert({
      org_id: orgId,
      name: newFolderName.trim(),
      is_folder: true,
      parent_folder_id: currentFolder,
      uploaded_by: currentUserId,
    }).select('id, name, is_folder, created_at, parent_folder_id, storage_path, mime_type, size_bytes, team_id, dept_id').single()

    if (error) toast.error(error.message)
    else {
      setFiles(prev => [...prev, { ...(data as FileItem), uploader: null }])
      setNewFolderName('')
      toast.success('Folder created')
    }
    setCreatingFolder(false)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const uploadedFiles = Array.from(e.target.files ?? [])
    if (uploadedFiles.length === 0) return
    setUploading(true)

    for (const file of uploadedFiles) {
      const path = `${orgId}/${currentFolder ?? 'root'}/${Date.now()}_${file.name}`
      const { error: storageError } = await supabase.storage.from('org-files').upload(path, file)

      if (storageError) {
        // If storage bucket not set up, just record metadata
        toast.error(`Storage not configured. File metadata saved only.`)
      }

      const { data: fileRow, error } = await supabase.from('files').insert({
        org_id: orgId,
        name: file.name,
        storage_path: storageError ? null : path,
        mime_type: file.type || null,
        size_bytes: file.size,
        is_folder: false,
        parent_folder_id: currentFolder,
        uploaded_by: currentUserId,
      }).select('id, name, storage_path, mime_type, size_bytes, is_folder, created_at, parent_folder_id, team_id, dept_id').single()

      if (error) toast.error(error.message)
      else setFiles(prev => [...prev, { ...(fileRow as FileItem), uploader: null }])
    }

    toast.success(`${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} uploaded`)
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function downloadFile(file: FileItem) {
    if (!file.storage_path) { toast.error('No storage path for this file'); return }
    const { data } = await supabase.storage.from('org-files').createSignedUrl(file.storage_path, 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else toast.error('Could not generate download link')
  }

  async function deleteFile(id: string, storagePath: string | null) {
    if (!confirm('Delete this file?')) return
    if (storagePath) await supabase.storage.from('org-files').remove([storagePath])
    const { error } = await supabase.from('files').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      setFiles(prev => prev.filter(f => f.id !== id))
      toast.success('Deleted')
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Files</h1>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />}
              <button
                onClick={() => navigateTo(crumb, i)}
                className={cn('text-sm truncate hover:text-indigo-600 transition-colors', i === breadcrumbs.length - 1 ? 'font-semibold text-gray-900' : 'text-gray-500')}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm w-40" />
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-md transition-all', viewMode === 'list' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
              <List className="h-4 w-4" />
            </button>
            <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-md transition-all', viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-gray-400 hover:text-gray-600')}>
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* New folder bar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="New folder name..."
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') createFolder() }}
          className="max-w-xs h-8 text-sm"
        />
        <Button variant="outline" size="sm" onClick={createFolder} loading={creatingFolder} disabled={!newFolderName.trim()}>
          <FolderPlus className="h-4 w-4" /> New Folder
        </Button>
      </div>

      {/* File list */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Uploaded By</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Size</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(f => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => f.is_folder ? openFolder(f) : downloadFile(f)}
                      className="flex items-center gap-2.5 text-left w-full"
                    >
                      <FileIcon mime={f.mime_type} isFolder={f.is_folder} className="h-5 w-5 shrink-0" />
                      <span className={cn('font-medium truncate max-w-xs', f.is_folder ? 'text-gray-900 hover:text-indigo-600' : 'text-gray-700 hover:text-indigo-600')}>
                        {f.name}
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {f.uploader ? (
                      <div className="flex items-center gap-1.5">
                        <UserAvatar name={f.uploader.full_name} avatarUrl={f.uploader.avatar_url} size="sm" className="w-5 h-5" />
                        <span className="text-gray-500 text-xs">{f.uploader.full_name}</span>
                      </div>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{f.is_folder ? '—' : formatBytes(f.size_bytes)}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{formatDate(f.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <button className="p-1 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all rounded">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content className="z-50 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[140px]" align="end">
                          {!f.is_folder && (
                            <DropdownMenu.Item onClick={() => downloadFile(f)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                              <Download className="h-4 w-4" /> Download
                            </DropdownMenu.Item>
                          )}
                          <DropdownMenu.Item onClick={() => deleteFile(f.id, f.storage_path)} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">
                            <Trash2 className="h-4 w-4" /> Delete
                          </DropdownMenu.Item>
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Folder className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{search ? 'No files match your search' : 'This folder is empty'}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {sorted.map(f => (
            <div key={f.id} className="group bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-indigo-200 transition-all relative">
              <button onClick={() => f.is_folder ? openFolder(f) : downloadFile(f)} className="w-full text-left">
                <FileIcon mime={f.mime_type} isFolder={f.is_folder} className="h-10 w-10 mb-3 mx-auto" />
                <p className="text-xs font-medium text-gray-800 truncate text-center">{f.name}</p>
                {!f.is_folder && <p className="text-xs text-gray-400 text-center mt-0.5">{formatBytes(f.size_bytes)}</p>}
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="absolute top-2 right-2 p-0.5 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all rounded">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="z-50 bg-white rounded-lg border border-gray-200 shadow-lg py-1 min-w-[130px]" align="end">
                    {!f.is_folder && (
                      <DropdownMenu.Item onClick={() => downloadFile(f)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                        <Download className="h-4 w-4" /> Download
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Item onClick={() => deleteFile(f.id, f.storage_path)} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer">
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="col-span-5 text-center py-12 text-gray-400">
              <p className="text-sm">{search ? 'No files match your search' : 'This folder is empty'}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
