import { Modal } from "bootstrap";

export class _Dialog {
	_element;
	_accepted;
	_scope;

	constructor(scope) {
		this._scope = scope;
		this._element = document.getElementById(scope);
		this._accepted = false;
		this.modal = Modal.getOrCreateInstance(this._element);
		this._element.addEventListener('keypress', (evt) => {
			if ('Enter' == evt.key || 13 == evt.keyCode) {
				this._onOk();
				evt.stopPropagation();
				evt.preventDefault();
			}
		});
		this._element.querySelector(`#${this._scope}-btn-ok`).onclick = () => {
			this._onOk();
		};
	}

	get accepted() {
		return this._accepted;
	}

	addEventListener(evtType, listener) {
		this._element.addEventListener(evtType, listener);
	}

	show() {
		const form = this._element.querySelector('form');
		form.reset();
		form.classList.toggle('was-validated', false);
		this._accepted = false;
		this.modal.show();
	}

	_onOk() {
		const form = this._element.querySelector('form');
		form.classList.toggle('was-validated', true);
		if (!form.checkValidity()) {
			return;
		}
		this._accepted = true;
		this.modal.hide();
	}

}