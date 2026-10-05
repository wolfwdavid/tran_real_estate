// Captures Chromium's install prompt before hydration (it can fire before onMount attaches a
// listener). An external 'self' script, like frame-guard.js: Kit's hash-mode CSP never hashes
// inline scripts in app.html. The Install UI reads window.__tranInstallPrompt on mount and
// listens for the tran:installable / tran:installed events.
(function () {
	window.addEventListener('beforeinstallprompt', function (e) {
		e.preventDefault();
		window.__tranInstallPrompt = e;
		window.dispatchEvent(new Event('tran:installable'));
	});
	window.addEventListener('appinstalled', function () {
		window.__tranInstallPrompt = undefined;
		window.dispatchEvent(new Event('tran:installed'));
	});
})();
