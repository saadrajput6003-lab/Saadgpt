import { Router, Response } from 'express';
import crypto from 'node:crypto';
import { db } from './db.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  authenticate,
  AuthenticatedRequest,
} from './auth.js';
import { aiService, formatCleanErrorMessage } from './aiService.js';

export const router = Router();

// Helper for consistent JSON error response
function sendError(res: Response, status: number, error: string, code: string = 'API_ERROR') {
  const cleanMsg = formatCleanErrorMessage(error);
  return res.status(status).json({ success: false, error: cleanMsg, code });
}

// ----------------------------------------------------
// 1. AUTHENTICATION ROUTES
// ----------------------------------------------------

// Sign Up
router.post('/auth/signup', (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return sendError(res, 400, 'Name, email, and password are required', 'VALIDATION_ERROR');
    }

    const emailTrimmed = email.toLowerCase().trim();
    if (!emailTrimmed.includes('@') || emailTrimmed.length < 5) {
      return sendError(res, 400, 'Invalid email address', 'INVALID_EMAIL');
    }

    if (password.length < 6) {
      return sendError(res, 400, 'Password must be at least 6 characters long', 'WEAK_PASSWORD');
    }

    // Check existing
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(emailTrimmed);
    if (existing) {
      return sendError(res, 409, 'An account with this email already exists', 'EMAIL_EXISTS');
    }

    const userId = crypto.randomUUID();
    const { hash, salt } = hashPassword(password);
    const now = Date.now();

    db.prepare(`
      INSERT INTO users (id, email, password_hash, salt, name, avatar, is_verified, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(userId, emailTrimmed, hash, salt, name.trim(), null, now, now);

    // Create profile
    db.prepare(`
      INSERT INTO profiles (id, user_id, bio, preferred_model, theme, language, created_at)
      VALUES (?, ?, '', 'gemini-3.8-flash', 'dark', 'en', ?)
    `).run(crypto.randomUUID(), userId, now);

    // Create settings
    db.prepare(`
      INSERT INTO user_settings (id, user_id, memory_enabled, default_voice, theme, stream_speed, notification_sound, privacy_share, updated_at)
      VALUES (?, ?, 1, 'Kore', 'dark', 'normal', 1, 0, ?)
    `).run(crypto.randomUUID(), userId, now);

    const { token, expiresAt } = createSession(userId);

    const user = {
      id: userId,
      email: emailTrimmed,
      name: name.trim(),
      avatar: null,
      is_verified: 1,
      created_at: now,
      updated_at: now,
    };

    return res.status(201).json({
      success: true,
      token,
      expiresAt,
      user,
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Registration failed', 'SERVER_ERROR');
  }
});

// Login
router.post('/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, 'Email and password are required', 'VALIDATION_ERROR');
    }

    const emailTrimmed = email.toLowerCase().trim();
    const userRow = db.prepare(`
      SELECT id, email, password_hash, salt, name, avatar, is_verified, created_at, updated_at
      FROM users WHERE email = ?
    `).get(emailTrimmed) as any;

    if (!userRow) {
      return sendError(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const isValid = verifyPassword(password, userRow.password_hash, userRow.salt);
    if (!isValid) {
      return sendError(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const { token, expiresAt } = createSession(userRow.id);

    const user = {
      id: userRow.id,
      email: userRow.email,
      name: userRow.name,
      avatar: userRow.avatar,
      is_verified: userRow.is_verified,
      created_at: userRow.created_at,
      updated_at: userRow.updated_at,
    };

    return res.json({
      success: true,
      token,
      expiresAt,
      user,
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Login failed', 'SERVER_ERROR');
  }
});

// Forgot Password
router.post('/auth/forgot-password', (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return sendError(res, 400, 'Email is required', 'VALIDATION_ERROR');
    }

    const emailTrimmed = email.toLowerCase().trim();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(emailTrimmed) as any;

    if (!user) {
      // Don't leak user existence in production, but confirm request
      return res.json({
        success: true,
        message: 'If the email exists, a password reset token has been issued.',
      });
    }

    const resetToken = crypto.randomBytes(24).toString('hex');
    const expires = Date.now() + 3600000; // 1 hour

    db.prepare(`
      UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?
    `).run(resetToken, expires, user.id);

    return res.json({
      success: true,
      message: 'Password reset token generated. Use this token to reset your password.',
      resetToken, // Direct return for immediate self-service in the interface
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Password reset request failed', 'SERVER_ERROR');
  }
});

// Reset Password
router.post('/auth/reset-password', (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return sendError(res, 400, 'Reset token and new password are required', 'VALIDATION_ERROR');
    }

    if (newPassword.length < 6) {
      return sendError(res, 400, 'Password must be at least 6 characters long', 'WEAK_PASSWORD');
    }

    const now = Date.now();
    const user = db.prepare(`
      SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?
    `).get(resetToken, now) as any;

    if (!user) {
      return sendError(res, 400, 'Invalid or expired password reset token', 'INVALID_TOKEN');
    }

    const { hash, salt } = hashPassword(newPassword);

    db.prepare(`
      UPDATE users 
      SET password_hash = ?, salt = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = ?
      WHERE id = ?
    `).run(hash, salt, now, user.id);

    // Invalidate all existing sessions for security
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

    return res.json({
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Password reset failed', 'SERVER_ERROR');
  }
});

// Logout
router.post('/auth/logout', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    if (req.sessionToken) {
      db.prepare('DELETE FROM sessions WHERE token = ?').run(req.sessionToken);
    }
    return res.json({ success: true, message: 'Logged out successfully' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Logout failed', 'SERVER_ERROR');
  }
});

// Get Current User (Me)
router.get('/auth/me', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const profile = db.prepare('SELECT bio, preferred_model, theme, language FROM profiles WHERE user_id = ?').get(user.id) || {};
    const settings = db.prepare('SELECT memory_enabled, default_voice, theme, stream_speed, notification_sound, privacy_share FROM user_settings WHERE user_id = ?').get(user.id) || {};

    return res.json({
      success: true,
      user,
      profile,
      settings,
      geminiConfigured: aiService.isConfigured(),
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch user', 'SERVER_ERROR');
  }
});

// Update Profile
router.put('/auth/profile', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, bio, preferred_model, theme, language, avatar } = req.body;
    const now = Date.now();

    if (name) {
      db.prepare('UPDATE users SET name = ?, avatar = ?, updated_at = ? WHERE id = ?').run(
        name.trim(),
        avatar || null,
        now,
        userId
      );
    }

    db.prepare(`
      INSERT INTO profiles (id, user_id, bio, preferred_model, theme, language, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        bio = coalesce(excluded.bio, bio),
        preferred_model = coalesce(excluded.preferred_model, preferred_model),
        theme = coalesce(excluded.theme, theme),
        language = coalesce(excluded.language, language)
    `).run(
      crypto.randomUUID(),
      userId,
      bio || '',
      preferred_model || 'gemini-3.8-flash',
      theme || 'dark',
      language || 'en',
      now
    );

    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to update profile', 'SERVER_ERROR');
  }
});

// Change Password
router.put('/auth/password', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Current and new password are required', 'VALIDATION_ERROR');
    }

    if (newPassword.length < 6) {
      return sendError(res, 400, 'New password must be at least 6 characters', 'WEAK_PASSWORD');
    }

    const row = db.prepare('SELECT password_hash, salt FROM users WHERE id = ?').get(userId) as any;
    if (!row || !verifyPassword(currentPassword, row.password_hash, row.salt)) {
      return sendError(res, 400, 'Current password is incorrect', 'INVALID_PASSWORD');
    }

    const { hash, salt } = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?').run(
      hash,
      salt,
      Date.now(),
      userId
    );

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to change password', 'SERVER_ERROR');
  }
});

// Delete Account
router.delete('/auth/account', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    return res.json({ success: true, message: 'Account permanently deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete account', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 2. CONVERSATIONS & CHAT STREAMING
// ----------------------------------------------------

// List Conversations
router.get('/conversations', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { search, mode, projectId } = req.query;

    let query = `
      SELECT c.*, 
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
      FROM conversations c
      WHERE c.user_id = ?
    `;
    const params: any[] = [userId];

    if (mode) {
      query += ` AND c.mode = ?`;
      params.push(mode);
    }
    if (projectId) {
      query += ` AND c.project_id = ?`;
      params.push(projectId);
    }
    if (search && typeof search === 'string') {
      query += ` AND (c.title LIKE ? OR last_message LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY c.pinned DESC, c.updated_at DESC`;

    const conversations = db.prepare(query).all(...params);
    return res.json({ success: true, conversations });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch conversations', 'SERVER_ERROR');
  }
});

// Create Conversation
router.post('/conversations', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { title, mode, projectId, model } = req.body;
    const convId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO conversations (id, user_id, project_id, title, mode, model, pinned, archived, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(
      convId,
      userId,
      projectId || null,
      (title || 'New Chat').trim(),
      mode || 'chat',
      model || 'gemini-3.8-flash',
      now,
      now
    );

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    return res.status(201).json({ success: true, conversation: conv });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to create conversation', 'SERVER_ERROR');
  }
});

// Get Conversation with Messages
router.get('/conversations/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_id = ?').get(convId, userId);
    if (!conv) {
      return sendError(res, 404, 'Conversation not found', 'NOT_FOUND');
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(convId);

    const parsedMessages = messages.map((m: any) => ({
      ...m,
      metadata: m.metadata ? JSON.parse(m.metadata) : null,
    }));

    return res.json({
      success: true,
      conversation: conv,
      messages: parsedMessages,
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch conversation', 'SERVER_ERROR');
  }
});

// Update / Rename / Pin Conversation
router.put('/conversations/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;
    const { title, pinned, archived } = req.body;

    const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(convId, userId);
    if (!conv) {
      return sendError(res, 404, 'Conversation not found', 'NOT_FOUND');
    }

    const now = Date.now();
    if (title !== undefined) {
      db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(title.trim(), now, convId);
    }
    if (pinned !== undefined) {
      db.prepare('UPDATE conversations SET pinned = ?, updated_at = ? WHERE id = ?').run(pinned ? 1 : 0, now, convId);
    }
    if (archived !== undefined) {
      db.prepare('UPDATE conversations SET archived = ?, updated_at = ? WHERE id = ?').run(archived ? 1 : 0, now, convId);
    }

    const updated = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    return res.json({ success: true, conversation: updated });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to update conversation', 'SERVER_ERROR');
  }
});

// Delete Conversation
router.delete('/conversations/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const convId = req.params.id;

    const result = db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(convId, userId);
    if (result.changes === 0) {
      return sendError(res, 404, 'Conversation not found', 'NOT_FOUND');
    }

    return res.json({ success: true, message: 'Conversation deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete conversation', 'SERVER_ERROR');
  }
});

// Chat Streaming SSE Endpoint
router.post('/chat/stream', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      conversationId,
      message,
      attachments = [],
      model = 'gemini-3.8-flash',
      enableSearch = false,
      mode = 'chat',
    } = req.body;

    if (!message && attachments.length === 0) {
      return sendError(res, 400, 'Message content or attachment required', 'VALIDATION_ERROR');
    }

    let activeConvId = conversationId;
    const now = Date.now();

    // Auto-create conversation if none provided
    if (!activeConvId) {
      activeConvId = crypto.randomUUID();
      const firstLine = (message || 'Multimodal analysis').split('\n')[0].slice(0, 40);
      db.prepare(`
        INSERT INTO conversations (id, user_id, title, mode, model, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(activeConvId, userId, firstLine, mode, model, now, now);
    }

    // Save user message to database
    const userMsgId = crypto.randomUUID();
    const userMetadata = attachments.length > 0 ? JSON.stringify({ attachments }) : null;
    db.prepare(`
      INSERT INTO messages (id, conversation_id, user_id, role, content, metadata, created_at)
      VALUES (?, ?, ?, 'user', ?, ?, ?)
    `).run(userMsgId, activeConvId, userId, message || '', userMetadata, now);

    // Update conversation timestamp & auto-title if first message
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, activeConvId);

    // Fetch memory context if enabled
    const settings = db.prepare('SELECT memory_enabled FROM user_settings WHERE user_id = ?').get(userId) as any;
    let memoryContext = '';
    if (settings && settings.memory_enabled) {
      const memories = db.prepare('SELECT content FROM memories WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId) as any[];
      if (memories.length > 0) {
        memoryContext = `\nUser's persistent memories to keep in mind:\n` + memories.map((m) => `- ${m.content}`).join('\n');
      }
    }

    // Fetch previous 10 messages from conversation for conversational context
    const previousMessages = db.prepare(`
      SELECT role, content, metadata FROM messages 
      WHERE conversation_id = ? 
      ORDER BY created_at ASC 
      LIMIT 20
    `).all(activeConvId) as any[];

    // Build ChatMessage contents
    const contents: any[] = [];
    for (const msg of previousMessages) {
      const parts: any[] = [];
      if (msg.metadata) {
        try {
          const meta = JSON.parse(msg.metadata);
          if (meta.attachments && Array.isArray(meta.attachments)) {
            for (const att of meta.attachments) {
              if (att.data && att.mimeType) {
                // Strip data url prefix if present
                const cleanBase64 = att.data.includes(',') ? att.data.split(',')[1] : att.data;
                parts.push({
                  inlineData: {
                    mimeType: att.mimeType,
                    data: cleanBase64,
                  },
                });
              }
            }
          }
        } catch {}
      }
      if (msg.content) {
        parts.push({ text: msg.content });
      }
      contents.push({
        role: msg.role === 'model' ? 'model' : 'user',
        parts,
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send conversationId first
    res.write(`data: ${JSON.stringify({ type: 'start', conversationId: activeConvId, userMessageId: userMsgId })}\n\n`);

    let accumulatedText = '';
    let sources: any[] = [];

    const systemInstruction = `You are SaadGPT, an ultra-capable sovereign AI assistant. You produce deep, accurate, elegantly structured responses using standard Markdown, LaTeX formulas when needed ($..$ or $$..$$), and pristine code blocks with syntax tags. When analyzing uploaded files or images, be thorough and insightful.${memoryContext}`;

    try {
      for await (const chunk of aiService.streamChat({
        model,
        systemInstruction,
        enableSearch,
        contents,
      })) {
        accumulatedText += chunk.text;
        if (chunk.groundingSources && chunk.groundingSources.length > 0) {
          sources = chunk.groundingSources;
        }

        res.write(`data: ${JSON.stringify({
          type: 'chunk',
          delta: chunk.text,
          sources: chunk.groundingSources,
        })}\n\n`);
      }

      // Save assistant message to database
      const assistantMsgId = crypto.randomUUID();
      const assistantMeta = sources.length > 0 ? JSON.stringify({ sources }) : null;
      db.prepare(`
        INSERT INTO messages (id, conversation_id, user_id, role, content, metadata, created_at)
        VALUES (?, ?, ?, 'model', ?, ?, ?)
      `).run(assistantMsgId, activeConvId, userId, accumulatedText, assistantMeta, Date.now());

      res.write(`data: ${JSON.stringify({
        type: 'done',
        messageId: assistantMsgId,
        fullText: accumulatedText,
        sources,
      })}\n\n`);
      res.end();
    } catch (streamErr: any) {
      const cleanMsg = formatCleanErrorMessage(streamErr);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        error: cleanMsg,
      })}\n\n`);
      res.end();
    }
  } catch (err: any) {
    if (!res.headersSent) {
      return sendError(res, 500, err.message || 'Failed to start stream', 'STREAM_ERROR');
    }
  }
});

// Delete Single Message
router.delete('/messages/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const msgId = req.params.id;

    const result = db.prepare('DELETE FROM messages WHERE id = ? AND user_id = ?').run(msgId, userId);
    if (result.changes === 0) {
      return sendError(res, 404, 'Message not found', 'NOT_FOUND');
    }

    return res.json({ success: true, message: 'Message deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete message', 'SERVER_ERROR');
  }
});

// React to Message (like, dislike, heart, or null to remove)
router.put('/messages/:id/reaction', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const msgId = req.params.id;
    const { reaction } = req.body;

    if (reaction !== null && reaction !== undefined && !['like', 'dislike', 'heart'].includes(reaction)) {
      return sendError(res, 400, 'Invalid reaction. Supported values: like, dislike, heart, or null', 'INVALID_REACTION');
    }

    const cleanReaction = reaction || null;

    // Verify message exists and user has access
    const msg = db.prepare('SELECT id, user_id, conversation_id FROM messages WHERE id = ?').get(msgId) as any;
    if (!msg) {
      return sendError(res, 404, 'Message not found', 'NOT_FOUND');
    }

    const conv = db.prepare('SELECT id FROM conversations WHERE id = ? AND user_id = ?').get(msg.conversation_id, userId);
    if (!conv && msg.user_id !== userId) {
      return sendError(res, 403, 'Unauthorized access to message reaction', 'FORBIDDEN');
    }

    db.prepare('UPDATE messages SET reaction = ? WHERE id = ?').run(cleanReaction, msgId);

    return res.json({
      success: true,
      messageId: msgId,
      reaction: cleanReaction,
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to update reaction', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 3. IMAGE STUDIO
// ----------------------------------------------------

router.get('/images', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const images = db.prepare('SELECT * FROM generated_images WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return res.json({ success: true, images });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch images', 'SERVER_ERROR');
  }
});

router.post('/images/generate', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { prompt, aspectRatio = '1:1', referenceImage, referenceMime, quality = 'standard', style = 'Realistic' } = req.body;

    if (!prompt) {
      return sendError(res, 400, 'Image prompt is required', 'VALIDATION_ERROR');
    }

    let cleanBase64 = referenceImage;
    if (cleanBase64 && cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    const result = await aiService.generateImage({
      prompt: `${prompt} (Style: ${style})`,
      aspectRatio,
      referenceImageBase64: cleanBase64,
      referenceImageMime: referenceMime || 'image/png',
      quality,
    });

    const imgId = crypto.randomUUID();
    const now = Date.now();
    const model = quality === 'high' ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';

    db.prepare(`
      INSERT INTO generated_images (id, user_id, prompt, model, aspect_ratio, image_data, style, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(imgId, userId, prompt, model, aspectRatio, result.imageUrl, style, now);

    const record = db.prepare('SELECT * FROM generated_images WHERE id = ?').get(imgId);
    return res.status(201).json({ success: true, image: record });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Image generation failed', 'GENERATION_ERROR');
  }
});

router.delete('/images/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const imgId = req.params.id;

    db.prepare('DELETE FROM generated_images WHERE id = ? AND user_id = ?').run(imgId, userId);
    return res.json({ success: true, message: 'Image deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete image', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 4. VIDEO STUDIO
// ----------------------------------------------------

router.get('/videos', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const videos = db.prepare('SELECT * FROM video_jobs WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return res.json({ success: true, videos });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch videos', 'SERVER_ERROR');
  }
});

router.post('/videos/generate', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { prompt, duration = '10s', resolution = '720p', aspectRatio = '16:9', referenceImage, referenceMime } = req.body;

    if (!prompt) {
      return sendError(res, 400, 'Video prompt is required', 'VALIDATION_ERROR');
    }

    const jobId = crypto.randomUUID();
    const now = Date.now();

    // Insert pending job record
    db.prepare(`
      INSERT INTO video_jobs (id, user_id, prompt, duration, resolution, aspect_ratio, status, progress, pipeline_step, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'processing', 15, 'pipeline_initialized', ?)
    `).run(jobId, userId, prompt, duration, resolution, aspectRatio, now);

    let cleanBase64 = referenceImage;
    if (cleanBase64 && cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    try {
      const result = await aiService.createVideoInteraction({
        prompt,
        duration,
        resolution,
        aspectRatio,
        referenceImageBase64: cleanBase64,
        referenceImageMime: referenceMime,
      });

      db.prepare(`
        UPDATE video_jobs 
        SET status = ?, progress = 100, pipeline_step = 'completed', result_url = ?
        WHERE id = ?
      `).run(result.status, result.videoUrl || null, jobId);

      const jobRecord = db.prepare('SELECT * FROM video_jobs WHERE id = ?').get(jobId);
      return res.status(201).json({
        success: true,
        job: jobRecord,
        explanation: result.explanation,
      });
    } catch (genErr: any) {
      db.prepare(`
        UPDATE video_jobs 
        SET status = 'failed', error = ?, pipeline_step = 'error'
        WHERE id = ?
      `).run(genErr.message, jobId);

      return sendError(res, 500, genErr.message, 'VIDEO_GENERATION_FAILED');
    }
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to initiate video generation', 'SERVER_ERROR');
  }
});

router.delete('/videos/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const jobId = req.params.id;

    db.prepare('DELETE FROM video_jobs WHERE id = ? AND user_id = ?').run(jobId, userId);
    return res.json({ success: true, message: 'Video record deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete video', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 5. TEXT-TO-VOICE STUDIO & SPEECH
// ----------------------------------------------------

router.post('/voice/tts', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { text, voice = 'Kore', style } = req.body;

    if (!text || !text.trim()) {
      return sendError(res, 400, 'Speech text is required', 'VALIDATION_ERROR');
    }

    const result = await aiService.generateSpeech({ text: text.trim(), voice, style });

    const audioId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO generated_audio (id, user_id, text, voice, audio_data, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(audioId, userId, text.trim(), voice, result.audioDataUrl, now);

    const record = db.prepare('SELECT * FROM generated_audio WHERE id = ?').get(audioId);
    return res.json({ success: true, audio: record });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Speech generation failed', 'TTS_ERROR');
  }
});

router.get('/voice/history', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const audioList = db.prepare('SELECT * FROM generated_audio WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return res.json({ success: true, audioList });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch voice history', 'SERVER_ERROR');
  }
});

router.post('/voice/transcribe', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { audioData, mimeType = 'audio/webm' } = req.body;
    if (!audioData) {
      return sendError(res, 400, 'Audio data is required', 'VALIDATION_ERROR');
    }

    let cleanBase64 = audioData;
    if (cleanBase64.includes(',')) {
      cleanBase64 = cleanBase64.split(',')[1];
    }

    const transcript = await aiService.transcribeAudio(cleanBase64, mimeType);
    return res.json({ success: true, transcript });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Audio transcription failed', 'TRANSCRIPTION_ERROR');
  }
});

// Live Voice Session Save
router.post('/voice/sessions', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { title, durationSeconds = 0, transcript = '' } = req.body;

    const sessId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO voice_sessions (id, user_id, title, duration_seconds, transcript, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessId, userId, title || 'Live Voice Conversation', durationSeconds, transcript, now);

    const record = db.prepare('SELECT * FROM voice_sessions WHERE id = ?').get(sessId);
    return res.status(201).json({ success: true, session: record });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to save voice session', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 6. STUDY MODE & CODING MODE
// ----------------------------------------------------

router.post('/modes/study', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { documentText, prompt, task = 'summary' } = req.body;
    if (!documentText && !prompt) {
      return sendError(res, 400, 'Document content or study prompt is required', 'VALIDATION_ERROR');
    }

    const systemInstruction = `You are the SaadGPT Master Tutor. You transform academic documents, research papers, notes, and study guides into high-yield educational material. 
Format with crystal-clear markdown, key terms in bold, bulleted core concepts, and structured sections.`;

    let instruction = '';
    switch (task) {
      case 'summary':
        instruction = 'Provide an executive summary, high-yield overview, and the top 5 key takeaways.';
        break;
      case 'explain_simply':
        instruction = 'Explain this concept using the Feynman technique (clear analogies, zero unnecessary jargon, intuitive breakdowns).';
        break;
      case 'chapter_breakdown':
        instruction = 'Provide a structured chapter-by-chapter / section-by-section breakdown with core definitions.';
        break;
      case 'mcq_quiz':
        instruction = 'Generate 5 rigorous multiple-choice questions (MCQs) with 4 options each (A, B, C, D), indicating the correct answer and a thorough explanatory rationale for each.';
        break;
      case 'flashcards':
        instruction = 'Generate 6 high-yield flashcards in Front (Question/Concept) and Back (Answer/Intuition) format.';
        break;
      case 'study_plan':
        instruction = 'Create a structured, phased study plan (Day 1 to Exam Day) with actionable milestones.';
        break;
      default:
        instruction = 'Analyze and assist with this study material.';
    }

    const contents = [
      {
        role: 'user' as const,
        parts: [
          {
            text: `TASK: ${instruction}\n\nSTUDY MATERIAL / PROMPT:\n${documentText || ''}\n\nSPECIFIC FOCUS: ${prompt || 'Complete review'}`,
          },
        ],
      },
    ];

    const result = await aiService.generateText({
      contents,
      systemInstruction,
    });

    return res.json({ success: true, result: result.text });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Study assistance failed', 'STUDY_ERROR');
  }
});

