import { NextResponse } from "next/server"
import { getLibraryStories } from "@/lib/library/stories"

export async function GET() {
  return NextResponse.json(await getLibraryStories())
}
