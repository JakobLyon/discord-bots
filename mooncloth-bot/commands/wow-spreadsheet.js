module.exports = (bot, user, userID, channelID) => {
  bot.sendMessage({
    to: channelID,
    message:
      "<https://docs.google.com/spreadsheets/d/1UKJgaVZfbrHwDkmENme5Og5P6lFEJT3YK2M5wEUuL_Q/edit?usp=sharing>"
  });
};
