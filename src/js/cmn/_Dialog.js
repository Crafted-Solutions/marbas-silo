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
		this._element.addEventListener('hidden.bs.modal', this._handleClose.bind(this));
		this._getScoped('btn-ok').onclick = async () => {
			await this._onOk();
		};
		if (this._element.classList.contains('modal-over')) {
			_Dialog.makeModalOver(this._element);
		}
	}

	get accepted() {
		return this._accepted;
	}

	addEventListener(evtType, listener, options) {
		this._element.addEventListener('hidden.bs.modal' == evtType ? 'mbdialog:close' : evtType, listener, options);
	}

	removeEventListener(evtType, listener) {
		this._element.removeEventListener(evtType, listener);
	}

	show(reset = true, parent = null, restoreParent = false) {
		if (parent) {
			this._restoreParent = restoreParent;
			this._parent = parent;
			parent._child = this;
			parent.modal.hide();
		}
		const form = this._element.querySelector('form');
		if (reset) {
			form.reset();
		}
		form.classList.toggle('was-validated', false);
		this._accepted = false;
		this.modal.show();
	}

	showModal() {
		const result = new Promise((resolve) => {
			addEventListener('hidden.bs.modal', () => {
				resolve(this.accepted);
			}, { once: true });
		});
		this.show.apply(this, arguments);
		return result;
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

	_handleClose(evt) {
		if (this._child) {
			return;
		}
		const dispEvent = () => {
			const custEvt = new CustomEvent('mbdialog:close', { detail: this, bubbles: evt.bubbles, cancelable: evt.cancelable, composed: evt.composed });
			this._element.dispatchEvent(custEvt);
		};
		if (this._parent && this == this._parent._child) {
			delete this._parent._child;
			if (this._restoreParent) {
				this._parent.addEventListener('shown.bs.modal', dispEvent, { once: true });
				this._parent.modal.show();
				return;
			}
		}
		dispEvent();
	}

	_getScoped(namePart, mode = '#', getAll = false) {
		return this._element[getAll ? 'querySelectorAll' : 'querySelector'](`${mode}${this._scope}-${namePart}`);
	}

	_getTemplate(name, subElement = null) {
		const cont = this._getScoped(`tpl-${name}`).content;
		return subElement && cont ? cont.querySelector(subElement) : cont;
	}

	static makeModalOver(element) {
		element.addEventListener('shown.bs.modal', () => {
			const bds = document.querySelectorAll('.modal-backdrop.show');
			if (1 < bds.length) {
				bds.item(bds.length - 1).classList.add('modal-backdrop-over');
			}
		});
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