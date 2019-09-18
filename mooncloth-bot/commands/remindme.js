var moment = require("moment");
const { createGUID } = require("../../custom-utils");
const { createLogger, format, transports } = require("winston");

const remindmeLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "remindme" },
  transports: [
    new transports.File({
      filename: "./logs/remindme-error.log",
      level: "error"
    }),
    new transports.File({ filename: "./logs/remindme.log" })
  ]
});

const remindmeCancelsLogger = createLogger({
  level: "info",
  format: format.combine(
    format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "remindme" },
  transports: [
    new transports.File({
      filename: "./logs/remindme-error.log",
      level: "error"
    }),
    new transports.File({ filename: "./logs/remindme-cancels.log" })
  ]
});

exports.help = (bot, user, userID, channelID) => {
  bot.sendMessage({
    to: channelID,
    message: "remindme <event-name> <reminder-time>\nremindme <event-name> recurring <start-time> <interval>\n<start-time> : DDHHmm\n<interval> : DDHHmm"
  });
};

exports.command = (bot, user, userID, channelID, options) => {
  if (options.length === 1 && options[0] === "cancel") {
    // cancel all reminders for user
    const remindmeSearchOptions = {
      fields: [
        "userID",
        "id",
        "reminderTime",
        "channelID",
        "reminderName",
        "reminderInterval",
        "type"
      ],
      from: moment().subtract(10, "days")
    };
    remindmeLogger.query(remindmeSearchOptions, (err, results) => {
      const toDoEvents = results.file.filter(result => {
        return (
          moment(result.reminderTime).format("YYYYMMDDHHmmss") >
            moment().format("YYYYMMDDHHmmss") && result.userID === userID
        );
      });

      const remindmeCancelSearchOptions = {
        fields: ["id"],
        from: moment().subtract(10, "days")
      };

      remindmeCancelsLogger.query(
        remindmeCancelSearchOptions,
        (err, results) => {
          const canceledEvents = results.file.map(result => result.id);

          toDoEvents.forEach(event => {
            if (!canceledEvents.includes(event.id)) {
              // do event
              bot.sendMessage({
                to: event.channelID,
                message: `<@${event.userID}>, reminder ${
                  event.reminderName
                } for ${moment(event.reminderTime).format(
                  "LL LT"
                )} has been canceled`
              });

              // cancel event
              remindmeCancelsLogger.info("", {
                id: event.id,
                userID: event.userID
              });
            }
          });
        }
      );
    });
    return;
  }

  // check for valid input
  if (options.length === 0) {
    bot.sendMessage({
      to: channelID,
      message: "Invalid usage of command."
    });
  }

  const reminderName = options.shift();

  let flag = false;
  options.forEach((option, index) => {
    if (
      !option.match(/^\d\d\d\d\d\d$|^recurring$/) ||
      (option.match(/^recurring$/) &&
        !options[index + 1].match(/^\d\d\d\d\d\d$/) &&
        !options[index + 2].match(/^\d\d\d\d\d\d$/))
    ) {
      flag = true;
    }
  });

  if (flag) {
    bot.sendMessage({
      to: channelID,
      message: "Invalid usage of command."
    });
    return;
  }

  // parse options
  let reminders = [];
  options.forEach((option, index) => {
    let reminder = {};
    if (option === "recurring") {
      const reminderTime = options[index + 1];
      const reminderInterval = options[index + 2];
      const reminderTimeDays = reminderTime.substring(0, 2);
      const reminderTimeHours = reminderTime.substring(2, 4);
      const reminderTimeMinutes = reminderTime.substring(4, 6);
      options.splice(index + 1, 2);
      reminder = {
        userID,
        reminderTime: moment()
          .add(reminderTimeDays, "days")
          .add(reminderTimeHours, "hours")
          .add(reminderTimeMinutes, "minutes"),
        reminderInterval,
        id: createGUID(),
        channelID,
        type: "recurring",
        reminderName
      };
    } else {
      const days = option.substring(0, 2);
      const hours = option.substring(2, 4);
      const minutes = option.substring(4, 6);
      reminder = {
        userID,
        reminderTime: moment()
          .add(days, "days")
          .add(hours, "hours")
          .add(minutes, "minutes")
          .format(),
        id: createGUID(),
        channelID,
        reminderName
      };
    }
    reminders.push(reminder);
  });

  reminders.forEach(reminder => remindmeLogger.info("", reminder));
  bot.sendMessage({
    to: channelID,
    message: `<@${userID}>, your ${reminders.length} reminders have been recorded.`
  });
};
