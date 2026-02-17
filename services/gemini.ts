
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, AssessmentResult, ListenToMeResult, VoiceOption } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function analyzeContent(
  payload: { text?: string; imageBase64?: string; mimeType?: string },
  language: string
): Promise<AnalysisResult> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze the provided content and explain it clearly in ${language}.
  
  Instructions:
  1. Provide a detailed summary of the core concept.
  2. Identify the main paragraphs/sections in the content. For each, provide the 'originalText' (a short summary of that block) and a detailed 'explanation'.
  3. Provide 3 subject examples. For each, include the 'text' of the example and a clear 'explanation' of why it matters.
  4. Provide 2 real-time examples as a casual conversation between friends. Include 'persona', 'scenario' (the dialogue), and a separate 'explanation' of the lesson learned.
  
  Return result as JSON.`;

  const parts: any[] = [{ text: prompt }];
  
  if (payload.imageBase64 && payload.mimeType) {
    parts.push({
      inlineData: {
        data: payload.imageBase64,
        mimeType: payload.mimeType
      }
    });
  } else if (payload.text) {
    parts.push({ text: `Content: ${payload.text}` });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          concept: { type: Type.STRING },
          paragraphs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalText: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["originalText", "explanation"]
            }
          },
          subjectExamples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                text: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["text", "explanation"]
            }
          },
          realWorldExamples: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                persona: { type: Type.STRING },
                scenario: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ["persona", "scenario", "explanation"]
            }
          }
        },
        required: ["concept", "subjectExamples", "realWorldExamples"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function assessContent(
  images: { data: string; mimeType: string }[],
  referenceText: string,
  language: string
): Promise<AssessmentResult> {
  const ai = getAI();
  const model = "gemini-3-pro-preview";

  const prompt = `Act as a strict yet helpful teacher. Compare the student's uploaded answer sheets against the provided reference/subject matter: "${referenceText}".
  For EACH page, assess its correctness as a percentage (0-100). 
  Detail what exactly is wrong and provide the specific correction points.
  Explain everything in ${language}.
  
  Return result as JSON matching the AssessmentResult interface.`;

  const contents = images.map((img, i) => ({
    role: "user",
    parts: [
      { text: `Page ${i + 1} of answer sheet.` },
      { inlineData: { data: img.data, mimeType: img.mimeType } }
    ]
  }));

  contents.unshift({
    role: "user",
    parts: [{ text: prompt }]
  } as any);

  const response = await ai.models.generateContent({
    model,
    contents: contents as any,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          overallScore: { type: Type.NUMBER },
          generalFeedback: { type: Type.STRING },
          pages: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageNumber: { type: Type.INTEGER },
                score: { type: Type.NUMBER },
                summary: { type: Type.STRING },
                critique: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      wrongPoint: { type: Type.STRING },
                      correction: { type: Type.STRING }
                    },
                    required: ["wrongPoint", "correction"]
                  }
                }
              },
              required: ["pageNumber", "score", "critique", "summary"]
            }
          }
        },
        required: ["overallScore", "pages", "generalFeedback"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function validateVocalAnswer(
  audioBase64: string,
  referencePayload: { text?: string; imageBase64?: string; mimeType?: string },
  language: string
): Promise<ListenToMeResult> {
  const ai = getAI();
  const model = "gemini-3-flash-preview";

  const prompt = `Act as a high-precision neural examiner. Your task is to perform a rigorous GAP ANALYSIS between the student's spoken answer (audio) and the provided reference content.

Reference content is provided as ${referencePayload.text ? 'text' : 'an image'}.

Evaluation Methodology:
1. SCAN REFERENCE: Identify all key concepts, facts, and details present in the reference material.
2. SCAN SPOKEN ANSWER: Transcribe the audio and map it against the identified key concepts.
3. CALCULATE SCORE: 
   - 100% is reserved for a perfect, comprehensive explanation covering ALL key points accurately.
   - OMISSION PENALTY: If the user only explains 50% of the concepts found in the reference, the 'correctnessPercentage' MUST be 50% or lower. Do not be lenient.
   - ACCURACY PENALTY: Deduct significantly for any misinformation or incorrect definitions compared to the reference.

Provide feedback in ${language} including:
1. 'correctnessPercentage': A precise score (0-100) based strictly on coverage and accuracy.
2. 'transcription': A verbatim transcription of the user's spoken answer.
3. 'grammarMistakes': List linguistic, grammar, or heavy pronunciation errors found.
4. 'contentFeedback':
    - 'missedPoints': A list of specific concepts from the reference that were COMPLETELY OMITTED or glossed over.
    - 'accuracyReview': A concise evaluation of what was explained well vs what was incorrect.
5. 'enhancementSuggestions': Strategic advice on how to improve verbal recall and explanation depth for this specific topic.

Return the result strictly as a JSON object.`;

  const parts: any[] = [
    { text: prompt },
    { inlineData: { data: audioBase64, mimeType: 'audio/webm' } }
  ];

  if (referencePayload.imageBase64) {
    parts.push({
      inlineData: { data: referencePayload.imageBase64, mimeType: referencePayload.mimeType }
    });
  } else if (referencePayload.text) {
    parts.push({ text: `Reference Content: ${referencePayload.text}` });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          correctnessPercentage: { type: Type.NUMBER },
          transcription: { type: Type.STRING },
          grammarMistakes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                error: { type: Type.STRING },
                correction: { type: Type.STRING },
                explanation: { type: Type.STRING }
              }
            }
          },
          contentFeedback: {
            type: Type.OBJECT,
            properties: {
              missedPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
              accuracyReview: { type: Type.STRING }
            }
          },
          enhancementSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["correctnessPercentage", "transcription", "contentFeedback"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function generateSpeech(text: string, voice: VoiceOption = 'Kore'): Promise<string> {
  const ai = getAI();
  const model = "gemini-2.5-flash-preview-tts";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice }
        }
      }
    }
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate audio content");
  
  return base64Audio;
}
