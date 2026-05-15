'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect, useRef } from 'react'
import StarterKit from '@tiptap/starter-kit'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onChange: (val: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({ value, onChange, placeholder, className }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Add more details...' }),
    ],
    content: value || '',
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-content focus:outline-none min-h-[80px] px-3 py-2 text-sm text-gray-900',
      },
    },
  })

  if (!editor) return null

  return (
    <div className={cn('rounded-md border border-gray-300 bg-white shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-gray-200 px-2 py-1">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="w-px h-4 bg-gray-200 mx-1" />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="Checklist"
        >
          <CheckSquare className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolbarButton({ onClick, active, title, children }: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded transition-colors',
        active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      )}
    >
      {children}
    </button>
  )
}

export function RichTextContent({ html, className, onSave }: { html: string; className?: string; onSave?: (html: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container || !onSave) return

    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'ul[data-type="taskList"] li > label input[type="checkbox"]'
    )

    function handleCheckboxClick(e: Event) {
      const checkbox = e.target as HTMLInputElement
      const li = checkbox.closest('li')
      if (li) {
        li.setAttribute('data-checked', String(checkbox.checked))
        // Persist the checked state in the HTML attribute so innerHTML captures it
        if (checkbox.checked) {
          checkbox.setAttribute('checked', '')
        } else {
          checkbox.removeAttribute('checked')
        }
      }
      onSave!(container!.innerHTML)
    }

    checkboxes.forEach(cb => cb.addEventListener('change', handleCheckboxClick))
    return () => {
      checkboxes.forEach(cb => cb.removeEventListener('change', handleCheckboxClick))
    }
  }, [html, onSave])

  if (!html || html === '<p></p>') return null
  return (
    <div
      ref={containerRef}
      className={cn('tiptap-content text-sm text-gray-700', className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
