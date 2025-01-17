import { Experiment } from 'dvc/src/experiments/webview/contract'
import { Cell, Row, Table } from '@tanstack/react-table'

export interface InstanceProp {
  instance: Table<Experiment>
}

export interface RowProp {
  row: Row<Experiment>
  contextMenuDisabled?: boolean
  hasRunningExperiment?: boolean
  projectHasCheckpoints?: boolean
}

export interface CellProp {
  cell: Cell<Experiment, unknown>
}
