import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeDroplets(base64Image: string, area?: { x: number, y: number, width: number, height: number }) {
  const model = "gemini-3-flash-preview";
  
  const areaContext = area 
    ? `Focus ONLY on the area defined by these normalized coordinates (0-1000): 
       x: ${area.x}, y: ${area.y}, width: ${area.width}, height: ${area.height}. 
       Ignore droplets outside this region.`
    : "Analyze all droplets in the entire image.";

  const prompt = `
    Analyze this image of liquid droplets on a surface.
    ${areaContext}
    1. Count the number of droplets in the specified area.
    2. For each droplet, estimate its contact angle in degrees.
    3. Estimate its relative size (width in pixels).
    4. Determine if it is Hydrophilic (angle < 90) or Hydrophobic (angle >= 90).
    
    Return the data in a JSON array of objects with these properties:
    - dropletNo: number
    - contactAngle: number
    - size: number
    - property: string ("Hydrophilic" or "Hydrophobic")
    - points: object with:
        - baseline: { x1: number, y1: number, x2: number, y2: number } (normalized 0-1000)
        - apex: { x: number, y: number } (normalized 0-1000, top of the droplet)
    
    Also include a "summary" field with the "meanContactAngle".
    Return ONLY the JSON.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image.split(',')[1] || base64Image
            }
          }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json"
    }
  });

  return JSON.parse(response.text || "{}");
}
