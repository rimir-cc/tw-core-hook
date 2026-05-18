/*\
title: $:/plugins/rimir/core-hook/xhr.js
type: application/javascript
module-type: library

Browser-side XHR helpers that attach the rimir-standard CSRF header
(X-Requested-With: TiddlyWiki) and Content-Type: application/json, and
JSON-encode / JSON-decode bodies automatically.

Used by every browser-side action widget / startup hook that calls a
rimir `/api/...` route. Replaces the same setRequestHeader pattern
that's duplicated across file-upload/startup.js, realms/action-toggle.js,
git-int/action-git.js.

xhrJsonSync is explicitly retained because file-upload's
th-renaming-tiddler hook chain runs synchronously and can't await an
async callback. New code should prefer xhrJson.

\*/

"use strict";

// Module-local override for tests. Browser code never touches this; in Node,
// xhr.js runs inside TW's vm.runInContext sandbox where `global.XMLHttpRequest`
// from the outer process isn't visible — see tw-gotchas-testing.md.
var _xhrImplForTests = null;
function _getImpl() {
	return _xhrImplForTests || (typeof XMLHttpRequest !== "undefined" ? XMLHttpRequest : null);
}

function applyRimirHeaders(xhr) {
	xhr.setRequestHeader("X-Requested-With", "TiddlyWiki");
	xhr.setRequestHeader("Content-Type", "application/json");
}

function tryParse(text) {
	if(!text) { return null; }
	try { return JSON.parse(text); }
	catch(e) { return null; }
}

// Async JSON XHR. callback(err, data):
//   err truthy on network failure, HTTP >= 400, or malformed JSON.
//   On HTTP error: err.status = HTTP status; err.body = raw response text.
function xhrJson(method, url, body, callback) {
	var Impl = _getImpl();
	if(!Impl) { return callback(new Error("XMLHttpRequest not available")); }
	var xhr = new Impl();
	xhr.open(method, url, true);
	applyRimirHeaders(xhr);
	xhr.onreadystatechange = function() {
		if(xhr.readyState !== 4) { return; }
		if(xhr.status === 0) {
			var netErr = new Error("Network error");
			netErr.status = 0;
			return callback(netErr);
		}
		if(xhr.status >= 400) {
			var httpErr = new Error("HTTP " + xhr.status);
			httpErr.status = xhr.status;
			httpErr.body = xhr.responseText;
			return callback(httpErr);
		}
		callback(null, tryParse(xhr.responseText));
	};
	try {
		xhr.send(body === null || body === undefined ? null : JSON.stringify(body));
	} catch(e) {
		callback(e);
	}
}

// Sync JSON XHR. Returns {status, data, error}. error is null on success.
// Retained for hook chains that can't go async (file-upload rename hook).
function xhrJsonSync(method, url, body) {
	var Impl = _getImpl();
	if(!Impl) { return {status: 0, data: null, error: new Error("XMLHttpRequest not available")}; }
	var xhr = new Impl();
	try {
		xhr.open(method, url, false);
		applyRimirHeaders(xhr);
		xhr.send(body === null || body === undefined ? null : JSON.stringify(body));
	} catch(e) {
		return {status: 0, data: null, error: e};
	}
	if(xhr.status >= 400) {
		return {status: xhr.status, data: tryParse(xhr.responseText), error: new Error("HTTP " + xhr.status)};
	}
	return {status: xhr.status, data: tryParse(xhr.responseText), error: null};
}

exports.xhrJson = xhrJson;
exports.xhrJsonSync = xhrJsonSync;
exports._setImplForTests = function(impl) { _xhrImplForTests = impl; };
