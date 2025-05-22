import { Dropdown } from "bootstrap";

export class BsIconPicker {
	static EVENT_ICON_SELECTED = 'bip:icon-selected';

	static _triggerCount = 0;

	#triggerElm;
	#displayElm;
	#lastValue;
	#defaultIcon = 'bi-question-diamond';

	constructor(triggerElm, displayElm, iconConfig, defaultIcon) {
		this.#triggerElm = 'string' == typeof (triggerElm) ? document.querySelector(triggerElm) : triggerElm;
		if (this.fromInput) {
			this.#lastValue = this.#triggerElm.value;
		}
		if (displayElm) {
			this.#displayElm = 'string' == typeof (displayElm) ? document.querySelector(displayElm) : displayElm;
		}
		if (defaultIcon) {
			this.#defaultIcon = defaultIcon;
		}
		if (iconConfig) {
			BsIconPicker.getDrowpdown(iconConfig).then(this.#setupEvents.bind(this));
		} else {
			this.#setupEvents();
		}
		this.displayIcon();
	}

	destroy() {
		if (BsIconPicker.dropdown) {
			BsIconPicker.dropdown.removeEventListener('show.bs.dropdown', this.#showCb);
			BsIconPicker.dropdown.removeEventListener('shown.bs.dropdown', this.#shownCb);
		}
	}

	show(owner) {
		if (!BsIconPicker.dropdown) {
			return;
		}
		BsIconPicker.dropdown._bipOwner = owner;
		const dd = Dropdown.getOrCreateInstance(BsIconPicker.dropdown);
		dd._config.reference = owner;
		dd.update();
		dd.show();
	}

	static hide() {
		if (BsIconPicker.shown) {
			Dropdown.getOrCreateInstance(BsIconPicker.dropdown).hide();
		}
	}

	static get shown() {
		return BsIconPicker.dropdown && BsIconPicker.dropdown.classList.contains('show');
	}

	get fromInput() {
		return 'INPUT' == this.#triggerElm.tagName;
	}

	get value() {
		return this.#triggerElm.value;
	}

	get active() {
		return BsIconPicker.dropdown && this.#triggerElm == BsIconPicker.dropdown._bipOwner;
	}

	#setupEvents() {
		if (!BsIconPicker.dropdown) {
			console.warn("BsIconPicker.dropdown is missing, skipping setup");
			return;
		}
		this.#triggerElm.addEventListener(this.fromInput ? 'focusin' : 'click', (evt) => {
			this.show(this.#triggerElm);
		});
		if (this.fromInput) {
			this.#triggerElm.addEventListener('keyup', (evt) => {
				if ('Escape' != evt.key) {
					this.#search();
				}
			});
		}
		this.#triggerElm.addEventListener('keydown', (evt) => {
			if ('ArrowDown' == evt.key) {
				this.#focusFirstIcon();
			} else if (this.active && 'Escape' == evt.key) {
				BsIconPicker.hide();
			}
		});
		BsIconPicker.dropdown.addEventListener('show.bs.dropdown', this.#showCb);
		BsIconPicker.dropdown.addEventListener('shown.bs.dropdown', this.#shownCb);

		document.addEventListener(BsIconPicker.EVENT_ICON_SELECTED, (evt) => {
			if (evt.detail && evt.detail.owner == this.#triggerElm) {
				if (this.fromInput) {
					this.#triggerElm.value = evt.detail.icon;
					this.#triggerElm.focus();
				}
				this.displayIcon();
			}
		});
	}

	#showCb = () => {
		if (this.active) {
			BsIconPicker.dropdown.querySelectorAll('a').forEach(elm => {
				elm.classList.remove('selected');
				elm.parentNode.classList.remove('d-none');
			});
		}
	}

	#shownCb = () => {
		if (this.active) {
			this.#selectValue();
		}
	}

	#selectValue() {
		if (this.value) {
			const elm = BsIconPicker.dropdown.querySelector(`a.${this.value}`);
			if (elm) {
				elm.classList.add('selected');
				BsIconPicker.dropdown.querySelector('ul').scroll({ left: 0, top: elm.offsetTop - 10, behavior: 'smooth' });
			}
		}
	}

	#focusFirstIcon() {
		const elm = BsIconPicker.dropdown.querySelector(this.value ? `li:not(.d-none) a.${this.value}` : 'li:not(.d-none) a') || BsIconPicker.dropdown.querySelector('li:not(.d-none) a');
		elm.focus({ preventScroll: true });
		setTimeout(() => {
			BsIconPicker.dropdown.querySelector('ul').scroll({ left: 0, top: elm.offsetTop - 10, behavior: 'smooth' });
		}, 100);
	}

	#search() {
		if (this.value == this.#lastValue) {
			return;
		}
		this.#lastValue = this.value;
		if (3 < this.#lastValue.length && !BsIconPicker.shown) {
			this.show(this.#triggerElm);
		}
		if (BsIconPicker.shown) {
			const patt = new RegExp(`${this.#lastValue.replace(/^bi-/, '')}`, 'i');
			const elms = BsIconPicker.dropdown.querySelectorAll('a');
			elms.forEach(elm => {
				if (patt.test(elm.id.substring(4))) {
					elm.parentNode.classList.remove('d-none');
				}
				else {
					elm.parentNode.classList.add('d-none');
				}
			});
		}
	}

	displayIcon() {
		if (this.#displayElm) {
			this.#displayElm.innerHTML = `<i class="bi ${this.value || this.#defaultIcon}"></i>`;
		}
	}

	static getDrowpdown(iconConfig) {
		return new Promise((resolve, reject) => {
			if (BsIconPicker.dropdown) {
				resolve(BsIconPicker.dropdown);
				return;
			}
			setTimeout(() => {
				const result = document.createElement('div');
				result.className = 'dropdown bip-drowpdown';

				const menu = document.createElement('div');
				menu.className = 'dropdown-menu';
				menu.tabIndex = 0;
				result.appendChild(menu);

				const list = document.createElement('ul');
				menu.appendChild(list);
				let iconCount = 0;
				if (iconConfig.bi) {
					for (const k in iconConfig.bi) {
						const li = document.createElement('li');
						li.title = k;
						const icon = document.createElement('a');
						icon.id = `bip-${k}`;
						icon.href = '#';
						icon.onclick = () => {
							document.dispatchEvent(new CustomEvent(BsIconPicker.EVENT_ICON_SELECTED, {
								detail: {
									icon: `bi-${k}`,
									owner: result._bipOwner
								}
							}));
							BsIconPicker.hide();
							return false;
						};
						icon.className = `dropdown-item bi bi-${k}`;
						li.appendChild(icon);
						list.appendChild(li);
						iconCount++;
					}
				}
				if (iconCount) {
					const wrapper = document.createElement('div');
					wrapper.appendChild(result);
					document.body.appendChild(wrapper);

					const page = document.querySelector('html');
					page.addEventListener('mousedown', (evt) => {
						if (result != evt.target && !result.contains(evt.target) && evt.target != result._bipOwner && result.classList.contains('show')) {
							Dropdown.getOrCreateInstance(result).hide();
						}
					});
					BsIconPicker.dropdown = result;
				}
				resolve(result);
			});
		});
	}
}