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
import { X } from "lucide-react";

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
  isDiamondView,
  texture,
}: {
  name: string;
  sign: string;
  degree: number;
  house: number;
  color: string;
  index: number;
  isDiamondView: boolean;
  texture: THREE.Texture | null;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  const isShadowPlanet = name === "Mean_Node" || name === "Mean_South_Node";
  const planetInfo = (PLANETS as any)[name];
  const fullName = planetInfo
    ? `${planetInfo.name} | ${name.split("_").join(" ")}`
    : name;

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
  // Internal offset within house to avoid overlapping planets in same house
  const houseOffset = (index % 4) * 0.6 - 0.9;
  const diamondX =
    houseData[0] + (index % 2 === 0 ? houseOffset : -houseOffset) * 0.3;
  const diamondZ =
    houseData[2] + (index % 2 !== 0 ? houseOffset : -houseOffset) * 0.3;

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
          <sphereGeometry args={[0.3, 32, 32]} />
          {texture ? (
            <meshStandardMaterial
              map={texture}
              emissive={name === "Sun" ? "#FFD700" : color}
              emissiveIntensity={name === "Sun" ? 0.8 : 0.2}
              roughness={0.5}
              metalness={0.4}
              toneMapped={false}
            />
          ) : (
            <meshStandardMaterial
              color={
                isShadowPlanet
                  ? name === "Mean_Node"
                    ? "#1a1a2e"
                    : "#2d1b4e"
                  : color
              }
              emissive={color}
              emissiveIntensity={isShadowPlanet ? 0.4 : 1.2}
              toneMapped={false}
            />
          )}
        </mesh>

        {/* Label and Degree */}
        <Html distanceFactor={15}>
          <div className="flex flex-col items-center pointer-events-none select-none">
            <div
              className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs uppercase tracking-widest text-white whitespace-nowrap"
              style={{ boxShadow: `0 0 10px ${color}44` }}
            >
              <span style={{ color }} className="font-bold mr-1">
                {fullName}
              </span>{" "}
              {Math.floor(degree)}°
            </div>
            <div className="w-px h-4 bg-gradient-to-b from-white/20 to-transparent mt-1" />
          </div>
        </Html>
      </Float>

      {/* Orbit path - Only visible in circular view */}
      {!isDiamondView && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry
            args={[circularRadius - 0.01, circularRadius + 0.01, 128]}
          />
          <meshBasicMaterial color={color} transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
};

const DiamondGrid = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]}>
      {/* Outer Square */}
      <mesh>
        <ringGeometry args={[11.2, 11.3, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.3} />
      </mesh>

      {/* Inner Diamond Grid (Lines) */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(16, 16)]} />
        <meshBasicMaterial color="#FFD700" transparent opacity={0.1} />
      </lineSegments>

      {/* Diagonal partition lines for 12 houses */}
      <LinePoints
        points={[
          [-8, -8, 0],
          [8, 8, 0],
        ]}
        color="#FFD700"
        opacity={0.1}
      />
      <LinePoints
        points={[
          [8, -8, 0],
          [-8, 8, 0],
        ]}
        color="#FFD700"
        opacity={0.1}
      />
      {/* Central Diamond */}
      <LinePoints
        points={[
          [0, -8, 0],
          [-8, 0, 0],
          [0, 8, 0],
          [8, 0, 0],
          [0, -8, 0],
        ]}
        color="#FFD700"
        opacity={0.3}
      />

      {/* House labels in 3D */}
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num, i) => {
        const centers = [
          [0, -3.5],
          [-3.5, -5.5],
          [-5.5, -3.5],
          [-3.5, 0],
          [-5.5, 3.5],
          [-3.5, 5.5],
          [0, 3.5],
          [3.5, 5.5],
          [5.5, 3.5],
          [3.5, 0],
          [5.5, -3.5],
          [3.5, -5.5],
        ];
        return (
          <Text
            key={num}
            position={[centers[i][0], centers[i][1], 0.1]}
            fontSize={0.3}
            color="#FFD700"
            fillOpacity={0.2}
            anchorX="center"
            anchorY="middle"
          >
            H{num}
          </Text>
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
      <mesh>
        <ringGeometry args={[11.5, 12, 128]} />
        <meshStandardMaterial
          color="#FFD700"
          transparent
          opacity={0.1}
          emissive="#FFD700"
          emissiveIntensity={0.5}
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
        count={5000}
        factor={4}
        saturation={0}
        fade
        speed={1}
      />
    </group>
  );
};

const SceneContent = ({
  data,
  isDiamondView,
}: {
  data: KundaliData;
  isDiamondView: boolean;
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

  return (
    <group rotation={[Math.PI * 0.05, 0, 0]}>
      <ZodiacRing visible={!isDiamondView} />
      <DiamondGrid visible={isDiamondView} />
      <CosmicGrid />

      {data.planetary_positions
        .filter((p) => p.name !== "Ascendant")
        .map((p, i) => {
          const info = (PLANETS as any)[p.name];
          return (
            <Planet
              key={p.name}
              name={p.name}
              sign={p.sign}
              degree={p.degree}
              house={p.house}
              color={info?.color || "#fff"}
              index={i}
              isDiamondView={isDiamondView}
              texture={textures[p.name] || null}
            />
          );
        })}
    </group>
  );
};

export default function CelestialChart({ data, onClose }: CelestialChartProps) {
  const [isDiamondView, setIsDiamondView] = useState(false);
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
          <div className="max-w-md">
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
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 15, 20]} fov={45} />
        <OrbitControls
          enablePan={false}
          maxDistance={30}
          minDistance={10}
          autoRotate
          autoRotateSpeed={0.5}
        />

        <ambientLight intensity={0.7} />
        <pointLight position={[10, 10, 10]} intensity={3.0} color="#FFD700" />
        <pointLight
          position={[-15, -10, -10]}
          intensity={1.0}
          color="#8B5CF6"
        />

        <Suspense fallback={null}>
          <SceneContent data={data} isDiamondView={isDiamondView} />
        </Suspense>
      </Canvas>

      {/* Background Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient from-gold/5 via-transparent to-transparent opacity-30" />
      </div>
    </div>
  );
}
