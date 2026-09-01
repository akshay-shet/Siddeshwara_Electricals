export type Entry = {
  title: string;
  description: string;
  images: string[];
};

export type Catalog = {
  company: Entry[];
  works: Entry[];
};

export type CatalogRecord = {
  _id?: string;
  company?: Entry[];
  works?: Entry[];
  updatedAt?: Date | string;
};

export const emptyCatalog: Catalog = {
  company: [],
  works: [],
};

const MAX_IMAGE_BYTES = 8_000_000;

export function sanitizeImageList(images: unknown): string[] {
  if (!Array.isArray(images)) {
    return [];
  }

  return images
    .map((image) => (typeof image === "string" ? image.trim() : ""))
    .filter((image) => {
      if (!image) return false;
      if (image.startsWith("data:image/")) {
        const base64 = image.split(",")[1] ?? "";
        const byteLength = base64.length * 0.75;
        return byteLength <= MAX_IMAGE_BYTES;
      }
      return true;
    });
}

export function normalizeEntry(input: unknown): Entry {
  const entry = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const images = sanitizeImageList(entry.images);

  return {
    title: typeof entry.title === "string" ? entry.title : "",
    description: typeof entry.description === "string" ? entry.description : "",
    images,
  };
}

export function normalizeCatalog(input: unknown): Catalog {
  const source = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const company = Array.isArray(source.company) ? source.company.map(normalizeEntry) : [];
  const works = Array.isArray(source.works) ? source.works.map(normalizeEntry) : [];

  return {
    company,
    works,
  };
}
