import React from 'react';
import './EnrichedText.css';

interface EnrichedTextProps {
  text: string;
  className?: string;
}

const EnrichedText: React.FC<EnrichedTextProps> = ({ text, className = '' }) => {
  if (!text || !text.trim()) {
    return null;
  }

  // URL regex pattern to detect URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Check if text contains URLs
  if (!urlRegex.test(text)) {
    // No URLs found, return plain text
    return <p className={className}>{text}</p>;
  }

  // Split text by URLs and create clickable links
  const parts = text.split(urlRegex);
  
  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (urlRegex.test(part)) {
          // This is a URL, make it clickable
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="enriched-link"
              onClick={(e) => {
                // Prevent event bubbling to avoid triggering post interactions
                e.stopPropagation();
              }}
            >
              {part}
            </a>
          );
        }
        // Regular text
        return part;
      })}
    </p>
  );
};

export default EnrichedText;
