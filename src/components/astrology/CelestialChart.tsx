import { useEffect, useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { RootState } from "@react-three/fiber";
import {
  OrbitControls,
  Text,
  Billboard,
  Stars,
  Line,
  MeshReflectorMaterial,
  PerspectiveCamera,
  useTexture,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import {
  PLANETS,
  getSignByCode,
  getSignNumberByCode,
} from "../../lib/astrology";
import type { KundaliData, PlanetaryPosition } from "../../lib/astrology";
import { X, Play, Pause, Sparkles } from "lucide-react";

interface CelestialChartProps {
  data: KundaliData;
  onClose: () => void;
  /** When provided, the selected-planet card offers "Ask Jyotish" with a prewritten question. */
  onAskAbout?: (question: string) => void;
}

/* ── Layout constants (single source of truth) ── */

const CHART_CENTER = new THREE.Vector3(0, 0, 0);
const CAMERA = {
  diamond: new THREE.Vector3(0, 24, 12),
  circular: new THREE.Vector3(0, 16, 22),
  diamondMobile: new THREE.Vector3(0, 34, 18),
  circularMobile: new THREE.Vector3(0, 24, 30),
  opening: new THREE.Vector3(0, 40, 42),
};

/** North-Indian house centers on the plate, [x, z]. */
const HOUSE_CENTERS: [number, number][] = [
  [0, -4.5], // H1
  [-4, -6.5], // H2
  [-6.5, -4], // H3
  [-4.5, 0], // H4
  [-6.5, 4], // H5
  [-4, 6.5], // H6
  [0, 4.5], // H7
  [4, 6.5], // H8
  [6.5, 4], // H9
  [4.5, 0], // H10
  [6.5, -4], // H11
  [4, -6.5], // H12
];

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

const SANSKRIT_SIGNS = [
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

const GOLD = "#ffcd6a";

/**
 * Self-hosted font for all in-scene text. Troika (drei <Text>) fetches its
 * default font from fonts.gstatic.com via fetch(), which our CSP's
 * connect-src blocks — fonts must come from 'self'.
 */
const CHART_FONT = "/fonts/PlusJakartaSans-600.woff";

/** Surface textures for the classical planets (the Moon borrows Mercury's cratered grey). */
const PLANET_TEXTURE_PATHS: Record<string, string> = {
  Sun: "/assets/planets/sun.png",
  Moon: "/assets/planets/mercury.png",
  Mercury: "/assets/planets/mercury.png",
  Venus: "/assets/planets/venus.png",
  Mars: "/assets/planets/mars.png",
  Jupiter: "/assets/planets/jupiter.png",
  Saturn: "/assets/planets/saturn.png",
};

const EXCLUDED_PLANET_NAMES = new Set([
  "Ascendant",
  "True_Node",
  "True_South_Node",
]);
const WESTERN_PLANET_NAMES = new Set(["Uranus", "Neptune", "Pluto"]);

const isRenderablePlanet = (
  planet: PlanetaryPosition,
  showWesternPlanets: boolean,
): boolean => {
  if (EXCLUDED_PLANET_NAMES.has(planet.name)) return false;
  if (!showWesternPlanets && WESTERN_PLANET_NAMES.has(planet.name))
    return false;
  return true;
};

const formatDegree = (degree: number) =>
  // Stick to latin-subset glyphs (no ′/℞) so the self-hosted chart font
  // covers everything and troika never needs its CDN glyph fallback.
  `${Math.floor(degree)}°${String(Math.round((degree % 1) * 60)).padStart(2, "0")}'`;

/* ── Soft radial glow sprite texture, generated once ── */
let glowTextureCache: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTextureCache) return glowTextureCache;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.35, "rgba(255,255,255,0.4)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTextureCache = new THREE.CanvasTexture(canvas);
  return glowTextureCache;
}

type OrbitLikeControls = THREE.EventDispatcher & {
  target: THREE.Vector3;
  update: () => void;
};

const getOrbitControls = (state: RootState): OrbitLikeControls | null => {
  const controls = state.controls;
  if (!controls || !("target" in controls) || !("update" in controls)) {
    return null;
  }
  return controls as OrbitLikeControls;
};

/* ── Camera rig: cinematic open + eased view transitions, then hands off to the user ── */
const CameraRig = ({
  isDiamondView,
  driveUntilRef,
}: {
  isDiamondView: boolean;
  driveUntilRef: React.MutableRefObject<number>;
}) => {
  useFrame((state) => {
    if (performance.now() > driveUntilRef.current) return;
    const isNarrow = state.size.width < 640;
    const target = isDiamondView
      ? isNarrow
        ? CAMERA.diamondMobile
        : CAMERA.diamond
      : isNarrow
        ? CAMERA.circularMobile
        : CAMERA.circular;
    state.camera.position.lerp(target, 0.045);
    state.camera.lookAt(CHART_CENTER);
    const controls = getOrbitControls(state);
    if (controls) {
      controls.target.lerp(CHART_CENTER, 0.045);
      controls.update();
    }
  });
  return null;
};

/* ── The observatory table: a dark mirror the chart is engraved into ── */
const ObservatoryTable = () => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
    <circleGeometry args={[34, 72]} />
    <MeshReflectorMaterial
      blur={[400, 120]}
      resolution={1024}
      mixBlur={1}
      mixStrength={4}
      roughness={0.92}
      depthScale={1.1}
      minDepthThreshold={0.4}
      maxDepthThreshold={1.4}
      color="#04040a"
      metalness={0.55}
      mirror={0.6}
    />
  </mesh>
);

