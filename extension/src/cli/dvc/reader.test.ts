import { join } from 'path'
import { EventEmitter } from 'vscode'
import { Disposable, Disposer } from '@hediet/std/disposable'
import { UNEXPECTED_ERROR_CODE } from './constants'
import { DvcReader, ExperimentsOutput } from './reader'
import { CliResult, CliStarted } from '..'
import { MaybeConsoleError } from '../error'
import { createProcess } from '../../processExecution'
import { getFailingMockedProcess, getMockedProcess } from '../../test/util/jest'
import { getProcessEnv } from '../../env'
import expShowFixture from '../../test/fixtures/expShow/output'
import plotsDiffFixture from '../../test/fixtures/plotsDiff/output/minimal'
import { Config } from '../../config'

jest.mock('vscode')
jest.mock('@hediet/std/disposable')
jest.mock('fs')
jest.mock('../../processExecution')
jest.mock('../../env')
jest.mock('../../common/logger')

const mockedDisposable = jest.mocked(Disposable)

const mockedCreateProcess = jest.mocked(createProcess)
const mockedGetProcessEnv = jest.mocked(getProcessEnv)
const mockedEnv = {
  DVCLIVE_OPEN: 'false',
  DVC_NO_ANALYTICS: 'true',
  PATH: '/all/of/the/goodies:/in/my/path'
}
const SHOW_JSON = '--show-json'

beforeEach(() => {
  jest.resetAllMocks()
  mockedGetProcessEnv.mockReturnValueOnce(mockedEnv)
})

