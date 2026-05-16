import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
  return NextResponse.json({ comment }, { status: 201 })
}
