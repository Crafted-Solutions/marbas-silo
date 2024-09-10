import { Dropdown } from "bootstrap";

export class BsContextDropdown {
	#menuElm;
	#triggerElm;
	#menuEvt;
	#lastFocus;
	constructor(menuElm, triggerElm) {
		this.#menuElm =  'string' == typeof (menuElm) ? document.getElementById(menuElm) : menuElm;
		this.#triggerElm = 'string' == typeof(triggerElm) ? document.getElementById(triggerElm) : triggerElm;

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
					Dropdown.getOrCreateInstance(this.#menuElm).hide();
				}
			});
		});
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
}