import { expect, test } from "@playwright/test";
import type { Route } from "@playwright/test";

/**
 * Set value on an mdui-text-field and its associated form field
 */
async function fillField(page: import("@playwright/test").Page, name: string, value: string) {
  await page.locator(`mdui-text-field[name="${name}"]`).evaluate((el, val) => {
    const field = el as HTMLElement & { value: string; name: string };
    field.value = val;
    // Ensure the web component participates in FormData by setting a hidden input fallback
    const form = field.closest("form");
    if (form) {
      let hidden = form.querySelector(`input[data-wc-name="${field.name}"]`) as HTMLInputElement | null;
      if (!hidden) {
        hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = field.name;
        hidden.dataset.wcName = field.name;
        form.appendChild(hidden);
      }
      hidden.value = val;
    }
  }, value);
}

test.describe("invite code registration", () => {
  test("includes invite code in account creation request when present in URL", async ({
    page,
  }) => {
    const inviteCode = "TESTINVITECODE";

    // Intercept the account creation request and capture its body
    const requestPromise = new Promise<Record<string, unknown>>((resolve) => {
      page.route(/\/auth\/account\/create/, async (route: Route) => {
        resolve(route.request().postDataJSON());
        await route.fulfill({ status: 200, body: JSON.stringify({}) });
      });
    });

    await page.goto(`/login/create?invite=${inviteCode}`);
    await page.locator("mdui-text-field[name='email']").waitFor();

    await fillField(page, "email", "test@example.com");
    await fillField(page, "password", "password123");

    await page.evaluate(() =>
      document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );

    const body = await requestPromise;
    expect(body.invite).toBe(inviteCode);
  });

  test("does not include invite code in account creation request when absent from URL", async ({
    page,
  }) => {
    const requestPromise = new Promise<Record<string, unknown>>((resolve) => {
      page.route(/\/auth\/account\/create/, async (route: Route) => {
        resolve(route.request().postDataJSON());
        await route.fulfill({ status: 200, body: JSON.stringify({}) });
      });
    });

    await page.goto("/login/create");
    await page.locator("mdui-text-field[name='email']").waitFor();

    await fillField(page, "email", "test@example.com");
    await fillField(page, "password", "password123");

    await page.evaluate(() =>
      document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    );

    const body = await requestPromise;
    expect(body.invite).toBeUndefined();
  });
});
