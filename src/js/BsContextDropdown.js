import { Dropdown } from "bootstrap";

export class BsContextDropdown {
	#menuElm;
	#triggerElm;
	#menuEvt;
	#lastFocus;
	constructor(menuElm, triggerElm) {
		this.#menuElm = 'string' == typeof (menuElm) ? document.getElementById(menuElm) : menuElm;
		this.#triggerElm = 'string' == typeof (triggerElm) ? document.getElementById(triggerElm) : triggerElm;

		["contextmenu", "long-press"].forEach((type) => {
			this.#triggerElm.addEventListener(type, (evt) => {
				this.#lastFocus = document.activeElement;
				this.#menuEvt = evt;
				document.body.setAttribute('data-bs-toggle', 'dropdown');
				const dd = Dropdown.getOrCreateInstance(this.#menuElm);
				[this.#menuElm, document.body].forEach(x => x.addEventListener('hidden.bs.dropdown', (evt) => {
					document.body.removeAttribute('data-bs-toggle');
					if (this.#lastFocus && 'function' == typeof this.#lastFocus.focus) {
						this.#lastFocus.focus();
					}
					this.#lastFocus = null;
				}));
				this.#menuElm.style.left = `${evt.pageX}px`;
				this.#menuElm.style.top = `${evt.pageY}px`;
				dd.update();
				evt.preventDefault();
				evt.stopPropagation();

				dd.show();
			});
		});
		const page = document.querySelector('html');
		['mousedown'].forEach(type => {
			page.addEventListener(type, (evt) => {
				if (this.#menuElm != evt.target && !this.#menuElm.contains(evt.target)) {
					this.hide();
				}
			});
		});
		this.#menuElm.querySelectorAll('.dropdown-item:not(.dropdown-toggle)').forEach((elm) => {
			elm.addEventListener('click', () => {
				this.hide();
			});
		});
	}

	show() {
		Dropdown.getOrCreateInstance(this.#menuElm).show();
	}

	hide() {
		Dropdown.getOrCreateInstance(this.#menuElm).hide();
	}

	addEventListener(evtType, listener) {
		const cb = (evt) => {
			evt.menuEvent = this.#menuEvt;
			listener(evt);
		};
		this.#menuElm.addEventListener(evtType, cb);
		if ('hidden.bs.dropdown' == evtType || 'hide.bs.dropdown' == evtType) {
			document.body.addEventListener(evtType, cb);
		}
	}

	addCmdListener(cmd, listener) {
		this.#menuElm.querySelector(`#${cmd}`).addEventListener('click', (evt) => {
			listener(this.#menuEvt || evt);
		});
	}

	enableCmd(cmd, enable = true) {
		const elm = this.#menuElm.querySelector(`#${cmd}`);
		elm.disabled = !enable;
	}

	isCmdEnabled(cmd) {
		const elm = this.#menuElm.querySelector(`#${cmd}`);
		return elm && !elm.disabled;
	}

	addCmd(options, beforeCmd, skipSeparator, subMenu = `${this.#menuElm.id}`) {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.id = options.id;
		btn.className = 'dropdown-item';
		btn.textContent = options.title;
		btn.addEventListener('click', () => {
			this.hide();
		});

		if (options.listener) {
			btn.addEventListener('click', (evt) => {
				options.listener(this.#menuEvt || evt);
			});
		}

		const item = document.createElement('li');
		item.appendChild(btn);

		const mnu = this.#menuElm.querySelector(`ul.dropdown-menu[aria-labelledby="${subMenu}-trigger"]`);
		if (beforeCmd) {
			let nextItem = (this.#menuElm.querySelector(`#${beforeCmd}`) || {}).parentElement;
			if (nextItem && skipSeparator && nextItem.querySelector('.dropdown-divider')) {
				nextItem = nextItem.previousSibling;
			}
			return mnu.insertBefore(item, nextItem);
		}
		return mnu.appendChild(item);
	}

	addSeparator(beforeCmd, subMenu = `${this.#menuElm.id}`) {
		let nextItem = (this.#menuElm.querySelector(`#${beforeCmd}`) || {}).parentElement;
		if (nextItem) {
			const hr = document.createElement('hr');
			hr.className = 'dropdown-divider';

			const item = document.createElement('li');
			item.appendChild(hr);

			return this.#menuElm.querySelector(`ul.dropdown-menu[aria-labelledby="${subMenu}-trigger"]`).insertBefore(item, nextItem);
		}
	}
}