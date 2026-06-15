
import { t } from "ttag";
import { default as BSTreeViewTemplate } from "@jbtronics/bs-treeview/build/module/lib/BSTreeViewTemplate"
(function () {
	const origNode = BSTreeViewTemplate.node;
	origNode.setAttribute('tabindex', '0');
	BSTreeViewTemplate.node = origNode;
})();
import { BSTreeView, BSTreeViewNode, BS5Theme, EVENT_INITIALIZED, EVENT_NODE_EXPANDED, EVENT_NODE_SELECTED, EVENT_RENDERED } from "@jbtronics/bs-treeview";

import { GrainXAttrs } from "./cmn/GrainXAttrs";
import { Task } from "./cmn/Task";
import { MarBasDefaults } from "@crafted.solutions/marbas-core";

export class SiloTree {
	_element;
	_apiSvc;
	_seed;
	_scope;
	_listeners = {};
	_options = {};
	_branchLoader = async (grain, apiSvc, options) => {
		return 0 < grain.childCount ? await apiSvc.listGrainChildren(grain, false, options.typeFilter) : [];
	}

	constructor(elementId, apiSvc, rootNodes, initCallback = null, options = null, branchLoader = null) {
		this._initPromise = new Promise(resolve => this._initialized = resolve);
		this._scope = elementId;
		this._element = document.getElementById(elementId);
		this._element.classList.add('silo-tree');
		this._apiSvc = apiSvc;
		this._seed = rootNodes;
		if (options) {
			this._options = options;
		}
		if ('function' == typeof branchLoader) {
			this._branchLoader = branchLoader;
		}
		if (rootNodes) {
			this.render(rootNodes, initCallback);
		}
	}

	render(rootNodes, initCallback = null) {
		this.tree = new BSTreeView(this._element, {
			data: rootNodes,
			nodeIcon: 'bi-file',
			expandIcon: 'text-secondary bi-caret-right-fill',
			collapseIcon: 'text-secondary bi-caret-down-fill',
			emptyIcon: 'bi-square bi-blank',
			loadingIcon: 'bi-hourglass-split',
			showIcon: true,
			showTags: true,
			tagsClass: 'badge bg-secondary ms-1',
			wrapNodeText: true,
			showBorder: true,
			// showCheckbox: true,
			// checkboxFirst: true,
			// checkedIcon: 'bi-check-square',
			// uncheckedIcon: 'bi-square',
			lazyLoad: async (node, renderer) => this._loadNodeChildren(node, renderer)
		}, [BS5Theme]);

		this._element.addEventListener(EVENT_INITIALIZED, (event) => {
			if (initCallback) {
				initCallback();
			}
			this._initialized(true);
		});
		this._element.addEventListener(EVENT_NODE_EXPANDED, (evt) => {
			evt.target.scrollIntoView(true);
		});

		for (const key in this._listeners) {
			this._listeners[key].forEach(listener => {
				this._element.addEventListener(key, listener);
			});
		}
		this._element.addEventListener('focusin', (evt) => {
			if (evt.target && evt.target.classList.contains(`node-${this._element.id}`)) {
				this._focusedNode = evt.target;
			}
		});
		this._element.addEventListener('focusout', (evt) => {
			if (evt.target == this._focusedNode) {
				this._clearFocus();
			}
			if (evt.relatedTarget && evt.relatedTarget.classList.contains(`node-${this._element.id}`)) {
				this._focusedNode = evt.relatedTarget;
			}
		});
		this._element.addEventListener('keydown', (evt) => {
			this._onKeyDown(evt);
		});
	}

	get initialized() {
		return this._initPromise;
	}

	destroy() {
		if (this.tree) {
			this.tree.remove();
		}
		const fresh = this._element.cloneNode(false);
		const parent = this._element.parentNode;
		parent.replaceChild(fresh, this._element);
	}

	async reset() {
		if (this._seed[0].dataAttr) {
			await this._apiSvc.invalidateGrain(this._seed[0].dataAttr.grain, true);
		}
		this.tree.updateNode(this.tree.getRootNodes()[0], BSTreeViewNode.fromData(this._seed[0], this.tree));
	}

	addEventListener(evtType, listener) {
		if (!this._listeners[evtType]) {
			this._listeners[evtType] = [];
		}
		this._listeners[evtType].push(listener);
		this._element.addEventListener(evtType, listener);
	}

	updateNode(grain) {
		const node = this.getNodeByGrain(grain);
		if (node) {
			this._getNodeProperties(grain, node).then(() => {
				this.tree.updateNode(node, node);
			}).catch(console.warn);
		}
	}

