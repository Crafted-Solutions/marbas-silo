import { Modal } from "bootstrap";
import { t } from "ttag";

export class _Dialog {
	_element;
	_accepted;
	_scope;

	constructor(scope) {
		this._scope = scope;
		this._element = document.getElementById(scope);
		this._accepted = false;
		this.modal = Modal.getOrCreateInstance(this._element);
		this._element.addEventListener('keypress', async (evt) => {
			if (!evt.shiftKey && ('Enter' == evt.key || 13 == evt.keyCode)) {
				await this._onOk();
				evt.stopPropagation();
				evt.preventDefault();
			}
		});
		this._element.querySelector(`#${this._scope}-btn-ok`).onclick = async () => {
			await this._onOk();
		};
		if (this._element.classList.contains('modal-over')) {
			this._element.addEventListener('shown.bs.modal', () => {
				const bds = document.querySelectorAll('.modal-backdrop.show');
				if (1 < bds.length) {
					bds.item(bds.length - 1).classList.add('modal-backdrop-over');
				}
			});
		}
	}

	get accepted() {
		return this._accepted;
	}

	addEventListener(evtType, listener, options) {
		this._element.addEventListener(evtType, listener, options);
	}

	removeEventListener(evtType, listener) {
		this._element.removeEventListener(evtType, listener);
	}

	show(reset = true) {
		const form = this._element.querySelector('form');
		if (reset) {
			form.reset();
		}
		form.classList.toggle('was-validated', false);
		this._accepted = false;
		this.modal.show();
	}

	async validate() {
		const form = this._element.querySelector('form');
		form.classList.toggle('was-validated', true);
		return form.checkValidity();
	}

	async _onOk() {
		if (!(await this.validate())) {
			return;
		}
		this._accepted = true;
		this.modal.hide();
	}

	_getTemplate(name, subElement = null) {
		const cont = this._element.querySelector(`#${this._scope}-tpl-${name}`).content;
		return subElement && cont ? cont.querySelector(subElement) : cont;
	}

	static getDefaultI18n(context) {
		if (!context) {
			context = {};
		}
		if (!context.i18n) {
			context.i18n = {};
		}
		context.i18n.btnClose = t`Close`;
		context.i18n.btnOk = t`Ok`;
		context.i18n.btnCancel = t`Cancel`;
		return context;
	}
}