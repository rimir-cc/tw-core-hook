/*\
title: $:/plugins/rimir/core-hook/test/test-route-helpers.js
type: application/javascript
tags: [[$:/tags/test-spec]]

Unit tests for core-hook/route-helpers.js. Mocks state + response objects.
Verifies CSRF / size-limit / JSON-parse error paths produce the standardised
`{error: "..."}` shape and the right HTTP status code.

\*/
"use strict";

describe("core-hook: route-helpers", function() {

	var rh;

	function mockResponse() {
		return {
			statusCode: null,
			headers: null,
			body: null,
			ended: false,
			writeHead: function(code, headers) { this.statusCode = code; this.headers = headers; },
			end: function(body) { this.body = body; this.ended = true; }
		};
	}

	function mockState(data, withCsrf) {
		return {
			data: data,
			request: {headers: withCsrf ? {"x-requested-with": "TiddlyWiki"} : {}}
		};
	}

	beforeEach(function() {
		rh = require("$:/plugins/rimir/core-hook/route-helpers.js");
	});

	describe("sendJson", function() {
		it("writes status, content-type, and JSON body", function() {
			var resp = mockResponse();
			rh.sendJson(resp, 200, {ok: true});
			expect(resp.statusCode).toBe(200);
			expect(resp.headers["Content-Type"]).toBe("application/json");
			expect(resp.headers["Access-Control-Allow-Origin"]).toBeUndefined();
			expect(JSON.parse(resp.body)).toEqual({ok: true});
		});

		it("sets CORS header only when opted in", function() {
			var resp = mockResponse();
			rh.sendJson(resp, 200, {ok: true}, {cors: true});
			expect(resp.headers["Access-Control-Allow-Origin"]).toBe("*");
		});

		it("defaults to 200 when statusCode is falsy", function() {
			var resp = mockResponse();
			rh.sendJson(resp, 0, {});
			expect(resp.statusCode).toBe(200);
		});
	});

	describe("requireCsrf", function() {
		it("returns true and does not write a response when header is present", function() {
			var resp = mockResponse();
			expect(rh.requireCsrf(mockState("", true), resp)).toBe(true);
			expect(resp.ended).toBe(false);
		});

		it("returns false and sends 403 when header is missing", function() {
			var resp = mockResponse();
			expect(rh.requireCsrf(mockState("", false), resp)).toBe(false);
			expect(resp.statusCode).toBe(403);
			expect(JSON.parse(resp.body).error).toBe("CSRF check failed");
		});
	});

	describe("parseJsonBody", function() {
		it("parses a valid JSON body and invokes callback with no error", function(done) {
			var resp = mockResponse();
			rh.parseJsonBody(mockState('{"a":1,"b":"x"}', true), resp, {requireCsrf: true}, function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({a: 1, b: "x"});
				expect(resp.ended).toBe(false);
				done();
			});
		});

		it("sends 403 when requireCsrf is true and header is missing", function(done) {
			var resp = mockResponse();
			rh.parseJsonBody(mockState('{}', false), resp, {requireCsrf: true}, function(err) {
				expect(err).toBeTruthy();
				expect(resp.statusCode).toBe(403);
				expect(JSON.parse(resp.body).error).toBe("CSRF check failed");
				done();
			});
		});

		it("does not enforce CSRF when requireCsrf is omitted", function(done) {
			var resp = mockResponse();
			rh.parseJsonBody(mockState('{"ok":true}', false), resp, {}, function(err, data) {
				expect(err).toBeNull();
				expect(data).toEqual({ok: true});
				done();
			});
		});

		it("sends 413 when body exceeds maxSize", function(done) {
			var resp = mockResponse();
			rh.parseJsonBody(mockState('{"x":"abcde"}', true), resp, {requireCsrf: true, maxSize: 5}, function(err) {
				expect(err).toBeTruthy();
				expect(resp.statusCode).toBe(413);
				expect(JSON.parse(resp.body).error).toBe("Body too large");
				done();
			});
		});

		it("sends 400 on empty body", function(done) {
			var resp = mockResponse();
			rh.parseJsonBody(mockState("", true), resp, {requireCsrf: true}, function(err) {
				expect(err).toBeTruthy();
				expect(resp.statusCode).toBe(400);
				expect(JSON.parse(resp.body).error).toBe("Empty request body");
				done();
			});
		});

		it("sends 400 on malformed JSON", function(done) {
			var resp = mockResponse();
			rh.parseJsonBody(mockState('{not json', true), resp, {requireCsrf: true}, function(err) {
				expect(err).toBeTruthy();
				expect(resp.statusCode).toBe(400);
				expect(JSON.parse(resp.body).error).toBe("Invalid JSON body");
				done();
			});
		});

		it("defaults maxSize to 1 MB", function() {
			expect(rh.DEFAULT_MAX_SIZE).toBe(1024 * 1024);
		});
	});
});
