import merge from "lodash.merge";
import contentDisposition from "content-disposition";
import { MarBasDefaults, MarBasRoleEntitlement, MarBasTraitValueType } from "../conf/marbas.conf.js";
import { MbUtils } from "./MbUtils.js";

const NoOp = () => { };

const FETCH_YIELD_FAILMSG = 'API reported failure';

const BackgroundJobStatus = {
	Pending: 0, Running: 1, Paused: 2, Complete: 3, Cancelled: 4, Error: 5
};

function tierNameToRoute(tier) {
	return tier ? tier.substring(1) : 'Grain';
}

export class DataBrokerAPI {
	#lang;
	#authModule;
	#grains = {};
	#subtypes = {};
	#resolvers = {
		[MarBasDefaults.TIER_FILE]: {},
		[MarBasDefaults.TIER_PROPDEF]: {},
		[MarBasDefaults.TIER_TYPEDEF]: {}
	};
	#rejects = [];
	#currentRoles = {
		entitlement: -2
	};

	constructor(authModule, lang = null) {
		this.#authModule = authModule;
		this.#lang = lang;
	}

	set language(lang) {
		if (this.#lang != lang) {
			this.invalidateGrain(MarBasDefaults.ID_ROOT, true);
			this.#lang = lang;
		}
	}

	get language() {
		return this.#lang;
	}

	get baseUrl() {
		return this.#authModule.brokerUrl;
	}

	listLanguages() {
		return this.#fetchGet(`${this.baseUrl}/Language/List`);
	}

	createLanguage(isoCode) {
		return this.#fetchSendJson(`${this.baseUrl}/Language?lang=${isoCode}`, null, true, 'PUT');
	}

	deleteLanguage(isoCode) {
		return this.#fetchSendJson(`${this.baseUrl}/Language/${isoCode}`, null, false, 'DELETE');
	}

	getCurrentRoles() {
		if (this.#currentRoles.roles) {
			return new Promise((resolve) => {
				resolve(this.#currentRoles.roles);
			});
		}
		const result = this.#fetchGet(`${this.baseUrl}/Role/Current`);
		result.then((roles) => {
			this.#currentRoles.roles = roles;
		}).catch(NoOp);
		return result;
	}

	getCurrentRoleEntitlement(intent) {
		return new Promise((resolve, reject) => {
			const resolver = () => {
				resolve(intent = (intent & this.#currentRoles.entitlement));
			};
			if (-2 < this.#currentRoles.entitlement) {
				resolver();
			}
			else {
				this.getCurrentRoles()
					.then(roles => {
						this.#currentRoles.entitlement = MarBasRoleEntitlement.None;
						roles.forEach(role => {
							this.#currentRoles.entitlement = MbUtils.string2BitField(role.entitlement, MarBasRoleEntitlement, MarBasRoleEntitlement.None, 'Full');
						});
						resolver();
					})
					.catch(reject);
			}
		});
	}

	invalidateCurrentRoles() {
		this.#currentRoles = {
			entitlement: -2
		};
	}

	listRoles() {
		return this.#fetchGet(`${this.baseUrl}/Role/List`);
	}

	getRole(roleId) {
		return this.#fetchGet(`${this.baseUrl}/Role/${roleId}`);
	}

	resolveGrainLabel(grainOrId) {
		return new Promise((resolve) => {
			if (grainOrId.label) {
				resolve(grainOrId.label);
			} else {
				this.getGrainLabels(grainOrId, [this.#lang || grainOrId.culture || MarBasDefaults.LANG])
					.then(labels => resolve(labels && labels.length ? labels[0].label : '-'))
					.catch(() => resolve('-'));
			}
		});
	}

	resolveGrainLink(linkOrId) {
		return new Promise(async (resolve, reject) => {
			const link = linkOrId.id ? linkOrId : await this.getGrain(linkOrId);
			this.getTraitValues(link, MarBasDefaults.ID_PROPDEF_LINKTARGET)
				.then(targets => {
					if (targets && targets.length && targets[0].value) {
						this.getGrain(targets[0].value).then(resolve).catch(reject);
					} else {
						resolve(link);
					}
				})
				.catch(reject);
		});
	}

	createGrainLink(parentOrId, target) {
		return new Promise((resolve, reject) => {
			this.createGrain(parentOrId, MarBasDefaults.ID_TYPE_LINK, `${target.name}-Link-${((Math.random() * 0xfffffff) << 2).toString(16)}`)
				.then(link => {
					link.label = target.label;
					link.culture = target.culture;
					link.sortKey = target.sortKey;
					let xAttrs;
					if (target.typeXAttrs) {
						xAttrs = JSON.parse(`{${target.typeXAttrs}}`);
					}
					if (target.xAttrs) {
						xAttrs = merge(xAttrs || {}, JSON.parse(`{${target.xAttrs}}`));
					}
					if (target.icon && (!xAttrs || !xAttrs.silo || !xAttrs.silo.icon)) {
						xAttrs = xAttrs || {};
						xAttrs.silo = xAttrs.silo || {};
						xAttrs.silo.icon = target.icon;
					}
					if (xAttrs) {
						link.xAttrs = JSON.stringify(xAttrs).slice(1, -1);
					}
					this.storeGrain(link)
						.then(() => {
							this.getGrainLabels(target)
								.then((labels) => {
									labels.forEach(label => {
										if (label.culture && label.culture != link.culture) {
											this.storeGrain({
												id: link.id,
												typeDefId: link.typeDefId,
												culture: label.culture,
												label: label.label
											}, true, true).catch(NoOp);
										}
									});
								})
								.catch(NoOp);

							this.storeTraitValues(link, {
								id: MarBasDefaults.ID_PROPDEF_LINKTARGET,
								valueType: MarBasTraitValueType.Grain
							}, [target.id])
								.then(() => resolve(link))
								.catch(reject);
						})
						.catch(reject);
				})
				.catch(reject);
		});
	}

	isRootGrain(grain) {
		return (grain.id || grain) == MarBasDefaults.ID_ROOT;
	}

	getGrain(id = null, ignoreCache = false) {
		const effectiveId = id || MarBasDefaults.ID_ROOT;
		if (!ignoreCache && this.#grains[effectiveId]) {
			return new Promise(resolve => {
				resolve(this.#grains[effectiveId]);
			});
		}
		const result = this.#fetchGet(this.localizeUrl(`${this.baseUrl}/Grain/${effectiveId}`)
			, (res) => {
				// return fake root for GrainPicker
				if (res.status == 404 && MarBasDefaults.ID_SCHEMA == effectiveId) {
					return {
						id: MarBasDefaults.ID_SCHEMA,
						name: 'Schema',
						label: 'Schema',
						typeDefId: MarBasDefaults.ID_TYPE_CONTAINER
					};
				}
			});
		result.then(grain => {
			this.#addGrainToCache(grain);
		}).catch(NoOp);
		return result;
	}

	getGrainByPath(path, ignoreCache = false) {
		if (!path || MarBasDefaults.NAME_ROOT == path || '/' == path) {
			return this.getGrain(null, ignoreCache);
		}
		const searchPath = path.replace(/^(\/|marbas\/)/, '').replace(/\/\**$/, '');
		return new Promise(resolve => {
			if (!ignoreCache && Object.keys(this.#grains).some(id => {
				if (`${MarBasDefaults.NAME_ROOT}/${searchPath}` == this.#grains[id].path) {
					resolve(this.#grains[id]);
					return true;
				}
				return false;
			})) {
				return;
			}

			this.#fetchGet(this.localizeUrl(`${this.baseUrl}/Tree/${searchPath}`))
				.then(grains => {
					const grain = grains && grains.length ? this.#addGrainToCache(grains[0]) : null;
					resolve(grain);
				})
				.catch(() => { resolve(null) });
		});
	}

	resolveGrainPath(path, relativeToGrainOrId = null) {
		if (!path.startsWith('.')) {
			return this.getGrainByPath(path);
		}
		if (!relativeToGrainOrId) {
			relativeToGrainOrId = MarBasDefaults.ID_ROOT;
		}
		return new Promise((resolve, reject) => {
			this.getGrain(relativeToGrainOrId.id || relativeToGrainOrId)
				.then(baseGrain => {
					var url = new URL(path, `https://test.com/${baseGrain.path}`);
					this.getGrainByPath(url.pathname.substring(1)).then(resolve).catch(reject);
				})
				.catch(reject);
		});
	}

	storeGrain(grain, useBasicTier = false, useGrainCulture = false) {
		if (grain._siloAttrs && grain._siloAttrsMod) {
			grain.xAttrs = Object.keys(grain._siloAttrs).length ? `"silo":${JSON.stringify(grain._siloAttrs)}` : null;
		}
		if ((!useGrainCulture || !grain.culture) && this.#lang) {
			grain.culture = this.#lang;
		}
		return new Promise((resolve, reject) => {
			(useBasicTier ? Promise.resolve('IGrain') : this.getGrainTierName(grain)).then(tier => {
				this.#fetchSendJson(`${this.baseUrl}/${tierNameToRoute(tier)}`, grain, false)
					.then(result => {
						delete grain._siloAttrsMod;
						resolve(result);
					})
					.catch(reject);
			});
		});
	}

	deleteGrain(grain) {
		return new Promise((resolve, reject) => {
			const inv = this.invalidateGrain(grain, true);
			this.applyStdFetchOptions({ method: 'DELETE' }).then(opts => {
				fetch(`${this.baseUrl}/Grain/${grain.id || grain}`, opts)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, (success) => {
							inv.then(() => {
								resolve(success);
							}).catch(() => resolve(false));
						}, reject, false);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	createGrain(parentOrId, typeOrId, name) {

		const typeId = (typeOrId.id || typeOrId);

		return new Promise((resolve, reject) => {
			const inv = this.invalidateGrain(parentOrId, true);
			const data = {
				parentId: (parentOrId.id || parentOrId),
				typeDefId: typeId,
				name: name,
				culture: this.#lang
			};
			if (MarBasDefaults.ID_TYPE_PROPDEF == typeId) {
				data.typeContainerId = data.parentId;
			}

			this.applyStdFetchOptions({
				method: 'PUT',
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(data)
			}).then(opts => {
				this.getTypeDefTierName(typeId).then(tier => {
					fetch(`${this.baseUrl}/${tierNameToRoute(tier)}`, opts)
						.then(res => {
							if (res.ok) {
								return res.json();
							}
							return DataBrokerAPI.analyzeFetchErr(res);
						})
						.then(json => {
							DataBrokerAPI.completeRequest(json, (grain) => {
								grain._tier = tier;
								inv.then(() => {
									resolve(this.#addGrainToCache(grain));
								}).catch(() => resolve(grain));
							}, reject);
						})
						.catch(reject);

				}).catch(reject);

			}).catch(reject);

		});
	}

	moveGrain(grainOrId, newParentOrId) {
		const id = grainOrId.id || grainOrId;
		const parentId = newParentOrId.id || newParentOrId;

		const result = this.#fetchSendJson(`${this.baseUrl}/Grain/${id}/Move?newParentId=${parentId}`);
		result.then(grain => {
			grain.path = null;
			this.#addGrainToCache(grain);
		}).catch(NoOp);
		return result;
	}

	cloneGrain(grainOrId, newParentOrId = null, depth = 'Recursive') {
		const id = grainOrId.id || grainOrId;
		const result = this.#fetchSendJson(`${this.baseUrl}/Grain/${id}/Clone`, {
			depth: depth,
			newParentId: newParentOrId.id || newParentOrId
		});
		result.then(grain => {
			grain.path = null;
			this.#addGrainToCache(grain);
		}).catch(NoOp);
		return result;
	}

	listGrainChildren(parent, ignoreCache = false, typeFilter = null) {
		const id = parent.id || parent;
		if (!ignoreCache && this.#grains[id] && this.#grains[id]._listed) {
			return new Promise((resolve, reject) => {
				const filtered = [];
				const pending = [];
				for (const key in this.#grains) {
					const g = this.#grains[key];
					if (g.parentId == id) {
						if (typeFilter) {
							pending.push(new Promise((resolve, reject) => {
								this.isGrainInstanceOf(g, typeFilter)
									.then(val => {
										if (val) {
											filtered.push(g);
										}
										resolve(val);
									})
									.catch(reject);
							}));
						} else {
							filtered.push(g);
						}
					}
				}
				Promise.all(pending)
					.then(() => {
						resolve(filtered.sort((a, b) => {
							const result = (a.sortKey > b.sortKey) ? 1 : ((b.sortKey > a.sortKey) ? -1 : 0);
							return 0 != result ? result : (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
						}));
					})
					.catch(reject);
			});
		}
		const result = this.listGrains(id, [{
			field: 'SortKey',
			order: 'Asc'
		}, {
			field: 'Name',
			order: 'Asc'
		}], false, typeFilter);
		result.then(list => {
			if (this.#grains[id] && !typeFilter) {
				this.#grains[id]._listed = 1;
			}
		}).catch(NoOp);
		return result;
	}

	listGrains(parentOrId, sortOptions = null, recursive = false, typeFilter = null, idFilter = null) {
		const params = new URLSearchParams();
		if (sortOptions) {
			sortOptions.forEach(item => {
				params.append('sortOptions', JSON.stringify(item));
			});
		}
		if (typeFilter) {
			typeFilter.forEach(filter => {
				params.append('typeFilter', filter);
			});
		}
		if (idFilter) {
			idFilter.forEach(filter => {
				params.append('idFilter', filter);
			});
		}
		if (recursive) {
			params.set('recursive', true);
		}
		this.addLangParam(params);
		const result = this.#fetchGet(`${this.baseUrl}/Grain/${parentOrId.id || parentOrId}/List?${params}`);
		result.then(list => {
			list.forEach(element => {
				this.#addGrainToCache(element);
			})
		}).catch(NoOp);
		return result;
	}

	verifyGrainsExist(grainIds) {
		return this.#fetchSendJson(`${this.baseUrl}/Grain/VerifyExist`, grainIds);
	}

	getGrainPropDefs(grain) {
		return this.getTypePropDefs(grain.typeDefId);
	}

	getGrainTraits(grain) {
		let url = `${this.baseUrl}/Grain/${grain.id || grain}/Traits`;
		const lang = this.#lang || grain.culture;
		if (lang) {
			const params = new URLSearchParams();
			params.set('lang', lang);
			url += `?${params}`;
		}
		return this.#fetchGet(url);
	}

	getGrainLabels(grainOrId, langCodes = undefined) {
		let url = `${this.baseUrl}/Grain/${grainOrId.id || grainOrId}/Labels`;
		if (langCodes && langCodes.length) {
			const params = new URLSearchParams();
			langCodes.forEach((lang) => {
				params.append('lang', lang);
			});
			url += `?${params}`;
		}
		return this.#fetchGet(url);
	}

	getTypePropDefs(typeDefOrId) {
		return this.#fetchGet(this.localizeUrl(`${this.baseUrl}/TypeDef/${(typeDefOrId || {}).id || typeDefOrId || MarBasDefaults.ID_TYPE_TYPEDEF}/Properties`));
	}

	getTraitValues(grain, propDefOrId) {
		const params = new URLSearchParams();
		params.set('revision', grain.revision);
		params.set('lang', this.#lang || grain.culture);
		return this.#fetchGet(`${this.baseUrl}/Trait/Values/${grain.id}/${propDefOrId.id || propDefOrId}?${params}`);
	}

	storeTraitValues(grain, propDef, values, langOverride = null) {
		return new Promise((resolve, reject) => {
			let reqFinish = (req) => {
				req.then(res => {
					if (res.ok) {
						return res.json();
					}
					return DataBrokerAPI.analyzeFetchErr(res);
				}).then(json => {
					DataBrokerAPI.completeRequest(json, resolve, reject, false);
				}).catch(reject);
			};
			if (0 == values.length) {
				const params = new URLSearchParams();
				params.set('revision', grain.revision);
				if (propDef.localizable) {
					params.set('lang', langOverride || this.#lang || grain.culture);
				}
				this.applyStdFetchOptions({ method: 'DELETE' }).then(opts => {
					const req = fetch(`${this.baseUrl}/Trait/Values/${grain.id}/${propDef.id}?${params}`, opts);
					reqFinish(req);
				}).catch(reject);

			} else {
				this.applyStdFetchOptions({
					method: 'POST',
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						grainId: grain.id,
						propDefId: propDef.id,
						valueType: propDef.valueType,
						culture: propDef.localizable ? langOverride || this.#lang || grain.culture : null,
						revision: grain.revision,
						values: values
					})
				}).then(opts => {
					const req = fetch(`${this.baseUrl}/Trait/Values`, opts);
					reqFinish(req);
				}).catch(reject);
			}
		});
	}

	lookupGrainsByTrait(propDef, value, lang = null, revision = 1, sortOptions = null) {
		const req = {
			propDefId: propDef.id,
			valueType: propDef.valueType,
			value: value
		};
		req.culture = lang || this.#lang;
		if (revision != 1) {
			req.revision = revision;
		}
		if (sortOptions) {
			req.sortOptions = sortOptions;
		}
		const result = this.#fetchSendJson(`${this.baseUrl}/Trait/LookupGrains`, req);
		result.then(list => {
			list.forEach(element => {
				this.#addGrainToCache(element);
			})
		}).catch(NoOp);
		return result;
	}

	getTypeDefTierName(typeDefId) {
		// TODO call /api/marbas/TypeDef/{id}/Tier when implemented
		const result = (() => {
			switch (typeDefId) {
				case MarBasDefaults.ID_TYPE_FILE:
					return MarBasDefaults.TIER_FILE;
				case MarBasDefaults.ID_TYPE_PROPDEF:
					return MarBasDefaults.TIER_PROPDEF;
				case MarBasDefaults.ID_TYPE_TYPEDEF:
				case null:
					return MarBasDefaults.TIER_TYPEDEF;
			}
			return null;
		})();
		if (!result) {
			return new Promise((resolve, reject) => {
				this.#fetchGet(`${this.baseUrl}/TypeDef/${typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF}/Tier`)
					.then(resolve)
					.catch(reject);
			});
		}
		return Promise.resolve(result);
	}

	getGrainTierName(grainOrId) {
		const isGrain = grainOrId.id && "typeDefId" in grainOrId;
		if (isGrain && "_tier" in grainOrId) {
			return Promise.resolve(grainOrId._tier);
		}
		return new Promise((resolve, reject) => {
			const apiCall = () => {
				this.#fetchGet(`${this.baseUrl}/Grain/${grainOrId.id || grainOrId}/Tier`).then(tier => {
					if (isGrain) {
						grainOrId._tier = tier;
					}
					resolve(tier);
				}).catch(reject);
			};
			if (isGrain) {
				this.getTypeDefTierName(grainOrId.typeDefId).then(tier => {
					if (tier) {
						grainOrId._tier = tier;
						resolve(tier);
						return;
					}
					apiCall();
				}).catch(reject);
			} else {
				apiCall();
			}
		});
	}

	resolveGrainTier(grain) {
		if (2 == grain._resolved) {
			return Promise.resolve(grain);
		}
		return new Promise((resolve, reject) => {
			this.getGrainTierName(grain).then(tier => {
				const typeRes = this.#resolvers[tier];
				if (!typeRes) {
					grain._resolved = 2;
					resolve(grain);
					return;
				}
				if (!typeRes[grain.id] || !typeRes[grain.id]._fulfilled) {
					typeRes[grain.id] = new Promise((resolve, reject) => {
						grain._resolved = 1;
						this.#fetchGet(`${this.baseUrl}/${tierNameToRoute(tier)}/${grain.id}?lang=${this.#lang || grain.culture}`)
							.then(value => {
								value._resolved = 2;
								if (value.mixInIds) {
									value.mixInIds.forEach(typeId => {
										this.#registerSubtype(grain.id, typeId);
									});
								}
								resolve(merge(grain, value));
							})
							.catch(reject);
					});
				}
				typeRes[grain.id].then(() => {
					typeRes[grain.id]._fulfilled = true;
					resolve(typeRes[grain.id]);
				}).catch(NoOp);

			}).catch(reject);
		});
	}

	isGrainInstanceOf(grainOrId, baseTypeId) {
		const bases = 'object' == typeof baseTypeId && 'push' in baseTypeId ? baseTypeId : [baseTypeId];
		const id = grainOrId.id || grainOrId;
		const grain = grainOrId.id ? grainOrId : this.#grains[id];
		let result = false;
		const pending = [];
		for (const base of bases) {
			if (result) {
				break;
			}
			if (grain && grain.typeDefId == base) {
				result = true;
				break;
			}
			if (MarBasDefaults.ID_TYPE_TYPEDEF == base && grain.id) {
				result = !grain.typeDefId;
				continue;
			}
			if (grain) {
				const reg = this.#isRegisteredSubtype(grain.typeDefId, base);
				if (undefined !== reg) {
					result = reg;
					continue;
				}
			}
			const resp = this.#fetchGet(`${this.baseUrl}/Grain/${id}/InstanceOf/${base}`);
			pending.push(resp);
			resp.then(value => {
				if (value) {
					result = true;
				}
				if (grain && grain.typeDefId) {
					this.#registerSubtype(grain.typeDefId, base, value);
				}
			}).catch(NoOp);
		}

		return new Promise((resolve, reject) => {
			Promise.all(pending).then(() => resolve(result)).catch(reject);
		});
	}

	getGrainPermission(grainOrId, desiredAccess) {
		return new Promise((resolve, reject) => {
			const resolver = (grain) => {
				resolve(desiredAccess == (grain.permissions & desiredAccess));
			};
			if (grainOrId.id) {
				resolver(grainOrId);
			} else {
				this.getGrain(grainOrId).then(grain => {
					resolver(grain);
				}).catch(reject);
			}
		});
	}

	getGrainAcl(grainOrId) {
		return this.#fetchGet(`${this.baseUrl}/Grain/${grainOrId.id || grainOrId}/Acl`);
	}

	storeAclEntry(entry) {
		this.invalidateGrain(entry.grainId, true);
		return this.#fetchSendJson(`${this.baseUrl}/Acl`, entry);
	}

	createAclEntry(entry) {
		this.invalidateGrain(entry.grainId, true);
		return this.#fetchSendJson(`${this.baseUrl}/Acl`, entry, true, 'PUT');
	}

	deleteAclEntry(grainId, roleId) {
		const inv = this.invalidateGrain(grainId, true);
		return new Promise((resolve, reject) => {
			this.applyStdFetchOptions({ method: 'DELETE' }).then(opts => {
				fetch(`${this.baseUrl}/Acl/${roleId}/${grainId}`, opts)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, (success) => {
							inv.then(() => {
								resolve(success);
							}).catch(() => resolve(false));
						}, reject, false);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	getGrainPath(grainOrId, includeSelf = false) {
		const id = grainOrId.id || grainOrId;
		return new Promise((resolve, reject) => {
			let fromcache = [];
			let grain = this.#grains[id];
			while (grain) {
				if (includeSelf || grain.id != id) {
					fromcache.push(grain);
				}
				if (!grain.parentId) {
					resolve(fromcache);
					return;
				}
				grain = this.#grains[grain.parentId];
			}

			let url = `${this.baseUrl}/Grain/${id}/Path`;
			if (includeSelf) {
				url += `?includeSelf=true`
			}
			this.#fetchGet(url)
				.then(grains => {
					if (grains && grains.forEach) {
						grains.forEach((g => {
							this.#addGrainToCache(g);
						}));
					}
					resolve(grains);
				})
				.catch(reject);
		});
	}

	isGrainDescendantOf(grainOrId, ancestorOrId) {
		return new Promise((resolve) => {
			if (grainOrId.path && ancestorOrId.path) {
				resolve(grainOrId.path.startsWith(`${ancestorOrId.path}/`));
				return;
			}
			this.getGrainPath(grainOrId)
				.then(path => {
					resolve(path.some(item => {
						return ancestorOrId && item.id == (ancestorOrId.id || ancestorOrId);
					}));
				})
				.catch(() => resolve(false));
		});
	}

	getOrCreateTypeDefDefaults(typeDefOrId) {
		const id = (typeDefOrId.id || typeDefOrId);
		return new Promise((resolve, reject) => {
			this.#fetchGet(`${this.baseUrl}/TypeDef/${id}/Defaults`)
				.then(grain => {
					const typeDef = this.#grains[id];
					if (typeDef) {
						typeDef.defaultInstanceId = grain.id;
					}
					if (typeDefOrId.id) {
						typeDefOrId.defaultInstanceId = grain.id;
					}
					resolve(grain);
				})
				.catch(reject);
		});
	}

	invalidateGrain(grainOrId, recursive = false) {
		const id = grainOrId.id || grainOrId;
		this.#unregisterSubtypes(id);
		if (this.#grains[id]) {
			if (recursive && MarBasDefaults.ID_ROOT == id) {
				this.#grains = {};
				this.#resolvers = {
					[MarBasDefaults.TIER_FILE]: {},
					[MarBasDefaults.TIER_PROPDEF]: {},
					[MarBasDefaults.TIER_TYPEDEF]: {}
				};
				this.#subtypes = {};
				return Promise.resolve(id);
			}
			return new Promise((resolve, reject) => {
				for (const tier in this.#resolvers) {
					if (this.#resolvers[tier] && this.#resolvers[tier][id]) {
						delete this.#resolvers[tier][id];
						break;
					}
				}
				const results = [Promise.resolve(id)];
				if (recursive && this.#grains[id]._listed) {
					for (const key in this.#grains) {
						if (this.#grains[key].parentId == id) {
							results.push(this.invalidateGrain(this.#grains[key], recursive));
						}
					}
				}
				delete this.#grains[id];
				Promise.all(results).then(resolve(id)).catch(reject);
			});
		}
		return Promise.resolve(id);
	}

	createFile(formData) {
		const parentId = formData.get('ParentId');
		return new Promise((resolve, reject) => {
			const inv = this.invalidateGrain(parentId, true);
			this.applyStdFetchOptions({
				method: 'PUT',
				body: formData
			}).then(opts => {
				fetch(`${this.baseUrl}/File`, opts)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, (grain) => {
							inv.then(() => {
								resolve(this.#addGrainToCache(grain));
							}).catch(() => resolve(grain));

						}, reject);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	uploadFile(grainOrId, file) {
		const id = grainOrId.id || grainOrId;
		return new Promise((resolve, reject) => {
			const data = new FormData();
			data.append('File', file);
			this.applyStdFetchOptions({
				method: 'POST',
				body: data
			}).then(opts => {
				fetch(`${this.baseUrl}/File/${id}`, opts)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, resolve, reject);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	loadFileBlob(grainOrId, disposition = 'Attachment', acceptType = /.*/, maxSize = 10 * 1024 * 1024) {
		return this.loadBlob(`${this.baseUrl}/File/${grainOrId.id || grainOrId}/${disposition}`, acceptType, maxSize, true);
	}

	loadBlob(url, acceptType = /.*/, maxSize = 30 * 1024 * 1024, forDownload = false) {
		return new Promise((resolve, reject) => {
			if (-1 < this.#rejects.indexOf(url)) {
				reject(`Response from ${url} doesn't match criteria`);
				return;
			}
			this.applyStdFetchOptions().then(opts => {
				let filename;
				fetch(url, opts)
					.then(res => {
						if (res.ok) {
							const size = res.headers.get('Content-Length');
							const type = res.headers.get('Content-Type');
							if (size >= maxSize || !acceptType.test(type)) {
								this.#rejects.push(url);
								reject(`Response ${type} of ${size} bytes from ${url} doesn't match criteria`);
								return null;
							}
							if (true === forDownload) {
								const disposition = res.headers.get('Content-Disposition');
								if (disposition) {
									filename = contentDisposition.parse(disposition).parameters.filename;
								}
							} else if (forDownload && forDownload.length) {
								filename = forDownload;
							}
							return res.blob();
						}

						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(blob => {
						if (blob) {
							if (blob.error) {
								reject(blob.error);
							} else {
								resolve(filename ? new File([blob], filename) : blob);
							}
						} else {
							reject(`Response from ${url} contained no data`);
						}
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	exportPackage(exportOptions) {
		return new Promise((resolve, reject) => {
			this.applyStdFetchOptions({
				method: 'POST',
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(exportOptions)
			}).then(opts => {
				let filename = `${(exportOptions.namePrefix || "marbas-export-")}${Date.now()}.zip`;
				fetch(`${this.baseUrl}/Transport/PackageOut`, opts)
					.then(res => {
						if (res.ok) {
							const disposition = res.headers.get('Content-Disposition');
							if (disposition) {
								filename = contentDisposition.parse(disposition).parameters.filename || filename;
							}
							return res.blob();
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then((blob) => {
						if (blob) {
							if (blob.error) {
								reject(blob.error);
							} else {
								resolve(new File([blob], filename));
							}
						}
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	importPackage(formData, pollingInterval = 0, progressCallback = null, abortAfter = 0) {
		return new Promise((resolve, reject) => {
			this.applyStdFetchOptions({
				method: 'PUT',
				body: formData
			}).then(opts => {
				fetch(`${this.baseUrl}/Transport/PackageIn`, opts)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, (job) => {
							if (progressCallback && 1 > pollingInterval) {
								pollingInterval = 500;
							}
							if (0 < pollingInterval) {
								const jobId = job.id;
								let abort = false;
								if (progressCallback) {
									abort = !progressCallback(job);
								}
								if (abort) {
									this.deleteBackgroundJob(jobId, true)
										.then(resolve).catch(reject);

								} else {
									const ih = setInterval(() => {
										this.getBackgroundJob(jobId, true)
											.then(job => {
												if (BackgroundJobStatus.Complete <= BackgroundJobStatus[job.status]) {
													clearInterval(ih);
													resolve(job);
												} else {
													if (progressCallback) {
														abort = !progressCallback(job);
													}
													if (abort) {
														clearInterval(ih);
														this.deleteBackgroundJob(jobId, true)
															.then(resolve).catch(reject);
													}
												}
											})
											.catch(err => {
												clearInterval(ih);
												reject(err);
											});
									}, pollingInterval);
								}
							} else {
								resolve(job);
							}

						}, reject);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	getBackgroundJob(id, autoRemoveInactive = false) {
		let url = `${this.baseUrl}/BackgroundJob/${id}`;
		if (autoRemoveInactive) {
			url += '?autoRemove=true';
		}
		return this.#fetchGet(url);
	}

	deleteBackgroundJob(id, cancel = false) {
		return new Promise((resolve, reject) => {
			this.applyStdFetchOptions({ method: 'DELETE' }).then(opts => {
				let url = `${this.baseUrl}/BackgroundJob/${id}`;
				if (cancel) {
					url += '?cancel=true';
				}
				fetch(url, opts)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, resolve, reject);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	#addGrainToCache(grain) {
		grain._ts = Date.now();
		this.#grains[grain.id] = grain;
		return grain;
	}

	#isRegisteredSubtype(typeDefId, baseTypeId) {
		return this.#subtypes[baseTypeId] ? this.#subtypes[baseTypeId][typeDefId] : undefined;
	}

	#registerSubtype(typeDefId, baseTypeId, isSubtype = true) {
		if (!this.#subtypes[baseTypeId]) {
			this.#subtypes[baseTypeId] = {};
		}
		this.#subtypes[baseTypeId][typeDefId] = isSubtype;
	}

	#unregisterSubtypes(baseTypeId) {
		delete this.#subtypes[baseTypeId];
	}

	#fetchGet(url, statusHandler = null) {
		return new Promise((resolve, reject) => {
			this.applyStdFetchOptions().then(opts => {
				fetch(url, opts)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						if (statusHandler) {
							const sim = statusHandler(res);
							if (sim) {
								return { success: true, yield: sim };
							}
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, resolve, reject);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	#fetchSendJson(url, data = null, returnYield = true, verb = 'POST', statusHandler = null) {
		return new Promise((resolve, reject) => {
			const opts = {
				method: verb,
				headers: {
					"Content-Type": "application/json"
				}
			};
			if (data) {
				opts.body = JSON.stringify(data);
			}
			this.applyStdFetchOptions(opts).then(req => {
				fetch(`${url}`, req)
					.then(res => {
						if (res.ok) {
							return res.json();
						}
						if (statusHandler) {
							const sim = statusHandler(res);
							if (sim) {
								return { success: true, yield: sim };
							}
						}
						return DataBrokerAPI.analyzeFetchErr(res);
					})
					.then(json => {
						DataBrokerAPI.completeRequest(json, resolve, reject, returnYield);
					})
					.catch(reject);
			}).catch(reject);
		});
	}

	applyStdFetchOptions(options) {
		let result = {
			withCredentials: true,
			credentials: 'include'
		};
		if (options) {
			result = merge({}, result, options);
		}
		return this.#authModule.authorizeRequest(result);
	}

	addLangParam(searchParams = null) {
		let result = searchParams;
		if (this.#lang) {
			if (!result) {
				result = new URLSearchParams();
			}
			result.set('lang', this.#lang);
		}
		return result;
	}

	localizeUrl(url) {
		const params = this.addLangParam();
		if (params) {
			url += `?${params}`;
		}
		return url;
	}

	static completeRequest(respBody, resolve, reject, returnYield = true) {
		if (respBody.error) {
			reject(respBody.error);
		} else if (!returnYield) {
			resolve(respBody.success);
		} else if (respBody.success) {
			resolve(respBody.yield);
		} else {
			reject(FETCH_YIELD_FAILMSG);
		}
	}

	static analyzeFetchErr(res) {
		const result = { success: false };
		if (!res.statusText && res.body) {
			return new Promise(resolve => {
				res.json().then(json => {
					result.error = DataBrokerAPI.makeFetchErr(res, json.detail || json.title);
					resolve(result);
				}).catch(NoOp);
			});
		}
		result.error = DataBrokerAPI.makeFetchErr(res);
		return Promise.resolve(result);
	}

	static makeFetchErr(res, text) {
		if (res.statusText) {
			text = res.statusText;
		}
		return `Request to ${res.url} failed (code: ${res.status}${(text ? `, message: ${text}` : '')})`
	}
}