/* ── Gold engraving: the North-Indian diamond plate ── */
const DiamondPlate = ({
  visible,
  showHouseInfo,
}: {
  visible: boolean;
  showHouseInfo: boolean;
}) => {
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (visible && pulseRef.current) {
      const material = pulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 1.4) * 0.08;
    }
  });

  if (!visible) return null;

  const lines: [number, number, number][][] = [
    // Outer square
    [
      [-8, 0, -8],
      [8, 0, -8],
      [8, 0, 8],
      [-8, 0, 8],
      [-8, 0, -8],
    ],
    // Diagonals
    [
      [-8, 0, -8],
      [8, 0, 8],
    ],
    [
      [8, 0, -8],
      [-8, 0, 8],
    ],
    // Central diamond
    [
      [0, 0, -8],
      [-8, 0, 0],
      [0, 0, 8],
      [8, 0, 0],
      [0, 0, -8],
    ],
  ];

  return (
    <group>
      {/* Halo ring framing the plate */}
      <mesh
        ref={pulseRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <ringGeometry args={[11.6, 11.72, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.32} />
      </mesh>

      {lines.map((points, i) => (
        <Line
          key={i}
          points={points}
          color={GOLD}
          transparent
          opacity={i === 0 ? 0.55 : 0.35}
          lineWidth={i === 3 ? 1.6 : 1.1}
          position={[0, 0.02, 0]}
        />
      ))}

      {/* House numerals engraved on the plate */}
      {HOUSE_CENTERS.map(([x, z], i) => {
        const num = i + 1;
        const isAngular = [1, 4, 7, 10].includes(num);
        return (
          <group key={num} position={[x, 0.03, z]}>
            <Suspense fallback={null}>
              <Text
                font={CHART_FONT}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.42}
                letterSpacing={0.12}
                color={isAngular ? GOLD : "#ffffff"}
                fillOpacity={showHouseInfo ? 0.75 : 0.22}
                anchorX="center"
                anchorY="middle"
              >
                {String(num)}
              </Text>
            </Suspense>
          </group>
        );
      })}

      {/* Learn mode: house meanings annotated around the plate, with leader
          lines — placed on the table outside the chart so planets never
          occlude them. */}
      {showHouseInfo &&
        HOUSE_CENTERS.map(([x, z], i) => {
          const num = i + 1;
          const len = Math.hypot(x, z);
          const dx = x / len;
          const dz = z / len;
          const isAngular = [1, 4, 7, 10].includes(num);
          return (
            <group key={`learn-${num}`}>
              <Line
                points={[
                  [dx * (len + 0.9), 0.02, dz * (len + 0.9)],
                  [dx * 12.1, 0.02, dz * 12.1],
                ]}
                color={GOLD}
                transparent
                opacity={0.22}
                lineWidth={1}
              />
              <group position={[dx * 13.4, 0.03, dz * 13.4]}>
                <Suspense fallback={null}>
                  <Text
                    font={CHART_FONT}
                    rotation={[-Math.PI / 2, 0, 0]}
                    fontSize={0.52}
                    letterSpacing={0.18}
                    color={isAngular ? GOLD : "#ffffff"}
                    fillOpacity={0.9}
                    anchorX="center"
                    anchorY="middle"
                  >
                    {`${num} · ${HOUSE_MEANINGS[num].short.toUpperCase()}`}
                  </Text>
                  <Text
                    font={CHART_FONT}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0, 0.62]}
                    fontSize={0.27}
                    letterSpacing={0.05}
                    color="#ffffff"
                    fillOpacity={0.42}
                    anchorX="center"
                    anchorY="middle"
                    maxWidth={5}
                    textAlign="center"
                  >
                    {HOUSE_MEANINGS[num].theme}
                  </Text>
                </Suspense>
              </group>
            </group>
          );
        })}
    </group>
  );
};

