import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPageUser } from "@/lib/auth/page-user"
import { loadScenarioMetadata, loadScenarioPage } from "@/lib/training/scenario-page"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { TrainingPlayer } from "@/components/training-ui/TrainingPlayer"

// DB-backed page: render per request, never at build time
export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ resume?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return loadScenarioMetadata(id, await getPageUser())
}

export default async function ScenarioPage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const data = await loadScenarioPage(id, await getPageUser(), { resume: query.resume === "1" })
  if (!data) notFound()

  return (
    <BrandScope pack={data.pack}>
      <TrainingPlayer {...data.player} />
    </BrandScope>
  )
}
