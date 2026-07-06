import { notFound } from "next/navigation"
import { HallRoom } from "@/components/library/HallRoom"
import { HALL_IDS, getHall, type HallId } from "@/lib/library/halls"
import { getLibraryStories } from "@/lib/library/stories"
import { groupStoriesByHall } from "@/lib/library/shelve"

function isHallId(value: string): value is HallId {
  return (HALL_IDS as readonly string[]).includes(value)
}

export default async function HallPage({ params }: { params: Promise<{ genre: string }> }) {
  const { genre } = await params

  if (!isHallId(genre)) {
    notFound()
  }

  const stories = await getLibraryStories()
  const grouped = groupStoriesByHall(stories)

  return <HallRoom hall={getHall(genre)} stories={grouped[genre]} />
}
