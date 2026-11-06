export function cleanClientErrorMessage(raw: any): string {
  if (!raw) return 'An unexpected error occurred. Please try again.';
  let text = typeof raw === 'string' ? raw : raw?.message || String(raw);

  for (let i = 0; i < 3; i++) {
    if (typeof text === 'string') {
      const trimmed = text.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed?.error?.message) {
            text = parsed.error.message;
            continue;
          } else if (parsed?.message) {
            text = parsed.message;
            continue;
          } else if (typeof parsed === 'string') {
            text = parsed;
            continue;
          }
        } catch {}
      }
      const match = text.match(/\{[\s\S]*"message"\s*:\s*"([^"]+)"[\s\S]*\}/);
      if (match && match[1]) {
        text = match[1];
      }
    }
    break;
  }

  const lower = text.toLowerCase();
  if (
    lower.includes('503') ||
    lower.includes('unavailable') ||
    lower.includes('high demand') ||
    lower.includes('overloaded') ||
    lower.includes('service unavailable')
  ) {
    return 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments, or select Gemini 3.1 Flash Lite from the model dropdown.';
  }
  if (lower.includes('429') || lower.includes('resource_exhausted')) {
    return 'API quota rate limit reached. Please wait a moment before sending another request.';
  }
  if (lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('403')) {
    return 'Invalid or missing API key. Please verify your GEMINI_API_KEY in the Settings > Secrets panel.';
  }
  return text;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string = 'API_ERROR', status: number = 500) {
    super(cleanClientErrorMessage(message));
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const TOKEN_KEY = 'saadgpt_auth_token';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {}
  },
  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {}
  },
};

let onUnauthorizedCallback: (() => void) | null = null;
export function setUnauthorizedHandler(callback: () => void) {
  onUnauthorizedCallback = callback;
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = authStorage.getToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    throw new ApiError(
      'Network connection failed. Please check your internet connection.',
      'NETWORK_ERROR',
      0
    );
  }

  // Handle 401 Unauthorized
  if (response.status === 401) {
    authStorage.clearToken();
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
  }

  // Verify Content-Type before parsing JSON
  const contentType = response.headers.get('content-type') || '';
  let data: any = null;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new ApiError(
        'Server returned invalid JSON response.',
        'PARSE_ERROR',
        response.status
      );
    }
  } else {
    // If not JSON (e.g. HTML error page or raw text)
    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(
        `Server returned non-JSON error (${response.status}): ${text.slice(0, 100)}`,
        'NON_JSON_RESPONSE',
        response.status
      );
    }
    return text as unknown as T;
  }

  if (!response.ok || (data && data.success === false)) {
    const errorMsg = data?.error || `Request failed with status ${response.status}`;
    const errorCode = data?.code || 'API_ERROR';
    throw new ApiError(errorMsg, errorCode, response.status);
  }

  return data;
}

