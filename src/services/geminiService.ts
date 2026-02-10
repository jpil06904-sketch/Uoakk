import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Difficulty } from "../types";

const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are a Chess Grandmaster Engine.
Your task is to analyze the given FEN (Forsyth-Edwards Notation) string and best move for the current side.
You MUST play aggressively but soundly.
Output MUST be a valid JSON object.
`;

interface ChessMoveResponse {
  bestMove: string;
  thoughtProcess: string;
}

export const getBestMove = async (fen: string, difficulty: Difficulty, possibleMoves: string[]): Promise<ChessMoveResponse> => {
  try {
    const modelId = difficulty === 'hard' ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview';

    // Simplified prompt for faster/cheaper response on easy/medium
    const difficultyContext = {
      'easy': 'Play like a beginner. Make occasional mistakes. Do not look too deep.',
      'medium': 'Play like a club player. Solid moves, but miss complex tactics.',
      'hard': 'Play like a Grandmaster. Find the absolute best move.'
    };

    const prompt = `
      Current FEN: ${fen}
      Possible Legal Moves (UCI/SAN): ${possibleMoves.join(', ')}
      Context: ${difficultyContext[difficulty]}
      
      Return the best move in UCI format (e.g., "e2e4", "a7a8q") or standard SAN. 
      If you choose a promotion, ensure the promotion character (q,r,b,n) is appended.
      Also provide a short 1-sentence thought process.
    `;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        bestMove: { type: Type.STRING, description: "The best move in UCI format (e.g. e2e4)" },
        thoughtProcess: { type: Type.STRING, description: "A very brief explanation of why this move was chosen." }
      },
      required: ["bestMove", "thoughtProcess"]
    };

    const result = await genAI.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: difficulty === 'hard' ? 0.1 : 0.8, // More random for lower difficulties
      }
    });

    const text = result.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text) as ChessMoveResponse;

  } catch (error) {
    console.error("Gemini Error:", error);
    // Fallback if API fails: Pick a random move
    const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
    return {
      bestMove: randomMove,
      thoughtProcess: "I am playing randomly due to a connection issue."
    };
  }
};