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

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  if (!urlRegex.test(text)) {
    return <p className={className}>{text}</p>;
  }

  const parts = text.split(urlRegex);
  
  return (
    <p className={className}>
      {parts.map((part, index) => {
        if (urlRegex.test(part)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="enriched-link"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </p>
  );
};

export default EnrichedText;
