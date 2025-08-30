# DnD-TDL: Drag & Drop Todo List

A modern, responsive weekly todo planner with advanced drag-and-drop functionality. Plan your week with pixel-perfect positioning and intelligent window resize handling.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?style=flat-square&logo=tailwind-css)

## Features

### Interactive Canvas Interface
- Free-form positioning anywhere on screen
- Double-click to create new todos instantly
- Visual drag-and-drop with real-time feedback
- Automatic positioning on window resize

### Weekly Planning Layout
- Responsive 7-day grid (Monday-Sunday)
- Current week display with proper dates
- Special sections for incomplete tasks and backlog
- Adaptive layout for desktop and mobile

### Todo Management
- Inline editing for text and estimated hours
- Click to toggle completion status
- Time tracking with hour estimation
- Automatic cleanup of empty todos
- Full keyboard navigation support

### Drag & Drop System
- Multi-section support between all day areas
- Automatic day detection on drop
- Flexible positioning within sections
- Visual feedback during drag operations
- Smooth animations and transitions

### Responsive Design
- Touch support for mobile devices
- Smart window resize handling
- Clean, minimal UI with Tailwind CSS
- Accessibility features and keyboard navigation
- Optimized performance with React 19 and Next.js 15

### Analytics
- Time tracking per day section
- Completion statistics
- Visual states for different todo types
- Real-time state synchronization

## Tech Stack

- **[Next.js 15](https://nextjs.org/)** - React framework with Turbopack
- **[React 19](https://react.dev/)** - Latest React with concurrent features
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety and developer experience
- **[Tailwind CSS 4](https://tailwindcss.com/)** - Utility-first CSS framework
- **[@dnd-kit](https://dndkit.com/)** - Drag-and-drop functionality
- **[date-fns](https://date-fns.org/)** - Date manipulation library
- **[Lucide React](https://lucide.dev/)** - Icon library

## Getting Started

### Prerequisites
- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/BaoGeist/DnD-TDL.git
   cd DnD-TDL
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

- **Create todos**: Double-click anywhere on the canvas
- **Edit todos**: Double-click to edit text, single-click to toggle completion
- **Schedule tasks**: Drag todos between day sections
- **Time estimation**: Use Tab key while editing to set hours

## Next Steps

### Cross-Device Synchronization
- Real-time sync across all devices
- Offline support with PWA capabilities
- Conflict resolution for simultaneous edits

### User Authentication
- Multiple authentication providers (Google, GitHub, Email)
- User profiles and preferences
- Data privacy with encryption
- Multi-workspace support

### Enhanced Features
- Weekly and monthly productivity reports
- Advanced time tracking and analytics
- Themes and customization options
- Calendar integration (Google Calendar, Outlook)
- Third-party app connections
- Export capabilities and API access

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/) by Vercel
- Drag-and-drop powered by [@dnd-kit](https://dndkit.com/)
- Icons by [Lucide](https://lucide.dev/)
- Font: [Geist](https://vercel.com/font) by Vercel
