import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const password = "Synthetic-Staff-1";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodeBase32(input: string): Buffer {
  const clean = input.replace(/=+$/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", decodeBase32(secret)).update(buffer).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}

async function enrollTotp(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Zwei-Faktor einrichten" })).toBeVisible();
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Zwei-Faktor einrichten" }).click();
  const secretText = await page.getByText(/otpauth:/).innerText();
  const secret = new URL(secretText.slice(secretText.indexOf("otpauth:"))).searchParams.get("secret");
  expect(secret).toBeTruthy();
  await page.getByLabel("Code").fill(totp(secret!));
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.getByRole("heading", { name: "Betrieb wählen" })).toBeVisible({ timeout: 20_000 });
}

async function login(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Betrieb wählen" })).toBeVisible({ timeout: 20_000 });
}

test.use({ viewport: { width: 768, height: 1024 } });

test("staff run availability, publishing, clock, and checklists without a spreadsheet", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await login(page, "employee.masulino@example.test");
  await page.getByRole("link", { name: "Masulino Spielwelt" }).click();
  await page.getByRole("link", { name: "Berlin" }).click();
  await page.getByRole("link", { name: "Dienstplan" }).click();
  await page.getByRole("button", { name: "Speichern" }).first().click();
  await expect(page.getByText("Gespeichert").first()).toBeVisible();
  await page.getByRole("button", { name: "Kommen" }).click();
  const punch = page.getByTestId("punch-line");
  await expect(punch).toBeVisible();
  const original = (await punch.innerText()).trim();
  const card = page.locator("li").filter({ has: punch });
  await card.getByLabel("Neue Uhrzeit").fill("10:15");
  await card.getByLabel("Grund").fill("Fixture vergessen");
  await card.getByRole("button", { name: "Korrektur anfragen" }).click();
  await expect(punch).toHaveText(original);
  await page.goto("/app/masulino-spielwelt/potsdam/workforce");
  await expect(page.getByRole("heading", { name: "Kein Zugriff" })).toBeVisible();
  await page.goto("/app/masulino-spielwelt/berlin/checklists");
  await expect(page.getByText("Fixture Abschluss")).toBeVisible();
  await expect(page.getByText("Fixture: Seife fehlt")).toBeVisible();
  await page.getByLabel("Notiz").fill("Tische geprüft");
  await page.getByRole("button", { name: "Erledigt" }).click();
  await expect(page.getByText("Erledigt: Tische geprüft")).toBeVisible();
  await page.getByRole("button", { name: "Abmelden" }).click();

  await login(page, "manager.masulino@example.test");
  await page.getByRole("link", { name: "Masulino Spielwelt" }).click();
  await enrollTotp(page);
  await page.getByRole("link", { name: "Masulino Spielwelt" }).click();
  await page.getByRole("link", { name: "Berlin" }).click();
  await page.getByRole("link", { name: "Dienstplan" }).click();
  await page.getByRole("link", { name: "Wochenplan" }).click();
  await page.getByRole("button", { name: "Vorschlag erstellen" }).click();
  await expect(page.getByRole("heading", { name: "Entwurf" })).toBeVisible();
  await page.getByRole("button", { name: "Veröffentlichen" }).click();
  await expect(page.getByRole("heading", { name: "Veröffentlicht" })).toBeVisible();
  await page.getByRole("button", { name: "Vorschlag erstellen" }).click();
  await expect(page.getByRole("heading", { name: "Entwurf" })).toBeVisible();
  await page.getByRole("button", { name: "Gerät anmelden" }).click();
  const deviceToken = (await page.getByTestId("kiosk-token").innerText()).trim();
  await page.getByRole("button", { name: "Abmelden" }).click();

  await login(page, "employee.masulino@example.test");
  await page.goto("/app/masulino-spielwelt/berlin/workforce/plan");
  await expect(page.getByRole("heading", { name: "Entwurf" })).toHaveCount(0);
  await expect(page.getByText(/09:00.17:00/)).toBeVisible();
  await page.goto("/app/masulino-spielwelt/berlin/workforce/compensation");
  await expect(page.getByRole("heading", { name: "Kein Zugriff" })).toBeVisible();
  await expect(page.getByText("Personalkosten sind eine Schätzung")).toHaveCount(0);
  await page.goto("/app/masulino-spielwelt/berlin/workforce");
  await page.getByRole("button", { name: "Code für das Tablet" }).click();
  const capability = (await page.getByTestId("punch-capability").innerText()).trim();
  await page.getByRole("button", { name: "Abmelden" }).click();

  await page.goto("/kiosk");
  await expect(page.getByRole("heading", { name: "Tablet gesperrt" })).toBeVisible();
  await expect(page.getByText("Familie")).toHaveCount(0);
  await expect(page.getByText("Lohn")).toHaveCount(0);
  await page.getByLabel("Gerätecode").fill(deviceToken);
  await page.getByRole("button", { name: "Gerät anmelden" }).click();
  await expect(page.getByLabel("Einmalcode")).toBeVisible();
  await page.getByLabel("Einmalcode").fill(capability);
  await page.getByRole("button", { name: "Stempeln" }).click();
  await expect(page.getByText("Gespeichert. Das Tablet ist wieder gesperrt.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Tablet gesperrt" })).toBeVisible();
  await expect(page.getByText("Keine Kundendaten und keine Personalkosten.")).toBeVisible();
  await expect(page.getByText("Familie")).toHaveCount(0);
  await expect(page.getByText(/€|EUR|\d+,\d{2}/)).toHaveCount(0);

  await login(page, "owner.masulino@example.test");
  await page.getByRole("link", { name: "Masulino Spielwelt" }).click();
  await enrollTotp(page);
  await page.goto("/app/masulino-spielwelt/berlin/workforce/compensation");
  await expect(page.getByText("Personalkosten sind eine Schätzung und keine Lohnabrechnung.")).toBeVisible();
  await expect(page.getByText("Es ist kein Stundensatz hinterlegt.")).toBeVisible();
  await expect(page.getByText(/€|\d+,\d{2}/)).toHaveCount(0);
});
