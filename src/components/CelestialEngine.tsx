import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars, PerspectiveCamera, Sphere, Line } from "@react-three/drei";
import * as THREE from "three";
import * as React from "react";

// --- Types & Constants ---
type Phase = "IDLE" | "ALIGNING" | "AWAKING" | "EYE_OPEN";

const OFFSET_X = 25; // Significantly pushed right for clear hero text

const HOUSE_COORDS = [
  [0, 0], // House 1 (Central Diamond - Lagna)
  [-4, 4], // House 2
  [-8, 0], // House 3
  [-4, -4], // House 4
  [0, -8], // House 5
  [4, -4], // House 6
  [8, 0], // House 7
  [4, 4], // House 8
  [0, 8], // House 9
  [-4, 4], // House 10
  [-2, 6], // House 11
  [2, 6], // House 12
].map(([x, y]) => new THREE.Vector3(x + OFFSET_X, y, 0));

interface PlanetProps {
  name: string;
  radius: number;
  speed: number;
  size: number;
  offset: number;
  textureMap: string;
  color: string;
  phase: Phase;
}

// --- Components ---

function KundaliGrid({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null!);

  useFrame(({ clock }) => {
    const targetOpacity = active ? 0.3 : 0.03;
    ref.current.children.forEach((child) => {
      if ((child as any).material) {
        (child as any).material.opacity = THREE.MathUtils.lerp(
          (child as any).material.opacity,
          targetOpacity,
          0.02
        );
      }
    });
    ref.current.position.y = Math.sin(clock.getElapsedTime() * 0.4) * 0.15;
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

  return (
    <group ref={ref} position={[OFFSET_X, 0, -1]}>
      {lines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color="#FFD700"
          lineWidth={0.8}
          transparent
          opacity={0.03}
        />
      ))}
    </group>
  );
}

function PlanetAura({
  size,
  color,
  phase,
}: {
  size: number;
  color: string;
  phase: Phase;
}) {
  const ref = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulseScale =
      phase === "AWAKING" || phase === "EYE_OPEN"
        ? 1.6 + Math.sin(t * 2.5) * 0.1
        : 1.3 + Math.sin(t * 1.2) * 0.05;
    ref.current.scale.setScalar(pulseScale);

    if (ref.current.material instanceof THREE.MeshStandardMaterial) {
      ref.current.material.opacity =
        (phase === "IDLE" ? 0.1 : 0.35) + Math.sin(t * 1.5) * 0.08;
    }
  });

  return (
    <Sphere ref={ref} args={[size, 32, 32]}>
      <meshStandardMaterial
        color={color}
        transparent
        opacity={0.25}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </Sphere>
  );
}

function SymbolicPlanet({
  name,
  radius,
  speed,
  size,
  offset,
  textureMap,
  color,
  phase,
}: PlanetProps) {
  const meshRef = useRef<THREE.Group>(null!);
  const texture = useLoader(THREE.TextureLoader, textureMap);
  const noiseOffset = useMemo(() => Math.random() * 10, []);

  // Initialize position in orbit to prevent spawning at (0,0,0)
  const initialPos = useMemo(() => {
    const orbitTime = offset; // t=0
    return new THREE.Vector3(
      Math.cos(orbitTime) * radius + OFFSET_X,
      0,
      Math.sin(orbitTime) * radius
    );
  }, [radius, offset]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const orbitTime = t * speed * 0.08 + offset;

    const organicRadius = radius + Math.sin(t * 0.5 + noiseOffset) * 0.5;
    const breathingY = Math.sin(t * 0.3 + noiseOffset) * 0.6;

    const targetPos = new THREE.Vector3();

    if (phase === "IDLE") {
      targetPos.set(
        Math.cos(orbitTime) * organicRadius + OFFSET_X,
        breathingY,
        Math.sin(orbitTime) * organicRadius
      );
    } else {
      const housePos = HOUSE_COORDS[offset % 12];
      targetPos.copy(housePos);
      targetPos.z = 3;
    }

    // Smooth, slow drift (0.01)
    meshRef.current.position.lerp(targetPos, 0.01);
    meshRef.current.rotation.y += 0.003;
  });

  return (
    <group ref={meshRef} position={initialPos}>
      <Sphere args={[size, 64, 64]}>
        <meshStandardMaterial map={texture} roughness={0.6} metalness={0.3} />
      </Sphere>
      <PlanetAura size={size} color={color} phase={phase} />
    </group>
  );
}

