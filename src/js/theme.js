(function () {
	const attr = 'data-bs-theme';
	const htmlElement = document.documentElement;
	if (htmlElement.getAttribute(attr) === 'auto') {
		const matchDark = () => window.matchMedia('(prefers-color-scheme: dark)');
		const updateTheme = () => {
			htmlElement.setAttribute(attr, matchDark().matches ? "dark" : "light");
		};
		matchDark().addEventListener('change', updateTheme);
		updateTheme();
	}
})();