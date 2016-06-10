function init(app) {
  var debug      = require('debug')('app:apis');
  var express    = require('express');
  var mongoose   = require('mongoose');
  var request    = require('request');
  var rp         = require('request-promise');
  var extend     = require('extend');
  var os         = require('os');
  var fs         = require('fs');
  var path       = require('path');
  var targz      = require('tar.gz');
  var uuid       = require('node-uuid');
  var Deferred   = require("promised-io/promise").Deferred;

  var Viewer = require('../models/viewer');

  var nodeModulesBasePath = path.join(os.tmpdir(), '/bluesky-viewer-node-modules/');

  // init express router
  var router = express.Router();

  // connect to db hosted by mlab.com
  var mongodbPwd = process.env.MONGODB_PWD;
  mongoose.connect('mongodb://blueskyuser:' + mongodbPwd + '@ds011472.mlab.com:11472/bluesky-viewer-registry');

  function npmUrl(name, version) {
    return 'http://bbpteam.epfl.ch/repository/npm/' + name + '/' + version;
  }
  var db = mongoose.connection;
  db.on('error', debug.bind(console, 'connection error:'));
  db.once('open', function() {
    debug('we are connected!');
  });

  // middleware to use for all requests
  router.use(function(req, res, next) {
      // do logging
      console.log('new request:');
      next(); // make sure we go to the next routes and don't stop here
  });

  router.route('/viewer')

    // register a viewer
    .post(function(req, res) {
        var baseUrl = 'https://localhost';
        var viewer = new Viewer();
        viewer.name = req.body.name;
        viewer.mimeType = req.body.mimeType;
        viewer.packageName = req.body.packageName;
        viewer.packageVersion = req.body.packageVersion;

        // try to install npm package
        rp({
          uri: npmUrl(viewer.packageName, viewer.packageVersion),
          json: true
        })
        .then(extractTar(nodeModulesBasePath))
        .then(addRoute)
        .then(function(pkgInfo) {
          var path = pkgInfo.path;
          var portfinder = require('portfinder');
          var https      = require('https');
          var app    = require('../app');
          var deferred = new Deferred();

          portfinder.getPort(function(err, port) {
            app.set('port', port);
            app.use('/static', express.static(pkgInfo.path));

            var server = https.createServer({
              key: fs.readFileSync('bin/key.pem'),
              cert: fs.readFileSync('bin/cert.pem')
            }, app);

            if(!err) {
              server.listen(port);
              server.on('error', logError);
            } else {
              logError(err);
            }

            deferred.resolve(extend(pkgInfo, {
              url: baseUrl + ':' + port + '/' + pkgInfo.route
            }));
          });

          function logError(err) {
            console.log(error);
          }

          return deferred.promise;
        })
        .then(function(pkgInfo) {
          console.log('save', pkgInfo);
          viewer.url = pkgInfo.url;
          viewer.save(function(err) {
            if (err) {
              throw new Error(err);
            } else {
              res.json(viewer);
            }
          });
        })
        .catch(function(error) {
          console.log('error:', error);
          res.send(error);
        });
    })

    // GET viewers listing.
    .get(function(req, res, next) {
      if(!req.query.mimetype) {
        Viewer.find(function(err, viewers) {
          if (err) {
            res.send(err);
          } else {
            res.json(viewers);
          }
        });
      } else {
        Viewer.find({'mimeType' : new RegExp(req.query.mimetype)}, function(err, docs) {
        if (err) {
          res.send(err);
        } else {
          res.json(docs);
        }
      });
      }
    });


  router.route('/viewer/search')
    .get(function(req, res, next) {

    });

  router.route('/viewer/:viewer_id')

      .get(function(req, res) {
          Viewer.findById(req.params.viewer_id, function(err, viewer) {
            if (err) {
              res.send(err);
            } else {
              res.json(viewer);
            }
        });
      })

      .delete(function(req, res) {
          Viewer.remove({
              _id: req.params.viewer_id
          }, function(err, viewer) {
              if (err)
                  res.send(err);
              res.json();
          });
      });

  function extractTar(basePath) {
    return function(pkgInfo) {
      var deferred = new Deferred();
      var destPath = path.join(basePath, pkgInfo.name, pkgInfo.version);
      var read = request.get(pkgInfo.dist.tarball);

      // write on temp file
      var tmpFile = path.join(os.tmpdir(), uuid.v4() + '.tar.gz');
      var writeTar = fs.createWriteStream(tmpFile);
      writeTar.on('finish', downloadComplete);

      read.pipe(writeTar);

      function downloadComplete() {
        // extract tar content
        targz().extract(tmpFile, destPath)
          .then(function() {
            console.log('Job done!');
            deferred.resolve({
              name: pkgInfo.name,
              version: pkgInfo.version,
              path: path.join(destPath, 'package/dist')
            });
          })
          .catch(function(err){
            console.log('Something is wrong ', err.stack);
            deferred.reject(err);
          });
      }

      return deferred.promise;
    };
  }

  function addRoute(pkgInfo) {
    var route = path.join('static', pkgInfo.name, pkgInfo.version, 'package/dist');
    return extend(pkgInfo, {
      route: route
    });
  }

  return router;
}

module.exports = init;
