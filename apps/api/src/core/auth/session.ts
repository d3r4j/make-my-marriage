import { ObjectId } from 'mongodb';
import type { Request } from 'express';
import { getDatabase } from '../database/mongodb';
import { hashToken, readCookie, SESSION_COOKIE } from './security';

export interface AuthenticatedUser {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  isEmailVerified: boolean;
  status: 'active' | 'suspended' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export async function getSessionUser(request: Request): Promise<AuthenticatedUser | null> {
  const token = readCookie(request.headers.cookie, SESSION_COOKIE);
  if (!token) return null;
  const database = await getDatabase();
  const session = await database.collection('sessions').findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });
  if (!session || !(session['userId'] instanceof ObjectId)) return null;
  return database.collection<AuthenticatedUser>('users').findOne({
    _id: session['userId'],
    status: 'active',
    isEmailVerified: true,
  });
}
