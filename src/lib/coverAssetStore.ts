export interface CoverAssetRef {
  id: string;
  mimeType: string;
  width?: number;
  height?: number;
  bytes?: number;
}

interface StoredCoverAsset {
  id: string;
  mimeType: string;
  width?: number;
  height?: number;
  bytes: number;
  data: ArrayBuffer;
}

const COVER_ASSET_DB_NAME = "crewmark-cover-assets";
const COVER_ASSET_DB_VERSION = 1;
const COVER_ASSET_STORE_NAME = "assets";
const ASSET_ID_PREFIX = "cover-v1-";

const memoryAssets = new Map<string, StoredCoverAsset>();
let indexedDbPromise: Promise<IDBDatabase> | null = null;

function indexedDbAvailable(): boolean {
  const database = globalThis.indexedDB;
  return database !== undefined && database !== null && typeof database.open === "function";
}

function normalizeMimeType(value: string | undefined, fallback: string): string {
  const normalized = value?.trim().split(";", 1)[0]?.toLowerCase();
  return normalized || fallback;
}

function decodeBase64(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch (error) {
    throw new Error("[crewmark] Cover asset data URL contains invalid base64 data.", { cause: error });
  }
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  if (!dataUrl.startsWith("data:")) {
    throw new Error("[crewmark] Cover asset must be a data URL or Blob.");
  }

  const comma = dataUrl.indexOf(",");
  if (comma < 0) {
    throw new Error("[crewmark] Cover asset data URL is missing its payload.");
  }

  const metadata = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const metadataParts = metadata.split(";");
  const mimeType = normalizeMimeType(metadataParts[0], "text/plain");
  const isBase64 = metadataParts.slice(1).some((part) => part.trim().toLowerCase() === "base64");

  if (isBase64) {
    return { mimeType, bytes: decodeBase64(payload) };
  }

  try {
    const decoded = decodeURIComponent(payload);
    return { mimeType, bytes: new TextEncoder().encode(decoded) };
  } catch (error) {
    throw new Error("[crewmark] Cover asset data URL contains an invalid escaped payload.", { cause: error });
  }
}

async function readAssetInput(input: string | Blob): Promise<{ mimeType: string; bytes: Uint8Array }> {
  if (typeof input === "string") {
    return parseDataUrl(input);
  }

  if (!input || typeof input.arrayBuffer !== "function") {
    throw new Error("[crewmark] Cover asset must be a data URL or Blob.");
  }

  const buffer = await input.arrayBuffer();
  return {
    mimeType: normalizeMimeType(input.type, "application/octet-stream"),
    bytes: new Uint8Array(buffer),
  };
}

function hex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}

/** Deterministic non-cryptographic fallback for environments without Web Crypto. */
function fallbackDigest(bytes: Uint8Array): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  let third = 0x85ebca6b;
  let fourth = 0xc2b2ae35;

  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index] ?? 0;
    first = Math.imul(first ^ value, 0x01000193);
    second = Math.imul(second ^ (value + index), 0x01000193);
    third = Math.imul(third ^ (value ^ (index * 31)), 0x01000193);
    fourth = Math.imul(fourth ^ (value + index * 17), 0x01000193);
  }

  return `${hex(first)}${hex(second)}${hex(third)}${hex(fourth)}`;
}

async function contentDigest(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    try {
      const digest = await subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer);
      const digestBytes = new Uint8Array(digest);
      return Array.from(digestBytes, (value) => value.toString(16).padStart(2, "0")).join("");
    } catch {
      // Some test/browser contexts expose crypto without a usable subtle API.
    }
  }
  return fallbackDigest(bytes);
}

function toAssetRef(asset: StoredCoverAsset): CoverAssetRef {
  return {
    id: asset.id,
    mimeType: asset.mimeType,
    ...(asset.width === undefined ? {} : { width: asset.width }),
    ...(asset.height === undefined ? {} : { height: asset.height }),
    bytes: asset.bytes,
  };
}

function isStoredCoverAsset(value: unknown): value is StoredCoverAsset {
  if (!value || typeof value !== "object") return false;
  const asset = value as Partial<StoredCoverAsset>;
  return (
    typeof asset.id === "string" &&
    typeof asset.mimeType === "string" &&
    typeof asset.bytes === "number" &&
    Number.isFinite(asset.bytes) &&
    asset.bytes >= 0 &&
    asset.data instanceof ArrayBuffer
  );
}

