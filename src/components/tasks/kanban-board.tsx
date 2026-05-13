'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { TaskCard, TaskCardData } from './task-card'
import { TaskForm } from './task-form'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'bg-gray-400' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'in_review', label: 'In Review', color: 'bg-amber-500' },
  { id: 'done', label: 'Done', color: 'bg-green-500' },
]

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Team = { id: string; name: string }
type Department = { id: string; name: string }

interface Props {
  tasks: TaskCardData[]
  orgId: string
  currentUserId: string
  users: OrgUser[]
  teams: Team[]
  departments: Department[]
  onTasksChange: (tasks: TaskCardData[]) => void
}

function SortableTaskCard({ task }: { task: TaskCardData }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={cn(isDragging && 'opacity-50')}>
      <TaskCard task={task} />
    </div>
  )
}

function KanbanColumn({
  columnId, label, color, tasks, orgId, currentUserId, users, teams, departments, onTaskCreated,
}: {
  columnId: string; label: string; color: string; tasks: TaskCardData[]
  orgId: string; currentUserId: string; users: OrgUser[]; teams: Team[]; departments: Department[]
  onTaskCreated: (task: TaskCardData) => void
}) {
  return (
    <div className="flex flex-col bg-gray-50 rounded-xl min-w-[280px] w-[280px]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200">
        <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', color)} />
        <h3 className="font-semibold text-sm text-gray-700 flex-1">{label}</h3>
        <span className="text-xs text-gray-400 font-medium">{tasks.length}</span>
      </div>

      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-260px)]">
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>

      <div className="p-3 border-t border-gray-200">
        <TaskForm
          orgId={orgId}
          currentUserId={currentUserId}
          users={users}
          teams={teams}
          departments={departments}
          defaultStatus={columnId}
          trigger={
            <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors w-full py-1">
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          }
          onCreated={(taskId) => {
            onTaskCreated({
              id: taskId,
              title: 'New Task',
              description: null,
              status: columnId,
              priority: 'medium',
              due_date: null,
              tags: [],
              created_at: new Date().toISOString(),
            })
          }}
        />
      </div>
    </div>
  )
}

export function KanbanBoard({ tasks, orgId, currentUserId, users, teams, departments, onTasksChange }: Props) {
  const [activeTask, setActiveTask] = useState<TaskCardData | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const tasksByStatus = useCallback((status: string) =>
    tasks.filter(t => t.status === status),
    [tasks]
  )

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find(t => t.id === event.active.id)
    if (task) setActiveTask(task)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const overId = over.id as string

    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    const newStatus = COLUMNS.find(c => c.id === overId)?.id
      ?? tasks.find(t => t.id === overId)?.status

    if (!newStatus || newStatus === task.status) return

    const updated = tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t)
    onTasksChange(updated)

    const supabase = createClient()
    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId)
    if (error) {
      toast.error('Failed to update task status')
      onTasksChange(tasks)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={col.id}
            columnId={col.id}
            label={col.label}
            color={col.color}
            tasks={tasksByStatus(col.id)}
            orgId={orgId}
            currentUserId={currentUserId}
            users={users}
            teams={teams}
            departments={departments}
            onTaskCreated={(newTask) => onTasksChange([...tasks, newTask])}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} />}
      </DragOverlay>
    </DndContext>
  )
}