/* ── The zodiac wheel for circular view, with a Lagna marker ── */
const ZodiacWheel = ({
  visible,
  ascendantDegree,
}: {
  visible: boolean;
  ascendantDegree: number | null;
}) => {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (visible && ringRef.current) {
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.16 + Math.sin(state.clock.elapsedTime) * 0.04;
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* Twin engraved circles */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      >
        <ringGeometry args={[11.5, 11.58, 96]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[12.5, 12.56, 96]} />
        <meshBasicMaterial color={GOLD} transparent opacity={0.12} />
      </mesh>

      {/* Sign divisions + names */}
      {SANSKRIT_SIGNS.map((name, i) => {
        const dividerAngle = (i * 30 * Math.PI) / 180;
        const labelAngle = ((i * 30 + 15) * Math.PI) / 180;
        const lx = Math.cos(labelAngle) * 12.05;
        const lz = -Math.sin(labelAngle) * 12.05;
        return (
          <group key={name}>
            <Line
              points={[
                [
                  Math.cos(dividerAngle) * 11.5,
                  0.015,
                  -Math.sin(dividerAngle) * 11.5,
                ],
                [
                  Math.cos(dividerAngle) * 12.5,
                  0.015,
                  -Math.sin(dividerAngle) * 12.5,
                ],
              ]}
              color={GOLD}
              transparent
              opacity={0.3}
              lineWidth={1}
            />
            <Suspense fallback={null}>
              <Text
                font={CHART_FONT}
                position={[lx, 0.02, lz]}
                rotation={[-Math.PI / 2, 0, labelAngle - Math.PI / 2]}
                fontSize={0.36}
                letterSpacing={0.28}
                color={GOLD}
                fillOpacity={0.55}
                anchorX="center"
                anchorY="middle"
              >
                {name.toUpperCase()}
              </Text>
            </Suspense>
          </group>
        );
      })}

      {/* Lagna marker at the ascendant's zodiacal degree */}
      {ascendantDegree !== null && (
        <group
          position={[
            Math.cos((ascendantDegree * Math.PI) / 180) * 13.3,
            0.02,
            -Math.sin((ascendantDegree * Math.PI) / 180) * 13.3,
          ]}
        >
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.14, 16]} />
            <meshBasicMaterial color={GOLD} transparent opacity={0.9} />
          </mesh>
          <Suspense fallback={null}>
            <Text
              font={CHART_FONT}
              position={[0, 0.01, -0.55]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.3}
              letterSpacing={0.3}
              color={GOLD}
              fillOpacity={0.85}
              anchorX="center"
              anchorY="middle"
            >
              LAGNA
            </Text>
          </Suspense>
        </group>
      )}
    </group>
  );
};

