export const MbDomUtils = {
	clearNode: function (node) {
		if ('function' == typeof (node.replaceChildren)) {
			node.replaceChildren();
		} else {
			while (node.firstChild) this.removeChild(node.lastChild);
		}
	},

	hideNode: function (node, hide = true, useAria = true) {
		node.classList.toggle('d-none', hide);
		if (useAria) {
			if (hide) {
				node.setAttribute('aria-hidden', 'true');
			} else {
				node.removeAttribute('aria-hidden');
			}
		}
	},

	updateSessionLinks: function (container) {
		const sessionLinks = (container || document).querySelectorAll('.mb-session-link');
		sessionLinks.forEach((link) => {
			this.updateSessionLink(link);
		});
	},

	updateSessionLink: function (link, grainId = undefined) {
		const gid = () => grainId || (new URL(link.href).searchParams).get('grain');
		link.onclick = () => {
			const g = gid();
			if (g) {
				const evt = new CustomEvent('mb-silo:navigate', { detail: g });
				document.dispatchEvent(evt);
			}
			return false;
		};
		MbDomUtils.hideNode(link, !gid());
		return link;
	},

	stripUrlParameters: function (url, cleanParams = null) {
		const prevSize = url.searchParams.size;
		if (!cleanParams) {
			cleanParams = [...url.searchParams.keys()];
		}
		for (const param of cleanParams) {
			url.searchParams.delete(param);
		}
		return prevSize > url.searchParams.size;
	},

	cleanBrowserLocation: function cleanBrowserLocation(cleanParams = null) {
		const url = new URL(window.location.href);
		if (this.stripUrlParameters(url, cleanParams)) {
			window.history.replaceState({}, document.title, url);
		}
	}
};