import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";

import { getSeasonalStreetStyle } from "./seasonalStreet";

import { renderToStaticMarkup } from "react-dom/server";
import { SeasonalStreetOverlay } from "@/components/SeasonalStreetOverlay";

test("January seasonal street style uses the revised cold wash and deep winter label", () => {
  const style = getSeasonalStreetStyle(1);

  assert.equal(style.wash, "rgba(140, 170, 210, 0.40)");
  assert.equal(style.descriptor, "Deep winter");
});

test("October seasonal street style uses the revised peak fall wash", () => {
  const style = getSeasonalStreetStyle(10);

  assert.equal(style.wash, "rgba(190, 110, 45, 0.32)");
  assert.equal(style.descriptor, "Peak fall");
});

test("December seasonal street style uses the revised deep winter wash", () => {
  const style = getSeasonalStreetStyle(12);

  assert.equal(style.wash, "rgba(160, 190, 230, 0.38)");
  assert.equal(style.descriptor, "Deep winter");
});

test("seasonal street overlay does not render svg or canvas decoration", () => {
  const html = renderToStaticMarkup(
    createElement(SeasonalStreetOverlay, { month: 1, monthName: "January", neighborhood: "Hyde Park" }),
  );

  assert.doesNotMatch(html, /<(svg|canvas)\b/i);
});
