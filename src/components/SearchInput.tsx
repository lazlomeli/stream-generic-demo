import { useState, useEffect, useRef } from "react";
import './SearchInput.css';

interface SearchInputProps {
  placeholder?: string;
  className?: string;
  value?: string;
  searchMode?: "$q" | "$autocomplete";
  isLoading?: boolean;
  onSearch?: (query: string, mode?: "$q" | "$autocomplete") => void;
  onClear?: () => void;
  onSearchModeChange?: (mode: "$q" | "$autocomplete") => void;
}

export function SearchInput({ 
  placeholder = "Search activities...", 
  className = "",
  value = "",
  searchMode = "$autocomplete",
  isLoading = false,
  onSearch,
  onClear,
  onSearchModeChange
}: SearchInputProps) {
  const [query, setQuery] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [showSearchMode, setShowSearchMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update local state when prop changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Debounce search with proper cleanup
  useEffect(() => {
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      if (query.trim()) {
        onSearch?.(query, searchMode);
      } else {
        onClear?.();
      }
    }, 300);

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, searchMode, onSearch, onClear]);

  const handleClear = () => {
    setQuery("");
    onClear?.();
    inputRef.current?.focus();
  };

  const handleSearchModeChange = (mode: "$q" | "$autocomplete") => {
    setShowSearchMode(false);
    onSearchModeChange?.(mode);
    if (query.trim()) {
      onSearch?.(query, mode);
    }
  };

  return (
    <div className={`search-input-container ${className}`}>
      {/* Search Input */}
      <div className="search-input-wrapper">
        <div className="search-icon-wrapper">
          <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={`search-input-field ${isFocused ? 'focused' : ''}`}
        />
        
        {/* Clear Button */}
        {query && (
          <button
            onClick={handleClear}
            className="search-clear-button"
            aria-label="Clear search"
          >
            <svg className="clear-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {/* Search Mode Toggle */}
        <button
          onClick={() => setShowSearchMode(!showSearchMode)}
          className="search-mode-button"
          aria-label="Filter options"
        >
          <svg className="filter-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Loading Indicator */}
      {isLoading && query.trim() && (
        <div className="search-loading-indicator">
          <div className="loading-spinner" />
        </div>
      )}

      {/* Search Mode Dropdown */}
      {showSearchMode && (
        <div className="search-mode-dropdown">
          <div className="search-mode-options">
            <button
              onClick={() => handleSearchModeChange("$q")}
              className={`search-mode-option ${searchMode === "$q" ? "active" : ""}`}
            >
              <span className="search-mode-label">Exact Match</span>
            </button>
            <button
              onClick={() => handleSearchModeChange("$autocomplete")}
              className={`search-mode-option ${searchMode === "$autocomplete" ? "active" : ""}`}
            >
              <span className="search-mode-label">Autocomplete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

