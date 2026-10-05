import { Router, type Request, type Response } from 'express';
import { ObjectId } from 'mongodb';
import { getDatabase, getMongoClient } from '../../core/database/mongodb';
import {
  createOpaqueToken,
  expiredSessionCookie,
  hashPassword,
  hashToken,
  readCookie,
  SESSION_COOKIE,
  SESSION_LIFETIME_MS,
  sessionCookie,
  verifyPassword,
} from '../../core/auth/security';
import { sendAuthEmail } from '../../integrations/email/resend-email.adapter';
import { authRateLimit } from '../../core/auth/rate-limit';
import { getSessionUser, type AuthenticatedUser } from '../../core/auth/session';

type UserRecord = AuthenticatedUser;

const router = Router();
const publicUser = (user: UserRecord) => ({
  id: user._id.toHexString(),
  name: user.name,
  email: user.email,
  isEmailVerified: user.isEmailVerified,
});

function bodyString(request: Request, key: string): string {
  const value = (request.body as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function bodyValue(request: Request, key: string): string {
  const value = (request.body as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value : '';
}

function fail(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ success: false, error: { code, message } });
}

function frontendUrl(path: string, token: string): string {
  const origin = process.env['WEB_ORIGIN'] || 'http://localhost:4200';
  return `${origin.replace(/\/$/, '')}/auth?${path}=${encodeURIComponent(token)}`;
}

async function sendVerification(user: UserRecord): Promise<void> {
  const token = createOpaqueToken();
  const database = await getDatabase();
  await database.collection('auth_tokens').insertOne({
    userId: user._id,
    tokenHash: hashToken(token),
    purpose: 'email_verification',
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    createdAt: new Date(),
  });
  const link = frontendUrl('verify', token);
  await sendAuthEmail(
    user.email,
    'Verify your Make My Marriage account',
    `<p>Hello ${escapeHtml(user.name)},</p><p>Confirm your email to activate your account:</p><p><a href="${link}">Verify email address</a></p><p>This link expires in 24 hours.</p>`,
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character] ?? character);
}

router.post('/register', authRateLimit(5), async (request, response) => {
  let createdUser: UserRecord | undefined;
  try {
    const name = bodyString(request, 'name');
    const email = bodyString(request, 'email').toLowerCase();
    const password = bodyValue(request, 'password');
    if (name.length < 2 || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || password.length > 128) {
      fail(response, 400, 'AUTH_INVALID_REQUEST', 'Enter a valid name, email, and password of at least 8 characters.');
      return;
    }
    const database = await getDatabase();
    const users = database.collection<UserRecord>('users');
    if (await users.findOne({ email })) {
      fail(response, 409, 'AUTH_EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
      return;
    }
    const now = new Date();
    const user: UserRecord = {
      _id: new ObjectId(), name, email, passwordHash: await hashPassword(password),
      isEmailVerified: false, status: 'active', createdAt: now, updatedAt: now,
    };
    try {
      await users.insertOne(user);
    } catch (error) {
      await users.deleteOne({ _id: user._id });
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        fail(response, 409, 'AUTH_EMAIL_ALREADY_REGISTERED', 'An account with this email already exists.');
        return;
      }
      throw error;
    }
    createdUser = user;
    await sendVerification(user);
    response.status(201).json({ success: true, data: { user: publicUser(user) } });
  } catch {
    if (createdUser) {
      const database = await getDatabase().catch(() => null);
      await database?.collection('auth_tokens').deleteMany({ userId: createdUser._id, purpose: 'email_verification' });
      await database?.collection('users').deleteOne({ _id: createdUser._id, isEmailVerified: false });
    }
    fail(
      response,
      503,
      createdUser ? 'AUTH_EMAIL_DELIVERY_FAILED' : 'AUTH_SERVICE_UNAVAILABLE',
      createdUser ? 'We could not send your verification email. Please try again.' : 'Account registration is temporarily unavailable. Please try again.',
    );
  }
});

