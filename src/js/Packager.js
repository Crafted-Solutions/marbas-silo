import { t } from "ttag";

import exportDialogHtml from "../partials/ExportDialog.hbs";
import importDialogHtml from "../partials/ImportDialog.hbs";

import { _Dialog } from "./cmn/_Dialog";
import { MbDomUtils } from "./cmn/MbDomUtils";
import { Task } from "./cmn/Task";
import { MsgBox } from "./cmn/MsgBox";
import { GrainPicker } from "./cmn/GrainPicker";
import { GrainXAttrs } from "./cmn/GrainXAttrs";

class ExportDialog extends _Dialog {
	#apiSvc;
	#grainPicker;
	#anchorTpl;

	constructor(apiSvc, scope = 'export-dlg') {
		MbDomUtils.buildFromTemplate(scope, exportDialogHtml, _Dialog.getDefaultI18n({
			i18n: {
				title: t`Export Package`,
				lblName: t`Package Name`,
				phName: t`(Optional) name for package file`,
				lblOrderNote: t`Note: grains are added to the package in order of appearance, this order is applied when the package is imported`,
				btnAddAnchor: t`Add another grain`,
				btnRemoveAnchor: t`Remove this grain`,
				btnMoveAnchorUp: t`Move this grain up`,
				btnMoveAnchorDown: t`Move this grain down`,
				lblAnchor: t`Anchor Grain`,
				phAnchor: t`Grain to export`,
				btnPicker: t`Browse grains`,
				fbAnchor: t`Please select a grain`,
				lblLinksTraversal: t`Include Linked Grains`,
				lblTypeDefTraversal: t`Include Type Information`,
				lblParentTraversal: t`Include Parent Grains`,
				lblChildrenTraversal: t`Include Children`,
				lblTraversalOpt: {
					None: t`None`,
					Immediate: t`Immediate only`,
					Indefinite: t`All recursively`
				},
				defaults: {
					linksTraversal: 'None',
					typeDefTraversal: 'None',
					parentTraversal: 'None',
					childrenTraversal: 'None'
				}
			}
		}));
		super(scope);
		this.#apiSvc = apiSvc;

		MbDomUtils.fakeReadonlyElements(this._element);
		this._element.querySelector(`#${this._scope}-btn-add`).addEventListener('click', () => {
			this.#addAnchor();
		});

		this.#initGrainPicker();
		this.#initAnchorActions();
	}

	show() {
		const items = this.anchors;
		for (let i = items.length - 1; i > 0; i--) {
			items.item(i).remove();
		}
		super.show();
	}

	get namePrefix() {
		return this._element.querySelector(`#${this._scope}-txt-name`).value;
	}

	get anchors() {
		return this._element.querySelectorAll(`.${this._scope}-item`);
	}

	get anchorCount() {
		this.anchors.length;
	}

	get packageModel() {
		const result = {};
		const pfx = this.namePrefix;
		if (pfx) {
			result.namePrefix = pfx;
			if (!result.namePrefix.endsWith('-')) {
				result.namePrefix += '-';
			}
		}
		const anchors = this.anchors;
		for (let i = 0; i < anchors.length; i++) {
			const id = anchors[i].querySelector('[name="AnchorId"]').value;
			if (!id) {
				continue;
			}
			if (!result.items) {
				result.items = {};
			}
			result.items[id] = {
				priority: i,
				linksTraversal: anchors[i].querySelector('[name="LinksTraversal"]').value,
				typeDefTraversal: anchors[i].querySelector('[name="TypeDefTraversal"]').value,
				parentTraversal: anchors[i].querySelector('[name="ParentTraversal"]').value,
				childrenTraversal: anchors[i].querySelector('[name="ChildrenTraversal"]').value,
			};
		}
		return result;
	}

