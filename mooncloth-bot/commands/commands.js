const fs = require("fs");

const filenames = fs.readdirSync("commands");
const commands = filenames
  .map(filename => filename.split(".")[0])
  .join(", ");

exports.command = (bot, user, userID, channelID) => {
  bot.sendMessage({
    to: channelID,
    message: commands
  });
};
