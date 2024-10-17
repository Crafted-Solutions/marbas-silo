import { Modal } from "bootstrap";
import { MbDomUtils } from "./MbDOMUTils";

export class MsgBox {
	static #inst;
	#element;
	#result;
	#defaultAction;
	#handlers = {};

	constructor(id = null) {
		this.#element = document.getElementById(id || 'msgbox-dlg');
		this.modal = Modal.getOrCreateInstance(this.#element);
		this.#element.querySelectorAll('.btn-msgbox').forEach(button => {
			button.onclick = () => {
				this.#onAction(button.getAttribute('data-btn-id'));
			};
		});
		this.#element.addEventListener('keypress', (evt) => {
			if ('Enter' == evt.key || 13 == evt.keyCode) {
				evt.stopPropagation();
				evt.preventDefault();
				if (document.activeElement && document.activeElement != this.#element && document.activeElement.click && this.#element.contains(document.activeElement)) {
					document.activeElement.click();
				} else {
					this.#onAction(this.#defaultAction || this.#result);
				}
			}
		});
		this.#element.addEventListener('hidden.bs.modal', () => {
			this.#callHandler(this.#result);
		});
	}

	/**
	 * @param text
	 * @param {*} options
	 * @param options.text
	 * @param options.title
	 * @param options.buttons
	 * @param options.icon
	 * @param options.closeAction
	 * @returns 
	 */
	show(text, options) {
		if (!text) {
			console.warn("Message text is missing");
			return;
		}
		options = options || {};
		
		this.#handlers = {};
		this.#result = options.closeAction || 'close';
		this.#defaultAction = null;

		this.#element.querySelector('.msgbox-dlg-text').textContent = text;
		this.#element.querySelector('#msgbox-dlg-title').textContent = options.title || document.title;

		const icoElm = this.#element.querySelector('.msgbox-dlg-icon');
		if (options.icon) {
			['bi-exclamation-triangle-fill', 'bi-exclamation-octagon-fill', 'bi-check-circle-fill', 'bi-info-circle-fill', 'bi-info-square-fill', 'text-danger', 'text-warning', 'text-info', 'text-success', 'text-primary'].forEach(x => {
				icoElm.classList.toggle(x, false);
			});
			icoElm.classList.toggle(`text-${options.icon}`, true);
			switch (options.icon) {
				case 'warning':
					icoElm.classList.toggle('bi-exclamation-triangle-fill', true);
					break;
				case 'danger':
					icoElm.classList.toggle('bi-exclamation-octagon-fill', true);
					break;
				case 'info':
					icoElm.classList.toggle('bi-info-circle-fill', true);
					break;
				case 'success':
					icoElm.classList.toggle('bi-check-circle-fill', true);
					break;
				case 'primary':
					icoElm.classList.toggle('bi-question-square-fill', true);
					break;			
			}
		}
		MbDomUtils.hideNode(icoElm, !options.icon);

		const buttons = options.buttons || { 'cancel': true, 'ok': true };
		this.#element.querySelectorAll('.btn-msgbox').forEach(button => {
			const id = button.getAttribute('data-btn-id');
			MbDomUtils.hideNode(button, !buttons[id]);
			if (buttons[id] && (button.classList.contains('btn-primary') || button.classList.contains('btn-success'))) {
				this.#defaultAction = id;
			}
			if ('function' == typeof buttons[id]) {
				this.#handlers[id] = buttons[id];
			}
		});

		this.modal.show();
	}

	get result() {
		return this.#result;
	}

	/**
	 * @param text
	 * @param {*} options
	 * @param options.text
	 * @param options.title
	 * @param options.buttons
	 * @param options.icon
	 * @param options.closeAction
	 * @returns 
	 */
	static invoke(text, options) {
		if (!MsgBox.#inst) {
			MsgBox.#inst = new MsgBox();
		}
		return new Promise((resolve) => {
			MsgBox.#inst.#element.addEventListener('hidden.bs.modal', () => {
				resolve(MsgBox.#inst.result);
			}, { once: true });
			MsgBox.#inst.show(text, options);	
		});
	}

	#onAction(id) {
		this.#result = id;
		this.modal.hide();
		this.#callHandler(id);
	}

	#callHandler(id) {
		if ('function' == typeof this.#handlers[id]) {
			this.#handlers[id]();
		}
		delete this.#handlers[id];
	}
}