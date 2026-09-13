import { Inject, Injectable } from '@nestjs/common';
import { DomainRuleError, NotFoundError } from '../../core/http/errors.js';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { STORAGE_DRIVER, type StorageDriver } from '../../core/storage/storage.driver.js';

export interface VideoRef {
  driver: 'storage-file';
  /** For the storage-file driver this is the file id, which is also the video id. */
  key: string;
  durationSeconds: number;
}

export interface PlaybackUrl {
  url: string;
  expiresAt: string;
  driver: string;
}

/** How long a playback link stays valid. Long enough for a lesson, short enough not to be shared. */
const PLAYBACK_TTL_SECONDS = 4 * 60 * 60;

/**
 * Video delivery. The demo uses the `storage-file` driver: the file sits in the private bucket and
 * is played through a short-lived signed URL. A hosted provider (Mux, Cloudflare Stream) becomes a
 * second driver behind this same interface without touching the lessons that reference it (ADR-0005).
 */
@Injectable()
export class VideoService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
  ) {}

  /** Registers an uploaded file as a playable video and returns the reference a lesson stores. */
  async register(fileId: string, durationSeconds = 0): Promise<VideoRef> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });
    if (!file) throw new NotFoundError('File');
    if (file.status !== 'ready') {
      throw new DomainRuleError('The video has not finished uploading yet', 'video_not_ready');
    }
    if (!file.mime.startsWith('video/')) {
      throw new DomainRuleError('That file is not a video', 'not_a_video');
    }
    return { driver: 'storage-file', key: file.id, durationSeconds };
  }

  /** True when the reference still points at a file that can be played. */
  async isReady(ref: VideoRef | null): Promise<boolean> {
    if (!ref) return false;
    const file = await this.prisma.file.findUnique({ where: { id: ref.key } });
    return Boolean(file && file.status === 'ready');
  }

  async playback(ref: VideoRef): Promise<PlaybackUrl> {
    const file = await this.prisma.file.findUnique({ where: { id: ref.key } });
    if (!file || file.status !== 'ready') throw new NotFoundError('Video');
    const url = await this.storage.presignDownload('private', file.key, PLAYBACK_TTL_SECONDS);
    return {
      url,
      expiresAt: new Date(Date.now() + PLAYBACK_TTL_SECONDS * 1000).toISOString(),
      driver: 'storage-file',
    };
  }
}
