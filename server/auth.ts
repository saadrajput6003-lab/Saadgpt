import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  is_verified: number;
  created_at: number;
  updated_at: number;
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computedHash = crypto.scryptSync(password, salt, 64);
    const storedHash = Buffer.from(hash, 'hex');
    return crypto.timingSafeEqual(computedHash, storedHash);
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function createSession(userId: string): { token: string; expiresAt: number } {
  const sessionId = crypto.randomUUID();
  const token = generateToken();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = Date.now();

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(sessionId, userId, token, expiresAt, now);

  return { token, expiresAt };
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in.',
      code: 'AUTH_REQUIRED'
    });
    return;
  }

  const token = authHeader.substring(7).trim();
  const now = Date.now();

  try {
    const sessionQuery = db.prepare(`
      SELECT s.user_id, s.expires_at, u.id, u.email, u.name, u.avatar, u.is_verified, u.created_at, u.updated_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `);
    const row = sessionQuery.get(token) as any;

    if (!row) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired session. Please log in again.',
        code: 'INVALID_SESSION'
      });
      return;
    }

    if (row.expires_at < now) {
      // Clean up expired session
      db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
      res.status(401).json({
        success: false,
        error: 'Session expired. Please log in again.',
        code: 'SESSION_EXPIRED'
      });
      return;
    }

    req.user = {
      id: row.id,
      email: row.email,
      name: row.name,
      avatar: row.avatar,
      is_verified: row.is_verified,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
    req.sessionToken = token;
    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to verify session',
      code: 'SERVER_ERROR'
    });
  }
}