router.post('/modes/coding', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { code, prompt, language = 'typescript', action = 'explain' } = req.body;
    if (!code && !prompt) {
      return sendError(res, 400, 'Code snippet or coding prompt is required', 'VALIDATION_ERROR');
    }

    const systemInstruction = `You are the SaadGPT Principal Software Architect. You deliver production-ready, performant, secure code with clean explanations, time/space complexity analysis, and robust error handling. Always format code blocks with language tags.`;

    let taskPrompt = '';
    switch (action) {
      case 'generate':
        taskPrompt = `Write clean, robust, production-quality code in ${language} to satisfy:\n${prompt}`;
        break;
      case 'explain':
        taskPrompt = `Explain step-by-step how this ${language} code works, its algorithmic design, and architectural patterns:\n\`\`\`${language}\n${code}\n\`\`\``;
        break;
      case 'debug':
        taskPrompt = `Debug this ${language} code. Identify bugs, race conditions, edge-case vulnerabilities, or logic errors, explain why they occur, and provide the corrected code:\n\`\`\`${language}\n${code}\n\`\`\`\nContext/Errors: ${prompt || 'None provided'}`;
        break;
      case 'refactor':
        taskPrompt = `Refactor this ${language} code for maximum readability, modern idiomatic standards, and performance optimization:\n\`\`\`${language}\n${code}\n\`\`\``;
        break;
      case 'test':
        taskPrompt = `Write a comprehensive test suite (unit tests with edge cases) in ${language} for:\n\`\`\`${language}\n${code}\n\`\`\``;
        break;
      default:
        taskPrompt = prompt;
    }

    const result = await aiService.generateText({
      contents: [{ role: 'user', parts: [{ text: taskPrompt }] }],
      systemInstruction,
    });

    return res.json({ success: true, result: result.text });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Coding assistance failed', 'CODING_ERROR');
  }
});

