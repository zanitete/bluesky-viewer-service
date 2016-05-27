function init(app) {
  var express  = require('express');
  var mongoose = require('mongoose');
  var request  = require('request');
  var rp       = require('request-promise');
  var extend   = require('extend');
  var path     = require('path');
  var targz    = require('tar.gz');

  var Viewer   = require('../models/viewer');

  var nodeModulesBasePath = '/tmp/bluesky-viewer-node-modules/';

  // init express router
  var router = express.Router();

  // connect to db hosted by mlab.com
  var mongodbPwd = process.env.MONGODB_PWD;
  mongoose.connect('mongodb://blueskyuser:' + mongodbPwd + '@ds011472.mlab.com:11472/bluesky-viewer-registry');

  function npmUrl(name, version) {
    return 'http://bbpteam.epfl.ch/repository/npm/' + name + '/' + version;
  }
  // var db = mongoose.connection;
  // db.on('error', console.error.bind(console, 'connection error:'));
  // db.once('open', function() {
  //   console.log('we are connected!');
  // });

  // middleware to use for all requests
  router.use(function(req, res, next) {
      // do logging
      console.log('new request:');
      next(); // make sure we go to the next routes and don't stop here
  });

  router.route('/viewer')
    
    // register a viewer
    .post(function(req, res) {
        var baseUrl = 'http://localhost:3000/';

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
        .then(addRoute(baseUrl))
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
      Viewer.find(function(err, viewers) {
        if (err) {
          res.send(err);
        }
        res.json(viewers);
      });
    });

  router.route('/viewer/:viewer_id')

      .get(function(req, res) {
          Viewer.findById(req.params.viewer_id, function(err, viewer) {
            if (err) {
              res.send(err);
            }
            res.json(viewer);
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
      console.log('extractTar', pkgInfo);
      var destPath = path.join(basePath, pkgInfo.name, pkgInfo.version);
      var read = request.get(pkgInfo.dist.tarball);
      var write = targz().createWriteStream(destPath);
      read.pipe(write);

      return {
        name: pkgInfo.name,
        version: pkgInfo.version,
        path: path.join(destPath, 'package/dist')
      };
    };
  }

  function addRoute(baseUrl) {
    return function(pkgInfo) {
      var route = path.join('static', pkgInfo.name, pkgInfo.version, 'package/dist');
      return extend(pkgInfo, {
        url: baseUrl + route
      });
    };
  }

  return router;
}

module.exports = init;
