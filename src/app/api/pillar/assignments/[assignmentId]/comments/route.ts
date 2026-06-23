import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

// Pillar comments are plain text only — no attachments, pasted images, or hyperlinks.
function sanitizeComment(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, ' ')                          // strip any HTML/markup
    .replace(/\bhttps?:\/\/\S+/gi, '[link removed]')    // strip hyperlinks
    .replace(/\bwww\.\S+/gi, '[link removed]')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pillar_comments')
    .select('*, profiles!pillar_comments_user_id_fkey(id, full_name, avatar_url)')
    .eq('assignment_id', assignmentId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'delete') {
    await admin.from('pillar_comments').delete().eq('id', body.commentId).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  }

  const content = sanitizeComment(String(body.content ?? ''))
  if (!content) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })

  const { data: comment, error } = await admin
    .from('pillar_comments')
    .insert({
      assignment_id: assignmentId,
      user_id: user.id,
      content,
      parent_comment_id: body.parent_comment_id || null,
    })
    .select('*, profiles!pillar_comments_user_id_fkey(id, full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  notifyPillarComment({ admin, assignmentId, commenterId: user.id, content, actorName: body.actorName ?? 'Someone' }).catch(console.error)

  return NextResponse.json({ comment }, { status: 201 })
}

async function notifyPillarComment({
  admin, assignmentId, commenterId, content, actorName,
}: {
  admin: Awaited<ReturnType<typeof createAdminClient>>
  assignmentId: string
  commenterId: string
  content: string
  actorName: string
}) {
  const { data: assignment } = await admin.from('pillar_assignments').select('id, title, assigned_to, assigned_by').eq('id', assignmentId).single()
  if (!assignment) return

  const recipientIds = new Set<string>()
  if (assignment.assigned_to && assignment.assigned_to !== commenterId) recipientIds.add(assignment.assigned_to)
  if (assignment.assigned_by && assignment.assigned_by !== commenterId) recipientIds.add(assignment.assigned_by)
  if (recipientIds.size === 0) return

  const bodyText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
  await admin.from('notifications').insert(
    [...recipientIds].map(uid => ({
      user_id: uid,
      type: 'pillar_commented',
      title: `${actorName} commented on: ${assignment.title}`,
      body: bodyText || null,
      data: { assignment_id: assignmentId, url: `${APP_URL}/pillar/${assignmentId}` },
    }))
  )
}
