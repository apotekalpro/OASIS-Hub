import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notifications — fetch user notifications
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ notifications: data })
}

// PATCH /api/notifications — mark notifications as read
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ids, all } = await request.json()

  if (all) {
    await supabase
      .from('notifications')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ is_read: true } as any)
      .eq('user_id', user.id)
      .eq('is_read', false)
  } else if (ids?.length) {
    await supabase
      .from('notifications')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ is_read: true } as any)
      .eq('user_id', user.id)
      .in('id', ids)
  }

  return NextResponse.json({ success: true })
}
