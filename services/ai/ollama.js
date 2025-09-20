import fetch from "node-fetch";

export async function runOllama({ system, user }) {
  const body = { 
    model: process.env.OLLAMA_MODEL || "llama3.1:8b", 
    prompt: `${system}\n\n${user}` 
  };
  
  const r = await fetch(`${process.env.OLLAMA_ENDPOINT}/api/generate`, { 
    method: "POST", 
    headers: { "Content-Type": "application/json" }, 
    body: JSON.stringify(body) 
  });
  
  if (!r.ok) throw new Error("Ollama request failed");
  
  const json = await r.json();
  return json.response || "";
}









