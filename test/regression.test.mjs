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

	// 4b. LLN-only: the assessor "Section 1 — Language" card renders and is fully optional.
	if (file === "lln-assessment-form.html") {
		check("Section 1 Language (assessor) card renders with 5 items and an amber note", () => {
			const heads = [...document.querySelectorAll(".card .head")].map((h) =>
				h.textContent.replace(/\s+/g, " ").trim(),
			);
			const idx = heads.findIndex((h) => h.startsWith("Section 1 — Language"));
			assert.ok(idx > -1, "Section 1 — Language card not found");
			assert.match(heads[idx - 1], /Self rating/, "card not placed after the self-rating card");
			assert.match(heads[idx + 1], /Literacy/, "card not placed before the Literacy card");

			const amber = document.querySelector(".card .note.amber");
			assert.ok(amber, "amber assessor note missing");
			assert.match(amber.textContent, /assessor during verbal questioning/, "amber note text wrong");

			for (let n = 1; n <= 5; n++) {
				assert.ok(document.querySelector(`[name="lang${n}_answer"]`), `item ${n} answer control missing`);
				assert.equal(document.querySelectorAll(`[name="lang${n}_attempts"]`).length, 3, `item ${n} should have 3 attempts radios`);
				const suff = [...document.querySelectorAll(`[name="lang${n}_sufficient"]`)];
				assert.deepEqual(suff.map((r) => r.value), ["Yes", "No"], `item ${n} sufficient radios wrong`);
				assert.ok(document.querySelector(`input[name="lang${n}_comments"]`), `item ${n} comments input missing`);
			}
		});

		check("all Section 1 assessor fields are optional (students leave blank)", () => {
			const fields = document.querySelectorAll('[name^="lang"]');
			assert.ok(fields.length >= 5 * (1 + 3 + 2 + 1), "expected the full set of assessor fields");
			fields.forEach((f) => {
				assert.equal(f.required, false, "assessor field is required: " + f.name);
				assert.equal(f.hasAttribute("data-was-required"), false, "assessor field wrongly tagged data-was-required: " + f.name);
			});
		});
	}

	// 5. enrolment-form-only interactive behaviours
	if (file === "enrolment-form.html") {
		const fire = (el, type = "change") =>
			el.dispatchEvent(new window.Event(type, { bubbles: true }));

		// 5a. Single-name toggle disables/clears given names and swaps the family-name label.
		check("single-name toggle disables/clears given names and updates label", () => {
			const sn = document.getElementById("single_name");
			const fn = document.getElementById("first_name");
			const mn = document.getElementById("middle_name");
			const label = document.querySelector('label[for="family_name"]');
			const original = label.textContent;
			fn.value = "Jane";
			mn.value = "Q";
			assert.equal(fn.required, true, "first name should start required");

			sn.checked = true;
			fire(sn);
			assert.equal(fn.disabled, true, "first name not disabled when ticked");
			assert.equal(mn.disabled, true, "middle name not disabled when ticked");
			assert.equal(fn.value, "", "first name not cleared");
			assert.equal(mn.value, "", "middle name not cleared");
			assert.equal(fn.required, false, "first name still required when ticked");
			assert.equal(label.textContent, "Full name (single name)", "family label not updated");

			sn.checked = false;
			fire(sn);
			assert.equal(fn.disabled, false, "first name not re-enabled");
			assert.equal(fn.required, true, "first name not required again");
			assert.equal(label.textContent, original, "family label not restored");
		});

		// 5b. Qualifications table is always in the DOM (not a reveal); enabled only when Q14 = Yes.
		check("qualifications table always visible, enabled only when Q14 = Yes", () => {
			const list = document.getElementById("qualslist");
			assert.ok(list, "#qualslist not found");
			assert.equal(list.classList.contains("reveal"), false, "#qualslist is still a reveal");
			const fields = () => list.querySelectorAll("input,select");
			const allDisabled = () => [...fields()].every((f) => f.disabled);
			const allEnabled = () => [...fields()].every((f) => !f.disabled);

			// unanswered on load -> disabled + dimmed
			assert.equal(allDisabled(), true, "table not disabled while Q14 unanswered");
			assert.equal(list.classList.contains("qual-disabled"), true, "qual-disabled class missing when disabled");

			const yes = document.querySelector('input[name="prev_quals"][value="Yes"]');
			const no = document.querySelector('input[name="prev_quals"][value="No"]');
			yes.checked = true;
			fire(yes);
			assert.equal(allEnabled(), true, "table not enabled when Q14 = Yes");
			assert.equal(list.classList.contains("qual-disabled"), false, "qual-disabled class present when enabled");

			// populate, then answer No -> cleared + disabled again
			const cb = list.querySelector('input[type="checkbox"]');
			const sel = list.querySelector("select");
			cb.checked = true;
			sel.selectedIndex = 1;
			no.checked = true;
			fire(no);
			assert.equal(allDisabled(), true, "table not disabled when Q14 = No");
			assert.equal(cb.checked, false, "checkbox not cleared on Q14 = No");
			assert.equal(sel.value, "", "select not cleared on Q14 = No");
		});

		// 5c. USI is required and validates as exactly 10 alphanumeric chars, auto-uppercased.
		check("USI is required and validates exactly 10 alphanumeric chars", () => {
			const usi = document.getElementById("usi");
			assert.equal(usi.required, true, "USI not required");

			usi.value = "abcd1234ef";
			fire(usi, "input");
			assert.equal(usi.value, "ABCD1234EF", "USI not auto-uppercased");
			assert.equal(usi.validationMessage, "", "valid USI reports a custom error");
			assert.equal(usi.checkValidity(), true, "valid 10-char USI reported invalid");

			usi.value = "SHORT";
			fire(usi, "input");
			assert.equal(usi.checkValidity(), false, "5-char USI reported valid");

			usi.value = "ABC!@#1234";
			fire(usi, "input");
			assert.equal(usi.checkValidity(), false, "non-alphanumeric USI reported valid");

			usi.value = "";
			fire(usi, "input");
			assert.equal(usi.checkValidity(), false, "empty required USI reported valid");
		});

		// 5d. Q7/Q8 "Other" fields become required only while their reveal is open,
		//     and are cleared + un-required when it closes (data-was-required loader).
		check("Q7/Q8 Other fields are required only while their reveal is open", () => {
			const cases = [
				{ field: "birth_country_other", radio: 'input[name="birth_country"][value="Other"]', close: 'input[name="birth_country"]:not([value="Other"])' },
				{ field: "other_language_specify", radio: 'input[name="other_language"][value="Yes"]', close: 'input[name="other_language"][value="No, English only"]' },
			];
			cases.forEach(({ field, radio, close }) => {
				const f = document.getElementById(field);
				assert.ok(f, "#" + field + " not found");
				assert.equal(f.getAttribute("data-was-required"), "1", field + " not tagged data-was-required");
				assert.equal(f.required, false, field + " should not be required on load (reveal closed)");

				document.querySelector(radio).checked = true;
				fire(document.querySelector(radio));
				assert.equal(f.required, true, field + " not required when reveal opened");

				f.value = "typed";
				document.querySelector(close).checked = true;
				fire(document.querySelector(close));
				assert.equal(f.required, false, field + " still required when reveal closed");
				assert.equal(f.value, "", field + " not cleared when reveal closed");
			});
		});

		// 5e. Employment details are always visible: no gating checkbox / reveal wrapper.
		check("employment details always visible (no reveal, no emp_applicable)", () => {
			assert.equal(document.getElementById("emp_applicable"), null, "emp_applicable checkbox still present");
			assert.equal(document.getElementById("empblock"), null, "empblock reveal wrapper still present");
			const ids = ["emp_legal", "emp_position", "emp_address", "emp_phone", "emp_email", "emp_supervisor", "emp_sup_position"];
			ids.forEach((id) => {
				const f = document.getElementById(id);
				assert.ok(f, "#" + id + " not found");
				assert.equal(f.disabled, false, "#" + id + " is disabled");
				assert.equal(f.closest(".reveal"), null, "#" + id + " is still inside a reveal");
			});
		});
	}
}

console.log("\n" + "-".repeat(48));
console.log(passed + " passed, " + failures.length + " failed");
if (failures.length) {
	console.error("FAILED: " + failures.join(", "));
	process.exit(1);
}
