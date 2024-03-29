const aStar = require('a-star')
const EventEmitter = require('events').EventEmitter

module.exports = init

// instantiated from init
const vec3 = require('vec3')

const MONITOR_INTERVAL = 40
const WATER_THRESHOLD = 20
const DEFAULT_TIMEOUT = 10 * 1000 // 10 seconds
const DEFAULT_END_RADIUS = 0.1

// if the distance is more than this number, navigator will opt to simply
// head in the correct direction and recalculate upon getting closer
const TOO_FAR_THRESHOLD = 150

function init () {
  return inject
}

function inject (bot) {
  const cardinalDirectionVectors = [
    vec3(-1, 0, 0), // north
    vec3(1, 0, 0), // south
    vec3(0, 0, -1), // east
    vec3(0, 0, 1) // west
  ]

  bot.navigate = new EventEmitter()
  bot.navigate.to = navigateTo
  bot.navigate.stop = noop
  bot.navigate.walk = walk
  bot.navigate.findPathSync = findPathSync

  bot.navigate.blocksToAvoid = {
    51: true, // fire
    59: true, // crops
    10: true, // lava
    11: true // lava
  }

  function onArrived () {
    bot.navigate.emit('arrived')
  }

  function findPathSync (end, params) {
    params = params || {}
    end = end.floored()

    const timeout = params.timeout == null ? DEFAULT_TIMEOUT : params.timeout
    const endRadius = params.endRadius == null ? DEFAULT_END_RADIUS : params.endRadius
    const tooFarThreshold = params.tooFarThreshold == null ? TOO_FAR_THRESHOLD : params.tooFarThreshold
    let actualIsEnd = params.isEnd || createIsEndWithRadius(end, endRadius)
    const heuristic = createHeuristicFn(end)

    const start = bot.entity.position.floored()
    let tooFar = false
    if (start.distanceTo(end) > tooFarThreshold) {
      // Too far to calculate reliably. Return 'tooFar' and a path to walk
      // in the general direction of end.
      actualIsEnd = function (node) {
        // let's just go 100 meters (and not end in water)
        return node.water === 0 && start.distanceTo(node.point) >= 100
      }
      tooFar = true
    }

    // search
    const results = aStar({
      start: new Node(start, 0),
      isEnd: actualIsEnd,
      neighbor: getNeighbors,
      distance: distanceFunc,
      heuristic: heuristic,
      timeout: timeout
    })
    results.status = tooFar ? 'tooFar' : results.status
    results.path = results.path.map(nodeCenterOffset)
    return results
  }

  function walk (currentCourse, callback) {
    callback = callback || noop
    let lastNodeTime = new Date().getTime()
    const monitorInterval = setInterval(monitorMovement, MONITOR_INTERVAL)
    bot.navigate.stop('interrupted')
    bot.navigate.stop = stop

    function monitorMovement () {
      let nextPoint = currentCourse[0]
      const currentPosition = bot.entity.position
      if (currentPosition.distanceTo(nextPoint) <= 0.2) {
        // arrived at next point
        lastNodeTime = new Date().getTime()
        currentCourse.shift()
        if (currentCourse.length === 0) {
          // done
          stop('arrived')
          return
        }
        // not done yet
        nextPoint = currentCourse[0]
      }
      const delta = nextPoint.minus(currentPosition)
      let gottaJump = false
      const horizontalDelta = Math.abs(delta.x + delta.z)

      if (delta.y > 0.1) {
        // gotta jump up when we're close enough
        gottaJump = horizontalDelta < 1.75
      } else if (delta.y > -0.1) {
        // possibly jump over a hole
        gottaJump = horizontalDelta > 1.5 && horizontalDelta < 2.5
      }
      bot.setControlState('jump', gottaJump)

      // run toward next point
      const lookAtY = currentPosition.y + bot.entity.height
      const lookAtPoint = vec3(nextPoint.x, lookAtY, nextPoint.z)
      bot.lookAt(lookAtPoint)
      bot.setControlState('forward', true)

      // check for futility
      if (new Date().getTime() - lastNodeTime > 1500) {
        // should never take this long to go to the next node
        bot.navigate.emit('obstructed')
        stop('obstructed')
      }
    }

    function stop (reason) {
      bot.navigate.stop = noop
      clearInterval(monitorInterval)
      bot.clearControlStates()
      bot.navigate.emit('stop', reason)
      callback(reason)
    }
  }

  function folowTo (end, params) {
    params = params || {}
    const onArrivedCb = params.onArrived ? params.onArrived : onArrived
    bot.navigate.stop('interrupted')

    const results = findPathSync(end, params)
    if (results.status === 'success') {
      bot.navigate.emit('pathFound', results.path)
      walk(results.path, function () {
        onArrivedCb()
      })
    } else if (results.status === 'tooFar') {
      // it's too far, just walk in the general direction and restart the search
      bot.navigate.emit('pathPartFound', results.path)
      walk(results.path, function () {
        navigateTo(end, params)
      })
    } else if (results.status === 'noPath' || results.status === 'timeout') {
      // can't find a path
      bot.navigate.emit('cannotFind', results.path)
    }
  }

  // publicly exposed
  function navigateTo (end, params) {
    params = params || {}
    const onArrivedCb = params.onArrived ? params.onArrived : onArrived
    bot.navigate.stop('interrupted')

    const results = findPathSync(end, params)
    if (results.status === 'success') {
      bot.navigate.emit('pathFound', results.path)
      walk(results.path, function () {
        onArrivedCb()
      })
    } else if (results.status === 'tooFar') {
      // it's too far, just walk in the general direction and restart the search
      bot.navigate.emit('pathPartFound', results.path)
      walk(results.path, function () {
        navigateTo(end, params)
      })
    } else if (results.status === 'noPath' || results.status === 'timeout') {
      // can't find a path
      bot.navigate.emit('cannotFind', results.path)
    }
  }

  function getNeighbors (node) {
    // for each cardinal direction:
    // "." is head. "+" is feet and current location.
    // "#" is initial floor which is always solid. "a"-"u" are blocks to check
    //
    //   --0123-- horizontalOffset
    //  |
    // +2  aho
    // +1  .bip
    //  0  +cjq
    // -1  #dkr
    // -2   els
    // -3   fmt
    // -4   gn
    //  |
    //  dz
    //
    const point = node.point
    const isSafeA = isSafe(bot.blockAt(point.offset(0, 2, 0)))
    const result = []
    cardinalDirectionVectors.forEach(function (directionVector) {
      let blockH, blockE
      const pointB = pointAt(1, 1)
      const blockB = properties(pointB)
      if (!blockB.safe) {
        // we can do nothing in this direction
        return
      }
      const pointC = pointAt(1, 0)
      const blockC = properties(pointC)
      if (!blockC.safe) {
        // can't walk forward
        if (!blockC.physical) {
          // too dangerous
          return
        }
        if (!isSafeA) {
          // can't jump
          return
        }
        blockH = properties(pointAt(1, 2))
        if (!blockH.safe) {
          // no head room to stand on c
          return
        }
        // can jump up onto c
        result.push(pointB)
        return
      }
      // c is open
      const pointD = pointAt(1, -1)
      const blockD = properties(pointD)
      if (blockD.physical) {
        // can walk onto d. this is the case of flat ground.
        result.push(pointC)
        return
      }
      if (blockD.safe) {
        // safe to drop through d
        const pointE = pointAt(1, -2)
        blockE = properties(pointE)
        if (blockE.physical) {
          // can drop onto e
          result.push(pointD)
        } else if (blockE.safe) {
          // can drop through e
          const pointF = pointAt(1, -3)
          const blockF = properties(pointF)
          if (blockF.physical) {
            // can drop onto f
            result.push(pointE)
          } else if (blockF.safe) {
            // can drop through f
            const blockG = properties(pointAt(1, -4))
            if (blockG.physical) {
              result.push(pointF)
            }
          }
        }
      }
      // might be able to jump over the d hole.
      blockH = properties(pointAt(1, 2))
      const blockO = properties(pointAt(2, 2))
      const canJumpForward = isSafeA && blockH.safe && blockO.safe

      const pointI = pointAt(2, 1)
      const blockI = properties(pointI)
      const pointJ = pointAt(2, 0)
      const blockJ = properties(pointJ)
      if (canJumpForward && blockI.safe && blockJ.physical) {
        // can jump over and up onto j
        result.push(pointI)
      }
      const pointK = pointAt(2, -1)
      const blockK = properties(pointK)
      let canJumpPastJ = canJumpForward && blockJ.safe && blockI.safe
      if (canJumpPastJ && blockK.physical) {
        // can jump over onto k
        result.push(pointJ)
        canJumpPastJ = false
      }

      // might be able to walk and drop forward
      const pointL = pointAt(2, -2)
      const blockL = properties(pointL)
      let canLandOnL = false
      if (blockI.safe && blockJ.safe && blockK.safe && blockL.physical) {
        // can walk and drop onto l
        canLandOnL = true
        result.push(pointK)
      }

      if (blockE === undefined) blockE = properties(pointAt(1, -2))
      let canLandOnM = false
      if (blockE.safe) {
        // can drop through e
        const pointM = pointAt(2, -3)
        const blockM = properties(pointM)
        if (blockJ.safe && blockK.safe && blockL.safe && blockM.physical) {
          // can walk and drop onto m
          canLandOnM = true
          result.push(pointL)
        }
        const blockN = properties(pointAt(2, -4))
        if (blockK.safe && blockL.safe && blockM.safe && blockN.physical) {
          // can walk and drop onto n
          result.push(pointM)
        }
      }
      if (!canJumpPastJ) return
      // 3rd column
      const blockP = properties(pointAt(3, 1))
      const pointQ = pointAt(3, 0)
      const blockQ = properties(pointQ)
      const pointR = pointAt(3, -1)
      const blockR = properties(pointR)
      if (blockP.safe && blockQ.safe && blockR.physical) {
        // can jump way over onto r
        result.push(pointQ)
        return
      }
      const pointS = pointAt(3, -2)
      const blockS = properties(pointS)
      if (!canLandOnL && blockQ.safe && blockR.safe && blockS.physical) {
        // can jump way over and down onto s
        result.push(pointR)
        return
      }
      const blockT = properties(pointAt(3, -3))
      if (!canLandOnM && blockR.safe && blockS.safe && blockT.physical) {
        // can jump way over and down onto t
        result.push(pointS)
      }

      function pointAt (horizontalOffset, dy) {
        return point.offset(directionVector.x * horizontalOffset, dy, directionVector.z * horizontalOffset)
      }
      function properties (point) {
        const block = bot.blockAt(point)
        return block ? {
          safe: isSafe(block),
          physical: block.boundingBox === 'block'
        } : {
          safe: false,
          physical: false
        }
      }
    }) // cardinalDirectionVectors.forEach

    return result.map(function (point) {
      const faceBlock = bot.blockAt(point.offset(0, 1, 0))
      let water = 0
      if (faceBlock.type === 0x08 || faceBlock.type === 0x09) {
        water = node.water + 1
      }
      return new Node(point, water)
    }).filter(function (node) {
      return node.water <= WATER_THRESHOLD
    })
  }

  function isSafe (block) {
    return block.boundingBox === 'empty' &&
      !bot.navigate.blocksToAvoid[block.type]
  }
}

function createIsEndWithRadius (end, radius) {
  return function (node) {
    return node.point.distanceTo(end) <= radius
  }
}

function distanceFunc (nodeA, nodeB) {
  return nodeA.point.distanceTo(nodeB.point)
}

function nodeCenterOffset (node) {
  return node.point.offset(0.5, 0, 0.5)
}

function Node (point, water) {
  this.point = point
  this.water = water
}
Node.prototype.toString = function () {
  // must declare a toString so that A* works.
  return this.point.toString() + ':' + this.water
}

function createHeuristicFn (end) {
  return function (node) {
    return node.point.distanceTo(end) + 5 * node.water
  }
}

function noop () {}
