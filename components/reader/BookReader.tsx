"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { BookPage } from "@/components/reader/BookPage"
import { ChoicePanel } from "@/components/reader/ChoicePanel"
import { GeneratingScreen } from "@/components/reader/GeneratingScreen"
import { OutcomeCard } from "@/components/reader/OutcomeCard"
import { ProgressBar } from "@/components/reader/ProgressBar"
import type { ResolvedContent } from "@/types/engine"
import type { Node } from "@/types/experience"

// ─── STATE MACHINE ────────────────────────────────────────────

type PageStatus =
  | { type: "loading" }
  | { type: "generating"; sessionId: string }
  | { type: "prose"; content: string; sessionId: string; choicesMade: number }
  | { type: "advancing" }
  | { type: "choice"; sessionId: string; choicesMade: number; node: Node; content: ResolvedContent }
  | { type: "submitting"; sessionId: string; choicesMade: number }
  | { type: "ending"; sessionId: string; content: ResolvedContent; experienceTitle: string }
  | { type: "error"; message: string }

// ─── COMPONENT ────────────────────────────────────────────────

export function BookReader({ id }: { id: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<PageStatus>({ type: "loading" })
  const [experienceTitle, setExperienceTitle] = useState("")
  const [lastProse, setLastProse] = useState<string>("")

  useEffect(() => {
    async function startSession() {
      try {
        const res = await fetch("/api/engine/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ experienceSlug: id }),
        })

        if (!res.ok) {
          const err = await res.json()
          setStatus({ type: "error", message: err.error ?? "Could not start story" })
          return
        }

        const data = await res.json() as {
          sessionId: string
          node: Node
          content: ResolvedContent
          experienceTitle?: string
        }

        setExperienceTitle(data.experienceTitle ?? "")
        handleNodeContent(data.sessionId, data.node, data.content, 0)
      } catch {
        setStatus({ type: "error", message: "Network error — please try again" })
      }
    }

    startSession()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleNodeContent(
    sessionId: string,
    node: Node,
    content: ResolvedContent,
    choicesMade: number
  ) {
    if (content.type === "prose") {
      setLastProse(content.content)
      if (choicesMade === 0 && node.type === "GENERATED") {
        setStatus({ type: "generating", sessionId })
      } else {
        setStatus({ type: "prose", content: content.content, sessionId, choicesMade })
      }
    } else if (content.type === "choice") {
      setStatus({ type: "choice", sessionId, choicesMade, node, content })
    } else if (content.type === "endpoint") {
      setStatus({ type: "ending", sessionId, content, experienceTitle })
    } else if (content.type === "checkpoint") {
      advanceToNextNode(sessionId, choicesMade)
    }
  }

  const advanceToNextNode = useCallback(async (sessionId: string, choicesMade: number) => {
    setStatus({ type: "advancing" })
    try {
      const res = await fetch(`/api/engine/node?sessionId=${sessionId}`)
      if (!res.ok) {
        setStatus({ type: "error", message: "Could not advance story" })
        return
      }
      const data = await res.json() as { node: Node; content: ResolvedContent }
      handleNodeContent(sessionId, data.node, data.content, choicesMade)
    } catch {
      setStatus({ type: "error", message: "Network error" })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChoice = useCallback(async (
    sessionId: string,
    choicesMade: number,
    choiceId: string | null,
    freeText?: string
  ) => {
    setStatus({ type: "submitting", sessionId, choicesMade })
    try {
      const res = await fetch("/api/engine/choose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, choiceId, freeTextResponse: freeText }),
      })

      if (!res.ok) {
        setStatus({ type: "error", message: "Could not submit choice" })
        return
      }

      const data = await res.json() as { node: Node; content: ResolvedContent }
      const newChoicesMade = choicesMade + 1
      handleNodeContent(sessionId, data.node, data.content, newChoicesMade)
    } catch {
      setStatus({ type: "error", message: "Network error" })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── RENDER ────────────────────────────────────────────────

  if (status.type === "loading") {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--colour-page)",
        }}
      >
        <div className="typing-indicator">
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      </div>
    )
  }

  if (status.type === "generating") {
    return (
      <GeneratingScreen
        sessionId={status.sessionId}
        onReady={() => advanceToNextNode(status.sessionId, 0)}
      />
    )
  }

  if (status.type === "error") {
    return (
      <div style={{ maxWidth: "680px", margin: "4rem auto", padding: "0 1rem", textAlign: "center" }}>
        <p className="book-meta" style={{ marginBottom: "1.5rem" }}>{status.message}</p>
        <button onClick={() => router.push("/")} className="choice-submit">
          Return to library
        </button>
      </div>
    )
  }

  if (status.type === "ending") {
    const content = status.content
    if (content.type !== "endpoint") return null
    return (
      <div style={{ paddingBottom: "3rem" }}>
        <OutcomeCard
          data={{ ...content.outcomeCard, closingLine: content.closingLine, summary: content.summary }}
          experienceTitle={experienceTitle || "Turn To Page"}
          onReplay={() => router.push("/")}
        />
      </div>
    )
  }

  if (status.type === "prose") {
    return (
      <div style={{ paddingBottom: "3rem" }}>
        <ProgressBar choicesMade={status.choicesMade} />
        <BookPage content={status.content} />
        <div style={{ maxWidth: "680px", margin: "1.5rem auto 0", padding: "0 1rem" }}>
          <button
            onClick={() => {
              setLastProse("")
              advanceToNextNode(status.sessionId, status.choicesMade)
            }}
            className="choice-submit"
            style={{ width: "100%" }}
          >
            Continue →
          </button>
        </div>
      </div>
    )
  }

  if (status.type === "advancing" || status.type === "submitting") {
    return (
      <div style={{ paddingBottom: "3rem" }}>
        <BookPage content={lastProse} isLoading />
      </div>
    )
  }

  if (status.type === "choice") {
    const content = status.content
    if (content.type !== "choice") return null
    return (
      <div style={{ paddingBottom: "3rem" }}>
        <ProgressBar choicesMade={status.choicesMade} />
        {lastProse && <BookPage content={lastProse} />}
        <ChoicePanel
          options={content.options}
          responseType="closed"
          onChoose={(choiceId, freeText) =>
            handleChoice(status.sessionId, status.choicesMade, choiceId, freeText)
          }
        />
      </div>
    )
  }

  return null
}