describe('CliReader', () => {
  mockedDisposable.fn.mockReturnValueOnce({
    track: function <T>(disposable: T): T {
      return disposable
    },
    untrack: function <T>(disposable: T): T {
      return disposable
    }
  } as unknown as (() => void) & Disposer)

  const dvcReader = new DvcReader(
    {
      getCliPath: () => undefined,
      pythonBinPath: undefined
    } as unknown as Config,
    {
      processCompleted: {
        event: jest.fn(),
        fire: jest.fn()
      } as unknown as EventEmitter<CliResult>,
      processStarted: {
        event: jest.fn(),
        fire: jest.fn()
      } as unknown as EventEmitter<CliStarted>
    }
  )

  describe('experimentShow', () => {
    it('should match the expected output', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(expShowFixture))
      )

      const cliOutput = await dvcReader.expShow(cwd)
      expect(cliOutput).toStrictEqual(expShowFixture)
      expect(mockedCreateProcess).toBeCalledWith({
        args: ['exp', 'show', SHOW_JSON],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should return the default output if the cli returns an unexpected error (255 exit code)', async () => {
      const cwd = __dirname
      const error = new Error('unexpected error - something something')
      ;(error as MaybeConsoleError).exitCode = UNEXPECTED_ERROR_CODE
      mockedCreateProcess.mockImplementationOnce(() => {
        throw error
      })

      const cliOutput = await dvcReader.expShow(cwd)
      expect(cliOutput).toStrictEqual({ workspace: { baseline: {} } })
    })

    it('should retry the cli given any other type of error', async () => {
      const cwd = __dirname
      const mockOutput: ExperimentsOutput = {
        workspace: {
          baseline: {
            data: { params: { 'params.yaml': { data: { epochs: 100000000 } } } }
          }
        }
      }
      mockedCreateProcess.mockImplementationOnce(() => {
        throw new Error('error that should be retried')
      })
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(mockOutput))
      )

      const cliOutput = await dvcReader.expShow(cwd)
      expect(cliOutput).toStrictEqual(mockOutput)
      expect(mockedCreateProcess).toBeCalledTimes(2)
    })
  })

  describe('diff', () => {
    it('should call the cli with the correct parameters', async () => {
      const cliOutput = {
        added: [],
        deleted: [{ path: 'data/MNIST/raw/t10k-images-idx3-ubyte' }],
        modified: [
          { path: 'data/MNIST/raw/' },
          { path: 'logs/' },
          { path: 'logs/acc.tsv' },
          { path: 'logs/loss.tsv' },
          { path: 'model.pt' },
          { path: 'predictions.json' }
        ],
        'not in cache': [],
        renamed: []
      }
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(cliOutput))
      )
      const statusOutput = await dvcReader.diff(cwd)

      expect(statusOutput).toStrictEqual(cliOutput)

      expect(mockedCreateProcess).toBeCalledWith({
        args: ['diff', SHOW_JSON],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should retry if the command returns a lock error', async () => {
      const cliOutput = ''
      const cwd = __dirname
      mockedCreateProcess
        .mockImplementationOnce(() => {
          throw new Error('I failed wit a lock error')
        })
        .mockReturnValueOnce(getMockedProcess(JSON.stringify(cliOutput)))
      const statusOutput = await dvcReader.diff(cwd)

      expect(statusOutput).toStrictEqual(cliOutput)

      expect(mockedCreateProcess).toBeCalledTimes(2)
      expect(mockedCreateProcess).toBeCalledWith({
        args: ['diff', SHOW_JSON],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('listDvcOnlyRecursive', () => {
    it('should return all relative tracked paths', async () => {
      const cwd = __dirname
      const listOutput = [
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/t10k-images-idx3-ubyte'
        },
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/t10k-images-idx3-ubyte.gz'
        },
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/t10k-labels-idx1-ubyte'
        },
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/t10k-labels-idx1-ubyte.gz'
        },
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/train-images-idx3-ubyte'
        },
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/train-images-idx3-ubyte.gz'
        },
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/train-labels-idx1-ubyte'
        },
        {
          isdir: false,
          isexec: false,
          isout: false,
          path: 'data/MNIST/raw/train-labels-idx1-ubyte.gz'
        },
        { isdir: false, isexec: false, isout: false, path: 'logs/acc.tsv' },
        { isdir: false, isexec: false, isout: false, path: 'logs/loss.tsv' },
        { isdir: false, isexec: false, isout: true, path: 'model.pt' }
      ]
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(listOutput))
      )
      const tracked = await dvcReader.listDvcOnlyRecursive(cwd)

      expect(tracked).toStrictEqual(listOutput)

      expect(mockedCreateProcess).toBeCalledWith({
        args: ['list', '.', '--dvc-only', '-R', SHOW_JSON],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('plotsDiff', () => {
    it('should handle empty output being returned', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(''))

      const plots = await dvcReader.plotsDiff(cwd, 'HEAD')
      expect(plots).toStrictEqual({})
    })

    it('should match the expected output', async () => {
      const cwd = __dirname

      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(plotsDiffFixture))
      )

      const plots = await dvcReader.plotsDiff(cwd, 'HEAD')
      expect(plots).toStrictEqual(plotsDiffFixture)
      expect(mockedCreateProcess).toBeCalledWith({
        args: [
          'plots',
          'diff',
          'HEAD',
          '-o',
          join('.dvc', 'tmp', 'plots'),
          '--split',
          SHOW_JSON
        ],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('root', () => {
    it('should return the root relative to the cwd', async () => {
      const stdout = join('..', '..')
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      const relativeRoot = await dvcReader.root(cwd)
      expect(relativeRoot).toStrictEqual(stdout)
      expect(mockedCreateProcess).toBeCalledWith({
        args: ['root'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should return undefined when run outside of a project', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getFailingMockedProcess(
          "ERROR: you are not inside of a DVC repository (checked up to mount point '/' )"
        )
      )

      const relativeRoot = await dvcReader.root(cwd)
      expect(relativeRoot).toBeUndefined()
      expect(mockedCreateProcess).toBeCalledWith({
        args: ['root'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('status', () => {
    it('should call the cli with the correct parameters', async () => {
      const cliOutput = {
        'data/MNIST/raw.dvc': [
          { 'changed outs': { 'data/MNIST/raw': 'modified' } }
        ],
        train: [
          { 'changed deps': { 'data/MNIST': 'modified' } },
          { 'changed outs': { logs: 'modified', 'model.pt': 'modified' } },
          'always changed'
        ]
      }
      const cwd = __dirname
      mockedCreateProcess.mockReturnValueOnce(
        getMockedProcess(JSON.stringify(cliOutput))
      )
      const diffOutput = await dvcReader.status(cwd)

      expect(diffOutput).toStrictEqual(cliOutput)

      expect(mockedCreateProcess).toBeCalledWith({
        args: ['status', SHOW_JSON],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })
  })

  describe('version', () => {
    it('should call execute process with the correct parameters', async () => {
      const cwd = __dirname
      const stdout = '3.9.11'
      mockedCreateProcess.mockReturnValueOnce(getMockedProcess(stdout))
      const output = await dvcReader.version(cwd)

      expect(output).toStrictEqual(stdout)
      expect(mockedCreateProcess).toBeCalledWith({
        args: ['--version'],
        cwd,
        env: mockedEnv,
        executable: 'dvc'
      })
    })

    it('should not retry if the process fails (cannot find cli - extension should reset)', async () => {
      const cwd = __dirname
      mockedCreateProcess.mockImplementationOnce(() => {
        throw new Error('spawn dvc ENOENT retrying...')
      })

      await expect(dvcReader.version(cwd)).rejects.toBeTruthy()
    })
  })
})