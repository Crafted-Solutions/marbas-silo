import { t } from "ttag";

import { _Dialog } from "./_Dialog";

export class InputDialog extends _Dialog {
	static #inst;

	constructor(scope = null) {
		super(scope || 'input-dlg');
		this._element.addEventListener('shown.bs.modal', () => {
			this.#input.focus();
		});
	}

	get inputValue() {
		return this.#input.value;
	}

	show(options) {
		this._getScoped('title span').textContent = options.title || t`Input Request`;
		this._getScoped('txt').textContent = options.prompt || t`Input`;
		super.show(true, options.parent, options.restoreParent);
		this.#input.value = options.defaultValue || '';
	}

	static requestTextFromUser(options) {
		if (!InputDialog.#inst) {
			InputDialog.#inst = new InputDialog();
		}
		return new Promise((resolve) => {
			InputDialog.#inst._element.addEventListener('hidden.bs.modal', () => {
				resolve(InputDialog.#inst.accepted ? (InputDialog.#inst.inputValue || options.defaultValue) : false);
			}, { once: true });
			InputDialog.#inst.show(options);
		});
	}

	get #input() {
		return this._getScoped('txt');
	}
}
