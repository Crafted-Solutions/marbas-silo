import { EVENT_NODE_EXPANDED, EVENT_NODE_SELECTED } from "@jbtronics/bs-treeview";

import { MarBasBuiltIns, MarBasDefaults, MarBasGrainAccessFlag, MarBasRoleEntitlement } from "../conf/marbas.conf";
import { GrainNewDialog } from "./GrainNewDialog";
import { SiloTree } from "./SiloTree";
import { BsContextDropdown } from "./BsContextDropdown";
import { FileNewDialog } from "./FileNewDialog";
import { InputDialog } from "./InputDialog";
import { MsgBox } from "./MsgBox";
import { GrainSecurityDialog } from "./GrainSecurityDialog";

export class SiloNavi extends SiloTree {

	#grainNewDlg;
	#fileNewDlg;
	#securityDlg;
	#clipboard = {};

	constructor(elementId, apiSvc, rootNodes, initCallback = null) {
		super(elementId, apiSvc, rootNodes, initCallback);
		this.#buildContextMenu();
		document.addEventListener('mb-silo:navigate', async (evt) => {
			if (evt.detail) {
				await this.navigateToNode(evt.detail);
			}
		});
		document.addEventListener('mb-silo:typdef-defaults', async (evt) => {
			if (evt.detail) {
				await this.openTypeDefDefaults(evt.detail.typeDefId, evt.detail.defaultsId);
			}
		});
	}

	async deleteNode(grainOrId) {
		const node = this._getNodeByGrain(grainOrId);
		if (node && 'yes' == await MsgBox.invoke(`Delete ${node.text}?`, {icon: 'primary', buttons: { 'yes': true, 'no': true }})) {
			const parents = node.state && node.state.selected ? this.tree.getParents(node) : [];
			this.tree.removeNode(node);
			if (parents.length) {
				this.tree.selectNode(parents);
			}
			await this._apiSvc.deleteGrain(grainOrId.id || grainOrId);	
			document.dispatchEvent(new CustomEvent('mb-silo:grain-deleted', {
				detail: grainOrId.id || grainOrId
			}));
		}
	}

