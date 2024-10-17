import startCase from "lodash.startcase";
import { MarBasDefaults, MarBasGrainAccessFlag, MarBasRoleEntitlement } from "../conf/marbas.conf";
import { MbUtils } from "./MbUtils";
import { _Dialog } from "./_Dialog";
import { MbDomUtils } from "./MbDomUtils";

const uuidRegExp = /[a-f\d]{4}(?:[a-f\d]{4}-){4}[a-f\d]{12}/g;
const accessFlagMax = 'Full';

export class GrainSecurityDialog extends _Dialog {
	#grain;
	#apiSvs;
	#grainAcl;
	#canWrite;
	#canDelete;
	#roles = {};
	#aclHeadElm;
	#aclBodyElm;
	#modified = {};
	#added = {};
	#deleted = {};

	constructor(apiSvc, scope = null) {
		super(scope || 'grain-security');
		this.#apiSvs = apiSvc;
		this.#aclHeadElm = this._element.querySelector(`#${this._scope}-aclhead`);
		this.#aclBodyElm = this._element.querySelector(`#${this._scope}-acl tbody`);
	}

	get modifiedEntries() {
		return this.#modified;
	}

	get addedEntries() {
		return this.#added;
	}

	get deletedEntries() {
		return this.#deleted;
	}

	show(grainId) {
		this._element.querySelector(`#${this._scope}-subtitle`).textContent = `loading...`;
		MbDomUtils.clearNode(this.#aclHeadElm);
		MbDomUtils.clearNode(this.#aclBodyElm);
		this.#modified = {};
		this.#added = {};
		this.#deleted = {};
		this.#updateModifiedMark();

		super.show();
		this._load(grainId);
	}

	async _load(grainId) {
		if (grainId) {
			this.#grain = await this.#apiSvs.getGrain(grainId);
		}
		this._element.querySelector(`#${this._scope}-subtitle`).textContent = `${this.#grain ? this.#grain.path : grainId}`;


		this.#grainAcl = await this.#apiSvs.getGrainAcl(grainId);
		this.#canWrite = await this.#apiSvs.getGrainPermission(this.#grain, MarBasGrainAccessFlag.ModifyAcl);
		this.#canWrite = this.#canWrite && await this.#apiSvs.getCurrentRoleEntitlement(MarBasRoleEntitlement.WriteAcl);
		this.#canDelete = this.#canWrite && (await this.#apiSvs.getCurrentRoleEntitlement(MarBasRoleEntitlement.DeleteAcl));
		await this.#loadRoles();
		this.#buildAclTable();
	}

	#updateModifiedMark() {
		MbDomUtils.hideNode(this._element.querySelector(`#${this._scope}-mod`),
			0 == Object.keys(this.#modified).length + Object.keys(this.#added).length + Object.keys(this.#deleted).length);
	}

	#onAclEntryChange(id) {
		const key = this.#getAclEntryKey(id);
		const existing = this.#grainAcl && this.#grainAcl.find((x) => (x.grainId == key[0] && x.roleId == key[1]));
		const entry = {
			grainId: key[0],
			roleId: key[1],
			permissionMask: existing ? MbUtils.string2BitField(existing.permissionMask, MarBasGrainAccessFlag, MarBasGrainAccessFlag.None, accessFlagMax) : MarBasGrainAccessFlag.None,
			restrictionMask: existing ? MbUtils.string2BitField(existing.restrictionMask, MarBasGrainAccessFlag, MarBasGrainAccessFlag.None, accessFlagMax) : MarBasGrainAccessFlag.None,
			inherit: this.#aclBodyElm.querySelector(`#${this._scope}-chk-${key[1]}-inherit`).checked
		};
		const idPfx = `${this._scope}-chk-${entry.roleId}`;
		for (const f in MarBasGrainAccessFlag) {
			if (!GrainSecurityDialog.#isRelevantAccessFlag(f)) {
				continue;
			}
			let chk = this.#aclBodyElm.querySelector(`#${idPfx}-perm-${f}`);
			if (chk.checked) {
				entry.permissionMask = (entry.permissionMask | MarBasGrainAccessFlag[f]) >>> 0;
			} else {
				entry.permissionMask = (entry.permissionMask & ~MarBasGrainAccessFlag[f]) >>> 0;
			}
			chk = this.#aclBodyElm.querySelector(`#${idPfx}-restr-${f}`);
			if (chk.checked) {
				entry.restrictionMask = (entry.restrictionMask | MarBasGrainAccessFlag[f]) >>> 0;
			} else {
				entry.restrictionMask = (entry.restrictionMask & ~MarBasGrainAccessFlag[f]) >>> 0;
			}
		}

		(this.#added[entry.roleId] ? this.#added : this.#modified)[entry.roleId] = entry;

		this.#updateModifiedMark();
	}

	#onAclEntryDelete(id) {
		this.#aclBodyElm.removeChild(this.#aclBodyElm.querySelector(`#${id}`));

		const key = this.#getAclEntryKey(id);
		if (!this.#added[key[1]]) {
			this.#deleted[key[1]] = { grainId: key[0], roleId: key[1] };
		}
		delete this.#added[key[1]];
		delete this.#modified[key[1]];
		MbDomUtils.hideNode(this._element.querySelector(`#${this._scope}-add-${key[1]}`), false);
		this.#updateEntryAddDropdown();
		this.#updateModifiedMark();
	}

	#onAclEntryAdd(roleId) {
		const entry = {
			grainId: this.#grain.id,
			roleId: roleId,
			permissionMask: MarBasGrainAccessFlag.None,
			restrictionMask: MarBasGrainAccessFlag.None,
			inherit: false
		};
		this.#added[roleId] = entry;

		const rowtpl = this._getTemplate('aclentry', 'tr');
		const flagRwTpl = this._getTemplate('aclflag-rw', 'td');
		
		const tr = rowtpl.cloneNode(true);
		tr.id = `a-${entry.grainId}-${entry.roleId}`;

		tr.querySelector(`.${this._scope}-role .mb-val`).textContent = this.#roles[entry.roleId] || entry.roleId;
		const delBtn = tr.querySelector(`.${this._scope}-role button`);
		MbDomUtils.hideNode(delBtn, false);
		delBtn.onclick = () => {
			this.#onAclEntryDelete(tr.id);
		}

		const inheritTd = tr.querySelector(`.${this._scope}-inherit`);

		for (const f in MarBasGrainAccessFlag) {
			if (!GrainSecurityDialog.#isRelevantAccessFlag(f)) {
				continue;
			}
			const td = flagRwTpl.cloneNode(true);
			td.classList.add(`${this._scope}-a-${f}`);
			this.#setupAclCheck(td, entry.roleId, 'perm', f, false);
			this.#setupAclCheck(td, entry.roleId, 'restr', f, false);

			tr.insertBefore(td, inheritTd);
		}

		MbDomUtils.hideNode(inheritTd.querySelector('.form-check'), false);
		const chk = inheritTd.querySelector('input');
		chk.id = `${this._scope}-chk-${entry.roleId}-inherit`;
		chk.checked = entry.inherit;
		chk.onchange = () => {
			this.#onAclEntryChange(tr.id);
		};
		inheritTd.querySelector('label').htmlFor = chk.id;

		this.#aclBodyElm.insertBefore(tr, this.#aclBodyElm.firstChild);

		MbDomUtils.hideNode(this._element.querySelector(`#${this._scope}-add-${roleId}`), true);
		this.#updateEntryAddDropdown();
		this.#updateModifiedMark();
	}

	#getAclEntryKey(idOrElm) {
		const id = 'string' == typeof(idOrElm) ? idOrElm : idOrElm.id;
		return id.match(uuidRegExp);
	}

