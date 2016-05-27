var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ViewerSchema   = new Schema({
    name: String,
    mimeType: String,
    packageName: String,
    packageVersion: String,
    url: String
});

module.exports = mongoose.model('Viewer', ViewerSchema);