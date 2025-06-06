# marbas-core
Modules for Javascript clients for accessing [MarBas Databroker](/Crafted-Solutions/marbas-databroker).

## Provided Modules
1. `MarBasDefaults` - basic constants used by the API

	```javascript
	import { MarBasDefaults } from "@crafted.solutions/marbas-core";
	console.log("MarBasDefaults.MinAPIVersion", MarBasDefaults.MinAPIVersion);
	```
 
1. `MarBasBuiltIns` - list of IDs of built-in Grains (subject to limited manipulation)

	```javascript
	import { MarBasBuiltIns } from "@crafted.solutions/marbas-core";
	let id = '00000000-0000-1000-a000-000000000001';
	console.log(id + " is MarBasBuiltIn ", MarBasBuiltIns.includes(id));
	```
1. `MarBasGrainAccessFlag` - enumeration of access flags for a Grain (Grain.permissions)

	```javascript
	import { MarBasGrainAccessFlag } from "@crafted.solutions/marbas-core";
	let permissions = 0x007;
	console.log("permissions have MarBasGrainAccessFlag.Write set", Boolean(MarBasGrainAccessFlag.Write & permissions));
	```
1. `DataBrokerAPI` - wrapper functions for communication with databroker

	```javascript
	import { MarBasBuiltIns, DataBrokerAPI } from "@crafted.solutions/marbas-core";
	let authModule = {
		brokerUrl: 'https://localhost:7277/api/marbas',
		// expected to return a Promise
		authorizeRequest: function(request) {
			const result = request || {};
			if (!result.headers) {
				result.headers = {};
			}
			result.headers.Authorization = 'Basic dXNlcjpwYXNzd29yZA==';
			return Promise.resolve(result);
		}
	};
	let api = new DataBrokerAPI(authModule);
	let grain = await api.getGrain(MarBasBuiltIns.ID_CONTENT);
	console.log("grain[" + MarBasBuiltIns.ID_CONTENT +  "]", grain);
	```
	*Note: all mehtods of `DataBrokerAPI` are asynchronous and return a Promise.*
1. `MbUtils` - miscelanous utility functions used by `DataBrokerAPI`

	```javascript
	import { MbUtils } from "@crafted.solutions/marbas-core";
	let someObj = {
		arr1: []
	};
	MbUtils.pushOrCreate(someObj.arr1, "elment 1 in array 1");
	someObj.arr2 = MbUtils.pushOrCreate(someObj.arr2, "elment 1 in array 2");
	console.log("someObj after manipulation", someObj);
	```
