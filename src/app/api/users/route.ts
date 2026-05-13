import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { welcomeUserEmail } from '@/lib/email/templates'
import { canImportUsers } from '@/lib/auth/permissions'
import type { UserRole } from '@/types/database'

// POST /api/users/welcome-email — send welcome email after creating a user
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !canImportUsers(profile.role as UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { recipientEmail, recipientName } = await request.json()

  const email = welcomeUserEmail({
    recipientName,
    email: recipientEmail,
    defaultPassword: process.env.DEFAULT_USER_PASSWORD || 'Alpro@123',
    loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
  })

  const result = await sendEmail({ to: recipientEmail, ...email })
  return NextResponse.json(result)
}