	#buildAclTable() {
		const grainIds = {};
		if (this.#grainAcl) {
			const headTpl = this._getTemplate('aclhead', 'th');

			for (const f in MarBasGrainAccessFlag) {
				if (!GrainSecurityDialog.#isRelevantAccessFlag(f)) {
					continue;
				}
				const th = headTpl.cloneNode(true);
				th.querySelector('.th-content').textContent = startCase(f);
				this.#aclHeadElm.appendChild(th);
			}

			const rowtpl = this._getTemplate('aclentry', 'tr');
			const flagTpl = this._getTemplate('aclflag', 'td');
			const flagRwTpl = this._getTemplate('aclflag-rw', 'td');

			this.#grainAcl.forEach(entry => {
				const tr = rowtpl.cloneNode(true);
				tr.id = `a-${entry.sourceGrainId || entry.grainId}-${entry.roleId}`;

				tr.querySelector(`.${this._scope}-role .mb-val`).textContent = this.#roles[entry.roleId] || entry.roleId;

				const permissions = MbUtils.string2BitField(entry.permissionMask, MarBasGrainAccessFlag, MarBasGrainAccessFlag.None, accessFlagMax);
				const restrictions = MbUtils.string2BitField(entry.restrictionMask, MarBasGrainAccessFlag, MarBasGrainAccessFlag.None, accessFlagMax);

				
				const inheritedAcl = entry.sourceGrainId != this.#grain.id;
				const readonly = inheritedAcl || !this.#canWrite;
				const inheritTd = tr.querySelector(`.${this._scope}-inherit`);
				if (!readonly) {
					MbDomUtils.hideNode(this._element.querySelector(`#${this._scope}-add-${entry.roleId}`));
					if (this.#canDelete) {
						const delBtn = tr.querySelector(`.${this._scope}-role button`);
						MbDomUtils.hideNode(delBtn, false);
						delBtn.onclick = () => {
							this.#onAclEntryDelete(tr.id);
						}
					}
				}
				
				for (const f in MarBasGrainAccessFlag) {
					if (!GrainSecurityDialog.#isRelevantAccessFlag(f)) {
						continue;
					}
					const td = (readonly ? flagTpl : flagRwTpl).cloneNode(true);
					td.classList.add(`${this._scope}-a-${f}`);

					const permitted = MarBasGrainAccessFlag[f] == (MarBasGrainAccessFlag[f] & permissions);
					const restricted = MarBasGrainAccessFlag[f] == (MarBasGrainAccessFlag[f] & restrictions);

					if (readonly) {
						if (permitted) {
							const flagCnt = td.querySelector('.mb-perm-flag');
							flagCnt.classList.add('bi-hand-thumbs-up');
							flagCnt.title = "Permitted";
							flagCnt.querySelector('.mb-val').textContent = flagCnt.title;
						}
						if (restricted) {
							const flagCnt = td.querySelector('.mb-restr-flag');
							flagCnt.classList.add('bi-hand-thumbs-down');
							flagCnt.title = "Restricted";
							flagCnt.querySelector('.mb-val').textContent = flagCnt.title;
						}	
					} else {
						this.#setupAclCheck(td, entry.roleId, 'perm', f, permitted);
						this.#setupAclCheck(td, entry.roleId, 'restr', f, restricted);
					}
					tr.insertBefore(td, inheritTd);
				}

				if (inheritedAcl) {
					const isBuiltIn = MarBasDefaults.ID_DEFAULT == entry.sourceGrainId;
					tr.querySelector(`.${this._scope}-source`).textContent = isBuiltIn ? 'System defaults' : entry.sourceGrainId;
					if (!isBuiltIn) {
						grainIds[entry.sourceGrainId] = MbUtils.pushOrCreate(grainIds[entry.sourceGrainId], tr.id);
					}
					tr.querySelectorAll('td').forEach(elm => {
						elm.classList.add('text-muted');
					});
				} else {
					const valCnt = inheritTd.querySelector('.mb-val');
					valCnt.textContent = entry.inherit ? 'yes' : 'no';
					if (this.#canWrite) {
						MbDomUtils.hideNode(inheritTd.querySelector('.form-check'), false);
						const chk = inheritTd.querySelector('input');
						chk.id = `${this._scope}-chk-${entry.roleId}-inherit`;
						chk.checked = entry.inherit;
						chk.onchange = () => {
							this.#onAclEntryChange(tr.id);
						};
						inheritTd.querySelector('label').htmlFor = chk.id;
					} else {
						MbDomUtils.hideNode(valCnt, false);
					}
				}

				this.#aclBodyElm.appendChild(tr);
			});
			this.#updateEntryAddDropdown();
		}
		this.#resolveGrains(grainIds);
		this.modal.handleUpdate();
	}

	#setupAclCheck(parentElm, roleId, grantName, maskType, active) {
		const idPfx = `${this._scope}-chk-${roleId}`;
		let chk = parentElm.querySelector(`.mb-${grantName}-flag input`);
		chk.name = `${idPfx}-${maskType}`;
		chk.id = `${idPfx}-${grantName}-${maskType}`;
		chk.checked = active;
		chk.value = MarBasGrainAccessFlag[maskType];
		chk.onchange = () => {
			this.#onAclEntryChange(`a-${this.#grain.id}-${roleId}`);
		};
		parentElm.querySelector(`.mb-${grantName}-flag label`).htmlFor = chk.id;
	}

	#updateEntryAddDropdown() {
		const mnu = this._element.querySelector(`#${this._scope}-add`);
		MbDomUtils.hideNode(mnu, mnu.querySelectorAll('.dropdown-item[aria-hidden="true"]').length >= Object.keys(this.#roles).length);
	}

	#resolveGrains(ids) {
		for (const k in ids) {
			this.#apiSvs.getGrain(k)
				.then((grain) => {
					ids[k].forEach(trId => {
						const td = this._element.querySelector(`#${trId} .${this._scope}-source`);
						td.textContent = '';
						const link = document.createElement('a');
						link.href = `?grain=${grain.id}`;
						link.title = grain.path;
						link.textContent = grain.label;
						MbDomUtils.updateSessionLink(link);

						td.appendChild(link);	
					});
				})
				.catch((reason) => {
					console.warn(`Failed to read grain ${k} due to: ${reason}`);
				});
		}
	}

	async #loadRoles() {
		let hasRoles = false;
		const actionCnt = this._element.querySelector(`#${this._scope}-add .dropdown-menu`);
		MbDomUtils.clearNode(actionCnt);

		if (await this.#apiSvs.getCurrentRoleEntitlement(MarBasRoleEntitlement.ReadRoles)) {
			const addTpl = this._getTemplate('addentry', 'li');

			const roles = await this.#apiSvs.listRoles();
			roles.forEach(role => {
				this.#roles[role.id] = role.name;
				if (this.#canWrite) {
					const action = addTpl.cloneNode(true);
					const btn = action.querySelector('.dropdown-item');
					btn.id = `${this._scope}-add-${role.id}`;
					btn.textContent = role.name;
					btn.onclick = () => {
						this.#onAclEntryAdd(role.id);
					};
					actionCnt.appendChild(action);
					hasRoles = true;	
				}
			});
		}
		MbDomUtils.hideNode(this._element.querySelector(`#${this._scope}-add`), !hasRoles);
	}

	static #isRelevantAccessFlag(flag) {
		return 'None' != flag && accessFlagMax != flag;
	}
}