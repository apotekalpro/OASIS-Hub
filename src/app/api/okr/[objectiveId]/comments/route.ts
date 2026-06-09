import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { okrMentionEmail } from '@/lib/email/templates'

export const dynamic = 'force-dynamic'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('okr_comments')
    .select('*, profiles!okr_comments_user_id_fkey(id, full_name, avatar_url), okr_comment_reactions(id, emoji, user_id)')
    .eq('objective_id', objectiveId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.action === 'react') {
    const { commentId, emoji } = body
    const existing = await admin
      .from('okr_comment_reactions')
      .select('id')
      .eq('comment_id', commentId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .maybeSingle()
    if (existing.data) {
      await admin.from('okr_comment_reactions').delete().eq('id', existing.data.id)
    } else {
      await admin.from('okr_comment_reactions').insert({ comment_id: commentId, user_id: user.id, emoji })
    }
    return NextResponse.json({ success: true })
  }

  if (body.action === 'delete') {
    await admin
      .from('okr_comments')
      .delete()
      .eq('id', body.commentId)
      .eq('user_id', user.id)
    return NextResponse.json({ success: true })
  }

  const { data: comment, error } = await admin
    .from('okr_comments')
    .insert({
      objective_id: objectiveId,
      user_id: user.id,
      content: body.content,
      parent_comment_id: body.parent_comment_id || null,
      attachments: body.attachments || [],
    })
    .select('*, profiles!okr_comments_user_id_fkey(id, full_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire-and-forget notifications — don't block the response
  sendOkrCommentNotifications({
    admin,
    objectiveId,
    commenterId: user.id,
    content: body.content ?? '',
    actorName: body.actorName ?? 'Someone',
  }).catch(console.error)

  return NextResponse.json({ comment }, { status: 201 })
}

async function sendOkrCommentNotifications({
  admin, objectiveId, commenterId, content, actorName,
}: {
  admin: Awaited<ReturnType<typeof createAdminClient>>
  objectiveId: string
  commenterId: string
  content: string
  actorName: string
}) {
  const okrUrl = `${APP_URL}/okr/${objectiveId}`

  // Fetch objective title, creator, and assignees in parallel
  const [objRes, assigneesRes] = await Promise.all([
    admin.from('okr_objectives').select('id, title, created_by').eq('id', objectiveId).single(),
    admin.from('okr_assignees').select('user_id').eq('objective_id', objectiveId),
  ])

  const objective = objRes.data
  if (!objective) return

  // Collect unique recipients (creator + assignees) excluding commenter
  const recipientIds = new Set<string>()
  if (objective.created_by && objective.created_by !== commenterId) recipientIds.add(objective.created_by)
  for (const a of assigneesRes.data ?? []) {
    if (a.user_id !== commenterId) recipientIds.add(a.user_id)
  }

  if (recipientIds.size === 0) return

  const title = `${actorName} commented on: ${objective.title}`
  const bodyText = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)

  // Create in-app notifications
  await admin.from('notifications').insert(
    [...recipientIds].map(uid => ({
      user_id: uid,
      type: 'okr_commented',
      title,
      body: bodyText || null,
      data: { objective_id: objectiveId, url: okrUrl },
    }))
  )

  // Detect @mentions and send email to those users
  const mentionRegex = /@([^@\n,]+?)(?=\s|$|[,.])/g
  const mentionedNames: string[] = []
  let m: RegExpExecArray | null
  while ((m = mentionRegex.exec(content.replace(/<[^>]*>/g, ' '))) !== null) {
    mentionedNames.push(m[1].trim())
  }

  // @all — email every recipient
  const hasAtAll = /@all\b/i.test(content)
  if (!mentionedNames.length && !hasAtAll) return

  const { data: allProfiles } = await admin
    .from('profiles')
    .select('id, full_name, email, contact_email')
    .in('id', [...recipientIds])

  const mentionedProfiles = hasAtAll
    ? (allProfiles ?? []).filter(p => p.id !== commenterId)
    : (allProfiles ?? []).filter(p =>
        mentionedNames.some(name => p.full_name.toLowerCase().includes(name.toLowerCase()))
      )

  // In-app mention notifications (separate type)
  if (mentionedProfiles.length) {
    await admin.from('notifications').insert(
      mentionedProfiles
        .filter(p => p.id !== commenterId)
        .map(p => ({
          user_id: p.id,
          type: 'okr_mention',
          title: `${actorName} mentioned you in: ${objective.title}`,
          body: bodyText || null,
          data: { objective_id: objectiveId, url: okrUrl },
        }))
    )

    await Promise.allSettled(
      mentionedProfiles
        .filter(p => p.id !== commenterId && (p.email || p.contact_email))
        .map(p => {
          const tpl = okrMentionEmail({
            recipientName: p.full_name,
            objectiveTitle: objective.title,
            mentionedBy: actorName,
            okrUrl,
          })
          return sendEmail({ to: p.contact_email || p.email, subject: tpl.subject, html: tpl.html })
        })
    )
  }
}
