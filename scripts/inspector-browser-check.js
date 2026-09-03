/**
 * In an isolated Playwright CLI session already open on localhost:3000:
 * playwright-cli run-code "$(cat scripts/inspector-browser-check.js)"
 * Uses existing artwork read-only; only tool selection/inspector visibility change.
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
  await close.click();
  if (await inspector.isVisible()) throw new Error("Inspector did not close");
  return "PASS: non-destructive selection, contextual controls, keyboard tooltips, close";
}
