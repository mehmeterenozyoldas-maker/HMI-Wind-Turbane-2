import * as THREE from 'three';

export interface TowerData {
  id: number;
  position: THREE.Vector3;
  height: number;
  baseY: number;
  value: number; // Represents traffic or activity
  color: THREE.Color;
}

export interface FlowLine {
  id: string;
  points: THREE.Vector3[];
  speed: number;
  width: number;
}

export interface CityState {
  selectedTowerId: number | null;
  hoveredTowerId: number | null;
  aiAnalysis: string | null;
  isAnalyzing: boolean;
}

export enum GameState {
  INTRO = 'INTRO',
  EXPLORE = 'EXPLORE',
  FOCUSED = 'FOCUSED'
}

export type TimeOption = 'Auto' | 'Dawn' | 'Noon' | 'Dusk' | 'Midnight';
export type SeasonOption = 'Spring' | 'Summer' | 'Autumn' | 'Winter';
