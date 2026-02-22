/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Download, 
  Scan, 
  MousePointer2, 
  CheckCircle2,
  ChevronRight,
  FileText,
  Table as TableIcon,
  Plus,
  Info,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { analyzeDroplets } from './services/geminiService';
import { DropletData } from './types';
import { cn } from './lib/utils';

// We'll define the Canvas component later
import DropletAnalyzerCanvas from './components/DropletAnalyzerCanvas';

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [droplets, setDroplets] = useState<DropletData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'measure' | 'area-scan'>('select');
  const [showResults, setShowResults] = useState(false);
  const [resetPointsTrigger, setResetPointsTrigger] = useState(0);
  const [calibrationFactor, setCalibrationFactor] = useState(0.05); // 0.05 mm per pixel as default
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setDroplets([]);
        setShowResults(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
        setDroplets([]);
        setShowResults(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAIAnalysis = async (area?: { x: number, y: number, width: number, height: number }) => {
    if (!image) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeDroplets(image, area);
      const dropletArray = Array.isArray(result) ? result : (result.droplets || []);
      const mappedDroplets: DropletData[] = dropletArray.map((d: any, index: number) => ({
        id: Math.random().toString(36).substr(2, 9),
        dropletNo: d.dropletNo || index + 1,
        size: d.size || 0,
        contactAngle: d.contactAngle || 0,
        property: d.property || (d.contactAngle >= 90 ? 'Hydrophobic' : 'Hydrophilic'),
        points: d.points,
        isAI: true
      }));
      setDroplets(mappedDroplets);
      setShowResults(true);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("AI Analysis failed. Please try manual measurement or check your connection.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportToExcel = () => {
    const data = droplets.map(d => ({
      'Droplet No': d.dropletNo,
      'Size (mm)': (d.size * calibrationFactor).toFixed(2),
      'Contact Angle (°)': d.contactAngle.toFixed(2),
      'Property': d.property
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Droplets");
    XLSX.writeFile(wb, "droplet_analysis.xlsx");
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Droplet Contact Angle Analysis Report", 14, 15);
    
    const tableData = droplets.map(d => [
      d.dropletNo,
      (d.size * calibrationFactor).toFixed(2),
      d.contactAngle.toFixed(2),
      d.property
    ]);

    (doc as any).autoTable({
      head: [['Droplet No', 'Size (mm)', 'Contact Angle (°)', 'Property']],
      body: tableData,
      startY: 25,
    });

    const meanAngle = droplets.reduce((acc, curr) => acc + curr.contactAngle, 0) / droplets.length;
    doc.text(`Mean Contact Angle: ${meanAngle.toFixed(2)}°`, 14, (doc as any).lastAutoTable.finalY + 10);
    
    doc.save("droplet_analysis.pdf");
  };

  const addManualDroplet = (data: Partial<DropletData>) => {
    const newDroplet: DropletData = {
      id: Math.random().toString(36).substr(2, 9),
      dropletNo: droplets.length + 1,
      size: data.size || 0,
      contactAngle: data.contactAngle || 0,
      property: (data.contactAngle || 0) >= 90 ? 'Hydrophobic' : 'Hydrophilic',
      ...data
    };
    setDroplets(prev => [...prev, newDroplet]);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white">
              <Scan size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight">DropMetric</h1>
              <p className="text-[10px] uppercase tracking-widest text-black/40 font-semibold">Contact Angle Analyzer</p>
            </div>
          </div>
          
          {image && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setImage(null)}
                className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                title="Clear Image"
              >
                <Trash2 size={20} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Image & Tools */}
        <div className="lg:col-span-8 space-y-6">
          {!image ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="aspect-video bg-white rounded-3xl border-2 border-dashed border-black/10 flex flex-col items-center justify-center p-12 text-center group hover:border-emerald-500/50 transition-all cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-6 group-hover:scale-110 transition-transform">
                <Upload size={32} />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Upload Droplet Image</h2>
              <p className="text-black/50 max-w-sm mb-8">
                Drag and drop your image here, or use the options below to capture or select a file.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4">
                <button 
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-black/10 rounded-2xl font-medium hover:bg-black/5 transition-colors"
                >
                  <ImageIcon size={18} />
                  Browse Files
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); cameraInputRef.current?.click(); }}
                  className="flex items-center gap-2 px-6 py-3 bg-black text-white rounded-2xl font-medium hover:bg-black/80 transition-colors"
                >
                  <Camera size={18} />
                  Take Photo
                </button>
              </div>
              
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*" 
              />
              <input 
                type="file" 
                ref={cameraInputRef} 
                onChange={handleImageUpload} 
                className="hidden" 
                accept="image/*" 
                capture="environment"
              />
            </motion.div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-black/5 relative">
                <DropletAnalyzerCanvas 
                  image={image} 
                  onAddDroplet={addManualDroplet}
                  activeTool={activeTool}
                  resetTrigger={resetPointsTrigger}
                  droplets={droplets}
                  onAreaSelect={(area) => runAIAnalysis(area)}
                />
                
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                    <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="font-medium text-emerald-900">AI is analyzing droplets...</p>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-4 bg-white p-6 rounded-2xl border border-black/5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-2 bg-black/5 p-1.5 rounded-xl">
                    <button 
                      onClick={() => setActiveTool('select')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        activeTool === 'select' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                      )}
                    >
                      <MousePointer2 size={16} />
                      Select
                    </button>
                    <button 
                      onClick={() => setActiveTool('measure')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        activeTool === 'measure' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                      )}
                    >
                      <Plus size={16} />
                      Measure
                    </button>
                    <button 
                      onClick={() => setActiveTool('area-scan')}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
                        activeTool === 'area-scan' ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black"
                      )}
                    >
                      <Square size={16} />
                      Area Scan
                    </button>
                    {(activeTool === 'measure' || activeTool === 'area-scan') && (
                      <button 
                        onClick={() => setResetPointsTrigger(prev => prev + 1)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 size={16} />
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-black/5 rounded-xl border border-black/5">
                      <span className="text-[10px] uppercase font-bold text-black/40">Scale</span>
                      <input 
                        type="number" 
                        value={calibrationFactor} 
                        onChange={(e) => setCalibrationFactor(parseFloat(e.target.value) || 0)}
                        className="w-16 bg-transparent border-none focus:ring-0 text-sm font-mono font-bold"
                        step="0.01"
                      />
                      <span className="text-[10px] font-bold text-black/40">mm/px</span>
                    </div>
                    
                    <button 
                      onClick={() => runAIAnalysis()}
                      disabled={isAnalyzing}
                      className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                    >
                      <Scan size={18} />
                      Auto AI Scan
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-xs text-black/40 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100">
                  <Info size={14} className="text-emerald-600" />
                  <span>
                    {activeTool === 'measure' 
                      ? "Manual Mode: Click 3 points on the canvas (2 for baseline, 1 for apex) to measure." 
                      : activeTool === 'area-scan'
                      ? "Area Scan: Click and drag to select an area for AI analysis."
                      : "Select Mode: View detected droplets and analysis results."}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Results & Export */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm h-fit">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-xl">Analysis Results</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setDroplets([])}
                  className="p-1.5 text-black/30 hover:text-red-500 transition-colors"
                  title="Clear All"
                >
                  <Trash2 size={16} />
                </button>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full uppercase tracking-wider">
                  {droplets.length} Detected
                </span>
              </div>
            </div>

            {droplets.length === 0 ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mx-auto text-black/20">
                  <TableIcon size={32} />
                </div>
                <p className="text-black/40 text-sm">No droplets measured yet.<br/>Use AI Scan or manual tools.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase tracking-widest text-black/40 font-bold border-b border-black/5">
                      <tr>
                        <th className="pb-3">No.</th>
                        <th className="pb-3">Size (mm)</th>
                        <th className="pb-3">Angle</th>
                        <th className="pb-3">Property</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {droplets.map((d) => (
                        <tr key={d.id} className="group hover:bg-black/5 transition-colors">
                          <td className="py-3 font-mono text-sm">#{d.dropletNo}</td>
                          <td className="py-3 font-mono text-sm">{(d.size * calibrationFactor).toFixed(2)}</td>
                          <td className="py-3 font-semibold">{d.contactAngle.toFixed(1)}°</td>
                          <td className="py-3">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[10px] font-bold px-2 py-1 rounded-md uppercase",
                                d.property === 'Hydrophobic' ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                              )}>
                                {d.property}
                              </span>
                              <button 
                                onClick={() => setDroplets(prev => prev.filter(item => item.id !== d.id))}
                                className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="pt-4 border-t border-black/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-black/50">Mean Contact Angle</span>
                    <span className="text-xl font-bold">
                      {(droplets.reduce((acc, curr) => acc + curr.contactAngle, 0) / droplets.length).toFixed(1)}°
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={exportToExcel}
                      className="flex items-center justify-center gap-2 py-3 bg-white border border-black/10 rounded-xl text-sm font-semibold hover:bg-black/5 transition-colors"
                    >
                      <TableIcon size={16} />
                      Excel
                    </button>
                    <button 
                      onClick={exportToPDF}
                      className="flex items-center justify-center gap-2 py-3 bg-white border border-black/10 rounded-xl text-sm font-semibold hover:bg-black/5 transition-colors"
                    >
                      <FileText size={16} />
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-emerald-900 rounded-3xl p-6 text-white overflow-hidden relative">
            <div className="relative z-10">
              <h4 className="font-bold mb-2">Pro Tip</h4>
              <p className="text-emerald-100/70 text-sm leading-relaxed">
                For best results, ensure the camera is level with the surface. High contrast between the droplet and background improves AI accuracy.
              </p>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10 rotate-12">
              <Info size={120} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
