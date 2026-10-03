import { ERROR_COPY } from "@/lib/training/copy"
import { AlertIcon } from "../icons"
import { Footer, Screen, ScreenBody } from "../Screen"

/** Same copy and behaviour as the legacy player: retry in place when the failure is temporary, restart always. */
export function ErrorScreen({
  message,
  retryable,
  onRetry,
  onRestart,
}: {
  message: string
  retryable: boolean
  onRetry: () => void
  onRestart: () => void
}) {
  return (
    <Screen>
      <ScreenBody>
        <div className="tg-error" role="alert">
          <AlertIcon className="tg-error-icon" />
          <p className="tg-error-message">{message}</p>
        </div>
      </ScreenBody>
      <Footer>
        {retryable && (
          <button type="button" className="tg-btn tg-btn--primary" onClick={onRetry}>
            {ERROR_COPY.tryAgain}
          </button>
        )}
        <button type="button" className={retryable ? "tg-btn tg-btn--secondary" : "tg-btn tg-btn--primary"} onClick={onRestart}>
          {ERROR_COPY.restart}
        </button>
      </Footer>
    </Screen>
  )
}