/* ── A single planet: emissive orb + additive halo + scene-space label ── */
const PlanetOrb = ({
  planet,
  houseLocalIndex,
  totalInHouse,
  isDiamondView,
  isSelected,
  onSelect,
  texture,
}: {
  planet: PlanetaryPosition;
  houseLocalIndex: number;
  totalInHouse: number;
  isDiamondView: boolean;
  isSelected: boolean;
  onSelect: (planet: PlanetaryPosition) => void;
  texture: THREE.Texture | null;
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const orbRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Sprite>(null);
  const [hovered, setHovered] = useState(false);

  const info = (PLANETS as Record<string, { name: string; color: string }>)[
    planet.name
  ];
  const color = info?.color || "#ffffff";
  const vedicName = info?.name || planet.name.split("_").join(" ");
  const isSun = planet.name === "Sun";
  const isShadow =
    planet.name === "Mean_Node" || planet.name === "Mean_South_Node";
  const radius = isSun ? 0.55 : texture ? 0.4 : 0.32;
  // Textured planets glow through their own surface (emissiveMap), so they
  // need far less raw emissive than the stylised orbs to read well in bloom.
  const baseIntensity = texture ? (isSun ? 1.7 : 0.6) : isShadow ? 1.1 : 1.9;

  /* Circular target — true zodiacal longitude */
  const signNum = getSignNumberByCode(planet.sign);
  const zodiacDeg = (signNum - 1) * 30 + planet.degree;
  const zodiacRad = (zodiacDeg * Math.PI) / 180;
  const circularRadius = 8.6;
  const circularX = Math.cos(zodiacRad) * circularRadius;
  const circularZ = -Math.sin(zodiacRad) * circularRadius;

  /* Diamond target — house center, siblings fanned in a small ring */
  const [hx, hz] = HOUSE_CENTERS[planet.house - 1] || [0, 0];
  let offsetX = 0;
  let offsetZ = 0;
  if (totalInHouse > 1) {
    const angle = (houseLocalIndex / totalInHouse) * Math.PI * 2;
    const spread = totalInHouse > 3 ? 1.05 : 0.72;
    offsetX = Math.cos(angle) * spread;
    offsetZ = Math.sin(angle) * spread;
  }
  const diamondX = hx + offsetX;
  const diamondZ = hz + offsetZ;

  const targetX = isDiamondView ? diamondX : circularX;
  const targetZ = isDiamondView ? diamondZ : circularZ;
  const baseY = 0.62;

  useFrame((state) => {
    const group = groupRef.current;
    if (group) {
      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, 0.06);
      group.position.z = THREE.MathUtils.lerp(group.position.z, targetZ, 0.06);
      const lift = isSelected ? 1.15 : 0;
      const breathe =
        Math.sin(state.clock.elapsedTime * 0.9 + zodiacDeg) * 0.07;
      group.position.y = THREE.MathUtils.lerp(
        group.position.y,
        baseY + lift + breathe,
        0.07,
      );
    }
    if (orbRef.current) {
      orbRef.current.rotation.y += texture ? 0.0065 : 0.004;
      const material = orbRef.current.material as THREE.MeshStandardMaterial;
      const targetIntensity =
        baseIntensity * (isSelected ? 1.5 : hovered ? 1.25 : 1);
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        targetIntensity,
        0.1,
      );
    }
    if (haloRef.current) {
      const haloScale =
        (isSun ? 4.2 : 2.3) * (isSelected ? 1.3 : hovered ? 1.15 : 1);
      haloRef.current.scale.lerp(
        new THREE.Vector3(haloScale, haloScale, 1),
        0.1,
      );
    }
  });

  return (
    <group ref={groupRef} position={[circularX, baseY, circularZ]}>
      {/* Halo — kept subtle on textured planets so the surface stays legible */}
      <sprite ref={haloRef} scale={[isSun ? 4.2 : 2.3, isSun ? 4.2 : 2.3, 1]}>
        <spriteMaterial
          map={getGlowTexture()}
          color={color}
          transparent
          opacity={isSun ? 0.32 : texture ? 0.16 : isShadow ? 0.18 : 0.3}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Core orb */}
      <mesh
        ref={orbRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(planet);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[radius, 48, 48]} />
        {texture ? (
          <meshStandardMaterial
            map={texture}
            emissive="#ffffff"
            emissiveMap={texture}
            emissiveIntensity={baseIntensity}
            roughness={0.7}
            metalness={0.08}
            toneMapped={false}
          />
        ) : (
          <meshStandardMaterial
            color="#0a0a12"
            emissive={color}
            emissiveIntensity={baseIntensity}
            roughness={0.4}
            metalness={0.1}
            toneMapped={false}
          />
        )}
      </mesh>

      {/* Saturn's rings — two translucent bands */}
      {planet.name === "Saturn" && (
        <group rotation={[Math.PI / 2.6, 0.4, 0]}>
          <mesh>
            <ringGeometry args={[0.56, 0.78, 64]} />
            <meshBasicMaterial
              color="#d9c9a8"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
          <mesh>
            <ringGeometry args={[0.82, 0.96, 64]} />
            <meshBasicMaterial
              color="#b8a888"
              transparent
              opacity={0.28}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        </group>
      )}

      {/* Selection halo on the table beneath */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -(baseY + 1.1), 0]}>
          <ringGeometry args={[0.5, 0.58, 48]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Scene-space label: occludes correctly, never jitters */}
      <Billboard position={[0, radius + 0.62, 0]}>
        <Suspense fallback={null}>
          <Text
            font={CHART_FONT}
            fontSize={0.34}
            letterSpacing={0.18}
            color="#ffffff"
            fillOpacity={hovered || isSelected ? 1 : 0.82}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.012}
            outlineColor="#000000"
            outlineOpacity={0.6}
          >
            {vedicName.toUpperCase()}
          </Text>
          <Text
            font={CHART_FONT}
            position={[0, -0.06, 0]}
            fontSize={0.25}
            letterSpacing={0.1}
            color={color}
            fillOpacity={0.9}
            anchorX="center"
            anchorY="top"
            outlineWidth={0.01}
            outlineColor="#000000"
            outlineOpacity={0.6}
          >
            {`${formatDegree(planet.degree)}${planet.is_retrograde ? "  Rx" : ""}`}
          </Text>
        </Suspense>
      </Billboard>
      <Line
        points={[
          [0, radius + 0.06, 0],
          [0, radius + 0.5, 0],
        ]}
        color={color}
        transparent
        opacity={0.35}
        lineWidth={1}
      />
    </group>
  );
};

