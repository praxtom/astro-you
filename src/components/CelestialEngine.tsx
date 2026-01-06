import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars, PerspectiveCamera, Sphere, Line } from "@react-three/drei";
import * as THREE from "three";
import * as React from "react";

// --- Constants ---
// Kundali house center angles (counter-clockwise starting from top/House 1)
const getHouseAngle = (houseIndex: number) => {
  return Math.PI / 2 + (houseIndex * Math.PI * 2) / 12;
};

const HOUSE_RADII = {
  inner: 4,
  middle: 7.5,
  outer: 11,
  far: 14.5,
};

// Planet categories for visual distinction
type PlanetType = "benefic" | "malefic" | "neutral" | "shadow";

interface TransitPlanetProps {
  name: string;
  size: number;
  textureMap: string;
  color: string;
  transitSpeed: number;
  startHouse: number;
  planetType: PlanetType;
  retrograde?: boolean;
  hasRings?: boolean;
  zLayer: number; // Unique Z depth to prevent overlap
  orbitRadius: number; // Assigned orbital path radius
  isVisible?: boolean;
  isPaused?: boolean;
  scrollAngle?: number; // Fixed angle for equidistant ring during scrollytelling
}

interface ShadowPlanetProps {
  name: string;
  size: number;
  color: string;
  transitSpeed: number;
  startHouse: number;
  orbitRadius: number;
  isVisible?: boolean;
  isPaused?: boolean;
  scrollAngle?: number; // Fixed angle for equidistant ring during scrollytelling
}

interface TransitPlanetComponentProps extends TransitPlanetProps {}

// --- Cosmic Dust Particles ---
function CosmicDust() {
  const ref = useRef<THREE.Points>(null!);

  const particles = useMemo(() => {
    const count = 800;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Spread particles in a disk around the chart
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 25;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15;
      sizes[i] = Math.random() * 0.05 + 0.02;
    }

    return { positions, sizes };
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ref.current.rotation.z = t * 0.01;
    ref.current.rotation.y = Math.sin(t * 0.05) * 0.1;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[particles.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        color="#c5a059"
        transparent
        opacity={0.25}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// --- Sacred Geometry: Enhanced Kundali Grid ---
function KundaliGrid() {
  const ref = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    ref.current.rotation.z = Math.sin(t * 0.08) * 0.006;
  });

  const lines = useMemo(() => {
    const s = 1;
    return [
      [
        [s, s, 0],
        [-s, s, 0],
      ],
      [
        [-s, s, 0],
        [-s, -s, 0],
      ],
      [
        [-s, -s, 0],
        [s, -s, 0],
      ],
      [
        [s, -s, 0],
        [s, s, 0],
      ],
      [
        [0, s, 0],
        [s, 0, 0],
      ],
      [
        [s, 0, 0],
        [0, -s, 0],
      ],
      [
        [0, -s, 0],
        [-s, 0, 0],
      ],
      [
        [-s, 0, 0],
        [0, s, 0],
      ],
      [
        [s, s, 0],
        [-s, -s, 0],
      ],
      [
        [-s, s, 0],
        [s, -s, 0],
      ],
    ].map((pts) => pts.map((p) => new THREE.Vector3(...p)));
  }, []);

  const circles = useMemo(() => {
    const radii = [
      HOUSE_RADII.inner,
      HOUSE_RADII.middle,
      HOUSE_RADII.outer,
      HOUSE_RADII.far,
    ];
    return radii.map((r) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const angle = (i / 72) * Math.PI * 2;
        points.push(
          new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, 0)
        );
      }
      return points;
    });
  }, []);

  // 12 zodiac division lines
  const zodiacLines = useMemo(() => {
    const lines: THREE.Vector3[][] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      lines.push([
        new THREE.Vector3(
          Math.cos(angle) * HOUSE_RADII.inner,
          Math.sin(angle) * HOUSE_RADII.inner,
          0
        ),
        new THREE.Vector3(
          Math.cos(angle) * HOUSE_RADII.far,
          Math.sin(angle) * HOUSE_RADII.far,
          0
        ),
      ]);
    }
    return lines;
  }, []);

  return (
    <group ref={ref} position={[0, 0, -0.8]}>
      {/* Main grid */}
      {lines.map((pts, i) => (
        <Line
          key={`line-${i}`}
          points={pts}
          color="#c5a059"
          lineWidth={0.7}
          transparent
          opacity={0.35}
        />
      ))}
      {/* Concentric circles */}
      {circles.map((pts, i) => (
        <Line
          key={`circle-${i}`}
          points={pts}
          color="#c5a059"
          lineWidth={0.25}
          transparent
          opacity={0.15 - i * 0.02}
        />
      ))}
      {/* Zodiac divisions */}
      {zodiacLines.map((pts, i) => (
        <Line
          key={`zodiac-${i}`}
          points={pts}
          color="#c5a059"
          lineWidth={0.2}
          transparent
          opacity={0.1}
        />
      ))}
    </group>
  );
}