	get hasFocus() {
		return !!this._focusedNode;
	}

	getNodeByGrain(grainOrId) {
		const nodes = this.tree.findNodes(`${this._scope}-${(grainOrId || {}).id || grainOrId}`, 'id');
		return nodes.length ? nodes[0] : null;
	}

	isNodeSelected(grainOrId) {
		const node = this.getNodeByGrain(grainOrId.id || grainOrId);
		return node && node.state && node.state.selected;
	}

	disableNodesByGrain(disabledGrains, enabledPrevious = true) {
		if (enabledPrevious && this._options.disableGrains) {
			this.tree.enableAll();
			this._options.disableGrains = disabledGrains;
		} else if (disabledGrains) {
			if (!this._options.disableGrains) {
				this._options.disableGrains = [];
			}
			this._options.disableGrains.push(...disabledGrains);
		}
		if (this._options.disableGrains) {
			const nodes = this._options.disableGrains.reduce((accu, grain) => {
				const node = this.getNodeByGrain(grain);
				if (node) {
					accu.push(node);
				}
				return accu;
			}, []);
			if (nodes.length) {
				this.tree.disableNode(nodes);
			}
		}
	}

	async reloadNode(grainOrId, restoreSelection = true) {
		const id = grainOrId.id || grainOrId;
		const node = this.getNodeByGrain(id);
		if (node) {
			await this._apiSvc.invalidateGrain(grainOrId, true);

			const wasSelected = restoreSelection && node.state && node.state.selected;
			const grain = await this._apiSvc.getGrain(id, true);
			const data = await this._getNodeProperties(grain);
			data.lazyLoad = 0 < grain.childCount;
			data.state = {
				expanded: false
			}
			const updated = BSTreeViewNode.fromData(data, this.tree);
			this.tree.updateNode(node, updated);
			if (node.isRootNode()) {
				this.tree.expandAll();
			}
			if (wasSelected) {
				this.tree.selectNode(updated);
			}
			return updated;
		}
	}

	async revealAndSelectNode(grain) {
		let node = this.getNodeByGrain(grain);
		let parent = this.getNodeByGrain(grain.parentId);

		const result = new Promise((resolve, reject) => {
			this._element.addEventListener(EVENT_NODE_SELECTED, (evt) => {
				this._afterNodeRendered(node, (node) => {
					node._domElement.scrollIntoView();
				});
			}, { once: true });
			this._element.addEventListener(EVENT_NODE_EXPANDED, (evt) => {
				if (evt.detail.node == parent) {
					if (!node) {
						node = this.getNodeByGrain(grain);
					}
					if (node) {
						this.tree.selectNode(node, { silent: true });
						this.tree._triggerEvent(EVENT_NODE_SELECTED, node, { silent: false });
					}
					resolve(node);
				}
			}, { once: true });

			if (node) {
				this.tree.revealNode(node);
				node.setSelected(true);
				resolve(node);
			} else if (parent) {
				this.reloadNode(grain.parentId, false)
					.then(n => {
						parent = n;
						this.tree.expandNode(parent);
					})
					.catch(reason => {
						console.error(reason);
						reject(t`Failed to reload ${grain.parentId} due to: ${reason}`);
					});
			} else {
				resolve(null);
			}
		});

		return await result;
	}

	_afterNodeRendered(node, callback) {
		if (node._domElement) {
			callback(node);
		} else {
			this._element.addEventListener(EVENT_RENDERED, (evt) => {
				setTimeout(() => {
					callback(node);
				}, evt.detail.data.length * 2);
			}, { once: true });

		}

	}

	async _loadNodeChildren(node, renderer) {
		const grainId = (node.dataAttr || {}).grain;
		const flags = MarBasDefaults.ID_ROOT == grainId ? Task.Flag.DEFAULT | Task.Flag.REPORT_START : Task.Flag.REPORT_ERROR | Task.Flag.REPORT_START;
		await Task.nowAsync(t`Loading grains`, async () => {
			const grain = await this._apiSvc.getGrain(grainId);
			await this._getNodeProperties(grain, node);
			let children = await this._branchLoader(grain, this._apiSvc, this._options);
			if (children.length && this._options.listFilter && this._options.listFilter.invoke) {
				children = children.filter(this._options.listFilter.invoke);
			}
			if (children.length) {
				renderer(await Promise.all(children.map(async x => BSTreeViewNode.fromData(await this._getNodeProperties(x), this.tree))));
			} else {
				node.lazyLoad = false;
				if (node.isRootNode()) {
					renderer([], this.tree);
				} else {
					this.tree.updateNode(node, node);
				}
			}
			this._restoreFocus();
			node._domElement.scrollIntoView(true);
		}, flags);
	}

