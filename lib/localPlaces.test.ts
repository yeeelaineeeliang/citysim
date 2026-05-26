import assert from "node:assert/strict";
import test from "node:test";

import { parsePlaceCategories, queryLocalEntertainmentPlaces } from "./localPlaces";

test("parses place category filters", () => {
  assert.deepEqual(parsePlaceCategories("restaurant,bar,library"), ["food", "bar", "civic"]);
});

test("loads local entertainment places by neighborhood", async () => {
  const result = await queryLocalEntertainmentPlaces({
    neighborhood: "Washington Park",
    categories: ["food", "park", "civic", "entertainment"],
    limit: 20,
  });

  assert.match(result.source, /local_cache|supabase/);
  assert.ok(result.places.length >= 3);
  assert.equal(result.summary.total, result.places.length);
  assert.ok(result.places.some((place) => place.category === "park"));
  assert.ok(result.places.every((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)));
});
