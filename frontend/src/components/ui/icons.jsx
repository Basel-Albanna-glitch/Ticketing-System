function Icon({ children, className = 'h-5 w-5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  )
}

export function DashboardIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.75" y="3.75" width="7" height="7" rx="1.5" />
      <rect x="13.25" y="3.75" width="7" height="4.5" rx="1.5" />
      <rect x="13.25" y="10.75" width="7" height="9.5" rx="1.5" />
      <rect x="3.75" y="13.25" width="7" height="7" rx="1.5" />
    </Icon>
  )
}

export function UserIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 19.5a7.5 7.5 0 0115 0" />
    </Icon>
  )
}

export function AtSignIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 12v1.5a2.5 2.5 0 005 0V12a9 9 0 10-4.5 7.79" />
    </Icon>
  )
}

export function EnvelopeIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.75" y="5.25" width="16.5" height="13.5" rx="1.5" />
      <path d="M4.5 6.5l7.5 6 7.5-6" />
    </Icon>
  )
}

export function LockIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10.5" width="15" height="9.75" rx="1.5" />
      <path d="M7.5 10.5V7.5a4.5 4.5 0 019 0v3" />
    </Icon>
  )
}

export function EyeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S5.5 5.5 12 5.5 21.5 12 21.5 12 18.5 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function EyeOffIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9.9 5.7A9.8 9.8 0 0112 5.5c6.5 0 9.5 6.5 9.5 6.5a16.4 16.4 0 01-2.9 3.9M6.3 7.3A16.3 16.3 0 002.5 12S5.5 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
      <path d="M9.9 9.9a3 3 0 004.2 4.2" />
      <path d="M3 3l18 18" />
    </Icon>
  )
}

export function BellIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 9a6 6 0 1112 0c0 4.5 1.5 6 2 6.75H4c.5-.75 2-2.25 2-6.75z" />
      <path d="M9.5 19a2.5 2.5 0 005 0" />
    </Icon>
  )
}

export function MenuIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </Icon>
  )
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </Icon>
  )
}

export function BoardIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.75" y="4.5" width="16.5" height="15" rx="1.5" />
      <path d="M9 4.5v15M15 4.5v15" />
    </Icon>
  )
}

export function TicketIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.75 8.25a1.5 1.5 0 011.5-1.5h13.5a1.5 1.5 0 011.5 1.5v2.25a1.75 1.75 0 000 3.5v2.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-2.25a1.75 1.75 0 000-3.5V8.25z" />
      <path d="M14.25 6.75v10.5" strokeDasharray="2 2" />
    </Icon>
  )
}

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19.5a5.5 5.5 0 0111 0" />
      <path d="M16 8.5a2.5 2.5 0 110 5" />
      <path d="M15 14.25c2.9.2 5 1.7 5 5.25" />
    </Icon>
  )
}

export function BadgeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M7.5 3.75h9a1.5 1.5 0 011.5 1.5v13.19a.75.75 0 01-1.14.64L12 16.94l-4.86 2.14a.75.75 0 01-1.14-.64V5.25a1.5 1.5 0 011.5-1.5z" />
      <circle cx="12" cy="10" r="2.25" />
    </Icon>
  )
}

export function ReportsIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 19.5V15M9.5 19.5V10M14.5 19.5V13M19.5 19.5V6" />
      <path d="M3.75 19.5h16.5" />
    </Icon>
  )
}

export function SettingsIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </Icon>
  )
}

export function LogoutIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9 21H5.25a1.5 1.5 0 01-1.5-1.5V4.5a1.5 1.5 0 011.5-1.5H9" />
      <path d="M15.75 16.5L21 12l-5.25-4.5" />
      <path d="M21 12H9" />
    </Icon>
  )
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 4.5v15M4.5 12h15" />
    </Icon>
  )
}

export function InboxIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.75 12h4.5l1.5 3h4.5l1.5-3h4.5" />
      <path d="M5.106 6.272L3.75 12v6a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-6l-1.356-5.728A1.5 1.5 0 0017.394 5H6.606a1.5 1.5 0 00-1.5 1.272z" />
    </Icon>
  )
}

