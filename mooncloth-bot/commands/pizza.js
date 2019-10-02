const {subscribe} = require("../classes/subscribe");

const commandClass = new subscribe("pizza");

exports.help = (bot, user, userID, channelID) => {
  bot.sendMessage({
    to: channelID,
    message: `${commandClass.help()} Subscribe to this command to join the pizza train.`
  })
};

exports.command = (bot, user, userID, channelID) => {
  commandClass.command(bot, userID, channelID);
};