	createNode(parentOrId, mode = 'generic') {
		if (!this.#grainNewDlg) {
			this.#grainNewDlg = new GrainNewDialog("grain-new", this._apiSvc);
			this.#grainNewDlg.addEventListener('hidden.bs.modal', async () => {
				if (this.#grainNewDlg.accepted) {
					const grain = await this._apiSvc.createGrain(this.#grainNewDlg.parentGrain, this.#grainNewDlg.grainType, this.#grainNewDlg.grainName);
					this.revealAndSelectNode(grain);
				}
			});
		}
		this.#grainNewDlg.show(parentOrId.id || parentOrId, mode);
	}

	createFile(parentOrId) {
		if (!this.#fileNewDlg) {
			this.#fileNewDlg = new FileNewDialog("file-new", this._apiSvc);
			this.#fileNewDlg.addEventListener('hidden.bs.modal', async () => {
				if (this.#fileNewDlg.accepted) {
					const grain = await this._apiSvc.createFile(this.#fileNewDlg.formData);
					this.revealAndSelectNode(grain);
				}
			});
		}
		this.#fileNewDlg.show(parentOrId.id || parentOrId);
	}

	async renameNode(grainOrId) {
		const node = this._getNodeByGrain(grainOrId);
		if (node) {
			const oldName = node.text;
			const newName = await InputDialog.requestTextFromUser({
				title: `Rename "${oldName}"`,
				prompt: 'New Grain Name',
				defaultValue: oldName
			});
			if (newName && newName != oldName) {
				await this._apiSvc.storeGrain({
					id: (grainOrId.id || grainOrId),
					name: newName
				});
				await this.reloadNode(grainOrId, true);
			}
		}
	}

	async editNodeSecurity(grainOrId) {
		if (!this.#securityDlg) {
			this.#securityDlg = new GrainSecurityDialog(this._apiSvc);
			this.#securityDlg.addEventListener('hidden.bs.modal', async () => {
				if (this.#securityDlg.accepted) {
					for (const k in this.#securityDlg.addedEntries) {
						const entry = this.#securityDlg.addedEntries[k];
						try {
							await this._apiSvc.createAclEntry(entry);
						} catch (e) {
							console.error(e);
						}
					}
					for (const k in this.#securityDlg.deletedEntries) {
						const entry = this.#securityDlg.deletedEntries[k];
						try {
							await this._apiSvc.deleteAclEntry(entry.grainId, entry.roleId);
						} catch (e) {
							console.error(e);
						}
					}
					for (const k in this.#securityDlg.modifiedEntries) {
						const entry = this.#securityDlg.modifiedEntries[k];
						try {
							await this._apiSvc.storeAclEntry(entry);
						} catch (e) {
							console.error(e);
						}
					}
				}
				this.reloadNode(grainOrId);
			});
		}
		this.#securityDlg.show(grainOrId);
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

	hasClipboardContent() {
		return !!Object.keys(this.#clipboard).length;
	}

	async pasteIntoNode(parentOrId) {
		if (!this.hasClipboardContent()) {
			return null;
		}
		const id = Object.keys(this.#clipboard)[0];
		const op = this.#clipboard[id];
		let grain;
		if ('cut' == op) {
			const oldParentId = (await this._apiSvc.getGrain(id)).parentId;
			grain = await this._apiSvc.moveGrain(id, parentOrId);
			if (grain) {
				const parentId = parentOrId.id || parentOrId;
				if (parentId != oldParentId) {
					await this.reloadNode(oldParentId);
				}
			}
		} else {
			grain = await this._apiSvc.cloneGrain(id, parentOrId);
		}
		if (grain) {
			await this.reloadNode(parentOrId);
			this.clearClipboard();
		}
	}

	async revealAndSelectNode(grain) {
		let node = this._getNodeByGrain(grain);
		let parent = this._getNodeByGrain(grain.parentId);

		const result = new Promise((resolve) => {
			const expandListener = (evt) => {
				if (evt.detail.node == parent) {
					this._element.removeEventListener(EVENT_NODE_EXPANDED, expandListener);
					if (!node) {
						node = this._getNodeByGrain(grain);
					}
					if (node) {
						this.tree.selectNode(node, { silent: true });
						this.tree._triggerEvent(EVENT_NODE_SELECTED, node, { silent: false });
					}
					resolve(node);
				}
			};
			this._element.addEventListener(EVENT_NODE_EXPANDED, expandListener);	

			if (node) {
				this.tree.revealNode(node);
				node.setSelected(true);
				resolve(node);
			} else {
				this.reloadNode(grain.parentId, false).then(n => {
					parent = n;
					this.tree.expandNode(parent);
				});
			}
			});

		return await result;
	}

	async navigateToNode(grainOrId) {
		let node = this._getNodeByGrain(grainOrId);
		if (node) {
			if (!grainOrId.id) {
				grainOrId = await this._apiSvc.getGrain(grainOrId);
			}
		} else {
			const path = await this._apiSvc.getGrainPath(grainOrId, true);
			if (!path || !path.length) {
				console.warn(`No path returned for ${grainOrId}`);
				return null;
			}
			grainOrId = path[0];
			const id = grainOrId.id;

			let c = 0;
			let allThere = false;
			while(!allThere) {
				for (let i = 0; i < path.length; i++) {
					const part = this._getNodeByGrain(path[i]);
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
					console.warn(`Path to ${id} is too deep`);
					break;
				}
			};
		}
		if (node) {
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
		result.tags = op ? [{text: ' ', 'class': `badge bg-light text-dark ms-1 ${'cut' == op ? 'bi-scissors' : 'bi-copy'}`}] : [];
		return result;
	}

	async #expandNodeAndWait(node) {
		const result = new Promise((resolve) => {
			if (node.state.expanded) {
				resolve(node);
				return;
			}
			const expandListener = (evt) => {
				if (evt.detail.node == node) {
					this._element.removeEventListener(EVENT_NODE_EXPANDED, expandListener);
					resolve(evt.detail.node);
				}
			};
			this._element.addEventListener(EVENT_NODE_EXPANDED, expandListener);	
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
				this.createNode(grainId, 'container');
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
				this.createNode(grainId, 'type');
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
		this.ctxMnu.addCmdListener('cmdClearCbrd', (evt) => {
			this.clearClipboard();
		});
		this.ctxMnu.addCmdListener('cmdRename', (evt) => {
			const grainId = this._getGrainIdFor(evt);
			if (grainId) {
				this.renameNode(grainId);
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
			const opCmds = ['cmdDelete', 'cmdNew', 'cmdNewContainer', 'cmdNewFile', 'cmdNewType', 'cmdCut', 'cmdCopy', 'cmdPaste', 'cmdRename'];
			try {
				const grain = await this._apiSvc.getGrain(grainId);
				const isContainer = await this._apiSvc.isGrainInstanceOf(grain, MarBasDefaults.ID_TYPE_CONTAINER);
				const isInTrash = await this._apiSvc.isGrainDescendantOf(MarBasDefaults.ID_TRASH_CONTENT) || await this._apiSvc.isGrainDescendantOf(MarBasDefaults.ID_TRASH_SCHEMA);
				opCmds.forEach(async x => {
					let enable = 'cmdNewContainer' == x || MarBasDefaults.ID_ROOT != grainId;
					if (enable && 'cmdPaste' == x) {
						enable = this.hasClipboardContent();
					}
					if (enable && ('cmdNewType' == x)) {
						enable = isContainer && await this._apiSvc.isGrainDescendantOf(MarBasDefaults.ID_SCHEMA);
					}
					if (enable && 'cmdNewFile' == x) {
						enable = isContainer && await this._apiSvc.isGrainDescendantOf(MarBasDefaults.ID_FILES);
					}
					if (enable && x.startsWith('cmdNew') && 'cmdNewContainer' != x) {
						enable = isInTrash;
					}
					if (enable && ('cmdPaste' == x || x.startsWith('cmdNew'))) {
						enable = await this._apiSvc.getGrainPermission(grain, MarBasGrainAccessFlag.CreateSubelement);
					}
					if (enable && 'cmdRename' == x) {
						enable = '__defaults__' != grain.name && MarBasDefaults.ID_SCHEMA != grain.id && MarBasDefaults.ID_FILES != grain.id && MarBasDefaults.ID_CONTENT != grain.id
							&& await this._apiSvc.getGrainPermission(grain, MarBasGrainAccessFlag.Write); 
					}
					if (enable && ('cmdDelete' == x || 'cmdCut' == x)) {
						enable = -1 == MarBasBuiltIns.indexOf(grainId) && await this._apiSvc.getGrainPermission(grain, MarBasGrainAccessFlag.Delete);
					}
					this.ctxMnu.enableCmd(x, enable);
				});
	
			} catch (e) {
				console.warn(`Error initiazing menu: ${e}`);
				opCmds.forEach(x => x.enableCmd(x , false));
			}
			this.ctxMnu.enableCmd('cmdClearCbrd', this.hasClipboardContent());

			this.ctxMnu.enableCmd('cmdSecurity', await this._apiSvc.getCurrentRoleEntitlement(MarBasRoleEntitlement.ReadAcl));
		}
	}
}