export const api = {
  // Auth
  async signup(name: string, email: string, password: string) {
    const res = await request('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    if (res.token) authStorage.setToken(res.token);
    return res;
  },

  async login(email: string, password: string) {
    const res = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) authStorage.setToken(res.token);
    return res;
  },

  async forgotPassword(email: string) {
    return request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(resetToken: string, newPassword: string) {
    return request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ resetToken, newPassword }),
    });
  },

  async logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      authStorage.clearToken();
    }
  },

  async getMe() {
    return request('/api/auth/me', { method: 'GET' });
  },

  async updateProfile(data: { name?: string; bio?: string; preferred_model?: string; theme?: string; language?: string; avatar?: string }) {
    return request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return request('/api/auth/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async deleteAccount() {
    const res = await request('/api/auth/account', { method: 'DELETE' });
    authStorage.clearToken();
    return res;
  },

  // Conversations
  async getConversations(search?: string, mode?: string, projectId?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (mode) params.set('mode', mode);
    if (projectId) params.set('projectId', projectId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/conversations${query}`, { method: 'GET' });
  },

  async createConversation(data: { title?: string; mode?: string; projectId?: string; model?: string }) {
    return request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getConversation(id: string) {
    return request(`/api/conversations/${id}`, { method: 'GET' });
  },

  async updateConversation(id: string, data: { title?: string; pinned?: boolean; archived?: boolean }) {
    return request(`/api/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteConversation(id: string) {
    return request(`/api/conversations/${id}`, { method: 'DELETE' });
  },

  async deleteMessage(id: string) {
    return request(`/api/messages/${id}`, { method: 'DELETE' });
  },

  async reactToMessage(id: string, reaction: 'like' | 'dislike' | 'heart' | null) {
    return request(`/api/messages/${id}/reaction`, {
      method: 'PUT',
      body: JSON.stringify({ reaction }),
    });
  },

  // Streaming Chat
  async streamChat(
    payload: {
      conversationId?: string;
      message: string;
      attachments?: Array<{ name: string; mimeType: string; data: string }>;
      model?: string;
      enableSearch?: boolean;
      mode?: string;
    },
    callbacks: {
      onStart?: (data: { conversationId: string; userMessageId: string }) => void;
      onChunk?: (delta: string, sources?: any[]) => void;
      onDone?: (data: { messageId: string; fullText: string; sources?: any[] }) => void;
      onError?: (error: string) => void;
    },
    signal?: AbortSignal
  ) {
    const token = authStorage.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      let errorMsg = `Streaming failed (${response.status})`;
      try {
        const errJson = await response.json();
        errorMsg = errJson.error || errorMsg;
      } catch {}
      throw new ApiError(errorMsg, 'STREAM_ERROR', response.status);
    }

    if (!response.body) {
      throw new ApiError('No readable response stream', 'NO_STREAM', 500);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const eventData = JSON.parse(trimmed.substring(6));
            if (eventData.type === 'start') {
              callbacks.onStart?.(eventData);
            } else if (eventData.type === 'chunk') {
              callbacks.onChunk?.(eventData.delta, eventData.sources);
            } else if (eventData.type === 'done') {
              callbacks.onDone?.(eventData);
            } else if (eventData.type === 'error') {
              callbacks.onError?.(cleanClientErrorMessage(eventData.error));
            }
          } catch {}
        }
      }
    }
  },

  // Image Studio
  async getImages() {
    return request('/api/images', { method: 'GET' });
  },

  async generateImage(data: {
    prompt: string;
    aspectRatio?: string;
    referenceImage?: string;
    referenceMime?: string;
    quality?: 'standard' | 'high';
    style?: string;
  }) {
    return request('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteImage(id: string) {
    return request(`/api/images/${id}`, { method: 'DELETE' });
  },

  // Video Studio
  async getVideos() {
    return request('/api/videos', { method: 'GET' });
  },

  async generateVideo(data: {
    prompt: string;
    duration?: string;
    resolution?: string;
    aspectRatio?: string;
    referenceImage?: string;
    referenceMime?: string;
  }) {
    return request('/api/videos/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async deleteVideo(id: string) {
    return request(`/api/videos/${id}`, { method: 'DELETE' });
  },

  // Voice Studio
  async textToSpeech(text: string, voice: string = 'Kore', style?: string) {
    return request('/api/voice/tts', {
      method: 'POST',
      body: JSON.stringify({ text, voice, style }),
    });
  },

  async getVoiceHistory() {
    return request('/api/voice/history', { method: 'GET' });
  },

  async transcribeAudio(audioData: string, mimeType?: string) {
    return request('/api/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audioData, mimeType }),
    });
  },

  async saveVoiceSession(title: string, durationSeconds: number, transcript: string) {
    return request('/api/voice/sessions', {
      method: 'POST',
      body: JSON.stringify({ title, durationSeconds, transcript }),
    });
  },

  // Study & Coding
  async studyAction(data: { documentText?: string; prompt?: string; task: string }) {
    return request('/api/modes/study', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async codingAction(data: { code?: string; prompt?: string; language?: string; action: string }) {
    return request('/api/modes/coding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Research
  async quickResearch(query: string) {
    return request('/api/research/quick', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },

  async deepResearch(query: string, depth?: string) {
    return request('/api/research/deep', {
      method: 'POST',
      body: JSON.stringify({ query, depth }),
    });
  },

  async getResearchJobs() {
    return request('/api/research/jobs', { method: 'GET' });
  },

  // Projects
  async getProjects() {
    return request('/api/projects', { method: 'GET' });
  },

  async createProject(data: { name: string; description?: string; category?: string; instructions?: string }) {
    return request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProject(id: string, data: { name?: string; description?: string; category?: string; instructions?: string }) {
    return request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProject(id: string) {
    return request(`/api/projects/${id}`, { method: 'DELETE' });
  },

  // Files
  async getFiles(projectId?: string) {
    const query = projectId ? `?projectId=${projectId}` : '';
    return request(`/api/files${query}`, { method: 'GET' });
  },

  async uploadFile(data: { name: string; mimeType: string; size: number; data: string; projectId?: string }) {
    return request('/api/files/upload', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getFileData(id: string) {
    return request(`/api/files/${id}/data`, { method: 'GET' });
  },

  async deleteFile(id: string) {
    return request(`/api/files/${id}`, { method: 'DELETE' });
  },

  // Memories
  async getMemories() {
    return request('/api/memories', { method: 'GET' });
  },

  async addMemory(content: string, category?: string) {
    return request('/api/memories', {
      method: 'POST',
      body: JSON.stringify({ content, category }),
    });
  },

  async deleteMemory(id: string) {
    return request(`/api/memories/${id}`, { method: 'DELETE' });
  },

  async clearMemories() {
    return request('/api/memories', { method: 'DELETE' });
  },

  // Settings
  async getSettings() {
    return request('/api/settings', { method: 'GET' });
  },

  async updateSettings(data: any) {
    return request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async exportData() {
    return request('/api/settings/export', { method: 'GET' });
  },

  async clearChats() {
    return request('/api/settings/chats', { method: 'DELETE' });
  },
};
