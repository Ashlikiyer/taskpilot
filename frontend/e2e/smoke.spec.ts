import { expect, test } from "@playwright/test";

/**
 * The spec's smoke test: register → create workspace → create project →
 * quick-add a task → drag it to Done → check My Tasks. The task is assigned to
 * the new user, so My Tasks lists it while open and drops it once it's done.
 */
test("register, plan a task with quick-add and finish it", async ({ page }) => {
  const id = Date.now();
  const title = `Smoke test task ${id}`;

  await page.goto("/register");
  await page.getByLabel("Name").fill("Smoke Tester");
  await page.getByLabel("Email").fill(`smoke-${id}@example.com`);
  await page.getByLabel("Password").fill("smoke-test-password");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByRole("heading", { name: "Choose a workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create workspace" }).click();
  const workspaceDialog = page.getByRole("dialog");
  await workspaceDialog.getByLabel("Name").fill(`Smoke ${id}`);
  await workspaceDialog
    .getByRole("button", { name: "Create workspace" })
    .click();

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await page.getByRole("button", { name: "New project" }).first().click();
  const projectDialog = page.getByRole("dialog");
  await projectDialog.getByLabel("Name").fill("Website");
  await projectDialog.getByRole("button", { name: "Create project" }).click();
  await expect(page.getByRole("heading", { name: "Website" })).toBeVisible();

  // Quick-add: describe the task, then review and edit the AI's draft.
  await page
    .getByLabel("New task")
    .fill("Write the launch announcement by Friday");
  await page
    .locator("form")
    .filter({ has: page.getByLabel("New task") })
    .getByRole("button", { name: "Create with AI" })
    .click();
  const preview = page.getByRole("dialog");
  await expect(preview.getByText("Review the AI draft")).toBeVisible();
  await preview.getByLabel("Title").fill(title);
  await preview.getByRole("combobox", { name: "Assignee" }).click();
  await page.getByRole("option", { name: "Smoke Tester" }).click();
  await preview.getByRole("button", { name: "Confirm & create" }).click();

  const todo = page.getByRole("listitem", { name: /^To do,/ });
  await expect(todo.getByText(title)).toBeVisible();

  await page.getByRole("link", { name: "My Tasks" }).first().click();
  await expect(page.getByText(title)).toBeVisible();
  await page
    .getByRole("region", { name: "Projects" })
    .getByRole("link", { name: "Website" })
    .click();

  // Move it to Done with the keyboard (the same drag the mouse does).
  const card = page.getByRole("button", { name: new RegExp(`^${title}\.`) });
  await card.focus();
  await page.keyboard.press("Space");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  const done = page.getByRole("listitem", { name: /^Done,/ });
  await expect(done.getByText(title)).toBeVisible();

  await page.getByRole("link", { name: "My Tasks" }).first().click();
  await expect(page.getByText("You're all caught up")).toBeVisible();
});
