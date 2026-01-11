import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { _Dialog } from "./_Dialog";

export class _NewDialog extends _Dialog {
	_apiSvc;
	_parentGrain;
	_typeDef;
	_nameInput;
	_title;
	_nameLabel;

	constructor(scope, apiSvc) {
		super(scope);
		this._apiSvc = apiSvc;
		this._nameInput = this._element.querySelector(`#${this._scope}-txt-name`);
		this._title = this._element.querySelector(`#${this._scope}-title span`).textContent;
		this._nameLabel = this._element.querySelector(`label[for="${this._scope}-txt-name"]`).textContent;
		this._typeDef = MarBasDefaults.ID_TYPE_ELEMENT;
		this._element.addEventListener('shown.bs.modal', () => {
			this._nameInput.focus();
		});
	}

	get parentGrain() {
		return this._parentGrain;
	}

	get grainType() {
		return this._typeDef;
	}

	get grainName() {
		return this._nameInput.value;
	}

	show(parentGrainId, options = {}) {
		this._element.querySelector(`#${this._scope}-title span`).textContent = options.title || this._title;
		this._element.querySelector(`label[for="${this._scope}-txt-name"]`).textContent = options.nameLabel || this._nameLabel;
		this._element.querySelector(`#${this._scope}-subtitle`).textContent = `loading...`;
		super.show(true, options.parent, options.restoreParent);
		this._load(parentGrainId);
	}

	async _load(parentGrainId) {
		if (parentGrainId) {
			this._parentGrain = await this._apiSvc.getGrain(parentGrainId);
		}
		this._element.querySelector(`#${this._scope}-subtitle`).textContent = `under ${this._parentGrain.path}`;
	}
} 