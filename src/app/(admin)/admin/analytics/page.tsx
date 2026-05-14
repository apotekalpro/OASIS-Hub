import { redirect } from 'next/navigation'

export default async function AdminAnalyticsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  redirect(tab ? `/analytics?tab=${tab}` : '/analytics')
}
