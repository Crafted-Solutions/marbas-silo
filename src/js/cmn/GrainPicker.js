import { Modal } from "bootstrap";

import { SiloTree } from "../SiloTree";
import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { GrainXAttrs } from "./GrainXAttrs";

export class GrainPicker {
	#element;
	#accepted;
	#apiSvc;
	#rootGrain;

	constructor(element, apiSvc) {
		this.#element = document.getElementById(element);
		this.#apiSvc = apiSvc;
		this.#accepted = false;
		this.modal = Modal.getOrCreateInstance(this.#element);
		this.#element.addEventListener('keypress', (evt) => {
			if ('Enter' == evt.key || 13 == evt.keyCode) {
				this.#onOk();
				evt.stopPropagation();
				evt.preventDefault();
			}
		});
		this.#element.querySelector('#grain-picker-btn-ok').onclick = () => {
			this.#onOk();
		};
		this.#element.querySelector('#grain-picker-btn-reload').onclick = () => {
			if (this.grainSelector && this.#rootGrain) {
				this.grainSelector.reloadNode(this.#rootGrain);
			}
		};
	}

	get accepted() {
		return this.#accepted;
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

	addEventListener(evtType, listener, options) {
		this.#element.addEventListener(evtType, listener, options);
	}

	removeEventListener(evtType, listener) {
		this.#element.removeEventListener(evtType, listener);
	}

	show(options) {
		this.#element.querySelector('#grain-picker-title span').textContent = options.title || 'Select Grain';
		const form = this.#element.querySelector('form');
		form.reset();
		form.classList.toggle('was-validated', false);
		this.#accepted = false;
		this.modal.show();
		this.#load(options.root, options.typeFilter, options.selectionFilter);
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
			this.grainSelector = new SiloTree('grain-picker-sel', this.#apiSvc, [{
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

	#onOk() {
		const form = this.#element.querySelector('form');
		form.classList.toggle('was-validated', true);
		if (!form.checkValidity() || !this.selectedGrain) {
			return;
		}

		this.#accepted = true;
		this.modal.hide();
	}
}