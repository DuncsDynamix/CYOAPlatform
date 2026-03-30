import { redirect } from "next/navigation"
import { getExperience } from "@/lib/db/queries/experience"
import { BookReader } from "@/components/reader/BookReader"

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Route training experiences to the Training Player
  const experience = await getExperience(id)
  if (experience?.renderingTheme === "training") {
    redirect(`/scenario/${id}`)
  }

  return <BookReader id={id} />
}
