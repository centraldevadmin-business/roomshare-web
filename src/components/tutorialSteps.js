// Tutorial step definitions for the first-login tour. Kept separate from the
// Tutorial component so the steps can be tailored per role.

// Shared steps shown to everyone (residents and admins alike).
// `icon` is a string key that the Tutorial component maps to an SVG icon
// component (see Icons.jsx) so this plain .js file stays emoji-free.
export const SHARED_STEPS = [
  {
    title: 'Welcome to House Command',
    body: 'This is your household command center. Meals, expenses, rent, and chores — all in one place. Let me show you around.',
    icon: 'home',
  },
  {
    title: 'The Greeting',
    body: 'This banner greets you by time of day. Tap it away — it\'s just good vibes.',
    icon: 'sun',
    target: 'greeting',
  },
  {
    title: 'Meal Matrix',
    body: 'Tap a meal (Breakfast / Lunch / Dinner) to mark that you ate. The big orange button sets all three of today\'s meals in ONE tap. Dinner locks at 4 PM, breakfast & lunch at 9 PM.',
    icon: 'plate',
    target: 'meal-matrix',
  },
  {
    title: 'Your Debt Snapshot',
    body: 'This card shows what you owe or are owed. Green = the house owes you. Red = you owe the house. It updates as you tap meals and log expenses.',
    icon: 'ledger',
    target: 'debt-card',
  },
  {
    title: 'Bazar Log',
    body: 'Whoever goes grocery shopping logs it here. That spend folds into the shared grocery pool and is settled at month end.',
    icon: 'cart',
    target: 'bazar-log',
  },
  {
    title: 'Vacation Mode',
    body: 'Heading out? Add your vacation dates here. While you\'re away, meal and cost charges are waived — you pay nothing.',
    icon: 'plane',
    target: 'vacation-mode',
  },
  {
    title: 'Bottom Tab Bar',
    body: 'Dashboard (meals + money), Community (announcements, to-dos, calendar), and Ledger (your full balance + deposit requests).',
    icon: 'community',
    target: 'tab-bar',
  },
  {
    title: 'Community Board',
    body: 'Anyone can post announcements, add to-dos, and create calendar events. Admins can delete. Everyone sees the same live board.',
    icon: 'megaphone',
    target: 'community',
  },
  {
    title: 'You\'re All Set!',
    body: 'That\'s everything. Tap meals as you eat, log groceries after the bazar, and settle up at month end.',
    icon: 'sparkle',
  },
]

// Extra steps shown only to admins, appended after the shared tour.
export const ADMIN_EXTRA_STEPS = [
  {
    title: 'Ledger Ops (Admins)',
    body: 'Here you log grocery/utility expenses, approve deposit requests, and run month-end settlement. Residents don\'t see this tab.',
    icon: 'cog',
    target: 'admin-ops',
  },
  {
    title: 'Control Center',
    body: 'The Control tab is your admin dashboard: finalize the month, update house settings, and force-sync if data ever gets stuck.',
    icon: 'control',
    target: 'control',
  },
  {
    title: 'Members',
    body: 'Add or manage residents here. The first person to sign up is the admin; later sign-ups need an invite code.',
    icon: 'users',
    target: 'members',
  },
  {
    title: 'You\'re a House Pro!',
    body: 'That\'s everything an admin needs. Tap meals, log expenses, approve deposits, and settle up each month. You\'re in good hands.',
    icon: 'crown',
  },
]

// Residents see the shared tour, then finish.
export const RESIDENT_TUTORIAL_STEPS = SHARED_STEPS

// Admins see the shared tour, then the admin-only steps.
export const ADMIN_TUTORIAL_STEPS = [...SHARED_STEPS, ...ADMIN_EXTRA_STEPS]
