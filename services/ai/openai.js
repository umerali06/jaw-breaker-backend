import OpenAI from "openai";

export async function runOpenAI({ system, user }) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const resp = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    messages: [
      { role: "system", content: system }, 
      { role: "user", content: user }
    ]
  });
  
  return resp.choices?.[0]?.message?.content || "";
}







