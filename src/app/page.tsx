import HomePageClient from '@/components/home/home-page-client'
import { getHomeDashboardData } from '@/lib/db/home/dashboard'
import { getProfileById } from '@/lib/db/auth/profile'
import { createClient } from '@/lib/supabase/server'
import type { HomeDashboardData } from '@/types/home'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let displayName = '访客'
  let dashboard: HomeDashboardData | null = null

  if (user) {
    const profile = await getProfileById(user.id)
    const n = profile?.name?.trim()
    if (n) displayName = n
    if (profile?.id) {
      dashboard = await getHomeDashboardData(profile.id)
    }
  }

  return <HomePageClient displayName={displayName} dashboard={dashboard} />
}
