import React from "react";
import {
  KundaliData,
  PLANETS,
  calculateHouseSigns,
  getSignNumberByCode,
} from "../../lib/astrology";
import "./Kundali.css";

interface KundaliProps {
  data: KundaliData;
  className?: string;
}

const Kundali: React.FC<KundaliProps> = ({ data, className = "" }) => {
  // Find Ascendant sign number
  const ascendantPos = data.planetary_positions.find(
    (p) => p.name === "Ascendant"
  );
  const ascendantSignNum = ascendantPos
    ? getSignNumberByCode(ascendantPos.sign)
    : 1;

  // Map planets to houses
  const housePlanets: Record<number, any[]> = {};
  for (let i = 1; i <= 12; i++) housePlanets[i] = [];

  data.planetary_positions.forEach((p) => {
    // Exclude Ascendant and True Nodes (avoid duplicates)
    // Western planets (Uranus, Neptune, Pluto) are now included by default
    if (p.name === "Ascendant") return;
    if (p.name === "True_Node" || p.name === "True_South_Node") return;
    housePlanets[p.house]?.push(p);
  });

  // Calculate Rashi numbers for each house
  // In North Indian style, the top diamond (House 1) displays the sign number of the Ascendant.
  // The signs then increment counter-clockwise.
  // Wait, the API might give house 1, 2, 3... already mapped.
  // But usually, we just take the Ascendant sign and increment.
  // Let's use the API's house mapping directly first.

  const houseSigns = calculateHouseSigns(ascendantSignNum);

  // SVG Coordinates (800x800) for North Indian Kundali
  // Houses progress ANTI-CLOCKWISE from H1 (top diamond)
  // Reference: H1=top, H2=top-left, H3=left-upper, H4=left-center,
  //   H5=left-lower, H6=bottom-left, H7=bottom, H8=bottom-right,
  //   H9=right-lower, H10=right-center, H11=right-upper, H12=top-right
  const centers = [
    { x: 400, y: 150 }, // H1  - top center diamond (Lagna)
    { x: 200, y: 100 }, // H2  - top-left corner triangle
    { x: 100, y: 200 }, // H3  - left side, upper triangle
    { x: 200, y: 400 }, // H4  - left center diamond
    { x: 100, y: 600 }, // H5  - left side, lower triangle
    { x: 200, y: 700 }, // H6  - bottom-left corner triangle
    { x: 400, y: 650 }, // H7  - bottom center diamond
    { x: 600, y: 700 }, // H8  - bottom-right corner triangle
    { x: 700, y: 600 }, // H9  - right side, lower triangle
    { x: 600, y: 400 }, // H10 - right center diamond
    { x: 700, y: 200 }, // H11 - right side, upper triangle
    { x: 600, y: 100 }, // H12 - top-right corner triangle
  ];

  // Rashi/Sign Number Positions (placed in corners of each house region)
  const rashiPositions = [
    { x: 400, y: 50 }, // H1  - top of top diamond
    { x: 200, y: 50 }, // H2  - top-left corner
    { x: 50, y: 200 }, // H3  - left edge, upper
    { x: 160, y: 400 }, // H4  - inside left diamond
    { x: 50, y: 600 }, // H5  - left edge, lower
    { x: 200, y: 750 }, // H6  - bottom-left corner
    { x: 400, y: 750 }, // H7  - bottom of bottom diamond
    { x: 600, y: 750 }, // H8  - bottom-right corner
    { x: 750, y: 600 }, // H9  - right edge, lower
    { x: 640, y: 400 }, // H10 - inside right diamond
    { x: 750, y: 200 }, // H11 - right edge, upper
    { x: 600, y: 50 }, // H12 - top-right corner
  ];

  return (
    <div className={`kundali-container ${className}`}>
      <svg viewBox="0 0 800 800" className="kundali-svg">
        {/* Definitions for gradients/glows */}
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#B8860B" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Square */}
        <rect x="0" y="0" width="800" height="800" className="chart-line" />

        {/* Diagonals */}
        <line x1="0" y1="0" x2="800" y2="800" className="chart-line" />
        <line x1="800" y1="0" x2="0" y2="800" className="chart-line" />

        {/* Inner Diamond */}
        <path
          d="M 400 0 L 0 400 L 400 800 L 800 400 Z"
          className="chart-line"
        />

        {/* Houses Content */}
        {centers.map((center, i) => {
          const houseNum = i + 1;
          const rashiNum = houseSigns[i];
          const planets = housePlanets[houseNum] || [];

          return (
            <g key={houseNum} className="house-group">
              {/* Rashi Number */}
              <text
                x={rashiPositions[i].x}
                y={rashiPositions[i].y}
                className="rashi-text text-gold/60"
                textAnchor="middle"
              >
                {rashiNum}
              </text>

              {/* Planets */}
              <g transform={`translate(${center.x}, ${center.y})`}>
                {planets.map((p, pIdx) => {
                  const planetInfo = (PLANETS as any)[p.name];
                  const yOffset = (pIdx - (planets.length - 1) / 2) * 30;
                  return (
                    <text
                      key={p.name}
                      y={yOffset}
                      className="planet-text"
                      style={{ fill: planetInfo?.color || "#fff" }}
                      textAnchor="middle"
                    >
                      {planetInfo?.symbol || p.name.substring(0, 2)}
                      <tspan className="degree-text" dx="2" dy="-5">
                        {Math.floor(p.degree)}°
                      </tspan>
                      {p.is_retrograde && (
                        <tspan className="retro-text" dx="2" dy="5">
                          (R)
                        </tspan>
                      )}
                    </text>
                  );
                })}
              </g>
            </g>
          );
        })}

        {/* Central Overlay? No, keep it clean */}
      </svg>

      {/* Legend/Info - Removed Nakshatra/Sidereal labels as requested */}
    </div>
  );
};

export default Kundali;
