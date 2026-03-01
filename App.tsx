import React, { useState, Suspense, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Loader } from '@react-three/drei';
import { CityVisualizer } from './components/CityVisualizer';
import { Overlay } from './components/Overlay';
import { TowerData, TimeOption, SeasonOption } from './types';
import { generateCityAnalysis } from './services/geminiService';

import * as THREE from 'three';

const App: React.FC = () => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [selectedTower, setSelectedTower] = useState<TowerData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Environment State
  const [timeOption, setTimeOption] = useState<TimeOption>('Auto');
  const [season, setSeason] = useState<SeasonOption>('Spring');

  // Handle interaction with the 3D scene
  const handleHover = useCallback((id: number | null) => {
    setHoveredId(id);
    document.body.style.cursor = id !== null ? 'pointer' : 'auto';
  }, []);

  const handleSelect = useCallback(async (data: TowerData) => {
    if (selectedTower?.id === data.id) return;

    setSelectedTower(data);
    setAiAnalysis(null);
    setIsAnalyzing(true);

    // Call Gemini API
    const analysis = await generateCityAnalysis(data.id, data.height, data.value);
    
    setAiAnalysis(analysis);
    setIsAnalyzing(false);
  }, [selectedTower]);

  const handleClearSelection = () => {
    setSelectedTower(null);
    setAiAnalysis(null);
  };

  return (
    <div className="relative w-full h-screen bg-[#050608]">
      
      {/* 3D Scene */}
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ 
          antialias: false, 
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          powerPreference: 'high-performance'
        }}
      >
        <Suspense fallback={null}>
          <CityVisualizer 
            onHover={handleHover} 
            onSelect={handleSelect}
            selectedId={selectedTower?.id ?? null}
            timeOption={timeOption}
            season={season}
          />
        </Suspense>
      </Canvas>

      {/* Loading Screen (drei) */}
      <Loader 
        containerStyles={{ background: '#050608' }}
        dataStyles={{ fontFamily: 'Space Grotesk', fontSize: '14px', letterSpacing: '0.2em' }}
        barStyles={{ background: '#ffffff', height: '2px' }}
      />

      {/* UI Overlay */}
      <Overlay 
        hoveredId={hoveredId}
        selectedData={selectedTower}
        aiAnalysis={aiAnalysis}
        isAnalyzing={isAnalyzing}
        onClearSelection={handleClearSelection}
        timeOption={timeOption}
        setTimeOption={setTimeOption}
        season={season}
        setSeason={setSeason}
      />
    </div>
  );
};

export default App;