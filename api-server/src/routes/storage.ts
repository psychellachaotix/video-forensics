import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';

import { ObjectPermission } from '../lib/objectAcl';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * The forensic intake validates file type and size before minting a short-lived
 * write URL.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;
      const extension = name.split('.').pop()?.toLowerCase();
      const supportedExtensions = new Set(['mp4', 'mov', 'avi', 'mkv', 'jpg', 'jpeg', 'png', 'webp']);
      if (!extension || !supportedExtensions.has(extension)) {
        res.status(400).json({
          error: 'Podporované formáty jsou MP4, MOV, AVI a MKV.',
        });
        return;
      }
      if (size > 2 * 1024 * 1024 * 1024) {
        res.status(400).json({
          error: 'Soubor překračuje maximální velikost 2 GB.',
        });
        return;
      }
       const imageMimes = new Set([
         'jpg:image/jpeg', 'jpeg:image/jpeg', 'png:image/png', 'webp:image/webp',
       ]);
       const normalizedMime = contentType.toLowerCase().split(';', 1)[0];
       const expectedImageMime = imageMimes.has(`${extension}:${normalizedMime}`);
       const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(extension);
       const validMime = isImage
         ? (expectedImageMime || normalizedMime === 'application/octet-stream')
         : (normalizedMime.startsWith('video/') || normalizedMime === 'application/octet-stream');
      if (!validMime) {
        res.status(400).json({ error: 'Soubor nemá platný video nebo obrazový MIME typ.' });
        return;
      }

      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      const objectPath =
        objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const [metadata] = await file.getMetadata();
      res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      if (metadata.size) res.setHeader('Content-Length', String(metadata.size));
      const stream = file.createReadStream();
      stream.once('error', (error) => {
        req.log.error({ err: error }, 'Error streaming public object');
        if (!res.headersSent) res.status(500);
        res.end();
      });
      stream.pipe(res);
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve object entities from PRIVATE_OBJECT_DIR.
 * These are served from a separate path from /public-objects and can optionally
 * be protected with authentication or ACL checks based on the use case.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const objectFile =
      await objectStorageService.getObjectEntityFile(objectPath);

    // --- Protected route example (uncomment when using replit-auth) ---
    // if (!req.isAuthenticated()) {
    //   res.status(401).json({ error: "Unauthorized" });
    //   return;
    // }
    // const canAccess = await objectStorageService.canAccessObjectEntity({
    //   userId: req.user.id,
    //   objectFile,
    //   requestedPermission: ObjectPermission.READ,
    // });
    // if (!canAccess) {
    //   res.status(403).json({ error: "Forbidden" });
    //   return;
    // }

    const [metadata] = await objectFile.getMetadata();
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (metadata.size) res.setHeader('Content-Length', String(metadata.size));
    const stream = objectFile.createReadStream();
    stream.once('error', (error) => {
      req.log.error({ err: error }, 'Error streaming private object');
      if (!res.headersSent) res.status(500);
      res.end();
    });
    stream.pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
