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
		link.classList.remove('mb-session-link');
		link.onclick = () => {
			if (!grainId) {
				grainId = (new URL(link.href).searchParams).get('grain');
			}
			if (grainId) {
				const evt = new CustomEvent('mb-silo:navigate', {detail: grainId});
				document.dispatchEvent(evt);
			}
			return false;
		};
		return link;
	}
};