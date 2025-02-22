const cmd = require.resolve('../dist/cjs/bin.js')
import t from 'tap'
import { MkdirpOptions } from '../dist/cjs/opts-arg.js'

import { spawn } from 'child_process'
import { basename } from 'path'

const fakeMkdirp = (path: string, opts: MkdirpOptions) =>
  basename(path) === 'ERROR'
    ? Promise.reject(new Error('nope'))
    : basename(path) === 'EFAIL'
    ? Promise.reject(Object.assign(new Error('fail'), { code: 'EFAIL' }))
    : opts && typeof opts === 'object'
    ? Promise.resolve(`${path} ${opts.mode || 0}`)
    : Promise.reject('wtf')

fakeMkdirp.manual = (path: string, opts: MkdirpOptions) =>
  fakeMkdirp(`MANUAL ${path}`, opts)

if (process.argv[2] === 'RUN') {
  process.argv = [process.execPath, cmd, ...process.argv.slice(3)]
  t.mock(cmd, {
    '../': fakeMkdirp,
    '../package.json': {
      version: '4.2.0-69.lol',
    },
  })
} else {
  const run = (...args: string[]) =>
    new Promise(res => {
      const proc = spawn(process.execPath, [__filename, 'RUN', ...args])
      const out: Buffer[] = []
      const err: Buffer[] = []
      proc.stdout.on('data', c => out.push(c))
      proc.stderr.on('data', c => err.push(c))
      proc.on('close', (code, signal) => {
        res({
          code,
          signal,
          stdout: Buffer.concat(out).toString('utf8'),
          stderr: Buffer.concat(err).toString('utf8'),
        })
      })
    })

  t.test('-h --help prints usage', t =>
    Promise.all([run('-h'), run('--help')]).then(res => {
      t.strictSame(res[0], res[1], 'same for -h and --help')
      t.matchSnapshot(res[0], '--help output')
    })
  )

  t.test('no dirs -> stderr usage', t => t.resolveMatchSnapshot(run()))

  t.test('-v --version prints version', t =>
    Promise.all([run('-v'), run('--version')]).then(res => {
      t.strictSame(res[0], res[1], 'same for -v and --version')
      t.matchSnapshot(res[0], '--version output')
    })
  )

  t.test('making dirs', t => t.resolveMatchSnapshot(run('a', 'b/c/d', 'e')))
  t.test('noisily', t => t.resolveMatchSnapshot(run('a', 'b/c/d', '--print')))
  t.test('manual', t =>
    t.resolveMatchSnapshot(run('a', 'b/c/d', '-p', '--manual'))
  )
  t.test('print modes', t => t.resolveMatchSnapshot(run('a', '-m775', '-p')))
  t.test('invalid mode', t => t.resolveMatchSnapshot(run('--mode=XYZ')))
  t.test('make dir named --help', t =>
    t.resolveMatchSnapshot(run('-p', '--', '--help'))
  )
  t.test('failures', t =>
    t.resolveMatchSnapshot(Promise.all([run('x/ERROR'), run('x/EFAIL')]))
  )
}
