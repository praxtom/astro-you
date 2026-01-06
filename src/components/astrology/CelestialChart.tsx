import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Float,
  PerspectiveCamera,
  Stars,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import {
  KundaliData,
  PLANETS,
  getSignByCode,
  getSignNumberByCode,
} from "../../lib/astrology";
import { X, Play, Pause } from "lucide-react";

interface CelestialChartProps {
  data: KundaliData;
  onClose: () => void;
}

const Planet = ({
  name,
  sign,
  degree,
  house,
  color,
  index,
  houseLocalIndex,
  totalInHouse,
  isDiamondView,
  texture,
}: {
  name: string;
  sign: string;
  degree: number;
  house: number;
  color: string;
  index: number;
  houseLocalIndex: number;
  totalInHouse: number;
  isDiamondView: boolean;
  texture: THREE.Texture | null;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const isShadowPlanet =
    name === "Mean_Node" ||
    name === "Mean_South_Node" ||
    name === "True_Node" ||
    name === "True_South_Node";
  const planetInfo = (PLANETS as any)[name];
  // Show only Vedic name (e.g., "Rahu" instead of "Rahu | Mean Node")
  const fullName = planetInfo?.name || name.split("_").join(" ");

  // 1. CIRCULAR POSITION (Zodiacal)
  const signNum = getSignNumberByCode(sign);
  const totalDegree = ((signNum - 1) * 30 + degree) * (Math.PI / 180);
  const circularRadius = 8 + (index % 3) * 0.5;
  const circularX = Math.cos(totalDegree) * circularRadius;
  const circularZ = Math.sin(totalDegree) * circularRadius;

  // 2. DIAMOND POSITION (House centered)
  const HOUSE_CENTERS_3D = [
    [0, 0, -4.5], // H1
    [-4, 0, -6.5], // H2
    [-6.5, 0, -4], // H3
    [-4.5, 0, 0], // H4
    [-6.5, 0, 4], // H5
    [-4, 0, 6.5], // H6
    [0, 0, 4.5], // H7
    [4, 0, 6.5], // H8
    [6.5, 0, 4], // H9
    [4.5, 0, 0], // H10
    [6.5, 0, -4], // H11
    [4, 0, -6.5], // H12
  ];

  const houseData = HOUSE_CENTERS_3D[house - 1] || [0, 0, 0];

  // ARRANGEMENT LOGIC:
  // If multiple planets in one house, arrange them in a small circular pattern
  // around the house center instead of just stacked offsets.
  let offsetX = 0;
  let offsetZ = 0;

  if (totalInHouse > 1 && isDiamondView) {
    const angle = (houseLocalIndex / totalInHouse) * Math.PI * 2;
    const radialDist = totalInHouse > 3 ? 1.0 : 0.7; // Wider circle if more planets
    offsetX = Math.cos(angle) * radialDist;
    offsetZ = Math.sin(angle) * radialDist;
  } else if (isDiamondView) {
    // Single planet - slight variation based on index to avoid perfect static overlap if nodes/others coincide
    offsetX = ((index % 3) - 1) * 0.1;
    offsetZ = ((index % 3) - 1) * 0.1;
  }

  const diamondX = houseData[0] + offsetX;
  const diamondZ = houseData[2] + offsetZ;

  const targetX = isDiamondView ? diamondX : circularX;
  const targetZ = isDiamondView ? diamondZ : circularZ;

  useFrame((state) => {
    if (groupRef.current) {
      // Smoothly lerp towards target position
      groupRef.current.position.x = THREE.MathUtils.lerp(
        groupRef.current.position.x,
        targetX,
        0.05
      );
      groupRef.current.position.z = THREE.MathUtils.lerp(
        groupRef.current.position.z,
        targetZ,
        0.05
      );
      // Multi-layered vertical separation (Strata)
      // Layer 1: Inner Planets (Bottom)
      // Layer 2: Outer Giants (Middle)
      // Layer 3: Nodes (Top)
      let verticalLayer = 0;
      if (
        name === "Sun" ||
        name === "Moon" ||
        name === "Mercury" ||
        name === "Venus"
      ) {
        verticalLayer = 0;
      } else if (name === "Mars" || name === "Jupiter" || name === "Saturn") {
        verticalLayer = 1.2;
      } else {
        // Rahu/Ketu
        verticalLayer = 2.4;
      }

      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        (isDiamondView ? 0.3 : 0) + verticalLayer,
        0.05
      );
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      // Gentle floating animation
      meshRef.current.position.y =
        Math.sin(state.clock.elapsedTime + index) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={[circularX, 0, circularZ]}>
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.3, 16, 16]} />
          {texture ? (
            <meshStandardMaterial
              map={texture}
              emissive={name === "Sun" ? "#FFD700" : color}
              emissiveIntensity={name === "Sun" ? 0.8 : 0.2}
              roughness={0.7}
              metalness={0.3}
              toneMapped={false}
            />
          ) : (
            <meshLambertMaterial
              color={
                isShadowPlanet
                  ? name === "Mean_Node"
                    ? "#1a1a2e"
                    : "#2d1b4e"
                  : color
              }
              emissive={color}
              emissiveIntensity={isShadowPlanet ? 0.3 : 1.0}
              toneMapped={false}
            />
          )}
        </mesh>

        {/* Saturn's Rings */}
        {name === "Saturn" && (
          <mesh rotation={[Math.PI / 3, 0, 0]}>
            <ringGeometry args={[0.45, 0.8, 64]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        )}

        {/* Label and Degree */}
        <Html distanceFactor={15}>
          <div className="flex flex-col items-center pointer-events-none select-none">
            <div
              className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-xl border border-white/20 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white whitespace-nowrap shadow-2xl"
              style={{
                boxShadow: `0 0 20px ${color}33`,
                borderLeft: `2px solid ${color}`,
                animation: "label-entrance 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <span className="font-bold mr-1 opacity-60">{fullName}</span>{" "}
              <span className="text-white/90">{Math.floor(degree)}°</span>
            </div>
            <div
              className="w-[1px] h-6 mt-1"
              style={{
                background: `linear-gradient(to bottom, ${color}66, transparent)`,
              }}
            />
          </div>
        </Html>
      </Float>

      {/* Orbit path - Only visible in circular view */}
      {!isDiamondView && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[circularRadius - 0.01, circularRadius + 0.01, 64]}
          />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
};

const DiamondGrid = ({
  visible,
  showHouseInfo,
}: {
  visible: boolean;
  showHouseInfo: boolean;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.LineSegments>(null);

  // House meanings for Learn Mode
  const HOUSE_MEANINGS: Record<number, { short: string; theme: string }> = {
    1: { short: "Self", theme: "Personality, body, appearance" },
    2: { short: "Wealth", theme: "Money, speech, family" },
    3: { short: "Courage", theme: "Siblings, communication, skills" },
    4: { short: "Home", theme: "Mother, property, emotions" },
    5: { short: "Children", theme: "Creativity, romance, education" },
    6: { short: "Health", theme: "Enemies, debts, service" },
    7: { short: "Marriage", theme: "Partnerships, spouse, business" },
    8: { short: "Mystery", theme: "Transformation, inheritance, occult" },
    9: { short: "Dharma", theme: "Father, fortune, spirituality" },
    10: { short: "Career", theme: "Profession, status, authority" },
    11: { short: "Gains", theme: "Income, friends, aspirations" },
    12: { short: "Loss", theme: "Expenses, moksha, foreign lands" },
  };

  useFrame((state) => {
    if (visible && meshRef.current) {
      const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      // @ts-ignore
      meshRef.current.material.opacity = pulse;
    }
    if (visible && gridRef.current) {
      const pulse = 0.2 + Math.sin(state.clock.elapsedTime * 1.5) * 0.05;
      // @ts-ignore
      gridRef.current.material.opacity = pulse;
    }
  });

  if (!visible) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer Square */}
      <mesh ref={meshRef}>
        <ringGeometry args={[11.2, 11.4, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.4} />
      </mesh>

      {/* Pulsing Grid Lines */}
      <lineSegments ref={gridRef}>
        <edgesGeometry args={[new THREE.PlaneGeometry(16, 16)]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.25} />
      </lineSegments>

      {/* Diagonal partition lines for 12 houses - MORE VISIBLE */}
      <LinePoints
        points={[
          [-8, -8, 0],
          [8, 8, 0],
        ]}
        color="#FFD700"
        opacity={0.35}
      />
      <LinePoints
        points={[
          [8, -8, 0],
          [-8, 8, 0],
        ]}
        color="#FFD700"
        opacity={0.35}
      />
      {/* Central Diamond - MORE VISIBLE */}
      <LinePoints
        points={[
          [0, -8, 0],
          [-8, 0, 0],
          [0, 8, 0],
          [8, 0, 0],
          [0, -8, 0],
        ]}
        color="#FFD700"
        opacity={0.5}
      />

      {/* House labels in 3D - Anti-clockwise from H1 */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num, i) => {
        const centers = [
          [0, 3.5], // H1
          [-3.5, 5.5], // H2
          [-5.5, 3.5], // H3
          [-3.5, 0], // H4
          [-5.5, -3.5], // H5
          [-3.5, -5.5], // H6
          [0, -3.5], // H7
          [3.5, -5.5], // H8
          [5.5, -3.5], // H9
          [3.5, 0], // H10
          [5.5, 3.5], // H11
          [3.5, 5.5], // H12
        ];

        // External label positions
        const externals = [
          [0, 11.5, 0], // H1
          [-11, 11, 0], // H2
          [-14, 4, 0], // H3
          [-14, 0, 0], // H4
          [-14, -4, 0], // H5
          [-11, -11, 0], // H6
          [0, -11.5, 0], // H7
          [11, -11, 0], // H8
          [14, -4, 0], // H9
          [14, 0, 0], // H10
          [14, 4, 0], // H11
          [11, 11, 0], // H12
        ];

        const houseInfo = HOUSE_MEANINGS[num];
        const isH1_H4_H7_H10 = [1, 4, 7, 10].includes(num);

        return (
          <group key={num}>
            {/* Inner House Number/Label */}
            <group position={[centers[i][0], centers[i][1], 0.1]}>
              <Text
                fontSize={0.35}
                color={isH1_H4_H7_H10 ? "#FFD700" : "#ffffff"}
                fillOpacity={showHouseInfo ? 0.3 : 0.15}
                anchorX="center"
                anchorY="middle"
              >
                {`H${num}`}
              </Text>
            </group>

            {/* External Info Label & Line */}
            {showHouseInfo && (
              <>
                <LinePoints
                  points={[
                    [centers[i][0], centers[i][1], 0],
                    [externals[i][0], externals[i][1], 0],
                  ]}
                  color="#FFD700"
                  opacity={0.3}
                />
                <group position={[externals[i][0], externals[i][1], 0.2]}>
                  <Html distanceFactor={20} center>
                    <div
                      className="bg-black/80 backdrop-blur-xl border border-gold/40 rounded-xl px-4 py-2 text-center min-w-[140px] pointer-events-none transform transition-all duration-500 animate-in fade-in zoom-in"
                      style={{
                        boxShadow: "0 0 20px rgba(197, 160, 89, 0.1)",
                      }}
                    >
                      <div className="text-gold text-[10px] font-bold uppercase tracking-[0.2em] mb-1">
                        Bhava {num}
                      </div>
                      <div className="text-white font-display text-sm mb-1">
                        {houseInfo.short}
                      </div>
                      <div className="h-px w-8 bg-gold/20 mx-auto mb-1"></div>
                      <div className="text-white/50 text-[10px] font-sans leading-tight">
                        {houseInfo.theme}
                      </div>
                    </div>
                  </Html>
                </group>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
};

const LinePoints = ({
  points,
  color,
  opacity,
}: {
  points: number[][];
  color: string;
  opacity: number;
}) => {
  const lineGeometry = useMemo(() => {
    const pts = points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [points]);

  return (
    // @ts-ignore
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </line>
  );
};

const ZodiacRing = ({ visible }: { visible: boolean }) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (visible && ringRef.current) {
      const pulse = 0.6 + Math.sin(state.clock.elapsedTime) * 0.2;
      // @ts-ignore
      ringRef.current.material.emissiveIntensity = pulse;
    }
  });

  const signs = [
    "Mesha",
    "Vrishabha",
    "Mithuna",
    "Karka",
    "Simha",
    "Kanya",
    "Tula",
    "Vrishchika",
    "Dhanu",
    "Makara",
    "Kumbha",
    "Meena",
  ];
  if (!visible) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Main Ring */}
      <mesh ref={ringRef}>
        <ringGeometry args={[11.5, 12, 64]} />
        <meshLambertMaterial
          color="#FFD700"
          transparent
          opacity={0.15}
          emissive="#FFD700"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Sign Divisions */}
      {signs.map((name, i) => {
        const angle = (i * 30 + 15) * (Math.PI / 180);
        const radius = 13;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;

        return (
          <group
            key={name}
            position={[x, y, 0]}
            rotation={[0, 0, angle + Math.PI / 2]}
          >
            <Text
              fontSize={0.4}
              color="#FFD700"
              anchorX="center"
              anchorY="middle"
              rotation={[Math.PI / 2, 0, 0]}
            >
              {name.toUpperCase()}
            </Text>
            {/* Divider lines */}
            <mesh position={[-Math.cos((15 * Math.PI) / 180) * 1.5, 0, 0]}>
              <boxGeometry args={[0.02, 1.5, 0.02]} />
              <meshBasicMaterial color="#FFD700" transparent opacity={0.2} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
};

const CosmicGrid = () => {
  return (
    <group>
      <gridHelper args={[40, 40, "#FFD700", "#FFD700"]} position={[0, -2, 0]}>
        {/* @ts-ignore */}
        <meshBasicMaterial transparent opacity={0.05} color="#FFD700" />
      </gridHelper>
      <Stars
        radius={100}
        depth={50}
        count={2000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
      {/* Cosmic Dust / Nebula layer */}
      <Stars
        radius={150}
        depth={100}
        count={500}
        factor={12}
        saturation={0.2}
        fade
        speed={0.2}
      />
    </group>
  );
};

const CameraHandler = ({ isRotating }: { isRotating: boolean }) => {
  useFrame((state) => {
    if (!isRotating) {
      // Smoothly move to top view [0, 25, 0]
      state.camera.position.lerp(new THREE.Vector3(0, 25, 10), 0.05);
      // Reset target to center
      if (state.controls) {
        // @ts-ignore
        state.controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.05);
      }
    }
  });
  return null;
};

const SceneContent = ({
  data,
  isDiamondView,
  showWesternPlanets,
  showHouseInfo,
}: {
  data: KundaliData;
  isDiamondView: boolean;
  showWesternPlanets: boolean;
  showHouseInfo: boolean;
}) => {
  // Pre-load all textures within the scene
  const moonTex = useLoader(THREE.TextureLoader, "/assets/planets/mercury.png");
  const mercTex = useLoader(THREE.TextureLoader, "/assets/planets/mercury.png");
  const venusTex = useLoader(THREE.TextureLoader, "/assets/planets/venus.png");
  const marsTex = useLoader(THREE.TextureLoader, "/assets/planets/mars.png");
  const jupTex = useLoader(THREE.TextureLoader, "/assets/planets/jupiter.png");
  const satTex = useLoader(THREE.TextureLoader, "/assets/planets/saturn.png");
  const sunTex = useLoader(THREE.TextureLoader, "/assets/planets/sun.png");

  const textures: Record<string, THREE.Texture> = {
    Sun: sunTex,
    Moon: moonTex,
    Mercury: mercTex,
    Venus: venusTex,
    Mars: marsTex,
    Jupiter: jupTex,
    Saturn: satTex,
  };

  const groupedPlanets = useMemo(() => {
    const groups: Record<number, any[]> = {};
    data.planetary_positions
      .filter((p) => {
        if (p.name === "Ascendant") return false;
        if (
          !showWesternPlanets &&
          ["Uranus", "Neptune", "Pluto"].includes(p.name)
        )
          return false;
        if (p.name === "True_Node" || p.name === "True_South_Node")
          return false;
        return true;
      })
      .forEach((p) => {
        if (!groups[p.house]) groups[p.house] = [];
        groups[p.house].push(p);
      });
    return groups;
  }, [data.planetary_positions, showWesternPlanets]);

  return (
    <group rotation={[Math.PI * 0.05, 0, 0]}>
      <ZodiacRing visible={!isDiamondView} />
      <DiamondGrid visible={isDiamondView} showHouseInfo={showHouseInfo} />
      <CosmicGrid />

      {Object.entries(groupedPlanets).flatMap(([houseStr, planets]) => {
        const houseNum = parseInt(houseStr);
        return planets.map((p, localIdx) => {
          const info = (PLANETS as any)[p.name];
          // Use a stable index for overall count if needed, or just use 0 for now as Planet handles radial
          return (
            <Planet
              key={p.name}
              name={p.name}
              sign={p.sign}
              degree={p.degree}
              house={houseNum}
              color={info?.color || "#fff"}
              index={localIdx} // Using localIdx for visual variety
              houseLocalIndex={localIdx}
              totalInHouse={planets.length}
              isDiamondView={isDiamondView}
              texture={textures[p.name] || null}
            />
          );
        });
      })}
    </group>
  );
};

export default function CelestialChart({ data, onClose }: CelestialChartProps) {
  const [isDiamondView, setIsDiamondView] = useState(true);
  const [showWesternPlanets, setShowWesternPlanets] = useState(false);
  const [showHouseInfo, setShowHouseInfo] = useState(false); // Learn Mode
  const [isRotating, setIsRotating] = useState(false);

  const ascendantPos = data.planetary_positions.find(
    (p) => p.name === "Ascendant"
  );

  return (
    <div className="fixed inset-0 z-[100] bg-[#010103] animate-in fade-in duration-1000">
      {/* UI Overlay */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col p-8 md:p-12">
        <div className="flex justify-between items-start pointer-events-auto">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-gold/50"></div>
              <span className="text-xs font-bold uppercase tracking-[0.4em] text-gold">
                Expanded View
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display text-white">
              The Birth <span className="text-gold italic">Chart</span>
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-white/5 p-1 rounded-full border border-white/10 backdrop-blur-md">
              <button
                onClick={() => setIsDiamondView(false)}
                className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest transition-all ${
                  !isDiamondView
                    ? "bg-gold text-[#030308] font-bold shadow-[0_0_20px_rgba(229,185,106,0.4)]"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Circular View
              </button>
              <button
                onClick={() => setIsDiamondView(true)}
                className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest transition-all ${
                  isDiamondView
                    ? "bg-gold text-[#030308] font-bold shadow-[0_0_20px_rgba(229,185,106,0.4)]"
                    : "text-white/40 hover:text-white"
                }`}
              >
                Diamond Grid
              </button>
            </div>

            {/* Western Planets Toggle */}
            <button
              onClick={() => setShowWesternPlanets(!showWesternPlanets)}
              className={`px-3 py-2 rounded-full text-xs uppercase tracking-widest transition-all border ${
                showWesternPlanets
                  ? "bg-purple-500/20 border-purple-400/50 text-purple-300"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/30"
              }`}
            >
              {showWesternPlanets ? "Western ✓" : "Western"}
            </button>

            {/* Learn Mode Toggle - Only in Diamond View */}
            {isDiamondView && (
              <button
                onClick={() => setShowHouseInfo(!showHouseInfo)}
                className={`px-3 py-2 rounded-full text-xs uppercase tracking-widest transition-all border ${
                  showHouseInfo
                    ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/30"
                }`}
              >
                {showHouseInfo ? "Learn ✓" : "Learn"}
              </button>
            )}

            {/* Rotation Toggle */}
            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`p-3 md:p-4 rounded-full border transition-all ${
                isRotating
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-white/10 bg-white/5 text-white/40 hover:text-white"
              }`}
              title={
                isRotating ? "Pause Rotation" : "Resume Rotation & Reset View"
              }
            >
              {isRotating ? <Pause size={20} /> : <Play size={20} />}
            </button>

            <button
              onClick={onClose}
              className="p-3 md:p-4 rounded-full border border-white/10 bg-white/5 hover:bg-gold/10 hover:border-gold/30 text-white/40 hover:text-gold transition-all group"
            >
              <X
                size={20}
                className="group-hover:rotate-90 transition-transform duration-500"
              />
            </button>
          </div>
        </div>

        <div className="mt-auto flex justify-between items-end">
          <div className="max-w-lg">
            <p className="text-sm font-sans font-light text-white/40 leading-relaxed italic">
              "Planetary alignments provide a map of potential; your will
              determines the path."
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Ascendant Lagna
            </div>
            <div className="text-2xl font-display text-gold">
              {ascendantPos?.sign
                ? getSignByCode(ascendantPos.sign)?.name
                : "Mesha"}
            </div>
          </div>
        </div>
      </div>

      {/* 3D Scene */}
      <Canvas dpr={[1, 1.5]}>
        <PerspectiveCamera makeDefault position={[0, 15, 20]} fov={45} />
        <CameraHandler isRotating={isRotating} />
        <OrbitControls
          enablePan={false}
          maxDistance={30}
          minDistance={10}
          autoRotate={isRotating}
          autoRotateSpeed={0.3}
        />

        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={3.0} color="#FFD700" />
        <pointLight
          position={[-15, -10, -10]}
          intensity={1.0}
          color="#8B5CF6"
        />

        <Suspense fallback={null}>
          <SceneContent
            data={data}
            isDiamondView={isDiamondView}
            showWesternPlanets={showWesternPlanets}
            showHouseInfo={showHouseInfo}
          />
        </Suspense>
      </Canvas>

      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient from-gold/5 via-transparent to-transparent opacity-30" />
      </div>
    </div>
  );
}
