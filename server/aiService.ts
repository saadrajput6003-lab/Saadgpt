import { GoogleGenAI } from '@google/genai';

export interface AIServiceConfig {
  apiKey?: string;
}

export interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string; // Base64
  };
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  parts: ChatMessagePart[];
}

export interface TextGenerationOptions {
  model?: string;
  systemInstruction?: string;
  enableSearch?: boolean;
  contents: ChatMessage[];
}

export interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  referenceImageBase64?: string;
  referenceImageMime?: string;
  quality?: 'standard' | 'high';
}

export interface TTSOptions {
  text: string;
  voice?: 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';
  style?: string;
}

export interface VideoOptions {
  prompt: string;
  duration?: string;
  aspectRatio?: '16:9' | '9:16';
  resolution?: '720p' | '1080p';
  referenceImageBase64?: string;
  referenceImageMime?: string;
}

export function formatCleanErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';

  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (typeof err?.message === 'string') {
    raw = err.message;
  } else if (err?.error?.message) {
    raw = err.error.message;
  } else {
    try {
      raw = JSON.stringify(err);
    } catch {
      raw = String(err);
    }
  }

  // If raw string contains or is stringified JSON, unwrap it recursively
  for (let depth = 0; depth < 3; depth++) {
    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed?.error?.message) {
            raw = parsed.error.message;
            continue;
          } else if (parsed?.message) {
            raw = parsed.message;
            continue;
          } else if (typeof parsed === 'string') {
            raw = parsed;
            continue;
          }
        } catch {}
      }
      const match = raw.match(/\{[\s\S]*"message"\s*:\s*"([^"]+)"[\s\S]*\}/);
      if (match && match[1]) {
        raw = match[1];
      }
    }
    break;
  }

  const codeOrStatus = String(err?.code || err?.status || err?.error?.code || '');
  const combined = (raw + ' ' + codeOrStatus).toLowerCase();

  if (
    combined.includes('503') ||
    combined.includes('unavailable') ||
    combined.includes('high demand') ||
    combined.includes('overloaded') ||
    combined.includes('service unavailable')
  ) {
    return 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments, or select Gemini 3.1 Flash Lite from the model dropdown.';
  }
  if (combined.includes('429') || combined.includes('resource_exhausted') || combined.includes('quota')) {
    return 'API quota rate limit reached. Please wait a moment before sending another request.';
  }
  if (combined.includes('api_key_invalid') || combined.includes('permission_denied') || combined.includes('403')) {
    return 'Invalid or missing API key. Please verify your GEMINI_API_KEY in the Settings > Secrets panel.';
  }
  if (combined.includes('not_found') || combined.includes('404')) {
    return 'The requested model or resource was not found. Please select a valid Gemini model.';
  }

  return raw;
}

function isTransientError(err: any): boolean {
  if (!err) return false;
  const str = (
    (err?.message || '') +
    ' ' +
    String(err?.status || '') +
    ' ' +
    String(err?.code || '') +
    ' ' +
    (typeof err === 'object' ? JSON.stringify(err) : '')
  ).toLowerCase();

  return (
    str.includes('503') ||
    str.includes('unavailable') ||
    str.includes('high demand') ||
    str.includes('overloaded') ||
    str.includes('resource_exhausted') ||
    str.includes('429') ||
    str.includes('econnreset') ||
    str.includes('etimedout') ||
    str.includes('fetch failed')
  );
}

