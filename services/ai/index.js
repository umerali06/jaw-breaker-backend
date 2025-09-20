import { runOpenAI } from "./openai.js";
import { runOllama } from "./ollama.js";
import { checkHallucinations } from "./hallucination.js";
import { generateContent as runGemini } from "../geminiService.js";
import azureOpenAIService from "../azureOpenAIService.js";

const SYSTEM_PROMPT = "You are a clinical assistant. Use ONLY the provided patient context. If info is missing, say 'insufficient data in patient record'. Do not invent facts or use outside knowledge. Be concise, structured, and clinically cautious.";

export async function runAiTask({ task, inputContext }) {
  if (process.env.FEATURE_AI_ENABLED !== "true") {
    const e = new Error("AI disabled");
    e.status = 503;
    throw e;
  }
  
  const taskPrompt = buildTaskPrompt(task, inputContext);
  let used = null;
  let output = null;

  // Try Azure OpenAI first (primary service)
  try {
    console.log("🚀 [AI Service] Using Azure OpenAI as primary service...");
    output = await azureOpenAIService.chatWithAI(taskPrompt, inputContext);
    used = { 
      provider: "azure-openai", 
      name: "gpt-5-chat", 
      temperature: 0.2 
    };
    console.log("✅ [AI Service] Azure OpenAI response successful");
  } catch (azureError) {
    console.warn("⚠️ [AI Service] Azure OpenAI failed, trying fallbacks:", azureError.message);
    
    // Fallback to OpenAI if available
    if (process.env.OPENAI_API_KEY) {
      try {
        output = await runOpenAI({ system: SYSTEM_PROMPT, user: taskPrompt });
        used = { 
          provider: "openai", 
          name: process.env.OPENAI_MODEL || "gpt-4o-mini", 
          temperature: 0.2 
        };
        console.log("✅ [AI Service] OpenAI fallback successful");
      } catch (error) {
        // If OpenAI hits rate limit, try Gemini as fallback
        if (error.status === 429 || error.message.includes("quota") || error.message.includes("rate limit")) {
          console.log("OpenAI rate limited, falling back to Gemini AI...");
          if (process.env.GEMINI_API_KEY) {
            try {
              output = await runGemini(taskPrompt, { model: "gemini-1.5-flash" });
              used = { 
                provider: "gemini", 
                name: "gemini-1.5-flash", 
                temperature: 0.2 
              };
              console.log("✅ [AI Service] Gemini fallback successful");
            } catch (geminiError) {
              console.error("Gemini fallback also failed:", geminiError.message);
              // Continue to other fallbacks
            }
          }
        }
        
        // Don't throw error here - let the fallback logic continue
        console.log("OpenAI failed, continuing with fallback options...");
      }
    }
  }
  
  // If OpenAI failed or not available, try Gemini
  if (!output && process.env.GEMINI_API_KEY) {
    try {
      output = await runGemini(taskPrompt, { model: "gemini-1.5-flash" });
      used = { 
        provider: "gemini", 
        name: "gemini-1.5-flash", 
        temperature: 0.2 
      };
    } catch (error) {
      console.error("Gemini AI failed:", error.message);
    }
  }
  
  // If still no output, try Ollama
  if (!output && process.env.OLLAMA_ENDPOINT) {
    try {
      output = await runOllama({ system: SYSTEM_PROMPT, user: taskPrompt });
      used = { 
        provider: "ollama", 
        name: process.env.OLLAMA_MODEL || "llama3.1:8b", 
        temperature: 0.2 
      };
    } catch (error) {
      console.error("Ollama failed:", error.message);
    }
  }
  
  // If no AI provider worked, throw our custom error
  if (!output) {
    const e = new Error("All AI providers failed or are unavailable");
    e.status = 503;
    e.details = {
      openai: process.env.OPENAI_API_KEY ? "rate_limited" : "not_configured",
      gemini: process.env.GEMINI_API_KEY ? "rate_limited" : "not_configured",
      ollama: process.env.OLLAMA_ENDPOINT ? "failed" : "not_configured"
    };
    throw e;
  }

  const hallucinationFlags = checkHallucinations(output, inputContext);
  return { output, model: used, hallucinationFlags };
}

function buildTaskPrompt(task, ctx) {
  const baseCtx = JSON.stringify({
    demographics: ctx.demographics,
    allergies: ctx.allergies,
    medications: ctx.medications,
    documents: ctx.documents.map(d => ({
      id: d.id, 
      type: d.type, 
      title: d.title, 
      text: d.text.slice(0, 4000)
    }))
  });
  
  const map = {
    entity_extraction: "Extract key entities (problems, meds, allergies, dates) strictly from context.",
    summarization: "Summarize clinically relevant findings only from the documents.",
    differential_diagnosis: "Provide differential diagnosis ONLY from provided findings; list reasoning and red flags.",
    treatment_planning: "Draft a cautious treatment plan based on context; note uncertainties.",
    medication_safety: "Check interactions/contraindications using ONLY meds & allergies in context.",
    soap_note: "Produce a concise SOAP note from the provided data only."
  };
  
  const taskInstr = map[task] || "Work strictly within the given patient context.";
  return `Task: ${task}\nInstructions: ${taskInstr}\nPatient Context(JSON): ${baseCtx}`;
}
