import React, { EventHandler, SyntheticEvent } from 'react'
import cx from 'classnames'
import { Experiment } from 'dvc/src/experiments/webview/contract'
import { MessageFromWebviewType } from 'dvc/src/webview/contract'
import { RowProp, WithChanges } from './interfaces'
import styles from './styles.module.scss'
import { FirstCell, CellWrapper } from './Cell'
import { sendMessage } from '../../../shared/vscode'

const getExperimentTypeClass = ({ running, queued, selected }: Experiment) => {
  if (running) {
    return styles.runningExperiment
  }
  if (queued) {
    return styles.queuedExperiment
  }
  if (selected === false) {
    return styles.unselectedExperiment
  }

  return styles.normalExperiment
}

export const RowContent: React.FC<
  RowProp & { className?: string } & WithChanges
> = ({
  row: {
    getRowProps,
    cells: [firstCell, ...cells],
    original,
    flatIndex,
    values: { id }
  },
  className,
  changes
}): JSX.Element => {
  const isWorkspace = id === 'workspace'
  const changesIfWorkspace = isWorkspace ? changes : undefined
  const toggleExperiment: EventHandler<SyntheticEvent> = e => {
    e.preventDefault()
    e.stopPropagation()
    sendMessage({
      payload: id,
      type: MessageFromWebviewType.EXPERIMENT_TOGGLED
    })
  }
  return (
    <div
      {...getRowProps({
        className: cx(
          className,
          styles.tr,
          getExperimentTypeClass(original),
          flatIndex % 2 === 0 || styles.oddRow,
          isWorkspace ? styles.workspaceRow : styles.normalRow,
          styles.row,
          isWorkspace && changes?.length && styles.workspaceWithChanges
        )
      })}
      tabIndex={0}
      role="row"
      onClick={toggleExperiment}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          toggleExperiment(e)
        }
      }}
      data-testid={isWorkspace && 'workspace-row'}
    >
      <FirstCell cell={firstCell} bulletColor={original.displayColor} />
      {cells.map(cell => {
        const cellId = `${cell.column.id}___${cell.row.id}`
        return (
          <CellWrapper
            cell={cell}
            changes={changesIfWorkspace}
            key={cellId}
            cellId={cellId}
          />
        )
      })}
    </div>
  )
}