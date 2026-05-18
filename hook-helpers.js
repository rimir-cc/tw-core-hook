/*\
title: $:/plugins/rimir/core-hook/hook-helpers.js
type: application/javascript
module-type: library

Helpers for the th-saving-tiddler / th-renaming-tiddler / th-deleting-tiddler
hook chain. The common safety mistake — returning undefined from a hook —
silently breaks every downstream handler. safeHook wraps a body so that:

  1. Exceptions don't propagate out of the chain (caught + logged).
  2. An undefined return value falls back to passing the first arg through.
  3. A non-undefined return wins (file-upload returns a modified tiddler on rename).

Three TW hook signatures detected by arity:
  fn(tiddler)                  → deleting hook
  fn(newTiddler, draftTiddler) → saving hook
  fn(newTiddler, oldTiddler)   → renaming hook

CAVEAT (do not remove): safeHook prevents *future* rimir hooks from
breaking the chain. It does NOT fix the existing chain breakage caused
by the third-party sq/streams plugin returning undefined from
th-deleting-tiddler. The existing workarounds stay:
  - file-upload/startup.js: change-event listener (~line 340)
  - minver/save-hook.js: wiki.deleteTiddler wrap (~line 82)

\*/

"use strict";

function isDraft(tiddler) {
	return !!(tiddler && tiddler.fields && tiddler.fields["draft.of"]);
}

function isTransient(title) {
	if(typeof title !== "string") { return false; }
	return title.indexOf("$:/temp/") === 0 || title.indexOf("$:/state/") === 0;
}

// Wrap a hook body so it always returns the right value and never throws.
function safeHook(fn) {
	return function() {
		var args = arguments;
		var firstArg = args[0];
		var result;
		try {
			result = fn.apply(this, args);
		} catch(e) {
			console.error("[rimir hook]", e);
			return firstArg;
		}
		return result === undefined ? firstArg : result;
	};
}

exports.isDraft = isDraft;
exports.isTransient = isTransient;
exports.safeHook = safeHook;
