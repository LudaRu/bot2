const duty = require('duty')
const fs = require('fs')

duty.register('test-job', function (data, done) {
  // do your magic
  done(null, {ok: 1})
})

duty.

duty('test-job', {hello: 'world'}, function (err, job) {
  const f = 0
})



