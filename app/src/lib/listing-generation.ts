import { requireOptionalNativeModule } from 'expo-modules-core';

export type ListingAvailability =
  | { state: 'unsupported' }
  | { state: 'unavailable'; reason: 'deviceNotEligible' | 'appleIntelligenceNotEnabled' | 'modelNotReady' }
  | { state: 'ready'; vision: boolean; contextSize: number; supportsEnglish: boolean; supportsDutch: boolean };

export type ListingRequest = {
  language: 'en' | 'nl';
  facts: { label: string; value: string }[];
  photoPaths: string[];
  /** When set, replaces the Listing Lab instructions. The lab omits it. */
  instructions?: string;
};

export type ListingResult = {
  listingTitle: string;
  listingDescription: string;
  uncertainObservations: string[];
  elapsedMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  photosAttached: number;
};

type NativeModule = {
  getListingAvailability: () => Promise<Record<string, unknown>>;
  generateListing: (request: {
    language: ListingRequest['language'];
    facts: ListingRequest['facts'];
    photoPaths: string[];
    instructions?: string;
  }) => Promise<Record<string, unknown>>;
  cancelListingGeneration: () => void;
};

const native = requireOptionalNativeModule<NativeModule>('NolumeFoundationModels');

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

export async function getListingAvailability(): Promise<ListingAvailability> {
  if (!native) {
    return { state: 'unsupported' };
  }

  const payload = await native.getListingAvailability();
  const state = asString(payload.state);

  if (state === 'ready') {
    return {
      state: 'ready',
      vision: asBoolean(payload.vision) === true,
      contextSize: asNumber(payload.contextSize) ?? 4096,
      supportsEnglish: asBoolean(payload.supportsEnglish) !== false,
      supportsDutch: asBoolean(payload.supportsDutch) === true,
    };
  }

  if (state === 'unavailable') {
    const reason = asString(payload.reason);
    if (reason === 'appleIntelligenceNotEnabled' || reason === 'modelNotReady' || reason === 'deviceNotEligible') {
      return { state: 'unavailable', reason };
    }

    return { state: 'unavailable', reason: 'deviceNotEligible' };
  }

  return { state: 'unsupported' };
}

export async function generateListing(request: ListingRequest): Promise<ListingResult> {
  if (!__DEV__) {
    throw Object.assign(new Error('Listing generation is only available in development.'), { code: 'unsupported' });
  }

  if (!native) {
    throw Object.assign(new Error('Foundation Models are not available on this device.'), { code: 'unsupported' });
  }

  const payload = await native.generateListing({
    language: request.language,
    facts: request.facts,
    photoPaths: request.photoPaths,
    ...(request.instructions ? { instructions: request.instructions } : {}),
  });
  const listingTitle = asString(payload.listingTitle);
  const listingDescription = asString(payload.listingDescription);

  if (listingTitle == null || listingDescription == null) {
    throw Object.assign(new Error('The on-device model did not return a listing.'), { code: 'generationFailed' });
  }

  return {
    listingTitle,
    listingDescription,
    uncertainObservations: asStrings(payload.uncertainObservations),
    elapsedMs: asNumber(payload.elapsedMs) ?? 0,
    inputTokens: asNumber(payload.inputTokens),
    outputTokens: asNumber(payload.outputTokens),
    photosAttached: asNumber(payload.photosAttached) ?? request.photoPaths.length,
  };
}

export function cancelListingGeneration(): void {
  native?.cancelListingGeneration();
}

export function listingErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && error.code !== '') {
    return error.code;
  }

  return 'generationFailed';
}
