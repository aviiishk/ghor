// Response shapes from apps/api /admin/* (kept minimal; the API is the source of truth).

export type AdminRole = "admin" | "senior_reviewer" | "super_admin";

export interface Me {
  adminUserId: string;
  profileId: string;
  name: string | null;
  phone: string | null;
  role: AdminRole;
  seniorCapability: boolean;
  permissions: string[];
  session: { id: string; method: string; idleExpiresAt: string; absoluteExpiresAt: string; stepUpUntil: string | null };
  recoveryCodesRemaining: number;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface QueueItem {
  id: string;
  title: string;
  status: string;
  version: number;
  rent: number;
  locality: string;
  city: string;
  propertyType: string;
  submittedAt: string | null;
  autoApproveAt: string | null;
  heldAt: string | null;
  holdReason: string | null;
  pausedAt: string | null;
  pauseReason: string | null;
  approvalSource: string | null;
  approvedAt: string | null;
  postReviewStatus: string | null;
  claimedById: string | null;
  claimExpiresAt: string | null;
  claimActive: boolean;
  secondsUntilAutoApproval: number | null;
  images: { cloudinaryUrl: string }[];
  owner: { id: string; fullName: string | null; phone: string | null; createdAt: string; banned: boolean };
  _count: { images: number; reports: number };
}

export interface Decision {
  id: string;
  decision: string;
  listingVersion: number;
  resultingVersion: number;
  reasonCodes: string[];
  ownerMessage: string | null;
  internalNote: string | null;
  actorType: string;
  actorId: string | null;
  createdAt: string;
}

export interface ListingDetail extends Omit<QueueItem, "images" | "_count" | "owner"> {
  description: string | null;
  deposit: number | null;
  amenities: Record<string, boolean>;
  images: { id: string; cloudinaryUrl: string; position: number }[];
  owner: {
    id: string;
    fullName: string | null;
    phone: string | null;
    createdAt: string;
    banned: boolean;
    phoneVerified: boolean;
    idVerificationStatus: string;
    _count: { listings: number };
  };
  decisions: Decision[];
  notes: { id: string; authorId: string; body: string; createdAt: string }[];
  reports: { id: string; reasonCategory: string; reason: string; status: string; createdAt: string; reporter: { fullName: string | null } }[];
  snapshotVersions: { version: number; createdAt: string }[];
  context: ReviewContext;
}

export interface Unavailable {
  available: false;
  phase: string;
}

export interface ReviewContext {
  media: {
    photoCount: number;
    photos: { position: number; url: string; format: string | null; cover: boolean }[];
    video: Unavailable;
    exactDuplicates: { url: string; listingId: string; listingTitle: string; listingStatus: string; sameOwner: boolean }[];
    visualSimilarity: Unavailable;
  };
  risk: {
    ownerAccountAgeDays: number;
    ownerBanned: boolean;
    ownerPhoneVerified: boolean;
    reportsAgainstOwner: Record<string, number>;
    previousRejectionsForOwner: number;
    ownerOtherListings: Record<string, number>;
    rentVsLocality: { rent: number; comparableApprovedListings: number; medianRent: number | null; differencePercent: number | null };
    automatedFlags: Unavailable;
  };
  ownerPlan: { plan: string; ghorVerified: boolean; note: string };
  responseBehaviour: {
    views: number;
    uniqueViewers: number;
    contactTaps: number;
    inquiries: number;
    replied: number;
    responseRate: number | null;
  };
  changesSinceApproval: {
    approvedVersion: number;
    latestVersion: number;
    approvedAt: string;
    changedFields: string[];
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  } | null;
}

export interface AuditRow {
  id: string;
  createdAt: string;
  category: string;
  action: string;
  actorType: string;
  actorId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  metadata: unknown;
}
