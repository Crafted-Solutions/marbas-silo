import { MarBasDefaults } from "../conf/marbas.conf";
import { _Dialog } from "./_Dialog";

export class _NewDialog extends _Dialog {
	_apiSvc;
	_parentGrain;

	constructor(scope, apiSvc) {
		super(scope);
		this._apiSvc = apiSvc;
	}

	get parentGrain() {
		return this._parentGrain;
	}

	get grainType() {
		return MarBasDefaults.ID_TYPE_ELEMENT;
	}

	get grainName() {
		return this._element.querySelector(`#${this._scope}-txt-name`).value;
	}

	show(parentGrainId) {
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