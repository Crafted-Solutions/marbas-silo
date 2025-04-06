import { _NewDialog } from "./_NewDialog";

export class FileNewDialog extends _NewDialog {
	constructor(scope, apiSvc) {
		super(scope, apiSvc);
		this._title = 'New File';
		this._nameLabel = 'Name';
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
}