import { useRef, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars, PerspectiveCamera, Sphere, Line } from "@react-three/drei";
import * as THREE from "three";
import * as React from "react";

// --- Constants ---
const OFFSET_X = 22;

// Kundali house centers (North Indian diamond - 12 houses)
const HOUSE_CENTERS: THREE.Vector3[] = [
  new THREE.Vector3(0, 0, 0), // House 1 (Lagna)
  new THREE.Vector3(-4, 4, 0), // House 2
  new THREE.Vector3(-8, 0, 0), // House 3
  new THREE.Vector3(-4, -4, 0), // House 4
  new THREE.Vector3(0, -8, 0), // House 5
  new THREE.Vector3(4, -4, 0), // House 6
  new THREE.Vector3(8, 0, 0), // House 7
  new THREE.Vector3(4, 4, 0), // House 8
  new THREE.Vector3(0, 8, 0), // House 9
  new THREE.Vector3(-2, 6, 0), // House 10
  new THREE.Vector3(2, 6, 0), // House 11
  new THREE.Vector3(6, 2, 0), // House 12
].map((v) => new THREE.Vector3(v.x + OFFSET_X, v.y, v.z));

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
}

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
      const radius = 5 + Math.random() * 20;
      positions[i * 3] = Math.cos(angle) * radius + OFFSET_X;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
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
        size={0.08}
        color="#c5a059"
        transparent
        opacity={0.4}
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
    const s = 8;
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
    const radii = [3, 5.5, 8.5, 11];
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
        new THREE.Vector3(Math.cos(angle) * 5.5, Math.sin(angle) * 5.5, 0),
        new THREE.Vector3(Math.cos(angle) * 11, Math.sin(angle) * 11, 0),
      ]);
    }
    return lines;
  }, []);

  return (
    <group ref={ref} position={[OFFSET_X, 0, -0.8]}>
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
  zLayer,
}: TransitPlanetProps) {
  const meshRef = useRef<THREE.Group>(null!);
  const texture = useLoader(THREE.TextureLoader, textureMap);
  const currentPos = useRef(HOUSE_CENTERS[startHouse].clone());
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Retrograde moves backwards
    const direction = retrograde ? -1 : 1;
    const houseProgress =
      ((t * direction) / transitSpeed + startHouse + 12) % 12;
    const currentHouse = Math.floor(houseProgress);
    const nextHouse = (currentHouse + (retrograde ? 11 : 1)) % 12;
    const transitionProgress = Math.abs(houseProgress - currentHouse);

    const easedProgress =
      transitionProgress < 0.5
        ? 2 * transitionProgress * transitionProgress
        : 1 - Math.pow(-2 * transitionProgress + 2, 2) / 2;

    const fromPos = HOUSE_CENTERS[currentHouse];
    const toPos = HOUSE_CENTERS[nextHouse];

    const targetX = THREE.MathUtils.lerp(fromPos.x, toPos.x, easedProgress);
    const targetY = THREE.MathUtils.lerp(fromPos.y, toPos.y, easedProgress);

    const breathX = Math.sin(t * 0.35 + phaseOffset) * 0.08;
    const breathY = Math.sin(t * 0.3 + phaseOffset * 1.3) * 0.1;
    // Each planet has unique Z layer to prevent visual overlap
    const floatZ = zLayer + Math.sin(t * 0.2 + phaseOffset) * 0.1;

    currentPos.current.x = THREE.MathUtils.lerp(
      currentPos.current.x,
      targetX + breathX,
      0.015
    );
    currentPos.current.y = THREE.MathUtils.lerp(
      currentPos.current.y,
      targetY + breathY,
      0.015
    );
    currentPos.current.z = floatZ;

    meshRef.current.position.copy(currentPos.current);
    meshRef.current.rotation.y += retrograde ? -0.003 : 0.002;
  });

  return (
    <group ref={meshRef} position={HOUSE_CENTERS[startHouse]}>
      <Sphere args={[size, 64, 64]}>
        <meshStandardMaterial
          map={texture}
          roughness={planetType === "shadow" ? 0.9 : 0.5}
          metalness={planetType === "benefic" ? 0.3 : 0.1}
        />
      </Sphere>
      {hasRings && <SaturnRings size={size} />}
      <PlanetAura size={size} color={color} planetType={planetType} />
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
}: {
  name: string;
  size: number;
  color: string;
  transitSpeed: number;
  startHouse: number;
}) {
  const meshRef = useRef<THREE.Group>(null!);
  const currentPos = useRef(HOUSE_CENTERS[startHouse].clone());
  const phaseOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Shadow planets always retrograde
    const houseProgress = (-t / transitSpeed + startHouse + 120) % 12;
    const currentHouse = Math.floor(houseProgress);
    const nextHouse = (currentHouse + 11) % 12;
    const transitionProgress = Math.abs(houseProgress - currentHouse);

    const easedProgress =
      transitionProgress < 0.5
        ? 2 * transitionProgress * transitionProgress
        : 1 - Math.pow(-2 * transitionProgress + 2, 2) / 2;

    const fromPos = HOUSE_CENTERS[currentHouse];
    const toPos = HOUSE_CENTERS[nextHouse];

    const targetX = THREE.MathUtils.lerp(fromPos.x, toPos.x, easedProgress);
    const targetY = THREE.MathUtils.lerp(fromPos.y, toPos.y, easedProgress);

    const floatZ = 0.5 + Math.sin(t * 0.15 + phaseOffset) * 0.2;

    currentPos.current.x = THREE.MathUtils.lerp(
      currentPos.current.x,
      targetX,
      0.012
    );
    currentPos.current.y = THREE.MathUtils.lerp(
      currentPos.current.y,
      targetY,
      0.012
    );
    currentPos.current.z = floatZ;

    meshRef.current.position.copy(currentPos.current);
    meshRef.current.rotation.y -= 0.004;
    meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.1;
  });

  const isRahu = name === "Rahu";

  return (
    <group ref={meshRef} position={HOUSE_CENTERS[startHouse]}>
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
      <PlanetAura size={size} color={color} planetType="shadow" />
    </group>
  );
}

