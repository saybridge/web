import { useState, useEffect, useCallback } from 'react';
import { X, Search, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import './SearchResults.css';

interface SearchResult {
  id: string;
  content: string;
  sender_name: string;
  created_at: string;
}

interface SearchResultsProps {
  query: string;
  roomId: string;
  onClose: () => void;
  onSelectMessage: (msgId: string) => void;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark className="search-highlight" key={i}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function SearchResults({ query, roomId, onClose, onSelectMessage }: SearchResultsProps) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get(
        `/search/messages?q=${encodeURIComponent(query)}&room_id=${encodeURIComponent(roomId)}`
      );
      if (res.data?.success) {
        setResults(res.data.data || []);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, roomId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      search();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className="search-results-panel">
      <div className="search-results-header">
        <div className="srp-header-pill">
          <div className="search-results-title">
            <Search size={16} />
            <span>Search Results</span>
            {!loading && results.length > 0 && (
              <span className="search-results-count">{results.length}</span>
            )}
          </div>
          <button className="search-results-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="search-results-content">
        {query.trim() && (
          <div className="search-results-query">
            Searching for "<strong>{query}</strong>"
          </div>
        )}
        {loading ? (
          <div className="search-results-loading">
            <Loader2 size={24} className="search-spinner" />
            <span>Searching…</span>
          </div>
        ) : !query.trim() ? (
          <div className="search-results-empty">
            <div className="search-results-empty-icon">
              <Search size={28} />
            </div>
            <h4>Search messages</h4>
            <p>Type a query to search messages in this channel.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="search-results-empty">
            <div className="search-results-empty-icon">
              <Search size={28} />
            </div>
            <h4>No results found</h4>
            <p>Try a different search term.</p>
          </div>
        ) : (
          <div className="search-results-list">
            {results.map((result) => (
              <button
                className="search-result-item"
                key={result.id}
                onClick={() => onSelectMessage(result.id)}
              >
                <div className="search-result-header">
                  <span className="search-result-sender">{result.sender_name}</span>
                  <span className="search-result-date">{formatDate(result.created_at)}</span>
                </div>
                <p className="search-result-content">
                  {highlightText(result.content, query)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
