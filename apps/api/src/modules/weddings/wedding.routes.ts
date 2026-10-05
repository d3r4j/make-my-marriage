import { Router, type Request, type Response } from 'express';
import { randomBytes } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { getDatabase, getMongoClient } from '../../core/database/mongodb';
import { getSessionUser, type AuthenticatedUser } from '../../core/auth/session';
import { createOpaqueToken, hashToken } from '../../core/auth/security';

const router = Router();

function fail(response: Response, status: number, code: string, message: string): void {
  response.status(status).json({ success: false, error: { code, message } });
}

function bodyString(request: Request, key: string): string {
  const value = (request.body as Record<string, unknown> | undefined)?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function slugPart(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45) || 'wedding';
}

router.get('/', async (request, response) => {
  try {
    const user = await getSessionUser(request);
    if (!user) { fail(response, 401, 'AUTH_SESSION_REQUIRED', 'Please sign in to continue.'); return; }
    const database = await getDatabase();
    const memberships = await database.collection('wedding_memberships').find({
      userId: user._id,
      status: 'active',
    }).toArray();
    const weddingIds = memberships.map((membership) => membership['weddingId']).filter((id): id is ObjectId => id instanceof ObjectId);
    const weddings = weddingIds.length ? await database.collection('weddings').find({
      _id: { $in: weddingIds },
      status: { $ne: 'deleted' },
    }).toArray() : [];
    response.json({
      success: true,
      data: {
        weddings: weddings.map((wedding) => ({
          id: (wedding['_id'] as ObjectId).toHexString(),
          title: wedding['title'],
          publicSlug: wedding['publicSlug'],
          weddingDate: wedding['weddingDate'],
        })),
      },
    });
  } catch {
    fail(response, 503, 'WEDDINGS_UNAVAILABLE', 'Your wedding workspaces are temporarily unavailable. Please try again.');
  }
});

router.post('/', async (request, response) => {
  let user: AuthenticatedUser | null;
  try {
    user = await getSessionUser(request);
  } catch {
    fail(response, 503, 'WEDDINGS_UNAVAILABLE', 'Wedding setup is temporarily unavailable. Please try again.');
    return;
  }
  if (!user) { fail(response, 401, 'AUTH_SESSION_REQUIRED', 'Please sign in to continue.'); return; }

  const brideName = bodyString(request, 'brideName');
  const groomName = bodyString(request, 'groomName');
  const weddingDate = bodyString(request, 'weddingDate');
  const location = (request.body as Record<string, unknown> | undefined)?.['location'];
  const venue = (request.body as Record<string, unknown> | undefined)?.['venue'];
  const locationData = location && typeof location === 'object' ? location as Record<string, unknown> : {};
  const venueData = venue && typeof venue === 'object' ? venue as Record<string, unknown> : {};
  const locationName = typeof locationData['name'] === 'string' ? locationData['name'].trim() : '';
  const locationAddress = typeof locationData['address'] === 'string' ? locationData['address'].trim() : '';
  const venueName = typeof venueData['name'] === 'string' ? venueData['name'].trim() : '';
  const venueAddress = typeof venueData['address'] === 'string' ? venueData['address'].trim() : '';
  const parsedWeddingDate = new Date(`${weddingDate}T00:00:00.000Z`);

  if (brideName.length < 2 || brideName.length > 100 || groomName.length < 2 || groomName.length > 100 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(weddingDate) || Number.isNaN(parsedWeddingDate.getTime()) || parsedWeddingDate.toISOString().slice(0, 10) !== weddingDate ||
      locationName.length < 2 || locationName.length > 150 || locationAddress.length > 250 || venueName.length > 150 || venueAddress.length > 250) {
    fail(response, 400, 'WEDDING_INVALID_REQUEST', 'Enter both partner names, a valid wedding date, and the wedding location.');
    return;
  }

  const database = await getDatabase().catch(() => null);
  if (!database) { fail(response, 503, 'WEDDINGS_UNAVAILABLE', 'Wedding setup is temporarily unavailable. Please try again.'); return; }

  const now = new Date();
  const weddingId = new ObjectId();
  const albumId = new ObjectId();
  const token = createOpaqueToken();
  const weddingTitle = `${brideName} & ${groomName}`;
  const publicSlug = `${slugPart(weddingTitle)}-${randomBytes(4).toString('hex')}`;
  const webOrigin = process.env['WEB_ORIGIN'] ?? 'http://localhost:4200';
  const generalUploadUrl = `${webOrigin.replace(/\/$/, '')}/upload/${encodeURIComponent(token)}`;
  const permissions = Object.fromEntries(['functions', 'tasks', 'guests', 'expenses', 'vendors', 'gallery', 'website']
    .map((area) => [area, { read: true, write: true }]));
  const websiteConfig = {
    story: null,
    heroMediaId: null,
    sectionVisibility: { story: false, events: true, venue: true, invitation: true, rsvp: true, gallery: true, liveStream: false },
    invitationText: null,
  };
  const session = getMongoClient().startSession();

  try {
    await session.withTransaction(async () => {
      await database.collection('weddings').insertOne({
        _id: weddingId,
        couple: { personAName: brideName, personBName: groomName },
        title: weddingTitle,
        weddingDate: parsedWeddingDate,
        location: { name: locationName, address: locationAddress || null, city: null, state: null, country: null, latitude: null, longitude: null, placeId: null },
        venue: { name: venueName || null, address: venueAddress || null, latitude: null, longitude: null, placeId: null },
        coverImage: { mediaId: null },
        description: null,
        publicSlug,
        status: 'active',
        createdBy: user._id,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }, { session });
      await database.collection('wedding_memberships').insertOne({
        weddingId,
        userId: user._id,
        role: 'ADMIN',
        permissions,
        isPrimaryAdmin: true,
        status: 'active',
        invitedBy: null,
        invitedAt: now,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      }, { session });
      await database.collection('websites').insertOne({
        weddingId,
        theme: 'MODERN',
        draftConfig: websiteConfig,
        publishedConfig: { ...websiteConfig, publishedAt: null },
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
      }, { session });
      await database.collection('gallery_albums').insertOne({
        _id: albumId,
        weddingId,
        functionId: null,
        type: 'GENERAL',
        name: 'Wedding memories',
        description: null,
        visibility: 'LINK_ONLY',
        status: 'ACTIVE',
        createdBy: user._id,
        createdAt: now,
        updatedAt: now,
      }, { session });
      await database.collection('qr_codes').insertOne({
        weddingId,
        type: 'GENERAL_UPLOAD',
        functionId: null,
        albumId,
        tokenHash: hashToken(token),
        status: 'ACTIVE',
        createdBy: user._id,
        createdAt: now,
        revokedAt: null,
      }, { session });
    });
    response.status(201).json({
      success: true,
      data: { wedding: { id: weddingId.toHexString(), title: weddingTitle, publicSlug, weddingDate, generalUploadUrl } },
    });
  } catch {
    fail(response, 503, 'WEDDING_CREATION_FAILED', 'We could not create your wedding workspace. Please try again.');
  } finally {
    await session.endSession();
  }
});

export const weddingRoutes = router;
