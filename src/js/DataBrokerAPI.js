import merge from "lodash.merge";
import { MarBasDefaults, MarBasRoleEntitlement } from "../conf/marbas.conf";
import { MbUtils } from "./MbUtils";

const ExtenderAPI = {
	[MarBasDefaults.ID_TYPE_PROPDEF]: 'PropDef',
	[MarBasDefaults.ID_TYPE_TYPEDEF]: 'TypeDef'
};

const ResolverAPI = Object.assign({}, ExtenderAPI, {
	[MarBasDefaults.ID_TYPE_FILE]: 'File'
});

export class DataBrokerAPI {
	#baseUrl;
	#lang;
	#authModule;
	#grains = {};
	#subtypes = {};
	#resolvers = {
		[MarBasDefaults.ID_TYPE_FILE]: {},
		[MarBasDefaults.ID_TYPE_PROPDEF]: {},
		[MarBasDefaults.ID_TYPE_TYPEDEF]: {}
	};
	#rejects = [];
	#currentRoles = {
		entitlement: -2
	};

	constructor(authModule, lang = null) {
		this.#authModule = authModule;
		this.#baseUrl = authModule.brokerUrl;
		this.#lang = lang;
	}

	set language(lang) {
		if (this.#lang != lang) {
			this.invalidateGrain(MarBasDefaults.ID_ROOT, true);
			this.#lang = lang;
		}
	}

	get baseUrl() {
		return this.#baseUrl;
	}

	listLanguages() {
		return this.#fetchGet(`${this.#baseUrl}/Language/List`);
	}

	getCurrentRoles() {
		if (this.#currentRoles.roles) {
			return new Promise((resolve) => {
				resolve(this.#currentRoles.roles);
			});
		}
		const result = this.#fetchGet(`${this.#baseUrl}/Role/Current`);
		result.then((roles) => {
			this.#currentRoles.roles = roles;
		});
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
		return this.#fetchGet(`${this.#baseUrl}/Role/List`);
	}

	getRole(roleId) {
		return this.#fetchGet(`${this.#baseUrl}/Role/${roleId}`);
	}

	getLabel(grainOrId) {
		return new Promise((resolve) => {
			if (grainOrId.label) {
				resolve(grainOrId.label);
			} else {
				this.getGrain(grainOrId.id || grainOrId).then(grain => resolve(grain.label));
			}
		});
	}

	getGrain(id = null, ignoreCache = false) {
		const effectiveId = id || MarBasDefaults.ID_ROOT;
		if (!ignoreCache && this.#grains[effectiveId]) {
			return new Promise(resolve => {
				resolve(this.#grains[effectiveId]);
			});
		}
		const result = this.#fetchGet(this.#localizeUrl(`${this.#baseUrl}/Grain/${effectiveId}`)
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
		});
		return result;
	}

	storeGrain(grain) {
		if (grain._siloAttrs && grain._siloAttrsMod) {
			grain.xAttrs = Object.keys(grain._siloAttrs).length ? `"silo":${JSON.stringify(grain._siloAttrs)}` : null;
		}
		if (this.#lang) {
			grain.culture = this.#lang;
		}
		const result = this.#fetchSendJson(`${this.#baseUrl}/${ExtenderAPI[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF] || 'Grain'}`, grain, false);
		result.then(_ => {
			delete grain._siloAttrsMod;
		});
		return result;
	}

	deleteGrain(grain) {
		return new Promise((resolve, reject) => {
			const inv = this.invalidateGrain(grain, true);
			fetch(`${this.#baseUrl}/Grain/${grain.id || grain}`, this.#applyStdFetchOptions({method: 'DELETE'}))
			.then(res => {
				if (res.ok) {
					return res.json();
				}
				reject(`Request failed (${res.status} ${res.statusText})`);
			})
			.then(json => {
				inv.then(() => {
					resolve(json.success);
				});
			})
			.catch(reject);
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

			fetch(`${this.#baseUrl}/${ResolverAPI[typeId || MarBasDefaults.ID_TYPE_TYPEDEF] || 'Grain'}`, this.#applyStdFetchOptions({
				method: 'PUT',
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify(data)
			}))
			.then(res => {
				if (res.ok) {
					return res.json();
				}
				reject(`Request failed (${res.status} ${res.statusText})`);
			})
			.then(json => {
				if (json.success) {
					inv.then(() => {
						resolve(this.#addGrainToCache(json.yield));	
					});
				} else {
					reject("API returned failure");
				}
			})
			.catch(reject);
		});
	}

	moveGrain(grainOrId, newParentOrId) {
		const id = grainOrId.id || grainOrId;
		const parentId = newParentOrId.id || newParentOrId;

		const result = this.#fetchSendJson(`${this.#baseUrl}/Grain/${id}/Move?newParentId=${parentId}`);
		result.then(grain => {
			grain.path = null;
			this.#addGrainToCache(grain);
		});
		return result;
	}

	cloneGrain(grainOrId, newParentOrId = null, depth = 'Recursive') {
		const id = grainOrId.id || grainOrId;
		const result = this.#fetchSendJson(`${this.#baseUrl}/Grain/${id}/Clone`, {
			depth: depth,
			newParentId: newParentOrId.id || newParentOrId
		});
		result.then(grain => {
			grain.path = null;
			this.#addGrainToCache(grain);
		});
		return result;
	}

	listGrainChildren(parent, ignoreCache = false, typeFilter = null) {
		const id = parent.id || parent;
		if (!ignoreCache && this.#grains[id] && this.#grains[id]._listed) {
			return new Promise(resolve => {
				const filtered = [];
				const pending = [];
				for (const key in this.#grains) {
					const g = this.#grains[key];
					if (g.parentId == id) {
						if (typeFilter) {
							pending.push(new Promise(resolve => {
								this.isGrainInstanceOf(g, typeFilter).then(val => {
									if (val) {
										filtered.push(g);
									}
									resolve(val);
								});
							}));
						} else {
							filtered.push(g);
						}
					}
				}
				Promise.all(pending).then(() => {
					resolve(filtered.sort((a, b) => {
						const result = (a.sortKey > b.sortKey) ? 1 : ((b.sortKey > a.sortKey) ? -1 : 0);
						return 0 != result ? result : (a.name > b.name) ? 1 : ((b.name > a.name) ? -1 : 0);
					}));	
				});
			});
		}
		const params = new URLSearchParams();
		params.append('sortOptions', JSON.stringify({
			field: 'SortKey',
			order: 'Asc'
		}));
		params.append('sortOptions', JSON.stringify({
			field: 'Name',
			order: 'Asc'
		}));
		if (typeFilter) {
			typeFilter.forEach(filter => {
				params.append('typeFilter', filter);
			});
		}
		this.#addLangParam(params);
		const result = this.#fetchGet(`${this.#baseUrl}/Grain/${id}/List?${params}`);
		result.then(list => {
			list.forEach(element => {
				this.#addGrainToCache(element);
			})
			if (this.#grains[id] && !typeFilter) {
				this.#grains[id]._listed = 1;
			}
		});
		return result;
	}

	getGrainPropDefs(grain) {
		return this.#fetchGet(this.#localizeUrl(`${this.#baseUrl}/TypeDef/${grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF}/Properties`));
	}

	getGrainTraits(grain) {
		return this.#fetchGet(this.#localizeUrl(`${this.#baseUrl}/Grain/${grain.id || grain}/Traits`));
	}

	getTraitValues(grain, propDefOrId) {
		const params = new URLSearchParams();
		params.set('revision', grain.revision);
		params.set('lang', this.#lang || grain.culture);
		return this.#fetchGet(`${this.baseUrl}/Trait/Values/${grain.id}/${propDefOrId.id || propDefOrId}?${params}`);		
	}

	storeTraitValues(grain, propDef, values) {
		return new Promise((resolve, reject) => {
			let req;
			if (0 == values.length) {
				const params = new URLSearchParams();
				params.set('revision', grain.revision);
				params.set('lang', this.#lang || grain.culture);

				req = fetch(`${this.baseUrl}/Trait/Values/${grain.id}/${propDef.id}?${params}`, this.#applyStdFetchOptions({method: 'DELETE'}));
			} else {
				req = fetch(`${this.#baseUrl}/Trait/Values`, this.#applyStdFetchOptions({
					method: 'POST',
					headers: {
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						grainId: grain.id,
						propDefId: propDef.id,
						valueType: propDef.valueType,
						culture: this.#lang || grain.culture,
						revision: grain.revision,
						values: values
					})
				}));
			}
			req.then(res => {
				if (res.ok) {
					return res.json();
				}
				reject(`Request failed (${res.status} ${res.statusText})`);
			})
			.then(json => {
				resolve(json.success);
			})
			.catch(reject);
		});
	}

	resolveGrainType(grain) {
		const typeRes = this.#resolvers[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF];
		if (2 == grain._resolved || !typeRes) {
			return new Promise((resolve) => {
				grain._resolved = 2;
				resolve(grain);
			})
		}
		if (!typeRes[grain.id]) {
			typeRes[grain.id] = new Promise((resolve, reject) => {
				grain._resolved = 1;
				this.#fetchGet(`${this.#baseUrl}/${ResolverAPI[grain.typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF] || grain.typeName}/${grain.id}?lang=${this.#lang || grain.culture}`)
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
		return Promise.resolve(typeRes[grain.id]);
	}

	isRootGrain(grain) {
		return (grain.id || grain) == MarBasDefaults.ID_ROOT;
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
			pending.push(this.#fetchGet(`${this.#baseUrl}/Grain/${id}/InstanceOf/${base}`)
				.then(value => {
					if (value) {
						result = true;
					}
					if (grain && grain.typeDefId) {
						this.#registerSubtype(grain.typeDefId, base, value);
					}
				}));
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
		return this.#fetchGet(`${this.#baseUrl}/Grain/${grainOrId.id || grainOrId}/Acl`);
	}

	storeAclEntry(entry) {
		this.invalidateGrain(entry.grainId, true);
		return this.#fetchSendJson(`${this.#baseUrl}/Acl`, entry);
	}

	createAclEntry(entry) {
		this.invalidateGrain(entry.grainId, true);
		return this.#fetchSendJson(`${this.#baseUrl}/Acl`, entry, true, 'PUT');
	}

	deleteAclEntry(grainId, roleId) {
		const inv = this.invalidateGrain(grainId, true);
		return new Promise((resolve, reject) => {
			fetch(`${this.#baseUrl}/Acl/${roleId}/${grainId}`, this.#applyStdFetchOptions({method: 'DELETE'}))
			.then(res => {
				if (res.ok) {
					return res.json();
				}
				reject(`Request failed (${res.status} ${res.statusText})`);
			})
			.then(json => {
				inv.then(() => {
					resolve(json.success);
				});
			})
			.catch(reject);
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

			let url = `${this.#baseUrl}/Grain/${id}/Path`;
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
					return path.some(item => {
						return item == ancestorOrId;
					});
				})
				.catch(resolve(false));
		});
	}

	getOrCreateTypeDefDefaults(typeDefOrId) {
		const id = (typeDefOrId.id || typeDefOrId);
		return new Promise((resolve, reject) => {
			this.#fetchGet(`${this.#baseUrl}/TypeDef/${id}/Defaults`)
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
					[MarBasDefaults.ID_TYPE_FILE]: {},
					[MarBasDefaults.ID_TYPE_PROPDEF]: {},
					[MarBasDefaults.ID_TYPE_TYPEDEF]: {}
				};
				this.#subtypes = {};
				return Promise.resolve(id);
			}
			return new Promise((resolve) => {
				const typeId = grainOrId.typeDefId || this.#grains[id].typeDefId || MarBasDefaults.ID_TYPE_TYPEDEF;
				if (typeId && this.#resolvers[typeId] && this.#resolvers[typeId][id]) {
					delete this.#resolvers[typeId][id];
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
				Promise.all(results).then(resolve(id));
			});
		}
		return Promise.resolve(id);
	}

	createFile(formData) {
		const parentId = formData.get('ParentId');
		return new Promise((resolve, reject) => {
			const inv = this.invalidateGrain(parentId, true);
			fetch(`${this.baseUrl}/File`, this.#applyStdFetchOptions({
				method: 'PUT',
				body: formData
			}))
			.then(res => {
				if (res.ok) {
					return res.json();
				}
				reject(`Request failed (${res.status} ${res.statusText})`);
			})
			.then(json => {
				if (json.success) {
					inv.then(() => {
						resolve(this.#addGrainToCache(json.yield));	
					});
				} else {
					reject("API reported failure");
				}
			})
			.catch(reject);			
		});
	}

	uploadFile(grainOrId, file) {
		const id = grainOrId.id || grainOrId;
		return new Promise((resolve, reject) => {
			const data = new FormData();
			data.append('File', file);
			fetch(`${this.baseUrl}/File/${id}`, this.#applyStdFetchOptions({
				method: 'POST',
				body: data
			}))
			.then(res => {
				if (res.ok) {
					return res.json();
				}
				reject(`Request failed (${res.status} ${res.statusText})`);
			})
			.then(json => {
				if (json.success) {
					resolve(json.yield);
				} else {
					reject("API reported failure");
				}
			})
			.catch(reject);
		});
	}

	loadBlob(url, acceptType = /.*/, maxSize = 10*1024*1024) {
		return new Promise((resolve, reject) => {
			if (-1 < this.#rejects.indexOf(url)) {
				reject(`Response from ${url} doesn't match criteria`);
				return;
			}
			fetch(url, this.#applyStdFetchOptions())
			.then(res => {
				if (res.ok) {
					const size = res.headers.get('Content-Length');
					const type = res.headers.get('Content-Type');
					if (size >= maxSize || !acceptType.test(type)) {
						this.#rejects.push(url);
						reject(`Response from ${url} doesn't match criteria`);
						return null;
					}
					return res.blob();
				}
				
				reject(`Request to ${url} failed (${res.status} ${res.statusText})`);
				return null;
			})
			.then(blob => {
				if (blob) {
					resolve(blob);
				}
			});
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
			fetch(url, this.#applyStdFetchOptions())
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
					reject(`Request failed (${res.status} ${res.statusText})`);
				})
				.then(json => {
					if (json.success) {
						resolve(json.yield);
					} else {
						reject("API reported failure");
					}
				})
				.catch(reject);
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
			fetch(`${url}`, this.#applyStdFetchOptions(opts))
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
					reject(`Request failed (${res.status} ${res.statusText})`);
				})
				.then(json => {
					if (!returnYield) {
						resolve(json.success);
					} else if (json.success) {
						resolve(json.yield);
					} else {
						reject("API reported failure");
					}
				})
				.catch(reject);
		});
	}

	#applyStdFetchOptions(options) {
		let result = {
			withCredentials: true,
			credentials: 'include',
			headers: {
				Authorization: `${this.#authModule.authType} ${this.#authModule.authToken}`
			}
		};
		if (options) {
			result = merge({}, result, options);
		}
		return result;
	}

	#addLangParam(searchParams = null) {
		let result = searchParams;
		if (this.#lang) {
			if (!result) {
				result = new URLSearchParams();
			}
			result.set('lang', this.#lang);
		}
		return result;
	}

	#localizeUrl(url) {
		const params = this.#addLangParam();
		if (params) {
			url += `?${params}`;
		}
		return url;
	}
}