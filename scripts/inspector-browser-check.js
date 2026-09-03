/**
 * In an isolated Playwright CLI session already open on localhost:3000:
 * playwright-cli run-code "$(cat scripts/inspector-browser-check.js)"
 * Preserves existing artwork; adds then removes one temporary blank page.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Playwright CLI consumes this function expression.
async (page) => {
  const canvas = page.getByLabel("Pixel canvas", { exact: true });
  const close = page.getByRole("button", { name: "Close canvas settings", exact: true });
  if (await close.isVisible()) await close.click();
  const before = await canvas.evaluate(node => node.toDataURL());
  await canvas.click();
  const inspector = page.getByRole("complementary", { name: "Canvas settings", exact: true });
  if (!(await inspector.isVisible())) throw new Error("Canvas click did not open inspector");
  if (await canvas.evaluate(node => node.toDataURL()) !== before) {
    throw new Error("Inspection click modified artwork");
  }
  await page.getByRole("button", { name: "Text", exact: true }).click();
  if (!(await inspector.getByRole("spinbutton", { name: "Text size scale", exact: true }).isVisible())) {
    throw new Error("Text controls missing from inspector");
  }
  await page.getByRole("button", { name: "Text", exact: true }).press("Tab");
  if (!(await page.getByRole("tooltip", { name: "Add a pixel shape", exact: true }).isVisible())) {
    throw new Error("Keyboard tooltip missing");
  }
  await page.getByRole("button", { name: "Shape", exact: true }).click();
  if (!(await inspector.getByRole("button", { name: "Star", exact: true }).isVisible())) {
    throw new Error("Shape controls missing from inspector");
  }
  const pages = page.getByRole("navigation", { name: "Pages", exact: true });
  const count = await pages.getByRole("button", { name: /^Page \d+$/ }).count();
  const selected = await pages.locator('[aria-current="page"]').getAttribute("aria-label");
  await pages.getByRole("button", { name: "New page", exact: true }).click();
  try {
    if (await pages.locator('[aria-current="page"]').getAttribute("aria-label") !== `Page ${count + 1}`) {
      throw new Error("New page was not appended and selected");
    }
    if (!(await inspector.getByText(`Page ${count + 1}`, { exact: true }).isVisible())) {
      throw new Error("Inspector index does not match selected page");
    }
  } finally {
    await inspector.getByRole("button", { name: "Delete page", exact: true }).click();
    await pages.getByRole("button", { name: selected, exact: true }).click();
  }
  if (await pages.getByRole("button", { name: /^Page \d+$/ }).count() !== count) {
    throw new Error("Temporary page was not removed");
  }
  await close.click();
  if (await inspector.isVisible()) throw new Error("Inspector did not close");
  return "PASS: non-destructive selection, contextual controls, keyboard tooltips, ordered page creation/deletion, close";
}
