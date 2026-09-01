import { NextRequest, NextResponse } from "next/server";
import { emptyCatalog, normalizeCatalog } from "@/lib/catalog";
import { getCatalogCollection } from "@/lib/mongodb";

const catalogId = "site-catalog";

export async function GET() {
  try {
    const collection = await getCatalogCollection();
    if (!collection) {
      return NextResponse.json(emptyCatalog);
    }

    const document = await collection.findOne({ _id: catalogId });
    return NextResponse.json(normalizeCatalog(document ?? emptyCatalog));
  } catch (error) {
    console.error("Failed to read catalog from MongoDB:", error);
    return NextResponse.json(emptyCatalog);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const nextCatalog = normalizeCatalog(payload ?? emptyCatalog);
    const collection = await getCatalogCollection();

    if (!collection) {
      return NextResponse.json(
        { message: "MongoDB is not configured. Add MONGODB_URI to continue saving entries.", catalog: nextCatalog },
        { status: 503 }
      );
    }

    await collection.updateOne(
      { _id: catalogId },
      {
        $set: {
          _id: catalogId,
          company: nextCatalog.company,
          works: nextCatalog.works,
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    const savedDocument = await collection.findOne({ _id: catalogId });
    return NextResponse.json(normalizeCatalog(savedDocument ?? nextCatalog));
  } catch (error) {
    console.error("Failed to save catalog to MongoDB:", error);
    return NextResponse.json(
      { message: "Unable to save catalog to MongoDB." },
      { status: 500 }
    );
  }
}
