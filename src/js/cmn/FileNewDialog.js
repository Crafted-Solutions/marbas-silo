import { _NewDialog } from "./_NewDialog";

export class FileNewDialog extends _NewDialog {
	static #instances = {};

	constructor(scope, apiSvc) {
		super(scope, apiSvc);
	}

	get formData() {
		return new FormData(this._element.querySelector('form'));
	}

	get files() {
		return this._element.querySelector(`#${this._scope}-file`).files;
	}

	show(parentGrainId, options = {}) {
		this._element.querySelector(`#${this._scope}-parent-id`).value = parentGrainId;
		const fileElm = this._element.querySelector(`#${this._scope}-file`);
		if (options.accept) {
			fileElm.setAttribute('accept', options.accept);
		} else {
			fileElm.removeAttribute('accept');
		}
		super.show(parentGrainId, options);
	}

	static instance(apiSvc, scope = "file-new") {
		if (!FileNewDialog.#instances[scope]) {
			FileNewDialog.#instances[scope] = new FileNewDialog(scope, apiSvc);
		}
		return FileNewDialog.#instances[scope];
	}
}