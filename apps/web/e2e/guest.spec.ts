import { expect, test } from "@playwright/test";

test("guest request appears on the daily plan and cannot open another booking", async ({ page }) => {
  await page.goto("/book/masulino-berlin?date=2026-12-02");
  await expect(page.getByText("Öffentliche Buchung")).toBeVisible();
  await expect(page.getByText("Fixture-Hinweis")).toBeVisible();
  await expect(page.getByText("Geheimer Entwurf")).toHaveCount(0);
  await page.getByLabel("Datum").fill("2026-12-02");
  await page.getByLabel("Uhrzeit").fill("11:00");
  await page.getByLabel("Name der Organisation").fill("Familie Gast");
  await page.getByLabel("E-Mail").fill("gast@example.test");
  await page.getByRole("textbox", { name: "Telefon" }).fill("030999888");
  await page.getByRole("button", { name: "Buchung anfragen" }).click();
  await expect(page.getByRole("heading", { name: "Buchung gespeichert" })).toBeVisible();
  await page.getByRole("link", { name: "Buchung später öffnen" }).click();
  await expect(page.getByText("Der Link wird erst mit diesem Knopf eingelöst")).toBeVisible();
  await page.goto(page.url());
  await expect(page.getByRole("button", { name: "Buchung öffnen" })).toBeVisible();
  await page.getByRole("button", { name: "Buchung öffnen" }).click();
  await expect(page.getByRole("heading", { name: "Ihre Buchung" })).toBeVisible();
  await expect(page.getByText("Familie Gast")).toBeVisible();
  await expect(page.getByText("MS-FIXTURE1")).toHaveCount(0);
  await expect(page.getByText("familie@example.test")).toHaveCount(0);
  await page.goto("/book/manage?reference=MS-FIXTURE1");
  await expect(page.getByText("MS-FIXTURE1")).toHaveCount(0);

  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("reception.masulino@example.test");
  await page.getByLabel("Passwort").fill("Synthetic-Staff-1");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Betrieb wählen" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Masulino Spielwelt" }).click();
  await page.getByRole("link", { name: "Berlin" }).click();
  await expect(page.getByText("Fehlgeschlagen")).toBeVisible();
  await page.getByRole("button", { name: "Erneut vormerken" }).click();
  await expect(page.getByText("Vorgemerkt").first()).toBeVisible();
  await page.goto("/app/masulino-spielwelt/berlin?date=2026-12-02");
  await expect(page.getByText("Familie Gast").first()).toBeVisible();
  await expect(page.getByText("gast@example.test")).toHaveCount(0);
});

test.describe("tablet", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("daily plan and preparation sheet fit a tablet width", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("reception.masulino@example.test");
  await page.getByLabel("Passwort").fill("Synthetic-Staff-1");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Betrieb wählen" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Masulino Spielwelt" }).click();
  await page.getByRole("link", { name: "Berlin" }).click();
  await expect(page.getByRole("heading", { name: "Tagesplan" })).toBeVisible();
  await page.getByRole("link", { name: "Vorbereitung" }).click();
  await expect(page.getByRole("heading", { name: "Vorbereitung" })).toBeVisible();
  await page.getByRole("button", { name: /Ausdruck (erstellen|aktualisieren)/ }).click();
  await expect(page.getByText("MS-FIXTURE1")).toBeVisible();
  await expect(page.getByText("Familie Beispiel")).toBeVisible();
  await expect(page.getByText("familie@example.test")).toHaveCount(0);
  await expect(page.getByText("Stand:")).toBeVisible();
  });
});
