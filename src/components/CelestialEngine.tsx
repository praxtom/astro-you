import { Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { PerspectiveCamera, Sphere, Stars } from "@react-three/drei";
import * as THREE from "three";
import {
  getFocusedPlanetNames,
  getPlanetStoryState,
  type PlanetStoryForceName,
} from "../lib/landing-planet-story";

type BodyPosition = readonly [number, number, number];

interface PlanetDefinition {
  name: Exclude<PlanetStoryForceName, "Sun" | "Rahu" | "Ketu">;
  size: number;
  textureMap?: string;
  position: BodyPosition;
  roughness: number;
  metalness: number;
  hasRings?: boolean;
}

const BODY_POSITIONS: Record<PlanetStoryForceName, BodyPosition> = {
  Sun: [0, 0, 0.3],
  Moon: [4.8, 2.8, -0.2],
  Mars: [-4.5, 3.25, 0.2],
  Mercury: [-1.45, 5.7, 0.65],
  Jupiter: [-5.2, -2.55, -0.15],
  Venus: [-1.25, -5.6, 0.4],
  Saturn: [4.65, -3.2, -0.4],
  Rahu: [7.35, 0.15, 0.45],
  Ketu: [-7.35, -0.15, 0.45],
};

const PLANETS: readonly PlanetDefinition[] = [
  {
    name: "Moon",
    size: 0.56,
    position: BODY_POSITIONS.Moon,
    roughness: 0.96,
    metalness: 0,
  },
  {
    name: "Mars",
    size: 0.42,
    textureMap: "/assets/planets/mars.jpg",
    position: BODY_POSITIONS.Mars,
    roughness: 0.72,
    metalness: 0.05,
  },
  {
    name: "Mercury",
    size: 0.31,
    textureMap: "/assets/planets/mercury.jpg",
    position: BODY_POSITIONS.Mercury,
    roughness: 0.8,
    metalness: 0.06,
  },
  {
    name: "Jupiter",
    size: 0.82,
    textureMap: "/assets/planets/jupiter.jpg",
    position: BODY_POSITIONS.Jupiter,
    roughness: 0.64,
    metalness: 0.04,
  },
  {
    name: "Venus",
    size: 0.48,
    textureMap: "/assets/planets/venus.jpg",
    position: BODY_POSITIONS.Venus,
    roughness: 0.68,
    metalness: 0.08,
  },
  {
    name: "Saturn",
    size: 0.68,
    textureMap: "/assets/planets/saturn.jpg",
    position: BODY_POSITIONS.Saturn,
    roughness: 0.66,
    metalness: 0.08,
    hasRings: true,
  },
] as const;

interface CameraScene {
  position: readonly [number, number, number];
  lookAt: readonly [number, number, number];
}

const CAMERA_SCENES: readonly CameraScene[] = [
  { position: [-1.5, 1, 38], lookAt: [0, 0, 0] },
  { position: [2.2, 1.3, 12], lookAt: [2.2, 1.3, 0] },
  { position: [-3, 4.45, 10.5], lookAt: [-3, 4.45, 0] },
  { position: [-3.2, -4.05, 11], lookAt: [-3.2, -4.05, 0] },
  { position: [4.65, -3.2, 9.5], lookAt: [4.65, -3.2, 0] },
  { position: [0, 0, 18.5], lookAt: [0, 0, 0] },
  { position: [0, 0, 36], lookAt: [0, 0, 0] },
] as const;

function createMoonTexture() {
  const width = 256;
  const height = 128;
  const pixels = new Uint8Array(width * height * 4);
  const craters = [
    { x: 0.18, y: 0.28, radius: 0.09, depth: 34 },
    { x: 0.62, y: 0.43, radius: 0.13, depth: 28 },
    { x: 0.77, y: 0.7, radius: 0.07, depth: 38 },
    { x: 0.39, y: 0.72, radius: 0.055, depth: 25 },
    { x: 0.9, y: 0.24, radius: 0.04, depth: 24 },
  ];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const u = x / width;
      const v = y / height;
      const grain = Math.sin(x * 0.83 + y * 1.71) * 7 + Math.sin(x * 0.19) * 5;
      let shade = 176 + grain;

      for (const crater of craters) {
        const dx = u - crater.x;
        const dy = v - crater.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < crater.radius) {
          const bowl = 1 - distance / crater.radius;
          shade -= bowl * crater.depth;
          if (distance > crater.radius * 0.72) shade += 13;
        }
      }

      const offset = (y * width + x) * 4;
      pixels[offset] = Math.max(0, Math.min(255, shade * 0.93));
      pixels[offset + 1] = Math.max(0, Math.min(255, shade * 0.96));
      pixels[offset + 2] = Math.max(0, Math.min(255, shade));
      pixels[offset + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function CosmicDust() {
  const ref = useRef<THREE.Points>(null!);
  const positions = useMemo(() => {
    const values = new Float32Array(500 * 3);
    for (let index = 0; index < 500; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 5 + Math.random() * 24;
      values[index * 3] = Math.cos(angle) * radius;
      values[index * 3 + 1] = Math.sin(angle) * radius;
      values[index * 3 + 2] = (Math.random() - 0.5) * 13;
    }
    return values;
  }, []);

  useFrame(({ clock }) => {
    ref.current.rotation.z = clock.getElapsedTime() * 0.006;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#d7b66f"
        transparent
        opacity={0.22}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function StoryBody({
  name,
  position,
  isVisible,
  children,
}: {
  name: PlanetStoryForceName;
  position: BodyPosition;
  isVisible: boolean;
  children: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  const phase = useMemo(
    () => name.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0),
    [name],
  );

  useFrame(({ clock }, delta) => {
    const group = ref.current;
    const targetScale = isVisible ? 1 : 0.001;
    const smoothing = 1 - Math.exp(-delta * 6.5);
    const nextScale = THREE.MathUtils.lerp(group.scale.x, targetScale, smoothing);
    group.scale.setScalar(nextScale);
    group.visible = nextScale > 0.008;

    const time = clock.getElapsedTime();
    group.position.set(
      position[0] + Math.sin(time * 0.18 + phase) * 0.06,
      position[1] + Math.cos(time * 0.16 + phase) * 0.06,
      position[2] + Math.sin(time * 0.12 + phase) * 0.04,
    );
    group.rotation.y += delta * (name === "Rahu" || name === "Ketu" ? -0.09 : 0.07);
  });

  return <group ref={ref}>{children}</group>;
}

function SaturnRings({ size }: { size: number }) {
  return (
    <mesh rotation={[Math.PI / 2.45, 0, 0.2]}>
      <ringGeometry args={[size * 1.32, size * 2.05, 64]} />
      <meshBasicMaterial
        color="#d8c6a6"
        transparent
        opacity={0.62}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function TexturedPlanet({
  planet,
  isVisible,
}: {
  planet: PlanetDefinition & { textureMap: string };
  isVisible: boolean;
}) {
  const loadedTexture = useLoader(THREE.TextureLoader, planet.textureMap);
  const texture = useMemo(() => {
    const nextTexture = loadedTexture.clone();
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [loadedTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <StoryBody name={planet.name} position={planet.position} isVisible={isVisible}>
      <Sphere args={[planet.size, 48, 48]}>
        <meshStandardMaterial
          map={texture}
          roughness={planet.roughness}
          metalness={planet.metalness}
        />
      </Sphere>
      {planet.hasRings ? <SaturnRings size={planet.size} /> : null}
    </StoryBody>
  );
}

function Moon({ isVisible }: { isVisible: boolean }) {
  const texture = useMemo(() => createMoonTexture(), []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <StoryBody name="Moon" position={BODY_POSITIONS.Moon} isVisible={isVisible}>
      <Sphere args={[0.56, 48, 48]}>
        <meshStandardMaterial map={texture} roughness={0.98} metalness={0} />
      </Sphere>
    </StoryBody>
  );
}

function VedicSun({ isVisible }: { isVisible: boolean }) {
  const loadedTexture = useLoader(THREE.TextureLoader, "/assets/planets/sun.jpg");
  const texture = useMemo(() => {
    const nextTexture = loadedTexture.clone();
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.needsUpdate = true;
    return nextTexture;
  }, [loadedTexture]);
  const lightRef = useRef<THREE.PointLight>(null!);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    lightRef.current.intensity = THREE.MathUtils.lerp(
      lightRef.current.intensity,
      isVisible ? 3.1 : 0,
      1 - Math.exp(-delta * 5),
    );
  });

  return (
    <StoryBody name="Sun" position={BODY_POSITIONS.Sun} isVisible={isVisible}>
      <Sphere args={[1.28, 56, 56]}>
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#f6b84b"
          emissiveIntensity={0.75}
          toneMapped={false}
        />
      </Sphere>
      <pointLight ref={lightRef} intensity={3.1} distance={70} color="#f8c665" decay={1.8} />
    </StoryBody>
  );
}

function ShadowPlanet({ name, isVisible }: { name: "Rahu" | "Ketu"; isVisible: boolean }) {
  const isRahu = name === "Rahu";
  const size = isRahu ? 0.48 : 0.42;

  return (
    <StoryBody name={name} position={BODY_POSITIONS[name]} isVisible={isVisible}>
      <Sphere args={[size, 36, 36]}>
        <meshStandardMaterial
          color={isRahu ? "#171526" : "#2b1d42"}
          emissive={isRahu ? "#6554a3" : "#8e65bd"}
          emissiveIntensity={0.16}
          roughness={0.96}
          metalness={0.05}
        />
      </Sphere>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[size * 1.45, 0.035, 16, 48]} />
        <meshBasicMaterial
          color={isRahu ? "#7c73c8" : "#b08ad8"}
          transparent
          opacity={0.62}
        />
      </mesh>
    </StoryBody>
  );
}

function KarmicAxis({ isVisible }: { isVisible: boolean }) {
  const ref = useRef<THREE.Group>(null!);

  useFrame((_, delta) => {
    const target = isVisible ? 1 : 0.001;
    const next = THREE.MathUtils.lerp(ref.current.scale.x, target, 1 - Math.exp(-delta * 6));
    ref.current.scale.setScalar(next);
    ref.current.visible = next > 0.008;
  });

  return (
    <group ref={ref} rotation={[0, 0, Math.atan2(0.3, 14.7)]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.018, 0.018, 14.7, 8]} />
        <meshBasicMaterial color="#8874c1" transparent opacity={0.22} />
      </mesh>
      <mesh>
        <ringGeometry args={[2.1, 2.12, 96]} />
        <meshBasicMaterial color="#a38bcf" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function CelestialGeometry() {
  return (
    <group rotation={[0.08, 0.1, 0]}>
      {[4.2, 7.35].map((radius) => (
        <mesh key={radius}>
          <ringGeometry args={[radius, radius + 0.014, 128]} />
          <meshBasicMaterial color="#c9a85f" transparent opacity={0.11} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {[0, Math.PI / 3, (Math.PI * 2) / 3].map((rotation) => (
        <mesh key={rotation} rotation={[0, 0, rotation]}>
          <planeGeometry args={[14.7, 0.012]} />
          <meshBasicMaterial color="#c9a85f" transparent opacity={0.055} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

function ScrollyCameraRig({ progress }: { progress: number }) {
  const currentLookAt = useRef(new THREE.Vector3());

  useFrame((state, delta) => {
    const story = getPlanetStoryState(progress);
    const start = CAMERA_SCENES[story.fromIndex];
    const end = CAMERA_SCENES[story.toIndex];
    const eased = THREE.MathUtils.smoothstep(story.transitionProgress, 0, 1);
    const desiredPosition = new THREE.Vector3(...start.position).lerp(
      new THREE.Vector3(...end.position),
      eased,
    );
    const desiredLookAt = new THREE.Vector3(...start.lookAt).lerp(
      new THREE.Vector3(...end.lookAt),
      eased,
    );

    const time = state.clock.getElapsedTime();
    desiredPosition.x += Math.sin(time * 0.1) * 0.12;
    desiredPosition.y += Math.cos(time * 0.12) * 0.1;

    const smoothing = 1 - Math.exp(-delta * 4.5);
    state.camera.position.lerp(desiredPosition, smoothing);
    currentLookAt.current.lerp(desiredLookAt, smoothing);
    state.camera.up.set(0, 1, 0);
    state.camera.lookAt(currentLookAt.current);
  });

  return null;
}

function NarrativeLighting({ progress }: { progress: number }) {
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const keyRef = useRef<THREE.DirectionalLight>(null!);

  useFrame((_, delta) => {
    const { activeChapter } = getPlanetStoryState(progress);
    const isWideScene = activeChapter.id === "moving-sky" || activeChapter.id === "synthesis";
    const ambientTarget = isWideScene ? 0.52 : 0.24;
    const smoothing = 1 - Math.exp(-delta * 4);
    ambientRef.current.intensity = THREE.MathUtils.lerp(
      ambientRef.current.intensity,
      ambientTarget,
      smoothing,
    );
    keyRef.current.intensity = THREE.MathUtils.lerp(
      keyRef.current.intensity,
      isWideScene ? 1.45 : 1.1,
      smoothing,
    );
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.52} />
      <directionalLight ref={keyRef} position={[-8, 12, 10]} intensity={1.45} color="#ffffff" />
      <directionalLight position={[10, -6, 6]} intensity={0.36} color="#d0ad67" />
    </>
  );
}

function PlanetSystem({ progress }: { progress: number }) {
  const focusedNames = getFocusedPlanetNames(progress);
  const isFocused = (name: PlanetStoryForceName) => focusedNames.includes(name);
  const { activeChapter } = getPlanetStoryState(progress);
  const showAxis = activeChapter.id === "karmic-axis" || activeChapter.id === "synthesis";

  return (
    <>
      <CelestialGeometry />
      <KarmicAxis isVisible={showAxis} />
      <VedicSun isVisible={isFocused("Sun")} />
      <Moon isVisible={isFocused("Moon")} />
      {PLANETS.filter(
        (planet): planet is PlanetDefinition & { textureMap: string } => Boolean(planet.textureMap),
      ).map((planet) => (
        <TexturedPlanet key={planet.name} planet={planet} isVisible={isFocused(planet.name)} />
      ))}
      <ShadowPlanet name="Rahu" isVisible={isFocused("Rahu")} />
      <ShadowPlanet name="Ketu" isVisible={isFocused("Ketu")} />
    </>
  );
}

export default function CelestialEngine({ progress = 0 }: { progress?: number }) {
  return (
    <div className="relative h-full w-full pointer-events-none">
      <Canvas
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <PerspectiveCamera makeDefault position={[0, 1, 42]} fov={34} />
        <color attach="background" args={["#030308"]} />
        <ScrollyCameraRig progress={progress} />
        <NarrativeLighting progress={progress} />
        <Stars
          radius={260}
          depth={90}
          count={4200}
          factor={0.72}
          saturation={0}
          fade
          speed={0.008}
        />
        <CosmicDust />
        <Suspense fallback={null}>
          <PlanetSystem progress={progress} />
        </Suspense>
      </Canvas>
    </div>
  );
}
