import { createHash, randomUUID } from 'crypto';
import {
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type UploadSignature = {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  publicId: string;
  allowedFormats: string;
  overwrite: 'false';
  transformation: string;
  signature: string;
};

// Signed direct-to-Cloudinary uploads (2026-09-27). The browser uploads the file straight
// to Cloudinary (no image bytes through this server) but only with a signature minted
// here, so no unsigned upload preset has to exist on the account — an unsigned preset
// lets anyone on the internet upload to it. The API secret never leaves this process.
//
// Every parameter Cloudinary receives must be covered by the signature (it rejects
// anything extra), so the client can't change where or how the file is stored. Hardening
// (pre-commit review 2026-09-28):
//  - public_id is chosen here (random, inside ghor/listings/) and overwrite=false, so one
//    signature fills exactly one new slot: it can't be reused to store unlimited files, and
//    can't replace a photo that's already attached to an approved listing.
//  - an incoming transformation caps stored images at 2000px on the long edge, whatever
//    the client sends (server-enforced size limit; Cloudinary's plan limit caps bytes).
//  - allowed_formats restricts to real image formats (a renamed text file is rejected).
//  - a per-user rate limit bounds how many signatures one account can mint.
// Cloudinary rejects a signature after one hour (timestamp).
export const UPLOAD_FOLDER = 'ghor/listings';
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,heic,heif';
const INCOMING_TRANSFORMATION = 'c_limit,h_2000,w_2000';
const MAX_SIGNATURES_PER_HOUR = 120; // a listing holds at most 20 photos

@Injectable()
export class UploadsService {
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  // In-memory, per API instance — enough to stop a runaway client or script; move to a
  // shared store (Redis) if the API ever runs as several instances.
  private readonly issued = new Map<string, number[]>();

  constructor(config: ConfigService) {
    this.cloudName = (config.get<string>('CLOUDINARY_CLOUD_NAME') ?? '').trim();
    this.apiKey = (config.get<string>('CLOUDINARY_API_KEY') ?? '').trim();
    this.apiSecret = (config.get<string>('CLOUDINARY_API_SECRET') ?? '').trim();
  }

  get configured() {
    const real = (v: string) =>
      !!v && !/^your[-_]|placeholder|changeme/i.test(v);
    return real(this.cloudName) && real(this.apiKey) && real(this.apiSecret);
  }

  sign(userId: string): UploadSignature {
    if (!this.configured) {
      // Distinct, stable message: the web client shows a configuration notice for it
      // instead of blaming the user's photo.
      throw new ServiceUnavailableException(
        'Photo uploads are not configured on this server',
      );
    }
    this.rateLimit(userId);

    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `${UPLOAD_FOLDER}/${randomUUID()}`;
    // Cloudinary signature: the signed params sorted by name, joined as a=b&c=d, with the
    // API secret appended, SHA-1 hex.
    const toSign =
      `allowed_formats=${ALLOWED_FORMATS}&overwrite=false&public_id=${publicId}` +
      `&timestamp=${timestamp}&transformation=${INCOMING_TRANSFORMATION}`;
    const signature = createHash('sha1')
      .update(toSign + this.apiSecret)
      .digest('hex');
    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      timestamp,
      publicId,
      allowedFormats: ALLOWED_FORMATS,
      overwrite: 'false',
      transformation: INCOMING_TRANSFORMATION,
      signature,
    };
  }

  private rateLimit(userId: string) {
    const now = Date.now();
    const recent = (this.issued.get(userId) ?? []).filter(
      (t) => now - t < 3_600_000,
    );
    if (recent.length >= MAX_SIGNATURES_PER_HOUR) {
      throw new HttpException(
        'Too many photo uploads in the last hour. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    this.issued.set(userId, recent);
  }
}
