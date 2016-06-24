function init(app) {
  var debug      = require('debug')('app:apis');
  var express    = require('express');
  var mongoose   = require('mongoose');
  var _          = require('lodash');

  var Viewer  = require('../models/viewer');
  var viewers = require('../util/viewers')(app);

  var nodeModulesBasePath = viewers.basePath;

  // init express router
  var router = express.Router();

  // connect to db hosted by mlab.com
  var mongodbPwd = process.env.MONGODB_PWD;
  mongoose.connect('mongodb://blueskyuser:' + mongodbPwd + '@ds011472.mlab.com:11472/bluesky-viewer-registry');

  var db = mongoose.connection;
  db.on('error', debug.bind(console, 'connection error:'));
  db.once('open', function() {
    debug('we are connected!');
  });

  // install and start servers to serve registered viewers
  Viewer.find(function(err, viewerList) {
    _.forEach(viewerList, function(viewer) {
      var url = viewers.install(viewer);
      viewer.url = url;
      viewer.save();
    });
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
        var viewer = new Viewer();
        viewer.name = req.body.name;
        viewer.mimeType = req.body.mimeType;
        viewer.packageName = req.body.packageName;
        viewer.packageVersion = req.body.packageVersion;

        // try to install npm package
        viewers.install(viewer)
        .then(function(url) {
          viewer.url = url;
          viewer.save(function(err) {
            if (err) {
              throw new Error(err);
            } else {
              res.json(localizeUrl(viewer, req));
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
            res.json(_.map(viewers, function(v) {
              return localizeUrl(v, req);
            }));
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

  router.route('/viewer/:viewer_id')
    .get(function(req, res) {
        Viewer.findById(req.params.viewer_id, function(err, viewer) {
          if (err) {
            res.send(err);
          } else {
            res.json(localizeUrl(viewer));
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

  function localizeUrl(viewer, req) {
    var parsedUrl = viewer.url.replace(viewers.hostVar, req.hostname);
    viewer.url = parsedUrl;
    return viewer;
  }

  return router;
}

module.exports = init;
