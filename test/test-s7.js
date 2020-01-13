var s7 = require('../module/s7_module');
var nodes7 = require('nodes7');

var s7Conn;
//var readingList = ['M0.0' , 'MB1', 'MW2', 'MD4', 'DB1,X0.0', 'DB1,B1', 'DB1,I2', 'DB1,R4', 'DB1,S8.254'];

var readingList = ['M0.0' , 'MB1', 'MW2', 'MD4', 'DB1.DBX0.0', 'DB1.DBB1', 'DB1.DBW2', 'DB1.DBD4', 'DB1.DBS8'];
var types = ['Bool' , 'uInt' , 'sInt', 'Double' , 'Bool' , 'sInt' , 'sInt' , 'Double', 'String']
//var readingList = 'MD4'



var arrVar = [];

for (var i = 0; i < readingList.length; i++) {
    arrVar.push( s7.modifyAddress(readingList[i], types[i]))
}

console.log(arrVar);

// var value = 0;
// setInterval(function(){
//     value += 1;
//     s7Conn.writeItems('DB1,R4' , value);
// }, 1000);

// s7.initConnection('S7-1500' , '192.168.100.150', 102, 0, 1 , function(result) {
//     s7Conn = result.s7Node;
//     // s7Conn.addItems(readingList);
//     // s7Conn.readAllItems(function(err,value) {
//     //     console.log(value)
//     // })
//     // s7.initReadingList(s7Conn, arrVar);
//     // s7.readAllData(s7Conn, function(data) {
//     //     console.log(data['M0.0']);
//     // }
// });