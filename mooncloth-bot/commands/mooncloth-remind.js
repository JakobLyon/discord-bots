var moment = require("moment");
const { createLogger, format, transports } = require("winston");

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

exports.command = (bot, user, userID, channelID) => {
  const searchOptions = {
    fields: ["message", "user", "timestamp", "cooldownAvailable"],
    limit: 10,
    from: moment().subtract(30, "days")
  };
  moonclothLogger.query(searchOptions, (err, results) => {
    if (
      !results ||
      results.file.length === 0 ||
      !results.file.find(result => result.userID === userID)
    ) {
      bot.sendMessage({
        to: channelID,
        message: NO_COOLDOWN_USAGE
      });
      return;
    }

    const sortedAvailabilities = results.file
      .filter(result => result.user === user)
      .map(result => moment(result.cooldownAvailable))
      .sort((a, b) => b.format("YYYYMMDDHHmmss") - a.format("YYYYMMDDHHmmss"));

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
  });
};
