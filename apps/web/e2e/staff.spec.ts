import { expect, test } from "@playwright/test";

test("reception sees the daily plan and an employee cannot book", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill("reception.masulino@example.test");
  await page.getByLabel("Passwort").fill("Synthetic-Staff-1");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Betrieb wählen" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: "Masulino Spielwelt" }).click();
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeVisible();
  await page.getByRole("link", { name: "Berlin" }).click();
  await expect(page.getByRole("heading", { name: "Tagesplan" })).toBeVisible();
  await expect(page.getByText("MS-FIXTURE1", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Neue Buchung" }).click();
  await page.getByLabel("Uhrzeit").fill("10:00");
  await page.getByLabel("Name der Organisation").fill("Familie Probe");
  await page.getByLabel("E-Mail").fill("probe@example.test");
  await page.getByRole("textbox", { name: "Telefon" }).fill("030111222");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.getByText(/Buchung gespeichert:/)).toBeVisible();
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page.getByRole("heading", { name: "Anmeldung" })).toBeVisible();
  await page.getByLabel("E-Mail").fill("employee.masulino@example.test");
  await page.getByLabel("Passwort").fill("Synthetic-Staff-1");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Betrieb wählen" })).toBeVisible();
  await page.goto("/app/masulino-spielwelt/berlin/bookings/new");
  await expect(page.getByRole("heading", { name: "Kein Zugriff" })).toBeVisible();
});
