var loggly = require('loggly')
  , fs = require('fs')
  , config = require('./config');

var client = loggly.createClient(config);

var watchStream = function (path, cb) {
	var fd = fs.openSync(path, 'r');
	var pos = fs.fstatSync(fd).size;
	var partial = '';
	fs.watchFile(path, {persistent: true, interval: 1000}, function (curr, prev) {
		if (curr.mtime == prev.mtime) {
			// not a mtime action
			return;
		}
		if (curr.size < pos) {
			pos = 0;
		}
		var chunkLen = curr.size - pos;
		if (0 == chunkLen) {
			// no new data
			return;
		}
		var chunk = new Buffer(chunkLen);
		fs.readSync(fd, chunk, 0, chunkLen, pos);
		if (chunk[chunkLen - 1] == 10/*\n*/) {
			cb(partial + chunk.toString());
			partial = '';
		} else {
			// does not end in \n
			partial += chunk.toString();
		}
		pos += chunk.length;
	});
};

for (var k in config.files) {
	if (!config.files.hasOwnProperty(k)) {
		continue;
	}
	console.log("Watching %s %s", k, config.files[k]);
	(function (k) {
		watchStream(config.files[k], function (str) {
			var isJson;
			var msg;
			try {
				msg = JSON.parse(str);
				msg.__watched_file = k;
				isJson = true;
			} catch (e) {
				msg = str + "(" + k + ")";
				isJson = false;
			}
			client.log(config.input, msg);
		});
	})(k);
}
