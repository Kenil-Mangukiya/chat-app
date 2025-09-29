import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyAi4Qo2WNX7vOesGW_Rwz9vP8HfOwZLzjE" });

export async function POST(req, res) {
  const { prompt } = await req.json();
  console.log("Prompt is : ", prompt);

  if (prompt) {
    const systemPrompt = `
You are a smart and helpful assistant. Reply with a short, clear, and useful message.
Avoid unnecessary details or long explanations.
Answer naturally and in the same language as the user prompt.

User said:
${prompt}

Your helpful reply:
    `.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: systemPrompt.toString(),
    });

    console.log("Response is : ", response.text);

    return Response.json({
      message: "Response from AI received successfully",
      data: response.text.trim(),
    });
  } else {
    console.log("Prompt is not received");
    return Response.json({
      message: "Prompt is missing",
    }, {
      status: 400
    });
  }
}
