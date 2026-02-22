import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Circle, Text, Group } from 'react-konva';
import useImage from 'use-image';
import { DropletData } from '../types';

interface Props {
  image: string;
  onAddDroplet: (data: Partial<DropletData>) => void;
  activeTool: 'select' | 'measure' | 'area-scan';
  resetTrigger?: number;
  droplets: DropletData[];
  onAreaSelect?: (area: { x: number, y: number, width: number, height: number }) => void;
}

const DropletAnalyzerCanvas: React.FC<Props> = ({ image, onAddDroplet, activeTool, resetTrigger, droplets, onAreaSelect }) => {
  const [konvaImage] = useImage(image);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Measurement state
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [tempPoint, setTempPoint] = useState<{ x: number; y: number } | null>(null);

  // Area scan state
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    setPoints([]);
    setSelectionRect(null);
  }, [resetTrigger, activeTool]);

  useEffect(() => {
    if (containerRef.current) {
      const { clientWidth } = containerRef.current;
      // Maintain aspect ratio if image is loaded
      if (konvaImage) {
        const ratio = konvaImage.height / konvaImage.width;
        setStageSize({ width: clientWidth, height: clientWidth * ratio });
      } else {
        setStageSize({ width: clientWidth, height: 500 });
      }
    }
  }, [konvaImage]);

  const handleStageMouseDown = (e: any) => {
    if (activeTool !== 'area-scan') return;
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (pos) {
      setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
      setIsSelecting(true);
    }
  };

  const handleStageMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;

    if (activeTool === 'measure' && points.length > 0) {
      setTempPoint(pos);
    }

    if (activeTool === 'area-scan' && isSelecting && selectionRect) {
      setSelectionRect({
        ...selectionRect,
        width: pos.x - selectionRect.x,
        height: pos.y - selectionRect.y,
      });
    }
  };

  const handleStageMouseUp = () => {
    if (activeTool === 'area-scan' && isSelecting && selectionRect) {
      setIsSelecting(false);
      
      // Normalize coordinates to 0-1000 for Gemini
      const normalizedArea = {
        x: (Math.min(selectionRect.x, selectionRect.x + selectionRect.width) / stageSize.width) * 1000,
        y: (Math.min(selectionRect.y, selectionRect.y + selectionRect.height) / stageSize.height) * 1000,
        width: (Math.abs(selectionRect.width) / stageSize.width) * 1000,
        height: (Math.abs(selectionRect.height) / stageSize.height) * 1000,
      };

      if (normalizedArea.width > 10 && normalizedArea.height > 10) {
        onAreaSelect?.(normalizedArea);
      }
    }
  };

  const handleStageClick = (e: any) => {
    if (activeTool !== 'measure') return;

    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    if (pointerPosition) {
      const newPoints = [...points, pointerPosition];
      setPoints(newPoints);

      // We need 3 points for a basic contact angle measurement:
      // 1. Left baseline point
      // 2. Right baseline point
      // 3. Apex or tangent point
      // For simplicity, let's use a 3-point method: 
      // P1, P2 define the baseline. P3 is the top of the droplet.
      // Or 4 points: P1-P2 baseline, P3-P4 tangent.
      
      if (newPoints.length === 3) {
        calculateAndAddDroplet(newPoints);
        setPoints([]);
      }
    }
  };

  const calculateAndAddDroplet = (pts: { x: number; y: number }[]) => {
    const [p1, p2, p3] = pts;
    
    // Calculate angle using the 3-point method (simplified)
    // Baseline is p1-p2. Droplet height is distance from p3 to baseline.
    // Width is distance p1-p2.
    // Contact angle theta = 2 * arctan(2h/w)
    
    const w = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    
    // Distance from point to line (p1-p2)
    const numerator = Math.abs((p2.y - p1.y) * p3.x - (p2.x - p1.x) * p3.y + p2.x * p1.y - p2.y * p1.x);
    const denominator = w;
    const h = numerator / denominator;
    
    const angleRad = 2 * Math.atan((2 * h) / w);
    const angleDeg = angleRad * (180 / Math.PI);
    
    onAddDroplet({
      size: w,
      contactAngle: angleDeg,
    });
  };

  const scaleX = (val: number) => (val / 1000) * stageSize.width;
  const scaleY = (val: number) => (val / 1000) * stageSize.height;

  return (
    <div ref={containerRef} className="w-full bg-black/5 relative cursor-crosshair">
      <Stage 
        width={stageSize.width} 
        height={stageSize.height}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onClick={handleStageClick}
      >
        <Layer>
          {konvaImage && (
            <KonvaImage 
              image={konvaImage} 
              width={stageSize.width} 
              height={stageSize.height}
            />
          )}
          
          {/* Current Measurement Points */}
          {points.map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={5} fill="#10b981" stroke="white" strokeWidth={2} />
          ))}

          {/* Helper Lines */}
          {points.length === 1 && tempPoint && (
            <Line 
              points={[points[0].x, points[0].y, tempPoint.x, tempPoint.y]} 
              stroke="#10b981" 
              dash={[5, 5]} 
              strokeWidth={2} 
            />
          )}
          {points.length === 2 && tempPoint && (
            <>
              <Line 
                points={[points[0].x, points[0].y, points[1].x, points[1].y]} 
                stroke="#10b981" 
                strokeWidth={2} 
              />
              <Line 
                points={[points[0].x, points[0].y, tempPoint.x, tempPoint.y]} 
                stroke="#3b82f6" 
                dash={[5, 5]} 
                strokeWidth={2} 
              />
              <Line 
                points={[points[1].x, points[1].y, tempPoint.x, tempPoint.y]} 
                stroke="#3b82f6" 
                dash={[5, 5]} 
                strokeWidth={2} 
              />
            </>
          )}

          {/* Render AI Droplets */}
          {droplets.filter(d => d.isAI && d.points).map((d) => {
            const b = d.points!.baseline;
            const a = d.points!.apex;
            
            if (!b) return null;

            return (
              <Group key={d.id}>
                {/* Baseline */}
                <Line 
                  points={[scaleX(b.x1), scaleY(b.y1), scaleX(b.x2), scaleY(b.y2)]}
                  stroke="#10b981"
                  strokeWidth={2}
                />
                {/* Apex and Angle Visual */}
                {a && (
                  <>
                    <Line 
                      points={[scaleX(b.x1), scaleY(b.y1), scaleX(a.x), scaleY(a.y), scaleX(b.x2), scaleY(b.y2)]}
                      stroke="#3b82f6"
                      strokeWidth={1}
                      dash={[2, 2]}
                    />
                    <Circle x={scaleX(a.x)} y={scaleY(a.y)} radius={3} fill="#3b82f6" />
                  </>
                )}
                {/* Label */}
                <Text 
                  x={scaleX(b.x1)} 
                  y={scaleY(b.y1) - 20}
                  text={`#${d.dropletNo}: ${d.contactAngle.toFixed(1)}°`}
                  fontSize={12}
                  fill="white"
                  fontStyle="bold"
                  shadowColor="black"
                  shadowBlur={2}
                />
              </Group>
            );
          })}

          {/* Tooltip */}
          {activeTool === 'measure' && (
            <Group x={10} y={10}>
              <Text 
                text={
                  points.length === 0 ? "Click to set 1st baseline point" :
                  points.length === 1 ? "Click to set 2nd baseline point" :
                  "Click at the top of the droplet"
                }
                fontSize={14}
                fill="white"
                fontStyle="bold"
                padding={10}
              />
            </Group>
          )}

          {/* Area Selection Rect */}
          {selectionRect && (
            <Line
              points={[
                selectionRect.x, selectionRect.y,
                selectionRect.x + selectionRect.width, selectionRect.y,
                selectionRect.x + selectionRect.width, selectionRect.y + selectionRect.height,
                selectionRect.x, selectionRect.y + selectionRect.height,
                selectionRect.x, selectionRect.y
              ]}
              stroke="#10b981"
              strokeWidth={2}
              fill="rgba(16, 185, 129, 0.1)"
              closed
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
};

export default DropletAnalyzerCanvas;
