var Discord = require("discord.io");
var logger = require("winston");
var auth = require("./auth.json");
var moment = require("moment");
var _ = require("lodash");

const { createLogger, format, transports } = require("winston");

const NO_COOLDOWN_USAGE = "No cooldown usage recorded";
const NOT_A_RECOGNIZED_COMMAND = "Not a recognized command";

const moonclothLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "mooncloth" },
  transports: [
    new transports.File({ filename: "mooncloth-error.log", level: "error" }),
    new transports.File({ filename: "mooncloth.log" })
  ]
});

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true
});
logger.level = "debug";
// Initialize Discord Bot
var bot = new Discord.Client({
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
    var cmd = message.substring(1);

    switch (cmd) {
      case "ping":
        bot.sendMessage({
          to: channelID,
          message: "Pong!"
        });
        break;
      case "mooncloth make":
        const moonclothTimer = moment().add(4, "days");
        const moonclothMessage = `${user}: Cooldown available on ${moonclothTimer}`;
        moonclothLogger.info(moonclothMessage, {
          user,
          cooldownAvailable: moonclothTimer
        });
        bot.sendMessage({
          to: channelID,
          message: moonclothMessage
        });
        break;
      case "mooncloth remind":
        const searchOptions = {
          fields: ["message", "user", "timestamp", "cooldownAvailable"],
          limit: 10,
          from: moment().subtract(30, "days")
        };
        const moonclothReminder = moonclothLogger.query(
          searchOptions,
          (err, results) => {
            if (!results || results.file.length === 0) {
              console.log("no results");
              bot.sendMessage({
                to: channelID,
                message: NO_COOLDOWN_USAGE
              });
              return;
            }
            const sortedAvailabilities = results.file
              .filter(result => result.user === user)
              .map(result => moment(result.cooldownAvailable))
              .sort(
                (a, b) =>
                  b.format("YYYYMMDDHHmmss") - a.format("YYYYMMDDHHmmss")
              );

            if (sortedAvailabilities.length === 0) {
              bot.sendMessage({
                to: channelID,
                message: NO_COOLDOWN_USAGE
              });
            }
            const nextCooldown = sortedAvailabilities[0];
            bot.sendMessage({
              to: channelID,
              message: `${user}, Your cooldown will be available on ${nextCooldown.format(
                "LL"
              )} at ${nextCooldown.format("LT")}`
            });
          }
        );
        break;
      default:
        bot.sendMessage({
          to: channelID,
          message: NOT_A_RECOGNIZED_COMMAND
        });
    }
  }
});
