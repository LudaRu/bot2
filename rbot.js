const mineflayer = require('./index')
const bloodhoundPlugin = require('./lib/bloodhound')(mineflayer);
const navigatePlugin = require('./lib/navigate')(mineflayer)
const vec3 = require('vec3')
const exec = require('executive')

const bot = mineflayer.createBot({
  username:  'ImNoBot',
  verbose: true,
  port: 25565,
  host:  'localhost',
})

bloodhoundPlugin(bot);
navigatePlugin(bot)




bot.on('chat', (username, msg) => {
  const f = bot.username;
  switch (msg) {
    case '1':
      const findTree = bot.findBlock({ // Find tree task. Sets activeTree to the tree it finds
        matching: 17,
        maxDistance: 2,
        count: 50,
        point: bot.entity.position
      })

      if(findTree) {
        bot.chat(findTree.position.toString());
      } else {
        bot.chat('Не вижу дерева');
      }

      // chunkArray(bot.players[bot.username].entity.position.x, bot.players[bot.username].entity.position.z);
      break
  }
})

let targetEntity = null
let timeoutId = null;

function moveToTarget() {
  if (targetEntity == null) return;

  var path = bot.navigate.findPathSync(targetEntity.position, {
    timeout: 1 * 1000,
    endRadius: 4,
  });
  bot.navigate.walk(path.path, function() {
    if (targetEntity != null) {
      bot.lookAt(targetEntity.position.plus(vec3(0, 1.62, 0)));
    }
  });

  timeoutId = setTimeout(moveToTarget, 500);
}

function stopFollow() {
  if (targetEntity == null) return;
  targetEntity = null;
  clearTimeout(timeoutId);
  bot.navigate.stop('interrupted');
}

function followEntity(entity, responderFunc) {
  if (entity == null) return false;
  targetEntity = entity;

  if (targetEntity != null) {
    stopFollow();
  }
  targetEntity = entity;
  timeoutId = setTimeout(moveToTarget, 0);
}




// // turn on yaw correlation, for better distinguishing of attacks within short radius
// bot.bloodhound.yaw_correlation_enabled = true;
//
// let isAttaking = false;
// bot.on('onCorrelateAttack', function (attacker, hurt, weapon) {
//
//   let flagStop = false;
//   bot.on('chat', (username, msg) => {
//     if (msg === 'прости' && username === attacker.username) {
//       bot.chat('ок')
//       flagStop = true;
//       attacker = false;
//     }
//   })
//
//   if (hurt.type === 'player') {
//     // bot.chat('ЗАМОЧУ ' + attacker.username );
//   } else {
//     // bot.chat('ЗАМОЧУ ' + attacker.displayName );
//   }
//
//   isAttaking = true;
//   if(isAttaking) {
//     followEntity(attacker);
//     setInterval(() => {bot.attack(attacker);}, 100)
//   }
//
//   if(weapon) {
//     // bot.chat('Меня атаковали  ' +  weapon.displayName);
//   }
//
// });
//
// bot.on('playerCollect', (collector, collected) => {
//   if (bot.username === collector.username) {
//     bot.chat('Я взял!')
//   }
// })