	async _getNodeProperties(grain, node) {
		const result = node || {
			id: `${this._scope}-${grain.id}`,
			lazyLoad: 0 < grain.childCount
		};
		result.selectable = !this._options.selectableTypes || await this._apiSvc.isGrainInstanceOf(grain, this._options.selectableTypes);
		if (this._options.disableGrains && -1 < this._options.disableGrains.indexOf(grain.id)) {
			result.state = {
				disabled: true
			}
		}
		const isLink = await this._apiSvc.isGrainInstanceOf(grain, MarBasDefaults.ID_TYPE_LINK);
		if (isLink && (!result['class'] || !result['class'].match(/\bnode-link\b/))) {
			if (result['class']) {
				result['class'] += " node-link";
			} else {
				result['class'] = "node-link";
			}
		}

		result.text = grain.label;
		result.tooltip = `${grain.label} (${grain.typeName || 'Type'})`;
		result.icon = grain.icon || GrainXAttrs.getGrainIcon(grain);
		if (!result.dataAttr) {
			result.dataAttr = {};
		}
		result.dataAttr.grain = grain.id;
		return result;
	}

	_updateNodeTags(tag, node, remove = false) {
		const i = node.tags && node.tags.length ? node.tags.findIndex((value) => value['data-tag'] == tag['data-tag']) : -2;
		if (remove) {
			if (-1 < i) {
				node.tags.splice(i, 1);
			}
		} else {
			if (-2 == i) {
				node.tags = [tag];
			} else if (-1 == i) {
				node.tags[i] == tag;
			} else {
				node.tags.push(tag);
			}
		}
		return node;
	}

	_getGrainIdFor(evtOrElm) {
		if (!evtOrElm) {
			return undefined;
		}
		const elm = (evtOrElm.target || evtOrElm).closest('[data-grain]');
		if (elm) {
			return elm.getAttribute('data-grain');
		}
		return undefined;
	}

	_onKeyDown(evt) {
		const key = evt.key || evt.keyCode;
		let handled = false;
		switch (key) {
			case 'ArrowLeft':
			case '37':
				this._collapseActiveNode();
				handled = true;
				break;
			case 'ArrowRight':
			case '39':
				this._expandActiveNode();
				handled = true;
				break;
			case 'ArrowUp':
			case '38':
				this._moveNodeFocus(-1);
				handled = true;
				break;
			case 'ArrowDown':
			case '40':
				this._moveNodeFocus(1);
				handled = true;
				break;
			case ' ':
			case '32':
				this._selectActiveNode();
				handled = true;
				break;
		}
		if (handled) {
			evt.preventDefault();
			evt.stopPropagation();
		}
	}

	_expandActiveNode() {
		const active = this._getActiveNodes();
		if (active.length) {
			this.tree.expandNode(active, { levels: 1 });
		}
	}

	_collapseActiveNode() {
		const active = this._getActiveNodes();
		if (active.length) {
			this.tree.collapseNode(active);
		}
	}

	_selectActiveNode() {
		const active = this._getActiveNodes(true);
		if (active.length) {
			this.tree.selectNode(active);
		}
	}

	_getActiveNodes(onlyFocused = false) {
		let result = [];
		if (this._focusedNode) {
			result = this.tree.findNodes(this._focusedNode.id, 'id');
		}
		if (!onlyFocused && 0 == result.length) {
			result = this.tree.getSelected();
		}
		return result;
	}

	_moveNodeFocus(direction) {
		const candidates = { orig: null, focus: null };
		const elms = this._element.querySelectorAll(`.node-${this._element.id}`);
		elms.forEach((elm) => {
			if (elm == this._focusedNode || (!this._focusedNode && elm.classList.contains('node-selected'))) {
				candidates.orig = elm;
			} else if (elm.offsetParent && ((0 > direction && !candidates.orig) || (0 < direction && candidates.orig && !candidates.focus))) {
				candidates.focus = elm;
			}
		});
		if (!candidates.focus && !candidates.orig) {
			this._focusedNode = this._element.querySelector(`.node-${this._element.id}`);
		}
		if (candidates.focus) {
			this._focusedNode = candidates.focus;
		}
		if (this._focusedNode) {
			this._focusedNode.focus();
		}
	}

	_clearFocus() {
		if (this._focusedNode) {
			delete this._focusedNode;
		}
	}

	_restoreFocus(node = null) {
		setTimeout(() => {
			if (node) {
				this._focusedNode = node;
			}
			if (this._focusedNode) {
				this._focusedNode.focus();
			}
		}, 100);
	}
}