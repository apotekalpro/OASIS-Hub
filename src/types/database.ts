export type UserRole =
  | 'super_admin'
  | 'org_admin'
  | 'dept_head'
  | 'chief'
  | 'lead'
  | 'team_leader'
  | 'member'
  | 'auditor'
  | 'viewer'

export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done' | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type FormStatus = 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected'
export type ReminderFrequency = 'once' | 'daily' | 'weekly' | 'monthly'
export type NotificationType =
  | 'task_assigned'
  | 'task_due_soon'
  | 'task_overdue'
  | 'task_completed'
  | 'task_commented'
  | 'form_assigned'
  | 'form_due_soon'
  | 'form_submitted'
  | 'form_reviewed'
  | 'message_mention'
  | 'event_reminder'
  | 'system'
  | 'user_invited'
  | 'password_reset'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url: string | null
  settings: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  org_id: string
  parent_id: string | null
  name: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
}

export interface NotificationPreferences {
  email_task_assigned: boolean
  email_task_due: boolean
  email_mentions: boolean
  email_digest: 'none' | 'daily' | 'weekly'
  push_task_assigned: boolean
  push_task_due: boolean
  push_mentions: boolean
}

export interface Profile {
  id: string
  org_id: string | null
  dept_id: string | null
  employee_id: string | null
  full_name: string
  email: string
  avatar_url: string | null
  phone: string | null
  job_title: string | null
  role: UserRole
  is_active: boolean
  must_change_password: boolean
  timezone: string
  notification_preferences: NotificationPreferences
  last_login_at: string | null
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  org_id: string
  dept_id: string | null
  name: string
  description: string | null
  avatar_url: string | null
  color: string
  is_private: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Attachment {
  name: string
  url: string
  mime_type: string
  size_bytes: number
}

export interface Task {
  id: string
  org_id: string
  dept_id: string | null
  team_id: string | null
  parent_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  start_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  tags: string[]
  attachments: Attachment[]
  created_by: string
  created_at: string
  updated_at: string
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  attachments: Attachment[]
  created_at: string
  updated_at: string
}

export interface Channel {
  id: string
  org_id: string
  dept_id: string | null
  team_id: string | null
  name: string
  description: string | null
  is_private: boolean
  is_direct: boolean
  created_by: string | null
  created_at: string
}

export interface Message {
  id: string
  channel_id: string
  user_id: string
  parent_id: string | null
  content: string
  attachments: Attachment[]
  mentions: string[]
  reactions: Record<string, string[]>
  is_pinned: boolean
  edited_at: string | null
  created_at: string
}

export interface FormField {
  id: string
  type: 'text' | 'number' | 'checkbox' | 'radio' | 'photo' | 'signature' | 'location' | 'score' | 'dropdown' | 'date'
  label: string
  required: boolean
  options?: string[]
  min?: number
  max?: number
  conditional?: { field_id: string; value: string }
}

export interface FormTemplate {
  id: string
  org_id: string
  dept_id: string | null
  title: string
  description: string | null
  fields: FormField[]
  passing_score: number | null
  version: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface FormSubmission {
  id: string
  form_id: string
  assignment_id: string | null
  submitted_by: string
  answers: Record<string, unknown>
  score: number | null
  status: FormStatus
  reviewer_id: string | null
  reviewer_notes: string | null
  reviewed_at: string | null
  location: { lat: number; lng: number } | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface AppNotification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  data: Record<string, unknown>
  is_read: boolean
  email_sent: boolean
  created_at: string
}
/** @deprecated use AppNotification */
export type Notification = AppNotification

export interface Reminder {
  id: string
  user_id: string
  ref_type: 'task' | 'form' | 'event' | 'custom'
  ref_id: string | null
  title: string
  body: string | null
  remind_at: string
  frequency: ReminderFrequency
  recurrence_end: string | null
  is_sent: boolean
  is_active: boolean
  created_at: string
}

export interface CalendarEvent {
  id: string
  org_id: string
  dept_id: string | null
  team_id: string | null
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  is_all_day: boolean
  is_recurring: boolean
  recurrence_rule: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ─── Supabase Database type ───────────────────────────────────────────────────
// Minimal shape so createBrowserClient/createServerClient infer generics.
// Extend as needed when using typed `.from()` calls.
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: Organization
        Insert: Partial<Organization>
        Update: Partial<Organization>
        Relationships: []
      }
      departments: {
        Row: Department
        Insert: Partial<Department>
        Update: Partial<Department>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile>
        Update: Partial<Profile>
        Relationships: []
      }
      teams: {
        Row: Team
        Insert: Partial<Team>
        Update: Partial<Team>
        Relationships: []
      }
      tasks: {
        Row: Task
        Insert: Partial<Task>
        Update: Partial<Task>
        Relationships: []
      }
      task_assignees: {
        Row: { task_id: string; user_id: string; assigned_at: string; assigned_by: string | null }
        Insert: Partial<{ task_id: string; user_id: string; assigned_at: string; assigned_by: string | null }>
        Update: Partial<{ task_id: string; user_id: string; assigned_at: string; assigned_by: string | null }>
        Relationships: []
      }
      task_comments: {
        Row: TaskComment
        Insert: Partial<TaskComment>
        Update: Partial<TaskComment>
        Relationships: []
      }
      channels: {
        Row: Channel
        Insert: Partial<Channel>
        Update: Partial<Channel>
        Relationships: []
      }
      messages: {
        Row: Message
        Insert: Partial<Message>
        Update: Partial<Message>
        Relationships: []
      }
      form_templates: {
        Row: FormTemplate
        Insert: Partial<FormTemplate>
        Update: Partial<FormTemplate>
        Relationships: []
      }
      form_submissions: {
        Row: FormSubmission
        Insert: Partial<FormSubmission>
        Update: Partial<FormSubmission>
        Relationships: []
      }
      notifications: {
        Row: AppNotification
        Insert: Partial<AppNotification>
        Update: Partial<AppNotification>
        Relationships: []
      }
      reminders: {
        Row: Reminder
        Insert: Partial<Reminder>
        Update: Partial<Reminder>
        Relationships: []
      }
      events: {
        Row: CalendarEvent
        Insert: Partial<CalendarEvent>
        Update: Partial<CalendarEvent>
        Relationships: []
      }
      audit_logs: {
        Row: { id: string; org_id: string | null; user_id: string | null; action: string; resource_type: string | null; resource_id: string | null; details: Json; ip_address: string | null; created_at: string }
        Insert: Partial<{ id: string; org_id: string | null; user_id: string | null; action: string; resource_type: string | null; resource_id: string | null; details: Json; ip_address: string | null; created_at: string }>
        Update: Partial<{ id: string; org_id: string | null; user_id: string | null; action: string; resource_type: string | null; resource_id: string | null; details: Json; ip_address: string | null; created_at: string }>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      task_status: TaskStatus
      task_priority: TaskPriority
      form_status: FormStatus
      notification_type: NotificationType
      reminder_frequency: ReminderFrequency
    }
    CompositeTypes: Record<string, never>
  }
}
