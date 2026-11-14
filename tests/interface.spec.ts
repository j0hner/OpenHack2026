import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Feature, Polygon, MultiPolygon } from "geojson";

function cadastralFixture(location: string, parcelId?: string) {
  const collection = JSON.parse(
    readFileSync(
      new URL(
        `../public/data/locations/demo-${location}-parcels.json`,
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const feature = collection.features.find(
    (item: Feature<Polygon | MultiPolygon>) =>
      parcelId
        ? String(item.properties?.id) === parcelId
        : item.properties?.druhpozemkukod === 2,
  );
  if (!feature) throw new Error(`Missing cadastral fixture ${location}`);
  const properties = feature.properties;
  const id = String(properties.id);
  return {
    id: `parcel-${id}`,
    kind: "parcel",
    name: `Parcela ${properties.cisloparcely}`,
    geometry: feature.geometry,
    landUse: properties.druhpozemkukod === 5 ? "zahrada" : "orná půda",
    cadastral: {
      id,
      parcelNumber: String(properties.cisloparcely),
      officialAreaM2: properties.vymeraparcely,
    },
    location: {
      code: id,
      katastr: String(properties.katastralniuzemi),
      obec: "neurčeno",
      okres: "neurčeno",
      kraj: "neurčeno",
    },
    attributes: {
      soil: null,
      climate: null,
      water: null,
      terrain: null,
      access: null,
      constraints: null,
    },
    availability: {
      soil: "missing",
      climate: "missing",
      water: "missing",
      terrain: "missing",
      access: "missing",
    },
  };
}
// Real, deliberately distant cadastral polygons from the bundled open data.
const parcels = [cadastralFixture("a"), cadastralFixture("b")];

async function planner(
  page: Page,
  context: BrowserContext,
  fixtures = parcels,
) {
  await context.route("https://**/*", (route) => route.abort());
  await context.addInitScript((areas) => {
    localStorage.setItem(
      "sady-demo-v1",
      JSON.stringify({
        parcels: areas,
        selectedIds: areas.map((area) => area.id),
        fruit: "apple",
      }),
    );
  }, fixtures);
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Hlavní navigace" }),
  ).toBeVisible();
}

test("desktop parcel detail grows by click and drag, never shrinks below the current size and stays inside the map", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await planner(page, context);
  await expect(
    page.getByRole("button", { name: "Zobrazit seznam pozemků", exact: true }),
  ).toBeHidden();
  await page.locator(".parcel-list-main").first().click();
  const card = page.locator(".expandable-parcel-detail");
  const control = page.getByRole("button", {
    name: "Zvětšit detail pozemku",
    exact: true,
  });
  const initial = (await card.boundingBox())!;
  await control.click();
  const expanded = (await card.boundingBox())!;
  expect(expanded.width).toBeGreaterThan(initial.width + 80);
  expect(expanded.height).toBeGreaterThanOrEqual(initial.height - 1);

  const handle = (await control.boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x - 90, handle.y - 50, { steps: 6 });
  await page.mouse.up();
  const afterReverse = (await card.boundingBox())!;
  expect(afterReverse.width).toBeGreaterThanOrEqual(expanded.width - 1);
  expect(afterReverse.height).toBeGreaterThanOrEqual(expanded.height - 1);

  const nextHandle = (await control.boundingBox())!;
  await page.mouse.move(
    nextHandle.x + nextHandle.width / 2,
    nextHandle.y + nextHandle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(nextHandle.x + 100, nextHandle.y + 60, { steps: 6 });
  await page.mouse.up();
  const dragged = (await card.boundingBox())!;
  expect(dragged.width).toBeGreaterThan(afterReverse.width + 40);
  const map = (await page.locator(".map-stage").boundingBox())!;
  expect(dragged.x + dragged.width).toBeLessThanOrEqual(map.x + map.width);
  expect(dragged.y + dragged.height).toBeLessThanOrEqual(map.y + map.height);

  await control.focus();
  await page.keyboard.press("ArrowRight");
  expect((await card.boundingBox())!.width).toBeGreaterThanOrEqual(
    dragged.width,
  );
  await testInfo.attach("desktop-expanded-detail", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page
    .getByRole("button", { name: "Zavřít detail pozemku", exact: true })
    .click();
  await expect(card).toHaveCount(0);
});

test("mobile keeps its parcel list control and grows the bottom sheet within the map", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await planner(page, context);
  const listToggle = page.getByRole("button", {
    name: "Zobrazit seznam pozemků",
    exact: true,
  });
  await expect(listToggle).toBeVisible();
  await listToggle.click();
  await page.locator(".parcel-list-main").first().click();
  const card = page.locator(".expandable-parcel-detail");
  const initial = (await card.boundingBox())!;
  await page
    .getByRole("button", { name: "Zvětšit detail pozemku", exact: true })
    .click();
  const expanded = (await card.boundingBox())!;
  const map = (await page.locator(".map-stage").boundingBox())!;
  expect(expanded.height).toBeGreaterThan(initial.height + 30);
  expect(expanded.width).toBeLessThanOrEqual(map.width + 1);
  expect(expanded.y).toBeGreaterThanOrEqual(map.y);
  expect(expanded.y + expanded.height).toBeLessThanOrEqual(
    map.y + map.height + 1,
  );
  await testInfo.attach("mobile-expanded-detail", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.setViewportSize({ width: 390, height: 650 });
  const resized = (await card.boundingBox())!;
  const smallerMap = (await page.locator(".map-stage").boundingBox())!;
  expect(resized.y).toBeGreaterThanOrEqual(smallerMap.y - 1);
  await expect(
    page.getByRole("button", { name: "Zavřít detail pozemku", exact: true }),
  ).toBeVisible();
});

test("adjacent cadastral parcels still merge into a single working area", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await planner(page, context, [
    cadastralFixture("d", "1245682735"),
    cadastralFixture("d", "1245678735"),
  ]);
  await page
    .getByRole("button", { name: "Spojit vybrané (2)", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Název spojené plochy", exact: true })
    .fill("Spojený sad");
  await page
    .getByRole("button", { name: "Vytvořit spojenou plochu", exact: true })
    .click();
  await expect(
    page.locator(".parcel-list-main").filter({ hasText: "Spojený sad" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Pozemky nelze spojit", exact: true }),
  ).toHaveCount(0);
  const working = await page.evaluate(
    () => JSON.parse(localStorage.getItem("sady-demo-v1")!).workingAreas,
  );
  expect(working).toHaveLength(1);
  expect(working[0].geometry.type).toBe("Polygon");
  expect(working[0].derivedFrom.operation).toBe("merge");
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`nonadjacent merge explains the rejection only after an attempt (${viewport.width}px)`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(viewport);
    await planner(page, context);
    if (viewport.width <= 900)
      await page
        .getByRole("button", { name: "Zobrazit seznam pozemků", exact: true })
        .click();
    const merge = page.getByRole("button", {
      name: "Spojit vybrané (2)",
      exact: true,
    });
    await expect(merge).toBeEnabled();
    await expect(
      page.getByRole("dialog", { name: "Pozemky nelze spojit", exact: true }),
    ).toHaveCount(0);
    await merge.click();
    const warning = page.getByRole("dialog", {
      name: "Pozemky nelze spojit",
      exact: true,
    });
    await expect(warning).toBeVisible();
    await expect(warning).toContainText("sousedící pozemky");
    await page.keyboard.press("Escape");
    await expect(warning).toHaveCount(0);
    await expect(merge).toBeFocused();
    expect(
      await page.evaluate(
        () => JSON.parse(localStorage.getItem("sady-demo-v1")!).parcels.length,
      ),
    ).toBe(2);
  });
}

test("both themes keep the white apple, while the dark Data header stays padded and rounded", async ({
  page,
  context,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await planner(page, context);
  const logo = page.locator(".app-brand-mark img");
  const lightLogo = await logo.getAttribute("src");
  const lightIcon = await page.locator('link[rel="icon"]').getAttribute("href");
  await page
    .getByRole("button", { name: "Přepnout na tmavý režim", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(logo).toHaveAttribute("src", lightLogo!);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    lightIcon!,
  );
  await expect
    .poll(() =>
      logo.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const header = page.locator(".provenance-panel > .secondary-view-header");
  await expect(header).toBeVisible();
  const styles = await header.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      padding: parseFloat(style.paddingLeft),
      radius: parseFloat(style.borderTopLeftRadius),
    };
  });
  expect(styles.padding).toBeGreaterThanOrEqual(16);
  expect(styles.radius).toBeGreaterThanOrEqual(8);
  await testInfo.attach("dark-data-view", {
    body: await page.screenshot(),
    contentType: "image/png",
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page
    .getByRole("button", { name: "Přepnout na světlý režim", exact: true })
    .click();
  await expect(logo).toHaveAttribute("src", lightLogo!);
});
