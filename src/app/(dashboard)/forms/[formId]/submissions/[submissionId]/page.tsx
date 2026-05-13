import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ArrowLeft, Star } from 'lucide-react'
import { formatDate, cn } from '@/lib/utils'

const STATUS_VARIANT: Record<string, 'secondary' | 'default' | 'warning' | 'success' | 'destructive'> = {
  draft: 'secondary', submitted: 'default', in_review: 'warning', approved: 'success', rejected: 'destructive',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', submitted: 'Submitted', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected',
}

export default async function SubmissionDetailPage({ params }: { params: Promise<{ formId: string; submissionId: string }> }) {
  const { formId, submissionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [formRes, subRes] = await Promise.all([
    supabase.from('form_templates').select('id, title, fields, passing_score').eq('id', formId).single(),
    supabase.from('form_submissions').select(`
      id, answers, status, score, submitted_at, reviewer_notes, reviewed_at,
      profiles!submitted_by(full_name, avatar_url)
    `).eq('id', submissionId).single(),
  ])

  if (!formRes.data || !subRes.data) return notFound()

  type FormField = { id: string; type: string; label: string; required: boolean; options?: string[]; max?: number; points?: number }
  type FormData = { id: string; title: string; fields: FormField[]; passing_score: number | null }
  type SubData = { id: string; answers: Record<string, unknown>; status: string; score: number | null; submitted_at: string | null; reviewer_notes: string | null; reviewed_at: string | null; profiles?: { full_name: string; avatar_url: string | null } | null }

  const form = formRes.data as unknown as FormData
  const sub = subRes.data as unknown as SubData

  const passing = sub.score !== null && form.passing_score !== null ? sub.score >= form.passing_score : null

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <Link href={`/forms/${formId}`} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Submissions
      </Link>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{form.title}</h1>
            {sub.profiles && (
              <div className="flex items-center gap-2 mt-2">
                <UserAvatar name={sub.profiles.full_name} avatarUrl={sub.profiles.avatar_url} size="sm" className="w-6 h-6" />
                <span className="text-sm text-gray-600">{sub.profiles.full_name}</span>
                {sub.submitted_at && <span className="text-xs text-gray-400">· {formatDate(sub.submitted_at)}</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {sub.score !== null && (
              <span className={cn('text-2xl font-bold', passing === true ? 'text-green-600' : passing === false ? 'text-red-600' : 'text-gray-900')}>
                {sub.score}%
              </span>
            )}
            <Badge variant={STATUS_VARIANT[sub.status] ?? 'secondary'}>
              {STATUS_LABEL[sub.status]}
            </Badge>
          </div>
        </div>

        {sub.reviewer_notes && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-semibold text-amber-700 mb-1">Reviewer Notes</p>
            <p className="text-sm text-amber-800">{sub.reviewer_notes}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {form.fields.map((field, idx) => {
          const answer = sub.answers[field.id]
          const hasAnswer = answer !== undefined && answer !== '' && !(Array.isArray(answer) && answer.length === 0)

          return (
            <div key={field.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-medium text-gray-700">
                  {idx + 1}. {field.label}
                  {field.required && <span className="text-red-400 ml-1">*</span>}
                </p>
                {(field.points ?? 0) > 0 && (
                  <span className="text-xs text-gray-400 shrink-0">{field.points} pts</span>
                )}
              </div>

              {!hasAnswer ? (
                <p className="text-sm text-gray-300 italic">No answer provided</p>
              ) : field.type === 'rating' ? (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={cn('h-6 w-6', (answer as number) >= n ? 'fill-amber-400 text-amber-400' : 'text-gray-200')} />
                  ))}
                  <span className="ml-2 text-sm text-gray-600 self-center">{answer as number}/5</span>
                </div>
              ) : field.type === 'checkbox' ? (
                <div className="flex flex-wrap gap-2">
                  {(answer as string[]).map(v => (
                    <span key={v} className="bg-indigo-50 text-indigo-700 rounded-full px-3 py-0.5 text-sm">{v}</span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(answer)}</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