// --- Planet Aura (with type-based coloring) ---
function PlanetAura({
  size,
  color,
  planetType,
}: {
  size: number;
  color: string;
  planetType: PlanetType;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  const glowMaterial = useMemo(() => {
    const glowColor = new THREE.Color(color);
    // Reduced intensity to prevent overlap visual issues
    const baseIntensity =
      planetType === "benefic" ? 0.25 : planetType === "malefic" ? 0.18 : 0.2;

    return new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: glowColor },
        intensity: { value: baseIntensity },
        falloff: { value: planetType === "shadow" ? 3.5 : 2.5 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float falloff;
        varying vec3 vNormal;
        varying vec3 vPositionNormal;
        void main() {
          float glow = pow(1.0 - abs(dot(vNormal, vPositionNormal)), falloff);
          gl_FragColor = vec4(glowColor, glow * intensity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
  }, [color, planetType]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulseSpeed =
      planetType === "benefic" ? 0.5 : planetType === "malefic" ? 0.8 : 0.6;
    // Smaller aura to prevent overlap
    ref.current.scale.setScalar(1.25 + Math.sin(t * pulseSpeed) * 0.05);
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[size, 32, 32]} />
      <primitive object={glowMaterial} attach="material" />
    </mesh>
  );
}

// --- Saturn Rings ---
function SaturnRings({ size }: { size: number }) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    ref.current.rotation.z = Math.sin(clock.getElapsedTime() * 0.1) * 0.05;
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 2.5, 0, 0.2]}>
      <ringGeometry args={[size * 1.3, size * 2.0, 64]} />
      <meshBasicMaterial
        color="#d4c4a8"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// --- Transit Planet ---
function TransitPlanet({
  size,
  textureMap,
  color,
  transitSpeed,
  startHouse,
  planetType,
  retrograde = false,
  hasRings = false,
  isVisible = true,
  isPaused = false,
  zLayer,
  orbitRadius,
  scrollAngle,
}: TransitPlanetComponentProps) {
  const meshRef = useRef<THREE.Group>(null!);
  const texture = useLoader(THREE.TextureLoader, textureMap);
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  // Fixed orbit radius for scrollytelling ring
  const SCROLL_ORBIT_RADIUS = 6;

  useFrame(({ clock }) => {
    // Stop time during scrolling to keep targets consistent
    const t = isPaused ? 0 : clock.getElapsedTime();

    // Retrograde moves backwards
    const direction = retrograde ? -1 : 1;
    const houseProgress =
      ((t * direction) / transitSpeed + startHouse + 12) % 12;

    // Calculate orbital angle based on house progress OR scrollAngle
    const houseAngle = getHouseAngle(houseProgress);
    const activeAngle =
      isPaused && scrollAngle !== undefined ? scrollAngle : houseAngle;
    const activeOrbit =
      isPaused && scrollAngle !== undefined ? SCROLL_ORBIT_RADIUS : orbitRadius;

    const targetX = Math.cos(activeAngle) * activeOrbit;
    const targetY = Math.sin(activeAngle) * activeOrbit;

    const breathX = Math.sin(t * 0.35 + phaseOffset) * 0.15;
    const breathY = Math.sin(t * 0.3 + phaseOffset * 1.3) * 0.15;
    // Each planet has unique Z layer to prevent visual overlap
    const floatZ = zLayer + Math.sin(t * 0.2 + phaseOffset) * 0.1;

    // Smoother interpolation for orbital "locking"
    currentPos.current.x = THREE.MathUtils.lerp(
      currentPos.current.x,
      targetX + breathX,
      0.05
    );
    currentPos.current.y = THREE.MathUtils.lerp(
      currentPos.current.y,
      targetY + breathY,
      0.05
    );
    currentPos.current.z = floatZ;

    // Fade out when not focused
    meshRef.current.visible = isVisible;
    meshRef.current.position.copy(currentPos.current);
    meshRef.current.rotation.y += retrograde ? -0.003 : 0.002;
  });

  return (
    <group ref={meshRef}>
      <Sphere args={[size, 64, 64]}>
        <meshStandardMaterial
          map={texture}
          roughness={planetType === "shadow" ? 0.9 : 0.5}
          metalness={planetType === "benefic" ? 0.3 : 0.1}
        />
      </Sphere>
      {hasRings && <SaturnRings size={size} />}
    </group>
  );
}

