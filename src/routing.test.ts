import { expect, it } from "vitest";
import { routeFromHash } from "./routing";

it("opens the catalog for a keyboard Mini App launch fragment", () => {
  expect(routeFromHash("#tgWebAppData=query_id%3Dsynthetic&tgWebAppVersion=9.1&tgWebAppPlatform=android")).toBe("catalog");
  expect(routeFromHash("#tgWebAppVersion=9.1&tgWebAppPlatform=ios")).toBe("catalog");
  expect(routeFromHash("")).toBe("catalog");
});

it("keeps explicit pages and separates Telegram launch parameters", () => {
  for (const page of ["catalog", "favorites", "builder", "authors", "submit", "stories/last-train-to-summer"]) {
    expect(routeFromHash(`#/${page}`)).toBe(page);
    expect(routeFromHash(`#/${page}?tgWebAppVersion=9.1&tgWebAppPlatform=ios`)).toBe(page);
    expect(routeFromHash(`#/${page}&tgWebAppVersion=9.1`)).toBe(page);
  }
  expect(routeFromHash("#/stories/removed")).toBe("stories/removed");
});