// --- Enhanced Sun with Corona ---
function VedicSun() {
  const meshRef = useRef<THREE.Mesh>(null!);
  const coronaRef = useRef<THREE.Mesh>(null!);
  const raysRef = useRef<THREE.Group>(null!);
  const texture = useLoader(THREE.TextureLoader, "/assets/planets/sun.png");

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
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
    <group position={[OFFSET_X, 0, 0.3]}>
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

      <pointLight intensity={3} distance={80} color="#FFD700" decay={1.8} />
      <pointLight intensity={1} distance={40} color="#ff9500" decay={2} />
    </group>
  );
}

// --- Steady Camera ---
function SteadyCameraRig() {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const subtleX = Math.sin(t * 0.05) * 0.3;
    const subtleY = Math.sin(t * 0.04) * 0.2;
    const targetPos = new THREE.Vector3(
      OFFSET_X - 6 + subtleX,
      1 + subtleY,
      34
    );
    state.camera.position.lerp(targetPos, 0.003);
    state.camera.lookAt(OFFSET_X - 8, 0, 0);
  });
  return null;
}

// --- Main Export ---
export default function CelestialEngine() {
  const planets: TransitPlanetProps[] = [
    {
      name: "Moon",
      size: 0.5,
      textureMap: "/assets/planets/mercury.png",
      color: "#e8e8f0",
      transitSpeed: 8,
      startHouse: 2,
      planetType: "benefic",
      zLayer: 3.5, // Front layer - Moon moves fastest, most visible
    },
    {
      name: "Mercury",
      size: 0.28,
      textureMap: "/assets/planets/mercury.png",
      color: "#90EE90",
      transitSpeed: 22,
      startHouse: 4,
      planetType: "neutral",
      zLayer: 2.5,
    },
    {
      name: "Venus",
      size: 0.42,
      textureMap: "/assets/planets/venus.png",
      color: "#ff69b4",
      transitSpeed: 28,
      startHouse: 6,
      planetType: "benefic",
      zLayer: 2.0,
    },
    {
      name: "Mars",
      size: 0.38,
      textureMap: "/assets/planets/mars.png",
      color: "#ff4500",
      transitSpeed: 40,
      startHouse: 8,
      planetType: "malefic",
      zLayer: 1.5,
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
      zLayer: 0.5, // Back layer - Saturn moves slowest
    },
  ];

  return (
    <div className="w-full h-full relative pointer-events-none">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[OFFSET_X, 3, 36]} fov={32} />
        <color attach="background" args={["#030308"]} />

        <SteadyCameraRig />

        {/* Lighting */}
        <ambientLight intensity={0.45} />
        <directionalLight
          position={[-10, 15, 10]}
          intensity={1.6}
          color="#ffffff"
        />
        <directionalLight
          position={[10, -5, 5]}
          intensity={0.3}
          color="#c5a059"
        />

        {/* Deep space stars */}
        <Stars
          radius={300}
          depth={80}
          count={4000}
          factor={3}
          saturation={0}
          fade
          speed={0.02}
        />

        <React.Suspense fallback={null}>
          {/* Cosmic dust */}
          <CosmicDust />

          {/* Sacred geometry */}
          <KundaliGrid />

          {/* Central Sun */}
          <VedicSun />

          {/* Main planets */}
          {planets.map((p) => (
            <TransitPlanet key={p.name} {...p} />
          ))}

          {/* Shadow planets (Rahu & Ketu) - retrograde */}
          <ShadowPlanet
            name="Rahu"
            size={0.4}
            color="#6366f1"
            transitSpeed={100}
            startHouse={3}
          />
          <ShadowPlanet
            name="Ketu"
            size={0.35}
            color="#8b5cf6"
            transitSpeed={100}
            startHouse={9}
          />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