// ----------------------------------------------------
// 7. RESEARCH & DEEP RESEARCH
// ----------------------------------------------------

router.post('/research/quick', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return sendError(res, 400, 'Research query is required', 'VALIDATION_ERROR');
    }

    const result = await aiService.generateText({
      contents: [
        {
          role: 'user',
          parts: [{ text: `Conduct a real-time web-grounded research inquiry on: "${query}". Provide verified facts, recent developments, and direct source citations.` }],
        },
      ],
      enableSearch: true,
      systemInstruction: 'You are SaadGPT Research Engine. Always substantiate claims with real web search grounding citations.',
    });

    return res.json({
      success: true,
      report: result.text,
      sources: result.sources,
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Research inquiry failed', 'RESEARCH_ERROR');
  }
});

router.post('/research/deep', authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { query, depth = 'deep' } = req.body;

    if (!query || !query.trim()) {
      return sendError(res, 400, 'Deep research query is required', 'VALIDATION_ERROR');
    }

    const jobId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO research_jobs (id, user_id, query, depth, status, created_at)
      VALUES (?, ?, ?, ?, 'in_progress', ?)
    `).run(jobId, userId, query.trim(), depth, now);

    const steps: string[] = [];
    const result = await aiService.executeDeepResearch(query.trim(), (step) => {
      steps.push(step);
    });

    db.prepare(`
      UPDATE research_jobs 
      SET status = 'completed', steps = ?, sources = ?, report = ?
      WHERE id = ?
    `).run(
      JSON.stringify(steps),
      JSON.stringify(result.sources),
      result.report,
      jobId
    );

    const completedJob = db.prepare('SELECT * FROM research_jobs WHERE id = ?').get(jobId) as any;
    return res.json({
      success: true,
      job: {
        ...completedJob,
        steps: JSON.parse(completedJob.steps || '[]'),
        sources: JSON.parse(completedJob.sources || '[]'),
      },
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Deep research execution failed', 'DEEP_RESEARCH_ERROR');
  }
});

router.get('/research/jobs', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const jobs = db.prepare('SELECT * FROM research_jobs WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[];

    const parsed = jobs.map((j) => ({
      ...j,
      steps: j.steps ? JSON.parse(j.steps) : [],
      sources: j.sources ? JSON.parse(j.sources) : [],
    }));

    return res.json({ success: true, jobs: parsed });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch research history', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 8. PROJECTS
// ----------------------------------------------------

router.get('/projects', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const projects = db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM conversations WHERE project_id = p.id) as chat_count,
        (SELECT COUNT(*) FROM files WHERE project_id = p.id) as file_count
      FROM projects p
      WHERE p.user_id = ?
      ORDER BY p.updated_at DESC
    `).all(userId);

    return res.json({ success: true, projects });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch projects', 'SERVER_ERROR');
  }
});

