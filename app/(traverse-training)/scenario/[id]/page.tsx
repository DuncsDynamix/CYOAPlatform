import { TrainingPlayer } from "@/components/training/TrainingPlayer"

export default async function ScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TrainingPlayer experienceSlug={id} />
}
