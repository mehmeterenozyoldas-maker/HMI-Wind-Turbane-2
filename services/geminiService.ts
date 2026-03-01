import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

// Initialize the client safely
try {
  if (process.env.API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
} catch (error) {
  console.error("Failed to initialize Gemini client:", error);
}

export const generateCityAnalysis = async (nodeId: number, height: number, trafficIndex: number): Promise<string> => {
  if (!aiClient) {
    return "System Offline: AI Neural Link not established (Missing API Key).";
  }

  try {
    const prompt = `
      You are an automated interface for a futuristic Eco-Grid installation.
      
      Analyze "Turbine Node ${nodeId}" in this renewable energy farm.
      Data detected:
      - Hub Height: ${height.toFixed(1)} meters
      - Wind Velocity / Output Efficiency: ${trafficIndex}%
      
      Generate a short, poetic, and slightly sci-fi analysis (max 50 words) about the energy flow, atmospheric conditions, or the role of this specific turbine in the grid.
      Do not be generic. Be evocative.
    `;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return response.text || "Data stream interrupted.";
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return "Neural connection unstable. Unable to decipher node data.";
  }
};