export function FolderOpenIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.75 7.5a1.5 1.5 0 011.5-1.5h4.19a1.5 1.5 0 011.06.44l1.31 1.31a1.5 1.5 0 001.06.44h5.13a1.5 1.5 0 011.5 1.5v.56H5.7a1.5 1.5 0 00-1.45 1.12l-1.72 6.5a.75.75 0 01-1.48-.2z" />
      <path d="M4.5 18.75h14.03a1.5 1.5 0 001.45-1.12l1.5-5.63a1.5 1.5 0 00-1.45-1.88H5.7a1.5 1.5 0 00-1.45 1.12l-1.72 6.5" />
    </Icon>
  )
}

export function ClockIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5V12l3 1.75" />
    </Icon>
  )
}

export function CheckCircleIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M8.5 12.25l2.5 2.5 4.5-5" />
    </Icon>
  )
}

export function CalendarIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.75" y="5.25" width="16.5" height="14.25" rx="1.5" />
      <path d="M3.75 9.75h16.5M8 3.75v3M16 3.75v3" />
    </Icon>
  )
}

export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4.5 6.75h15M9.75 6.75V4.5a1.5 1.5 0 011.5-1.5h1.5a1.5 1.5 0 011.5 1.5v2.25M18 6.75l-.75 12.75a1.5 1.5 0 01-1.5 1.5H8.25a1.5 1.5 0 01-1.5-1.5L6 6.75" />
    </Icon>
  )
}

// Drag handle. Two columns of dots — the long-standing "grab here" convention.
export function GripIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="18" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="18" r="1.1" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function PencilIcon(props) {
  return (
    <Icon {...props}>
      <path d="M16.862 3.487a1.875 1.875 0 112.652 2.652L7.5 18.153l-3.75.75.75-3.75L16.862 3.487z" />
    </Icon>
  )
}

export function PaperClipIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18.375 5.625a3 3 0 00-4.243 0l-8.16 8.16a4.5 4.5 0 106.364 6.364l7.16-7.16" />
    </Icon>
  )
}

export function ChatIcon(props) {
  return (
    <Icon {...props}>
      <path d="M3.75 12a8.25 8.25 0 1114.13 5.77l.87 3.11-3.3-.86A8.25 8.25 0 013.75 12z" />
    </Icon>
  )
}

export function RefreshIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20.25 12a8.25 8.25 0 10-2.42 5.83" />
      <path d="M20.25 6.75V12h-5.25" />
    </Icon>
  )
}

export function ChevronRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9 5.25l6.75 6.75L9 18.75" />
    </Icon>
  )
}

export function BookIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 5.25A1.5 1.5 0 015.5 3.75H11a2 2 0 012 2v14.5a1.75 1.75 0 00-1.75-1.75H5.5A1.5 1.5 0 014 17V5.25z" />
      <path d="M20 5.25a1.5 1.5 0 00-1.5-1.5H13a2 2 0 00-2 2v14.5a1.75 1.75 0 011.75-1.75H18.5A1.5 1.5 0 0020 17V5.25z" />
    </Icon>
  )
}

// The three layout choices, drawn as the arrangement each one produces: two panels
// abreast, two panels stacked, and stacked panels whose rows are packed tighter.
export function LayoutSplitIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="7.5" height="15" rx="1.5" />
      <rect x="13" y="4.5" width="7.5" height="15" rx="1.5" />
    </Icon>
  )
}

export function LayoutStackIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="6.5" rx="1.5" />
      <rect x="3.5" y="13" width="17" height="6.5" rx="1.5" />
    </Icon>
  )
}

export function LayoutDenseIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M3.5 12h17M3.5 14.5h17" />
    </Icon>
  )
}

// Star for satisfaction ratings — `filled` toggles the solid fill.
export function StarIcon({ filled = false, className = 'h-5 w-5' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.98l-5.2 2.53.99-5.79-4.21-4.1 5.82-.85L12 3.5z" />
    </svg>
  )
}
