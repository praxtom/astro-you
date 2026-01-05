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

  const moonPos = data.planetary_positions.find((p) => p.name === "Moon");
  const moonNakshatra = moonPos?.nakshatra ? moonPos.nakshatra : "CHITRA";

  // Map planets to houses
  const housePlanets: Record<number, any[]> = {};
  for (let i = 1; i <= 12; i++) housePlanets[i] = [];

  data.planetary_positions.forEach((p) => {
    if (p.name !== "Ascendant") {
      housePlanets[p.house]?.push(p);
    }
  });

  // Calculate Rashi numbers for each house
  // In North Indian style, the top diamond (House 1) displays the sign number of the Ascendant.
  // The signs then increment counter-clockwise.
  // Wait, the API might give house 1, 2, 3... already mapped.
  // But usually, we just take the Ascendant sign and increment.
  // Let's use the API's house mapping directly first.

  const houseSigns = calculateHouseSigns(ascendantSignNum);

  // SVG Coordinates (800x800)
  const centers = [
    { x: 400, y: 200 }, // H1
    { x: 200, y: 100 }, // H2
    { x: 100, y: 200 }, // H3
    { x: 200, y: 400 }, // H4
    { x: 100, y: 600 }, // H5
    { x: 200, y: 700 }, // H6
    { x: 400, y: 600 }, // H7
    { x: 600, y: 700 }, // H8
    { x: 700, y: 600 }, // H9
    { x: 600, y: 400 }, // H10
    { x: 700, y: 200 }, // H11
    { x: 600, y: 100 }, // H12
  ];

  // Rashi Number Positions (Offset from center or specific corners)
  const rashiPositions = [
    { x: 400, y: 50 }, // H1
    { x: 50, y: 50 }, // H2
    { x: 50, y: 150 }, // H3
    { x: 350, y: 400 }, // H4
    { x: 50, y: 650 }, // H5
    { x: 50, y: 750 }, // H6
    { x: 400, y: 750 }, // H7
    { x: 750, y: 750 }, // H8
    { x: 750, y: 650 }, // H9
    { x: 450, y: 400 }, // H10
    { x: 750, y: 150 }, // H11
    { x: 750, y: 50 }, // H12
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

      {/* Legend/Info */}
      <div className="kundali-footer mt-6 flex justify-between items-end opacity-40 uppercase tracking-widest text-xs">
        <div>NAKSHATRA: {moonNakshatra}</div>
        <div>SIDEREAL / WHOLE SIGN</div>
      </div>
    </div>
  );
};

export default Kundali;
