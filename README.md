# bluesky-viewer-service
A service to register and deploy collaboratory viewers.

## Run locally

```
npm install
export MONGODB_PWD=<password_here>
```

start the server:
```
npm start
```

to start wiht debug log enabled:
```
DEBUG=app:* npm start
```

to auto reload on save:
```
npm install supervisor -g
DEBUG=app:* supervisor bin/www
```

The server is available at: https://localhost:3000/

# REST APIs

## POST /v0/api/viewer

Create a new viewer.

Parameters:
* name: name of the viewer
* mimeTye: supported mime-type (can be a regular expression)
* packageName: npm package name
* packageVersion: npm package version

Returns: the created entity

## GET /v0/api/viewer

List available viewers.

Parameters:
* mimeType: mime-type to filter on

Returns: list of viewers

## GET /v0/api/viewer/{viewerId}

Get a viewer details

Return a viewer details:
* id: viewer id
* name: name of the viewer
* mimeTye: supported mime-type (can be a regular expression)
* packageName: npm package name
* packageVersion: npm package version
* url: url where the viewer is deployed

## DELETE /v0/api/viewer/{viewerId}
