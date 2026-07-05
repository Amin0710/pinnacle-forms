/*
 * Regression tests for the Pinnacle standalone HTML forms.
 *
 * These load each self-contained HTML file in jsdom, execute its inline
 * <script>, and assert the dynamic behaviour that broke when the script block
 * stopped executing. Run with:  npm test
 *
 * No test framework — just jsdom + node:assert, so it stays a single
 * devDependency and needs no build step.
 */
import { JSDOM, VirtualConsole } from "jsdom";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
const failures = [];
function check(name, fn) {
	try {
		fn();
		passed++;
		console.log("  ✓ " + name);
	} catch (err) {
		failures.push(name);
		console.log("  ✗ " + name + "\n      " + (err.message || err));
	}
}

/** Load an HTML file, run its scripts, and collect any script runtime errors. */
function loadForm(file) {
	const html = fs.readFileSync(path.join(root, file), "utf8");
	const scriptErrors = [];
	const vc = new VirtualConsole();
	vc.on("jsdomError", (e) =>
		scriptErrors.push(e.detail ? e.detail.message || String(e.detail) : e.message),
	);
	const dom = new JSDOM(html, {
		runScripts: "dangerously",
		pretendToBeVisual: true,
		virtualConsole: vc,
		url: "https://pinnacleforms.online/",
	});
	return { dom, window: dom.window, document: dom.window.document, scriptErrors };
}

/** Count generated data rows in a rating-grid table (rows that hold a <td>, i.e. not the <th> header). */
function dataRowCount(table) {
	return Array.from(table.querySelectorAll("tr")).filter((tr) => tr.querySelector("td")).length;
}

const forms = [
	{ file: "enrolment-form.html", tables: null },
	{
		file: "lln-assessment-form.html",
		tables: { selfreflect: 17, selfrate: 4, feedback: 6 },
	},
];

for (const { file, tables } of forms) {
	console.log("\n" + file);
	const { window, document, scriptErrors } = loadForm(file);

	// 0. The inline script must execute without throwing.
	check("inline script executes without runtime error", () => {
		assert.deepEqual(scriptErrors, [], "script errors: " + scriptErrors.join(" | "));
	});

	// 1. Checking a data-reveal control opens (adds class "open" to) its target.
	check("checking a data-reveal control opens its target", () => {
		const ctrl = document.querySelector("[data-reveal]");
		assert.ok(ctrl, "no [data-reveal] control found");
		const targetId = ctrl.getAttribute("data-reveal").split(",")[0];
		const target = document.getElementById(targetId);
		assert.ok(target, "reveal target #" + targetId + " not found");
		assert.equal(target.classList.contains("open"), false, "target already open before interaction");
		ctrl.checked = true;
		ctrl.dispatchEvent(new window.Event("change", { bubbles: true }));
		assert.equal(target.classList.contains("open"), true, "target did not gain class 'open'");
	});

	// 2a. No field inside a closed reveal may be `required` — a hidden required
	//     field would trap validation and make the form unsubmittable.
	check("required fields inside closed reveals are not required", () => {
		const closed = document.querySelectorAll(".reveal:not(.open)");
		assert.ok(closed.length > 0, "expected at least one closed reveal to inspect");
		closed.forEach((reveal) => {
			reveal.querySelectorAll("input,select,textarea").forEach((f) => {
				assert.equal(f.required, false, "field inside closed reveal #" + reveal.id + " is required: " + (f.name || f.id));
			});
		});
	});

	// 2b. The data-was-required toggle works: a tagged field becomes required
	//     only while its reveal is open. Inject one so the mechanism is exercised
	//     even though the current markup has no statically-required reveal fields.
	check("data-was-required fields toggle with their reveal", () => {
		const ctrl = document.querySelector("[data-reveal]");
		const reveal = document.getElementById(ctrl.getAttribute("data-reveal").split(",")[0]);
		const probe = document.createElement("input");
		probe.type = "text";
		probe.name = "__probe__";
		probe.setAttribute("data-was-required", "1");
		probe.required = false;
		reveal.appendChild(probe);

		ctrl.checked = true;
		ctrl.dispatchEvent(new window.Event("change", { bubbles: true }));
		assert.equal(probe.required, true, "tagged field not required when reveal opened");

		ctrl.checked = false;
		ctrl.dispatchEvent(new window.Event("change", { bubbles: true }));
		assert.equal(probe.required, false, "tagged field still required when reveal closed");
		probe.remove();
	});

	// 3. LLN generated rating grids have the expected number of data rows.
	if (tables) {
		check("generated tables have expected data-row counts", () => {
			for (const [id, expected] of Object.entries(tables)) {
				const table = document.getElementById(id);
				assert.ok(table, "table #" + id + " not found");
				assert.equal(dataRowCount(table), expected, "#" + id + " row count");
			}
		});
	}

	// 4. Submitting the empty form does NOT navigate/submit — validation blocks it.
	check("submitting the empty form does not navigate (validation blocks it)", () => {
		const form = document.getElementById("mainform");
		let fetched = false;
		window.fetch = () => {
			fetched = true;
			return Promise.resolve({});
		};
		const ev = new window.Event("submit", { bubbles: true, cancelable: true });
		form.dispatchEvent(ev);
		assert.equal(form.checkValidity(), false, "empty form unexpectedly reports valid");
		assert.equal(ev.defaultPrevented, true, "submit default was not prevented");
		assert.equal(fetched, false, "form was submitted despite being empty");
	});
}

console.log("\n" + "-".repeat(48));
console.log(passed + " passed, " + failures.length + " failed");
if (failures.length) {
	console.error("FAILED: " + failures.join(", "));
	process.exit(1);
}
