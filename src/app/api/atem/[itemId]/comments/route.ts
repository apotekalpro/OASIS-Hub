import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { atemMentionEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const admin = createAdminClient()
  const { data, error } = await admin.from('atem_comments')
    .select('*, profiles!atem_comments_user_id_fkey(id, full_name, avatar_url), atem_comment_reactions(id, emoji, user_id)')
    .eq('atem_id', itemId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'react') {
    const { commentId, emoji } = body
    const existing = await admin.from('atem_comment_reactions')
      .select('id').eq('comment_id', commentId).eq('user_id', user.id).eq('emoji', emoji).maybeSingle()
    if (existing.data) {
      await admin.from('atem_comment_reactions').delete().eq('id', existing.data.id)
    } else {
      await admin.from('atem_comment_reactions').insert({ comment_id: commentId, user_id: user.id, emoji })
    }
    return NextResponse.json({ success: true })
  }

  if (body.action === 'delete') {
    await admin.from('atem_comments').delete().eq('id', body.commentId).eq('user_id', user.id)
    return NextResponse.json({ success: true })
  }

  const { data: comment, error } = await admin.from('atem_comments').insert({
    atem_id: itemId,
    user_id: user.id,
    content: body.content,
    parent_comment_id: body.parent_comment_id || null,
    attachments: body.attachments || [],
  }).select('*, profiles!atem_comments_user_id_fkey(id, full_name, avatar_url)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget notifications — don't block the response
  sendAtemCommentNotifications({
    admin,
    itemId,
    commenterId: user.id,
    content: body.content ?? '',
    actorName: body.actorName ?? 'Someone',
  }).catch(console.error)

  return NextResponse.json({ comment }, { status: 201 })
}

async function sendAtemCommentNotifications({
  admin, itemId, commenterId, content, actorName,
}: {
  admin: Awaited<ReturnType<typeof createAdminClient>>
  itemId: string
  commenterId: string
  content: string
  actorName: string
}) {
  const atemUrl = `${APP_URL}/atem/${itemId}`

  // Fetch item task name, creator, and assignees in parallel
  const [itemRes, assigneesRes] = await Promise.all([
    admin.from('atem_items').select('id, task, created_by').eq('id', itemId).single(),
    admin.from('atem_assignees').select('user_id').eq('atem_id', itemId),
  ])

  const item = itemRes.data
  if (!item) return

  const taskLabel = (item.task as string ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)

  // Collect unique recipients (creator + assignees) excluding commenter
  const recipientIds = new Set<string>()
  if (item.created_by && item.created_by !== commenterId) recipientIds.add(item.created_by)
  for (const a of assigneesRes.data ?? []) {
    if (a.user_id !== commenterId) recipientIds.add(a.user_id)
  }

  if (recipientIds.size === 0) return

  const title = `${actorName} commented on: ${taskLabel}`
  const bodyText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)

  // Create in-app notifications
  await admin.from('notifications').insert(
    [...recipientIds].map(uid => ({
      user_id: uid,
      type: 'atem_commented',
      title,
      body: bodyText || null,
      data: { atem_id: itemId, url: atemUrl },
    }))
  )

  // Detect @mentions and send email to those users
  const mentionRegex = /@([^@\n,]+?)(?=\s|$|[,.])/g
  const mentionedNames: string[] = []
  let m: RegExpExecArray | null
  while ((m = mentionRegex.exec(content.replace(/<[^>]*>/g, ' '))) !== null) {
    mentionedNames.push(m[1].trim())
  }

  if (!mentionedNames.length) return

  const { data: allProfiles } = await admin
    .from('profiles')
    .select('id, full_name, email, contact_email')
    .in('id', [...recipientIds])

  const mentionedProfiles = (allProfiles ?? []).filter(p =>
    mentionedNames.some(name => p.full_name.toLowerCase().includes(name.toLowerCase()))
  )

  if (mentionedProfiles.length) {
    await admin.from('notifications').insert(
      mentionedProfiles
        .filter(p => p.id !== commenterId)
        .map(p => ({
          user_id: p.id,
          type: 'atem_mention',
          title: `${actorName} mentioned you in: ${taskLabel}`,
          body: bodyText || null,
          data: { atem_id: itemId, url: atemUrl },
        }))
    )

    await Promise.allSettled(
      mentionedProfiles
        .filter(p => p.id !== commenterId && (p.email || p.contact_email))
        .map(p => {
          const tpl = atemMentionEmail({
            recipientName: p.full_name,
            atemTask: taskLabel,
            mentionedBy: actorName,
            atemUrl,
          })
          return sendEmail({ to: p.contact_email || p.email, subject: tpl.subject, html: tpl.html })
        })
    )
  }
}
