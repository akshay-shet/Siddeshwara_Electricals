import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCatalog, sanitizeImageList } from "./catalog";

test("normalizeCatalog converts mixed database records into a clean catalog shape", () => {
  const result = normalizeCatalog({
    _id: "site-catalog",
    company: [
      { title: "Alpha", description: "A sample", images: ["/one.png", "", " /two.png "] },
    ],
    works: [{ title: "Beta", description: "B sample", images: ["/three.png"] }],
  });

  assert.deepEqual(result.company[0].images, ["/one.png", "/two.png"]);
  assert.equal(result.company[0].title, "Alpha");
  assert.equal(result.works[0].description, "B sample");
});

test("sanitizeImageList drops oversized data URLs that can break mobile browser storage", () => {
  const hugeImage = "data:image/png;base64," + "A".repeat(10_000_000);
  const result = sanitizeImageList([hugeImage, "/valid.png", "  "]);

  assert.deepEqual(result, ["/valid.png"]);
});