function CosmicEye({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null!);
  const pupilRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    const targetScale = active ? 1 : 0;
    ref.current.scale.setScalar(
      THREE.MathUtils.lerp(ref.current.scale.x, targetScale, 0.015)
    );

    if (active) {
      pupilRef.current.scale.setScalar(
        1 + Math.sin(clock.getElapsedTime() * 3) * 0.1
      );
    }
  });

  return (
    <group ref={ref} position={[OFFSET_X, 0, 8]} scale={0}>
      {/* Eye Shape */}
      <group>
        <mesh position={[0, 1.3, 0]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[3.8, 0.015, 16, 100, Math.PI]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.4} />
        </mesh>
        <mesh position={[0, -1.3, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[3.8, 0.015, 16, 100, Math.PI]} />
          <meshBasicMaterial color="#FFD700" transparent opacity={0.4} />
        </mesh>
      </group>
      <Sphere ref={pupilRef} args={[0.7, 32, 32]}>
        <meshStandardMaterial
          color="#1a0030"
          emissive="#FFD700"
          emissiveIntensity={3}
          toneMapped={false}
        />
      </Sphere>
      <pointLight intensity={4} color="#FFD700" distance={20} />
    </group>
  );
}

function StoryRig({ phase }: { phase: Phase }) {
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const zoom = Math.sin(t * 0.25) * 1.5;

    let targetPos = new THREE.Vector3(OFFSET_X - 2, 12, 45); // Broader view

    if (phase === "ALIGNING" || phase === "AWAKING") {
      targetPos.set(OFFSET_X, 0, 50);
    } else if (phase === "EYE_OPEN") {
      targetPos.set(OFFSET_X, 0, 42);
    }

    targetPos.z += zoom;
    state.camera.position.lerp(targetPos, 0.01);

    // Look at a point to the LEFT of the system to push it to the RIGHT of the frame
    state.camera.lookAt(OFFSET_X - 12, 0, 0);
  });
  return null;
}

function RealisticSun({ phase }: { phase: Phase }) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const texture = useLoader(THREE.TextureLoader, "/assets/planets/sun.png");

  useFrame(() => {
    meshRef.current.rotation.y -= 0.0015;
  });

  return (
    <group position={[OFFSET_X, 0, 0]}>
      <Sphere ref={meshRef} args={[1.8, 64, 64]}>
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#FFD700"
          emissiveIntensity={phase === "IDLE" ? 0.8 : 1.5} // Lower to let texture show
          toneMapped={false}
        />
      </Sphere>
      <pointLight intensity={5} distance={100} color="#FFD700" decay={1.5} />
    </group>
  );
}

export default function CelestialEngine() {
  const [phase, setPhase] = useState<Phase>("IDLE");

  useEffect(() => {
    const sequence: Phase[] = ["IDLE", "ALIGNING", "AWAKING", "EYE_OPEN"];
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % sequence.length;
      setPhase(sequence[i]);
    }, 12000); // Longer ritual cycle for calm power
    return () => clearInterval(interval);
  }, []);

  const planets = [
    {
      name: "Mercury",
      radius: 6,
      speed: 1.4,
      size: 0.25,
      offset: 0,
      textureMap: "/assets/planets/mercury.png",
      color: "#ffcc00",
    },
    {
      name: "Venus",
      radius: 9,
      speed: 1.1,
      size: 0.45,
      offset: 1,
      textureMap: "/assets/planets/venus.png",
      color: "#ffae42",
    },
    {
      name: "Earth",
      radius: 13,
      speed: 0.9,
      size: 0.55,
      offset: 2,
      textureMap: "/assets/planets/earth.png",
      color: "#00ccff",
    },
    {
      name: "Mars",
      radius: 17,
      speed: 0.7,
      size: 0.35,
      offset: 3,
      textureMap: "/assets/planets/mars.png",
      color: "#ff4500",
    },
    {
      name: "Jupiter",
      radius: 23,
      speed: 0.4,
      size: 1.2,
      offset: 4,
      textureMap: "/assets/planets/jupiter.png",
      color: "#d2b48c",
    },
    {
      name: "Saturn",
      radius: 30,
      speed: 0.2,
      size: 1.0,
      offset: 5,
      textureMap: "/assets/planets/saturn.png",
      color: "#f0e68c",
    },
  ];

  return (
    <div className="w-full h-full relative pointer-events-none">
      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[OFFSET_X, 10, 45]} fov={35} />
        <color attach="background" args={["#010103"]} />

        <StoryRig phase={phase} />

        {/* Brightened Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight
          position={[-10, 20, 10]}
          intensity={2.5}
          color="#ffffff"
        />

        <Stars
          radius={200}
          depth={50}
          count={9000}
          factor={6}
          saturation={0}
          fade
          speed={0.1}
        />

        <React.Suspense fallback={null}>
          <RealisticSun phase={phase} />
          <KundaliGrid active={phase !== "IDLE"} />
          {planets.map((p) => (
            <SymbolicPlanet key={p.name} {...p} phase={phase} />
          ))}
          <CosmicEye active={phase === "EYE_OPEN"} />
        </React.Suspense>
      </Canvas>
    </div>
  );
}