/* ── Scene assembly ── */
const SceneContent = ({
  data,
  isDiamondView,
  showWesternPlanets,
  showHouseInfo,
  selectedName,
  onSelect,
  ascendantDegree,
}: {
  data: KundaliData;
  isDiamondView: boolean;
  showWesternPlanets: boolean;
  showHouseInfo: boolean;
  selectedName: string | null;
  onSelect: (planet: PlanetaryPosition) => void;
  ascendantDegree: number | null;
}) => {
  const textures = useTexture(PLANET_TEXTURE_PATHS) as Record<
    string,
    THREE.Texture
  >;
  useMemo(() => {
    Object.values(textures).forEach((t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    });
  }, [textures]);

  const groupedPlanets = useMemo(() => {
    const groups: Record<number, PlanetaryPosition[]> = {};
    data.planetary_positions
      .filter((p) => isRenderablePlanet(p, showWesternPlanets))
      .forEach((p) => {
        if (!groups[p.house]) groups[p.house] = [];
        groups[p.house].push(p);
      });
    return groups;
  }, [data.planetary_positions, showWesternPlanets]);

  return (
    <group>
      <ObservatoryTable />
      <DiamondPlate visible={isDiamondView} showHouseInfo={showHouseInfo} />
      <ZodiacWheel visible={!isDiamondView} ascendantDegree={ascendantDegree} />

      {Object.values(groupedPlanets).flatMap((planets) =>
        planets.map((p, localIdx) => (
          <PlanetOrb
            key={p.name}
            planet={p}
            houseLocalIndex={localIdx}
            totalInHouse={planets.length}
            isDiamondView={isDiamondView}
            isSelected={selectedName === p.name}
            onSelect={onSelect}
            texture={textures[p.name] ?? null}
          />
        )),
      )}

      <Stars
        radius={110}
        depth={60}
        count={1600}
        factor={3.5}
        saturation={0}
        fade
        speed={0.4}
      />
    </group>
  );
};

