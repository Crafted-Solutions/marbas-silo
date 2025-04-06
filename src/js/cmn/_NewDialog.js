import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { _Dialog } from "./_Dialog";

export class _NewDialog extends _Dialog {
	_apiSvc;
	_parentGrain;
	_nameInput;
	_title;
	_nameLabel;

	constructor(scope, apiSvc) {
		super(scope);
		this._apiSvc = apiSvc;
		this._nameInput = this._element.querySelector(`#${this._scope}-txt-name`);
		this._title = this._element.querySelector(`#${this._scope}-title span`).textContent;
		this._nameLabel = this._element.querySelector(`label[for="${this._scope}-txt-name"]`).textContent;
		this._element.addEventListener('shown.bs.modal', () => {
			this._nameInput.focus();
		});
	}

	get parentGrain() {
		return this._parentGrain;
	}

	get grainType() {
		return MarBasDefaults.ID_TYPE_ELEMENT;
	}

	get grainName() {
		return this._nameInput.value;
	}

	show(parentGrainId, options = {}) {
		this._element.querySelector(`#${this._scope}-title span`).textContent = options.title || this._title;
		this._element.querySelector(`label[for="${this._scope}-txt-name"]`).textContent = options.nameLabel || this._nameLabel;
		this._element.querySelector(`#${this._scope}-path`).textContent = `loading...`;
		super.show();
		this._load(parentGrainId);
	}

	async _load(parentGrainId) {
		if (parentGrainId) {
			this._parentGrain = await this._apiSvc.getGrain(parentGrainId);
		}
		this._element.querySelector(`#${this._scope}-path`).textContent = `under ${this._parentGrain.path}`;
	}
} 