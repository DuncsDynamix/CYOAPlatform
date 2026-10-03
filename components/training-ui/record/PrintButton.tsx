"use client"

import { DocumentIcon } from "../icons"

/** "Download PDF" opens the browser's print dialog; the record's print styles make it an A4 document. */
export function PrintButton() {
  return (
    <button type="button" className="tg-btn tg-btn--primary" onClick={() => window.print()}>
      <DocumentIcon /> Download PDF
    </button>
  )
}
