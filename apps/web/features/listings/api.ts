// Calls apps/api's listings module via the /api/gateway proxy — same DTOs/response
// shapes as apps/mobile/src/features/listings/api.ts, port kept 1:1 on purpose so the
// two clients can't silently drift.
import { ApiError, apiRequest } from '@/lib/apiClient';
import { UploadError, type UploadSignature } from '@/lib/cloudinary';

export type ListingStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'rented';
export type PropertyType = 'room' | 'flat';

export type ListingImage = { id: string; cloudinaryUrl: string; position: number };
export type ListingInstitutionTag = {
  institution: { id: string; name: string; type: string; city: string };
};
export type ListingOwner = {
  id: string;
  fullName: string | null;
  phoneVerified: boolean;
  lastActiveAt: string | null;
  idVerificationStatus: string;
  phone?: string; // only present on GET /listings/:id
};

export type Listing = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  propertyType: PropertyType;
  rent: number;
  deposit: number | null;
  locality: string;
  city: string;
  state: string;
  availableFrom: string | null;
  amenities: Record<string, boolean>;
  status: ListingStatus;
  propertyVerified: boolean;
  latitude: number | null;
  longitude: number | null;
  avgRating: number | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  images: ListingImage[];
  institutions: ListingInstitutionTag[];
  owner: ListingOwner;
};

export type BrowseFilters = {
  city?: string;
  q?: string;
  locality?: string;
  propertyType?: PropertyType;
  rentMin?: number;
  rentMax?: number;
  amenities?: string;
  institutionIds?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc';
};

function toQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') usp.set(key, String(value));
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

export async function browseListings(filters: BrowseFilters & { cursor?: string }) {
  return apiRequest<{ items: Listing[]; nextCursor: string | null }>(
    `/listings${toQueryString(filters)}`,
  );
}

// Slim pin shape from GET /listings/map. Coordinates are server-geocoded from the
// locality and deliberately offset ~100m per listing (approximate, and so pins in the
// same locality don't stack) — never an exact address.
export type MapPin = {
  id: string;
  title: string;
  rent: number;
  propertyType: PropertyType;
  locality: string;
  latitude: number;
  longitude: number;
  avgRating: number | null;
  reviewCount: number;
  imageUrl: string | null;
};

export async function getMapPins(filters: BrowseFilters) {
  // sort is irrelevant to a map; dropping it keeps one cache entry per filter set.
  const { sort: _sort, ...rest } = filters;
  void _sort;
  return apiRequest<MapPin[]>(`/listings/map${toQueryString(rest)}`);
}

export type PopularLocality = { locality: string; count: number; minRent: number };

// Real counts of live listings per area — [] when there are none (never invented).
export async function getPopularLocalities() {
  return apiRequest<PopularLocality[]>('/listings/localities');
}

export async function getMyListings() {
  return apiRequest<Listing[]>('/listings/mine');
}

export async function getListing(id: string) {
  return apiRequest<Listing>(`/listings/${id}`);
}

// Owner-only per-listing stats from GET /listings/:id/insights (404 for anyone else).
export type ListingInsights = {
  totals: {
    views: number;
    uniqueViewers: number;
    contactTaps: number;
    inquiries: number;
    replied: number;
    responseRate: number | null;
    avgRating: number | null;
    reviewCount: number;
  };
  last30: { views: number; inquiries: number };
  // 30 rows, oldest first, IST calendar dates (YYYY-MM-DD).
  daily: { date: string; views: number; inquiries: number }[];
  listedAt: string;
};

export async function getListingInsights(id: string) {
  return apiRequest<ListingInsights>(`/listings/${id}/insights`);
}

// Up to 6 approved listings sharing locality / institution tag / ±25% rent band.
export async function getSimilarListings(id: string) {
  return apiRequest<Listing[]>(`/listings/${id}/similar`);
}

export type CreateListingInput = {
  title: string;
  description?: string;
  propertyType: PropertyType;
  rent: number;
  deposit?: number;
  locality: string;
  city?: string;
  availableFrom?: string;
  amenities?: Record<string, boolean>;
  images?: { cloudinaryUrl: string; position: number }[];
  institutionIds?: string[];
};

export async function createListing(input: CreateListingInput) {
  return apiRequest<Listing>('/listings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type UpdateListingInput = Partial<CreateListingInput> & {
  status?: 'pending' | 'approved' | 'rejected' | 'rented';
};

export async function updateListing(id: string, input: UpdateListingInput) {
  return apiRequest<Listing>(`/listings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteListing(id: string) {
  return apiRequest<void>(`/listings/${id}`, { method: 'DELETE' });
}

// Create-listing preview: the approximate point the server's geocoder will use for this
// locality (null when it can't be placed — the listing still works in List view).
export async function geocodePreview(locality: string) {
  const res = await apiRequest<{ point: { latitude: number; longitude: number } | null }>(
    `/listings/geocode-preview${toQueryString({ locality })}`,
  );
  return res.point;
}

// One short-lived Cloudinary signature per photo (apps/api POST /uploads/signature). A 503
// means the API has no Cloudinary credentials — reported as configuration, never as a
// problem with the user's photo.
export async function getUploadSignature(): Promise<UploadSignature> {
  try {
    return await apiRequest<UploadSignature>('/uploads/signature', { method: 'POST' });
  } catch (e) {
    if (e instanceof ApiError && e.status === 503) throw new UploadError('Photo uploads are not configured.', 'config');
    if (e instanceof ApiError && e.status === 429) throw new UploadError('You’ve added a lot of photos in the last hour. Please try again later.', 'file');
    if (e instanceof ApiError && e.status >= 500) throw new UploadError('GHOR couldn’t prepare the upload. Retry in a moment.', 'server');
    if (e instanceof TypeError) throw new UploadError('Connection lost while preparing the upload. Check your internet and retry.', 'network');
    throw e;
  }
}