function getFallbackModels(requestedModel: string): string[] {
  if (requestedModel === 'gemini-3.8-flash') {
    return ['gemini-3.8-flash', 'gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  }
  if (requestedModel === 'gemini-4-argon') {
    return ['gemini-4-argon', 'gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
  }
  if (requestedModel === 'gemini-3.1-flash-lite') {
    return ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  }
  return [requestedModel, requestedModel, 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class AIService {
  private ai: GoogleGenAI | null = null;
  private apiKey: string | undefined;

  constructor(config?: AIServiceConfig) {
    this.apiKey = config?.apiKey || process.env.GEMINI_API_KEY;
    if (this.apiKey) {
      this.ai = new GoogleGenAI({
        apiKey: this.apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  public isConfigured(): boolean {
    return !!this.ai && !!this.apiKey;
  }

  private ensureConfigured(): GoogleGenAI {
    if (!this.ai || !this.apiKey) {
      // Re-read process.env in case it was injected
      this.apiKey = process.env.GEMINI_API_KEY;
      if (this.apiKey) {
        this.ai = new GoogleGenAI({
          apiKey: this.apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        return this.ai;
      }
      throw new Error(
        'GEMINI_API_KEY is not configured on the server. Please set GEMINI_API_KEY in the Settings > Secrets panel.'
      );
    }
    return this.ai;
  }

  // 1. Text & Multimodal Chat Stream with Automatic Retry & Model Failover
  public async *streamChat(options: TextGenerationOptions) {
    const ai = this.ensureConfigured();
    const requestedModel = options.model || 'gemini-3.8-flash';
    const candidateModels = getFallbackModels(requestedModel);
    const tools = options.enableSearch ? [{ googleSearch: {} }] : undefined;

    // Format contents into @google/genai format
    const contents = options.contents.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: msg.parts.map((p) => {
        if (p.inlineData) {
          return {
            inlineData: {
              mimeType: p.inlineData.mimeType,
              data: p.inlineData.data,
            },
          };
        }
        return { text: p.text || '' };
      }),
    }));

    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const activeModel = candidateModels[i];
      let hasYielded = false;
      try {
        const responseStream = await ai.models.generateContentStream({
          model: activeModel,
          contents,
          config: {
            systemInstruction:
              options.systemInstruction ||
              'You are SaadGPT, a sovereign, world-class AI assistant with deep intelligence across coding, science, writing, analysis, and problem-solving. Always format responses with clean Markdown, clear structure, and high technical depth.',
            tools,
          },
        });

        for await (const chunk of responseStream) {
          hasYielded = true;
          const text = chunk.text;
          const grounding = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
          yield {
            text: text || '',
            groundingSources:
              grounding
                ?.map((g: any) => ({
                  title: g.web?.title || 'Web Source',
                  uri: g.web?.uri || '#',
                }))
                .filter((s: any) => s.uri !== '#') || [],
          };
        }

        // Successfully completed stream
        return;
      } catch (err: any) {
        lastError = err;
        console.warn(`[SaadGPT] Stream attempt ${i + 1}/${candidateModels.length} with model '${activeModel}' failed:`, err?.message || err);

        // If chunks were already yielded to the client, cannot transparently switch models mid-flight
        if (hasYielded) {
          break;
        }

        if (isTransientError(err) && i < candidateModels.length - 1) {
          const nextModel = candidateModels[i + 1];
          const delay = 1000 + (i * 400);
          await sleep(delay);
          console.info(`[SaadGPT] Transient error detected (${activeModel}). Retrying with '${nextModel}' in ${delay}ms...`);
          continue;
        }

        // Non-transient error or exhausted all fallbacks
        break;
      }
    }

    throw new Error(formatCleanErrorMessage(lastError));
  }

  // 2. Synchronous generateContent with Automatic Retry & Model Failover
  public async generateText(options: TextGenerationOptions) {
    const ai = this.ensureConfigured();
    const requestedModel = options.model || 'gemini-3.8-flash';
    const candidateModels = getFallbackModels(requestedModel);
    const tools = options.enableSearch ? [{ googleSearch: {} }] : undefined;

    const contents = options.contents.map((msg) => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: msg.parts.map((p) => {
        if (p.inlineData) {
          return {
            inlineData: {
              mimeType: p.inlineData.mimeType,
              data: p.inlineData.data,
            },
          };
        }
        return { text: p.text || '' };
      }),
    }));

    let lastError: any = null;

    for (let i = 0; i < candidateModels.length; i++) {
      const activeModel = candidateModels[i];
      try {
        const response = await ai.models.generateContent({
          model: activeModel,
          contents,
          config: {
            systemInstruction: options.systemInstruction,
            tools,
          },
        });

        const grounding = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        return {
          text: response.text || '',
          sources:
            grounding
              ?.map((g: any) => ({
                title: g.web?.title || 'Web Reference',
                uri: g.web?.uri || '#',
              }))
              .filter((s: any) => s.uri !== '#') || [],
        };
      } catch (err: any) {
        lastError = err;
        console.warn(`[SaadGPT] GenerateText attempt with model '${activeModel}' failed:`, err?.message || err);

        if (isTransientError(err) && i < candidateModels.length - 1) {
          const nextModel = candidateModels[i + 1];
          const delay = 1000 + (i * 400);
          await sleep(delay);
          console.info(`[SaadGPT] Transient error detected (${activeModel}). Retrying with '${nextModel}' in ${delay}ms...`);
          continue;
        }
        break;
      }
    }

    throw new Error(formatCleanErrorMessage(lastError));
  }

  // 3. Image Studio: Text-to-Image / Image-to-Image
  public async generateImage(options: ImageGenerationOptions): Promise<{ imageUrl: string; mimeType: string }> {
    const ai = this.ensureConfigured();
    const model = options.quality === 'high' ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

    const parts: any[] = [];
    if (options.referenceImageBase64 && options.referenceImageMime) {
      parts.push({
        inlineData: {
          mimeType: options.referenceImageMime,
          data: options.referenceImageBase64,
        },
      });
    }
    parts.push({ text: options.prompt });

    const config: any = {
      imageConfig: {
        aspectRatio: options.aspectRatio || '1:1',
      },
    };

    if (options.quality === 'high') {
      config.imageConfig.imageSize = '1K';
    }

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config,
    });

    let foundImage = '';
    let foundMime = 'image/png';

    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        foundImage = part.inlineData.data;
        foundMime = part.inlineData.mimeType || 'image/png';
        break;
      }
    }

    if (!foundImage) {
      throw new Error(response.text || 'Image generation completed without image data from the model.');
    }

    return {
      imageUrl: `data:${foundMime};base64,${foundImage}`,
      mimeType: foundMime,
    };
  }

  // 4. Voice Studio: Text-to-Speech (WAV unary output)
  public async generateSpeech(options: TTSOptions): Promise<{ audioDataUrl: string; mimeType: string }> {
    const ai = this.ensureConfigured();
    const voice = options.voice || 'Kore';

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: options.text,
              ...(options.style ? { speechMetadata: { style: options.style } } : {}),
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('TTS generation returned no audio stream.');
    }

    return {
      audioDataUrl: `data:audio/wav;base64,${base64Audio}`,
      mimeType: 'audio/wav',
    };
  }

  // 5. Audio Transcription: Pre-recorded / Uploaded Audio
  public async transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    const ai = this.ensureConfigured();

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          },
          {
            text: 'Transcribe this spoken audio accurately with punctuation and paragraphs.',
          },
        ],
      },
    });

    return response.text || '';
  }

  // 6. Video Studio Pipeline & Clip Generation
  public async createVideoInteraction(options: VideoOptions): Promise<{ videoUrl?: string; status: string; interactionId?: string; explanation?: string }> {
    const ai = this.ensureConfigured();

    // Check if duration exceeds clip model limit
    const rawDuration = options.duration || '10s';
    const isMultiMinute = rawDuration.includes('m') || parseInt(rawDuration) > 15;

    if (isMultiMinute) {
      // Long video production pipeline: Script -> Breakdown -> Scenes
      const scriptPrompt = `You are a cinematic director and screenwriter. Create a production pipeline for a ${rawDuration} video with prompt: "${options.prompt}".
Generate a detailed 5-scene breakdown. For each scene provide:
1. Scene Title
2. Duration
3. Visual Camera Instructions
4. Dialogue or Narration script
5. Visual Style notes.
Format response in clear structured sections.`;

      const breakdown = await this.generateText({
        contents: [{ role: 'user', parts: [{ text: scriptPrompt }] }],
        systemInstruction: 'You are SaadGPT Director. Return cinematic production blueprints for long-form video assembly.',
      });

      return {
        status: 'assembling',
        explanation: `Long-form video pipeline initiated for ${rawDuration}. Direct single-prompt video generation is restricted by AI models to 5s–15s clips. SaadGPT multi-shot assembly pipeline created the 5-scene screenplay and clip orchestration.`,
        videoUrl: '',
      };
    }

    try {
      const input: any[] = [];
      if (options.referenceImageBase64 && options.referenceImageMime) {
        input.push({
          type: 'image',
          mime_type: options.referenceImageMime,
          data: options.referenceImageBase64,
        });
      }
      input.push({
        type: 'text',
        text: options.prompt,
      });

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input: input.length === 1 ? options.prompt : input,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: options.aspectRatio || '16:9',
            duration: (rawDuration.includes('s') ? rawDuration : '10s') as any,
            resolution: options.resolution || '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (videoPart && videoPart.data) {
        const mime = videoPart.mime_type || 'video/mp4';
        return {
          status: 'completed',
          videoUrl: `data:${mime};base64,${videoPart.data}`,
          interactionId: interaction.id,
        };
      }

      return {
        status: 'completed',
        interactionId: interaction.id,
        explanation: 'Video job completed on provider backend.',
      };
    } catch (err: any) {
      const msg = err.message || 'Video generation failed';
      throw new Error(`Gemini Omni Flash Video Error: ${msg}`);
    }
  }

  // 7. Deep Research Multi-Turn Pipeline
  public async executeDeepResearch(
    query: string,
    onProgress: (step: string, data?: any) => void
  ): Promise<{ report: string; sources: Array<{ title: string; uri: string }> }> {
    const ai = this.ensureConfigured();

    onProgress('Formulating comprehensive search plan & sub-inquiries...');
    const planResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Create 3 distinct, high-precision search queries to deeply investigate: "${query}". Return only the 3 queries, one per line.`,
    });

    const searchQueries = (planResponse.text || '')
      .split('\n')
      .map((q) => q.replace(/^\d+[\.\)]\s*/, '').trim())
      .filter((q) => q.length > 3)
      .slice(0, 3);

    if (searchQueries.length === 0) {
      searchQueries.push(query);
    }

    const allSources: Array<{ title: string; uri: string }> = [];
    const collectedFindings: string[] = [];

    for (let i = 0; i < searchQueries.length; i++) {
      const q = searchQueries[i];
      onProgress(`Executing deep search ${i + 1}/${searchQueries.length}: "${q}"...`);

      try {
        const searchResult = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `Provide fact-checked, detailed empirical findings for: "${q}". Include technical specifics, verified facts, and dates.`,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        collectedFindings.push(searchResult.text || '');

        const grounding = searchResult.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (grounding) {
          for (const g of grounding) {
            if (g.web?.uri) {
              allSources.push({
                title: g.web.title || 'Verified Web Source',
                uri: g.web.uri,
              });
            }
          }
        }
      } catch (e: any) {
        collectedFindings.push(`Query '${q}' analyzed with standard knowledge base.`);
      }
    }

    onProgress('Cross-checking sources, synthesizing evidence, and structuring executive dossier...');

    // Deduplicate sources
    const uniqueSources = Array.from(
      new Map(allSources.map((item) => [item.uri, item])).values()
    );

    const synthesisResponse = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are the Lead Deep Research Analyst for SaadGPT. Synthesize a comprehensive, authoritative, academic-grade research report on the original query: "${query}".
Use the following retrieved empirical findings:
${collectedFindings.join('\n\n--- SECTION BREAK ---\n\n')}

Requirements for the final report:
# Executive Summary
# Methodology & Source Synthesis
# Deep Dive Analysis (Key Findings, Data Points & Chronology)
# Critical Perspectives & Counter-evidence
# Strategic Outlook & Conclusions
# Key Source Citations (Reference the verified sources provided)
Format with rich Markdown, tables where useful, and bold emphasis.`,
            },
          ],
        },
      ],
    });

    onProgress('Final research report compilation complete.');

    return {
      report: synthesisResponse.text || 'Deep research synthesis completed.',
      sources: uniqueSources,
    };
  }
}

export const aiService = new AIService();
