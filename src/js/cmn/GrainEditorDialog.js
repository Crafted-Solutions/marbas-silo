import { GrainEditor } from "../GrainEditor";
import { _Dialog } from "./_Dialog";
import { MbDomUtils } from "./MbDomUtils";
import { SiloEvtGrainDeleted } from "./SiloEvtGrainDeleted";

export class GrainEditorDialog extends _Dialog {
	#editor;
	static #inst;

	constructor(scope, apiSvc) {
		super(scope);
		this.#editor = new GrainEditor(`${this._scope}-main`, apiSvc, 'BASIC_CORE');
		SiloEvtGrainDeleted.on((grainId) => {
			if (this.#editor.grain && this.#editor.grain.id == grainId) {
				this.#editor.is_dirty = false;
				this.modal.hide();
			}
		}, false);
	}

	show(grainOrId) {
		this.#load(grainOrId.id || grainOrId);
		super.show(false);
	}

	async validate() {
		return !this.#editor || 0 == (await this.#editor.validate()).length;
	}

	async _onClose() {
		if (this.#editor.dirty) {
			if (this.accepted) {
				await this.#editor.save();
			} else {
				this.#editor.editor.is_dirty = false;
				await this.#editor.resetEditor();
			}
		}
	}

	async #load(grainId) {
		await this.#editor.buildEditor(await this.#editor._apiSvc.getGrain(grainId));
		MbDomUtils.hideNode(this._getScoped('loading'));
		this._getScoped('subtitle').textContent = `${this.#editor.grain.path} (${this.#editor.grain.typeName})`;
		this.#editor.editor.on('ready', () => {
			const card = this._element.querySelector('.je-object__container > .card-body');
			if (card) {
				card.classList.remove('card');
			}
		});
	}

	static getOrCreate(apiSvc, scope = 'grain-edit-dlg') {
		if (!GrainEditorDialog.#inst) {
			GrainEditorDialog.#inst = new GrainEditorDialog(scope, apiSvc);
			GrainEditorDialog.#inst.addEventListener('hidden.bs.modal', GrainEditorDialog.#inst._onClose.bind(GrainEditorDialog.#inst));
		}
		return GrainEditorDialog.#inst;
	}
}