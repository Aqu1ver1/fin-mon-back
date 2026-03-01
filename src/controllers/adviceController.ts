import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

const focusHints: Record<string, string> = {
  overview: "Summarize spending patterns and key risks/opportunities.",
  savings: "Give a realistic savings plan based on income vs expenses.",
  cuts: "Suggest concrete expense reductions and quick wins.",
  budget: "Recommend category-level budget controls and limits."
};

export async function getAdvice(req: AuthRequest, res: Response) { 
  const apiKey = process.env.OPENAI_API_KEY;
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!apiKey) {
    return res.status(500).json({ error: "Missing OpenAI API key" });
  }

  const { focus, goal, currency, totals, transactions, language } = req.body;
  const languageName = language === "ru" ? "Russian" : "English";
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const messages = [
    {
      role: "system",
      content:
        "You are a practical personal finance assistant. " +
        "Analyze the user's transactions and give concise, actionable advice. " +
        "Return 4-6 bullet points and end with 2 next-step actions. " +
        `Reply in ${languageName}.`
    },
    {
      role: "user",
      content:
        `User goal/problem: ${goal}\n` +
        `Focus: ${focus} (${focusHints[focus]})\n` +
        `Currency: ${currency}\n` +
        `Totals: ${JSON.stringify(totals)}\n` +
        "Transactions (most recent first):\n" +
        `${JSON.stringify(transactions, null, 2)}`
    }
  ];

  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: 450 })
    });

    if (!response.ok) {
    const errorText = await response.text();
    
    if (response.status === 429) {
        return res.status(429).json({ 
        error: "OpenAI rate limit reached. Please wait a moment and try again, or check your billing at platform.openai.com/settings/billing." 
        });
    }

    if (response.status === 401) {
        return res.status(401).json({ 
        error: "Invalid OpenAI API key. Check your OPENAI_API_KEY environment variable." 
        });
    }

    return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return res.status(500).json({ error: "Empty response from OpenAI" });
    }

    return res.json({ advice: content });
  } catch (err) {
    return res.status(500).json({ error: "Internal server error" });
  }
}