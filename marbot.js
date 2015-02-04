(function() {
    "use strict";

    var config = {
	   channels: ["#blacklight_test"],
	   server: "irc.freenode.net",
	   botName: "marbot",
	   dbName: "marbot.db",
    };

    var tableNames = {
	   Server  : "marbot_server",
	   Channel : "marbot_channel",
	   Message : "marbot_message",
    };

    var serversMap = {};
    var channelsMap = {};

    var irc = require("irc");
    var sqlite = require("sqlite3");

    var init = function() {
	   initDb();
    };

    var initDb = function() {
	   var db = new sqlite.Database(config.dbName);

	   db.run('CREATE TABLE IF NOT EXISTS ' + tableNames.Server + '('
		   + '    id integer PRIMARY KEY AUTOINCREMENT,'
		   + '    name varchar(1024) UNIQUE NOT NULL'
		   + ')');

	   db.run('CREATE TABLE IF NOT EXISTS ' + tableNames.Channel + '('
		   + '    id integer PRIMARY KEY AUTOINCREMENT,'
		   + '    server_id integer NOT NULL,'
		   + '    name varchar(1024) NOT NULL,'
		   + '    UNIQUE(server_id, name),'
		   + '    FOREIGN KEY(server_id) REFERENCES marbot_server(id)'
		   + ')');

	   db.run('CREATE TABLE IF NOT EXISTS ' + tableNames.Message + '('
		   + '    id integer PRIMARY KEY AUTOINCREMENT,'
		   + '    channel_id integer NOT NULL,'
		   + '    nick varchar(255) NOT NULL,'
		   + '    message text NOT NULL,'
		   + '    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,'
		   + '    FOREIGN KEY(channel_id) REFERENCES marbot_channel(id)'
		   + ')');

	   db.run('INSERT OR IGNORE INTO ' + tableNames.Server +
		  '(name) VALUES(?)',
		  { 1: config.server }
	   );

	   db.get('SELECT id FROM ' + tableNames.Server + ' WHERE name = ?', { 1: config.server }, function(err, row) {
		  var serverID = row.id;
		  var i = 0;
		  serversMap[config.server] = serverID;
		  config.channels.forEach(function(channel) {
			 db.run('INSERT OR IGNORE INTO ' + tableNames.Channel +
				'(server_id, name) VALUES(?, ?)',
				{
				    1: serverID,
				    2: channel,
				}
			 );

			 db.get('SELECT id FROM ' + tableNames.Channel + ' WHERE server_id = ? AND name = ?',
				{ 1: serverID, 2: channel },
				function(err, row) {
				    channelsMap[channel] = row.id;
				    i++;

				    if (i === config.channels.length) {
					   initIRC();
				    }
				}
			 );
		  });
	   });

	   db.close();
    };

    var initIRC = function() {
	   var bot = new irc.Client(config.server, config.botName, {
		  channels: config.channels,
		  autoRejoin: true,
	   });

	   bot.addListener("message", function(nick, to, text, message) {
		  if (to === config.botName) {
			 bot.say(nick, nick + ": Please don't speak to me directly");
			 return;
		  }

		  var channelID = channelsMap[to];
		  if (!channelID) {
			 return;
		  }

		  var db = new sqlite.Database(config.dbName);
		  db.run('INSERT OR IGNORE INTO ' + tableNames.Message +
			 '(channel_id, nick, message) VALUES(?, ?, ?)',
			 {
				1: channelID,
				2: nick,
				3: text,
			 }
		  );
		  db.close();
	   });
    };

    init();
}());

