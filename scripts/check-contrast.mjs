import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import process from "node:process";
import { preview } from "vite";
import { chromium, expect } from "@playwright/test";

// Real browser + isolated API fixtures: no backend, database or saved user data.
const directory = "outputs/contrast";
await mkdir(directory, { recursive: true });
const server = await preview({ preview: { host: "127.0.0.1", port: 5186, strictPort: true } });
let browser;
const results = [];
const user = { id: "00000000-0000-4000-8000-000000000001", email: "kayque@taskflow.demo", name: "Kayque Augusto", job: "Desenvolvedor", role: "OWNER", workspaceId: "workspace", workspaceName: "TaskFlow" };
const workspace = { id: "workspace", name: "TaskFlow", ownerId: user.id, role: "OWNER", status: "ACTIVE", createdAt: "2026-09-01" };
const project = { id: "project", name: "Projeto de contraste", description: "Validação visual isolada", color: "#6c5ce7", status: "ACTIVE", start: "2026-09-01", due: "2026-10-30", memberIds: [user.id], createdAt: "2026-09-01", updatedAt: "2026-09-01" };
const tasks = ["PENDING", "IN_PROGRESS", "COMPLETED"].map((status, index) => ({ id: `task-${index}`, projectId: project.id, createdById: user.id, title: ["Revisar planejamento", "Implementar interface", "Validar entrega"][index], description: "", status, priority: "MEDIUM", due: "2026-09-26", completedAt: status === "COMPLETED" ? "2026-09-26" : null, createdAt: "2026-09-01", updatedAt: "2026-09-26", assignees: [{ userId: user.id, email: user.email }] }));
const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
function contrast(foreground, background) {
  const luminance = color => rgb(color).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const colors = locator => locator.evaluate(element => {
  const style = globalThis.getComputedStyle(element);
  return { color: style.color, background: style.backgroundColor, border: style.borderColor, weight: style.fontWeight };
});
async function badges(page) {
  const values = {};
  for (const label of ["Pendente", "Em andamento", "Concluída"]) {
    const badge = page.locator(".status").filter({ hasText: label }).first();
    await expect(badge).toBeVisible();
    values[label] = await colors(badge);
    assert.ok(contrast(values[label].color, values[label].background) >= 4.5, `${label}: text contrast >= 4.5`);
  }
  assert.notEqual(values.Pendente.color, values["Em andamento"].color);
  return values;
}
const geometrySelectors = ".sidebar,.topbar,.global-search,.global-search kbd,.metric-card,.metric-icon,.filter-tabs button,.table-wrap,th,td,.status";
async function geometry(page) {
  return page.locator(geometrySelectors).evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect(), style = globalThis.getComputedStyle(element);
    return { tag: element.tagName, class: element.className, x: rect.x, y: rect.y, width: rect.width, height: rect.height, font: style.font, padding: style.padding, radius: style.borderRadius };
  }));
}
async function compareLayout(page) {
  const current = await geometry(page);
  const baseline = Object.fromEntries(["styles", "parity"].map(name => [name, execFileSync("git", ["-c", `safe.directory=${process.cwd().replaceAll("\\", "/")}`, "show", `v0.1.0:src/${name}.css`], { encoding: "utf8", windowsHide: true })]));
  await page.evaluate(baseline => {
    for (const link of globalThis.document.querySelectorAll('link[rel="stylesheet"]')) link.disabled = true;
    const style = globalThis.document.createElement("style");
    style.id = "baseline-comparison";
    style.textContent = baseline.styles + "\n" + baseline.parity;
    globalThis.document.head.append(style);
  }, baseline);
  assert.deepEqual(await geometry(page), current, "Layout and typography match v0.1.0");
  await page.evaluate(() => {
    globalThis.document.getElementById("baseline-comparison").remove();
    for (const link of globalThis.document.querySelectorAll('link[rel="stylesheet"]')) link.disabled = false;
  });
}
try {
  browser = await chromium.launch({ headless: true });
  for (const theme of ["Claro", "Escuro", "Sistema"]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
    context.setDefaultTimeout(10000);
    let authenticated = true;
    const errors = [];
    await context.route("**/api/**", async route => {
      const pathname = new globalThis.URL(route.request().url()).pathname;
      let data;
      if (pathname === "/api/auth/logout") { authenticated = false; data = { loggedOut: true }; }
      else if (pathname === "/api/auth/me") {
        if (!authenticated) return route.fulfill({ status: 401, json: { error: { code: "UNAUTHENTICATED", message: "Sessão encerrada" } } });
        data = { user };
      } else if (pathname === "/api/workspaces") data = [workspace];
      else if (pathname.endsWith("/members")) data = [{ id: "membership", userId: user.id, workspaceId: workspace.id, email: user.email, name: user.name, job: user.job, workspaceJob: user.job, role: "OWNER", status: "ACTIVE" }];
      else if (pathname.endsWith("/projects")) data = [project];
      else if (pathname.endsWith("/tasks")) data = tasks;
      else if (pathname.endsWith("/activities")) data = [];
      else throw new Error(`Unexpected API request: ${pathname}`);
      await route.fulfill({ json: { data } });
    });
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    process.stdout.write(`Checking ${theme}...\n`);
    await page.goto("http://127.0.0.1:5186/configuracoes");
    await page.locator(".settings-panel select").selectOption(theme);
    await page.locator(".settings-save").click();
    await page.goto("http://127.0.0.1:5186/dashboard");
    await expect(page.locator(".metric-card")).toHaveCount(4);
    await expect(page.locator(".status")).toHaveCount(3);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.toLowerCase());
    const dashboardBadges = await badges(page);
    const icons = await page.locator(".metric-icon").evaluateAll(elements => elements.map(element => ({ background: globalThis.getComputedStyle(element).backgroundColor, color: globalThis.getComputedStyle(element.querySelector("svg")).color })));
    assert.deepEqual(icons, [
      { background: "rgb(238, 234, 253)", color: "rgb(108, 92, 231)" },
      { background: "rgb(232, 242, 255)", color: "rgb(55, 136, 232)" },
      { background: "rgb(255, 241, 223)", color: "rgb(237, 145, 44)" },
      { background: "rgb(230, 248, 242)", color: "rgb(27, 171, 131)" }
    ]);
    const shortcut = await colors(page.locator(".global-search kbd"));
    assert.equal(shortcut.background, theme === "Claro" ? "rgb(255, 255, 255)" : "rgba(0, 0, 0, 0)");
    if (theme !== "Claro") assert.ok(contrast(shortcut.color, (await colors(page.locator(".global-search"))).background) >= 4.5);
    await compareLayout(page);
    await page.screenshot({ path: `${directory}/dashboard-${theme}.png`, fullPage: true });
    await page.goto("http://127.0.0.1:5186/tarefas");
    await expect(page.locator(".status")).toHaveCount(3);
    assert.deepEqual(await badges(page), dashboardBadges);
    await compareLayout(page);
    for (const label of ["Todas", "Pendente", "Em andamento", "Concluída"]) {
      const tab = page.locator(".filter-tabs button").filter({ hasText: new RegExp(`^${label}$`) });
      await tab.click();
      await expect(tab).toHaveClass("selected");
      const selected = await colors(tab);
      assert.equal(selected.background, "rgb(238, 235, 255)");
      assert.equal(selected.weight, "650");
      assert.ok(contrast(selected.color, selected.background) >= 4.5);
      await page.screenshot({ path: `${directory}/tarefas-${theme}-${label.replaceAll(" ", "-")}.png`, fullPage: true });
    }
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme.toLowerCase());
    const projectId = Math.abs([...project.id].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) | 0, 11)) || 11;
    await page.goto(`http://127.0.0.1:5186/projetos/${projectId}`);
    assert.deepEqual(await badges(page), dashboardBadges);
    await page.goto("http://127.0.0.1:5186/equipe/1/atividades");
    assert.deepEqual(await badges(page), dashboardBadges);
    await page.locator(".profile-main").click();
    await page.getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    for (const route of ["login", "cadastro"]) {
      await page.goto(`http://127.0.0.1:5186/${route}`);
      assert.equal(await page.locator("html").getAttribute("data-theme"), null);
      const input = await colors(page.locator("input").first());
      assert.ok(contrast(input.color, input.background) >= 4.5);
      await page.screenshot({ path: `${directory}/${route}-after-${theme}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    results.push({ theme, dashboardBadges, shortcut, icons, passed: true });
    await context.close();
  }
  await writeFile(`${directory}/result.json`, JSON.stringify(results, null, 2));
  process.stdout.write("PASS: light/dark/system, four tabs, badges across four views, shortcut, icons, unchanged geometry, reload, logout and public forms.\n");
} finally {
  await browser?.close();
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
