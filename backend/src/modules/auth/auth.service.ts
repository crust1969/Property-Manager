import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { FastifyInstance } from 'fastify';
import type { RegisterInput, LoginInput } from './auth.validators.js';

const BCRYPT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export class AuthService {
  constructor(private app: FastifyInstance) {}

  async register(input: RegisterInput): Promise<AuthTokens & { user: { id: string; email: string; name: string } }> {
    const { email, password, name } = input;

    // Check if user already exists
    const existing = this.app.db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(email) as { id: string } | undefined;

    if (existing) {
      const error = new Error('E-Mail-Adresse ist bereits registriert') as Error & { statusCode: number };
      error.statusCode = 409;
      throw error;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Create user
    const id = uuidv4();
    const now = new Date().toISOString();

    this.app.db
      .prepare(
        'INSERT INTO users (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, email, passwordHash, name, now, now);

    // Generate tokens
    const tokens = this.generateTokens({ userId: id, email });

    return { ...tokens, user: { id, email, name } };
  }

  async login(input: LoginInput): Promise<AuthTokens & { user: { id: string; email: string; name: string } }> {
    const { email, password } = input;

    // Find user by email
    const user = this.app.db
      .prepare('SELECT id, email, password_hash, name FROM users WHERE email = ?')
      .get(email) as Pick<UserRecord, 'id' | 'email' | 'password_hash' | 'name'> | undefined;

    if (!user) {
      const error = new Error('Ungültige Anmeldedaten') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      const error = new Error('Ungültige Anmeldedaten') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }

    // Generate tokens
    const tokens = this.generateTokens({ userId: user.id, email: user.email });

    return { ...tokens, user: { id: user.id, email: user.email, name: user.name } };
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const decoded = this.app.jwt.verify<{ userId: string; email: string; type: string }>(refreshToken);

      if (decoded.type !== 'refresh') {
        const error = new Error('Ungültiger Refresh-Token') as Error & { statusCode: number };
        error.statusCode = 401;
        throw error;
      }

      // Verify user still exists
      const user = this.app.db
        .prepare('SELECT id, email FROM users WHERE id = ?')
        .get(decoded.userId) as Pick<UserRecord, 'id' | 'email'> | undefined;

      if (!user) {
        const error = new Error('Ungültiger Refresh-Token') as Error & { statusCode: number };
        error.statusCode = 401;
        throw error;
      }

      // Issue new access token
      const accessToken = this.app.jwt.sign(
        { userId: user.id, email: user.email },
        { expiresIn: ACCESS_TOKEN_EXPIRY }
      );

      return { accessToken };
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'statusCode' in err) {
        throw err;
      }
      const error = new Error('Ungültiger Refresh-Token') as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }
  }

  private generateTokens(payload: { userId: string; email: string }): AuthTokens {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sign = this.app.jwt.sign as (payload: any, options?: any) => string;
    const accessToken = sign(payload, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = sign(
      { ...payload, type: 'refresh' },
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );

    return { accessToken, refreshToken };
  }
}
