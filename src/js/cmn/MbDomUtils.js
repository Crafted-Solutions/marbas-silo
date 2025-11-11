const INPUT_EVENTS = ['keydown', 'paste', 'focus', 'mousedown'];

function handleReadonlyInput(evt) {
	if (evt.keyCode != 9) evt.preventDefault();
}

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

	fakeReadonlyElements: function (container) {
		const elms = container.querySelectorAll(`.readonly`);
		for (const elm of elms) {
			for (const evt of INPUT_EVENTS) {
				elm.addEventListener(evt, handleReadonlyInput);
			}
		}
	},

	buildFromTemplate(elmId, templateFunc, context = {}, parent = document.body) {
		if (!document.getElementById(elmId)) {
			const tpl = document.createElement('template');
			tpl.innerHTML = templateFunc(context);
			parent.appendChild(tpl.content);
		}
	},

	downloadBlob: function downloadBlob(blob, name) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.target = '_blank';
		if (name) {
			a.download = name;
		}
		a.style.display = 'none';
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			console.info("Revoking blob URL");
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 60000);
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