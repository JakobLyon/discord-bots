const { createLogger, format, transports } = require("winston");
const moment = require("moment");

exports.subscribe = class Subscribe {
  constructor(name) {
    this.subscribeLogger = createLogger({
      level: "info",
      format: format.combine(
        format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss"
        }),
        format.errors({ stack: true }),
        format.splat(),
        format.json()
      ),
      defaultMeta: { service: name },
      transports: [
        new transports.File({
          filename: `./logs/${name}-error.log`,
          level: "error"
        }),
        new transports.File({ filename: `./logs/${name}.log` })
      ]
    });
  }

  help() {
    return "This command is subscribable. Using this command will add you to the subscriber list for this command for 5 days.";
  }

  command(bot, userID, channelID) {
    // if user not subscribed, subscribe
    const subscribeSearchOptions = {
      fields: ["userID", "channelID"],
      from: moment().subtract(5, "days")
    };

    this.subscribeLogger.query(subscribeSearchOptions, (err, results) => {
      const subscribedUsers = results.file
        .filter(
          result => result.channelID === channelID
        ).map(result => result.userID);

      if (!subscribedUsers.includes(userID)) {
        this.subscribeLogger.info("", {
          userID,
          channelID
        });

        subscribedUsers.push(userID);
      }

      bot.sendMessage({
        to: channelID,
        message: `${subscribedUsers.reduce((acc, userID) => `<@${userID}> ${acc}`, "")}`
      });
    });
  }
};
