import React from 'react';
import './SearchResults.css';
import { ActivityResponse } from '@stream-io/feeds-client';
import Activity from './Activity';

interface SearchResultsProps {
  activities?: ActivityResponse[];
  searchQuery: string;
  isLoading: boolean;
  error?: boolean;
}

export function SearchResults({
  activities = [],
  searchQuery,
  isLoading,
  error,
}: SearchResultsProps) {
  const hasResults = activities.length > 0;

  if (isLoading) {
    return (
      <div className="search-results-container">
        <div className="search-state-container">
          <div className="search-loading-spinner" />
          <p className="search-state-text">
            Searching for "{searchQuery}"...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="search-results-container">
        <div className="search-state-container">
          <div className="search-state-icon error">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="search-state-text error">Error searching</p>
        </div>
      </div>
    );
  }

  if (!searchQuery.trim()) {
    return (
      <div className="search-results-container">
        <div className="search-state-container large">
          <div className="search-state-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="search-state-title">Search for activities</h3>
          <p className="search-state-subtitle">
            Enter a search term to find activities
          </p>
        </div>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="search-results-container">
        <div className="search-state-container large">
          <div className="search-state-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="search-state-title">No results found</h3>
          <p className="search-state-subtitle">
            No activities found for "{searchQuery}"
          </p>
          <p className="search-state-hint">
            Try different keywords or search terms
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Results Header - Sticky */}
      <div className="search-results-header">
        <div className="search-results-info">
          <svg className="search-results-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="search-results-count">
            {activities.length} result{activities.length !== 1 ? "s" : ""} for
            "{searchQuery}"
          </span>
        </div>
        <div className="search-results-badge">
          <span className="badge">
            {activities.length} activities
          </span>
        </div>
      </div>

      {/* Activities Results */}
      <div className="search-results-list">
        {activities.map((activity) => (
          <Activity
            key={`search-activity-${activity.id}`}
            activity={activity}
            compactMode={true}
          />
        ))}
      </div>
    </>
  );
}
