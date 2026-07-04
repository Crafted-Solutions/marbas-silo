import { t } from "ttag";
import { EVENT_NODE_EXPANDED } from "@jbtronics/bs-treeview";

import { MarBasBuiltIns, MarBasDefaults, MarBasGrainAccessFlag, MarBasRoleEntitlement } from "@crafted.solutions/marbas-core";
import { GrainNewDialog } from "./cmn/GrainNewDialog";
import { SiloTree } from "./SiloTree";
import { BsContextDropdown } from "./BsContextDropdown";
import { FileNewDialog } from "./cmn/FileNewDialog";
import { InputDialog } from "./cmn/InputDialog";
import { MsgBox } from "./cmn/MsgBox";
import { GrainSecurityDialog } from "./cmn/GrainSecurityDialog";
import { Task } from "./cmn/Task";
import { GrainEditorDialog } from "./cmn/GrainEditorDialog";
import { SiloEvtGrainModified } from "./cmn/SiloEvtGrainModified";
import { SiloEvtReload } from "./cmn/SiloEvtReload";
import { SiloEvtNavigate } from "./cmn/SiloEvtNavigate";
import { SiloEvtGrainDeleted } from "./cmn/SiloEvtGrainDeleted";
import { SiloEvtGrainRenamed } from "./cmn/SiloEvtGrainRenamed";
import { SiloEvtTypeDefDefaults } from "./cmn/SiloEvtTypeDefDefaults";

export class SiloNavi extends SiloTree {

	#securityDlg;
	#clipboard = {};

	constructor(elementId, apiSvc, rootNodes, initCallback = null) {
		super(elementId, apiSvc, rootNodes, initCallback);
		this.#buildContextMenu();
		SiloEvtNavigate.on(async (grainId) => {
			await this.initialized;
			await this.navigateToNode(grainId || MarBasDefaults.ID_ROOT);
		});
		SiloEvtReload.on(async (grainId, navigate) => {
			const id = grainId || MarBasDefaults.ID_ROOT;
			await this.reloadNode(id);
			if (navigate) {
				await this.navigateToNode(id);
			}
		});
		SiloEvtTypeDefDefaults.on(async (typeDefId, defaultsId) => {
			await this.openTypeDefDefaults(typeDefId, defaultsId);
		});
		SiloEvtGrainModified.on((grain) => {
			this.updateNode(grain);
		}, false);
	}

