import React from 'react';
import { NeoEmotionState } from '../../types';

interface NeoCharacterProps {
  state?: NeoEmotionState;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
  onClick?: () => void;
  interactive?: boolean;
  showStars?: boolean;
}

export const NeoCharacter: React.FC<NeoCharacterProps> = ({
  state = 'neo-idle',
  size = 'md',
  className = '',
  onClick,
  interactive = false,
  showStars = true,
}) => {
  // Dimensions
  const pixelSize =
    typeof size === 'number'
      ? size
      : size === 'sm'
      ? 44
      : size === 'md'
      ? 72
      : size === 'lg'
      ? 110
      : 150;

  // Root animation class based on state
  let motionClass = 'neo-floating';
  if (state === 'neo-celebrating') motionClass = 'neo-celebrating-anim';
  if (state === 'neo-thinking') motionClass = 'neo-thinking-anim';
  if (state === 'neo-happy') motionClass = 'neo-celebrating-anim';

  return (
    <div
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={`relative inline-flex items-center justify-center select-none ${
        interactive ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform duration-200' : ''
      } ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
      title={interactive ? 'Parler avec Néo (ton assistant CM2)' : undefined}
    >
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`w-full h-full overflow-visible ${motionClass}`}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="neoHelmet" x1="20" y1="20" x2="180" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.65" stopColor="#F8FAFC" />
            <stop offset="1" stopColor="#E2E8F0" />
          </linearGradient>

          <linearGradient id="neoVisor" x1="45" y1="55" x2="155" y2="125" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0369A1" />
            <stop offset="0.5" stopColor="#0284C7" />
            <stop offset="1" stopColor="#075985" />
          </linearGradient>

          <linearGradient id="neoGold" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#FDE047" />
            <stop offset="0.5" stopColor="#FACC15" />
            <stop offset="1" stopColor="#EAB308" />
          </linearGradient>

          <linearGradient id="neoCyanGlow" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#E0F2FE" />
            <stop offset="0.6" stopColor="#38BDF8" />
            <stop offset="1" stopColor="#0284C7" />
          </linearGradient>

          {/* Visor Glare Glass Reflection */}
          <linearGradient id="neoGlassGloss" x1="40" y1="50" x2="160" y2="110" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="0.4" stopColor="#FFFFFF" stopOpacity="0.1" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Drop Shadows */}
          <filter id="neoShadow" x="-10%" y="-10%" width="125%" height="125%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0F172A" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Celebrating Floating Stars */}
        {showStars && (state === 'neo-celebrating' || state === 'neo-happy') && (
          <g className="neo-star-spin" style={{ transformOrigin: '100px 50px' }}>
            <path
              d="M 25 35 L 28 42 L 35 44 L 29 49 L 31 56 L 25 51 L 19 56 L 21 49 L 15 44 L 22 42 Z"
              fill="#FBBF24"
              stroke="#F59E0B"
              strokeWidth="1"
            />
            <path
              d="M 175 35 L 178 42 L 185 44 L 179 49 L 181 56 L 175 51 L 169 56 L 171 49 L 165 44 L 172 42 Z"
              fill="#FBBF24"
              stroke="#F59E0B"
              strokeWidth="1"
            />
            <circle cx="98" cy="18" r="3" fill="#FDE047" />
          </g>
        )}

        {/* 1. ANTENNA */}
        <g id="neo-antenna">
          {/* Stem */}
          <path
            d="M 100 48 L 100 24"
            stroke="#94A3B8"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Antenna Glow Halo */}
          <circle
            cx="100"
            cy="18"
            r={state === 'neo-thinking' ? '14' : '10'}
            fill="#FEF08A"
            opacity={state === 'neo-thinking' ? '0.75' : '0.4'}
            className={state === 'neo-thinking' ? 'neo-glow' : undefined}
          />
          {/* Antenna Golden Orb */}
          <circle
            cx="100"
            cy="18"
            r="8"
            fill="url(#neoGold)"
            stroke="#CA8A04"
            strokeWidth="1.5"
          />
          {/* Shine dot */}
          <circle cx="97.5" cy="15.5" r="2.2" fill="#FFFFFF" opacity="0.9" />
        </g>

        {/* 2. BODY / TORSO */}
        <g id="neo-body" filter="url(#neoShadow)">
          {/* Neck / base connector */}
          <rect x="88" y="125" width="24" height="12" rx="4" fill="#CBD5E1" />

          {/* Main Chassis */}
          <rect
            x="64"
            y="132"
            width="72"
            height="46"
            rx="18"
            fill="url(#neoHelmet)"
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* Chest Center Blue Plate */}
          <rect
            x="76"
            y="140"
            width="48"
            height="30"
            rx="10"
            fill="#0284C7"
            stroke="#0369A1"
            strokeWidth="1.5"
          />

          {/* Glowing CM2 Yellow Core */}
          <circle
            cx="100"
            cy="155"
            r="8"
            fill="url(#neoGold)"
            stroke="#EAB308"
            strokeWidth="1.5"
            className="neo-glow"
          />
          {/* Core Star / Icon */}
          <path
            d="M 100 150.5 L 101.5 153.8 L 105 154.2 L 102.3 156.5 L 103 160 L 100 158.2 L 97 160 L 97.7 156.5 L 95 154.2 L 98.5 153.8 Z"
            fill="#FFFFFF"
          />
        </g>

        {/* 3. HEAD & EARS */}
        <g id="neo-head" filter="url(#neoShadow)">
          {/* Left Ear / Headphone pod */}
          <circle cx="40" cy="85" r="14" fill="url(#neoGold)" stroke="#CA8A04" strokeWidth="2" />
          <circle cx="40" cy="85" r="7" fill="#0284C7" />
          <circle cx="40" cy="85" r="3" fill="#38BDF8" />

          {/* Right Ear / Headphone pod */}
          <circle cx="160" cy="85" r="14" fill="url(#neoGold)" stroke="#CA8A04" strokeWidth="2" />
          <circle cx="160" cy="85" r="7" fill="#0284C7" />
          <circle cx="160" cy="85" r="3" fill="#38BDF8" />

          {/* Main White Helmet */}
          <rect
            x="44"
            y="44"
            width="112"
            height="86"
            rx="34"
            fill="url(#neoHelmet)"
            stroke="#CBD5E1"
            strokeWidth="2"
          />

          {/* Helmet Top Gloss Highlight */}
          <path
            d="M 64 50 Q 100 46 136 50 Q 100 54 64 50 Z"
            fill="#FFFFFF"
            opacity="0.8"
          />

          {/* Dark Cyan/Blue Visor Faceplate */}
          <rect
            x="54"
            y="55"
            width="92"
            height="64"
            rx="24"
            fill="url(#neoVisor)"
            stroke="#0369A1"
            strokeWidth="2"
          />

          {/* Visor Glass Gloss Highlight */}
          <path
            d="M 58 65 Q 100 57 142 65 Q 140 75 125 78 Q 75 74 58 65 Z"
            fill="url(#neoGlassGloss)"
          />

          {/* Soft Pink Cheek Blushes */}
          <ellipse cx="68" cy="98" rx="5" ry="3" fill="#F472B6" opacity="0.65" />
          <ellipse cx="132" cy="98" rx="5" ry="3" fill="#F472B6" opacity="0.65" />
        </g>

        {/* 4. EXPRESSIVE EYES (Dynamic based on state) */}
        <g id="neo-eyes">
          {/* HAPPY / CELEBRATING: Smiling upward arcs (⌒ ⌒) */}
          {(state === 'neo-happy' || state === 'neo-celebrating') && (
            <g>
              {/* Left Eye */}
              <path
                d="M 70 88 Q 80 72 90 88"
                stroke="#38BDF8"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                className="neo-glow"
              />
              <path
                d="M 72 87 Q 80 74 88 87"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />

              {/* Right Eye */}
              <path
                d="M 110 88 Q 120 72 130 88"
                stroke="#38BDF8"
                strokeWidth="5"
                strokeLinecap="round"
                fill="none"
                className="neo-glow"
              />
              <path
                d="M 112 87 Q 120 74 128 87"
                stroke="#FFFFFF"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          )}

          {/* THINKING: Right eye tilted up, left eye slightly squinting, pupils looking up */}
          {state === 'neo-thinking' && (
            <g>
              {/* Left Eye - slightly squinted */}
              <ellipse cx="78" cy="85" rx="9" ry="11" fill="#0369A1" stroke="#38BDF8" strokeWidth="2.5" />
              <circle cx="80" cy="81" r="5" fill="#38BDF8" />
              <circle cx="82" cy="79" r="2" fill="#FFFFFF" />

              {/* Eyebrow thinking */}
              <path d="M 70 71 Q 78 69 86 73" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" fill="none" />

              {/* Right Eye - arched up looking towards antenna */}
              <ellipse cx="122" cy="82" rx="10" ry="12" fill="#0369A1" stroke="#38BDF8" strokeWidth="2.5" />
              <circle cx="124" cy="78" r="5.5" fill="#38BDF8" />
              <circle cx="126" cy="76" r="2.2" fill="#FFFFFF" />

              {/* Right Eyebrow raised high */}
              <path d="M 113 67 Q 123 63 131 69" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" fill="none" />
            </g>
          )}

          {/* SURPRISED: Huge wide open eyes (O_O) */}
          {state === 'neo-surprised' && (
            <g>
              <ellipse cx="78" cy="84" rx="12" ry="14" fill="#0284C7" stroke="#38BDF8" strokeWidth="3" />
              <circle cx="78" cy="84" r="7" fill="#E0F2FE" />
              <circle cx="81" cy="81" r="2.5" fill="#FFFFFF" />

              <ellipse cx="122" cy="84" rx="12" ry="14" fill="#0284C7" stroke="#38BDF8" strokeWidth="3" />
              <circle cx="122" cy="84" r="7" fill="#E0F2FE" />
              <circle cx="125" cy="81" r="2.5" fill="#FFFFFF" />
            </g>
          )}

          {/* ENCOURAGING / TALKING: Warm eyes with gentle friendly wink or luminous cyan glow */}
          {(state === 'neo-encouraging' || state === 'neo-talking') && (
            <g>
              {/* Left Eye: Big warm oval */}
              <ellipse cx="78" cy="84" rx="10" ry="12" fill="#0284C7" stroke="#38BDF8" strokeWidth="2.5" />
              <circle cx="78" cy="83" r="5.5" fill="#E0F2FE" />
              <circle cx="81" cy="80" r="2.2" fill="#FFFFFF" />

              {/* Right Eye: Kind wink or matching warm eye */}
              {state === 'neo-encouraging' ? (
                // Playful encouraging wink (^_~)
                <g>
                  <path
                    d="M 112 85 Q 121 75 130 85"
                    stroke="#38BDF8"
                    strokeWidth="4"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 114 85 Q 121 77 128 85"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                  />
                </g>
              ) : (
                <g>
                  <ellipse cx="122" cy="84" rx="10" ry="12" fill="#0284C7" stroke="#38BDF8" strokeWidth="2.5" />
                  <circle cx="122" cy="83" r="5.5" fill="#E0F2FE" />
                  <circle cx="125" cy="80" r="2.2" fill="#FFFFFF" />
                </g>
              )}
            </g>
          )}

          {/* SAD: Gentle empathetic droop (not scary, comforting) */}
          {state === 'neo-sad' && (
            <g>
              {/* Left Eye slightly lowered */}
              <ellipse cx="78" cy="87" rx="9" ry="10" fill="#0369A1" stroke="#38BDF8" strokeWidth="2" />
              <circle cx="78" cy="88" r="4.5" fill="#38BDF8" />
              <circle cx="80" cy="86" r="1.8" fill="#FFFFFF" />
              <path d="M 70 78 Q 78 82 86 79" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" fill="none" />

              {/* Right Eye */}
              <ellipse cx="122" cy="87" rx="9" ry="10" fill="#0369A1" stroke="#38BDF8" strokeWidth="2" />
              <circle cx="122" cy="88" r="4.5" fill="#38BDF8" />
              <circle cx="124" cy="86" r="1.8" fill="#FFFFFF" />
              <path d="M 114 79 Q 122 82 130 78" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" fill="none" />
            </g>
          )}

          {/* IDLE: Standard friendly oval eyes with gentle CSS blink */}
          {state === 'neo-idle' && (
            <g className="neo-blink-anim" style={{ transformOrigin: '100px 84px' }}>
              {/* Left Eye */}
              <ellipse cx="78" cy="84" rx="10" ry="13" fill="#0284C7" stroke="#38BDF8" strokeWidth="2.5" />
              <circle cx="78" cy="83" r="6" fill="#E0F2FE" />
              <circle cx="81" cy="80" r="2.5" fill="#FFFFFF" />

              {/* Right Eye */}
              <ellipse cx="122" cy="84" rx="10" ry="13" fill="#0284C7" stroke="#38BDF8" strokeWidth="2.5" />
              <circle cx="122" cy="83" r="6" fill="#E0F2FE" />
              <circle cx="125" cy="80" r="2.5" fill="#FFFFFF" />
            </g>
          )}
        </g>

        {/* 5. EXPRESSIVE MOUTH */}
        <g id="neo-mouth">
          {/* CELEBRATING: Big happy open smile with digital glow */}
          {state === 'neo-celebrating' && (
            <path
              d="M 90 98 Q 100 112 110 98 Z"
              fill="#FACC15"
              stroke="#EAB308"
              strokeWidth="2"
            />
          )}

          {/* HAPPY: Warm bright smile curve */}
          {state === 'neo-happy' && (
            <path
              d="M 90 100 Q 100 110 110 100"
              stroke="#FACC15"
              strokeWidth="3.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* TALKING: Dynamic friendly speech wave */}
          {state === 'neo-talking' && (
            <path
              d="M 91 101 Q 100 108 109 101 Q 100 105 91 101"
              fill="#FACC15"
              stroke="#EAB308"
              strokeWidth="2"
              className="neo-speech-bounce"
            />
          )}

          {/* THINKING: Small thoughtful line/curve */}
          {state === 'neo-thinking' && (
            <path
              d="M 95 102 Q 102 103 107 100"
              stroke="#FACC15"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* SURPRISED: Cute open 'o' */}
          {state === 'neo-surprised' && (
            <circle
              cx="100"
              cy="102"
              r="4.5"
              fill="#FACC15"
              stroke="#EAB308"
              strokeWidth="1.5"
            />
          )}

          {/* SAD: Gentle sympathetic line */}
          {state === 'neo-sad' && (
            <path
              d="M 93 103 Q 100 99 107 103"
              stroke="#94A3B8"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {/* ENCOURAGING or IDLE: Sweet friendly smile */}
          {(state === 'neo-encouraging' || state === 'neo-idle') && (
            <path
              d="M 91 100 Q 100 108 109 100"
              stroke="#FACC15"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>

        {/* 6. MAGNETIC FLOATING HANDS */}
        <g id="neo-hands" filter="url(#neoShadow)">
          {/* CELEBRATING: Both hands raised high in victory 🙌 */}
          {state === 'neo-celebrating' && (
            <g>
              {/* Left hand high up */}
              <circle cx="34" cy="50" r="5" fill="#FACC15" />
              <ellipse cx="30" cy="42" rx="10" ry="12" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />

              {/* Right hand high up */}
              <circle cx="166" cy="50" r="5" fill="#FACC15" />
              <ellipse cx="170" cy="42" rx="10" ry="12" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />
            </g>
          )}

          {/* HAPPY: Thumbs up gesture on right hand 👍 */}
          {state === 'neo-happy' && (
            <g>
              {/* Left hand relaxed */}
              <circle cx="44" cy="142" r="5" fill="#FACC15" />
              <ellipse cx="38" cy="145" rx="9" ry="11" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />

              {/* Right hand thumbs up */}
              <circle cx="156" cy="138" r="5" fill="#FACC15" />
              <g transform="translate(155, 122)">
                <ellipse cx="6" cy="12" rx="8" ry="10" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />
                {/* Thumb pointing up */}
                <path d="M 6 5 L 6 -4 Q 6 -7 9 -7 Q 12 -7 12 -4 L 12 7" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />
                <circle cx="9" cy="-4" r="3" fill="#FACC15" />
              </g>
            </g>
          )}

          {/* THINKING: Right hand touching chin 🤔 */}
          {state === 'neo-thinking' && (
            <g>
              {/* Left hand supporting */}
              <circle cx="48" cy="150" r="5" fill="#FACC15" />
              <ellipse cx="44" cy="154" rx="9" ry="10" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />

              {/* Right hand touching visor/chin */}
              <circle cx="132" cy="138" r="5" fill="#FACC15" />
              <ellipse cx="120" cy="115" rx="10" ry="10" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />
              <circle cx="120" cy="115" r="4" fill="#FACC15" opacity="0.6" />
            </g>
          )}

          {/* ENCOURAGING / TALKING: Open welcoming hand */}
          {(state === 'neo-encouraging' || state === 'neo-talking') && (
            <g>
              {/* Left hand gentle */}
              <circle cx="44" cy="142" r="5" fill="#FACC15" />
              <ellipse cx="38" cy="144" rx="9" ry="10" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />

              {/* Right hand gesturing forward */}
              <circle cx="156" cy="136" r="5" fill="#FACC15" />
              <ellipse cx="164" cy="132" rx="11" ry="10" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />
              <circle cx="164" cy="132" r="4" fill="#FACC15" opacity="0.8" />
            </g>
          )}

          {/* IDLE / SURPRISED / SAD: Gentle relaxed floating hands */}
          {(state === 'neo-idle' || state === 'neo-surprised' || state === 'neo-sad') && (
            <g>
              {/* Left hand */}
              <circle cx="44" cy="144" r="5" fill="#FACC15" />
              <ellipse cx="38" cy="147" rx="9" ry="11" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />

              {/* Right hand */}
              <circle cx="156" cy="144" r="5" fill="#FACC15" />
              <ellipse cx="162" cy="147" rx="9" ry="11" fill="url(#neoHelmet)" stroke="#CBD5E1" strokeWidth="2" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
