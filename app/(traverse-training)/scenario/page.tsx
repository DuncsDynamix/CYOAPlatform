import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getPageUser } from "@/lib/auth/page-user"
import { loadLibraryMetadata, loadLibraryPage } from "@/lib/training/library-page"
import { BrandScope } from "@/components/training-ui/BrandScope"
import { LibraryScreen } from "@/components/training-ui/library/LibraryScreen"

// DB-backed page: render per request, never at build time
export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return loadLibraryMetadata(await getPageUser())
}

export default async function TrainingLibraryPage() {
  const data = await loadLibraryPage(await getPageUser())
  if (!data) redirect("/login")

  return (
    <BrandScope pack={data.pack}>
      <LibraryScreen view={data.view} />
    </BrandScope>
  )
}
