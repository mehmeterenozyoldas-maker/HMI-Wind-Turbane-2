import React, { useMemo, useRef, useLayoutEffect, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Instances,
  Instance,
  CatmullRomLine,
  Float,
  Stars,
  useCursor,
  Environment,
  Grid
} from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer, Bloom, DepthOfField, Vignette, Noise, Scanline } from '@react-three/postprocessing';
import { TowerData, TimeOption, SeasonOption } from '../types';
import { GestureController } from './GestureController';

// --- Constants ---
const TERRAIN_SIZE = { width: 420, height: 260 };
const TERRAIN_SEGMENTS = { x: 120, y: 80 };
const TURBINE_COUNT = 60;
const SOLAR_COUNT = 400;
const CYCLE_DURATION = 60; // seconds per day

// --- Helper Functions ---
function terrainHeightFn(x: number, z: number) {
  const s = 0.018;
  const h1 = Math.sin(x * s) * 22 + Math.cos(z * s) * 18;
  const h2 = Math.sin((x + z) * s * 0.6) * 12;
  const h3 = Math.cos((x - z) * s * 0.35) * 8;
  const h = h1 + h2 + h3;
  return h * 0.7;
}

// Procedural Noise Texture Generator
function createNoiseTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Base background
  ctx.fillStyle = '#808080'; // Middle grey
  ctx.fillRect(0, 0, size, size);

  // Add noise
  for (let i = 0; i < 60000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const gray = Math.random() * 100 + 100; // Varying shades
    const opacity = Math.random() * 0.15;
    ctx.fillStyle = `rgba(${gray}, ${gray}, ${gray}, ${opacity})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(8, 6);
  return texture;
}

function useCityData() {
  return useMemo(() => {
    const turbines: TowerData[] = [];
    const clusters = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(-80, 40),
      new THREE.Vector2(90, -20),
      new THREE.Vector2(40, 70)
    ];

    // Generate Turbines
    for (let i = 0; i < TURBINE_COUNT; i++) {
      const cluster = clusters[Math.floor(Math.random() * clusters.length)];
      const jitter = 20 + Math.random() * 50;
      const angle = Math.random() * Math.PI * 2;
      const px = cluster.x + Math.cos(angle) * jitter;
      const pz = cluster.y + Math.sin(angle) * jitter;
      
      const hFactor = 0.4 + Math.random() * Math.random() * 1.5;
      const terrainY = terrainHeightFn(px, pz);
      const height = 15 + hFactor * 15; // Taller for turbines
      
      turbines.push({
        id: i,
        position: new THREE.Vector3(px, terrainY, pz),
        baseY: terrainY,
        height: height,
        value: Math.round(hFactor * 100),
        color: new THREE.Color().setHSL(Math.random() * 0.1 + 0.5, 0.2, 0.8)
      });
    }

    // Find highest as hub
    const hub = turbines.length > 0 
      ? turbines.reduce((prev, current) => (prev.height > current.height) ? prev : current)
      : null;

    // Generate Solar Panels positions (avoiding turbines)
    const solarPositions: THREE.Vector3[] = [];
    const solarRotations: THREE.Euler[] = [];
    
    for (let i = 0; i < SOLAR_COUNT; i++) {
        let sx, sz, sy;
        let valid = false;
        let attempts = 0;

        while (!valid && attempts < 10) {
            sx = (Math.random() - 0.5) * TERRAIN_SIZE.width * 0.8;
            sz = (Math.random() - 0.5) * TERRAIN_SIZE.height * 0.8;
            
            // Check distance to turbines
            let tooClose = false;
            for (const t of turbines) {
                const dist = Math.sqrt(Math.pow(sx - t.position.x, 2) + Math.pow(sz - t.position.z, 2));
                if (dist < 15) { // 15 unit radius clearance around turbines
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) valid = true;
            attempts++;
        }

        if (valid && sx !== undefined && sz !== undefined) {
            sy = terrainHeightFn(sx, sz);
            solarPositions.push(new THREE.Vector3(sx, sy, sz));
            
            // Orient somewhat towards south/up
            solarRotations.push(new THREE.Euler(
                -Math.PI / 2 - 0.2 + (Math.random() * 0.1), // Tilt 
                0, 
                (Math.random() - 0.5) * 0.5
            ));
        }
    }

    return { turbines, hub, solarPositions, solarRotations };
  }, []);
}

// --- Components ---

interface DayNightCycleProps {
    timeOption: TimeOption;
    season: SeasonOption;
}

const DayNightCycle: React.FC<DayNightCycleProps> = ({ timeOption, season }) => {
  const { scene } = useThree();
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const starsRef = useRef<THREE.Group>(null);
  const accent1Ref = useRef<THREE.PointLight>(null);
  const accent2Ref = useRef<THREE.PointLight>(null);

  // Generate Season Palette
  const colors = useMemo(() => {
    let dayBg, fogDay, sunDay;

    switch (season) {
        case 'Winter':
            dayBg = new THREE.Color('#8da3b9'); // Cold blue-grey
            fogDay = new THREE.Color('#8da3b9');
            sunDay = new THREE.Color('#e0f2fe'); // Icy white
            break;
        case 'Summer':
            dayBg = new THREE.Color('#4fa1c6'); // Clear vibrant sky
            fogDay = new THREE.Color('#7dd3fc');
            sunDay = new THREE.Color('#fff7ed'); // Warm yellowish white
            break;
        case 'Autumn':
            dayBg = new THREE.Color('#9f7868'); // Muted brownish sky
            fogDay = new THREE.Color('#c2a08e');
            sunDay = new THREE.Color('#fff1d0'); // Golden hour feel
            break;
        case 'Spring':
        default:
            dayBg = new THREE.Color('#5a6e85'); // Muted slate blue
            fogDay = new THREE.Color('#5a6e85');
            sunDay = new THREE.Color('#fffce6'); // Neutral white
            break;
    }

    return {
      nightBg: new THREE.Color('#020408'),
      dawnBg: new THREE.Color('#2a2438'),
      duskBg: new THREE.Color('#5e3838'),
      
      dayBg, 
      fogNight: new THREE.Color('#020408'),
      fogDay,
      
      sunDay,
      sunDawn: new THREE.Color('#ffaa00'),
    };
  }, [season]);

  // Initialize background/fog
  useLayoutEffect(() => {
    scene.background = colors.nightBg.clone();
    scene.fog = new THREE.Fog(colors.nightBg, 80, 450);
  }, [scene, colors]);

  useFrame(({ clock }) => {
    // Determine Time
    let time = 0;
    
    if (timeOption === 'Auto') {
        time = (clock.elapsedTime % CYCLE_DURATION) / CYCLE_DURATION; // 0 to 1
    } else {
        switch (timeOption) {
            case 'Dawn': time = 0.25; break;
            case 'Noon': time = 0.5; break;
            case 'Dusk': time = 0.75; break;
            case 'Midnight': time = 0.0; break;
            default: time = 0.5;
        }
    }
    
    // 0.25 = sunrise, 0.5 = noon, 0.75 = sunset, 0/1 = midnight
    const sunAngle = (time * Math.PI * 2) - (Math.PI / 2);
    
    // Sun Position Orbit
    const radius = 300;
    const sunX = Math.cos(sunAngle) * radius;
    const sunY = Math.sin(sunAngle) * radius;
    const sunZ = Math.cos(sunAngle * 0.5) * 80; // Slight orbital wobble

    // Intensities based on Sun Height
    const sunHeight = Math.sin(sunAngle); // -1 to 1
    const dayIntensity = THREE.MathUtils.clamp(sunHeight, 0, 1);
    
    // Update Directional Light (Sun)
    if (dirLightRef.current) {
      dirLightRef.current.position.set(sunX, sunY, sunZ);
      dirLightRef.current.intensity = dayIntensity * 1.8;
      
      // Color: Warm at horizon, White at zenith
      if (dayIntensity < 0.3) {
        dirLightRef.current.color.lerpColors(colors.sunDawn, colors.sunDay, dayIntensity / 0.3);
      } else {
        dirLightRef.current.color.copy(colors.sunDay);
      }
    }

    // Update Ambient & Hemi Lights
    if (ambientRef.current) {
      // Winter has higher ambient due to snow reflection
      const seasonBoost = season === 'Winter' ? 0.2 : 0;
      ambientRef.current.intensity = 0.05 + seasonBoost + (dayIntensity * 0.4);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.1 + (dayIntensity * 0.5);
    }

    // Update Stars (Visible at night)
    if (starsRef.current) {
      starsRef.current.visible = dayIntensity < 0.1;
    }

    // Update City Lights (Accents) - brighter at night
    const cityLightIntensity = 1 + (1 - dayIntensity) * 2;
    if (accent1Ref.current) accent1Ref.current.intensity = cityLightIntensity;
    if (accent2Ref.current) accent2Ref.current.intensity = cityLightIntensity;

    // Atmosphere Interpolation (Background & Fog)
    let targetColor = colors.nightBg;
    if (sunHeight > 0.1) targetColor = colors.dayBg;
    else if (sunHeight > -0.2) targetColor = colors.dawnBg; // Twilight

    // Smooth LERP for background colors
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(targetColor, 0.05);
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.lerp(targetColor, 0.05);
    }

  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.1} color={season === 'Winter' ? "#dbeafe" : "#b0b7c4"} />
      
      <directionalLight 
        ref={dirLightRef}
        castShadow 
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
      >
        <orthographicCamera attach="shadow-camera" args={[-250, 250, 250, -250, 10, 800]} />
      </directionalLight>

      {/* Cyberpunk/Street accents */}
      <pointLight ref={accent1Ref} position={[-100, 60, -50]} color="#00ffcc" distance={400} decay={2} intensity={1} />
      <pointLight ref={accent2Ref} position={[100, 60, 50]} color="#00aaff" distance={400} decay={2} intensity={1} />
      
      <hemisphereLight ref={hemiRef} args={['#202530', '#101216', 0.2]} />
      
      <group ref={starsRef}>
        <Stars radius={300} depth={50} count={5000} factor={4} saturation={0} fade speed={0.5} />
      </group>
    </>
  );
};

const PostEffects = () => {
  return (
    <EffectComposer disableNormalPass multisampling={4}>
      <Bloom 
        luminanceThreshold={0.2} 
        mipmapBlur 
        intensity={1.2} 
        radius={0.6}
      />
      <DepthOfField 
        focusDistance={0.025} 
        focalLength={0.05} 
        bokehScale={2} 
        height={480} 
      />
      <Noise opacity={0.03} />
      <Scanline density={1.5} opacity={0.05} />
      <Vignette eskil={false} offset={0.1} darkness={0.6} />
    </EffectComposer>
  );
};

const Terrain = ({ season }: { season: SeasonOption }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create noise texture once
  const noiseTexture = useMemo(() => createNoiseTexture(), []);

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE.width, 
      TERRAIN_SIZE.height, 
      TERRAIN_SEGMENTS.x, 
      TERRAIN_SEGMENTS.y
    );
    
    const count = geo.attributes.position.count;
    const colorsArr = new Float32Array(count * 3);
    const pos = geo.attributes.position;
    const color = new THREE.Color();
    
    // Theme colors based on Season
    let baseHex, peakHex;
    switch (season) {
        case 'Winter':
            baseHex = '#cbd5e1'; // Light grey/snow
            peakHex = '#f8fafc'; // White snow
            break;
        case 'Autumn':
            baseHex = '#78350f'; // Dark wood
            peakHex = '#d97706'; // Orange/Gold
            break;
        case 'Summer':
            baseHex = '#14532d'; // Deep green
            peakHex = '#84cc16'; // Lime green
            break;
        case 'Spring':
        default:
            baseHex = '#0f172a'; // Dark slate (Original Sci-Fi Look)
            peakHex = '#1e293b'; 
            break;
    }

    const baseColor = new THREE.Color(baseHex); 
    const peakColor = new THREE.Color(peakHex);

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      
      const h = terrainHeightFn(x, y); 
      pos.setZ(i, h);
      
      const t = THREE.MathUtils.clamp((h + 20) / 60, 0, 1);
      color.copy(baseColor).lerp(peakColor, t);
      colorsArr[i * 3] = color.r;
      colorsArr[i * 3 + 1] = color.g;
      colorsArr[i * 3 + 2] = color.b;
    }
    
    geo.computeVertexNormals();
    
    // Set colors attribute directly on geometry
    geo.setAttribute('color', new THREE.BufferAttribute(colorsArr, 3));
    
    return geo;
  }, [season]); // Regenerate when season changes

  return (
    <group>
      <mesh 
        ref={meshRef} 
        geometry={geometry}
        rotation={[-Math.PI / 2, 0, 0]} 
        receiveShadow
      >
        <meshPhysicalMaterial 
          vertexColors 
          roughness={0.6} 
          metalness={0.4}
          clearcoat={0.3}
          map={noiseTexture}
          bumpMap={noiseTexture}
          bumpScale={0.2}
          roughnessMap={noiseTexture}
        />
      </mesh>
      
      {/* Digital Twin Grid Overlay */}
      <Grid 
        position={[0, 0.1, 0]} 
        args={[TERRAIN_SIZE.width, TERRAIN_SIZE.height]} 
        cellSize={10} 
        cellThickness={1} 
        cellColor="#00ffff" 
        sectionSize={50} 
        sectionThickness={1.5} 
        sectionColor="#0088ff" 
        fadeDistance={200} 
        fadeStrength={1} 
        followCamera={false}
        infiniteGrid={true}
      />
    </group>
  );
};

// --- Individual Wind Turbine ---
interface WindTurbineProps {
    data: TowerData;
    isSelected: boolean;
    onHover: (id: number | null) => void;
    onSelect: (data: TowerData) => void;
    timeOption: TimeOption;
}

const WindTurbine: React.FC<WindTurbineProps> = ({ 
    data, 
    isSelected, 
    onHover, 
    onSelect,
    timeOption
}) => {
    const bladesRef = useRef<THREE.Group>(null);
    const lightRef = useRef<THREE.PointLight>(null);
    const bulbRef = useRef<THREE.Mesh>(null);
    const bladeMeshesRef = useRef<(THREE.Group | null)[]>([]); // To animate individual blades
    const [hovered, setHover] = useState(false);
    useCursor(hovered);

    // Geometry parameters based on height
    const bladeLen = data.height * 0.45; 
    const towerTopR = 0.35;
    const towerBottomR = 0.9;

    // Rotation & Light Animation
    useFrame((state, delta) => {
        // Wind Dynamics: Gusts and Aero-elasticity
        const time = state.clock.elapsedTime;
        
        // Varying wind speed (Gusts)
        const windNoise = Math.sin(time * 0.5 + data.id) * 0.5 + Math.sin(time * 2.1) * 0.2; 
        const baseSpeed = 1 + data.value * 0.03;
        const currentSpeed = baseSpeed + (windNoise * 0.2);

        if (bladesRef.current) {
            bladesRef.current.rotation.z -= delta * currentSpeed; 
        }

        // Blade Flex (Aero-elastic flutter)
        bladeMeshesRef.current.forEach((blade, i) => {
            if (blade) {
                // High frequency flutter (vibration) + Load based flex
                const flutter = Math.sin(time * 20 + i) * 0.01; 
                // Flex back based on speed (simulating wind load)
                const flex = currentSpeed * 0.05; 
                // Apply rotation to X axis (assuming local Y is length) to simulate bending
                blade.rotation.x = 0.15 + flex + flutter; // 0.15 is base pitch
            }
        });

        // Night Aviation Light Logic
        let cycleTime = 0;
        if (timeOption === 'Auto') {
            cycleTime = (state.clock.elapsedTime % CYCLE_DURATION) / CYCLE_DURATION;
        } else {
            // Map fixed options to cycle time
            if (timeOption === 'Dawn') cycleTime = 0.25;
            else if (timeOption === 'Noon') cycleTime = 0.5;
            else if (timeOption === 'Dusk') cycleTime = 0.75;
            else if (timeOption === 'Midnight') cycleTime = 0.0;
        }

        const sunAngle = (cycleTime * Math.PI * 2) - (Math.PI / 2);
        const sunHeight = Math.sin(sunAngle);
        
        // Active only when sun is effectively down (dusk/night/dawn)
        const isNight = 1 - THREE.MathUtils.smoothstep(sunHeight, -0.2, 0.1);
        
        if (isNight > 0) {
            // Aviation Strobe Pattern (Red)
            const t = state.clock.elapsedTime + (data.id * 0.05);
            const period = 1.5;
            const blinkDuration = 0.2;
            
            const phase = t % period;
            const isBlink = phase < blinkDuration;

            const intensity = isBlink ? 8.0 : 0;
            const finalIntensity = intensity * isNight;

            if (lightRef.current) {
                lightRef.current.intensity = finalIntensity;
            }

            if (bulbRef.current && bulbRef.current.material instanceof THREE.MeshStandardMaterial) {
                bulbRef.current.material.emissiveIntensity = finalIntensity;
                bulbRef.current.material.emissive.setHex(0xff0000);
                bulbRef.current.material.color.setHex(0x000000); // Black bulb when off
            }
        } else {
            // Day State: Light Off
            if (lightRef.current) lightRef.current.intensity = 0;
            
            if (bulbRef.current && bulbRef.current.material instanceof THREE.MeshStandardMaterial) {
                bulbRef.current.material.emissiveIntensity = 0;
                bulbRef.current.material.color.setHex(0x220000); // Dark red physical bulb housing
            }
        }
    });

    const glowColor = isSelected ? "#ffaa00" : (hovered ? "#00ffff" : "#445566");
    
    return (
        <group 
            position={data.position} 
            onClick={(e) => { e.stopPropagation(); onSelect(data); }}
            onPointerOver={(e) => { e.stopPropagation(); onHover(data.id); setHover(true); }}
            onPointerOut={(e) => { onHover(null); setHover(false); }}
            userData={{ isTurbine: true, id: data.id }} // CRITICAL for Raycasting
        >
            {/* Tapered Tower Pole */}
            <mesh position={[0, data.height / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[towerTopR, towerBottomR, data.height, 32]} />
                <meshPhysicalMaterial color="#e2e8f0" roughness={0.2} metalness={0.8} clearcoat={1.0} />
            </mesh>

            {/* Base Foundation */}
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[towerBottomR + 0.4, towerBottomR + 0.6, 1, 32]} />
              <meshPhysicalMaterial color="#64748b" roughness={0.5} metalness={0.5} />
            </mesh>

            {/* Nacelle & Rotor Group */}
            <group position={[0, data.height, 0]}>
                
                {/* Main Nacelle Housing (Aerodynamic Capsule shape) */}
                <group position={[0, 0, 0.5]} rotation={[0, 0, 0]}>
                    {/* Main Body */}
                    <mesh position={[0, 0, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
                         <cylinderGeometry args={[0.75, 0.8, 2.5, 32]} />
                         <meshPhysicalMaterial color="#cbd5e1" roughness={0.1} metalness={0.9} clearcoat={1.0} />
                    </mesh>
                    {/* Rounded Back */}
                    <mesh position={[0, 0, -1.25]} castShadow>
                         <sphereGeometry args={[0.79, 32, 32]} />
                         <meshPhysicalMaterial color="#cbd5e1" roughness={0.1} metalness={0.9} clearcoat={1.0} />
                    </mesh>
                    {/* Top Detail (Generator/Cooling) */}
                    <mesh position={[0, 0.7, -0.5]} castShadow>
                        <boxGeometry args={[0.8, 0.4, 1.2]} />
                        <meshPhysicalMaterial color="#94a3b8" roughness={0.4} metalness={0.6} />
                    </mesh>
                </group>

                {/* Selection Glow Ring */}
                <mesh position={[0, 0, 0]}>
                    <ringGeometry args={[0.85, 0.95, 32]} />
                    <meshBasicMaterial color={glowColor} toneMapped={false} side={THREE.DoubleSide} />
                </mesh>

                {/* Aviation Light Stem & Bulb */}
                <group position={[0, 0.9, -1]}>
                    <mesh position={[0, -0.1, 0]}>
                        <cylinderGeometry args={[0.05, 0.05, 0.2, 8]} />
                        <meshStandardMaterial color="#333" />
                    </mesh>
                    <mesh ref={bulbRef} position={[0, 0.1, 0]}>
                       <sphereGeometry args={[0.12, 8, 8]} />
                       <meshStandardMaterial 
                          color="#220000" 
                          emissive="#ff0000" 
                          emissiveIntensity={0} 
                          toneMapped={false}
                       />
                    </mesh>
                    <pointLight 
                      ref={lightRef}
                      color="#ff0000"
                      distance={40}
                      decay={2}
                      position={[0, 0.2, 0]}
                    />
                </group>

                {/* Rotating Hub & Blades */}
                <group position={[0, 0, 1.8]} ref={bladesRef}>
                    {/* Spinner (Nose Cone) */}
                    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} castShadow>
                         {/* Smoothed cone */}
                        <cylinderGeometry args={[0.1, 0.8, 1.2, 32]} /> 
                        <meshPhysicalMaterial color="#cbd5e1" roughness={0.1} metalness={0.9} clearcoat={1.0} />
                    </mesh>
                    {/* Cap for spinner */}
                    <mesh position={[0, 0, 0.8]}>
                        <sphereGeometry args={[0.1, 16, 16]} />
                        <meshPhysicalMaterial color="#cbd5e1" roughness={0.1} metalness={0.9} clearcoat={1.0} />
                    </mesh>

                    {/* Blades */}
                    {[0, 1, 2].map((i) => (
                        <group key={i} rotation={[0, 0, i * (Math.PI * 2) / 3]}>
                            {/* Pivot Correction: Move blade out so root starts at center */}
                            <group 
                                ref={(el) => { bladeMeshesRef.current[i] = el; }}
                                position={[0, bladeLen / 2 + 0.6, 0]} 
                                rotation={[0.15, 0, 0]} // Initial pitch (now controlled by useFrame)
                            > 
                                {/* 
                                    Blade Geometry: 
                                    Using a flattened cylinder to simulate an airfoil shape.
                                    Tapered: Tip (0.08) -> Root (0.45)
                                    Flattened via Scale: Wide X, Thin Z.
                                */}
                                <mesh castShadow scale={[1, 1, 0.15]} rotation={[0, 0.15, 0]}>
                                    <cylinderGeometry args={[0.08, 0.45, bladeLen, 32]} />
                                    <meshPhysicalMaterial color="#f1f5f9" roughness={0.2} metalness={0.3} clearcoat={0.5} />
                                </mesh>
                            </group>
                        </group>
                    ))}
                </group>
            </group>
        </group>
    );
};

// --- Solar Fields ---
const SolarFields = ({ positions, rotations }: { positions: THREE.Vector3[], rotations: THREE.Euler[] }) => {
    return (
        <Instances range={positions.length} receiveShadow castShadow>
            <boxGeometry args={[2.5, 0.1, 4]} />
            <meshPhysicalMaterial 
                color="#020617" 
                roughness={0.05} 
                metalness={1.0} 
                clearcoat={1.0}
                emissive="#0ea5e9"
                emissiveIntensity={0.1}
            />
            {positions.map((pos, i) => (
                <Instance 
                    key={i} 
                    position={pos} 
                    rotation={rotations[i]} 
                />
            ))}
        </Instances>
    );
};

// --- Interactive Flow Lines ---

const EnergyPacket = ({ curve, color, visible }: { curve: THREE.CatmullRomCurve3, color: string, visible: boolean }) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const tempVec = useRef(new THREE.Vector3()); // Use temp vec to avoid mutating read-only props if any
    
    useFrame((state) => {
        if (!meshRef.current || !visible || !curve) return;
        // Move along curve
        const t = (state.clock.elapsedTime * 0.8) % 1; 
        
        // Safety check if curve is valid
        if(curve.points && curve.points.length > 1 && meshRef.current) {
             const p = tempVec.current;
             curve.getPoint(t, p);
             meshRef.current.position.copy(p);
        }
    });

    if (!visible) return null;

    return (
        <mesh ref={meshRef}>
            <sphereGeometry args={[1.2, 16, 16]} />
            <meshBasicMaterial color={color} toneMapped={false} />
            <pointLight distance={15} decay={2} color={color} intensity={2} />
        </mesh>
    );
};

interface FlowLineProps {
  points: THREE.Vector3[];
  isSelected: boolean;
}

const InteractiveFlowLine: React.FC<FlowLineProps> = ({ points, isSelected }) => {
  const [hovered, setHover] = useState(false);
  const ref = useRef<any>(null);

  // Calculate curve for the energy packet
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  // Style Definitions
  // Hover: Hot/White Lime, Selected: Gold, Default: Cyan
  const color = isSelected 
    ? '#ffaa00' 
    : hovered 
      ? '#44ff66' 
      : '#00ffff';

  // Significantly thicker on hover
  const width = isSelected ? 6 : (hovered ? 8 : 1.5);
  
  // Opacity Base
  const baseOpacity = isSelected ? 0.8 : (hovered ? 1.0 : 0.2);

  useFrame((state) => {
    if (ref.current) {
      let pulse = 0;
      
      if (isSelected || hovered) {
         // High frequency pulse for interaction
         pulse = Math.sin(state.clock.elapsedTime * 20) * 0.2 + 0.2; // Fast oscillation
      } else {
         // Subtle background pulse
         pulse = Math.sin(state.clock.elapsedTime * 2) * 0.05;
      }

      ref.current.material.opacity = THREE.MathUtils.clamp(baseOpacity + pulse, 0.1, 1.0);
      ref.current.material.color.set(color);
      ref.current.material.linewidth = width;
    }
  });

  return (
    <group>
        <CatmullRomLine
            ref={ref}
            points={points}
            color={color}
            lineWidth={width}
            segments={40} // Smoother curves
            opacity={baseOpacity}
            transparent
            vertexColors={false}
            onPointerOver={(e) => {
                e.stopPropagation();
                setHover(true);
                document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
                setHover(false);
                document.body.style.cursor = 'auto';
            }}
        />
        {/* Energy Flow Animation */}
        <EnergyPacket curve={curve} color={color} visible={hovered || isSelected} />
    </group>
  );
};

const FlowLines = ({ hub, targets, selectedId }: { hub: TowerData | null, targets: TowerData[], selectedId: number | null }) => {
  const lines = useMemo(() => {
    if (!hub) return [];
    
    const l: any[] = [];
    targets.forEach(target => {
      if (target.id === hub.id) return;
      if (Math.random() > 0.25) return; // Only connect some

      const start = new THREE.Vector3(hub.position.x, hub.baseY + hub.height, hub.position.z);
      const end = new THREE.Vector3(target.position.x, target.baseY + target.height, target.position.z);
      
      const mid = start.clone().lerp(end, 0.5);
      mid.y += start.distanceTo(end) * 0.3;

      l.push({
        id: `link-${hub.id}-${target.id}`,
        targetId: target.id,
        points: [start, mid, end]
      });
    });
    return l;
  }, [hub, targets]);

  if (!hub) return null;

  return (
    <group>
      {lines.map(line => (
        <InteractiveFlowLine
          key={line.id}
          points={line.points}
          isSelected={selectedId === line.targetId}
        />
      ))}
    </group>
  );
};

const Particles = () => {
  const count = 300;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for(let i=0; i<count; i++) {
      pos[i*3] = (Math.random() - 0.5) * TERRAIN_SIZE.width;
      pos[i*3+1] = Math.random() * 40 + 10;
      pos[i*3+2] = (Math.random() - 0.5) * TERRAIN_SIZE.height;
    }
    return pos;
  }, []);

  const ref = useRef<THREE.Points>(null);
  const geoRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    if (geoRef.current) {
      geoRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  }, [positions]);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * 0.05;
    ref.current.rotation.y = t;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geoRef} />
      <pointsMaterial 
        size={1.5} 
        color="#00ffff" 
        transparent 
        opacity={0.8} 
        sizeAttenuation 
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
};

interface CityVisualizerProps {
  onHover: (id: number | null) => void;
  onSelect: (data: TowerData) => void;
  selectedId: number | null;
  timeOption: TimeOption;
  season: SeasonOption;
}

export const CityVisualizer: React.FC<CityVisualizerProps> = ({ 
    onHover, 
    onSelect, 
    selectedId,
    timeOption,
    season
}) => {
  const { turbines, hub, solarPositions, solarRotations } = useCityData();
  const orbitControlsRef = useRef<any>(null);

  return (
    <>
      <PerspectiveCamera makeDefault position={[-180, 120, 180]} fov={50} />
      <Environment preset="city" />
      <OrbitControls 
        ref={orbitControlsRef}
        autoRotate 
        autoRotateSpeed={0.3} 
        enablePan={false}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={50}
        maxDistance={400}
      />
      
      <GestureController orbitControlsRef={orbitControlsRef} onSelect={(id) => {
         const t = turbines.find(t => t.id === id);
         if(t) onSelect(t);
      }} />

      <DayNightCycle timeOption={timeOption} season={season} />
      
      <Terrain season={season} />
      
      <group>
          {turbines.map(data => (
              <WindTurbine 
                  key={data.id} 
                  data={data} 
                  isSelected={selectedId === data.id}
                  onHover={onHover}
                  onSelect={onSelect}
                  timeOption={timeOption}
              />
          ))}
      </group>

      <SolarFields positions={solarPositions} rotations={solarRotations} />

      <FlowLines hub={hub} targets={turbines} selectedId={selectedId} />
      
      <Float speed={1} rotationIntensity={0.1} floatIntensity={1}>
        <Particles />
      </Float>

      <PostEffects />
    </>
  );
};