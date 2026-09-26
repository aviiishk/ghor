// Calls apps/api's listings module via the /api/gateway proxy — same DTOs/response
// shapes as apps/mobile/src/features/listings/api.ts, port kept 1:1 on purpose so the
// two clients can't silently drift.
import { apiRequest } from '@/lib/apiClient';

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
