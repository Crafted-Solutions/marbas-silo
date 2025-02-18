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

## Using Marbas API Module
You can integrate API module [marbas-core](../../pkgs/npm/marbas-core) for databroker access in your own applications. Create a file `.npmrc` (if not present) in your project root directory and add the following
```conf
@crafted-solutions:registry=https://npm.pkg.github.com
```
Install package afterwards
```sh
npm install @crafted-solutions/marbas-core
```

## Contributing
All contributions to development and error fixing are welcome. Please always use `develop` branch for forks and pull requests, `main` is reserved for stable releases and critical vulnarability fixes only. 