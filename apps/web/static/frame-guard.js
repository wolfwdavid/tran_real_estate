// Reveal only when top-level; otherwise stay hidden (OWASP hide-until-verified pattern).
(function () {
	if (window.self === window.top) {
		document.documentElement.removeAttribute('hidden');
	} else {
		try {
			window.top.location = window.self.location.href;
		} catch {
			/* cross-origin top navigation blocked; content stays hidden */
		}
	}
})();
