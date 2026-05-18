/*\
title: $:/plugins/rimir/core-hook/test/test-xhr.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Unit tests for core-hook/xhr.js. Mocks XMLHttpRequest. Verifies CSRF +
Content-Type headers, JSON encode/decode, error propagation.

\*/
"use strict";

describe("core-hook: xhr", function() {

	var xhrMod;
	var calls;

	function FakeXHR() {
		var self = this;
		this.requestHeaders = {};
		this.method = null;
		this.url = null;
		this.async = null;
		this.body = null;
		this.readyState = 0;
		this.status = 0;
		this.responseText = "";
		this.onreadystatechange = null;
		// Driven by tests via this.respond(...).
		this.respond = function(status, body) {
			self.readyState = 4;
			self.status = status;
			self.responseText = body || "";
			if(typeof self.onreadystatechange === "function") { self.onreadystatechange(); }
		};
		calls.push(this);
	}
	FakeXHR.prototype.open = function(method, url, async) {
		this.method = method; this.url = url; this.async = async;
	};
	FakeXHR.prototype.setRequestHeader = function(k, v) { this.requestHeaders[k] = v; };
	FakeXHR.prototype.send = function(body) {
		this.body = body;
		// Sync: tests call .respond(...) BEFORE invoking helper to populate; sync helper
		// reads xhr.status/responseText directly without firing onreadystatechange.
		// Async: tests fire .respond(...) after the helper has returned.
	};

	beforeEach(function() {
		calls = [];
		xhrMod = require("$:/plugins/rimir/core-hook/xhr.js");
		xhrMod._setImplForTests(FakeXHR);
	});

	afterEach(function() {
		xhrMod._setImplForTests(null);
	});

	describe("xhrJson (async)", function() {
		it("sets CSRF + Content-Type headers and JSON-stringifies body", function() {
			xhrMod.xhrJson("POST", "/api/x", {a: 1}, function() {});
			var c = calls[0];
			expect(c.method).toBe("POST");
			expect(c.url).toBe("/api/x");
			expect(c.async).toBe(true);
			expect(c.requestHeaders["X-Requested-With"]).toBe("TiddlyWiki");
			expect(c.requestHeaders["Content-Type"]).toBe("application/json");
			expect(c.body).toBe('{"a":1}');
		});

		it("sends null body when input body is null", function() {
			xhrMod.xhrJson("GET", "/api/x", null, function() {});
			expect(calls[0].body).toBeNull();
		});

		it("parses JSON response and passes via callback", function(done) {
			xhrMod.xhrJson("GET", "/api/x", null, function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({ok: 1});
				done();
			});
			calls[0].respond(200, '{"ok":1}');
		});

		it("returns null data when response body is empty", function(done) {
			xhrMod.xhrJson("GET", "/api/x", null, function(err, data) {
				expect(err).toBeNull();
				expect(data).toBeNull();
				done();
			});
			calls[0].respond(204, "");
		});

		it("errors with HTTP status on >= 400 responses", function(done) {
			xhrMod.xhrJson("POST", "/api/x", {}, function(err, data) {
				expect(err).toBeTruthy();
				expect(err.status).toBe(403);
				expect(err.body).toBe('{"error":"nope"}');
				expect(data).toBeUndefined();
				done();
			});
			calls[0].respond(403, '{"error":"nope"}');
		});

		it("errors with status 0 on network failure", function(done) {
			xhrMod.xhrJson("POST", "/api/x", {}, function(err) {
				expect(err).toBeTruthy();
				expect(err.status).toBe(0);
				done();
			});
			calls[0].respond(0, "");
		});
	});

	describe("xhrJsonSync", function() {
		// Sync mode: override send() to stash status/body BEFORE send() returns.
		// We replicate that by manually setting xhr.status before invoking the helper —
		// the helper checks xhr.status right after .send().
		var primedStatus, primedBody;
		function PrimedXHR() {
			FakeXHR.call(this);
			var self = this;
			this.send = function(body) {
				self.body = body;
				self.status = primedStatus;
				self.responseText = primedBody;
			};
		}
		PrimedXHR.prototype = FakeXHR.prototype;

		beforeEach(function() {
			xhrMod._setImplForTests(PrimedXHR);
		});

		it("returns parsed data + status on 200", function() {
			primedStatus = 200; primedBody = '{"x":1}';
			var r = xhrMod.xhrJsonSync("GET", "/api/x", null);
			expect(r.status).toBe(200);
			expect(r.error).toBeNull();
			expect(r.data).toEqual({x: 1});
		});

		it("returns error on HTTP >= 400 but still parses body", function() {
			primedStatus = 400; primedBody = '{"error":"bad"}';
			var r = xhrMod.xhrJsonSync("POST", "/api/x", {});
			expect(r.status).toBe(400);
			expect(r.error).toBeTruthy();
			expect(r.data).toEqual({error: "bad"});
		});

		it("attaches rimir headers", function() {
			primedStatus = 200; primedBody = '{}';
			xhrMod.xhrJsonSync("POST", "/api/x", {z: 9});
			var c = calls[calls.length - 1];
			expect(c.requestHeaders["X-Requested-With"]).toBe("TiddlyWiki");
			expect(c.requestHeaders["Content-Type"]).toBe("application/json");
			expect(c.body).toBe('{"z":9}');
			expect(c.async).toBe(false);
		});
	});
});
