import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getPageUser } from "@/lib/auth/page-user"
import { loadRecordPage } from "@/lib/training/record-page"
import { trainingMetadata } from "@/lib/training/metadata"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { RecordView } from "@/components/training-ui/record/RecordView"

// DB-backed, per-learner page: render per request, never cached or indexed
export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string; sessionId: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, sessionId } = await params
  const data = await loadRecordPage(id, sessionId, await getPageUser())
  if (!data) return { robots: { index: false } }
  return { ...trainingMetadata(data.brand, `Evidence record ${data.doc.reference}`), robots: { index: false } }
}

export default async function RecordPage({ params }: Props) {
  const { id, sessionId } = await params
  const data = await loadRecordPage(id, sessionId, await getPageUser())
  if (!data) notFound()

  return (
    <BrandScope pack={data.brand}>
      <RecordView doc={data.doc} logo={data.brand.logo?.onLight} />
    </BrandScope>
  )
}
