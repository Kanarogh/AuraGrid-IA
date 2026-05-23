import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Re-increase limit for handling base64 image transfers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini client utility
const geminiApiKey = process.env.GEMINI_API_KEY;

// Fail-safe helper for Gemini. If key is missing, we handle it in-route gracefully
function getGeminiClient() {
  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment. Please configure it in Settings > Secrets.");
  }
  return new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Cleaner helper for client base64 images
function cleanBase64(base64Str: string) {
  if (!base64Str) return { mimeType: "image/png", data: "" };
  const parts = base64Str.split(";base64,");
  if (parts.length > 1) {
    const mimeType = parts[0].replace("data:", "");
    const data = parts[1];
    return { mimeType, data };
  }
  return { mimeType: "image/png", data: base64Str };
}

// API Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", keyConfigured: !!geminiApiKey });
});

// Match clothing and generate Instagram/Canva captions
app.post("/api/match-and-generate", async (req, res) => {
  try {
    const { postImage, catalogItems, promptContext, repeatingText } = req.body;

    if (!postImage) {
      return res.status(400).json({ error: "No post image provided." });
    }

    const ai = getGeminiClient();

    // Prepare content parts for Gemini Multimodal
    const parts: any[] = [
      {
        text: `You are an expert AI fashion planner assistant for a high-end Madrid fashion boutique ('Palak').
Your primary goal is to visually inspect the 'Target Post Image' and compare it against a list of 'Candidate Reference Items' from our wholesale catalog.
Then you MUST determine the exact matching item based on visual attributes (fabric pattern, colors, sleeve design, dress length, neck cut).
Finally, write an elite, high-retention Spanish caption tailored for Instagram/Facebook posts in Madrid, blending the match reference and repeating standard details creatively.

Let's begin. Visual Matching details:
There is ONE target post image:`,
      },
      {
        inlineData: cleanBase64(postImage),
      },
    ];

    if (catalogItems && catalogItems.length > 0) {
      parts.push({
        text: "\nHere are the candidates from our inventory catalog with their visual references. Compare them carefully with the Target Post Image to make an absolute correct match:",
      });

      catalogItems.forEach((item: any, idx: number) => {
        parts.push({ text: `\n[CANDIDATE #${idx + 1}] ID: "${item.id}" (Label/Reference: "${item.label}")` });
        parts.push({ inlineData: cleanBase64(item.image) });
      });
    } else {
      parts.push({
        text: "\n(No candidate catalog was submitted. Please write the caption for the target post image directly, leaving the matchedId null and reference label as appropriate or guessed).",
      });
    }

    parts.push({
      text: `
Please formulate your analysis and visual reasoning. Write a beautiful, descriptive post caption in elegant Spanish.

Your Spanish caption style requirements:
- Highly engaging, aspirational boutique style tailored for Madrid fashion.
- Include a magnetic, elegant opening hook (e.g. "Elegancia que inspira al sol de Madrid...").
- A small descriptive section describing the dress/outfit shown in the photo, accentuating materials, colors, flow, and visual mood.
- Include the exact reference string. It must be written exactly on its own line: "Referencia: [LABEL_OF_MATCHED_ITEM]" (or use a placeholder if no catalog matched).
- Graciously incorporate emojis, elegant spacing, and make it look clean and copy-paste ready.

You MUST include these exact structures in the caption:
- Physical Address: ${repeatingText?.address || "Calle Manuel Cobo Calleja, 46 Local 5, Madrid"}
- Call to Action / Contact: ${repeatingText?.contact || "Contacta con nosotros vía WhatsApp en el enlace de la biografía"}
- Brand/Post Hashtags: ${repeatingText?.hashtags || "#PalakModa #ModaIndia #BoutiqueMadrid"}
- Additional Footer Note: ${repeatingText?.extra || "*Imagen creada con inteligencia artificial"}

Format your entire output response STRICTLY as a single Valid JSON object matching this schema:
{
  "matchedId": "string representing the ID of the matched candidate, or null if absolutely no catalog photo matches",
  "reasoning": "A paragraph in Portuguese explaining the visual elements that prove the match (e.g., matching the blue flowery patterns, ruffle sleeves, and collar cut). Keep it warm, analytical, and professional.",
  "caption": "The final complete Spanish caption formatted with beautiful paragraph linebreaks (\\n), emojis, and the repeating CTA items."
}
`,
    });

    // Call Gemini 3.5 Flash for high performance and strong visual understanding
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: parts,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchedId: {
              type: Type.STRING,
              description: "The matching candidate ID or null if not matches.",
            },
            reasoning: {
              type: Type.STRING,
              description: "Short visual comparison reason explained in Portuguese.",
            },
            caption: {
              type: Type.STRING,
              description: "The complete social media caption written in fluent Spanish.",
            },
          },
          required: ["matchedId", "reasoning", "caption"],
        },
      },
    });

    const parsedData = JSON.parse(response.text || "{}");
    return res.json(parsedData);
  } catch (error: any) {
    console.error("Error matching post & generating caption:", error);
    return res.status(500).json({
      error: error.message || "Something went wrong during Gemini matching.",
    });
  }
});

// Custom system context generator for specific Gems template
app.post("/api/refine-caption", async (req, res) => {
  try {
    const { currentCaption, instructions } = req.body;
    if (!currentCaption) {
      return res.status(400).json({ error: "Missing caption to refine." });
    }

    const ai = getGeminiClient();
    const prompt = `You are a professional fashion copywriter. Modify the following client post caption according to these instructions:
Instructions: "${instructions}"

Original Caption:
"""
${currentCaption}
"""

Ensure the final caption preserves critical structured info (references, address, CTAs) unless explicitly requested otherwise, and responds beautifully. Keep the response as pure written text in Spanish.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    return res.json({ caption: response.text });
  } catch (error: any) {
    console.error("Error refining caption:", error);
    return res.status(500).json({ error: error.message || "Failed to refine caption." });
  }
});

// Setup Vite or regular static serving depending on environment
async function initServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

initServer();
