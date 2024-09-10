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
		this._element.querySelector(`#${this._scope}-title span`).textContent = options.title || 'Input Request';
		this._element.querySelector(`label[for="${this._scope}-txt"]`).textContent = options.prompt || 'Input';
		super.show();
		this.#input.value = options.defaultValue || '';
	}

	static requestTextFromUser(options) {
		if (!InputDialog.#inst) {
			InputDialog.#inst = new InputDialog();
		}
		return new Promise((resolve) => {
			InputDialog.#inst._element.addEventListener('hidden.bs.modal', () => {
				resolve(InputDialog.#inst.accepted ? InputDialog.#inst.inputValue : '');
			}, { once: true });
			InputDialog.#inst.show(options);
		});
	}

	get #input() {
		return this._element.querySelector(`#${this._scope}-txt`);
	}
}