router.post('/projects', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, description = '', category = 'Personal', instructions = '' } = req.body;

    if (!name || !name.trim()) {
      return sendError(res, 400, 'Project name is required', 'VALIDATION_ERROR');
    }

    const projId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO projects (id, user_id, name, description, category, instructions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(projId, userId, name.trim(), description.trim(), category, instructions.trim(), now, now);

    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projId);
    return res.status(201).json({ success: true, project });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to create project', 'SERVER_ERROR');
  }
});

router.put('/projects/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const projId = req.params.id;
    const { name, description, category, instructions } = req.body;

    const exists = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(projId, userId);
    if (!exists) {
      return sendError(res, 404, 'Project not found', 'NOT_FOUND');
    }

    db.prepare(`
      UPDATE projects 
      SET name = coalesce(?, name),
          description = coalesce(?, description),
          category = coalesce(?, category),
          instructions = coalesce(?, instructions),
          updated_at = ?
      WHERE id = ?
    `).run(name, description, category, instructions, Date.now(), projId);

    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(projId);
    return res.json({ success: true, project: updated });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to update project', 'SERVER_ERROR');
  }
});

router.delete('/projects/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const projId = req.params.id;

    db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(projId, userId);
    return res.json({ success: true, message: 'Project deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete project', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 9. FILE SYSTEM STORAGE
// ----------------------------------------------------

router.get('/files', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { projectId } = req.query;

    let query = 'SELECT id, user_id, project_id, name, mime_type, size, created_at FROM files WHERE user_id = ?';
    const params: any[] = [userId];

    if (projectId) {
      query += ' AND project_id = ?';
      params.push(projectId);
    }

    query += ' ORDER BY created_at DESC';
    const files = db.prepare(query).all(...params);
    return res.json({ success: true, files });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch files', 'SERVER_ERROR');
  }
});

router.post('/files/upload', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { name, mimeType, size, data, projectId } = req.body;

    if (!name || !data) {
      return sendError(res, 400, 'File name and data are required', 'VALIDATION_ERROR');
    }

    // Maximum 25MB limit
    if (size && size > 25 * 1024 * 1024) {
      return sendError(res, 413, 'File size exceeds maximum 25MB limit', 'FILE_TOO_LARGE');
    }

    const fileId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO files (id, user_id, project_id, name, mime_type, size, data, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(fileId, userId, projectId || null, name, mimeType || 'application/octet-stream', size || 0, data, now);

    const record = db.prepare('SELECT id, user_id, project_id, name, mime_type, size, created_at FROM files WHERE id = ?').get(fileId);
    return res.status(201).json({ success: true, file: record });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'File upload failed', 'SERVER_ERROR');
  }
});