/* ── Component ── */
export default function CelestialChart({
  data,
  onClose,
  onAskAbout,
}: CelestialChartProps) {
  const [isDiamondView, setIsDiamondView] = useState(true);
  const [showWesternPlanets, setShowWesternPlanets] = useState(false);
  const [showHouseInfo, setShowHouseInfo] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [selected, setSelected] = useState<PlanetaryPosition | null>(null);

  // The rig drives the camera during the opening shot and view changes,
  // then releases it to OrbitControls.
  const driveUntilRef = useRef(performance.now() + 2800);
  useEffect(() => {
    driveUntilRef.current = performance.now() + 1800;
  }, [isDiamondView]);

  const ascendantPos = data.planetary_positions.find(
    (p) => p.name === "Ascendant",
  );
  const ascendantName = ascendantPos?.sign
    ? getSignByCode(ascendantPos.sign)?.name
    : null;
  const ascendantDegree = ascendantPos
    ? (getSignNumberByCode(ascendantPos.sign) - 1) * 30 + ascendantPos.degree
    : null;
  const hasRenderablePlanets = data.planetary_positions.some((planet) =>
    isRenderablePlanet(planet, true),
  );

  const selectedInfo = selected
    ? (PLANETS as Record<string, { name: string; color: string }>)[
        selected.name
      ]
    : null;
  const selectedSignName = selected
    ? getSignByCode(selected.sign)?.name || selected.sign
    : null;

  const pillClass = (active: boolean) =>
    `px-3 py-2 md:px-4 rounded-full text-[0.6rem] md:text-[0.65rem] font-bold uppercase tracking-[0.2em] transition-all ${
      active
        ? "bg-gold text-black shadow-[0_0_24px_rgba(255,205,106,0.35)]"
        : "text-white/40 hover:text-white"
    }`;

  return (
    <div className="fixed inset-0 z-100 bg-[#020206] animate-in fade-in duration-1000">
      {/* ── Chrome ── */}
      <div className="absolute inset-0 z-10 pointer-events-none flex flex-col p-5 md:p-10">
        {/* Top bar */}
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start pointer-events-auto">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-px w-8 bg-gold/50" />
              <span className="text-[0.6rem] font-bold uppercase tracking-[0.4em] text-gold/80">
                The Observatory
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-display text-white leading-tight">
              The Birth <span className="text-gold italic">Chart</span>
            </h2>
          </div>

          <div className="flex max-w-full flex-wrap items-center gap-2">
            <div className="flex bg-white/5 p-1 rounded-full border border-white/10 backdrop-blur-md">
              <button
                onClick={() => setIsDiamondView(true)}
                className={pillClass(isDiamondView)}
              >
                Diamond
              </button>
              <button
                onClick={() => setIsDiamondView(false)}
                className={pillClass(!isDiamondView)}
              >
                Wheel
              </button>
            </div>

            <button
              onClick={() => setShowWesternPlanets(!showWesternPlanets)}
              className={`px-3 py-2 rounded-full text-[0.6rem] md:text-[0.65rem] font-bold uppercase tracking-[0.2em] transition-all border ${
                showWesternPlanets
                  ? "border-gold/40 bg-gold/10 text-gold"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/30"
              }`}
            >
              Western
            </button>

            {isDiamondView && (
              <button
                onClick={() => setShowHouseInfo(!showHouseInfo)}
                className={`px-3 py-2 rounded-full text-[0.6rem] md:text-[0.65rem] font-bold uppercase tracking-[0.2em] transition-all border ${
                  showHouseInfo
                    ? "border-gold/40 bg-gold/10 text-gold"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white hover:border-white/30"
                }`}
              >
                Learn
              </button>
            )}

            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`p-3 rounded-full border transition-all ${
                isRotating
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-white/10 bg-white/5 text-white/40 hover:text-white"
              }`}
              title={isRotating ? "Pause rotation" : "Slow rotation"}
            >
              {isRotating ? <Pause size={16} /> : <Play size={16} />}
            </button>

            <button
              onClick={onClose}
              className="p-3 rounded-full border border-white/10 bg-white/5 hover:bg-gold/10 hover:border-gold/30 text-white/40 hover:text-gold transition-all group"
              aria-label="Close expanded chart"
            >
              <X
                size={16}
                className="group-hover:rotate-90 transition-transform duration-500"
              />
            </button>
          </div>
        </div>

        {/* Bottom bar: selected planet card, or the resting line */}
        <div className="mt-auto flex flex-col gap-4 md:flex-row md:justify-between md:items-end">
          {selected ? (
            <div className="pointer-events-auto max-w-sm rounded-2xl border border-gold/20 bg-black/65 backdrop-blur-2xl p-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className="text-[0.6rem] font-bold uppercase tracking-[0.35em] mb-1"
                    style={{ color: selectedInfo?.color || GOLD }}
                  >
                    {selected.name.split("_").join(" ")}
                    {selected.is_retrograde ? " · Retrograde" : ""}
                  </p>
                  <h3 className="font-display italic text-2xl text-white">
                    {selectedInfo?.name || selected.name}
                  </h3>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-gold transition-colors"
                  aria-label="Dismiss planet details"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="mt-3 space-y-1 text-sm text-white/65">
                <p>
                  {selectedSignName} · {formatDegree(selected.degree)}
                </p>
                <p>
                  House {selected.house} —{" "}
                  {HOUSE_MEANINGS[selected.house]?.short}
                  <span className="text-white/35">
                    {" "}
                    · {HOUSE_MEANINGS[selected.house]?.theme}
                  </span>
                </p>
                {selected.nakshatra && (
                  <p className="text-white/45">
                    Nakshatra · {selected.nakshatra}
                  </p>
                )}
              </div>
              {onAskAbout && (
                <button
                  onClick={() =>
                    onAskAbout(
                      `What does ${selectedInfo?.name || selected.name} in ${selectedSignName}, in my ${selected.house}th house, mean for me?`,
                    )
                  }
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-black text-[0.65rem] font-bold uppercase tracking-[0.2em] hover:bg-gold/90 transition-colors"
                >
                  <Sparkles size={12} />
                  Ask Jyotish about this
                </button>
              )}
            </div>
          ) : (
            <p className="max-w-md text-sm font-display italic text-white/35 leading-relaxed">
              Touch a planet to read its placement. "The sky is a map of
              potential; your will determines the path."
            </p>
          )}

          <div className="md:text-right">
            <div className="text-[0.6rem] font-bold uppercase tracking-[0.35em] text-white/35 mb-1.5">
              Ascendant Lagna
            </div>
            <div className="text-2xl font-display italic text-gold">
              {ascendantName || "Unknown"}
            </div>
          </div>
        </div>
      </div>

      {!hasRenderablePlanets && (
        <div className="pointer-events-auto absolute left-1/2 top-1/2 z-20 w-[min(28rem,calc(100%-3rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gold/20 bg-black/75 p-5 text-center backdrop-blur-xl">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-gold">
            Chart data unavailable
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/65">
            Planet positions are missing for this profile. Close this view and
            update birth details to recalculate the chart.
          </p>
        </div>
      )}

      {/* ── Scene ── */}
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onPointerMissed={() => setSelected(null)}
      >
        <PerspectiveCamera
          makeDefault
          position={CAMERA.opening.toArray()}
          fov={45}
        />
        <CameraRig
          isDiamondView={isDiamondView}
          driveUntilRef={driveUntilRef}
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.06}
          maxDistance={42}
          minDistance={9}
          maxPolarAngle={Math.PI / 2.15}
          autoRotate={isRotating}
          autoRotateSpeed={0.35}
        />

        <fog attach="fog" args={["#020206", 38, 95]} />
        <ambientLight intensity={0.5} />
        <pointLight
          position={[10, 14, 8]}
          intensity={1.6}
          decay={0}
          color={GOLD}
        />
        <pointLight
          position={[-14, 6, -10]}
          intensity={0.5}
          decay={0}
          color="#7c6cff"
        />

        <Suspense fallback={null}>
          <SceneContent
            data={data}
            isDiamondView={isDiamondView}
            showWesternPlanets={showWesternPlanets}
            showHouseInfo={showHouseInfo}
            selectedName={selected?.name ?? null}
            onSelect={(p) => setSelected(p)}
            ascendantDegree={ascendantDegree}
          />
        </Suspense>

        <EffectComposer>
          <Bloom
            mipmapBlur
            intensity={1.05}
            luminanceThreshold={0.85}
            luminanceSmoothing={0.25}
            radius={0.75}
          />
          <Vignette offset={0.22} darkness={0.82} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