function openIndexedDb(): Promise<IDBDatabase> {
  if (indexedDbPromise) return indexedDbPromise;

  let promise: Promise<IDBDatabase>;
  promise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(COVER_ASSET_DB_NAME, COVER_ASSET_DB_VERSION);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("[crewmark] Could not open cover asset storage.", { cause: error }));
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(COVER_ASSET_STORE_NAME)) {
        database.createObjectStore(COVER_ASSET_STORE_NAME, { keyPath: "id" });
      }
    };
    request.onerror = () => {
      reject(request.error ?? new Error("[crewmark] Could not open cover asset storage."));
    };
    request.onblocked = () => {
      reject(new Error("[crewmark] Cover asset storage upgrade is blocked."));
    };
    request.onsuccess = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(COVER_ASSET_STORE_NAME)) {
        database.close();
        reject(new Error("[crewmark] Cover asset storage has an incompatible schema."));
        return;
      }
      database.onversionchange = () => database.close();
      database.onclose = () => {
        if (indexedDbPromise === cachedPromise) indexedDbPromise = null;
      };
      resolve(database);
    };
  });

  let cachedPromise: Promise<IDBDatabase>;
  cachedPromise = promise.catch((error: unknown) => {
    if (indexedDbPromise === cachedPromise) indexedDbPromise = null;
    throw error;
  });
  indexedDbPromise = cachedPromise;
  return cachedPromise;
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("[crewmark] Cover asset storage request failed."));
  });
}

function idbWrite(operation: (store: IDBObjectStore, transaction: IDBTransaction) => IDBRequest): Promise<void> {
  return openIndexedDb().then(
    (database) =>
      new Promise<void>((resolve, reject) => {
        let transaction: IDBTransaction;
        try {
          transaction = database.transaction(COVER_ASSET_STORE_NAME, "readwrite");
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("[crewmark] Cover asset storage write failed."));
          transaction.onabort = () => reject(transaction.error ?? new Error("[crewmark] Cover asset storage write aborted."));
          const request = operation(transaction.objectStore(COVER_ASSET_STORE_NAME), transaction);
          request.onerror = () => {
            try {
              transaction.abort();
            } catch {
              // The transaction may already be aborting.
            }
          };
        } catch (error) {
          reject(error instanceof Error ? error : new Error("[crewmark] Cover asset storage write failed.", { cause: error }));
        }
      }),
  );
}

async function idbGet(id: string): Promise<unknown> {
  const database = await openIndexedDb();
  const transaction = database.transaction(COVER_ASSET_STORE_NAME, "readonly");
  return idbRequest(transaction.objectStore(COVER_ASSET_STORE_NAME).get(id));
}

async function idbGetAll(): Promise<unknown[]> {
  const database = await openIndexedDb();
  const transaction = database.transaction(COVER_ASSET_STORE_NAME, "readonly");
  return idbRequest(transaction.objectStore(COVER_ASSET_STORE_NAME).getAll());
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function assetToDataUrl(asset: StoredCoverAsset): string | null {
  if (!isStoredCoverAsset(asset)) return null;
  try {
    return `data:${asset.mimeType};base64,${bytesToBase64(new Uint8Array(asset.data))}`;
  } catch {
    return null;
  }
}

function isValidRef(ref: CoverAssetRef | null | undefined): ref is CoverAssetRef {
  return Boolean(ref && typeof ref.id === "string" && ref.id.length > 0);
}

export async function putCoverAsset(dataUrlOrBlob: string | Blob): Promise<CoverAssetRef> {
  const { mimeType, bytes } = await readAssetInput(dataUrlOrBlob);
  const id = `${ASSET_ID_PREFIX}${await contentDigest(bytes)}`;
  const existing = indexedDbAvailable()
    ? await idbGet(id).then((value) => (isStoredCoverAsset(value) ? value : null))
    : memoryAssets.get(id);

  if (existing) return toAssetRef(existing);

  const stored: StoredCoverAsset = {
    id,
    mimeType,
    bytes: bytes.byteLength,
    data: bytes.slice().buffer,
  };

  if (indexedDbAvailable()) {
    await idbWrite((store) => store.put(stored));
  } else {
    memoryAssets.set(id, stored);
  }

  return toAssetRef(stored);
}

export async function getCoverAsset(ref: CoverAssetRef): Promise<string | null> {
  if (!isValidRef(ref)) return null;
  const value = indexedDbAvailable() ? await idbGet(ref.id) : memoryAssets.get(ref.id);
  return isStoredCoverAsset(value) ? assetToDataUrl(value) : null;
}

export async function hasCoverAsset(ref: CoverAssetRef): Promise<boolean> {
  if (!isValidRef(ref)) return false;
  const value = indexedDbAvailable() ? await idbGet(ref.id) : memoryAssets.get(ref.id);
  return isStoredCoverAsset(value);
}

export async function deleteCoverAsset(ref: CoverAssetRef): Promise<void> {
  if (!isValidRef(ref)) return;
  if (indexedDbAvailable()) {
    await idbWrite((store) => store.delete(ref.id));
  } else {
    memoryAssets.delete(ref.id);
  }
}

export async function clearCoverAssets(): Promise<void> {
  if (indexedDbAvailable()) {
    await idbWrite((store) => store.clear());
  } else {
    memoryAssets.clear();
  }
}

export async function getCoverAssetStats(): Promise<{ count: number; bytes: number }> {
  const values = indexedDbAvailable() ? await idbGetAll() : [...memoryAssets.values()];
  let count = 0;
  let bytes = 0;
  for (const value of values) {
    if (!isStoredCoverAsset(value)) continue;
    count += 1;
    bytes += value.bytes;
  }
  return { count, bytes };
}
