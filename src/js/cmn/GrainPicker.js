
import { t } from "ttag";

import { SiloTree } from "../SiloTree";
import { MarBasDefaults, MarBasGrainAccessFlag } from "@crafted.solutions/marbas-core";
import { GrainXAttrs } from "./GrainXAttrs";
import { _Dialog } from "./_Dialog";
import { GrainNewDialog } from "./GrainNewDialog";
import { Task } from "./Task";
import { FileNewDialog } from "./FileNewDialog";

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
		this._element.querySelector(`#${this._scope}-btn-new`).onclick = async () => {
			await this.#newGrain();
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
		this.#load(options.root, options.typeFilter, options.selectionFilter, options.disableGrains, options.listFilter);
	}

	async validate() {
		const result = (await super.validate()) && !!this.selectedGrain;
		this._element.querySelector(`#${this._scope}-validation`).classList[this.selectedGrain ? 'remove' : 'add']('is-invalid');
		return result;
	}

	async #load(rootGrainOrId, typeFilter, selectionFilter, disableGrains, listFilter) {
		rootGrainOrId = await Promise.resolve(rootGrainOrId);
		if (!rootGrainOrId) {
			rootGrainOrId = MarBasDefaults.ID_ROOT;
		}
		const newRoot = !this.#rootGrain || ((rootGrainOrId.id || rootGrainOrId) != this.#rootGrain.id);
		if (newRoot) {
			this.#rootGrain = await this.#apiSvc.getGrain(rootGrainOrId.id || rootGrainOrId);
			if (this.grainSelector) {
				this.grainSelector.destroy();
				delete this.grainSelector;
			}
			await this.#updateActions(typeFilter);
		}
		if (this.grainSelector) {
			this.grainSelector._options.disableGrains = disableGrains;
			if (newRoot || this.grainSelector._options.listFilter != listFilter
				|| String(this.grainSelector._options.typeFilter) != String(typeFilter)
				|| String(this.grainSelector._options.selectableTypes) != String(selectionFilter)) {
				this.grainSelector._options.typeFilter = typeFilter;
				this.grainSelector._options.selectableTypes = selectionFilter;
				this.grainSelector._options.listFilter = listFilter;
				this.grainSelector.reloadNode(this.#rootGrain);
			} else {
				this.grainSelector.disableNodesByGrain(disableGrains);
			}
		} else {
			this.grainSelector = new SiloTree(`${this._scope}-sel`, this.#apiSvc, [{
				text: this.#rootGrain.label,
				lazyLoad: true,
				icon: GrainXAttrs.getGrainIcon(this.#rootGrain),
				id: `${this._scope}-sel-${this.#rootGrain.id}`,
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
				typeFilter: typeFilter,
				disableGrains: disableGrains,
				listFilter: listFilter
			});
		}
	}

	async #updateActions(typeFilter) {
		const enableNew = await this.#apiSvc.getGrainPermission(this.#rootGrain, MarBasGrainAccessFlag.CreateSubelement);
		this._element.querySelectorAll(`.${this._scope}-newact`).forEach(elm => elm.disabled = !enableNew);
		if (this.grainSelector && this.grainSelector._options.typeFilter == typeFilter) {
			return;
		}
		this._createableTypes = {};
		if (enableNew) {
			const types = typeFilter ? typeFilter.filter(x => x != MarBasDefaults.ID_TYPE_LINK) : [];
			this._element.querySelector(`#${this._scope}-btn-newsel`).disabled = 2 > types.length;
			if (1 < types.length) {
				const dd = this._element.querySelector(`#${this._scope}-dd-newsel`);
				dd.querySelectorAll('li').forEach(elm => elm.remove());
				for (const type of types) {
					this._createableTypes[type] = MarBasDefaults.ID_TYPE_TYPEDEF == type ? t`Type Definition` : await this.#apiSvc.resolveGrainLabel(type);

					const opt = document.createElement('li');
					const a = document.createElement('a');
					a.className = 'dropdown-item';
					a.href = '#';
					a.textContent = this._createableTypes[type];
					a.setAttribute('data-id', type);
					a.addEventListener('click', (evt) => {
						evt.preventDefault();
						this.#newGrain(type);
					});
					opt.appendChild(a);
					dd.appendChild(opt);
				}
			}
		}

	}

	async #newGrain(typeDefId = null) {
		if (null == typeDefId) {
			const typeFilter = this.grainSelector._options.typeFilter;
			typeDefId = typeFilter && typeFilter.length ? typeFilter.find(x => x != MarBasDefaults.ID_TYPE_LINK) : null;
		}
		if (MarBasDefaults.ID_TYPE_FILE == typeDefId) {
			await this.#createFile();
		} else {
			await this.#createGrain(typeDefId);
		}
	}

	async #createGrain(typeDefId) {
		const dlg = GrainNewDialog.instance(this.#apiSvc);
		dlg.addEventListener('mbdialog:close', async () => {
			if (dlg.accepted) {
				await Task.nowAsync(t`Creating grain`, async () => {
					const grain = await this.#apiSvc.createGrain(dlg.parentGrain, dlg.grainType, dlg.grainName);
					if (!grain.typeDefId || (this.grainSelector._options.selectableTypes && this.grainSelector._options.selectableTypes.includes(grain.typeDefId))) {
						this.grainSelector.revealAndSelectNode(grain);
					} else {
						await this.grainSelector.reloadNode(this.#rootGrain);
					}
				}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
			}
		}, { once: true });
		dlg.show(this.#rootGrain.id,
			typeDefId && this._createableTypes[typeDefId] ? { id: typeDefId, label: this._createableTypes[typeDefId] } : null, {
			parent: this,
			restoreParent: true
		});
	}

	async #createFile() {
		const dlg = FileNewDialog.instance(this.#apiSvc);
		dlg.addEventListener('mbdialog:close', async () => {
			if (dlg.accepted) {
				await Task.nowAsync(t`Creating file`, async () => {
					const grain = await this.#apiSvc.createFile(dlg.formData);
					await this.grainSelector.revealAndSelectNode(grain);
				}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
			}
		}, { once: true });
		dlg.show(this.#rootGrain.id, {
			parent: this,
			restoreParent: true
		});
	}

	static instance(apiSvc, scope = 'grain-picker') {
		if (!GrainPicker.#instances[scope]) {
			GrainPicker.#instances[scope] = new GrainPicker(scope, apiSvc);
		}
		return GrainPicker.#instances[scope];
	}
}