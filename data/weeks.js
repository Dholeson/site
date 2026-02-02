// data/weeks.js
// This module exports initial week data. You can edit directly or manage via admin console.

export const weeks = [
  {
    id: 'week-01',
    title: 'Build Journal MVP',
    startDate: '2026-01-05',
    status: 'completed',
    summary: 'Implemented the initial version of the Weekly Project Journal.',
    days: [
      { date: '2026-01-05', notes: 'Set up the project structure, created index and archive pages.' },
      { date: '2026-01-06', notes: 'Designed dark mode theme and cards layout.' },
      { date: '2026-01-07', notes: 'Implemented week archive with simple JSON data store.' },
      { date: '2026-01-08', notes: 'Added admin console for managing weeks.' },
      { date: '2026-01-09', notes: 'Wrote sample content for week 1.' },
      { date: '2026-01-10', notes: 'Polished UI and updated styles.' },
      { date: '2026-01-11', notes: 'Reviewed project and prepared for release.' }
    ]
  }
];
