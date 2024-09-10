import { _NewDialog } from "./_NewDialog";

export class FileNewDialog extends _NewDialog {
	constructor(scope, apiSvc) {
		super(scope, apiSvc);
	}

	get formData() {
		return new FormData(this._element.querySelector('form'));
	}

	show(parentGrainId) {
		this._element.querySelector(`#${this._scope}-parent-id`).value = parentGrainId;
		super.show(parentGrainId);
	}
}