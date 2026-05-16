import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('okr_key_results')
    .select('*')
    .eq('objective_id', objectiveId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keyResults: data ?? [] })
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

  // PATCH existing KR by id
  if (body.id) {
    const { id, ...fields } = body
    const { data, error } = await admin
      .from('okr_key_results')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('objective_id', objectiveId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ keyResult: data })
  }

  // Create new KR
  const { data, error } = await admin
    .from('okr_key_results')
    .insert({
      objective_id: objectiveId,
      title: body.title,
      description: body.description || null,
      metric_type: body.metric_type || 'percentage',
      start_value: body.start_value ?? 0,
      target_value: body.target_value ?? 100,
      current_value: body.current_value ?? 0,
      unit: body.unit || null,
      due_date: body.due_date || null,
      status: body.status || 'not_started',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keyResult: data }, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'KR id required' }, { status: 400 })

  const { data, error } = await admin
    .from('okr_key_results')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('objective_id', objectiveId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ keyResult: data })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ objectiveId: string }> }
) {
  const { objectiveId } = await params
  const supabase = await createClient()
  const admin = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const krId = searchParams.get('id')
  if (!krId) return NextResponse.json({ error: 'KR id required' }, { status: 400 })

  const { error } = await admin
    .from('okr_key_results')
    .delete()
    .eq('id', krId)
    .eq('objective_id', objectiveId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
