const {subscribe} = require("../classes/subscribe");

const commandClass = new subscribe("dota");

exports.help = (bot, user, userID, channelID) => {
  bot.sendMessage({
    to: channelID,
    message: `${commandClass.help()} Subscribe to this command to join the dota train.`
  })
};

exports.command = (bot, user, userID, channelID) => {
  commandClass.command(bot, userID, channelID);
};
