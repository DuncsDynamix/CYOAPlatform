import Link from "next/link"
import type { CourseCardView, LibraryHeroView, LibraryView } from "@/lib/training/views"
import { BrandMark } from "../BrandMark"

/** Status chip tone: words carry the status, colour follows the fixed status palette. */
function chipTone(card: CourseCardView): "neutral" | "progress" | "pass" | "fail" | "na" {
  switch (card.status.kind) {
    case "not_started":
      return "neutral"
    case "in_progress":
      return "progress"
    case "completed":
      if (card.status.outcome === "passed") return "pass"
      if (card.status.outcome === "not_passed") return "fail"
      if (card.status.outcome === "incomplete") return "na"
      return "neutral"
  }
}

function Hero({ hero }: { hero: LibraryHeroView }) {
  return (
    <section className={hero.image ? "tg-hero" : "tg-hero tg-hero--plain"}>
      {hero.image && <img className="tg-hero-img" src={hero.image} alt="" />}
      <div className="tg-hero-body">
        <p className="tg-hero-kicker">{hero.kicker}</p>
        <h2 className="tg-hero-title">{hero.course.title}</h2>
        <Link className="tg-btn tg-btn--primary" href={hero.href}>
          {hero.action}
        </Link>
      </div>
    </section>
  )
}

function CourseCard({ card }: { card: CourseCardView }) {
  const tone = chipTone(card)
  return (
    <article className="tg-course">
      {card.image ? (
        <img className="tg-course-img" src={card.image} alt="" />
      ) : (
        <span className="tg-course-img tg-course-img--plain" aria-hidden="true" />
      )}
      <div className="tg-course-body">
        <h3 className="tg-course-title">
          <Link className="tg-course-link" href={card.coverHref}>
            {card.title}
          </Link>
        </h3>
        <p className="tg-course-meta">
          {card.kindLabel} · {card.durationMinutes} min
        </p>
        <div className="tg-course-foot">
          {card.badges.map((b) => (
            <img
              key={b.name}
              className="tg-course-badge"
              src={b.badge}
              alt={`${b.relationshipLabel} ${b.name}`}
              title={`${b.relationshipLabel} ${b.name}`}
            />
          ))}
          {card.recordHref ? (
            <Link className={`tg-chip tg-chip--${tone} tg-course-record`} href={card.recordHref}>
              {card.statusLabel}
            </Link>
          ) : (
            <span className={`tg-chip tg-chip--${tone}`}>{card.statusLabel}</span>
          )}
        </div>
      </div>
    </article>
  )
}

export function LibraryScreen({ view }: { view: LibraryView }) {
  return (
    <div className="tg-library">
      <header className="tg-libheader">
        <div className="tg-libheader-row">
          <BrandMark brand={view.brand} />
          <span className="tg-libheader-user">{view.learnerName}</span>
        </div>
      </header>
      <h1 className="tg-sr-only">{view.brand.displayName} training library</h1>
      {view.hero && <Hero hero={view.hero} />}
      <main className="tg-library-main">
        {view.sections.length === 0 ? (
          <p className="tg-library-empty">No courses have been published for your organisation yet.</p>
        ) : (
          view.sections.map((s) => (
            <section key={s.id} className="tg-shelf" aria-labelledby={`shelf-${s.id}`}>
              <h2 className="tg-kicker" id={`shelf-${s.id}`}>
                {s.title}
              </h2>
              <p className="tg-shelf-blurb">{s.blurb}</p>
              <ul className="tg-shelf-grid">
                {s.courses.map((c) => (
                  <li key={c.id}>
                    <CourseCard card={c} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </main>
    </div>
  )
}
