import assert from "node:assert/strict";
import test from "node:test";

import { selectTransitCorridorFromRoutes, type CachedCtaRouteShape } from "./ctaGtfs";

const route: CachedCtaRouteShape = {
  routeId: "55",
  routeShortName: "55",
  routeLongName: "Garfield",
  mode: "bus",
  points: [
    [41.7943, -87.6202],
    [41.7941, -87.6122],
    [41.7938, -87.6073],
    [41.7935, -87.6021],
    [41.7932, -87.5988],
  ],
  stops: [
    { name: "Garfield & King Drive", lat: 41.7943, lng: -87.6202 },
    { name: "Garfield & Ellis", lat: 41.7932, lng: -87.5988 },
  ],
};

test("selects a cached CTA corridor and includes walk plus transit segments", () => {
  const result = selectTransitCorridorFromRoutes([route], {
    origin: { lat: 41.7942, lng: -87.6176 },
    destination: { lat: 41.7886, lng: -87.5987 },
    routeLabel: "Route 55",
  });

  assert.ok(result);
  assert.equal(result.label, "CTA Route 55");
  assert.equal(result.source, "cta_gtfs_cached");
  assert.equal(result.confidence, "medium");
  assert.ok(result.geometry.length > 2);
  assert.equal(result.segments.some((segment) => segment.mode === "transit"), true);
});

test("does not return a misleading corridor when every route is far away", () => {
  const result = selectTransitCorridorFromRoutes([route], {
    origin: { lat: 42.05, lng: -87.68 },
    destination: { lat: 41.98, lng: -87.66 },
  });

  assert.equal(result, null);
});