router.get('/verify-email', authRateLimit(10), async (request, response) => {
  const token = typeof request.query['token'] === 'string' ? request.query['token'] : '';
  if (!token) { fail(response, 400, 'AUTH_VERIFICATION_TOKEN_INVALID', 'This verification link is invalid or expired.'); return; }
  try {
    const database = await getDatabase();
    const authToken = await database.collection('auth_tokens').findOneAndUpdate({
      tokenHash: hashToken(token), purpose: 'email_verification', expiresAt: { $gt: new Date() }, usedAt: { $exists: false },
    }, { $set: { usedAt: new Date() } }, { returnDocument: 'after' });
    if (!authToken || !(authToken['userId'] instanceof ObjectId)) {
      const usedToken = await database.collection('auth_tokens').findOne({ tokenHash: hashToken(token), purpose: 'email_verification', usedAt: { $exists: true } });
      if (usedToken) {
        fail(response, 400, 'AUTH_VERIFICATION_TOKEN_USED', 'This verification link has already been used. You can sign in now.');
        return;
      }
      fail(response, 400, 'AUTH_VERIFICATION_TOKEN_INVALID', 'This verification link is invalid or expired.');
      return;
    }
    try {
      const result = await database.collection('users').updateOne(
        { _id: authToken['userId'], status: 'active' },
        { $set: { isEmailVerified: true, emailVerifiedAt: new Date(), updatedAt: new Date() } },
      );
      if (!result.matchedCount) {
        await database.collection('auth_tokens').updateOne({ _id: authToken['_id'] }, { $unset: { usedAt: '' } });
        fail(response, 400, 'AUTH_VERIFICATION_TOKEN_INVALID', 'This verification link is invalid or expired.');
        return;
      }
    } catch (error) {
      await database.collection('auth_tokens').updateOne({ _id: authToken['_id'] }, { $unset: { usedAt: '' } }).catch(() => undefined);
      throw error;
    }
    response.json({ success: true, data: { message: 'Email verified. Your account is ready.' } });
  } catch {
    fail(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Email verification is temporarily unavailable. Please try again.');
  }
});

router.post('/resend-verification', authRateLimit(5), async (request, response) => {
  const email = bodyString(request, 'email').toLowerCase();
  try {
    const database = await getDatabase();
    const user = await database.collection<UserRecord>('users').findOne({ email, status: 'active', isEmailVerified: false });
    if (user) await sendVerification(user);
    response.json({ success: true, data: { message: 'If that account needs verification, a new link has been sent.' } });
  } catch {
    fail(response, 503, 'AUTH_EMAIL_DELIVERY_FAILED', 'We could not send a verification email right now. Please try again.');
  }
});

router.post('/login', authRateLimit(10), async (request, response) => {
  const email = bodyString(request, 'email').toLowerCase();
  const password = bodyValue(request, 'password');
  try {
    const database = await getDatabase();
    const user = await database.collection<UserRecord>('users').findOne({ email, status: 'active' });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
       fail(response, 401, 'AUTH_INVALID_CREDENTIALS', 'Email or password is incorrect.');
      return;
    }
    if (!user.isEmailVerified) {
      fail(response, 403, 'AUTH_EMAIL_NOT_VERIFIED', 'Please verify your email address before signing in.');
      return;
    }
    const token = createOpaqueToken();
    const now = new Date();
    await database.collection('sessions').insertOne({
      userId: user._id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS), createdAt: now,
    });
    await database.collection('users').updateOne({ _id: user._id }, { $set: { lastLoginAt: now } });
    response.setHeader('Set-Cookie', sessionCookie(token));
    response.json({ success: true, data: { user: publicUser(user) } });
  } catch {
    fail(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Sign in is temporarily unavailable. Please try again.');
  }
});

router.post('/logout', async (request, response) => {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE);
  try {
    if (token) await (await getDatabase()).collection('sessions').deleteOne({ tokenHash: hashToken(token) });
  } catch {
    fail(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Sign out is temporarily unavailable. Please try again.');
    return;
  }
  response.setHeader('Set-Cookie', expiredSessionCookie());
  response.json({ success: true, data: { message: 'Signed out.' } });
});

router.get('/me', async (request, response) => {
  try {
    const user = await getSessionUser(request);
    if (!user) { fail(response, 401, 'AUTH_SESSION_REQUIRED', 'Authentication required.'); return; }
    response.json({ success: true, data: { user: publicUser(user) } });
  } catch {
    fail(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Your account is temporarily unavailable. Please try again.');
  }
});

router.post('/forgot-password', authRateLimit(5), async (request, response) => {
  const email = bodyString(request, 'email').toLowerCase();
  try {
    const database = await getDatabase();
    const user = await database.collection<UserRecord>('users').findOne({ email, status: 'active' });
    if (user) {
      const token = createOpaqueToken();
      await database.collection('auth_tokens').insertOne({
        userId: user._id, tokenHash: hashToken(token), purpose: 'password_reset',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), createdAt: new Date(),
      });
      await sendAuthEmail(
        user.email,
        'Reset your Make My Marriage password',
        `<p>Hello ${escapeHtml(user.name)},</p><p>Use this secure link to set a new password:</p><p><a href="${frontendUrl('reset', token)}">Reset password</a></p><p>This link expires in one hour. If you did not request it, you can ignore this email.</p>`,
      );
    }
    response.json({ success: true, data: { message: 'If an account exists for that email, a reset link has been sent.' } });
  } catch {
    fail(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Password recovery is temporarily unavailable. Please try again.');
  }
});

router.post('/reset-password', authRateLimit(5), async (request, response) => {
  const token = bodyString(request, 'token');
  const password = bodyValue(request, 'newPassword');
  if (password.length < 8 || password.length > 128) { fail(response, 400, 'AUTH_INVALID_REQUEST', 'Password must be at least 8 characters.'); return; }
  let session: ReturnType<ReturnType<typeof getMongoClient>['startSession']> | undefined;
  try {
    const database = await getDatabase();
    const passwordHash = await hashPassword(password);
    session = getMongoClient().startSession();
    let tokenFound = false;
    await session.withTransaction(async () => {
      const authToken = await database.collection('auth_tokens').findOneAndDelete({
        tokenHash: hashToken(token), purpose: 'password_reset', expiresAt: { $gt: new Date() },
      }, { session });
      if (!authToken || !(authToken['userId'] instanceof ObjectId)) return;

      tokenFound = true;
      const update = await database.collection('users').updateOne(
        { _id: authToken['userId'] },
        { $set: { passwordHash, updatedAt: new Date() } },
        { session },
      );
      if (update.matchedCount !== 1) throw new Error('Password reset account was not found.');
      await database.collection('sessions').deleteMany({ userId: authToken['userId'] }, { session });
      await database.collection('auth_tokens').deleteMany(
        { userId: authToken['userId'], purpose: 'password_reset' },
        { session },
      );
    });
    if (!tokenFound) {
      fail(response, 400, 'AUTH_RESET_TOKEN_INVALID', 'This reset link is invalid or expired.');
      return;
    }
    response.json({ success: true, data: { message: 'Password reset. You can sign in with your new password.' } });
  } catch {
    fail(response, 503, 'AUTH_SERVICE_UNAVAILABLE', 'Password reset is temporarily unavailable. Please try again.');
  } finally {
    await session?.endSession();
  }
});

export const authRoutes = router;
