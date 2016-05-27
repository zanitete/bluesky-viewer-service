# bluesky-viewer-service
A service to register (and deploy?) collaboratory viewers 

### Run locally
set MONGODB_PWD env var
```
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