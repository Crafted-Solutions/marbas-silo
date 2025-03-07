import { SiloTree } from "./SiloTree";
import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { IconMaps } from "../conf/icons.conf";
import { _NewDialog } from "./_NewDialog";
import { MbDomUtils } from "./MbDomUtils";

export class GrainNewDialog extends _NewDialog {
	#mode = 'generic';

	constructor(scope, apiSvc) {
		super(scope, apiSvc);
		this._element.querySelector(`#${this._scope}-btn-reload`).onclick = () => {
			if (this.typeSelector) {
				this.typeSelector.reloadNode(MarBasDefaults.ID_SCHEMA);
			}
		};
	}

	get grainType() {
		if ('type' == this.#mode) {
			return MarBasDefaults.ID_TYPE_TYPEDEF;
		}
		if ('container' == this.#mode) {
			return MarBasDefaults.ID_TYPE_CONTAINER;
		}
		if (this.typeSelector) {
			const selNodes = this.typeSelector.tree.getSelected();
			if (selNodes.length) {
				return selNodes[0].dataAttr.grain;
			}
		}
		return super.grainType;
	}

	show(parentGrainId, mode = 'generic') {
		this.#mode = mode;
		this._element.querySelectorAll(`.${this._scope}-mode`).forEach((elm) => {
			MbDomUtils.hideNode(elm, !elm.classList.contains(`${this._scope}-mode-${mode}`));
		});
		super.show(parentGrainId);
	}

	async _load(parentGrainId) {
		await super._load(parentGrainId);
		if (!this.typeSelector) {
			this.typeSelector = new SiloTree(`${this._scope}-sel-type`, this._apiSvc, [{
				text: "Schema",
				lazyLoad: true,
				icon: IconMaps.ById[MarBasDefaults.ID_SCHEMA],
				id: `n-${MarBasDefaults.ID_SCHEMA}`,
				dataAttr: {
					grain: MarBasDefaults.ID_SCHEMA
				},
				state: {
					expanded: false
				}
			}], () => {
				this.typeSelector.tree.expandAll();
			}, {
				disableGrains: [MarBasDefaults.ID_TYPE_FILE, MarBasDefaults.ID_TRASH_SCHEMA],
				selectableTypes: [MarBasDefaults.ID_TYPE_TYPEDEF],
				typeFilter: [MarBasDefaults.ID_TYPE_TYPEDEF, MarBasDefaults.ID_TYPE_CONTAINER]
			});
		}
	}
}