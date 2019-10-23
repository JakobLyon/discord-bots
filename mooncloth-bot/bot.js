var Discord = require("discord.io");
var logger = require("winston");
var auth = require("./auth.json");
const { NOT_A_RECOGNIZED_COMMAND } = require("./constants");

const fs = require("fs");

let commands = {};

const filenames = fs.readdirSync("commands");
  
const trimmedFilenames = filenames
  .map(filename => filename.split(".")[0]);
commands = trimmedFilenames.reduce((acc, cur) => {
  const { command, help } = require(`./commands/${cur}`);
  return {
    ...acc,
    [cur]: command,
    [`${cur}Help`]: help
  };
}, {});

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true
});
logger.level = "debug";

// Initialize Discord Bot
const bot = new Discord.Client({
  token: auth.token,
  autorun: true
});
bot.on("ready", function(evt) {
  logger.info("Connected");
  logger.info("Logged in as: ");
  logger.info(bot.username + " - (" + bot.id + ")");
});

bot.on("message", function(user, userID, channelID, message, evt) {
  // Our bot needs to know if it will execute a command
  // It will listen for messages that will start with `!`
  if (message.substring(0, 1) == "!") {
    const options = message.substring(1).split(" ");
    const cmd = options.shift();

    // generated from readDirFiles
    if (Object.keys(commands).includes(cmd) && options[0] === "help") {
      try {
        commands[`${cmd}Help`](bot, user, userID, channelID, options);
      } catch {
        bot.sendMessage({
          to: channelID,
          message: "No help for you."
        });
      }
    } else if (Object.keys(commands).includes(cmd)) {
      commands[cmd](bot, user, userID, channelID, options);
    } else {
      bot.sendMessage({
        to: channelID,
        message: NOT_A_RECOGNIZED_COMMAND
      });
    }
  }
});
