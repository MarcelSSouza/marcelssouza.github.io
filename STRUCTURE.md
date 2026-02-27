# Project Structure Documentation

## Overview

The Focus productivity app has been reorganized from a monolithic ~1600-line HTML file into a clean, modular project structure with proper separation of concerns.

## Directory Layout

```
productivity-simple/
├── index.html                 # Main HTML document (265 lines)
│                             # Only contains semantic HTML structure & modals
│
├── css/
│   ├── styles.css            # Core styles & layouts (700+ lines)
│   │                         # Design tokens, components, responsive design
│   │
│   └── animations.css        # Animation definitions (380+ lines)
│                             # Keyframes, transitions, stagger effects
│
├── js/
│   ├── app.js               # Main application (1000+ lines)
│   │                        # Orchestrates all features & functionality
│   │
│   ├── utils.js             # Utility functions (150+ lines)
│   │                        # String, date, DOM, and UI helpers
│   │
│   ├── storage.js           # Storage & Firebase (150+ lines)
│   │                        # LocalStorage abstraction, Firebase config
│   │
│   └── modules/             # Feature modules (for future expansion)
│
├── README.md                # Project documentation
├── STRUCTURE.md             # This file
├── .gitignore              # Git configuration
└── package.json            # Project metadata (when needed)
```

## File Breakdown

### index.html (265 lines)

- **Purpose**: Semantic HTML structure
- **Contains**:
    - Navigation sidebar
    - Main content pages (7 pages)
    - Modal dialogs (6 modals)
    - Firebase script references
    - No CSS or logic embedded

### css/styles.css (700+ lines)

- **Design Tokens**: Color palette, spacing, shadows
- **Components**: Buttons, cards, forms, modals
- **Layouts**: Sidebar, main content, grid systems
- **Features**:
    - Light/dark mode support
    - Responsive breakpoints
    - Habit cards, calendar grid, expense tables
    - Custom form inputs

### css/animations.css (380+ lines)

- **Keyframes**: 20+ animation definitions
- **Stagger Effects**: Cascading animations for lists
- **Transitions**: Smooth state changes
- **Features**:
    - Page transitions
    - Button interactions
    - Card animations
    - Modal entrance/exit
    - Pomodoro ring animation

### js/utils.js (150+ lines)

- **String Utilities**: `esc()` for XSS prevention
- **Date Utilities**: `today()`, `ddiff()`, `fdate()` for date handling
- **UI Utilities**: `toast()`, `openModal()`, `closeModal()`
- **DOM Helpers**: Query selectors, class manipulation

### js/storage.js (150+ lines)

- **Storage Abstraction**: `S` object for localStorage
- **Firebase Config**: Project credentials and initialization
- **Auth Handling**: Google Sign-in integration
- **Sync**: Cloud sync via Firestore
- **Fallback**: Works offline with localStorage

### js/app.js (1000+ lines)

- **State Management**: Central app state object
- **Navigation**: Page routing system
- **Features Implemented**:
    - Habits (with streaks & heatmaps)
    - Todos (with priorities & due dates)
    - Calendar (monthly view with events)
    - Pomodoro (with customizable sessions)
    - Expenses (with charts & filters)
    - Notes (with auto-save)
    - Grocery (with categories & progress)
- **Event Handlers**: All click, input, and form handlers

## Code Organization in app.js

The app.js file is organized into logical sections with clear headers:

```javascript
// APPLICATION STATE & CONSTANTS
window._appState = {
    /* state */
};
const COLORS = [
    /* */
];
const CAT_COLORS = {
    /* */
};

// MODULE 1: DARK MODE
const darkMode = {
    /* */
};

// MODULE 2: HABITS
const renderHabits = () => {
    /* */
};
const createHabit = () => {
    /* */
};
const toggleHabit = () => {
    /* */
};
// ...etc

// MODULE 3: TODOS
const renderTodos = () => {
    /* */
};
const createTodo = () => {
    /* */
};
// ...etc

// MODULE 4: CALENDAR
const renderCalendar = () => {
    /* */
};
// ...etc

// MODULE 5: POMODORO
// ...etc

// MODULE 6: EXPENSES
// ...etc

// MODULE 7: NOTES
// ...etc

// MODULE 8: GROCERY
// ...etc

// INITIALIZATION
// Bootstrap code and initial renders
```

## Dependencies

- **Firebase**: Cloud sync (optional, falls back to localStorage)
- **No external frameworks**: Pure vanilla JavaScript
- **No build tools**: Works directly in browser

## Entry Point

1. Browser loads `index.html`
2. Loads CSS: `styles.css` and `animations.css`
3. Loads Firebase libraries
4. Loads JavaScript module: `app.js`
5. `app.js` imports utilities from `utils.js` and `storage.js`
6. Application initializes and renders

## Data Flow

```
app.js (State)
    ↓
Storage (localStorage/Firebase)
    ↓
Render Functions
    ↓
DOM (HTML)
    ↓
Event Listeners
    ↓
Update Functions
    ↓
Back to State
```

## Feature Separation

Each feature (Habits, Todos, etc.) follows a consistent pattern:

```javascript
// Render function
const render[Feature]() { /* Display logic */ }

// CRUD operations
const create[Item] = () => { /* Add */ }
const read[Item] = (id) => { /* Get */ }
const update[Item] = (id, data) => { /* Modify */ }
const delete[Item] = (id) => { /* Remove */ }

// Helper functions
const calc[Metric] = () => { /* Compute */ }

// Export to window
window._[feature] = { /* public API */ }
```

## Future Modularization

When the project grows, each feature can be moved to `js/modules/`:

```
js/modules/
├── habits.js
├── todos.js
├── calendar.js
├── pomodoro.js
├── expenses.js
├── notes.js
└── grocery.js
```

Then imported in `app.js` using ES modules:

```javascript
import { renderHabits, createHabit, ... } from './modules/habits.js';
```

## Styling Architecture

### CSS Variables (Design Tokens)

**Light Mode**:

- Background: `#f0f2f5`
- Surface: `#fff`
- Primary: `#5b6ef5`

**Dark Mode**:

- Background: `#0e1118`
- Surface: `#181c28`
- Primary: `#7080f9`

### Component Classes

- `.card` - Container component
- `.btn`, `.btn-p`, `.btn-g`, `.btn-d` - Buttons
- `.ti` - Todo item
- `.hcard` - Habit card
- `.modal`, `.mbk` - Modal system
- `.fab` - Floating action button

## Build Size

- **HTML**: ~10 KB (265 lines)
- **CSS**: ~30 KB (1080 lines)
- **JavaScript**: ~40 KB (1300 lines)
- **Total**: ~80 KB (uncompressed)

## Performance Notes

- Fast initial load (no build tools, no compiler overhead)
- Single-page app (no full page reloads)
- Local storage sync is instantaneous
- Firebase sync is debounced (800ms)
- Animations use CSS (GPU accelerated)
- Canvas charts render on-demand

## Version History

### v1.0 (Current)

- Organized from monolithic file
- Modular CSS with animations separate
- Utility functions in dedicated file
- Storage abstraction for Firebase/localStorage
- All features maintained
- Full dark mode support
- Responsive design

## Contributing

When adding new features:

1. Add HTML structure to `index.html`
2. Add styles to appropriate CSS file
3. Add logic to `app.js` in dedicated section
4. Follow existing naming conventions
5. Export public API to `window._[feature]`
6. Add documentation to `README.md`
