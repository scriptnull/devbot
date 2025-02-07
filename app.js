var Botkit = require('botkit');
var os = require('os');
var fuzzyset = require('fuzzyset.js');

var controller = Botkit.slackbot({
    debug: true,
});

var bot = controller.spawn({
    token: 'XXXX'
}).startRTM();




var initDb = require('./dbconfig/db.js');
initDb(function () {
  var object = {};
  var UserModel = require('./api/users/model.js');
  var getByUserid = require('./api/users/getByUserid.js');
  var askCloudProvider = function(err, convo) {
    convo.ask('What is your cloud provider?', function(response, convo) {
      var resp = FuzzySet();
      resp.add("digital ocean");

      if (parseFloat(resp.get(response.text)) > 0.8) {
        object.cloudProvider = response.text;
        convo.say('Awesome.');
        askAccessToken(response, convo);
      } else {
        convo.say('I dont think I heard you correctly.')
        convo.repeat();
      }
      convo.next();
    });
  };
  var askAccessToken = function(response, convo) {
    convo.ask('Can you provide your access token?', function(response, convo) {
      convo.say('Ok. cool. Your token is safe with us ! Dont worry')
        object.token = response.text;
        UserModel.create(object).then(function (task) {
// access the newly created task via the variable task
console.log('Inserted in db successfully')

})
      convo.next();
    });
  };


  controller.hears(['spinserver'], ['direct_message','direct_mention','message_received'], function(bot,message) {
          object.userid = message.user;
          getByUserid(message.user, function(user) {
            if(user) {
              // Spin up the server
            } else {
              bot.startConversation(message, askCloudProvider);
            }
          })
  });

  controller.hears(['show', 'shoe'], 'direct_message,direct_mention,mention', function(bot, message) {
    getByUserid(message.user, function(user) {
      if(user) {
        // Show the server
      } else {
        bot.startConversation(message, askCloudProvider);
      }
    })
    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!' + ' I am there to assist you in your server');
        } else {
            bot.reply(message, 'Hello.' + ' I am there to assist you in server')
        }
    });
  });

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {
  bot.api.reactions.add({
      timestamp: message.ts,
      channel: message.channel,
      name: 'robot_face',
  }, function(err, res) {
      if (err) {
          bot.botkit.log('Failed to add emoji reaction :(', err);
      }
  });


  controller.storage.users.get(message.user, function(err, user) {
      if (user && user.name) {
          bot.reply(message, 'Hello ' + user.name + '!!' + ' I am there to assist you in your server');
      } else {
          bot.reply(message, 'Hello.' + ' I am there to assist you in server')
      }
  });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

  controller.storage.users.get(message.user, function(err, user) {
      if (user && user.name) {
          bot.reply(message, 'Your name is ' + user.name);
      } else {
          bot.startConversation(message, function(err, convo) {
              if (!err) {
                  convo.say('I do not know your name yet!');
                  convo .ask('What should I call you?', function(response, convo) {
                      convo.ask('You want me to call you `' + response.text + '`?', [
                          {
                              pattern: 'yes',
                              callback: function(response, convo) {
                                  // since no further messages are queued after this,
                                  // the conversation will end naturally with status == 'completed'
                                  convo.next();
                              }
                          },
                          {
                              pattern: 'no',
                              callback: function(response, convo) {
                                  // stop the conversation. this will cause it to end with status == 'stopped'
                                  convo.stop();
                              }
                          },
                          {
                              default: true,
                              callback: function(response, convo) {
                                  convo.repeat();
                                  convo.next();
                              }
                          }
                      ]);

                      convo.next();

                  }, {'key': 'nickname'}); // store the results in a field called nickname

                  convo.on('end', function(convo) {
                      if (convo.status == 'completed') {
                          bot.reply(message, 'OK! I will update my dossier...');

                          controller.storage.users.get(message.user, function(err, user) {
                              if (!user) {
                                  user = {
                                      id: message.user,
                                  };
                              }
                              user.name = convo.extractResponse('nickname');
                              controller.storage.users.save(user, function(err, id) {
                                  bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                              });
                          });



                      } else {
                          // this happens if the conversation ended prematurely for some reason
                          bot.reply(message, 'OK, nevermind!');
                      }
                  });
              }
          });
      }
  });
});


controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

  bot.startConversation(message, function(err, convo) {

      convo.ask('Are you sure you want me to shutdown?', [
          {
              pattern: bot.utterances.yes,
              callback: function(response, convo) {
                  convo.say('Bye!');
                  convo.next();
                  setTimeout(function() {
                      process.exit();
                  }, 3000);
              }
          },
      {
          pattern: bot.utterances.no,
          default: true,
          callback: function(response, convo) {
              convo.say('*Phew!*');
              convo.next();
          }
      }
      ]);
  });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
  'direct_message,direct_mention,mention', function(bot, message) {

      var hostname = os.hostname();
      var uptime = formatUptime(process.uptime());

      bot.reply(message,
          ':robot_face: I am a bot named <@' + bot.identity.name +
           '>. I have been running for ' + uptime + ' on ' + hostname + '.');

  });


function formatUptime(uptime) {
  var unit = 'second';
  if (uptime > 60) {
      uptime = uptime / 60;
      unit = 'minute';
  }
  if (uptime > 60) {
      uptime = uptime / 60;
      unit = 'hour';
  }
  if (uptime != 1) {
      unit = unit + 's';
  }

  uptime = uptime + ' ' + unit;
  return uptime;
}
});
