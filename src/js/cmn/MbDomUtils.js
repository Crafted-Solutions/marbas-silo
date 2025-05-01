export const MbDomUtils = {
	clearNode: function(node) {
		if ('function' == typeof(node.replaceChildren)) {
			node.replaceChildren();
		} else {
			while(node.firstChild) this.removeChild(node.lastChild);
		}
	},

	hideNode: function(node, hide = true, useAria = true) {
		node.classList.toggle('d-none', hide);
		if (useAria) {
			if (hide) {
				node.setAttribute('aria-hidden', 'true');
			} else {
				node.removeAttribute('aria-hidden');
			}
		}
	},

	updateSessionLinks: function(container) {
		const sessionLinks = (container || document).querySelectorAll('.mb-session-link');
		sessionLinks.forEach((link) => {
			this.updateSessionLink(link);
		});
	},
	
	updateSessionLink: function(link, grainId = undefined) {
		const gid = () => grainId || (new URL(link.href).searchParams).get('grain');
		link.onclick = () => {
			const g = gid();
			if (g) {
				const evt = new CustomEvent('mb-silo:navigate', {detail: g});
				document.dispatchEvent(evt);
			}
			return false;
		};
		MbDomUtils.hideNode(link, !gid());
		return link;
	}
};