	async deleteNode(grainOrId) {
		const node = this.getNodeByGrain(grainOrId);
		if (node && 'yes' == await MsgBox.invokeYesNo(t`Delete ${node.text}?`)) {
			return await Task.nowAsync(t`Deleting grain`, async () => {
				const parents = node.state && node.state.selected ? this.tree.getParents(node) : [];
				this.tree.removeNode(node);
				if (parents.length) {
					this.tree.selectNode(parents);
				}
				const id = grainOrId.id || grainOrId;
				const result = await this._apiSvc.deleteGrain(id);
				if (result) {
					SiloEvtGrainDeleted.trigger(id);
				}
				return result;
			}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
		}
		return false;
	}

	async createNode(parentOrId, typeDefId = MarBasDefaults.ID_TYPE_ELEMENT) {
		const dlg = GrainNewDialog.instance(this._apiSvc);
		let grainType;
		if (MarBasDefaults.ID_TYPE_ELEMENT != typeDefId) {
			grainType = {
				id: typeDefId,
				label: MarBasDefaults.ID_TYPE_TYPEDEF == typeDefId ? t`Type Definition` : await this._apiSvc.resolveGrainLabel(typeDefId)
			};
		}
		if (await dlg.showModal(parentOrId.id || parentOrId, grainType)) {
			return await Task.nowAsync(t`Creating grain`, async (_, err) => {
				const grain = await this._apiSvc.createGrain(dlg.parentGrain, dlg.grainType, dlg.grainName);
				return await this.revealAndSelectNode(grain);
			}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
		}
		return null;
	}

	async createFile(parentOrId) {
		const dlg = FileNewDialog.instance(this._apiSvc);
		if (await dlg.showModal(parentOrId.id || parentOrId)) {
			return await Task.nowAsync(t`Creating file`, async (_, err) => {
				const grain = await this._apiSvc.createFile(dlg.formData);
				return await this.revealAndSelectNode(grain);
			}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
		}
		return null;
	}

	async renameNode(grainOrId) {
		const node = this.getNodeByGrain(grainOrId);
		if (node) {
			const oldName = grainOrId.name || (await this._apiSvc.getGrain(grainOrId.id || grainOrId)).name || node.text;
			const newName = await InputDialog.requestTextFromUser({
				title: t`Rename "${oldName}"`,
				prompt: t`New Grain Name`,
				defaultValue: oldName
			});
			if (newName && newName != oldName) {
				const mod = {
					id: (grainOrId.id || grainOrId),
					name: newName
				};
				await this._apiSvc.storeGrain(mod, true);
				SiloEvtGrainRenamed.triggerMod(mod);
				return await this.reloadNode(grainOrId, true);
			}
		}
	}

	async editNodeSecurity(grainOrId) {
		if (!this.#securityDlg) {
			this.#securityDlg = new GrainSecurityDialog(this._apiSvc);
		}
		if (await this.#securityDlg.showModal(grainOrId)) {
			let mod = false;
			for (const k in this.#securityDlg.addedEntries) {
				const entry = this.#securityDlg.addedEntries[k];
				try {
					await this._apiSvc.createAclEntry(entry);
					mod = true;
				} catch (e) {
					console.error(e);
				}
			}
			for (const k in this.#securityDlg.deletedEntries) {
				const entry = this.#securityDlg.deletedEntries[k];
				try {
					await this._apiSvc.deleteAclEntry(entry.grainId, entry.roleId);
					mod = true;
				} catch (e) {
					console.error(e);
				}
			}
			for (const k in this.#securityDlg.modifiedEntries) {
				const entry = this.#securityDlg.modifiedEntries[k];
				try {
					await this._apiSvc.storeAclEntry(entry);
					mod = true;
				} catch (e) {
					console.error(e);
				}
			}
			if (mod) {
				await this.reloadNode(grainOrId);
			}
		}
	}

	async addNodeToClipboard(grainOrId, operation = 'copy') {
		const id = grainOrId.id || grainOrId;
		await this.clearClipboard();
		this.#clipboard[id] = operation;
		this.updateNode(grainOrId.id ? grainOrId : await this._apiSvc.getGrain(id));
	}

	async clearClipboard() {
		const curr = Object.keys(this.#clipboard);
		this.#clipboard = {};
		for (const id of curr) {
			this.updateNode(await this._apiSvc.getGrain(id));
		}
	}

	hasClipboardContent(operation = undefined) {
		let result = !!Object.keys(this.#clipboard).length;
		if (result && operation) {
			result = Object.keys(this.#clipboard).every((id) => {
				return this.#clipboard[id] == operation;
			});
		}
		return result;
	}

	async pasteIntoNode(parentOrId) {
		if (!this.hasClipboardContent()) {
			return null;
		}
		const id = Object.keys(this.#clipboard)[0];
		const op = this.#clipboard[id];

		const taskName = 'cut' == op ? t`Moving grain` : t`Copying grain`;
		await Task.nowAsync(taskName, async () => {
			let grain;
			if ('cut' == op) {
				const oldParentId = (await this._apiSvc.getGrain(id)).parentId;
				grain = await this._apiSvc.moveGrain(id, parentOrId);
				if (grain) {
					const parentId = parentOrId.id || parentOrId;
					if (parentId != oldParentId) {
						await this.reloadNode(oldParentId);
						this.tree.expandNode(this.getNodeByGrain(oldParentId));
					}
				}
			} else {
				grain = await this._apiSvc.cloneGrain(id, parentOrId);
			}
			if (grain) {
				this.clearClipboard();
				await this.reloadNode(parentOrId);
				await this.expandBranch(grain);
			}
		}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
	}

	async pasteLinkIntoNode(parentOrId) {
		if (!this.hasClipboardContent('copy')) {
			return null;
		}
		const taskName = t`Creating link`;
		await Task.nowAsync(taskName, async () => {
			const id = Object.keys(this.#clipboard)[0];
			const target = await this._apiSvc.getGrain(id);
			const link = await this._apiSvc.createGrainLink(parentOrId, target);
			if (link) {
				this.clearClipboard();
				await this.reloadNode(parentOrId);
				this.tree.expandNode(this.getNodeByGrain(parentOrId));
			}
		}, Task.Flag.DEFAULT | Task.Flag.REPORT_START);
	}

	async expandBranch(grainOrId) {
		let node = this.getNodeByGrain(grainOrId);
		const handleErr = (errMsg) => {
			console.warn('navigateToNode', errMsg);
			MsgBox.invokeErr(errMsg);
			return null;
		};
		if (node) {
			if (!grainOrId.id) {
				grainOrId = await this._apiSvc.getGrain(grainOrId);
			}
		} else {
			const path = await this._apiSvc.getGrainPath(grainOrId, true);
			if (!path || !path.length) {
				return handleErr(t`Path for ${grainOrId} is empty`);
			}
			grainOrId = path[0];
			const id = grainOrId.id;

			let c = 0;
			let allThere = false;
			while (!allThere) {
				for (let i = 0; i < path.length; i++) {
					const part = this.getNodeByGrain(path[i]);
					if (part) {
						if (path[i].id == id) {
							allThere = true;
							node = part;
						} else {
							await this.#expandNodeAndWait(part);
						}
						break;
					}
				}
				if (1000 < ++c) {
					return handleErr(t`Path to ${id} is unreachable`);
				}
			};
		}
		return node;
	}

	async navigateToNode(grainOrId) {
		if (await this.expandBranch(grainOrId)) {
			return await this.revealAndSelectNode(grainOrId);
		}
		return null;
	}

	async openTypeDefDefaults(typeDefOrId, grainOrId) {
		if (!grainOrId) {
			grainOrId = await this._apiSvc.getOrCreateTypeDefDefaults(typeDefOrId);
			await this.reloadNode(typeDefOrId, false);
		}
		return await this.navigateToNode(grainOrId);
	}

	async _getNodeProperties(grain, node) {
		const result = await super._getNodeProperties(grain, node);
		const op = this.#clipboard[grain.id];
		this._updateNodeTags({
			text: ' ',
			'data-tag': 'clipboard',
			'class': `badge bg-light text-dark ms-1 ${'cut' == op ? 'bi-scissors' : 'bi-copy'}`
		}, result, !op);
		return result;
	}

	async #expandNodeAndWait(node) {
		const result = new Promise((resolve) => {
			if (node.state.expanded) {
				resolve(node);
				return;
			}
			this._element.addEventListener(EVENT_NODE_EXPANDED, (evt) => {
				if (evt.detail.node == node) {
					resolve(evt.detail.node);
				}
			}, { once: true });
		});
		this.tree.expandNode(node);
		return await result;
	}

	#buildContextMenu() {
		this.ctxMnu = new BsContextDropdown('silo-nav-contextdd', this._element);
		this.ctxMnu.addEventListener('show.bs.dropdown', (evt) => this.#onContextMenu(evt));
		this.ctxMnu.addCmdListener('cmdReload', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.reloadNode(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdNew', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.createNode(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdNewContainer', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.createNode(grainId, MarBasDefaults.ID_TYPE_CONTAINER);
			}
		});
		this.ctxMnu.addCmdListener('cmdNewFile', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.createFile(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdNewType', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.createNode(grainId, MarBasDefaults.ID_TYPE_TYPEDEF);
			}
		});
		this.ctxMnu.addCmdListener('cmdCut', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.addNodeToClipboard(grainId, 'cut');
			}
		});
		this.ctxMnu.addCmdListener('cmdCopy', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.addNodeToClipboard(grainId, 'copy');
			}
		});
		this.ctxMnu.addCmdListener('cmdPaste', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.pasteIntoNode(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdPasteLink', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.pasteLinkIntoNode(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdClearCbrd', (evt) => {
			this.clearClipboard();
		});
		this.ctxMnu.addCmdListener('cmdRename', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.renameNode(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdEdit', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				const dlg = GrainEditorDialog.getOrCreate(this._apiSvc);
				dlg.show(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdDelete', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.deleteNode(grainId);
			}
		});
		this.ctxMnu.addCmdListener('cmdSecurity', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.editNodeSecurity(grainId);
			}
		});
	}

	async #onContextMenu(evt) {
		const grainId = this._getGrainIdFor(evt.menuEvent);
		if (grainId) {
			const opCmds = ['cmdDelete', 'cmdNew', 'cmdNewContainer', 'cmdNewFile', 'cmdNewType', 'cmdCut', 'cmdCopy', 'cmdPaste', 'cmdPasteLink', 'cmdRename'];
			try {
				const grain = await this._apiSvc.getGrain(grainId);
				const isRoot = MarBasDefaults.ID_ROOT == grainId;
				const isContainer = isRoot || await this._apiSvc.isGrainInstanceOf(grain, MarBasDefaults.ID_TYPE_CONTAINER);
				const isLink = !isContainer && await this._apiSvc.isGrainInstanceOf(grain, MarBasDefaults.ID_TYPE_LINK);
				const isInSchema = !isRoot && (grain.id == MarBasDefaults.ID_SCHEMA || await this._apiSvc.isGrainDescendantOf(grain, MarBasDefaults.ID_SCHEMA));
				const isInFiles = !isRoot && !isInSchema && (grain.id == MarBasDefaults.ID_FILES || await this._apiSvc.isGrainDescendantOf(grain, MarBasDefaults.ID_FILES));
				const isInTrash = !isRoot && (grain.id == MarBasDefaults.ID_TRASH_CONTENT || grain.id == MarBasDefaults.ID_TRASH_SCHEMA
					|| await this._apiSvc.isGrainDescendantOf(grain, MarBasDefaults.ID_TRASH_CONTENT) || await this._apiSvc.isGrainDescendantOf(grain, MarBasDefaults.ID_TRASH_SCHEMA));
				opCmds.forEach(async x => {
					let enable = 'cmdNewContainer' == x || !isRoot;
					try {
						if (enable && x.startsWith('cmdPaste')) {
							enable = this.hasClipboardContent('cmdPasteLink' == x ? 'copy' : undefined);
						}
						if (enable && ('cmdNewType' == x)) {
							enable = isContainer && isInSchema;
						}
						if (enable && 'cmdNewFile' == x) {
							enable = isInFiles && (isContainer || isLink);
						}
						if (enable && x.startsWith('cmdNew') && 'cmdNewContainer' != x) {
							enable = !isInTrash;
						}
						if (enable && (x.startsWith('cmdPaste') || x.startsWith('cmdNew'))) {
							enable = await this._apiSvc.getGrainPermission(grain, MarBasGrainAccessFlag.CreateSubelement);
						}
						if (enable && 'cmdRename' == x) {
							enable = '__defaults__' != grain.name && await this._apiSvc.getGrainPermission(grain, MarBasGrainAccessFlag.Write);
						}
						if (enable && ('cmdDelete' == x || 'cmdCut' == x)) {
							enable = -1 == MarBasBuiltIns.indexOf(grainId) && await this._apiSvc.getGrainPermission(grain, MarBasGrainAccessFlag.Delete);
						}
					} catch (e) {
						console.warn(`Error initiazing menu item`, x, e);
						enable = false;
					}
					this.ctxMnu.enableCmd(x, enable);
				});

				this.ctxMnu.enableCmd('cmdClearCbrd', this.hasClipboardContent());
				this.ctxMnu.enableCmd('cmdSecurity', await this._apiSvc.getCurrentRoleEntitlement(MarBasRoleEntitlement.ReadAcl));
				this.ctxMnu.enableCmd('cmdEdit', !this.isNodeSelected(grainId));

			} catch (e) {
				console.warn(`Error initiazing menu`, e);
				opCmds.forEach(x => x.enableCmd(x, false));
			}
		}
	}
}