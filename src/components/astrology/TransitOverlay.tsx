import {
  PLANETS,
  calculateHouseSigns,
  getSignNumberByCode,
} from "../../lib/astrology";
import "./Kundali.css";

interface TransitOverlayProps {
  data: any; // Raw API response from getTransitChart
  className?: string;
}

const TransitOverlay: React.FC<TransitOverlayProps> = ({
  data,
  className = "",
}) => {
  if (!data) return null;

  // Handle both direct and nested data structures
  const chartData = data.chart_data || data;
  const subjectData = data.subject_data || data.positions?.subject_data;
  const positions = chartData.planetary_positions || chartData.positions || [];

  // Helper to map "Tenth_House" -> 10, etc.
  const houseNameToNum = (name: string): number => {
    if (!name) return 0;
    const map: Record<string, number> = {
      First_House: 1,
      Second_House: 2,
      Third_House: 3,
      Fourth_House: 4,
      Fifth_House: 5,
      Sixth_House: 6,
      Seventh_House: 7,
      Eighth_House: 8,
      Ninth_House: 9,
      Tenth_House: 10,
      Eleventh_House: 11,
      Twelfth_House: 12,
    };
    return map[name] || 0;
  };

  const getPlanetsFromSubject = (subject: any, suffix: string) => {
    if (!subject) return [];
    const planets = [
      ...(subject.planets_names_list || []),
      ...(subject.axial_cusps_names_list || []),
    ];
    return planets
      .map((name) => {
        const p = subject[name.toLowerCase()];
        if (!p) return null;
        return {
          ...p,
          name: `${p.name}_${suffix}`,
          house: houseNameToNum(p.house) || p.house,
        };
      })
      .filter((p) => p !== null && p.house);
  };

  if (positions.length === 0 && !subjectData) return null;

  const natalPositions = subjectData?.natal_subject
    ? getPlanetsFromSubject(subjectData.natal_subject, "natal")
    : positions.filter(
        (p: any) =>
          p.name.toLowerCase().includes("_natal") ||
          !p.name.toLowerCase().includes("_transit")
      );

  const transitPositions = subjectData?.transit_subject
    ? getPlanetsFromSubject(subjectData.transit_subject, "transit")
    : positions.filter((p: any) => p.name.toLowerCase().includes("_transit"));

  // Find Natal Ascendant sign number for the grid
  const natalAscendant =
    subjectData?.natal_subject?.ascendant ||
    positions.find(
      (p: any) => p.name === "Ascendant" || p.name === "Ascendant_natal"
    ) ||
    natalPositions[0];

  const ascendantSignNum = getSignNumberByCode(natalAscendant?.sign);
  const houseSigns = calculateHouseSigns(ascendantSignNum);

  // Center points for houses (copied from Kundali.tsx)
  const centers = [
    { x: 400, y: 150 }, // H1
    { x: 200, y: 100 }, // H2
    { x: 100, y: 200 }, // H3
    { x: 200, y: 400 }, // H4
    { x: 100, y: 600 }, // H5
    { x: 200, y: 700 }, // H6
    { x: 400, y: 650 }, // H7
    { x: 600, y: 700 }, // H8
    { x: 700, y: 600 }, // H9
    { x: 600, y: 400 }, // H10
    { x: 700, y: 200 }, // H11
    { x: 600, y: 100 }, // H12
  ];

  // Map both sets of planets to houses
  const natalHouseMap: Record<number, any[]> = {};
  const transitHouseMap: Record<number, any[]> = {};
  for (let i = 1; i <= 12; i++) {
    natalHouseMap[i] = [];
    transitHouseMap[i] = [];
  }

  natalPositions.forEach((p: any) => {
    if (p.name.includes("Ascendant")) return;
    natalHouseMap[p.house]?.push(p);
  });

  transitPositions.forEach((p: any) => {
    transitHouseMap[p.house]?.push(p);
  });

  return (
    <div className={`kundali-container transit-overlay ${className}`}>
      <svg viewBox="0 0 800 800" className="kundali-svg">
        <defs>
          <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#B8860B" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0.8" />
          </linearGradient>
          <filter id="transitGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Chart Grid */}
        <rect
          x="0"
          y="0"
          width="800"
          height="800"
          className="chart-line opacity-20"
        />
        <line
          x1="0"
          y1="0"
          x2="800"
          y2="800"
          className="chart-line opacity-20"
        />
        <line
          x1="800"
          y1="0"
          x2="0"
          y2="800"
          className="chart-line opacity-20"
        />
        <path
          d="M 400 0 L 0 400 L 400 800 L 800 400 Z"
          className="chart-line opacity-20"
        />

        {/* Houses Content */}
        {centers.map((center, i) => {
          const houseNum = i + 1;
          const rashiNum = houseSigns[i];
          const natal = natalHouseMap[houseNum] || [];
          const transit = transitHouseMap[houseNum] || [];

          // Sign number position (simplified top/corner logic)
          const rashiY =
            i === 0 ? center.y - 100 : i === 6 ? center.y + 100 : center.y;
          const rashiX =
            i === 3 ? center.x - 100 : i === 9 ? center.x + 100 : center.x;

          return (
            <g key={houseNum}>
              {/* House Sign Number */}
              <text
                x={rashiX}
                y={rashiY}
                className="rashi-text text-gold/20"
                style={{ fontSize: "20px" }}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {rashiNum}
              </text>

              {/* Natal Planets (Left side of house center) */}
              <g transform={`translate(${center.x - 40}, ${center.y})`}>
                {natal.map((p, pIdx) => {
                  const planetName = p.name.replace("_natal", "");
                  const planetInfo = (PLANETS as any)[planetName];
                  const yOffset = (pIdx - (natal.length - 1) / 2) * 24;
                  return (
                    <text
                      key={p.name}
                      y={yOffset}
                      className="planet-text opacity-40"
                      style={{ fill: "#fff", fontSize: "18px" }}
                      textAnchor="end"
                    >
                      {planetInfo?.symbol || planetName.substring(0, 2)}
                    </text>
                  );
                })}
              </g>

              {/* Divider/Indicator if both exist */}
              {natal.length > 0 && transit.length > 0 && (
                <line
                  x1={center.x}
                  y1={center.y - 40}
                  x2={center.x}
                  y2={center.y + 40}
                  className="stroke-white/10"
                  strokeWidth="1"
                />
              )}

              {/* Transit Planets (Right side of house center) */}
              <g transform={`translate(${center.x + 40}, ${center.y})`}>
                {transit.map((p, pIdx) => {
                  const planetName = p.name.replace("_transit", "");
                  const planetInfo = (PLANETS as any)[planetName];
                  const yOffset = (pIdx - (transit.length - 1) / 2) * 24;
                  return (
                    <text
                      key={p.name}
                      y={yOffset}
                      className="planet-text font-bold"
                      style={{
                        fill: planetInfo?.color || "#FFD700",
                        filter: "url(#transitGlow)",
                        fontSize: "20px",
                      }}
                      textAnchor="start"
                    >
                      {planetInfo?.symbol || planetName.substring(0, 2)}
                    </text>
                  );
                })}
              </g>
            </g>
          );
        })}
      </svg>

      <div className="flex justify-between mt-4 px-2 text-[10px] uppercase tracking-widest opacity-40">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/40"></span>
          Natal Placements
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-gold shadow-[0_0_5px_#FFD700]"></span>
          Current Transits
        </span>
      </div>
    </div>
  );
};

export default TransitOverlay;
