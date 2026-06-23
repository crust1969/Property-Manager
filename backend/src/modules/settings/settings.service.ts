import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

const BCRYPT_ROUNDS = 10;

export interface UserProfile {
  name: string;
  email: string;
}

export interface UpdateProfileInput {
  name: string;
  email: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export class SettingsService {
  constructor(private app: FastifyInstance) {}

  getProfile(userId: string): UserProfile {
    const user = this.app.db
      .prepare('SELECT name, email FROM users WHERE id = ?')
      .get(userId) as { name: string; email: string } | undefined;

    if (!user) {
      const error = new Error('Benutzer nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    return { name: user.name, email: user.email };
  }

  updateProfile(userId: string, input: UpdateProfileInput): UserProfile {
    // Validate name length
    if (!input.name || input.name.trim().length === 0 || input.name.length > 100) {
      const error = new Error('Name muss zwischen 1 und 100 Zeichen lang sein') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!input.email || !emailRegex.test(input.email)) {
      const error = new Error('Ungültiges E-Mail-Format') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Check if email is already taken by another user
    const existing = this.app.db
      .prepare('SELECT id FROM users WHERE email = ? AND id != ?')
      .get(input.email, userId) as { id: string } | undefined;

    if (existing) {
      const error = new Error('E-Mail-Adresse wird bereits von einem anderen Benutzer verwendet') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    const now = new Date().toISOString();

    this.app.db
      .prepare('UPDATE users SET name = ?, email = ?, updated_at = ? WHERE id = ?')
      .run(input.name.trim(), input.email.trim(), now, userId);

    return { name: input.name.trim(), email: input.email.trim() };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    // Validate new password length
    if (!input.newPassword || input.newPassword.length < 8) {
      const error = new Error('Neues Passwort muss mindestens 8 Zeichen lang sein') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    // Get current password hash
    const user = this.app.db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(userId) as { password_hash: string } | undefined;

    if (!user) {
      const error = new Error('Benutzer nicht gefunden') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    // Verify current password
    const valid = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!valid) {
      const error = new Error('Aktuelles Passwort ist nicht korrekt') as Error & { statusCode: number };
      error.statusCode = 403;
      throw error;
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
    const now = new Date().toISOString();

    this.app.db
      .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
      .run(newHash, now, userId);
  }
}
