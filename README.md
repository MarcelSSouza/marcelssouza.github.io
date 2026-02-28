# Focus - Productivity App

A beautiful, all-in-one productivity application built with web technologies.

## Features

- **Habits** - Track daily habits with streaks and progress visualization
- **Todos** - Manage tasks with priorities and due dates
- **Calendar** - View events and tasks on a calendar
- **Pomodoro** - Time management with focus sessions and breaks
- **Expenses** - Track spending with categories and charts
- **Notes** - Write and organize notes
- **Grocery** - Manage shopping lists with categories

## Project Structure

```
productivity-simple/
├── index.html              # Main HTML structure
├── css/
│   ├── styles.css         # Core styles and layouts
│   └── animations.css     # Animation definitions
├── js/
│   ├── app.js             # Main application file
│   ├── utils.js           # Utility functions
│   ├── storage.js         # Firebase & localStorage
│   └── modules/           # Feature modules (future)
├── README.md              # This file
└── .gitignore            # Git ignore rules
```

## Getting Started

1. Copy `.env.example` to `.env` and add your API keys (see [SECRETS.md](SECRETS.md))
2. Run `npm run build` then `firebase serve` (or open `dist/index.html` in a browser)
3. Data is saved to localStorage; sign in with Google to sync across devices

> **Security**: API keys and tokens are kept out of source via env vars. Add GitHub Secrets for CI; see [SECRETS.md](SECRETS.md).

## Firebase Setup

The app includes Firebase integration for cloud sync:

- **Authentication**: Google Sign-in
- **Database**: Firestore for data persistence
- Falls back to localStorage when offline

## Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Flexbox, Grid, Custom Properties
- **JavaScript (ES6+)** - Vanilla JS with modules
- **Firebase** - Authentication & Firestore
- **LocalStorage** - Client-side data persistence

## Features in Detail

### Habits

- Create daily habits with custom colors
- Track completion with visual heatmaps
- View streaks and monthly progress
- Habit cards with beautiful animations

### Todos

- Add tasks with priorities and due dates
- Sort by priority automatically
- Mark tasks as complete
- Visual priority indicators

### Calendar

- Monthly calendar view
- Add events with optional time and notes
- View todos on calendar
- Navigate months easily

### Pomodoro

- Customizable work/break durations
- Visual progress ring
- Session tracking
- Sound notifications when timer ends

### Expenses

- Log spending with categories
- View stats (total, monthly, count)
- Charts by category and daily trends
- Filter by category
- Dark mode support

### Notes

- Create and edit notes
- Word count tracking
- Last modified timestamps
- Auto-save functionality

### Grocery

- Categorized shopping lists
- Track progress with visual bar
- Mark items as purchased
- Clear checked items

## Dark Mode

Toggle dark mode from the sidebar. Your preference is saved locally.

## Offline Support

All data is stored locally in browser storage. Sign in with Google to sync to cloud.

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## Future Improvements

- [ ] Modularize JavaScript into separate files
- [ ] Add collaborative features
- [ ] Export data functionality
- [ ] Mobile app version
- [ ] Data visualization enhancements
- [ ] Recurring tasks/events
- [ ] Budget management
- [ ] Habit suggestions

## License

MIT License - Feel free to use and modify

## Contributing

Feel free to fork and submit pull requests for any improvements.