// --- Shadow Planet (Rahu/Ketu) ---
function ShadowPlanet({
  name,
  size,
  color,
  transitSpeed,
  startHouse,
  orbitRadius,
  isVisible = true,
  isPaused = false,
  scrollAngle,
}: ShadowPlanetProps) {
  const meshRef = useRef<THREE.Group>(null!);
  const currentPos = useRef(new THREE.Vector3(0, 0, 0));
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  // Fixed orbit radius for scrollytelling ring
  const SCROLL_ORBIT_RADIUS = 6;

  useFrame(({ clock }) => {
    const t = isPaused ? 0 : clock.getElapsedTime();

    // Shadow planets always retrograde
    const houseProgress = (-t / transitSpeed + startHouse + 120) % 12;
    const houseAngle = getHouseAngle(houseProgress);

    // Use scrollAngle when paused (during scrollytelling)
    const activeAngle =
      isPaused && scrollAngle !== undefined ? scrollAngle : houseAngle;
    const activeOrbit =
      isPaused && scrollAngle !== undefined ? SCROLL_ORBIT_RADIUS : orbitRadius;

    const targetX = Math.cos(activeAngle) * activeOrbit;
    const targetY = Math.sin(activeAngle) * activeOrbit;
    const floatZ = 0.5 + Math.sin(t * 0.15 + phaseOffset) * 0.2;

    currentPos.current.x = THREE.MathUtils.lerp(
      currentPos.current.x,
      targetX,
      0.04
    );
    currentPos.current.y = THREE.MathUtils.lerp(
      currentPos.current.y,
      targetY,
      0.04
    );
    currentPos.current.z = floatZ;

    meshRef.current.visible = isVisible;
    meshRef.current.position.copy(currentPos.current);
    meshRef.current.rotation.y -= 0.004;
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
  });

  const isRahu = name === "Rahu";

  return (
    <group ref={meshRef}>
      {/* Shadow planet - dark sphere with eerie glow */}
      <Sphere args={[size, 32, 32]}>
        <meshStandardMaterial
          color={isRahu ? "#1a1a2e" : "#2d1b4e"}
          roughness={0.95}
          metalness={0.1}
        />
      </Sphere>
      {/* Distinctive ring for shadow planets */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size * 1.4, 0.03, 16, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

// --- Enhanced Sun with Corona ---
function VedicSun({
  isVisible = true,
  isPaused = false,
}: {
  isVisible?: boolean;
  isPaused?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const coronaRef = useRef<THREE.Mesh>(null!);
  const raysRef = useRef<THREE.Group>(null!);
  const texture = useLoader(THREE.TextureLoader, "/assets/planets/sun.png");

  useFrame(({ clock }) => {
    const t = isPaused ? 0 : clock.getElapsedTime();
    meshRef.current.rotation.y -= 0.0006;
    coronaRef.current.rotation.z = t * 0.05;
    coronaRef.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.08);
    raysRef.current.rotation.z = -t * 0.02;
  });

  // God rays
  const rays = useMemo(() => {
    const rayCount = 12;
    const rayData: { angle: number; length: number }[] = [];
    for (let i = 0; i < rayCount; i++) {
      rayData.push({
        angle: (i / rayCount) * Math.PI * 2,
        length: 3 + Math.random() * 2,
      });
    }
    return rayData;
  }, []);

  return (
    <group position={[0, 0, 0.3]}>
      {/* Core sun */}
      <Sphere ref={meshRef} args={[1.3, 64, 64]}>
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#FFD700"
          emissiveIntensity={0.7}
          toneMapped={false}
        />
      </Sphere>

      {/* Corona & Rays - User requested removal for cleaner scrolly focus */}
      <group visible={!isPaused}>
        {/* Corona glow */}
        <Sphere ref={coronaRef} args={[1.8, 32, 32]}>
          <meshBasicMaterial
            color="#FFD700"
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
          />
        </Sphere>

        {/* God rays */}
        <group ref={raysRef}>
          {rays.map((ray, i) => (
            <mesh key={i} position={[0, 0, -0.1]} rotation={[0, 0, ray.angle]}>
              <planeGeometry args={[0.08, ray.length]} />
              <meshBasicMaterial
                color="#FFD700"
                transparent
                opacity={0.1}
                blending={THREE.AdditiveBlending}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
        </group>
      </group>

      <pointLight
        intensity={isVisible ? 3 : 0}
        distance={80}
        color="#FFD700"
        decay={1.8}
      />
    </group>
  );
}

// --- Scrollytelling Camera Rig ---
interface CameraState {
  pos: THREE.Vector3;
  lookAt: THREE.Vector3;
}

function ScrollyCameraRig({ progress }: { progress: number }) {
  useFrame((state) => {
    // Constants for the equidistant ring
    const PLANET_RING_RADIUS = 6;
    const CAMERA_ORBIT_RADIUS = 12; // Camera orbits outside the ring
    const CAMERA_Z = 8; // Consistent depth

    // Generate camera scenes based on planet angles
    // 0: Hero, 1: Sun, 2-7: 6 Planets, 8: Rahu, 9: Ketu, 10: Synthesis
    const scenes: CameraState[] = [];

    // Scene 0: Hero (wide shot)
    scenes.push({
      pos: new THREE.Vector3(-8, 1, 50),
      lookAt: new THREE.Vector3(0, 0, 0),
    });

    // Scene 1: Sun (center)
    scenes.push({
      pos: new THREE.Vector3(0, -4, 10),
      lookAt: new THREE.Vector3(0, 0, 0),
    });

    // Scenes 2-9: Planets on equidistant ring (Moon, Mercury, Venus, Mars, Jupiter, Saturn, Rahu, Ketu)
    for (let i = 0; i < 8; i++) {
      const planetAngle = Math.PI / 2 + (i / 8) * Math.PI * 2;
      const planetX = Math.cos(planetAngle) * PLANET_RING_RADIUS;
      const planetY = Math.sin(planetAngle) * PLANET_RING_RADIUS;

      // Camera positioned opposite the planet, looking at it
      const cameraAngle = planetAngle + Math.PI; // Opposite side
      const cameraX = Math.cos(cameraAngle) * CAMERA_ORBIT_RADIUS * 0.01;
      const cameraY = Math.sin(cameraAngle) * CAMERA_ORBIT_RADIUS * 0.01;

      scenes.push({
        pos: new THREE.Vector3(cameraX, cameraY, CAMERA_Z),
        lookAt: new THREE.Vector3(planetX, planetY, 0),
      });
    }

    // Scene 10: Synthesis (pull back to see full ring)
    scenes.push({
      pos: new THREE.Vector3(0, 0, 60),
      lookAt: new THREE.Vector3(0, 0, 0),
    });

    // 2. Interpolate between scenes based on progress
    const totalScenes = scenes.length - 1;
    const sceneIndex = Math.min(
      Math.floor(progress * totalScenes),
      totalScenes - 1
    );
    const sceneProgress = (progress * totalScenes) % 1;

    const start = scenes[sceneIndex];
    const end = scenes[sceneIndex + 1];

    const currentPos = new THREE.Vector3().lerpVectors(
      start.pos,
      end.pos,
      sceneProgress
    );
    const currentLookAt = new THREE.Vector3().lerpVectors(
      start.lookAt,
      end.lookAt,
      sceneProgress
    );

    // 3. Apply subtle float/noise
    const t = state.clock.getElapsedTime();
    currentPos.x += Math.sin(t * 0.1) * 0.2;
    currentPos.y += Math.cos(t * 0.12) * 0.15;

    state.camera.position.lerp(currentPos, 0.1);

    // Smoothing the lookAt
    const targetLookAt = new THREE.Vector3();
    state.camera.getWorldDirection(targetLookAt);
    targetLookAt.add(state.camera.position); // Direction to point in world space

    // Force stable 'up' vector to prevent flipping during sharp interpolation
    state.camera.up.set(0, 1, 0);
    state.camera.lookAt(currentLookAt);
  });

  return null;
}

function NarrativeAmbiance({ progress }: { progress: number }) {
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const mainLightRef = useRef<THREE.DirectionalLight>(null!);

  useFrame(() => {
    // Dim background as we isolate planets
    const intensity = progress > 0.05 && progress < 0.95 ? 0.2 : 0.6;
    ambientRef.current.intensity = intensity;
    mainLightRef.current.intensity = 0.8 + intensity;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.45} />
      <directionalLight
        ref={mainLightRef}
        position={[-10, 15, 10]}
        intensity={1.6}
        color="#ffffff"
      />
      <directionalLight
        position={[10, -5, 5]}
        intensity={0.3}
        color="#c5a059"
      />
    </>
  );
}

// --- Main Export ---
export default function CelestialEngine({
  progress = 0,
}: {
  progress?: number;
}) {
  const planets: TransitPlanetProps[] = [
    {
      name: "Moon",
      size: 0.5,
      textureMap: "/assets/planets/mercury.png",
      color: "#e8e8f0",
      transitSpeed: 8,
      startHouse: 2,
      planetType: "benefic",
      zLayer: -0.5,
      orbitRadius: HOUSE_RADII.inner,
    },
    {
      name: "Mercury",
      size: 0.28,
      textureMap: "/assets/planets/mercury.png",
      color: "#90EE90",
      transitSpeed: 22,
      startHouse: 4,
      planetType: "neutral",
      zLayer: 2,
      orbitRadius: HOUSE_RADII.inner,
    },
    {
      name: "Venus",
      size: 0.42,
      textureMap: "/assets/planets/venus.png",
      color: "#ff69b4",
      transitSpeed: 28,
      startHouse: 6,
      planetType: "benefic",
      zLayer: 0.8,
      orbitRadius: HOUSE_RADII.middle,
    },
    {
      name: "Mars",
      size: 0.38,
      textureMap: "/assets/planets/mars.png",
      color: "#ff4500",
      transitSpeed: 40,
      startHouse: 8,
      planetType: "malefic",
      zLayer: 1,
      orbitRadius: HOUSE_RADII.middle,
    },
    {
      name: "Jupiter",
      size: 0.75,
      textureMap: "/assets/planets/jupiter.png",
      color: "#ffd700",
      transitSpeed: 85,
      startHouse: 10,
      planetType: "benefic",
      zLayer: 1.0,
      orbitRadius: HOUSE_RADII.outer,
    },
    {
      name: "Saturn",
      size: 0.6,
      textureMap: "/assets/planets/saturn.png",
      color: "#4a5568",
      transitSpeed: 140,
      startHouse: 5,
      planetType: "malefic",
      hasRings: true,
      zLayer: 0.5,
      orbitRadius: HOUSE_RADII.outer,
    },
  ];

  return (
    <div className="w-full h-full relative pointer-events-none">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[0, 3, 65]} fov={32} />
        <color attach="background" args={["#030308"]} />

        <ScrollyCameraRig progress={progress} />

        {/* Narrative-controlled Lighting */}
        <NarrativeAmbiance progress={progress} />

        {/* Deep space stars - very small factor to appear as fine points */}
        <Stars
          radius={300}
          depth={100}
          count={8000}
          factor={0.8}
          saturation={0}
          fade
          speed={0.01}
        />

        <React.Suspense fallback={null}>
          {/* Cosmic dust */}
          <CosmicDust />

          {/* Sacred geometry - fade out during focus */}
          <group visible={progress < 0.05 || progress > 0.95}>
            <KundaliGrid />
          </group>

          {/* Central Sun */}
          <VedicSun
            isPaused={progress > 0}
            isVisible={progress < 0.15 || progress > 0.95}
          />

          {/* Main planets */}
          {planets.map((p, idx) => {
            // Calculate focus (Moon=0.2, Merc=0.3, Ven=0.4, Mars=0.5, Jup=0.6, Sat=0.7)
            const sceneFocus = (idx + 2) / 10;
            const isTarget = Math.abs(progress - sceneFocus) < 0.08; // Wider window for smoother transition
            const showOnlyTarget = progress > 0.15 && progress < 0.8;

            // Equidistant angle: total 8 bodies (6 planets + Rahu + Ketu)
            // Starting from top (π/2), going clockwise
            const scrollAngle = Math.PI / 2 + (idx / 8) * Math.PI * 2;

            return (
              <TransitPlanet
                key={p.name}
                {...p}
                isPaused={progress > 0}
                isVisible={!showOnlyTarget || isTarget}
                scrollAngle={scrollAngle}
              />
            );
          })}

          {/* Shadow planets (Rahu & Ketu) */}
          <ShadowPlanet
            name="Rahu"
            size={0.4}
            color="#6366f1"
            transitSpeed={100}
            startHouse={3}
            orbitRadius={HOUSE_RADII.far}
            isPaused={progress > 0}
            scrollAngle={Math.PI / 2 + (6 / 8) * Math.PI * 2} // Equidistant angle for Rahu (7th of 8)
            isVisible={
              progress < 0.15 ||
              Math.abs(progress - 0.8) < 0.08 ||
              progress > 0.95
            }
          />
          <ShadowPlanet
            name="Ketu"
            size={0.35}
            color="#8b5cf6"
            transitSpeed={100}
            startHouse={9}
            orbitRadius={HOUSE_RADII.far}
            isPaused={progress > 0}
            scrollAngle={Math.PI / 2 + (7 / 8) * Math.PI * 2} // Equidistant angle for Ketu (8th of 8)
            isVisible={
              progress < 0.15 ||
              Math.abs(progress - 0.9) < 0.08 ||
              progress > 0.95
            }
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
