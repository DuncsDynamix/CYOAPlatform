interface CharacterSpeechProps {
  characterName: string
  characterRole: string
  dialogue: string
  isProtagonist?: boolean
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

export function CharacterSpeech({ characterName, characterRole, dialogue, isProtagonist = false }: CharacterSpeechProps) {
  return (
    <div className={`t-speech ${isProtagonist ? "t-speech--protagonist" : ""}`}>
      <div className={`t-avatar ${isProtagonist ? "t-avatar--protagonist" : ""}`} aria-hidden="true">
        {initials(characterName)}
      </div>
      <div className="t-speech-body">
        <span className="t-speech-name">{characterName}</span>
        <span className="t-speech-role">{characterRole}</span>
        <blockquote className="t-speech-bubble">"{dialogue}"</blockquote>
      </div>
    </div>
  )
}
