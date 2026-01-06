import React from 'react';
import BettingCard from './BettingCard';

/**
 * Demo page showing three different betting scenarios:
 * 1. Your current bet - Low confidence/probability despite good ROI
 * 2. A strong bet example
 * 3. A moderate bet example
 */
const BettingCardDemo = () => {
  return (
    <div style={{ 
      padding: '2rem', 
      background: '#f3f4f6',
      minHeight: '100vh'
    }}>
      <h1 style={{ 
        textAlign: 'center', 
        marginBottom: '2rem',
        color: '#1f2937'
      }}>
        Unified Betting Decision Interface
      </h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '2rem',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        
        {/* YOUR CURRENT BET - Shows as SKIP due to low confidence */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Your Current Bet (Example from Image)
          </h3>
          <BettingCard 
            horseName="First Greyed"
            location="Wolverhampton"
            raceTime="16:45 (Dublin)"
            roi={24.8}
            confidenceRating={34.8}  // LOW - this kills the bet
            winProbability={32}       // LOW - weak probability
            placeProbability={68}
            odds="3/1"
            recommendedBet={30.00}
            potentialWin={87.00}
            expectedValue={7.44}
            formAnalysis="Most reliable pick with winning form already proven at the venue. Market shows the confidence despite shorter odds. 16-day gap ideal for maintaining fitness without staleness."
          />
          <p style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#fee2e2', 
            borderRadius: '8px',
            color: '#991b1b',
            fontSize: '0.875rem'
          }}>
            <strong>Why SKIP?</strong> Even though ROI looks good (24.8%), the LOW confidence rating (34.8/100) 
            and weak win probability (32%) indicate this is a high-risk bet. The system correctly recommends 
            skipping this one.
          </p>
        </div>

        {/* STRONG BET EXAMPLE */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Strong Bet Example
          </h3>
          <BettingCard 
            horseName="Thunder Strike"
            location="Ascot"
            raceTime="14:30 (Local)"
            roi={28.5}
            confidenceRating={72.3}   // HIGH confidence
            winProbability={55}       // HIGH probability
            placeProbability={82}
            odds="2/1"
            recommendedBet={50.00}
            potentialWin={125.00}
            expectedValue={18.50}
            formAnalysis="Dominant winner in last 3 races. Favorable track conditions. Jockey has 85% win rate on this horse. Fresh from 14-day rest."
          />
          <p style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#d1fae5', 
            borderRadius: '8px',
            color: '#065f46',
            fontSize: '0.875rem'
          }}>
            <strong>Why STRONG BET?</strong> High confidence (72.3/100), strong win probability (55%), 
            and solid ROI (28.5%) all align. This is a well-supported betting opportunity.
          </p>
        </div>

        {/* MODERATE BET EXAMPLE */}
        <div>
          <h3 style={{ marginBottom: '1rem', color: '#6b7280' }}>
            Moderate Bet Example
          </h3>
          <BettingCard 
            horseName="Lucky Seven"
            location="Cheltenham"
            raceTime="15:15 (Local)"
            roi={22.0}
            confidenceRating={48.5}   // MODERATE confidence
            winProbability={38}       // MODERATE probability
            placeProbability={65}
            odds="5/2"
            recommendedBet={25.00}
            potentialWin={62.50}
            expectedValue={6.25}
            formAnalysis="Mixed recent form but excellent course record. Weather conditions favor this runner. Some concerns about field strength."
          />
          <p style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            background: '#fef3c7', 
            borderRadius: '8px',
            color: '#92400e',
            fontSize: '0.875rem'
          }}>
            <strong>Why CONSIDER?</strong> Metrics are mixed - decent probability and reasonable ROI, 
            but confidence is borderline. Proceed with caution and smaller stake if betting.
          </p>
        </div>

      </div>

      {/* Explanation Section */}
      <div style={{
        maxWidth: '1400px',
        margin: '3rem auto',
        padding: '2rem',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ color: '#1f2937', marginBottom: '1rem' }}>
          🎯 How the Unified Decision System Works
        </h2>
        
        <div style={{ lineHeight: '1.8', color: '#374151' }}>
          <h3 style={{ color: '#6b7280', fontSize: '1.125rem', marginTop: '1.5rem' }}>
            Bet Quality Score Calculation
          </h3>
          <p>
            The system combines all three metrics with weighted importance:
          </p>
          <ul>
            <li><strong>Win Probability (40% weight)</strong> - Most important for decision-making</li>
            <li><strong>ROI Potential (30% weight)</strong> - Value assessment</li>
            <li><strong>Confidence Rating (30% weight)</strong> - Model certainty</li>
          </ul>

          <h3 style={{ color: '#6b7280', fontSize: '1.125rem', marginTop: '1.5rem' }}>
            Decision Logic
          </h3>
          <ul>
            <li><strong style={{ color: '#10b981' }}>✅ STRONG BET:</strong> Win prob ≥40% AND confidence ≥50%, OR exceptional ROI (≥30%) with decent confidence (≥45%)</li>
            <li><strong style={{ color: '#f59e0b' }}>⚠️ CONSIDER:</strong> Overall score ≥35 and win probability ≥30% - proceed with caution</li>
            <li><strong style={{ color: '#ef4444' }}>❌ SKIP:</strong> Low confidence or poor probability - avoid regardless of ROI</li>
          </ul>

          <h3 style={{ color: '#6b7280', fontSize: '1.125rem', marginTop: '1.5rem' }}>
            Key Benefits
          </h3>
          <ul>
            <li>✓ <strong>Single glance decision</strong> - Color + recommendation instantly visible</li>
            <li>✓ <strong>No mental math</strong> - System weighs conflicting signals automatically</li>
            <li>✓ <strong>Prevents bad bets</strong> - High ROI alone doesn't trigger a bet if confidence/probability are weak</li>
            <li>✓ <strong>Star ratings</strong> - Quick visual assessment of each metric</li>
            <li>✓ <strong>Contextual reasoning</strong> - Explains WHY the recommendation was made</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default BettingCardDemo;