	#setAnchor(item, grain) {
		item.querySelector('[name="AnchorId"]').value = grain ? grain.id : "";
		const lbl = item.querySelector('[name="Anchor"]');
		lbl.value = grain ? grain.path : "";
		lbl.title = grain ? `${grain.label} (${grain.typeName || 'TypeDef'})` : "";
		let ico = 'bi-question-diamond';
		if (grain) {
			ico = GrainXAttrs.getGrainIcon(grain);
		}
		item.querySelector(`.${this._scope}-anchor-icon`).className = `input-group-text ${this._scope}-anchor-icon ${ico}`;
	}

	#initGrainPicker(container) {
		if (!this.#grainPicker) {
			this.#grainPicker = GrainPicker.instance('grain-picker', this.#apiSvc);
		}
		const btn = (container || this._element).querySelector('.grain-picker');
		btn.addEventListener('click', () => {
			this.#showGrainPicker(btn);
		});
	}

	#showGrainPicker(trigger) {
		this.#grainPicker.show({});
		this.#grainPicker.addEventListener('hidden.bs.modal', async () => {
			if (this.#grainPicker.accepted) {
				const grain = await this.#apiSvc.getGrain(this.#grainPicker.selectedGrain);
				this.#setAnchor(trigger.closest(`.${this._scope}-item`), grain);
			}
		}, { once: true });
	}

	#initAnchorActions(container) {
		if (!container) {
			container = this._element;
		}
		container.querySelector(`.${this._scope}-btn-del`).addEventListener('click', (evt) => {
			this.#removeAnchor(evt.target.closest(`.${this._scope}-item`));
		});
		container.querySelector(`.${this._scope}-btn-up`).addEventListener('click', (evt) => {
			this.#moveAnchor(evt.target.closest(`.${this._scope}-item`), true);
		});
		container.querySelector(`.${this._scope}-btn-down`).addEventListener('click', (evt) => {
			this.#moveAnchor(evt.target.closest(`.${this._scope}-item`));
		});
	}

	#removeAnchor(item) {
		if (1 == this._element.querySelectorAll('[name="Anchor"]').length) {
			this.#setAnchor(item);
			for (const trav of ['LinksTraversal', 'TypeDefTraversal', 'ParentTraversal', 'ChildrenTraversal']) {
				item.querySelector(`[name="${trav}"]`).value = "None";
			}
		} else {
			item.remove();
		}
	}

	#moveAnchor(item, up = false) {
		if (up) {
			if (item.previousElementSibling) {
				item.previousElementSibling.before(item);
			}
		} else {
			if (item.nextElementSibling) {
				item.nextElementSibling.after(item);
			}
		}
		item.scrollIntoView();
	}

	#addAnchor() {
		if (!this.#anchorTpl) {
			this.#anchorTpl = this._getTemplate('item', `.${this._scope}-item`);
		}

		const item = this.#anchorTpl.cloneNode(true);
		const sfxPh = item.getAttribute('data-sfx');
		const sfx = `${Math.random()}`;
		for (const attr of ['id', 'for', 'aria-describedby']) {
			const phList = item.querySelectorAll(`*[${attr}$="-${sfxPh}"]`);
			phList.forEach((elm) => {
				elm.setAttribute(attr, elm.getAttribute(attr).replace(sfxPh, sfx));
			});
		}
		this._element.querySelector(`#${this._scope}-items`).appendChild(item);
		this.#initGrainPicker(item);
		this.#initAnchorActions(item);
		item.scrollIntoView();
	}
}

