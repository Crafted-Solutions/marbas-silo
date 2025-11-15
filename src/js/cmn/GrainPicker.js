
import { t } from "ttag";

import { SiloTree } from "../SiloTree";
import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { GrainXAttrs } from "./GrainXAttrs";
import { _Dialog } from "./_Dialog";

export class GrainPicker extends _Dialog {
	#apiSvc;
	#rootGrain;
	static #instances = {};

	constructor(scope, apiSvc) {
		super(scope);
		this.#apiSvc = apiSvc;
		this._element.querySelector(`#${this._scope}-btn-reload`).onclick = () => {
			if (this.grainSelector && this.#rootGrain) {
				this.grainSelector.reloadNode(this.#rootGrain);
			}
		};
	}

	get rootGrain() {
		return this.#rootGrain;
	}

	get selectedGrain() {
		if (this.grainSelector) {
			const selNodes = this.grainSelector.tree.getSelected();
			if (selNodes.length) {
				return selNodes[0].dataAttr.grain;
			}
		}
	}

	show(options) {
		this._element.querySelector(`#${this._scope}-title span`).textContent = options.title || t`Select Grain`;
		super.show();
		this.#load(options.root, options.typeFilter, options.selectionFilter);
	}

	validate() {
		const result = super.validate() && !!this.selectedGrain;
		this._element.querySelector(`#${this._scope}-validation`).classList[this.selectedGrain ? 'remove' : 'add']('is-invalid');
		return result;
	}

	async #load(rootGrainOrId, typeFilter, selectionFilter) {
		if (!rootGrainOrId) {
			rootGrainOrId = MarBasDefaults.ID_ROOT;
		}
		const newRoot = !this.#rootGrain || ((rootGrainOrId.id || rootGrainOrId) != this.#rootGrain.id);
		if (newRoot) {
			this.#rootGrain = await this.#apiSvc.getGrain(rootGrainOrId);
			if (this.grainSelector) {
				this.grainSelector.destroy();
				delete this.grainSelector;
			}
		}
		if (this.grainSelector) {
			if (newRoot || this.grainSelector._options.typeFilter != typeFilter || this.grainSelector._options.selectableTypes != selectionFilter) {
				this.grainSelector._options.typeFilter = typeFilter;
				this.grainSelector._options.selectableTypes = selectionFilter;
				this.grainSelector.reloadNode(this.#rootGrain);
			}
		} else {
			this.grainSelector = new SiloTree(`${this._scope}-sel`, this.#apiSvc, [{
				text: this.#rootGrain.label,
				lazyLoad: true,
				icon: GrainXAttrs.getGrainIcon(this.#rootGrain),
				id: `n-${this.#rootGrain.id}`,
				dataAttr: {
					grain: this.#rootGrain.id
				},
				state: {
					expanded: false
				}
			}], () => {
				this.grainSelector.tree.expandAll();
			}, {
				selectableTypes: selectionFilter,
				typeFilter: typeFilter
			});
		}
	}

	static instance(scope, apiSvc) {
		if (!GrainPicker.#instances[scope]) {
			GrainPicker.#instances[scope] = new GrainPicker(scope, apiSvc);
		}
		return GrainPicker.#instances[scope];
	}
}