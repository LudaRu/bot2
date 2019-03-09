var vec3 = require('vec3');
    
module.exports = {
    inject: inject,
};

function inject(bot) {
    // var chatCommands = require('./chatCommands');
    // var players = require('./players');
    // var commanderRespondFunc; // RespondFunc for user who issued the command
    // var targetEntity; // Target entity to follow
    // var timeoutId;
    //
    // module.exports.followEntity = followEntity;


    // bot.on('entityGone', function onGone(entity) {
    //     if (targetEntity == null) return;
    //     if (entity != targetEntity) return;
    //
    //     if (commanderRespondFunc.username === entity.username) {
    //         commanderRespondFunc('You moved out of range, no longer following you.');
    //     } else {
    //         commanderRespondFunc(entity.username + ' moved out of range, no longer following them.');
    //         if (commanderRespondFunc.chatType !== 'chat' || bot.quietMode) {
    //             bot.whisper(entity.username, 'You moved out of range, no longer following you.');
    //         }
    //     }
    //
    //     stopFollow();
    // });
}