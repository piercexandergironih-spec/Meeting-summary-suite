import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function analyzeMeeting(input: { type: 'text', text: string } | { type: 'file', mimeType: string, data: string, textPreview?: string }) {
  const prompt = `Role: You are a Senior Project Manager and Automation Architect. Your goal is to eliminate all manual administrative work following a meeting. 

Task: Analyze the provided meeting transcript, notes, or document. You must perform a deep extraction of "intent" and "responsibility" to generate actionable data.
CRITICAL DIRECTIVE: You MUST extract ALL action items for ALL team members. Do not leave any task out.

Phase 1: Analytical Intelligence
- Identify every explicit and implicit action item mentioned.
- Distinguish between "discussion points" and "actual tasks."
- Determine the priority based on the urgency of the language used (e.g., "ASAP," "by tomorrow," "eventually").

Phase 2: Output Requirements
You must return your response ONLY as a single, valid JSON object. Do not include conversational filler, markdown outside the JSON, or explanations. 

- The 'follow_up_email.body' must be a highly professional, well-formatted email draft. Start with a polite greeting, provide a concise executive summary, list the key decisions made, and present a clear, bulleted list of ALL action items with their respective assignees and deadlines. Close with a professional sign-off.

Phase 3: Formatting Constraints
- Ensure all "due_date" values are compatible with RFC3339 timestamps for Google Tasks.
- If a relative date is mentioned (e.g., "Next Friday"), calculate it based on today's date: April 25, 2026.`;

  const contents: any[] = [];
  
  if (input.type === 'text') {
    contents.push({ text: `Input Document follows:\n${input.text}\n\n` + prompt });
  } else {
    contents.push({
      inlineData: {
        mimeType: input.mimeType,
        data: input.data
      }
    });
    contents.push({ text: `Please analyze the provided document. ` + prompt });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview", // using pro for complex reasoning instructions
    contents: contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meta: {
            type: Type.OBJECT,
            properties: {
              vibe: {
                type: Type.STRING,
                description: "Select one: (High-Energy, Alignment, Urgent, Informational)",
                enum: ["High-Energy", "Alignment", "Urgent", "Informational"]
              },
              executive_summary: {
                type: Type.STRING,
                description: "A 2-sentence overview of the meeting outcome."
              }
            },
            required: ["vibe", "executive_summary"]
          },
          tasks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: "Clear, action-oriented title starting with a verb." },
                notes: { type: Type.STRING, description: "Brief context explaining the 'Why'." },
                assignee: { type: Type.STRING, description: "The name of the person responsible. Use 'User' if not specified." },
                priority: { type: Type.INTEGER, description: "Integer: 1 (High), 2 (Medium), 3 (Low)" },
                due_date: { type: Type.STRING, description: "Format as YYYY-MM-DD. Use null if no date is mentioned." }
              },
              required: ["title", "notes", "assignee", "priority"]
            }
          },
          follow_up_email: {
            type: Type.OBJECT,
            properties: {
              subject: { type: Type.STRING },
              body: { type: Type.STRING }
            },
            required: ["subject", "body"]
          }
        },
        required: ["meta", "tasks", "follow_up_email"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
