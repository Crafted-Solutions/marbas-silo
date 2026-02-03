import { t } from "ttag";
import { EVENT_NODE_SELECTED } from "@jbtronics/bs-treeview";

import { SiloTree } from "../SiloTree";
import { MarBasDefaults } from "@crafted.solutions/marbas-core";
import { IconMaps } from "../../conf/icons.conf";
import { _NewDialog } from "./_NewDialog";
import { MbDomUtils } from "./MbDomUtils";

const GRAINTYPE_DEFAULT = {
	id: MarBasDefaults.ID_TYPE_ELEMENT,
	get label() { return t`Grain` }
};

export class GrainNewDialog extends _NewDialog {
	_grainType = GRAINTYPE_DEFAULT;
	static #instances = {};

	constructor(scope, apiSvc) {
		super(scope, apiSvc);
		this._element.querySelector(`#${this._scope}-btn-reload`).onclick = () => {
			if (this.typeSelector) {
				this.typeSelector.reloadNode(MarBasDefaults.ID_SCHEMA);
			}
		};
	}

	get grainType() {
		return this._grainType.id;
	}

	get typeLabel() {
		return this._grainType.label;
	}

	show(parentGrainId, grainType = null, options = {}) {
		this._grainType = grainType || GRAINTYPE_DEFAULT;
		if (grainType) {
			this._grainType._external = true;
			options.title = t`New ${grainType.label}`;
		} else if (this.typeSelector) {
			const sel = this.typeSelector.tree.getSelected();
			if (sel && sel.length) {
				this.#setTypeFromNode(sel[0]);
			}
		}
		MbDomUtils.hideNode(this._element.querySelector(`#${this._scope}-type-fields`), !!grainType);
		super.show(parentGrainId, options);
	}

	async _load(parentGrainId) {
		await super._load(parentGrainId);
		if (!this.typeSelector && !this._grainType._external) {
			this.typeSelector = new SiloTree(`${this._scope}-sel-type`, this._apiSvc, [{
				text: t`Schema`,
				lazyLoad: true,
				icon: IconMaps.ById[MarBasDefaults.ID_SCHEMA],
				id: `${this._scope}-sel-type-${MarBasDefaults.ID_SCHEMA}`,
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
			this.typeSelector.addEventListener(EVENT_NODE_SELECTED, (evt) => {
				this.#setTypeFromNode(evt.detail.node);
			});
		}
	}

	#setTypeFromNode(node) {
		this._grainType = {
			id: node.dataAttr.grain,
			label: node.text
		};
	}

	static instance(apiSvc, scope = "grain-new") {
		if (!GrainNewDialog.#instances[scope]) {
			GrainNewDialog.#instances[scope] = new GrainNewDialog(scope, apiSvc);
		}
		return GrainNewDialog.#instances[scope];
	}
}