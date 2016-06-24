function init(app) {
  var os         = require('os');
  var fs         = require('fs');
  var path       = require('path');
  var _          = require('lodash');
  var request    = require('request');
  var pRequest   = require('request-promise');
  var portfinder = require('portfinder');
  var https      = require('https');
  var Deferred   = require("promised-io/promise").Deferred;
  var targz      = require('tar.gz');
  var uuid       = require('node-uuid');

  var viewersPath = path.join(os.tmpdir(), '/bluesky-viewer-node-modules/');
  var contextPath = '/static';
  var keyPath = 'bin/key.pem';
  var certPath = 'bin/cert.pem';
  var npmUrl = 'http://bbpteam.epfl.ch/repository/npm';
  var hostVar = '$HOSTNAME';
  var baseUrl = 'https://' + hostVar;

  function installViewer(viewer) {
    // get npm package info
    return pRequest({
        uri: npmUrl + '/' +  viewer.packageName + '/' + viewer.packageVersion,
        json: true
      })
      .then(extractTar)
      .then(openPort);
  }

  function extractTar(pkgInfo) {
    var deferred = new Deferred();
    var destPath = path.join(viewersPath, pkgInfo.name, pkgInfo.version);
    var read = request.get(pkgInfo.dist.tarball);

    // write on temp file
    var tmpFile = path.join(os.tmpdir(), uuid.v4() + '.tar.gz');
    var writeTar = fs.createWriteStream(tmpFile);
    writeTar.on('finish', function downloadComplete() {
      // extract tar content
      targz().extract(tmpFile, destPath)
        .then(function() {
          deferred.resolve({
            name: pkgInfo.name,
            version: pkgInfo.version
          });
        })
        .catch(function(err){
          console.log('Something is wrong ', err.stack);
          deferred.reject(err);
        });
    });
    read.pipe(writeTar);

    return deferred.promise;
  }

  function openPort(pkgInfo) {
    var deferred = new Deferred();

    portfinder.getPort(function(err, port) {
      if(!err) {
        app.set('port', port);
        var server = https.createServer({
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath)
        }, app);

        server.listen(port);
        server.on('error', function(e) {
          console.error('Error starting server:', e.stack);
        });
        deferred.resolve(baseUrl + ':' + port
          + path.join(contextPath, pkgInfo.name, pkgInfo.version, 'package/dist'));
      } else {
        console.error('Error finding port:', err.stack);
        deferred.reject('Error finding port');
      }
    });

    return deferred.promise;
  }

  return {
    baseFilePath: viewersPath,
    contextPath: contextPath,
    hostVar: hostVar,
    install: installViewer
  }
}

module.exports = init;
