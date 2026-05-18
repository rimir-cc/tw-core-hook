/*\
title: $:/plugins/rimir/core-hook/route-helpers.js
type: application/javascript
module-type: library

Shared server-side route utilities. Lets every mutating rimir route declare:

  var routeHelpers = require("$:/plugins/rimir/core-hook/route-helpers.js");
  routeHelpers.parseJsonBody(state, response, {maxSize, requireCsrf}, function(err, data) {
    if(err) { return; }                       // helper already sent the response
    ... routeHelpers.sendJson(response, 200, {ok: true});
  });

Replaces five+ ad-hoc copies of the same JSON-parse + CSRF + size-limit
pattern across file-upload, file-pipeline, git-int, realms, ext-connect.

Error shape on rejection is always `{error: "..."}` (single, standardised key).

\*/

"use strict";

var DEFAULT_MAX_SIZE = 1024 * 1024; // 1 MB — file-upload routes override to 50 MB.

function sendJson(response, statusCode, data, options) {
	options = options || {};
	var headers = {"Content-Type": "application/json"};
	if(options.cors) { headers["Access-Control-Allow-Origin"] = "*"; }
	response.writeHead(statusCode || 200, headers);
	response.end(JSON.stringify(data));
}

// Returns true if the request carries the CSRF marker header, false (and sends 403)
// otherwise. Standalone export for GET routes that mutate via query params.
function requireCsrf(state, response) {
	var headers = (state && state.request && state.request.headers) || {};
	if(headers["x-requested-with"] !== "TiddlyWiki") {
		sendJson(response, 403, {error: "CSRF check failed"});
		return false;
	}
	return true;
}

// Parse a JSON body with CSRF + size guards. callback(err, parsed):
//   - err truthy iff response has already been sent; caller MUST return.
//   - err falsy iff parsed is the JSON object.
function parseJsonBody(state, response, options, callback) {
	options = options || {};
	var maxSize = options.maxSize || DEFAULT_MAX_SIZE;
	if(options.requireCsrf && !requireCsrf(state, response)) {
		return callback(new Error("CSRF check failed"));
	}
	var raw = (state && state.data) || "";
	if(typeof raw !== "string") {
		sendJson(response, 400, {error: "Invalid request body"});
		return callback(new Error("Invalid body type"));
	}
	if(raw.length > maxSize) {
		sendJson(response, 413, {error: "Body too large"});
		return callback(new Error("Body too large"));
	}
	if(raw.length === 0) {
		// Empty body is a 400, not a JSON.parse error masquerading as one.
		sendJson(response, 400, {error: "Empty request body"});
		return callback(new Error("Empty body"));
	}
	var parsed;
	try {
		parsed = JSON.parse(raw);
	} catch(e) {
		sendJson(response, 400, {error: "Invalid JSON body"});
		return callback(e);
	}
	callback(null, parsed);
}

exports.sendJson = sendJson;
exports.requireCsrf = requireCsrf;
exports.parseJsonBody = parseJsonBody;
exports.DEFAULT_MAX_SIZE = DEFAULT_MAX_SIZE;
