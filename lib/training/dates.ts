/** Record dates, always in UK time whatever the server's zone. Pure. */

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
})

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" })

export function formatRecordDate(iso: string): string {
  const p = Object.fromEntries(DATE_TIME.formatToParts(new Date(iso)).map((part) => [part.type, part.value]))
  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute}`
}

export function formatDay(iso: string): string {
  return DAY.format(new Date(iso))
}
