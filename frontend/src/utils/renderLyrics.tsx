import React from 'react';

export function renderWithLyrics(text: string): React.ReactNode {
  const parts = text.split(/(<<[^>]+>>)/g);
  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const match = part.match(/^<<(.+)>>$/);
    if (match) {
      return (
        <span key={i} className="italic text-[var(--color-secondary)] font-medium">
          "{match[1]}"
        </span>
      );
    }
    return part;
  });
}
