import { GoogleGenAI } from "@google/genai";

export const streamResearch = async (
  topic: string,
  currentArtifact: string
) => {
  // Always initialize with the key from env
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const systemInstruction = `
    You are a world-class Deep Research Assistant.
    Your goal is to produce a comprehensive, academic-quality research report on the user's topic.
    
    Follow these rules strictly:
    1. Use the 'googleSearch' tool to gather real-time, accurate information.
    2. Structure your output as a valid MARKDOWN document.
    3. Start with a Title (#), then an Executive Summary, then detailed Sections (##).
    4. Include data tables where relevant.
    5. Be exhaustive. Expand on the depth and breadth of the topic automatically.
    6. Do NOT write conversational filler (like "Here is the report"). Just write the report content.
    7. If there is existing content provided, extend it or refine it, do not repeat unnecessarily unless summarizing.
  `;

  // Include current artifact in context so the model can "expand" on it
  const contextString = currentArtifact 
    ? `\n--- EXISTING RESEARCH START ---\n${currentArtifact}\n--- EXISTING RESEARCH END ---\n\nBased on the above, please expand the research further on:` 
    : '';

  const prompt = `
    ${contextString}
    Topic: ${topic}
    
    Please conduct a deep research session on this topic. 
    Expand on sub-topics, historical context, future implications, and key statistics.
    Ensure the tone is professional and objective.
  `;

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
        // Increased budget slightly for better depth, though prompt is handled by model
        thinkingConfig: { thinkingBudget: 2048 }, 
      },
    });

    return responseStream;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};