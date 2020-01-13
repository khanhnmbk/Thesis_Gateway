var mongoose = require('mongoose');
var async = require('async');
var color = require('colors');
var Schema = mongoose.Schema;
mongoose.Promise = global.Promise; //Error if not declared

//Schema
var alarmSchema = new Schema({
    deviceID: String,
    source: String,
    value: Number,
    message: String,
    type : String,
    state : String,
    timestamp : String
}, { collection: 'alarm' });

var alarmModel = mongoose.model('alarm', alarmSchema);

function createNewLog(model) {
    model.save();
    console.log('Save alarm log successfully' .cyan);
}

module.exports.alarmModel = alarmModel;
module.exports.createNewLog = createNewLog;