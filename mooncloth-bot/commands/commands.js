const readDirFiles = require("read-dir-files");

let commands = [];

readDirFiles.list("commands", function(err, filenames) {
  if (err) return console.dir(err);
  commands = filenames
    .splice(1, filenames.length)
    .map(filename => filename.split("\\")[1])
    .map(filename => filename.split(".")[0])
    .join(", ");
});

exports.command = (bot, user, userID, channelID) => {
  bot.sendMessage({
    to: channelID,
    message: commands
  });
};
