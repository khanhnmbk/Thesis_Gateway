var s7 = require('../module/s7_module');
var nodes7 = require('nodes7');
var configFilePath = './config/config.json';
var fs = require('fs');

var dataConfig = fs.readFileSync(configFilePath);

var list = [ 'DB1,X12.2',
  'DB1,X14.0',
  'DB3,R14',
  'DB3,R18',
  'DB3,X26.0',
  'DB3,X26.1',
  'DB4,R14',
  'DB4,R18',
  'DB4,X26.0',
  'DB4,X26.1',
  'DB5,X12.2',
  'DB5,X14.0' ]

  s7.initConnection('test', '192.168.100.152', 102, 0, 1, function(data){
      s7.writeData(data.s7Node, 'DB3,X26.0', true);
  });



  