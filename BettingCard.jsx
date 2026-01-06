import React from 'react';
import './BettingCard.css';

const BettingCard = ({ 
  horseName = "First Greyed",
  location = "Wolverhampton",
  raceTime = "16:45 (Dublin)",
  roi = 24.8,
  confidenceRating = 34.8,
  winProbability = 32,
  placeProbability = 68,
  odds = "3/1",
  recommendedBet = 30.00,
  potentialWin = 87.00,
  expectedValue = 7.44,
  formAnalysis = "Most reliable pick with winning form already proven at the venue. Market shows the confidence despite shorter odds."
}) => {
  
  // Calculate overall bet quality score (0-100)
  const calculateBetQuality = () => {
    // Weight the metrics: Win Prob (40%), ROI (30%), Confidence (30%)
    const score = (winProbability * 0.4) + (roi * 0.3) + (confidenceRating * 0.3);
    return Math.round(score);
  };

  const betQuality = calculateBetQuality();
  
  // Determine recommendation based on weighted analysis
  const getRecommendation = () => {
    // Strong bet: Good win prob + acceptable confidence OR exceptional ROI
    if ((winProbability >= 40 && confidenceRating >= 50) || 
        (roi >= 30 && confidenceRating >= 45)) {
      return { action: 'STRONG BET', color: '#10b981', icon: '✅', level: 'strong' };
    }
    // Moderate bet: Decent metrics but some concerns
    else if (betQuality >= 35 && winProbability >= 30) {
      return { action: 'CONSIDER', color: '#f59e0b', icon: '⚠️', level: 'moderate' };
    }
    // Weak bet: Low confidence or poor probability despite good ROI
    else {
      return { action: 'SKIP', color: '#ef4444', icon: '❌', level: 'weak' };
    }
  };

  const recommendation = getRecommendation();

  // Convert metrics to star ratings (out of 5)
  const getStars = (value, max = 100) => {
    const stars = Math.round((value / max) * 5);
    return '⭐'.repeat(Math.max(1, stars));
  };

  return (
    <div className="betting-card">
      {/* Header */}
      <div className="card-header">
        <div className="horse-info">
          <h2 className="horse-name">{horseName}</h2>
          <div className="race-details">
            <span className="location">📍 {location}</span>
            <span className="race-time">{raceTime}</span>
          </div>
        </div>
        <div className="roi-badge" style={{ background: roi >= 25 ? '#10b981' : '#6b7280' }}>
          ✓ {roi}% ROI
        </div>
      </div>

      {/* Unified Decision Panel - THE KEY IMPROVEMENT */}
      <div className="decision-panel" style={{ borderColor: recommendation.color }}>
        <div className="panel-header">
          <h3>🎯 BET QUALITY ANALYSIS</h3>
          <div className="quality-score" style={{ background: recommendation.color }}>
            {betQuality}/100
          </div>
        </div>

        <div className="metrics-unified">
          <div className="metric-row">
            <span className="metric-label">Win Probability</span>
            <div className="metric-value">
              <strong>{winProbability}%</strong>
              <span className="stars">{getStars(winProbability)}</span>
            </div>
          </div>
          <div className="metric-row">
            <span className="metric-label">ROI Potential</span>
            <div className="metric-value">
              <strong>{roi}%</strong>
              <span className="stars">{getStars(roi, 50)}</span>
            </div>
          </div>
          <div className="metric-row">
            <span className="metric-label">Confidence Rating</span>
            <div className="metric-value">
              <strong className={confidenceRating < 40 ? 'low-confidence' : ''}>
                {confidenceRating}/100
              </strong>
              <span className="stars">{getStars(confidenceRating)}</span>
            </div>
          </div>
        </div>

        {/* Clear Action Recommendation */}
        <div className="recommendation-action" style={{ background: recommendation.color }}>
          <span className="rec-icon">{recommendation.icon}</span>
          <span className="rec-text">{recommendation.action}</span>
        </div>

        {/* Why this recommendation */}
        <div className="recommendation-reason">
          {recommendation.level === 'strong' && (
            <p>✓ Strong fundamentals across all metrics. Good value bet.</p>
          )}
          {recommendation.level === 'moderate' && (
            <p>⚠️ Mixed signals. ROI is attractive but confidence/probability concerns exist.</p>
          )}
          {recommendation.level === 'weak' && (
            <p>❌ Low win probability ({winProbability}%) and weak confidence ({confidenceRating}/100) suggest high risk despite {roi}% ROI.</p>
          )}
        </div>
      </div>

      {/* Betting Details */}
      <div className="betting-details">
        <div className="bet-amount">
          <span className="label">💰 Recommended Bet</span>
          <span className="value">€{recommendedBet.toFixed(2)}</span>
        </div>
        <div className="potential-returns">
          <div className="return-row">
            <span>If wins:</span>
            <strong className="win-amount">→ €{potentialWin.toFixed(2)}</strong>
          </div>
          <div className="return-row">
            <span>Expected value:</span>
            <strong className="ev-amount">+ €{expectedValue.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div className="additional-info">
        <div className="odds-section">
          <span className="label">Odds:</span>
          <span className="odds-value">{odds}</span>
          <span className="label">Place Prob:</span>
          <span className="prob-value">{placeProbability}%</span>
        </div>
        
        <div className="form-analysis">
          <strong>Why Now:</strong> {formAnalysis}
        </div>
      </div>

      {/* Quick Action Button */}
      <button 
        className={`bet-button ${recommendation.level}`}
        style={{ 
          background: recommendation.level === 'weak' ? '#9ca3af' : recommendation.color,
          cursor: recommendation.level === 'weak' ? 'not-allowed' : 'pointer'
        }}
        disabled={recommendation.level === 'weak'}
      >
        {recommendation.level === 'weak' ? '🚫 Not Recommended' : `${recommendation.icon} Place Bet - €${recommendedBet.toFixed(2)}`}
      </button>
    </div>
  );
};

export default BettingCard;
