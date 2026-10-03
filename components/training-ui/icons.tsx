import type { ReactNode } from "react"

/** Line icons drawn in currentColor. Decorative: the adjacent text always carries the meaning. */
interface IconProps {
  className?: string
}

function Svg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className ? `tg-icon ${className}` : "tg-icon"}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="M4.5 10.5l3.5 3.5 7.5-8" /></Svg>
export const AlertIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="10" r="7.5" /><path d="M10 6.5v4" /><path d="M10 13.5h.01" /></Svg>
export const DotIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="10" r="2.5" fill="currentColor" /></Svg>
export const LockIcon = (p: IconProps) => <Svg {...p}><rect x="4.5" y="9" width="11" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 016 0V9" /></Svg>
export const ListIcon = (p: IconProps) => <Svg {...p}><path d="M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.5 5.5h.01M3.5 10h.01M3.5 14.5h.01" /></Svg>
export const NotesIcon = (p: IconProps) => <Svg {...p}><path d="M5 3.5h7l3 3v10H5z" /><path d="M8 9.5h4M8 12.5h4" /></Svg>
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M5 5l10 10M15 5L5 15" /></Svg>
export const ArrowLeftIcon = (p: IconProps) => <Svg {...p}><path d="M12 4.5L6.5 10l5.5 5.5" /></Svg>
export const ArrowRightIcon = (p: IconProps) => <Svg {...p}><path d="M8 4.5l5.5 5.5L8 15.5" /></Svg>
export const SpeakerIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 8h3l4-3.5v11l-4-3.5h-3z" /><path d="M14 7.5a3.5 3.5 0 010 5" /></Svg>
export const SpeakerOffIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 8h3l4-3.5v11l-4-3.5h-3z" /><path d="M13.5 8l4 4M17.5 8l-4 4" /></Svg>
export const ClockIcon = (p: IconProps) => <Svg {...p}><circle cx="10" cy="10" r="7.5" /><path d="M10 6v4l2.5 2" /></Svg>
export const ChatIcon = (p: IconProps) => <Svg {...p}><path d="M3.5 4.5h13v9h-7l-4 3v-3h-2z" /></Svg>
export const RefreshIcon = (p: IconProps) => <Svg {...p}><path d="M15.5 8.5A6 6 0 104.5 11" /><path d="M15.5 3.5v5h-5" /></Svg>
export const DocumentIcon = (p: IconProps) => <Svg {...p}><path d="M5 2.5h7l3 3v12H5z" /><path d="M8 9h4M8 12h4M8 15h2" /></Svg>
