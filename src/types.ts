export interface DropletData {
  id: string;
  dropletNo: number;
  size: number; // in pixels or calibrated units
  contactAngle: number; // in degrees
  property: 'Hydrophilic' | 'Hydrophobic';
  points?: {
    baseline: { x1: number; y1: number; x2: number; y2: number };
    apex?: { x: number; y: number };
    tangent?: { x1: number; y1: number; x2: number; y2: number };
  };
  isAI?: boolean;
}

export interface AnalysisResult {
  droplets: DropletData[];
  meanContactAngle: number;
}