router.get('/files/:id/data', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const fileId = req.params.id;

    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, userId) as any;
    if (!file) {
      return sendError(res, 404, 'File not found', 'NOT_FOUND');
    }

    return res.json({
      success: true,
      file: {
        id: file.id,
        name: file.name,
        mime_type: file.mime_type,
        size: file.size,
        data: file.data,
      },
    });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to retrieve file', 'SERVER_ERROR');
  }
});

router.delete('/files/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const fileId = req.params.id;

    db.prepare('DELETE FROM files WHERE id = ? AND user_id = ?').run(fileId, userId);
    return res.json({ success: true, message: 'File deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete file', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 10. AI MEMORY
// ----------------------------------------------------

router.get('/memories', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const memories = db.prepare('SELECT * FROM memories WHERE user_id = ? ORDER BY created_at DESC').all(userId);
    return res.json({ success: true, memories });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch memories', 'SERVER_ERROR');
  }
});

router.post('/memories', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { content, category = 'general' } = req.body;

    if (!content || !content.trim()) {
      return sendError(res, 400, 'Memory content is required', 'VALIDATION_ERROR');
    }

    const memId = crypto.randomUUID();
    const now = Date.now();

    db.prepare(`
      INSERT INTO memories (id, user_id, content, category, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(memId, userId, content.trim(), category, now);

    const record = db.prepare('SELECT * FROM memories WHERE id = ?').get(memId);
    return res.status(201).json({ success: true, memory: record });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to add memory', 'SERVER_ERROR');
  }
});

router.delete('/memories/:id', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const memId = req.params.id;

    db.prepare('DELETE FROM memories WHERE id = ? AND user_id = ?').run(memId, userId);
    return res.json({ success: true, message: 'Memory deleted' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to delete memory', 'SERVER_ERROR');
  }
});

router.delete('/memories', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    db.prepare('DELETE FROM memories WHERE user_id = ?').run(userId);
    return res.json({ success: true, message: 'All memories cleared' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to clear memories', 'SERVER_ERROR');
  }
});

// ----------------------------------------------------
// 11. SETTINGS & DATA EXPORT
// ----------------------------------------------------

router.get('/settings', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    return res.json({ success: true, settings });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to fetch settings', 'SERVER_ERROR');
  }
});

router.put('/settings', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const { memory_enabled, default_voice, theme, stream_speed, notification_sound, privacy_share } = req.body;

    db.prepare(`
      UPDATE user_settings
      SET memory_enabled = coalesce(?, memory_enabled),
          default_voice = coalesce(?, default_voice),
          theme = coalesce(?, theme),
          stream_speed = coalesce(?, stream_speed),
          notification_sound = coalesce(?, notification_sound),
          privacy_share = coalesce(?, privacy_share),
          updated_at = ?
      WHERE user_id = ?
    `).run(
      memory_enabled !== undefined ? (memory_enabled ? 1 : 0) : null,
      default_voice,
      theme,
      stream_speed,
      notification_sound !== undefined ? (notification_sound ? 1 : 0) : null,
      privacy_share !== undefined ? (privacy_share ? 1 : 0) : null,
      Date.now(),
      userId
    );

    const updated = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
    return res.json({ success: true, settings: updated });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to update settings', 'SERVER_ERROR');
  }
});

// Full Data Export
router.get('/settings/export', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = req.user!;
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
    const conversations = db.prepare('SELECT * FROM conversations WHERE user_id = ?').all(userId);
    const messages = db.prepare('SELECT * FROM messages WHERE user_id = ?').all(userId);
    const projects = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(userId);
    const memories = db.prepare('SELECT * FROM memories WHERE user_id = ?').all(userId);
    const images = db.prepare('SELECT id, prompt, model, aspect_ratio, style, created_at FROM generated_images WHERE user_id = ?').all(userId);
    const audio = db.prepare('SELECT id, text, voice, created_at FROM generated_audio WHERE user_id = ?').all(userId);

    const exportPayload = {
      exportDate: new Date().toISOString(),
      platform: 'SaadGPT',
      user: { id: user.id, email: user.email, name: user.name },
      profile,
      projects,
      conversations,
      messages,
      memories,
      imageGenerations: images,
      audioGenerations: audio,
    };

    return res.json({ success: true, data: exportPayload });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to export data', 'SERVER_ERROR');
  }
});

// Clear All Chats
router.delete('/settings/chats', authenticate, (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.id;
    db.prepare('DELETE FROM conversations WHERE user_id = ?').run(userId);
    return res.json({ success: true, message: 'All conversations deleted permanently' });
  } catch (err: any) {
    return sendError(res, 500, err.message || 'Failed to clear conversations', 'SERVER_ERROR');
  }
});