class ImportDialog extends _Dialog {
	constructor(scope = 'import-dlg') {
		MbDomUtils.buildFromTemplate(scope, importDialogHtml, _Dialog.getDefaultI18n({
			i18n: {
				title: t`Import Package`,
				lblFile: t`Package`,
				fbFile: t`Please provide a package`,
				lblDuplicates: t`Duplicate Grains Handling`,
				lblDuplicatesOpt: {
					Ignore: t`Ignore`,
					MergeSkipNewer: t`Merge (skip if newer)`,
					Merge: t`Merge`,
					OverwriteSkipNewer: t`Overwrite (skip if newer)`,
					Overwrite: t`Overwrite`,
					OverwriteRecursive: t`Overwrite recursively`
				},
				lblMissingDeps: t`Missing Dependencies Handling`,
				lblMissingDepsOpt: {
					WarnAndContinue: t`Warn and continue`,
					CreatePlaceholder: t`Create placeholder (dummy) grain`,
					Abort: t`Abort operation`
				}
			},
			defaults: {
				duplicates: 'MergeSkipNewer',
				missingDeps: 'CreatePlaceholder'
			}
		}));
		super(scope);
	}

	get formData() {
		return new FormData(this._element.querySelector('form'));
	}
}

const IMPORT_STAGE_PFX = "Import-";

export class Packager {
	#apiSvc;
	#exportDialog;
	#importDialog;

	constructor(apiSvc) {
		this.#apiSvc = apiSvc;
	}

	cmdPackageIn() {
		if (!this.#importDialog) {
			this.#importDialog = new ImportDialog();
			this.#importDialog.addEventListener('hidden.bs.modal', async () => {
				if (this.#importDialog.accepted) {
					await this.#import(this.#importDialog.formData);
				}
			});
		}
		this.#importDialog.show();
	}

	cmdPackageOut() {
		if (!this.#exportDialog) {
			this.#exportDialog = new ExportDialog(this.#apiSvc);
			this.#exportDialog.addEventListener('hidden.bs.modal', async () => {
				if (this.#exportDialog.accepted) {
					await this.#export(this.#exportDialog.packageModel);
				}
			});
		}
		this.#exportDialog.show();
	}

	async #export(options) {
		await Task.nowAsync(t`Exporting package`, async () => {
			const blob = await this.#apiSvc.exportPackage(options);
			MbDomUtils.downloadBlob(blob);
		}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
	}

	async #import(formData) {
		await Task.nowAsync(t`Importing package`, async (done, error, abort, status) => {
			const result = await this.#apiSvc.importPackage(formData, 500, (job) => {
				if ('Pending' == job.status) {
					status(t`Pending`);
				} else if ('Running' == job.status) {
					status(Packager.#translateImportStage(job.stage));
				}
				return true;
			});
			if ('Error' == result.status || 'Cancelled' == result.status) {
				error(result.result || t`Cancelled`);
			} else {
				const importResult = result.result;
				let hasBads = 0;
				if (importResult.feedback) {
					importResult.feedback.some(fb => {
						if ('Warning' == fb.feedbackType) {
							hasBads |= 1;
						} else if ('Error' == fb.feedbackType) {
							hasBads |= 2;
						}
						return (1 | 2) == hasBads;
					});
				}
				let msg = t`Import results: ${importResult.importedCount} grains imported, ${importResult.ignoredCount} grains skipped`;
				if (1 == hasBads) {
					msg += t` (completed with warnings)`;
				} else if (1 < hasBads) {
					msg += t` (completed with errors)`;
				}
				MsgBox.invoke(msg, {
					title: t`Package Import`,
					icon: hasBads ? 'warning' : 'info'
				});
			}
			console.info("Import result", result.result);
			document.dispatchEvent(new CustomEvent('mb-silo:reload', { detail: { navigate: true } }));
		}, Task.Flag.DEFAULT | Task.Flag.REPORT_START | Task.Flag.REPORT_STATUS);
	}

	static #translateImportStage(stage) {
		if ('Caching' == stage) {
			return t`Caching`;
		}
		if (stage.startsWith(IMPORT_STAGE_PFX)) {
			const id = stage.substring(IMPORT_STAGE_PFX.length, IMPORT_STAGE_PFX.length + 36);
			const name = stage.substring(IMPORT_STAGE_PFX.length + 37);
			return t`Processing grain "${name}" (${id})`;
		}
		return t`Processing`;
	}
}