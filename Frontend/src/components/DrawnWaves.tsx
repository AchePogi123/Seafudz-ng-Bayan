import React from 'react'

interface DrawnWavesProps {
  className?: string
}

/**
 * Three minimal, long-wavelength sinusoidal swells.
 * Each path has an exact 800-unit period (repeated across 0..1600) with horizontal
 * tangents at every peak and trough so the -50% horizontal loop is seamless.
 */
const FAR_WAVE_CREST =
  'M 0,38 C 75,38 125,64 200,64 C 275,64 325,38 400,38 C 475,38 525,64 600,64 C 675,64 725,38 800,38 C 875,38 925,64 1000,64 C 1075,64 1125,38 1200,38 C 1275,38 1325,64 1400,64 C 1475,64 1525,38 1600,38'
const FAR_WAVE_BODY = `${FAR_WAVE_CREST} L 1600,120 L 0,120 Z`

const MID_WAVE_CREST =
  'M 0,72 C 75,72 125,44 200,44 C 275,44 325,72 400,72 C 475,72 525,44 600,44 C 675,44 725,72 800,72 C 875,72 925,44 1000,44 C 1075,44 1125,72 1200,72 C 1275,72 1325,44 1400,44 C 1475,44 1525,72 1600,72'
const MID_WAVE_BODY = `${MID_WAVE_CREST} L 1600,120 L 0,120 Z`

const NEAR_WAVE_CREST =
  'M 0,66 C 75,66 125,94 200,94 C 275,94 325,66 400,66 C 475,66 525,94 600,94 C 675,94 725,66 800,66 C 875,66 925,94 1000,94 C 1075,94 1125,66 1200,66 C 1275,66 1325,94 1400,94 C 1475,94 1525,66 1600,66'
const NEAR_WAVE_BODY = `${NEAR_WAVE_CREST} L 1600,120 L 0,120 Z`

export const DrawnWaves: React.FC<DrawnWavesProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none select-none overflow-hidden ${className}`}>
      {/* Layer 1: Gentle distant horizon swell (behind the boat hull) */}
      <div className="drawn-waves-track absolute inset-0 z-[4] h-full w-[200%] animate-drawn-waves-far">
        <svg
          className="drawn-waves-swell-far h-full w-full"
          viewBox="0 0 1600 120"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d={FAR_WAVE_BODY} fill="currentColor" fillOpacity="0.11" />
          <path
            d={FAR_WAVE_CREST}
            stroke="currentColor"
            strokeOpacity="0.34"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Layer 2: Smooth midground counter-swell (at the boat's waterline) */}
      <div className="drawn-waves-track absolute inset-0 z-[6] h-full w-[200%] animate-drawn-waves-mid">
        <svg
          className="drawn-waves-swell-mid h-full w-full"
          viewBox="0 0 1600 120"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d={MID_WAVE_BODY} fill="currentColor" fillOpacity="0.17" />
          <path
            d={MID_WAVE_CREST}
            stroke="currentColor"
            strokeOpacity="0.54"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Layer 3: Crisp foreground coastal wave (laps in front of the boat's lower hull) */}
      <div className="drawn-waves-track absolute inset-0 z-[12] h-full w-[200%] animate-drawn-waves-near">
        <svg
          className="drawn-waves-swell-near h-full w-full"
          viewBox="0 0 1600 120"
          preserveAspectRatio="none"
          fill="none"
        >
          <path d={NEAR_WAVE_BODY} fill="currentColor" fillOpacity="0.25" />
          <path
            d={NEAR_WAVE_CREST}
            stroke="currentColor"
            strokeOpacity="0.86"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  )
}

export default DrawnWaves
