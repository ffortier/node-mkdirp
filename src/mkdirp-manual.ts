import { dirname } from 'path'
import { MkdirpOptions, optsArg } from './opts-arg.js'

export const mkdirpManualSync = (
  path: string,
  options?: MkdirpOptions,
  made?: string | undefined | void
): string | undefined | void => {
  const parent = dirname(path)
  const opts = { ...optsArg(options), recursive: false }

  if (parent === path) {
    try {
      return opts.mkdirSync(path, opts)
    } catch (er) {
      // swallowed by recursive implementation on posix systems
      // any other error is a failure
      const fer = er as NodeJS.ErrnoException
      if (fer?.code !== 'EISDIR') {
        throw er
      }
      return
    }
  }

  try {
    opts.mkdirSync(path, opts)
    return made || path
  } catch (er) {
    const fer = er as NodeJS.ErrnoException
    if (fer?.code === 'ENOENT')
      return mkdirpManualSync(path, opts, mkdirpManualSync(parent, opts, made))
    if (fer?.code !== 'EEXIST' && fer?.code !== 'EROFS') throw er
    try {
      if (!opts.statSync(path).isDirectory()) throw er
    } catch (_) {
      throw er
    }
  }
}

export const mkdirpManual = Object.assign(
  async (
    path: string,
    options?: MkdirpOptions,
    made?: string | undefined | void
  ): Promise<string | undefined | void> => {
    const opts = optsArg(options)
    opts.recursive = false
    const parent = dirname(path)
    if (parent === path) {
      return opts.mkdirAsync(path, opts).catch(er => {
        // swallowed by recursive implementation on posix systems
        // any other error is a failure
        const fer = er as NodeJS.ErrnoException
        if (fer?.code !== 'EISDIR') {
          throw er
        }
      })
    }

    return opts.mkdirAsync(path, opts).then(
      () => made || path,
      async er => {
        const fer = er as NodeJS.ErrnoException
        if (fer?.code === 'ENOENT')
          return mkdirpManual(parent, opts).then(
            (made?: string | undefined | void) => mkdirpManual(path, opts, made)
          )
        if (fer?.code !== 'EEXIST' && fer?.code !== 'EROFS') throw er
        return opts.statAsync(path).then(
          st => {
            if (st.isDirectory()) {
              return made
            } else {
              throw er
            }
          },
          () => {
            throw er
          }
        )
      }
    )
  },
  { sync: mkdirpManualSync }
)
