import { Collection, MongoClient } from "mongodb";
import { Catalog } from "@/lib/catalog";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "siddeshwara_electricals";
const collectionName = process.env.MONGODB_COLLECTION_NAME || "catalog";

export type CatalogDocument = {
  _id: string;
  company: Catalog["company"];
  works: Catalog["works"];
  updatedAt?: Date;
};

let client: MongoClient | null = null;
let catalogCollection: Collection<CatalogDocument> | null = null;

export async function getCatalogCollection() {
  if (!uri) {
    return null;
  }

  if (!client) {
    client = new MongoClient(uri);
    await client.connect();
  }

  if (!catalogCollection) {
    const db = client.db(dbName);
    catalogCollection = db.collection<CatalogDocument>(collectionName);
  }

  return catalogCollection;
}
