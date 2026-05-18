/*\
title: $:/plugins/rimir/core-hook/test/test-hook-helpers.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Unit tests for core-hook/hook-helpers.js.

\*/
"use strict";

describe("core-hook: hook-helpers", function() {

	var hh;
	var originalError;

	beforeEach(function() {
		hh = require("$:/plugins/rimir/core-hook/hook-helpers.js");
		originalError = console.error;
		console.error = function() {}; // silence expected logs during exception tests
	});

	afterEach(function() {
		console.error = originalError;
	});

	describe("isDraft", function() {
		it("returns true when tiddler has draft.of field", function() {
			expect(hh.isDraft({fields: {"draft.of": "Foo"}})).toBe(true);
		});
		it("returns false when tiddler has no draft.of field", function() {
			expect(hh.isDraft({fields: {title: "Foo"}})).toBe(false);
		});
		it("returns false for null/undefined/empty inputs", function() {
			expect(hh.isDraft(null)).toBe(false);
			expect(hh.isDraft(undefined)).toBe(false);
			expect(hh.isDraft({})).toBe(false);
			expect(hh.isDraft({fields: {}})).toBe(false);
		});
	});

	describe("isTransient", function() {
		it("recognises $:/temp/ prefix", function() {
			expect(hh.isTransient("$:/temp/foo")).toBe(true);
		});
		it("recognises $:/state/ prefix", function() {
			expect(hh.isTransient("$:/state/bar")).toBe(true);
		});
		it("rejects non-system tiddlers and other system titles", function() {
			expect(hh.isTransient("Foo")).toBe(false);
			expect(hh.isTransient("$:/plugins/rimir/foo")).toBe(false);
		});
		it("returns false for non-strings", function() {
			expect(hh.isTransient(null)).toBe(false);
			expect(hh.isTransient(undefined)).toBe(false);
			expect(hh.isTransient(42)).toBe(false);
		});
	});

	describe("safeHook", function() {
		it("returns the wrapped function's return value when non-undefined", function() {
			var wrapped = hh.safeHook(function(t) { return {fields: {modified: true, title: t.fields.title}}; });
			var input = {fields: {title: "Foo"}};
			var out = wrapped(input);
			expect(out.fields.modified).toBe(true);
		});

		it("falls back to the first argument when wrapped function returns undefined", function() {
			var wrapped = hh.safeHook(function() { /* deliberate no return */ });
			var input = {fields: {title: "Foo"}};
			var out = wrapped(input);
			expect(out).toBe(input);
		});

		it("catches exceptions and returns the first argument", function() {
			var wrapped = hh.safeHook(function() { throw new Error("boom"); });
			var input = {fields: {title: "Foo"}};
			var out = wrapped(input);
			expect(out).toBe(input);
		});

		it("passes all arguments to the wrapped function (saving signature)", function() {
			var captured = null;
			var wrapped = hh.safeHook(function(newT, draftT) {
				captured = {n: newT, d: draftT};
				return newT;
			});
			var newT = {fields: {title: "X"}};
			var draftT = {fields: {"draft.of": "X"}};
			wrapped(newT, draftT);
			expect(captured.n).toBe(newT);
			expect(captured.d).toBe(draftT);
		});

		it("handles deleting hook signature (one arg)", function() {
			var wrapped = hh.safeHook(function(t) { return t; });
			var input = {fields: {title: "Foo"}};
			expect(wrapped(input)).toBe(input);
		});

		it("preserves a non-undefined falsy return (e.g. null) — the body wins", function() {
			var wrapped = hh.safeHook(function() { return null; });
			expect(wrapped({fields: {title: "Foo"}})).toBeNull();
		});
	});
});
