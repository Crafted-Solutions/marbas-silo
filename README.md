# marbas-silo
![Tool](https://img.shields.io/badge/Node.js-18,20,22-lightblue?logo=nodedotjs&logoColor=white) [<img src="https://img.shields.io/github/v/release/Crafted-Solutions/marbas-silo" title="Latest">](../../releases/latest)

Schema and content management client for [MarBas Databroker](../../../marbas-databroker).

![Main Workspace](doc/screenshots/workspace.png)

## Building
After you cloned the repository execute in the project directory
```sh
npm install
npm run build --workspaces
npm run build
```
For development (debug) build execute instead of the last command
```sh
npm run build-dev
```
After build is finished all required files can be found in `dist` directory and can be deployed from there to any HTTP server (s.a. [Running Behind HTTP Server](#running-behind-http-server)).

## Running Standalone
Execute in the project directory
```sh
npm start
```
The client app runs in development mode at http://localhost:5500/.

## Running Behind HTTP Server
Download drop-in archive from [Releases](../../releases/latest), extract its contents into a directory (say `marbas-silo`) under public root of your Web server. You should be able then to use the application under `https://yourdomain.example/marbas-silo`.

## Customizing
The most strait forward way to adapt the application to your needs is forking the repository. However, if you are planning to use Silo as drop-in in your HTTP server you can also customize the look and the behavior of the app by providing in-place extensions: create a file named `marbas-silo.ext.js` next to `index.html` in the Silo directory. The File can export on or more exported symbols of the form
```javascript
export <EXTENSION_POINT> = {
	install: function(ctx) {
		...
	}
};
```
or resp.
```javascript
export <EXTENSION_POINT> = {
	installAsync: async function(ctx) {
		...
	}
};
```
`EXTENSION_POINT` can be `GrainEditorStatic` or `GrainEditor` (more to come in the future), for more details s. [basic example](doc/extensions/basic/marbas-silo.ext.js).

To extend / modify styles used int the app create a file `marbas-silo.ext.css` (in the same location as `marbas-silo.ext.js`). The file can contain any CSS instructions you need, s. [basic example](doc/extensions/basic/marbas-silo.ext.css).

*NOTE: even if no customization is required, we recommend creating both files empty in production to prevent errors in the browser console.*

## Using Marbas API Module
You can integrate standalone API module [marbas-core](https://www.npmjs.com/package/@crafted.solutions/marbas-core) for databroker access in your own applications. Install the package like
```sh
npm install @crafted.solutions/marbas-core
```

## Contributing
All contributions to development and error fixing are welcome. Please always use `develop` branch for forks and pull requests, `main` is reserved for stable releases and critical vulnarability fixes only. 