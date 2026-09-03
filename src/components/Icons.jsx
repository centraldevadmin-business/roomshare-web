// Pure SVG icon library — no emoji anywhere in the app.
// Each icon is a thin wrapper around an SVG path. `size` controls width/height,
// `className` lets Tailwind style the stroke/fill.

const base = (size = 20, className = '') => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className,
})

export const HomeIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
    <path d="M9 21v-6h6" />
  </svg>
)

export const InstallIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 3v12" />
    <path d="m6 9 6 6 6-6" />
    <path d="M4 21h16" />
    <path d="M5 21v-4h14v4" />
  </svg>
)

export const CommunityIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15.5 15a4 4 0 0 1 5 0" />
  </svg>
)

export const LedgerIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8M8 11h8M8 15h5" />
  </svg>
)

export const ControlIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export const OpsIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M9 10h6M9 14h6M7 8h.01M7 16h.01" />
  </svg>
)

export const CrownIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M4 20h16l-2-9-5 4-5-4-2 9z" />
    <path d="M6 11V6l3 3 3-3v5M18 11V6l-3 3-3-3v5" />
  </svg>
)

export const PersonIcon = ({ size = 24, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
)

export const MegaphoneIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M3 11v-2l16-6v10z" />
    <path d="M3 11a3 3 0 0 0 3 3" />
    <path d="M17 9a4 4 0 0 1 0 6" />
  </svg>
)

export const PlateIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
  </svg>
)

export const SunIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </svg>
)

export const MoonIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
)

export const BowlIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M3 12h18" />
    <path d="M5 12a7 7 0 0 0 14 0" />
    <path d="M12 3v4" />
    <path d="M8 3v3M16 3v3" />
  </svg>
)

export const CartIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M3 3h2l2.4 12.3a2 2 0 0 0 2 1.7h7.9a2 2 0 0 0 2-1.6L23 8H6" />
    <circle cx="10" cy="20" r="1.4" />
    <circle cx="18" cy="20" r="1.4" />
  </svg>
)

export const BasketIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
  </svg>
)

export const MoneyIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 6v-1.5M6 6V4.5M18 6V4.5" />
  </svg>
)

export const WalletIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="2" y="6" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
    <circle cx="17" cy="14" r="1.5" />
    <path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </svg>
)

export const CheckAllIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

export const CheckIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const PlusIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const MinusIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M5 12h14" />
  </svg>
)

export const TrashIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
  </svg>
)

export const EditIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

export const LockIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
)

export const BellIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

export const TaskIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

export const CalendarIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)

export const PinIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 21s-5-4.5-7.5-8A5.5 5.5 0 0 1 12 5a5.5 5.5 0 0 1 7.5 8c-2.5 3.5-7.5 8-7.5 8z" />
    <circle cx="12" cy="11" r="2" />
  </svg>
)

export const PlaneIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M17.8 19.4 3 12l6.2-2.6 3.3 7.9 5.3-1.5zM3 12l6.2-2.6M17.8 6.6 12 12" />
  </svg>
)

export const MenuIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
)

export const LogoutIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
)

export const RefreshIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M21 12a9 9 0 1 1-3-6.7" />
    <path d="M21 4v5h-5" />
  </svg>
)

export const TrendUpIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M23 6 13.5 15.5 8.5 10.5 1 18" />
    <path d="M17 6h6v6" />
  </svg>
)

export const TrendDownIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M23 18 13.5 8.5 8.5 13.5 1 6" />
    <path d="M17 18h6v-6" />
  </svg>
)

export const ArrowLeftIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
)

export const ArrowRightIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
)

export const FireIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .3-2 .8-2.8C8.5 9.5 7 11 7 13a5 5 0 0 0 10 0c0-4-5-7-5-11z" />
  </svg>
)

export const WaterIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
  </svg>
)

export const ZapIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
  </svg>
)

export const BroomIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M16 4s2 2 2 5-2 5-2 5M8 12s-2 2-2 5 2 5 2 5" />
    <path d="M12 2l-4 4M12 2l4 4" />
    <path d="M8 12l8-8" />
  </svg>
)

export const SparkleIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" />
  </svg>
)

export const WarningIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M10.3 3.8 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
)

export const CloseIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const SearchIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

export const ChevronDownIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const ReceiptIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M4 2v20l2-2 2 2 2-2 2 2 2-2 2 2 2-2V2l-2 2-2-2-2 2-2-2-2 2-2-2-2 2z" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
)

export const GiftIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="3" y="8" width="18" height="14" rx="2" />
    <path d="M12 8v14M3 12h18M12 3a3 3 0 0 0-3 3c0 2 3 3 3 3s3-1 3-3a3 3 0 0 0-3-3z" />
  </svg>
)

export const CogIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export const EmailIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
)

export const UserIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
)

export const KeyIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="8" cy="15" r="5" />
    <path d="m11.5 11.5 9-9M18 4v4M20 8h-4" />
  </svg>
)

export const ShieldIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
)

export const UsersIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M3.5 20c0-4 3-6 6.5-6s6.5 2 6.5 6" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M15 14c-2.5 0-4.5 1.3-5.5 3.3" />
    <path d="M20.5 19c1-1.3 1.5-2.8 1.5-4.3 0-2.8-2.2-5-5-5" />
  </svg>
)

export const EyeIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const EyeOffIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A9 9 0 0 1 22 12a9 9 0 0 1-2.1 3M6.1 6.1A9 9 0 0 0 2 12a9 9 0 0 0 2.1 3" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const DownloadIcon = ({ size = 20, className = '' }) => (
  <svg {...base(size, className)}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
)
