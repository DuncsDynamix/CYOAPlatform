import { Atrium } from "@/components/library/Atrium"
import { getLibraryStories } from "@/lib/library/stories"

export default async function StoryLibraryPage() {
  const stories = await getLibraryStories()
  return <Atrium stories={stories} />
}
