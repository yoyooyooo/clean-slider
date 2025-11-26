
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult, CropMargins, Mask } from "../types";

const GEMINI_API_KEY = process.env.API_KEY || '';

export const analyzePdfContent = async (text: string): Promise<AnalysisResult> => {
  if (!GEMINI_API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = `
    You are an expert presentation analyst. I will provide the text content extracted from a slide deck (NotebookLM generated or similar).
    
    Your task is to:
    1. Write a concise executive summary of the content (max 3 sentences).
    2. Extract 3-5 key takeaways or bullet points.
    
    Content:
    ${text.substring(0, 30000)} 
  `;

  // Using gemini-2.5-flash for speed and efficiency on text tasks
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyPoints: { 
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      }
    }
  });

  const resultText = response.text;
  if (!resultText) {
    throw new Error("No response from Gemini");
  }

  try {
    return JSON.parse(resultText) as AnalysisResult;
  } catch (e) {
    console.error("Failed to parse JSON", e);
    return {
      summary: "Could not parse analysis.",
      keyPoints: []
    };
  }
};

export const detectWatermarkMargins = async (imageBase64: string): Promise<CropMargins> => {
    console.log("[GeminiService] Detecting margins via Vision...");
    if (!GEMINI_API_KEY) {
        throw new Error("API Key is missing");
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    const prompt = `
      Look at this presentation slide image. 
      Identify areas on the edges that contain:
      1. Watermarks (e.g., "NotebookLM", company logos).
      2. UI elements (e.g., "Page 1", dates, footers, headers that look like template artifacts).
      3. Solid borders or decorative margins that enclose the main content.

      Your goal is to suggest CROP MARGINS (as percentages 0-100) to remove these edge elements while keeping the main slide content intact.
      
      - If the slide looks clean, return 0 for all.
      - If there is a "NotebookLM" footer, usually crop about 8-12% from the bottom.
      - Be conservative. Do not crop actual content (text titles, body text).

      Return a JSON object with 'top', 'bottom', 'left', 'right' as number percentages.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash', // Flash supports vision and is fast
            contents: {
                parts: [
                    {
                        inlineData: {
                            mimeType: 'image/jpeg',
                            data: imageBase64
                        }
                    },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        top: { type: Type.NUMBER },
                        bottom: { type: Type.NUMBER },
                        left: { type: Type.NUMBER },
                        right: { type: Type.NUMBER },
                    }
                }
            }
        });

        const resultText = response.text;
        if (!resultText) throw new Error("No response from Gemini Vision");

        const margins = JSON.parse(resultText) as CropMargins;
        console.log("[GeminiService] Margins detected:", margins);
        return {
            top: margins.top || 0,
            bottom: margins.bottom || 0,
            left: margins.left || 0,
            right: margins.right || 0
        };
    } catch (e) {
        console.error("Failed to parse crop margins or API error", e);
        // Return safe defaults on error
        return { top: 0, bottom: 0, left: 0, right: 0 };
    }
};

export const detectWatermarkMasks = async (imageBase64: string): Promise<Mask[]> => {
  console.log("[GeminiService] Detecting masks via Vision...");
  if (!GEMINI_API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const prompt = `
    Analyze this slide image.
    Identify unwanted small artifacts like:
    1. The "NotebookLM" logo/watermark (often small text in corners).
    2. Page numbers (e.g., "1/10").
    3. Small company logos or footer text.

    I want to cover these specific areas with a colored rectangle (patch).
    
    Requirements:
    - Identify the bounding box for these watermarks.
    - Accurately estimate the background color code (HEX) to fill the patch.
    - Do not select titles or main body text.

    Return a JSON object containing a list of 'masks'.
    Each mask should have:
    - x, y, width, height: Bounding box coordinates as PERCENTAGES (0-100) of the image size. (x,y is top-left).
    - color: The 6-character HEX color code.
  `;

  try {
      // Switched back to gemini-2.5-flash for speed. Pro model was timing out.
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              masks: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                    width: { type: Type.NUMBER },
                    height: { type: Type.NUMBER },
                    color: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      });

      const resultText = response.text;
      if (!resultText) throw new Error("No response from Gemini Vision");

      const result = JSON.parse(resultText);
      const rawMasks = result.masks || []; // Safety check
      console.log(`[GeminiService] Found ${rawMasks.length} masks`);
      
      return rawMasks.map((m: any, idx: number) => ({
        id: `mask-${Date.now()}-${idx}`,
        x: m.x,
        y: m.y,
        width: m.width,
        height: m.height,
        color: m.color || '#FFFFFF', // Fallback color if API returns undefined
        fillType: 'solid'
      }));
  } catch (e) {
    console.error("Failed to parse masks or API error", e);
    return [];
  }
};
