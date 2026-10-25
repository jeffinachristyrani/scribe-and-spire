import React, { useState, useEffect } from 'react';
import api from '../services/api';
import Loading from './Loading';

const AuthorReviewAnalytics = ({ bookId }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get(`/ml/books/${bookId}/review-analytics`);
        setAnalytics(res.data);
      } catch (err) {
        console.error('Failed to load review analytics:', err);
        const detail = err.response?.data?.detail;
        setError(typeof detail === 'string' ? detail : 'Could not fetch review analytics.');
      } finally {
        setLoading(false);
      }
    };

    if (bookId) {
      fetchAnalytics();
    }
  }, [bookId]);

  if (loading) {
    return (
      <div className="analytics-card-container">
        <Loading message="Computing review sentiment analytics..." />
      </div>
    );
  }

  if (error) {
    return null; // Silently hide or show subtle note if not authorized
  }

  if (!analytics || !analytics.has_data) {
    return (
      <div className="analytics-card-container empty-analytics">
        <div className="analytics-header-banner">
          <div>
            <span className="badge-author-confidential">Author Intelligence</span>
            <h3 className="analytics-card-title">Reader Review Sentiment & Analytics</h3>
          </div>
        </div>
        <div className="empty-analytics-body">
          <p className="empty-title">Awaiting Reader Reviews</p>
          <p className="empty-subtitle">
            As soon as readers rate and leave reviews for your manuscript, our NLP model will automatically generate sentiment graphs, thematic breakdowns, and reception trends here.
          </p>
        </div>
      </div>
    );
  }

  const {
    average_rating,
    total_reviews,
    sentiment_score,
    sentiment_label,
    sentiment_breakdown,
    rating_distribution,
    aspect_sentiments,
    key_themes,
    timeline,
    author_takeaways
  } = analytics;

  // Sentiment circle calculations
  const posPct = sentiment_breakdown.positive_pct || 0;
  const neuPct = sentiment_breakdown.neutral_pct || 0;
  const negPct = sentiment_breakdown.negative_pct || 0;

  // Donut SVG parameters
  const size = 160;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const posStroke = (posPct / 100) * circumference;
  const neuStroke = (neuPct / 100) * circumference;
  const negStroke = (negPct / 100) * circumference;

  const neuOffset = -posStroke;
  const negOffset = -(posStroke + neuStroke);

  return (
    <div className="analytics-card-container">
      {/* Header */}
      <div className="analytics-header-banner">
        <div>
          <div className="badge-author-confidential">
            🔒 Author Intelligence • Private To You
          </div>
          <h3 className="analytics-card-title">Reader Sentiment & Review Analytics</h3>
          <p className="analytics-card-sub">
            Based on {total_reviews} reader {total_reviews === 1 ? 'reflection' : 'reflections'} • Overall Sentiment: <strong>{sentiment_label}</strong> ({sentiment_score > 0 ? `+${sentiment_score}` : sentiment_score})
          </p>
        </div>
      </div>

      {/* Grid of Visual Graphs */}
      <div className="analytics-charts-grid">
        {/* Graph 1: Sentiment Donut Chart */}
        <div className="chart-panel">
          <h4 className="chart-title">Sentiment Distribution</h4>
          <span className="chart-subtitle">Polarity breakdown across reader reviews</span>

          <div className="donut-chart-container">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut-svg">
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={strokeWidth}
              />
              {/* Positive segment (Sage Green) */}
              {posPct > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#7da583"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${posStroke} ${circumference}`}
                  strokeDashoffset="0"
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              )}
              {/* Neutral segment (Warm Amber) */}
              {neuPct > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#d4a373"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${neuStroke} ${circumference}`}
                  strokeDashoffset={neuOffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              )}
              {/* Negative segment (Muted Crimson) */}
              {negPct > 0 && (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="transparent"
                  stroke="#e07a5f"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${negStroke} ${circumference}`}
                  strokeDashoffset={negOffset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
              )}
              <text
                x="50%"
                y="48%"
                textAnchor="middle"
                dy=".3em"
                className="donut-center-text"
              >
                {Math.round(posPct)}%
              </text>
              <text
                x="50%"
                y="65%"
                textAnchor="middle"
                className="donut-center-sub"
              >
                Positive
              </text>
            </svg>

            {/* Legend */}
            <div className="donut-legend">
              <div className="legend-row">
                <span className="legend-dot dot-pos"></span>
                <span className="legend-name">Positive:</span>
                <strong className="legend-value">{sentiment_breakdown.positive} ({posPct}%)</strong>
              </div>
              <div className="legend-row">
                <span className="legend-dot dot-neu"></span>
                <span className="legend-name">Neutral:</span>
                <strong className="legend-value">{sentiment_breakdown.neutral} ({neuPct}%)</strong>
              </div>
              <div className="legend-row">
                <span className="legend-dot dot-neg"></span>
                <span className="legend-name">Critical:</span>
                <strong className="legend-value">{sentiment_breakdown.negative} ({negPct}%)</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Graph 2: Rating Histogram (5★ to 1★) */}
        <div className="chart-panel">
          <h4 className="chart-title">Rating Histogram</h4>
          <span className="chart-subtitle">Distribution across 1 to 5 star scores (Average: {average_rating} ★)</span>

          <div className="ratings-bars-list">
            {[5, 4, 3, 2, 1].map((stars) => {
              const starKey = String(stars);
              const count = rating_distribution[starKey] || 0;
              const pct = rating_distribution.percentages?.[starKey] || 0;
              return (
                <div key={stars} className="rating-bar-row">
                  <span className="rating-bar-label">{stars} ★</span>
                  <div className="rating-bar-track">
                    <div
                      className={`rating-bar-fill fill-stars-${stars}`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                  <span className="rating-bar-count">
                    {count} <span className="rating-pct-muted">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Short Reader-Feedback Summary */}
      {author_takeaways && (
        <div className="author-feedback-summary">
          <div className="summary-icon">💡</div>
          <div className="summary-content">
            <h4 className="summary-heading">Overall Reader Feedback & Engagement</h4>
            <p className="summary-text">{author_takeaways}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthorReviewAnalytics;
